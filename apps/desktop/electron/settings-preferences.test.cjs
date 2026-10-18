const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createPreferencesStore } = require("./settings-preferences.cjs");
const files = require("./settings-files.cjs");
const inProcessLock = async (_id, callback) => callback({ assertHeld() {} });
async function fixture(t, overrides = {}) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "material-preferences-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return {
    root,
    store: createPreferencesStore({
      appDataRoot: root,
      lock: inProcessLock,
      ...overrides,
    }),
  };
}
const request = (record, patch = {}) => ({
  expectedRevision: record.revision,
  preferences: record.preferences,
  schedules: record.schedules,
  writtenKeys: record.writtenKeys,
  ...patch,
});
const snapshot = (record) => ({
  schemaVersion: 1,
  preferences: record.preferences,
  schedules: record.schedules,
});

test("native preferences initialize once, retain field provenance, and reject stale migration", async (t) => {
  const { root, store } = await fixture(t);
  const initial = await store.read();
  assert.equal(initial.initialized, false);
  const saved = await store.write(
    request(initial.record, {
      preferences: { ...initial.record.preferences, theme: "dark" },
      writtenKeys: ["theme"],
    }),
  );
  assert.equal(saved.record.revision, 1);
  assert.deepEqual(saved.record.writtenKeys, ["theme"]);
  await assert.rejects(
    store.write(request(initial.record)),
    /SETTINGS_CONFLICT/,
  );
  const reopened = createPreferencesStore({
    appDataRoot: root,
    lock: inProcessLock,
  });
  assert.equal((await reopened.read()).record.preferences.theme, "dark");
  assert.equal((await reopened.write(request(saved.record))).changed, false);
});

test("native preferences reject corrupt records without overwriting them", async (t) => {
  const { root, store } = await fixture(t);
  await fs.writeFile(path.join(root, "presentation-settings.json"), "{broken");
  await assert.rejects(store.read());
  await assert.rejects(
    store.write({
      expectedRevision: 0,
      preferences: {},
      schedules: [],
      writtenKeys: [],
    }),
  );
  assert.equal(
    await fs.readFile(path.join(root, "presentation-settings.json"), "utf8"),
    "{broken",
  );
});

test("history apply checks the expected snapshot and supports idempotent recovery", async (t) => {
  const { store } = await fixture(t);
  const initial = (await store.read()).record;
  const a = await store.write(request(initial));
  const before = snapshot(a.record),
    after = {
      ...before,
      preferences: { ...before.preferences, theme: "dark" },
    };
  const restored = await store.apply(after, { expected: before });
  assert.equal(restored.record.preferences.theme, "dark");
  assert.deepEqual(restored.record.writtenKeys, ["theme"]);
  assert.equal((await store.apply(after, { expected: before })).changed, false);
  await assert.rejects(
    store.apply(
      { ...before, preferences: { ...before.preferences, density: "compact" } },
      { expected: before },
    ),
    /SETTINGS_CONFLICT/,
  );
});

test("a rejected durable write does not advance the revision or saved values", async (t) => {
  let reject = false;
  const { store } = await fixture(t, {
    files: {
      ...files,
      atomic: async (...args) => {
        if (reject) throw Error("WRITE_REJECTED");
        return files.atomic(...args);
      },
    },
  });
  const initial = (await store.read()).record;
  const saved = await store.write(request(initial));
  reject = true;
  await assert.rejects(
    store.write(
      request(saved.record, {
        preferences: { ...saved.record.preferences, theme: "dark" },
        writtenKeys: ["theme"],
      }),
    ),
    /WRITE_REJECTED/,
  );
  const current = await store.read();
  assert.deepEqual(current.record, saved.record);
});

test("native preference validation excludes unknown fields and private payload records", async (t) => {
  const { store } = await fixture(t),
    current = (await store.read()).record;
  await assert.rejects(
    store.write(
      request(current, {
        preferences: { ...current.preferences, vocabulary: { entries: {} } },
      }),
    ),
  );
  await assert.rejects(
    store.write(request(current, { writtenKeys: ["theme", "theme"] })),
    /INVALID_SETTINGS_PROVENANCE/,
  );
  await assert.rejects(
    store.apply(
      { ...snapshot(current), wording: {} },
      { expected: snapshot(current) },
    ),
    /INVALID_SETTINGS_SNAPSHOT/,
  );
  assert.equal((await store.read()).initialized, false);
});

test(
  "two native store instances serialize revision compare-and-swap under the actual platform mutex",
  { skip: process.platform !== "win32" },
  async (t) => {
    const { root } = await fixture(t);
    const a = createPreferencesStore({ appDataRoot: root }),
      b = createPreferencesStore({ appDataRoot: root });
    const initial = (await a.read()).record;
    const results = await Promise.allSettled([
      a.write(
        request(initial, {
          preferences: { ...initial.preferences, theme: "dark" },
          writtenKeys: ["theme"],
        }),
      ),
      b.write(
        request(initial, {
          preferences: { ...initial.preferences, density: "compact" },
          writtenKeys: ["density"],
        }),
      ),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          /SETTINGS_CONFLICT/.test(result.reason.message),
      ).length,
      1,
    );
    assert.equal((await a.read()).record.revision, 1);
  },
);
