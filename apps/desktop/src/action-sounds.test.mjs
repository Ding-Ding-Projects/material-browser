import test from "node:test";
import assert from "node:assert/strict";
import { createActionSounds } from "./settings/action-sounds.mjs";
import { defaults, validatePreferences, exportPreferences, parseImport } from "../shared/settings-model.mjs";

function harness() {
  let preferences = { ...defaults };
  const nodes = [];
  let creations = 0;
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const context = {
    state: "suspended", currentTime: 0, destination: {},
    async resume() { this.state = "running"; },
    async close() { this.state = "closed"; },
    createOscillator() {
      const node = { frequency: param, starts: 0, stops: 0, connect() {}, disconnect() {},
        start() { this.starts++; }, stop() { this.stops++; } };
      nodes.push(node); return node;
    },
    createGain() { return { gain: param, connect() {}, disconnect() {} }; },
  };
  const sound = createActionSounds({ getPreferences: () => preferences,
    createContext: () => { creations++; return context; },
    now: () => new Date(2026, 9, 24, 23),
  });
  return { sound, context, nodes, set: (values) => { preferences = { ...defaults, ...values }; },
    creations: () => creations };
}

test("loading and preference synchronization remain silent; gestures unlock and completion plays a bounded cue", async () => {
  const h = harness();
  h.sound.sync();
  assert.equal(h.creations(), 0);
  assert.equal(h.sound.play("success"), false);
  await h.sound.unlock();
  assert.equal(h.nodes.length, 0);
  assert.equal(h.sound.play("success"), true);
  assert.ok(h.nodes.length > 0 && h.nodes.every((n) => n.starts === 1));
  assert.equal(h.sound.play("error"), false);
  h.context.currentTime = 1;
  assert.equal(h.sound.play("error"), true);
});

test("current quiet and accessibility preferences gate every cue and preview", async () => {
  for (const values of [
    { actionSounds: false }, { actionSoundVolume: 0 }, { lowStimulation: true },
    { screenReaderMode: true }, { narration: true }, { quietEnabled: true },
  ]) {
    const h = harness(); await h.sound.unlock(); h.set(values);
    assert.equal(h.sound.play("error"), false);
    assert.equal(await h.sound.preview(), false);
    assert.equal(h.nodes.length, 0);
  }
});

test("muting cancels sounding and scheduled notes; it never replays them when enabled", async () => {
  const h = harness(); await h.sound.unlock(); h.sound.play();
  h.set({ actionSounds: false }); h.sound.sync();
  assert.ok(h.nodes.every((n) => n.stops === 2));
  const count = h.nodes.length;
  h.set({}); h.sound.sync();
  assert.equal(h.nodes.length, count);
});

test("muting during an audio resume prevents a delayed preview", async () => {
  const h = harness(); let resume;
  h.context.resume = () => new Promise((resolve) => { resume = () => { h.context.state = "running"; resolve(); }; });
  const pending = h.sound.preview();
  h.set({ actionSounds: false }); h.sound.sync(); resume();
  assert.equal(await pending, false);
  assert.equal(h.nodes.length, 0);
});

test("unavailable audio fails silently and never changes preferences", async () => {
  const preferences = { ...defaults };
  const sound = createActionSounds({ getPreferences: () => preferences, createContext: () => { throw Error("Unavailable"); } });
  assert.equal(await sound.preview(), false);
  assert.deepEqual(preferences, defaults);
});

test("sound preferences validate and survive settings export/import with defaults for older records", () => {
  const preferences = validatePreferences({ actionSounds: false, actionSoundVolume: 65 });
  const restored = parseImport(JSON.stringify(exportPreferences(preferences)));
  assert.equal(restored.preferences.actionSounds, false);
  assert.equal(restored.preferences.actionSoundVolume, 65);
  assert.equal(validatePreferences({}).actionSounds, true);
  for (const value of [-5, 101, 33, "35", NaN]) {
    assert.throws(() => validatePreferences({ actionSoundVolume: value }));
  }
  assert.throws(() => validatePreferences({ actionSounds: "false" }));
});

test("a pending mute save suppresses already pending operation feedback until saved preferences are available", async () => {
  const h = harness(); await h.sound.unlock();
  const release = h.sound.hold();
  assert.equal(h.sound.play("success"), false);
  assert.equal(await h.sound.preview(), false);
  h.set({ actionSounds: false }); release();
  assert.equal(h.sound.play("success"), false);
  assert.equal(h.nodes.length, 0);
});
