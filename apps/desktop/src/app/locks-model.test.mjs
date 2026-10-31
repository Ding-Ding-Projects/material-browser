import test from "node:test";
import assert from "node:assert/strict";
import { createLock, attempt, totp, totpMatches, completeRung, ladderRunsLeft, factors, sums, MAX_TRIES, WAIT_MS } from "./locks-model.mjs";

test("RFC 6238 SHA-1 test vector produces the expected six digits", async () => {
  // Secret "12345678901234567890" in base32.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(await totp(secret, 59000, 30, 8), "94287082");
  assert.equal(await totp(secret, 1111111109000, 30, 8), "07081804");
  assert.equal(await totpMatches(secret, (await totp(secret, 1e12)), 1e12), true);
  assert.equal(await totpMatches(secret, "abc", 1e12), false);
});

test("locks keep only digests and need every factor", async () => {
  const lock = await createLock({ id: "p1", label: "Testing", method: "pin+password", pin: "4821", password: "dumplings" });
  assert.equal(JSON.stringify(lock).includes("4821"), false);
  assert.equal(JSON.stringify(lock).includes("dumplings"), false);
  assert.deepEqual(factors("pin+password"), ["pin", "password"]);
  assert.equal((await attempt(lock, { pin: "4821" })).ok, false);
  assert.equal((await attempt(lock, { pin: "4821", password: "dumplings" })).ok, true);
  await assert.rejects(createLock({ id: "x", method: "pin", pin: "12" }), /INVALID_PIN/);
});

test("too many tries wait, and a ladder rung clears the wait but never the lock", async () => {
  let lock = await createLock({ id: "p1", label: "Testing", method: "pin", pin: "1234" });
  const now = 1_000_000;
  for (let i = 0; i < MAX_TRIES; i++) lock = (await attempt(lock, { pin: "0000" }, now)).record;
  assert.equal(lock.lockedUntil, now + WAIT_MS);
  assert.equal((await attempt(lock, { pin: "1234" }, now + 1)).reason, "WAITING");
  const rung = completeRung(lock, now + 2);
  assert.equal(rung.ok, true);
  assert.equal(rung.record.lockedUntil, 0);
  assert.ok(rung.record.pin);
  assert.equal(ladderRunsLeft(rung.record, now + 3), 2);
  let r = rung.record;
  r = completeRung(r, now + 4).record;
  r = completeRung(r, now + 5).record;
  assert.equal(completeRung(r, now + 6).ok, false);
  assert.equal(ladderRunsLeft(r, now + 3600001 + 6), 3);
});

test("sums are deterministic for a seed", () => {
  assert.deepEqual(sums(7, 3), sums(7, 3));
  for (const s of sums(9)) assert.equal(s.a + s.b, s.answer);
});
