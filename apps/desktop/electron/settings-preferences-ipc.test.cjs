const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPreferencesOperations,
} = require("./settings-preferences-ipc.cjs");

test("preference IPC returns explicit conflicts and suppresses filesystem detail", async () => {
  let reason = "SETTINGS_CONFLICT";
  const call = createPreferencesOperations({
    app: { getPath: () => "/owned" },
    getWindow: () => null,
    storeFactory: () => ({
      write: async () => {
        throw Error(reason);
      },
    }),
  });
  assert.equal(
    (await call("preferences-write", {})).error.code,
    "SETTINGS_CONFLICT",
  );
  reason = "private filesystem detail";
  const response = await call("preferences-write", {});
  assert.equal(response.error.code, "SETTINGS_STORAGE_UNAVAILABLE");
  assert.equal(JSON.stringify(response).includes(reason), false);
  assert.equal(
    (await call("preferences-read", { path: "/outside" })).error.code,
    "INVALID_SETTINGS_REQUEST",
  );
});

test("failed event delivery cannot turn a durable preference save into a failed result", async () => {
  const saved = {
    revision: 2,
    preferences: {},
    schedules: [],
    writtenKeys: [],
  };
  const call = createPreferencesOperations({
    app: { getPath: () => "/owned" },
    getWindow: () => ({
      isDestroyed: () => false,
      webContents: {
        isDestroyed: () => false,
        send: () => {
          throw Error("Closed during delivery");
        },
      },
    }),
    storeFactory: () => ({
      write: async () => ({
        initialized: true,
        changed: true,
        record: saved,
        before: { private: true },
      }),
    }),
  });
  const result = await call("preferences-write", {});
  assert.equal(result.ok, true);
  assert.equal(result.record, saved);
  assert.equal(Object.hasOwn(result, "before"), false);
});
