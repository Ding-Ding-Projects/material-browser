const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSessionEvents } = require("./session-events.cjs");
test("native lifecycle transitions emit once without guest content", () => {
  const events = [], publish = createSessionEvents(e => events.push(e));
  const session = {id:"a".repeat(64),state:"provisioning",phase:"queued",directory:"private path",message:"guest output",events:[{sequence:1,phase:"queued",timestampMs:5,message:"private output"}]};
  publish("profiles.list", [session]);
  publish("superProfiles.sessions.status", [session]);
  publish("superProfiles.sessions.status", [session]);
  publish("superProfiles.sessions.status", [{...session,state:"running"}]);
  assert.equal(events.length,2);
  assert.equal(events[1].state,"running");
  assert.equal(JSON.stringify(events).includes("private"),false);
});
test("failed event delivery does not replace native success", () => {
  const publish = createSessionEvents(() => {throw Error("unavailable");});
  assert.doesNotThrow(() => publish("superProfiles.sessions.status", [{id:"a".repeat(64),state:"stopped"}]));
});
