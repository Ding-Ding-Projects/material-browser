import test from "node:test";
import assert from "node:assert/strict";
import { loadNativePreferences } from "./settings/native-preferences.mjs";
import { readPresentationRecord } from "./settings/record.mjs";

test("native preferences take precedence without reading corrupt legacy storage", async () => {
  const saved = { revision: 8, preferences: { theme: "dark" } };
  const result = await loadNativePreferences(
    async () => ({ initialized: true, record: saved }),
    () => {
      throw Error("Must not read legacy");
    },
  );
  assert.equal(result, saved);
});

test("migration projects only validated preference values, schedules and provenance", async () => {
  const old = readPresentationRecord(null);
  old.preferences.theme = "dark";
  old.writtenKeys = ["theme"];
  old.unrelatedPayload = "not transferred";
  const calls = [];
  await loadNativePreferences(
    async (operation, params) => {
      calls.push([operation, params]);
      return operation === "preferences-read"
        ? { initialized: false, record: { revision: 0 } }
        : { record: params };
    },
    () => ({ current: JSON.stringify(old), appearance: "{broken" }),
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(calls[1][1]).sort(), [
    "expectedRevision",
    "preferences",
    "schedules",
    "writtenKeys",
  ]);
  assert.equal(calls[1][1].preferences.theme, "dark");
  assert.deepEqual(calls[1][1].writtenKeys, ["theme"]);
});

test("corrupt legacy storage is not migrated or echoed into the failure message", async () => {
  let writes = 0;
  await assert.rejects(
    loadNativePreferences(
      async (operation) => {
        if (operation === "preferences-write") writes++;
        return { initialized: false, record: { revision: 0 } };
      },
      () => ({ current: "{private-fixture", appearance: null }),
    ),
    (error) =>
      !error.message.includes("private-fixture") &&
      error.message.includes("not migrated"),
  );
  assert.equal(writes, 0);
});

test("a competing migration is read back instead of overwritten", async () => {
  let reads = 0;
  const winner = { revision: 1, preferences: { theme: "dark" } };
  const actual = await loadNativePreferences(
    async (operation) => {
      if (operation === "preferences-write") throw Error("SETTINGS_CONFLICT");
      return ++reads === 1
        ? { initialized: false, record: { revision: 0 } }
        : { initialized: true, record: winner };
    },
    () => ({ current: null, appearance: null }),
  );
  assert.equal(actual, winner);
});
