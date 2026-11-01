import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IconBtn, Ms } from "../m3";
import { AppContext } from "./context";
import {
  BREAK_MINUTES,
  FOCUS_DEFAULTS,
  FOCUS_MODES_KEY,
  WORK_MINUTES,
  advanceTimer,
  boundMinutes,
  formatClock,
  normaliseFocusSettings,
  parseFocusSettings,
  pauseTimer,
  resetTimer,
  rootAttributes,
  serialiseFocusSettings,
  startTimer,
  stepMinutes,
  timerRemaining,
  type FocusSettings,
  type TimerState,
} from "./focus-modes-model.mjs";
import "./focus-modes.css";

export type FocusModeId = "calm" | "oneThing" | "steps" | "timer";
export { WORK_MINUTES, BREAK_MINUTES };

type FocusModesValue = {
  settings: FocusSettings;
  persisted: boolean;
  canRetryPersistence: boolean;
  retryPersistence: () => void;
  setMode: (id: FocusModeId, on: boolean) => void;
  stepWork: (direction: 1 | -1) => void;
  stepBreak: (direction: 1 | -1) => void;
  setWorkMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  timer: TimerState;
  remainingMs: number;
  toggleTimer: () => void;
  resetTimer: () => void;
};

const FocusModesContext = createContext<FocusModesValue | null>(null);

function load(): { settings: FocusSettings; persisted: boolean } {
  try {
    return { settings: parseFocusSettings(localStorage.getItem(FOCUS_MODES_KEY)), persisted: true };
  } catch {
    return { settings: { ...FOCUS_DEFAULTS }, persisted: false };
  }
}
function save(settings: FocusSettings) {
  try {
    localStorage.setItem(FOCUS_MODES_KEY, serialiseFocusSettings(settings));
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies the focus modes to the whole app through attributes on document.documentElement
 * and keeps them in localStorage ("focus-modes.v1"). Mount once, near the root.
 */
export function FocusModesProvider({ children }: { children?: React.ReactNode }) {
  const [initial] = useState(load);
  const [settings, setSettings] = useState<FocusSettings>(initial.settings);
  const [persisted, setPersisted] = useState(initial.persisted);
  const settingsRef = useRef(settings);
  const initialReadAvailable = useRef(initial.persisted);
  const [timer, setTimer] = useState<TimerState>(() => resetTimer(settings));
  const [now, setNow] = useState(() => Date.now());

  const update = useCallback((change: (s: FocusSettings) => FocusSettings) => {
    const next = normaliseFocusSettings(change(settingsRef.current));
    settingsRef.current = next;
    setSettings(next);
    setPersisted(initialReadAvailable.current ? save(next) : false);
  }, []);

  // Root attributes for the CSS in focus-modes.css.
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(rootAttributes(settings))) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  }, [settings]);
  useEffect(
    () => () => {
      for (const name of Object.keys(rootAttributes(FOCUS_DEFAULTS))) document.documentElement.removeAttribute(name);
    },
    [],
  );

  // One thing at a time: remember the pane that last held focus so the others can dim.
  useEffect(() => {
    if (!settings.oneThing) return;
    const root = document.documentElement;
    const mark = (target: EventTarget | null) => {
      const pane = (target as Element | null)?.closest?.(".pane");
      if (!pane) return;
      document.querySelectorAll("[data-focus-current]").forEach((el) => el !== pane && el.removeAttribute("data-focus-current"));
      pane.setAttribute("data-focus-current", "true");
      root.setAttribute("data-focus-has-current", "true");
    };
    const onFocus = (event: FocusEvent) => mark(event.target);
    const onPointer = (event: PointerEvent) => mark(event.target);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("pointerdown", onPointer, true);
    mark(document.activeElement);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("pointerdown", onPointer, true);
      document.querySelectorAll("[data-focus-current]").forEach((el) => el.removeAttribute("data-focus-current"));
      root.removeAttribute("data-focus-has-current");
    };
  }, [settings.oneThing]);

  // Gentle timer clock. Ticks only while running.
  useEffect(() => {
    if (!settings.timer || !timer.running) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      setTimer((current) => advanceTimer(current, settings, at).timer);
    }, 1000);
    return () => window.clearInterval(id);
  }, [settings, timer.running]);

  // Turning the timer off, or changing a duration while stopped, starts over.
  useEffect(() => {
    if (!settings.timer) setTimer(resetTimer(settings));
  }, [settings.timer]);
  useEffect(() => {
    setTimer((current) => (current.running ? current : resetTimer(settings)));
  }, [settings.workMinutes, settings.breakMinutes]);

  const value = useMemo<FocusModesValue>(
    () => ({
      settings,
      persisted,
      canRetryPersistence: initialReadAvailable.current,
      retryPersistence: () => {
        if (!initialReadAvailable.current) return;
        setPersisted(save(settingsRef.current));
      },
      setMode: (id, on) => update((s) => ({ ...s, [id]: on })),
      stepWork: (direction) => update((s) => ({ ...s, workMinutes: stepMinutes(s.workMinutes, direction, WORK_MINUTES) })),
      stepBreak: (direction) => update((s) => ({ ...s, breakMinutes: stepMinutes(s.breakMinutes, direction, BREAK_MINUTES) })),
      setWorkMinutes: (minutes) => update((s) => ({ ...s, workMinutes: boundMinutes(minutes, WORK_MINUTES) })),
      setBreakMinutes: (minutes) => update((s) => ({ ...s, breakMinutes: boundMinutes(minutes, BREAK_MINUTES) })),
      timer,
      remainingMs: timerRemaining(timer, now),
      toggleTimer: () => {
        const at = Date.now();
        setNow(at);
        setTimer((current) => (current.running ? pauseTimer(current, at) : startTimer(current, at)));
      },
      resetTimer: () => setTimer(resetTimer(settings)),
    }),
    [settings, persisted, timer, now, update],
  );
  return <FocusModesContext.Provider value={value}>{children}</FocusModesContext.Provider>;
}

