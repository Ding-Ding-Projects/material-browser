import test from "node:test";
import assert from "node:assert/strict";
import {
  FOCUS_DEFAULTS,
  FOCUS_MODES_KEY,
  WORK_MINUTES,
  BREAK_MINUTES,
  boundMinutes,
  stepMinutes,
  normaliseFocusSettings,
  parseFocusSettings,
  serialiseFocusSettings,
  rootAttributes,
  resetTimer,
  startTimer,
  pauseTimer,
  timerRemaining,
  advanceTimer,
  formatClock,
} from "./focus-modes-model.mjs";

test("storage key is versioned", () => {
  assert.equal(FOCUS_MODES_KEY, "focus-modes.v1");
});

test("missing or corrupt storage falls back to every mode off", () => {
  assert.deepEqual(parseFocusSettings(null), FOCUS_DEFAULTS);
  assert.deepEqual(parseFocusSettings(""), FOCUS_DEFAULTS);
  assert.deepEqual(parseFocusSettings("{not json"), FOCUS_DEFAULTS);
  assert.deepEqual(parseFocusSettings("[1,2]"), FOCUS_DEFAULTS);
  assert.deepEqual(parseFocusSettings("null"), FOCUS_DEFAULTS);
});

test("normalisation keeps only real booleans and bounded minutes", () => {
  const value = normaliseFocusSettings({ calm: "yes", oneThing: true, steps: 1, timer: true, workMinutes: 500, breakMinutes: -3, extra: "dropped" });
  assert.deepEqual(value, { calm: false, oneThing: true, steps: false, timer: true, workMinutes: WORK_MINUTES.max, breakMinutes: BREAK_MINUTES.min });
  assert.equal(boundMinutes(23, WORK_MINUTES), 25);
  assert.equal(boundMinutes("12", WORK_MINUTES), 10);
  assert.equal(boundMinutes("abc", BREAK_MINUTES), BREAK_MINUTES.initial);
  assert.equal(boundMinutes(Infinity, BREAK_MINUTES), BREAK_MINUTES.initial);
});

test("settings survive a save and load round trip", () => {
  const settings = { calm: true, oneThing: false, steps: true, timer: true, workMinutes: 45, breakMinutes: 10 };
  assert.deepEqual(parseFocusSettings(serialiseFocusSettings(settings)), settings);
});

test("steppers move by one step and stop at the bounds", () => {
  assert.equal(stepMinutes(25, 1, WORK_MINUTES), 30);
  assert.equal(stepMinutes(5, -1, WORK_MINUTES), 5);
  assert.equal(stepMinutes(90, 1, WORK_MINUTES), 90);
  assert.equal(stepMinutes(1, -1, BREAK_MINUTES), 1);
  assert.equal(stepMinutes(30, 1, BREAK_MINUTES), 30);
});

test("root attributes are removed for modes that are off", () => {
  assert.deepEqual(rootAttributes({ ...FOCUS_DEFAULTS, calm: true, steps: true }), {
    "data-focus-calm": "true",
    "data-focus-one-thing": null,
    "data-focus-steps": "true",
    "data-focus-timer": null,
  });
});

test("timer counts down, pauses, resumes, switches phase and resets", () => {
  const settings = { ...FOCUS_DEFAULTS, workMinutes: 25, breakMinutes: 5 };
  let timer = resetTimer(settings);
  assert.equal(timer.running, false);
  assert.equal(timerRemaining(timer, 0), 25 * 60000);
  timer = startTimer(timer, 1000);
  assert.equal(timerRemaining(timer, 61000), 24 * 60000);
  timer = pauseTimer(timer, 61000);
  assert.equal(timer.running, false);
  assert.equal(timerRemaining(timer, 999999), 24 * 60000);
  timer = startTimer(timer, 100000);
  assert.equal(advanceTimer(timer, settings, 100000 + 1000).switched, false);
  const next = advanceTimer(timer, settings, 100000 + 24 * 60000);
  assert.equal(next.switched, true);
  assert.equal(next.timer.phase, "break");
  assert.equal(timerRemaining(next.timer, 100000 + 24 * 60000), 5 * 60000);
  assert.deepEqual(resetTimer(settings), { phase: "work", running: false, remainingMs: 25 * 60000, endsAt: null });
});

test("clock format rounds up and never goes negative", () => {
  assert.equal(formatClock(25 * 60000), "25:00");
  assert.equal(formatClock(59001), "01:00");
  assert.equal(formatClock(1), "00:01");
  assert.equal(formatClock(-5), "00:00");
});
