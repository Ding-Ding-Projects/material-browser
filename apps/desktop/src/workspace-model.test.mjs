import test from "node:test";
import assert from "node:assert/strict";
import {
  visibleProfiles,
  validSelection,
  selectedTargets,
  observedRuntime,
  createOperationRegistry,
  runTargets,
  catalogDestinations,
} from "./workspace/model.mjs";
const rows = [
  { id: "b", name: "Beta", engine: "firefox", automation: "off" },
  { id: "a", name: "Alpha", engine: "chromium", automation: "selenium" },
  { id: "c", name: "Alpha", engine: "firefox", automation: "off" },
];
test("sort and engine filter preserve source and stable identity after search", () => {
  assert.deepEqual(
    visibleProfiles(rows, ["c", "b"], "firefox", {
      key: "name",
      direction: "asc",
    }).map((p) => p.id),
    ["c", "b"],
  );
  assert.deepEqual(
    visibleProfiles(rows, ["a", "b", "c"], "all", {
      key: "name",
      direction: "desc",
    }).map((p) => p.id),
    ["b", "a", "c"],
  );
  assert.equal(rows[0].id, "b");
});
test("selection removes missing IDs and bulk targets use live identities rather than row positions", () => {
  assert.equal(validSelection(rows, "gone"), "");
  assert.equal(validSelection(rows, "a"), "a");
  assert.deepEqual(
    selectedTargets(rows, ["gone", "a", "a"]).map((p) => p.id),
    ["a"],
  );
});
test("absent runtime observations never imply stopped", () => {
  assert.equal(observedRuntime(null), "Unavailable");
  assert.equal(observedRuntime({ effectiveMode: "off" }), "Unavailable");
  assert.equal(observedRuntime({ running: false }), "Stopped");
  assert.equal(observedRuntime({ state: "starting" }), "starting");
});
test("same operation is synchronously deduplicated and lock releases on rejection", async () => {
  const registry = createOperationRegistry();
  let release;
  let calls = 0;
  const first = registry.run("stop:a", () => {
    calls++;
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  assert.equal(
    (
      await registry.run("stop:a", () => {
        calls++;
      })
    ).accepted,
    false,
  );
  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(registry.has("stop:a"), false);
  await assert.rejects(
    registry.run("stop:a", () => Promise.reject(Error("denied"))),
  );
  assert.equal(registry.has("stop:a"), false);
});
test("bulk dispatch reports each target and continues after a failed target", async () => {
  const visited = [];
  const results = await runTargets(
    rows,
    async (p) => {
      visited.push(p.id);
      if (p.id === "a") throw Error("busy");
    },
    (e) => e.message,
  );
  assert.deepEqual(visited, ["b", "a", "c"]);
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, false, true],
  );
  assert.equal(results[1].message, "busy");
});
test("catalog identities survive inserted settings and include environment workspace", () => {
  const defs = [{ key: "theme", label: "Theme", category: "appearance" }];
  const first = catalogDestinations(defs);
  const second = catalogDestinations([
    { key: "language", label: "Language", category: "language" },
    ...defs,
  ]);
  assert.deepEqual(
    first.find((x) => x.id === "setting:theme"),
    second.find((x) => x.id === "setting:theme"),
  );
  assert.equal(
    first.find((x) => x.id === "page:super-profiles").page,
    "super-profiles",
  );
});
test("all bulk targets reserve synchronously and vault actions exclude active profile actions", async () => {
  const registry = createOperationRegistry();
  let release;
  const first = registry.runMany(
    ["a", "b"],
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  assert.equal((await registry.run("b", () => {})).accepted, false);
  assert.equal((await registry.run("*", () => {})).accepted, false);
  assert.equal((await registry.run("c", () => {})).accepted, true);
  release();
  await first;
  assert.equal((await registry.run("*", () => {})).accepted, true);
});
test("native Unix-second dates and supported ISO dates share the correct instant", async () => {
  const { timestampDate, inspectorWidth } = await import(
    "./workspace/model.mjs"
  );
  assert.equal(
    timestampDate(1792665600).toISOString(),
    "2026-10-22T10:40:00.000Z",
  );
  assert.equal(
    timestampDate("2026-10-22T10:40:00Z").toISOString(),
    "2026-10-22T10:40:00.000Z",
  );
  assert.equal(timestampDate("invalid"), null);
  assert.equal(timestampDate(undefined), null);
  assert.equal(inspectorWidth("900"), 360);
  assert.equal(inspectorWidth("250"), 320);
  assert.equal(inspectorWidth("invalid"), 340);
  assert.equal(
    observedRuntime({ pid: 123, profileId: "a", effectiveMode: "off" }),
    "Running",
  );
});
test("duplicate supplies the native required name and other mutations retain exact parameters", async () => {
  const { profileOperationParams } = await import("./workspace/model.mjs");
  assert.deepEqual(
    profileOperationParams("profiles.duplicate", rows[0], {}, "Copy"),
    { id: "b", name: "Beta (Copy)" },
  );
  assert.deepEqual(
    profileOperationParams("revisions.restore", rows[0], { revisionId: "r1" }),
    { id: "b", revisionId: "r1" },
  );
  assert.deepEqual(profileOperationParams("profiles.stop", rows[0]), {
    id: "b",
  });
});
