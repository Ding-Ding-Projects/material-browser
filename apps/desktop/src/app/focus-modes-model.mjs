// Pure state helpers for the focus modes. No DOM or storage access, so it runs under node --test.

export const FOCUS_MODES_KEY = "focus-modes.v1";

/** The four modes in the order the Personalize artboard lists them. */
export const MODE_IDS = /** @type {const} */ (["calm", "oneThing", "steps", "timer"]);

export const WORK_MINUTES = { min: 5, max: 90, step: 5, initial: 25 };
export const BREAK_MINUTES = { min: 1, max: 30, step: 1, initial: 5 };

/**
 * @typedef {{ calm: boolean, oneThing: boolean, steps: boolean, timer: boolean, workMinutes: number, breakMinutes: number }} FocusSettings
 */

/** @type {FocusSettings} */
export const FOCUS_DEFAULTS = Object.freeze({
  calm: false,
  oneThing: false,
  steps: false,
  timer: false,
  workMinutes: WORK_MINUTES.initial,
  breakMinutes: BREAK_MINUTES.initial,
});

/**
 * Snap a number to a bounded step range. Non-numbers fall back to the initial value.
 * @param {unknown} value
 * @param {{ min: number, max: number, step: number, initial: number }} bounds
 */
export function boundMinutes(value, bounds) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return bounds.initial;
  const snapped = Math.round((n - bounds.min) / bounds.step) * bounds.step + bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, snapped));
}

/**
 * One stepper press.
 * @param {number} value
 * @param {1 | -1} direction
 * @param {{ min: number, max: number, step: number, initial: number }} bounds
 */
export function stepMinutes(value, direction, bounds) {
  return boundMinutes(boundMinutes(value, bounds) + direction * bounds.step, bounds);
}

/**
 * Accept anything (old versions, hand edits, corrupt storage) and return complete settings.
 * @param {unknown} raw
 * @returns {FocusSettings}
 */
export function normaliseFocusSettings(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    calm: source.calm === true,
    oneThing: source.oneThing === true,
    steps: source.steps === true,
    timer: source.timer === true,
    workMinutes: boundMinutes(source.workMinutes, WORK_MINUTES),
    breakMinutes: boundMinutes(source.breakMinutes, BREAK_MINUTES),
  };
}

/** @param {string | null | undefined} text */
export function parseFocusSettings(text) {
  if (!text) return { ...FOCUS_DEFAULTS };
  try {
    return normaliseFocusSettings(JSON.parse(text));
  } catch {
    return { ...FOCUS_DEFAULTS };
  }
}

/** @param {FocusSettings} settings */
export function serialiseFocusSettings(settings) {
  return JSON.stringify(normaliseFocusSettings(settings));
}

/**
 * Attribute values written to document.documentElement. Off modes are omitted so the
 * attribute is removed.
 * @param {FocusSettings} settings
 * @returns {Record<string, string | null>}
 */
export function rootAttributes(settings) {
  return {
    "data-focus-calm": settings.calm ? "true" : null,
    "data-focus-one-thing": settings.oneThing ? "true" : null,
    "data-focus-steps": settings.steps ? "true" : null,
    "data-focus-timer": settings.timer ? "true" : null,
  };
}

/**
 * @typedef {{ phase: "work" | "break", running: boolean, remainingMs: number, endsAt: number | null }} TimerState
 */

/** @param {FocusSettings} settings @param {"work" | "break"} phase */
export const phaseLength = (settings, phase) => (phase === "work" ? settings.workMinutes : settings.breakMinutes) * 60000;

/** @param {FocusSettings} settings @returns {TimerState} */
export function resetTimer(settings) {
  return { phase: "work", running: false, remainingMs: phaseLength(settings, "work"), endsAt: null };
}

/** @param {TimerState} timer @param {number} now @returns {TimerState} */
export function startTimer(timer, now) {
  if (timer.running) return timer;
  return { ...timer, running: true, endsAt: now + timer.remainingMs };
}

/** @param {TimerState} timer @param {number} now @returns {TimerState} */
export function pauseTimer(timer, now) {
  if (!timer.running || timer.endsAt === null) return timer;
  return { ...timer, running: false, remainingMs: Math.max(0, timer.endsAt - now), endsAt: null };
}

/** @param {TimerState} timer @param {number} now */
export function timerRemaining(timer, now) {
  return timer.running && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
}

/**
 * Move to the next phase when the current one has ended. The timer keeps running.
 * @param {TimerState} timer
 * @param {FocusSettings} settings
 * @param {number} now
 * @returns {{ timer: TimerState, switched: boolean }}
 */
export function advanceTimer(timer, settings, now) {
  if (!timer.running || timer.endsAt === null || now < timer.endsAt) return { timer, switched: false };
  /** @type {"work" | "break"} */
  const phase = timer.phase === "work" ? "break" : "work";
  const length = phaseLength(settings, phase);
  return { timer: { phase, running: true, remainingMs: length, endsAt: now + length }, switched: true };
}

/** "mm:ss", rounding up so the clock never shows 00:00 while time remains. @param {number} ms */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