export function useFocusModes() {
  const value = useContext(FocusModesContext);
  if (!value) throw new Error("FocusModesProvider missing");
  return value;
}

/**
 * True when "Break it into steps" is on. Long forms read this to show one step at a time
 * with progress. Safe to call outside the provider (returns false).
 */
export function useBreakIntoSteps(): boolean {
  return useContext(FocusModesContext)?.settings.steps ?? false;
}

/** Non-React reader of the same flag, for code that is not a component. */
export function breakIntoStepsEnabled(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-focus-steps") === "true";
}

/**
 * Work and break timer for the status bar. Renders nothing unless Gentle timer is on.
 * Place it inside the status bar footer (".sbar").
 */
export function FocusTimerStatus() {
  const focus = useContext(FocusModesContext);
  const app = useContext(AppContext);
  const t = app?.t ?? ((s: string) => s);
  if (!focus?.settings.timer) return null;
  const { timer, remainingMs, toggleTimer, resetTimer: reset } = focus;
  const phase = t(timer.phase === "work" ? "Work" : "Break");
  const clock = formatClock(remainingMs);
  return (
    <span className="stat focus-timer" data-phase={timer.phase} aria-label={`${t("Gentle timer")}: ${phase} ${clock}${timer.running ? "" : ` (${t("Paused")})`}`}>
      <Ms name={timer.phase === "work" ? "timer" : "coffee"} className="c-primary" />
      <span aria-hidden="true">
        {phase} <span className="mono">{clock}</span>
      </span>
      <IconBtn icon={timer.running ? "pause" : "play_arrow"} size="sm" label={t(timer.running ? "Pause timer" : "Start timer")} onClick={toggleTimer} />
      <IconBtn icon="restart_alt" size="sm" label={t("Reset timer")} onClick={reset} />
    </span>
  );
}
