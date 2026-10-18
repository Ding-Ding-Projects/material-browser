const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createDisplayNameStore } = require("./settings-display-name.cjs");
const lock = async (_id, callback) => callback({ assertHeld() {} });
test("display-name storage requires typed expected state and numeric revision, with idempotent recovery", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "material-display-name-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createDisplayNameStore({ appDataRoot: root, lock }),
    initial = await store.read();
  const desired = { ...initial.record, displayName: "Research workspace" };
  await assert.rejects(
    store.apply(desired, { expected: initial.record }),
    /INVALID_SETTINGS_REVISION/,
  );
  const context = {
    expected: initial.record,
    expectedNativeRevision: initial.revision,
  };
  assert.equal((await store.apply(desired, context)).changed, true);
  assert.equal((await store.apply(desired, context)).changed, false);
  const saved = await store.read();
  assert.equal(saved.revision, 1);
  assert.equal(saved.record.displayName, "Research workspace");
  await assert.rejects(
    store.apply({ ...desired, displayName: "Other" }, context),
    /DISPLAY_NAME_CONFLICT/,
  );
  await assert.rejects(
    store.apply({ ...desired, password: "excluded" }, context),
    /INVALID_DISPLAY_NAME_RECORD/,
  );
  assert.equal((await store.read()).record.displayName, "Research workspace");
});
