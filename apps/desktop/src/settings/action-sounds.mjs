import { timeWindowMatches } from "./model.mjs";

export function actionSoundsAllowed(preferences, now = new Date()) {
  return Boolean(
    preferences.actionSounds && preferences.actionSoundVolume > 0 &&
    !preferences.lowStimulation && !preferences.screenReaderMode &&
    !preferences.narration &&
    !(preferences.quietEnabled && timeWindowMatches(
      preferences.quietStart, preferences.quietEnd,
      now.getHours() * 60 + now.getMinutes(),
    )),
  );
}

// Original, locally synthesized cues. No recordings, requests or audio files.
const cues = {
  success: [[523.25, 0, 0.16], [783.99, 0.075, 0.24], [1046.5, 0.13, 0.28]],
  error: [[329.63, 0, 0.20], [293.66, 0.09, 0.28]],
};

export function createActionSounds({
  getPreferences = () => ({}),
  createContext = () => new globalThis.AudioContext(),
  now = () => new Date(),
} = {}) {
  let context = null;
  let active = [];
  let busyUntil = 0;
  let generation = 0;
  let holds = 0;
  const allowed = () => holds === 0 && actionSoundsAllowed(getPreferences(), now());
  function stop() {
    generation++;
    for (const { oscillator, gain } of active) {
      try { gain.disconnect(); oscillator.stop(); oscillator.disconnect(); } catch {}
    }
    active = [];
    busyUntil = 0;
  }
  async function unlock() {
    if (!allowed()) return false;
    try {
      context ??= createContext();
      if (context.state === "suspended") await context.resume();
      return context.state === "running";
    } catch { return false; }
  }
  function play(kind = "success") {
    if (!allowed()) { stop(); return false; }
    if (!Object.hasOwn(cues, kind) || !context || context.state !== "running") return false;
    if (context.currentTime < busyUntil) return false;
    try {
      const start = context.currentTime + 0.008;
      const volume = Math.min(100, Math.max(0, getPreferences().actionSoundVolume)) / 100;
      if (!Number.isFinite(volume)) return false;
      for (const [frequency, delay, duration] of cues[kind]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const node = { oscillator, gain };
        active.push(node);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start + delay);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.998, start + delay + duration);
        gain.gain.setValueAtTime(0, start + delay);
        gain.gain.linearRampToValueAtTime(volume * 0.12, start + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect(); gain.disconnect();
          active = active.filter((item) => item !== node);
        };
        oscillator.start(start + delay);
        oscillator.stop(start + delay + duration + 0.01);
      }
      busyUntil = start + 0.5;
      return true;
    } catch { stop(); return false; }
  }
  return {
    unlock, play, stop,
    hold: () => {
      holds++;
      stop();
      let released = false;
      return () => { if (!released) { released = true; holds--; } };
    },
    sync: () => { if (!allowed()) stop(); },
    preview: async () => {
      const requested = generation;
      if (!await unlock() || requested !== generation) return false;
      return play("success");
    },
    dispose: () => {
      stop();
      const old = context;
      context = null;
      try { void old?.close().catch(() => {}); } catch {}
    },
  };
}
