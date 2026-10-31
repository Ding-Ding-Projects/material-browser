// Element locks: a playful second key on a profile, section or control.
// They are deliberately not a security boundary; the vault is. Secrets are kept
// only as salted PBKDF2 digests, authenticator codes follow RFC 6238.

/** @type {[string, string, string[]][]} */
export const METHODS = [
  ["pin", "PIN", ["pin"]],
  ["password", "Password", ["password"]],
  ["pin+password", "PIN and password", ["pin", "password"]],
  ["password+code", "Password and authenticator code", ["password", "code"]],
  ["pin+code", "PIN and authenticator code", ["pin", "code"]],
  ["password+pin+code", "Password, PIN and code", ["password", "pin", "code"]],
];
export const MAX_TRIES = 5;
export const WAIT_MS = 4 * 60 * 1000;
export const LADDER_RUNS_PER_HOUR = 3;

export function factors(method) {
  return METHODS.find(([id]) => id === method)?.[2] || [];
}

const encoder = new TextEncoder();
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (text) => new Uint8Array((text.match(/../g) || []).map((h) => parseInt(h, 16)));

export function randomHex(length = 16) {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(length)));
}

export async function digest(secret, salt, iterations = 120000) {
  const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations }, key, 256);
  return hex(bits);
}

export function validPin(pin) {
  return /^\d{4,12}$/.test(pin);
}
export function validPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 256;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(20));
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function base32Bytes(secret) {
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error("INVALID_SECRET");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
export async function totp(secret, at = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(at / 1000 / step);
  const message = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const key = await globalThis.crypto.subtle.importKey("raw", base32Bytes(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}
export async function totpMatches(secret, code, at = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  for (const drift of [0, -30000, 30000]) if ((await totp(secret, at + drift)) === code) return true;
  return false;
}
export function otpauthUri(secret, label) {
  return `otpauth://totp/${encodeURIComponent(`Material Browser:${label}`)}?secret=${secret}&issuer=${encodeURIComponent("Material Browser")}`;
}

/** Builds a lock record. Plain secrets never leave this function. */
export async function createLock({ id, label, method, pin, password, codeSecret, now = Date.now() }) {
  const need = factors(method);
  if (!need.length) throw new Error("INVALID_METHOD");
  const salt = randomHex();
  const record = { id, label, method, salt, createdAt: now, failures: 0, lockedUntil: 0, ladder: [] };
  if (need.includes("pin")) {
    if (!validPin(pin)) throw new Error("INVALID_PIN");
    record.pin = await digest(`pin:${pin}`, salt);
  }
  if (need.includes("password")) {
    if (!validPassword(password)) throw new Error("INVALID_PASSWORD");
    record.password = await digest(`password:${password}`, salt);
  }
  if (need.includes("code")) {
    if (!codeSecret) throw new Error("INVALID_SECRET");
    record.codeSecret = codeSecret;
  }
  return record;
}

export function waiting(record, now = Date.now()) {
  return Math.max(0, (record?.lockedUntil || 0) - now);
}

/** Verifies every factor of the lock. Returns the next record and whether it opened. */
export async function attempt(record, { pin, password, code }, now = Date.now()) {
  if (waiting(record, now) > 0) return { ok: false, record, reason: "WAITING" };
  const need = factors(record.method);
  let ok = true;
  if (need.includes("pin")) ok = (await digest(`pin:${pin || ""}`, record.salt)) === record.pin && ok;
  if (need.includes("password")) ok = (await digest(`password:${password || ""}`, record.salt)) === record.password && ok;
  if (need.includes("code")) ok = (await totpMatches(record.codeSecret, code || "", now)) && ok;
  if (ok) return { ok: true, record: { ...record, failures: 0, lockedUntil: 0 } };
  const failures = (record.failures || 0) + 1;
  return {
    ok: false,
    reason: failures >= MAX_TRIES ? "TOO_MANY" : "WRONG",
    record: { ...record, failures: failures >= MAX_TRIES ? 0 : failures, lockedUntil: failures >= MAX_TRIES ? now + WAIT_MS : 0 },
  };
}

export function ladderRunsLeft(record, now = Date.now()) {
  const recent = (record?.ladder || []).filter((at) => now - at < 3600000);
  return Math.max(0, LADDER_RUNS_PER_HOUR - recent.length);
}

/** Finishing a rung clears the waiting time, never the lock itself. */
export function completeRung(record, now = Date.now()) {
  if (ladderRunsLeft(record, now) <= 0) return { ok: false, record };
  return {
    ok: true,
    record: { ...record, lockedUntil: 0, failures: 0, ladder: [...(record.ladder || []).filter((at) => now - at < 3600000), now] },
  };
}

/** Sums rung: ten additions with deterministic generation from a seed for testing. */
export function sums(seed = Date.now(), count = 10) {
  let state = seed >>> 0 || 1;
  const next = () => ((state = (state * 1664525 + 1013904223) >>> 0) % 40) + 5;
  return Array.from({ length: count }, () => {
    const a = next(), b = next();
    return { a, b, answer: a + b };
  });
}

export const DIM_SUM = [
  ["Siu mai", "燒賣", "Open-topped pork and shrimp dumpling"],
  ["Har gow", "蝦餃", "Translucent shrimp dumpling with pleats"],
  ["Char siu bao", "叉燒包", "Fluffy bun filled with barbecue pork"],
  ["Cheung fun", "腸粉", "Steamed rice noodle roll with soy sauce"],
  ["Lo mai gai", "糯米雞", "Sticky rice steamed in a lotus leaf"],
  ["Egg tart", "蛋撻", "Flaky pastry with a baked custard centre"],
  ["Turnip cake", "蘿蔔糕", "Pan-fried radish cake"],
  ["Phoenix claws", "鳳爪", "Braised chicken feet in black bean sauce"],
  ["Ham sui gok", "鹹水角", "Crisp glutinous rice dumpling"],
  ["Ma lai go", "馬拉糕", "Steamed brown sugar sponge cake"],
];
