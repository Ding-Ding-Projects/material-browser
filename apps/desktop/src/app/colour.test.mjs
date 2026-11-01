import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHex,
  formatHex,
  normaliseHex,
  isHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToOklch,
  oklchToRgb,
  contrastRatio,
  contrastCheck,
  translate,
  parseCssRgb,
  parseCssRgba,
} from "./colour.mjs";

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not within ${tolerance} of ${expected}`);
const sameRgb = (a, b, tolerance = 0.5) => {
  near(a.r, b.r, tolerance, "red");
  near(a.g, b.g, tolerance, "green");
  near(a.b, b.b, tolerance, "blue");
};

test("hex parses short and long forms and formats back", () => {
  assert.deepEqual(parseHex("#006A6A"), { r: 0, g: 106, b: 106 });
  assert.deepEqual(parseHex("006a6a"), { r: 0, g: 106, b: 106 });
  assert.deepEqual(parseHex("#fff"), { r: 255, g: 255, b: 255 });
  assert.equal(formatHex({ r: 0, g: 106, b: 106 }), "#006A6A");
  assert.equal(normaliseHex("#abc"), "#AABBCC");
  for (const hex of ["#000000", "#FFFFFF", "#006A6A", "#4B607C", "#8B5000", "#B3261E", "#5B4B9C", "#1D6B2B", "#123456"])
    assert.equal(formatHex(parseHex(hex)), hex);
});

test("invalid hex is rejected", () => {
  for (const bad of ["", "#", "#12", "#1234", "#12345", "#1234567", "#GGGGGG", "red", "#00 0", "rgb(0,0,0)", null, undefined, 42])
    assert.equal(parseHex(/** @type {any} */ (bad)), null, String(bad));
  assert.equal(isHex("#zzz"), false);
  assert.equal(normaliseHex("nope"), null);
  assert.equal(translate("#12345"), null);
});

test("rgb and hsl convert both ways", () => {
  const hsl = rgbToHsl({ r: 0, g: 106, b: 106 });
  near(hsl.h, 180, 0.01, "hue");
  near(hsl.s, 100, 0.01, "saturation");
  near(hsl.l, 20.78, 0.01, "lightness");
  sameRgb(hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0 });
  for (const hex of ["#006A6A", "#B3261E", "#5B4B9C", "#808080", "#000000", "#FFFFFF"]) {
    const rgb = parseHex(hex);
    sameRgb(hslToRgb(rgbToHsl(rgb)), rgb);
    sameRgb(hsvToRgb(rgbToHsv(rgb)), rgb);
  }
});

test("rgb and oklch convert both ways within tolerance", () => {
  const white = rgbToOklch({ r: 255, g: 255, b: 255 });
  near(white.l, 1, 0.001, "white lightness");
  near(white.c, 0, 0.001, "white chroma");
  const red = rgbToOklch({ r: 255, g: 0, b: 0 });
  near(red.l, 0.628, 0.002, "red lightness");
  near(red.c, 0.2577, 0.002, "red chroma");
  near(red.h, 29.23, 0.1, "red hue");
  for (const hex of ["#006A6A", "#4B607C", "#8B5000", "#B3261E", "#5B4B9C", "#1D6B2B", "#000000", "#FFFFFF"]) {
    const rgb = parseHex(hex);
    sameRgb(oklchToRgb(rgbToOklch(rgb)), rgb, 0.6);
  }
});

test("contrast of black against white is 21", () => {
  near(contrastRatio(parseHex("#000"), parseHex("#fff")), 21, 1e-9, "ratio");
  near(contrastRatio(parseHex("#fff"), parseHex("#fff")), 1, 1e-9, "same colour");
  const pass = contrastCheck("#006A6A", "#FFFFFF");
  assert.equal(pass.passes, true);
  assert.equal(pass.advice, "passes");
  const lowOnWhite = contrastCheck("#B0E0E0", "#FFFFFF");
  assert.equal(lowOnWhite.passes, false);
  assert.equal(lowOnWhite.advice, "darker");
  const lowOnBlack = contrastCheck("#202020", "#000000");
  assert.equal(lowOnBlack.advice, "lighter");
  assert.equal(contrastCheck("#bad", "nope"), null);
});

test("translations give every notation", () => {
  assert.deepEqual(translate("#006a6a"), {
    hex: "#006A6A",
    rgb: "rgb(0, 106, 106)",
    hsl: "hsl(180 100% 21%)",
    oklch: translate("#006A6A").oklch,
  });
  assert.match(translate("#006A6A").oklch, /^oklch\(\d+(\.\d)?% 0\.\d+ \d+(\.\d)?\)$/);
});

test("computed css colours are read and transparent ones ignored", () => {
  assert.deepEqual(parseCssRgb("rgb(0, 106, 106)"), { r: 0, g: 106, b: 106 });
  assert.equal(parseCssRgb("rgba(255, 255, 255, 0.5)"), null);
  assert.deepEqual(parseCssRgba("rgba(255, 255, 255, 0.5)"), { r: 255, g: 255, b: 255, a: 0.5 });
  assert.equal(parseCssRgb("rgb(1 2 3 / 50%)"), null);
  assert.deepEqual(parseCssRgba("rgb(1 2 3 / 50%)"), { r: 1, g: 2, b: 3, a: 0.5 });
  assert.equal(parseCssRgb("rgba(0, 0, 0, 0)"), null);
  assert.equal(parseCssRgb("transparent"), null);
});
