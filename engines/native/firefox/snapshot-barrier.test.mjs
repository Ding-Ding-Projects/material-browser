import assert from "node:assert/strict";
import test from "node:test";
import { MaterialSnapshotBarrier, REQUIRED_BARRIERS } from "./MaterialSnapshotBarrier.sys.mjs";

const binding = { profileId: "owned-profile", engineSha256: "a".repeat(64) };
const begin = { command: "begin", protocol: 1, requestId: "request-1", profileId: binding.profileId };
function providers(events, overrides = {}) {
  return Object.fromEntries(REQUIRED_BARRIERS.map(name => [name, overrides[name] ?? {
    async acquire() {
      events.push(`acquire:${name}`);
      return async () => events.push(`release:${name}`);
    },
  }]));
}

test("production default reports every incomplete store without a success receipt", async () => {
  const controller = new MaterialSnapshotBarrier(binding);
  const result = await controller.dispatch(begin);
  assert.equal(controller.status.available, false);
  assert.deepEqual(result.missingStores, REQUIRED_BARRIERS);
  assert.equal(result.status, "unavailable");
  assert.equal(result.storageWritersFrozen, undefined);
});

test("one absent store prevents every acquisition", async () => {
  const events = [];
  const partial = providers(events);
  delete partial.cookies;
  const controller = new MaterialSnapshotBarrier(binding, partial);
  assert.deepEqual((await controller.dispatch(begin)).missingStores, ["cookies"]);
  assert.deepEqual(events, []);
});

test("strict command shape, profile binding and generation are enforced", async () => {
  const controller = new MaterialSnapshotBarrier(binding, providers([]));
  for (const request of [{ ...begin, execute: "code" }, { ...begin, protocol: 2 },
    { ...begin, profileId: "other" }, { ...begin, requestId: "../path" },
    { command: "commit", protocol: 1, requestId: "request-1", generation: 1.5 }]) {
    await assert.rejects(controller.dispatch(request));
  }
});

test("all barriers remain held until the matching commit and release in reverse order", async () => {
  const events = [];
  const controller = new MaterialSnapshotBarrier(binding, providers(events));
  const receipt = await controller.dispatch(begin);
  assert.equal(receipt.engineSha256, binding.engineSha256);
  assert.equal(receipt.generation, 1);
  assert.equal(receipt.storageWritersFrozen, true);
  assert.deepEqual(events, REQUIRED_BARRIERS.map(name => `acquire:${name}`));
  await assert.rejects(controller.dispatch({ command: "commit", protocol: 1,
    requestId: "request-1", generation: 2 }));
  assert.equal(controller.status.active, true);
  const result = await controller.dispatch({ command: "commit", protocol: 1,
    requestId: "request-1", generation: 1 });
  assert.equal(result.status, "released");
  assert.deepEqual(events.slice(REQUIRED_BARRIERS.length),
    [...REQUIRED_BARRIERS].reverse().map(name => `release:${name}`));
  await assert.rejects(controller.dispatch({ command: "commit", protocol: 1,
    requestId: "request-1", generation: 1 }));
});

test("acquisition failure unwinds only acquired providers and returns no receipt", async () => {
  const events = [];
  const controller = new MaterialSnapshotBarrier(binding, providers(events, {
    cookies: { async acquire() { throw new Error("cookie write failed"); } },
  }));
  await assert.rejects(controller.dispatch(begin), /cookie write failed/);
  assert.deepEqual(events, ["acquire:network", "acquire:renderers", "acquire:serviceWorkers",
    "release:serviceWorkers", "release:renderers", "release:network"]);
  assert.equal(controller.status.active, false);
});

test("abort releases all providers and generations advance without reuse", async () => {
  const controller = new MaterialSnapshotBarrier(binding, providers([]));
  await controller.dispatch(begin);
  assert.equal((await controller.dispatch({ command: "abort", protocol: 1,
    requestId: "request-1" })).status, "aborted");
  assert.equal((await controller.dispatch(begin)).generation, 2);
  await controller.dispatch({ command: "abort", protocol: 1, requestId: "request-1" });
});

test("release failure still releases remaining providers and poisons the controller", async () => {
  const events = [];
  const controller = new MaterialSnapshotBarrier(binding, providers(events, {
    cookies: { async acquire() { return async () => { throw new Error("release failed"); }; } },
  }));
  await controller.dispatch(begin);
  await assert.rejects(controller.dispatch({ command: "abort", protocol: 1,
    requestId: "request-1" }), /engine recovery required/);
  assert.ok(events.includes("release:network"));
  assert.equal(controller.status.poisoned, true);
  await assert.rejects(controller.dispatch(begin), /unavailable/);
});

test("concurrent commands cannot enter during acquisition", async () => {
  let resume;
  const pending = new Promise(resolve => { resume = resolve; });
  const controller = new MaterialSnapshotBarrier(binding, providers([], {
    network: { async acquire() { await pending; return async () => {}; } },
  }));
  const first = controller.dispatch(begin);
  await assert.rejects(controller.dispatch(begin), /unavailable/);
  resume();
  await first;
  await controller.dispatch({ command: "abort", protocol: 1, requestId: "request-1" });
});

test("malformed provider poisons future transactions and unwinds earlier providers", async () => {
  const events = [];
  const controller = new MaterialSnapshotBarrier(binding, providers(events, {
    cookies: { async acquire() { return undefined; } },
  }));
  await assert.rejects(controller.dispatch(begin), /release function/);
  assert.equal(controller.status.poisoned, true);
  assert.ok(events.includes("release:network"));
});
