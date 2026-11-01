// Pure colour maths for the appearance editor. No DOM access, so it runs under node --test.
// Colours travel as { r, g, b } with 0-255 integer channels unless stated otherwise.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * Parse "#rgb", "#rrggbb", "rgb" or "rrggbb" (case-insensitive). Returns null when invalid.
 * @param {string} text
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseHex(text) {
  if (typeof text !== "string") return null;
  const value = text.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return null;
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** @param {string} text */
export const isHex = (text) => parseHex(text) !== null;

/**
 * Format channels as upper-case "#RRGGBB". Channels are rounded and clamped.
 * @param {{ r: number, g: number, b: number }} rgb
 */
export function formatHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** Normalise any valid hex spelling to "#RRGGBB", or null. @param {string} text */
export function normaliseHex(text) {
  const rgb = parseHex(text);
  return rgb ? formatHex(rgb) : null;
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {{ h: number, s: number, l: number }} h in degrees, s and l in percent
 */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

/**
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb({ h, s, l }) {
  const sn = clamp(s, 0, 100) / 100, ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r1, g1, b1] =
    hn < 60 ? [c, x, 0] : hn < 120 ? [x, c, 0] : hn < 180 ? [0, c, x] : hn < 240 ? [0, x, c] : hn < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/**
 * Hue, saturation and value; used by the two-dimensional colour area.
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {{ h: number, s: number, v: number }} h in degrees, s and v in percent
 */
export function rgbToHsv({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/**
 * @param {{ h: number, s: number, v: number }} hsv
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvToRgb({ h, s, v }) {
  const sn = clamp(s, 0, 100) / 100, vn = clamp(v, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;
  const [r1, g1, b1] =
    hn < 60 ? [c, x, 0] : hn < 120 ? [x, c, 0] : hn < 180 ? [0, c, x] : hn < 240 ? [0, x, c] : hn < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

const toLinear = (c) => {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (n) => 255 * (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

/**
 * sRGB to OKLCH (Ottosson's OKLab in polar form).
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {{ l: number, c: number, h: number }} l from 0 to 1, c chroma, h in degrees
 */
export function rgbToOklch({ r, g, b }) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

/**
 * OKLCH to sRGB. Out-of-gamut results are clamped per channel.
 * @param {{ l: number, c: number, h: number }} lch
 * @returns {{ r: number, g: number, b: number }}
 */
export function oklchToRgb({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad), B = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return {
    r: clamp(fromLinear(lr), 0, 255),
    g: clamp(fromLinear(lg), 0, 255),
    b: clamp(fromLinear(lb), 0, 255),
  };
}

/** WCAG 2 relative luminance, 0 to 1. @param {{ r: number, g: number, b: number }} rgb */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * WCAG 2 contrast ratio between two colours, from 1 to 21.
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Normal-size text threshold used by the editor. */
export const CONTRAST_MINIMUM = 4.5;

/**
 * Contrast verdict for a colour against its text colour.
 * @param {string} colourHex
 * @param {string} textHex
 * @returns {{ ratio: number, passes: boolean, advice: "passes" | "darker" | "lighter" } | null}
 */
export function contrastCheck(colourHex, textHex) {
  const a = parseHex(colourHex), b = parseHex(textHex);
  if (!a || !b) return null;
  const ratio = contrastRatio(a, b);
  const passes = ratio >= CONTRAST_MINIMUM;
  const advice = passes ? "passes" : relativeLuminance(b) >= relativeLuminance(a) ? "darker" : "lighter";
  return { ratio, passes, advice };
}

/**
 * Text forms of one colour in every supported notation.
 * @param {string} hex
 * @returns {{ hex: string, rgb: string, hsl: string, oklch: string } | null}
 */
export function translate(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  const ok = rgbToOklch(rgb);
  return {
    hex: formatHex(rgb),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${round(hsl.h)} ${round(hsl.s)}% ${round(hsl.l)}%)`,
    oklch: `oklch(${round(ok.l * 100, 1)}% ${round(ok.c, 3)} ${round(ok.h, 1)})`,
  };
}

/**
 * Read a computed CSS colour such as "rgb(0, 106, 106)" or "rgba(0, 0, 0, 0)".
 * Returns null for anything else and for fully transparent colours.
 * @param {string} text
 */
export function parseCssRgb(text) {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(String(text || "").trim());
  if (!m) return null;
  if (m[4] !== undefined) {
    const alpha = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (alpha === 0) return null;
  }
  return { r: clamp(Math.round(+m[1]), 0, 255), g: clamp(Math.round(+m[2]), 0, 255), b: clamp(Math.round(+m[3]), 0, 255) };
}
