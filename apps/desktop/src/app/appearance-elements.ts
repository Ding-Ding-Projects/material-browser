/* Per-element appearance overrides: storage, the generated stylesheet and a React hook.
   The pure rules live in appearance-elements-model.mjs. */
import { useEffect, useState } from "react";
import {
  APPEARANCE_ELEMENTS_KEY,
  BUILT_IN_ELEMENTS,
  overridesToCss,
  parseOverrides,
  selectorFor,
  withOverride,
  type ElementOverride,
} from "./appearance-elements-model.mjs";

export type { ElementOverride };
export type ElementChoice = { id: string; label: string };

const STYLE_ID = "appearance-elements";
let current: Record<string, ElementOverride> | null = null;
export type AppearancePersistence = "saved" | "session-only" | "reload-required";
let persistence: AppearancePersistence = "saved";
let readUnavailable = false;
const persistenceListeners = new Set<(state: AppearancePersistence) => void>();
const listeners = new Set<(all: Record<string, ElementOverride>) => void>();

function read(): Record<string, ElementOverride> {
  if (current) return current;
  try {
    current = parseOverrides(localStorage.getItem(APPEARANCE_ELEMENTS_KEY));
  } catch {
    persistence = "reload-required";
    readUnavailable = true;
    current = {};
  }
  return current;
}

/** Write the generated <style> element into <head>. Safe to call repeatedly. */
export function applyAppearanceOverrides() {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = overridesToCss(read());
}

function commit(next: Record<string, ElementOverride>) {
  current = next;
  try {
    if (readUnavailable) throw new Error("Stored appearance must be read before saving");
    if (Object.keys(next).length) localStorage.setItem(APPEARANCE_ELEMENTS_KEY, JSON.stringify(next));
    else localStorage.removeItem(APPEARANCE_ELEMENTS_KEY);
    persistence = "saved";
  } catch {
    persistence = readUnavailable ? "reload-required" : "session-only";
  }
  applyAppearanceOverrides();
  listeners.forEach((fn) => fn(next));
  persistenceListeners.forEach(fn => fn(persistence));
}

export const getAppearancePersistence = () => persistence;
export const retryAppearancePersistence = () => {
  if (!readUnavailable) commit(read());
};
export function useAppearancePersistence() {
  const [state, setState] = useState(persistence);
  useEffect(() => {
    setState(persistence);
    persistenceListeners.add(setState);
    return () => { persistenceListeners.delete(setState); };
  }, []);
  return state;
}

export const getOverride = (id: string): ElementOverride | undefined => read()[id];
export const setOverride = (id: string, override: ElementOverride | null) => commit(withOverride(read(), id, override));
export const resetOverride = (id: string) => commit(withOverride(read(), id, null));
export const resetAllOverrides = () => commit({});

export function useAppearanceOverrides() {
  const [all, setAll] = useState(read);
  useEffect(() => {
    applyAppearanceOverrides();
    listeners.add(setAll);
    return () => {
      listeners.delete(setAll);
    };
  }, []);
  return all;
}

/** Human name for an element id: built-in label, data-appearance-label, or the id itself. */
export function elementLabel(id: string): string {
  const builtIn = BUILT_IN_ELEMENTS.find((e) => e.id === id);
  if (builtIn) return builtIn.label;
  const selector = selectorFor(id);
  const el = selector ? document.querySelector<HTMLElement>(selector) : null;
  return el?.dataset.appearanceLabel || id;
}

/** Built-in groups, every tagged element currently on screen, and any id with a saved override. */
export function listElements(): ElementChoice[] {
  const seen = new Map<string, string>();
  for (const e of BUILT_IN_ELEMENTS) seen.set(e.id, e.label);
  if (typeof document !== "undefined")
    document.querySelectorAll<HTMLElement>("[data-appearance-id]").forEach((el) => {
      const id = el.dataset.appearanceId;
      if (id && selectorFor(id) && !seen.has(id)) seen.set(id, el.dataset.appearanceLabel || id);
    });
  for (const id of Object.keys(read())) if (!seen.has(id)) seen.set(id, id);
  return [...seen].map(([id, label]) => ({ id, label }));
}

/** First on-screen element an id applies to, used for current colours and the preview outline. */
export function firstElement(id: string): HTMLElement | null {
  const selector = selectorFor(id);
  return selector ? document.querySelector<HTMLElement>(`.m3 ${selector}`) || document.querySelector<HTMLElement>(selector) : null;
}

/** Outline every element an id applies to for a moment. */
export function flashElements(id: string, ms = 1600) {
  const selector = selectorFor(id);
  if (!selector) return;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  nodes.forEach((el) => el.setAttribute("data-appearance-preview", "true"));
  nodes[0]?.scrollIntoView({ block: "nearest" });
  window.setTimeout(() => nodes.forEach((el) => el.removeAttribute("data-appearance-preview")), ms);
}

/**
 * Nearest element the editor can customise, starting at node and walking up:
 * an explicit data-appearance-id first, otherwise a built-in group.
 */
export function appearanceTarget(node: Element | null): ElementChoice | null {
  for (let el: Element | null = node; el && el !== document.documentElement; el = el.parentElement) {
    const id = (el as HTMLElement).dataset?.appearanceId;
    if (id && selectorFor(id)) return { id, label: (el as HTMLElement).dataset.appearanceLabel || id };
    if (!el.closest(".m3")) continue;
    const builtIn = BUILT_IN_ELEMENTS.find((e) => el!.matches(e.selector));
    if (builtIn) return { id: builtIn.id, label: builtIn.label };
  }
  return null;
}
