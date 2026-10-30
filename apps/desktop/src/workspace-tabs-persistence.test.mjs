import test from "node:test";
import assert from "node:assert/strict";
import { readTabPreference, restoreWorkspaceTabs, tabFocusId } from "./workspace/workspace-tabs-model.mjs";
test("unavailable or malformed local storage retains usable tab preferences", () => {
  assert.equal(readTabPreference({ getItem() { throw new Error("blocked"); } }, "groups", true), true);
  assert.equal(readTabPreference({ getItem() { return "invalid"; } }, "groups", true), true);
  assert.equal(readTabPreference({ getItem() { return "false"; } }, "groups", true), false);
});
test("restoration deduplicates IDs and rejects forged or removed destinations", () => {
  const catalogue = [{ id: "settings:language", page: "settings", label: "Language", section: "language" }, { id: "action:lock" }];
  assert.deepEqual(restoreWorkspaceTabs(["settings:language", "settings:language", "action:lock", "forged", { id: "settings:language", page: "script" }], catalogue), [catalogue[0]]);
  assert.deepEqual(restoreWorkspaceTabs({}, catalogue), []);
});
test("filtering the active tab retains a keyboard entry into the visible tab list", () => {
  assert.equal(tabFocusId(["one", "two"], "filtered-out"), "one");
  assert.equal(tabFocusId(["one", "two"], "two"), "two");
  assert.equal(tabFocusId([], "two"), "");
});
