// Pure helpers for per-element appearance overrides. No DOM or storage access.
import { normaliseHex } from "./colour.mjs";

export const APPEARANCE_ELEMENTS_KEY = "appearance.elements.v1";
export const RADIUS = { min: 0, max: 28, step: 1 };
export const SCALE = { min: 80, max: 150, step: 5 };

/**
 * Element groups that exist in every screen without needing a data-appearance-id attribute.
 * Any element can also opt in with data-appearance-id (and data-appearance-label for its name).
 */
export const BUILT_IN_ELEMENTS = Object.freeze([
  { id: "primary-buttons", label: "Primary buttons", selector: ".btn.filled" },
  { id: "tonal-buttons", label: "Tonal buttons", selector: ".btn.tonal" },
  { id: "panes", label: "Panes", selector: ".pane" },
  { id: "list-rows", label: "List rows", selector: ".li:not(.plain)" },
  { id: "text-fields", label: "Text fields", selector: ".tf" },
  { id: "navigation-rail", label: "Navigation rail", selector: ".rail" },
  { id: "status-bar", label: "Status bar", selector: ".sbar" },
]);

/** Ids are used inside a CSS attribute selector, so only a safe alphabet is accepted. */
export const validElementId = (id) => typeof id === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(id);

/** @param {string} id */
export function selectorFor(id) {
  const builtIn = BUILT_IN_ELEMENTS.find((e) => e.id === id);
  if (builtIn) return builtIn.selector;
  return validElementId(id) ? `[data-appearance-id="${id}"]` : null;
}

const bounded = (value, { min, max, step }) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
};

/**
 * @typedef {{ background?: string, foreground?: string, radius?: number, scale?: number }} ElementOverride
 */

/** @param {unknown} raw @returns {ElementOverride | null} */
export function normaliseOverride(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = /** @type {Record<string, unknown>} */ (raw);
  /** @type {ElementOverride} */
  const out = {};
  const background = typeof source.background === "string" ? normaliseHex(source.background) : null;
  const foreground = typeof source.foreground === "string" ? normaliseHex(source.foreground) : null;
  const radius = bounded(source.radius, RADIUS);
  const scale = bounded(source.scale, SCALE);
  if (background) out.background = background;
  if (foreground) out.foreground = foreground;
  if (radius !== undefined) out.radius = radius;
  if (scale !== undefined && scale !== 100) out.scale = scale;
  return Object.keys(out).length ? out : null;
}

/** @param {unknown} raw @returns {Record<string, ElementOverride>} */
export function normaliseOverrides(raw) {
  /** @type {Record<string, ElementOverride>} */
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!validElementId(id)) continue;
    const override = normaliseOverride(value);
    if (override) out[id] = override;
  }
  return out;
}

/** @param {string | null | undefined} text */
export function parseOverrides(text) {
  if (!text) return {};
  try {
    return normaliseOverrides(JSON.parse(text));
  } catch {
    return {};
  }
}

/**
 * Set or clear one element. A null or empty override removes the entry.
 * @param {Record<string, ElementOverride>} all
 * @param {string} id
 * @param {ElementOverride | null} override
 */
export function withOverride(all, id, override) {
  const next = { ...all };
  const clean = override ? normaliseOverride(override) : null;
  if (clean && validElementId(id)) next[id] = clean;
  else delete next[id];
  return next;
}

/**
 * Stylesheet text for every override. Rules are scoped to the app surface (.m3) and use
 * !important so they win over component styles.
 * @param {Record<string, ElementOverride>} all
 */
export function overridesToCss(all) {
  const rules = [];
  for (const [id, raw] of Object.entries(all)) {
    const selector = selectorFor(id);
    const o = normaliseOverride(raw);
    if (!selector || !o) continue;
    const scoped = selector
      .split(",")
      .map((part) => `.m3 ${part.trim()}`)
      .join(", ");
    const body = [];
    if (o.background) body.push(`background: ${o.background} !important;`);
    if (o.foreground) body.push(`color: ${o.foreground} !important;`);
    if (o.radius !== undefined) body.push(`border-radius: ${o.radius}px !important;`);
    if (o.scale !== undefined) body.push(`zoom: ${o.scale / 100};`);
    rules.push(`${scoped} { ${body.join(" ")} }`);
  }
  return rules.join("\n");
}
