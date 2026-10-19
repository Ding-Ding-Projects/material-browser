const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createSettingsHistory } = require("./settings-history.cjs");
const {
  createPreferencesOperations,
} = require("./settings-preferences-ipc.cjs");
async function fixture(overrides = {}) {
  const { defaults } = await import("../shared/settings-model.mjs");
  const state = {
    schemaVersion: 1,
    revision: 7,
    preferences: { ...defaults },
    schedules: [],
    writtenKeys: [],
  };
  const calls = [],
    applied = [],
    names = {
      schemaVersion: 1,
      revision: 3,
      record: {
        schemaVersion: 1,
        kind: "display-name",
        recordId: "application-display-name-v1",
        displayName: null,
      },
    };
  const service = {
    status: async () => ({ ok: true, configured: true, unlocked: true }),
    diff: async () => ({ ok: true, changedKeys: ["theme"] }),
    restore: async (revision, context, apply) => {
      calls.push({ operation: "restore", revision, context });
      await apply(
        { ...context.expected, preferences: { ...defaults, theme: "dark" } },
        context,
      );
      return { ok: true, restored: true };
    },
    transactDisplayName: async (request, apply) => {
      calls.push({ operation: "name", request });
      await apply(
        { ...names.record, displayName: request.after },
        {
          expected: names.record,
          expectedNativeRevision: request.expectedNativeRevision,
        },
      );
      return { ok: true, applied: true };
    },
    recordSettings: async (request) => {
      calls.push({ operation: "record", request });
      return { ok: true, recorded: true };
    },
    setup: async () => ({ ok: true, configured: true, unlocked: true }),
  };
  let verified = 0,
    created = 0;
  const preferences = {
    read: async () => ({ initialized: true, record: state }),
    apply: async (snapshot, context) => {
      applied.push({ snapshot, context });
    },
  };
  const controller = createSettingsHistory({
    app: { isPackaged: true, getPath: () => path.resolve("synthetic-profile") },
    resourcesPath: path.resolve("synthetic-resources"),
    explicitDataDirectory: true,
    getPreferencesStore: () => preferences,
    runtimeVerifier: async () => {
      verified++;
      return {
        gitExecutable: path.resolve("synthetic-runtime/git.exe"),
        gitSha256: "0".repeat(64),
      };
    },
    credentialFactory: () => ({}),
    serviceFactory: () => {
      created++;
      return service;
    },
    displayNameFactory: () => ({
      read: async () => names,
      apply: async (snapshot, context) => {
        applied.push({ snapshot, context });
      },
    }),
    ...overrides,
  });
  return {
    controller,
    state,
    names,
    calls,
    applied,
    preferences,
    service,
    counts: () => ({ verified, created }),
  };
}
test("protected restore derives expectations from main-owned state and excludes renderer context", async () => {
  const f = await fixture();
  const result = await f.controller.handle("history-restore", {
    revision: "selected-revision",
  });
  assert.equal(result.ok, true);
  assert.equal(f.calls[0].context.expectedNativeRevision, 7);
  assert.deepEqual(f.calls[0].context.expected, {
    schemaVersion: 1,
    preferences: f.state.preferences,
    schedules: [],
  });
  assert.equal(f.applied[0].context, f.calls[0].context);
  const rejected = await f.controller.handle("history-restore", {
    revision: "selected-revision",
    expectedNativeRevision: 1,
  });
  assert.equal(rejected.error.code, "INVALID_REQUEST");
  assert.equal(f.calls.length, 1);
});
test("display-name transaction uses trusted revision and refuses stale visible names", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.controller.handle("display-name-write", {
        expectedName: "stale",
        displayName: "New",
        action: "updated",
      })
    ).error.code,
    "HISTORY_STATE_CONFLICT",
  );
  assert.equal(f.calls.length, 0);
  assert.equal(
    (
      await f.controller.handle("display-name-write", {
        expectedName: null,
        displayName: "New",
        action: "created",
      })
    ).ok,
    true,
  );
  assert.equal(f.calls[0].request.expectedNativeRevision, 3);
  assert.equal(f.applied[0].context.expectedNativeRevision, 3);
});
test("every protected operation verifies the full runtime while sharing only the authenticated service", async () => {
  const f = await fixture();
  await f.controller.handle("history-status", {});
  await f.controller.handle("history-status", {});
  assert.deepEqual(f.counts(), { verified: 2, created: 1 });
  const unavailable = await fixture({
    runtimeVerifier: async () => {
      throw Error("private filesystem detail");
    },
  });
  const result = await unavailable.controller.handle("history-status", {});
  assert.equal(result.error.code, "HISTORY_RUNTIME_UNAVAILABLE");
  assert.equal(
    JSON.stringify(result).includes("private filesystem detail"),
    false,
  );
  assert.equal(unavailable.counts().created, 0);
});
test("protected request validation rejects commands, paths and oversized credentials before service access", async () => {
  const f = await fixture();
  for (const [operation, params] of [
    ["execute", {}],
    ["history-status", { path: "outside" }],
    ["history-unlock", { secret: "x".repeat(257) }],
    ["display-name-write", { displayName: "New", trustedApply: true }],
  ])
    assert.equal(
      (await f.controller.handle(operation, params)).error.code,
      "INVALID_REQUEST",
    );
  assert.equal(f.counts().verified, 0);
});
test("baseline recording failure does not misreport successful independent history setup", async () => {
  const f = await fixture({
    getPreferencesStore: () => ({
      read: async () => {
        throw Error("Unreadable preferences");
      },
    }),
  });
  const result = await f.controller.handle("history-setup", {
    secret: "synthetic",
  });
  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.baselineRecorded, false);
  assert.equal(result.warning, "HISTORY_BASELINE_UNAVAILABLE");
});
test("ordinary save releases its preference transaction before history and preserves durable success on history rejection", async () => {
  const order = [],
    record = { revision: 1 };
  const call = createPreferencesOperations({
    app: {},
    getWindow: () => null,
    getPreferencesStore: () => ({
      write: async () => {
        order.push("preferences-released");
        return { initialized: true, changed: true, record };
      },
    }),
    onSaved: async () => {
      assert.deepEqual(order, ["preferences-released"]);
      order.push("history");
      throw Error("History unavailable");
    },
  });
  const result = await call("preferences-write", {});
  assert.equal(result.ok, true);
  assert.equal(result.record, record);
  assert.equal(result.history.warning, "HISTORY_WRITE_FAILED");
  assert.deepEqual(order, ["preferences-released", "history"]);
});
