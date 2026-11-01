// Shared validation, quoting and bounded download helpers for the Minecraft server manager.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HOST = /^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/;
const USER = /^[A-Za-z_][A-Za-z0-9_.-]{0,31}$/;
const REMOTE_PATH = /^\/[A-Za-z0-9._\/-]{1,1023}$/;
const PLAYER = /^[A-Za-z0-9_]{3,16}$/;

function fail(code, detail) {
  const error = new Error(code);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function assertId(value) {
  if (typeof value !== "string" || !ID.test(value)) throw fail("INVALID_SERVER_ID");
  return value;
}

function assertSshHost(host) {
  if (!host || typeof host !== "object") throw fail("INVALID_SSH_HOST");
  const { hostname, user, port = 22 } = host;
  if (typeof hostname !== "string" || !HOST.test(hostname)) throw fail("INVALID_SSH_HOST");
  if (typeof user !== "string" || !USER.test(user)) throw fail("INVALID_SSH_USER");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw fail("INVALID_SSH_PORT");
  return { hostname, user, port };
}

function assertRemotePath(value) {
  if (typeof value !== "string" || !REMOTE_PATH.test(value) || value.split("/").includes(".."))
    throw fail("INVALID_REMOTE_PATH");
  return value.replace(/\/+$/, "") || "/";
}

function assertLocalFolder(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.length > 1024)
    throw fail("INVALID_FOLDER");
  return path.resolve(value);
}

function assertPlayerName(value) {
  if (typeof value !== "string" || !PLAYER.test(value)) throw fail("INVALID_PLAYER_NAME");
  return value;
}

function assertPort(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw fail("INVALID_PORT");
  return value;
}

/** Single-quote a value for a POSIX shell. Only used on already-validated values. */
function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** A console line must be one printable line; commands never reach a shell unquoted. */
function assertConsoleLine(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || /[\r\n\0]/.test(value))
    throw fail("INVALID_COMMAND");
  return value.trim().replace(/^\//, "");
}

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "piston-data.mojang.com",
  "piston-meta.mojang.com",
  "launcher.mojang.com",
  "fill-data.papermc.io",
  "meta.fabricmc.net",
  "cdn.modrinth.com",
]);

function assertDownloadUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw fail("INVALID_DOWNLOAD_URL");
  }
  if (parsed.protocol !== "https:" || !ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname))
    throw fail("DOWNLOAD_HOST_NOT_ALLOWED", parsed.hostname);
  return parsed.toString();
}

/**
 * Download to a temporary file, check size and digest, then rename into place.
 * `expect` holds any of { size, sha1, sha256, sha512 }; a missing digest is reported, never invented.
 */
async function downloadVerified(url, destination, expect = {}, { fetchImpl = fetch, maxBytes = 1024 ** 3, signal, onProgress } = {}) {
  assertDownloadUrl(url);
  const response = await fetchImpl(url, { signal, redirect: "follow" });
  if (!response.ok || !response.body) throw fail("DOWNLOAD_FAILED", String(response.status));
  if (response.url) assertDownloadUrl(response.url);
  const limit = expect.size ? Math.min(expect.size, maxBytes) : maxBytes;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.part`;
  const hashes = {
    sha1: crypto.createHash("sha1"),
    sha256: crypto.createHash("sha256"),
    sha512: crypto.createHash("sha512"),
  };
  const handle = fs.openSync(temporary, "w", 0o644);
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > limit) throw fail("DOWNLOAD_TOO_LARGE");
      for (const hash of Object.values(hashes)) hash.update(chunk);
      fs.writeSync(handle, chunk);
      onProgress?.(bytes, expect.size || 0);
    }
  } catch (error) {
    fs.closeSync(handle);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  fs.closeSync(handle);
  const digests = Object.fromEntries(Object.entries(hashes).map(([k, h]) => [k, h.digest("hex")]));
  const problems = [];
  if (expect.size && bytes !== expect.size) problems.push("size");
  for (const kind of ["sha1", "sha256", "sha512"])
    if (expect[kind] && expect[kind].toLowerCase() !== digests[kind]) problems.push(kind);
  if (problems.length) {
    fs.rmSync(temporary, { force: true });
    throw fail("DOWNLOAD_INTEGRITY_FAILED", problems.join(","));
  }
  fs.renameSync(temporary, destination);
  const verifiedBy = ["sha1", "sha256", "sha512"].filter((k) => expect[k]);
  return { bytes, digests, verifiedBy, integrityKnown: verifiedBy.length > 0 };
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text);
  fs.renameSync(temporary, file);
}

module.exports = {
  fail,
  assertId,
  assertSshHost,
  assertRemotePath,
  assertLocalFolder,
  assertPlayerName,
  assertPort,
  assertConsoleLine,
  assertDownloadUrl,
  shQuote,
  downloadVerified,
  sha256File,
  atomicWrite,
  ALLOWED_DOWNLOAD_HOSTS,
};
