import test from "node:test";
import assert from "node:assert/strict";
import {
  APPEARANCE_ELEMENTS_KEY,
  parseOverrides,
  normaliseOverride,
  withOverride,
  overridesToCss,
  selectorFor,
  validElementId,
} from "./appearance-elements-model.mjs";

test("storage key is versioned", () => {
  assert.equal(APPEARANCE_ELEMENTS_KEY, "appearance.elements.v1");
});

test("corrupt storage and unsafe ids are dropped", () => {
  assert.deepEqual(parseOverrides("{bad"), {});
  assert.deepEqual(parseOverrides(null), {});
  assert.deepEqual(parseOverrides(JSON.stringify({ 'x"] { color: red } [y': { background: "#000" }, ok: { background: "#abc" } })), { ok: { background: "#AABBCC" } });
  assert.equal(validElementId("profile-list"), true);
  assert.equal(validElementId("a b"), false);
  assert.equal(selectorFor("a\"b"), null);
});

test("values are bounded and invalid colours ignored", () => {
  assert.deepEqual(normaliseOverride({ background: "nope", foreground: "#fff", radius: 99, scale: 10 }), { foreground: "#FFFFFF", radius: 28, scale: 80 });
  assert.equal(normaliseOverride({ scale: 100 }), null);
  assert.equal(normaliseOverride("text"), null);
});

test("reset removes one element and keeps the rest", () => {
  let all = withOverride({}, "panes", { radius: 4 });
  all = withOverride(all, "primary-buttons", { background: "#006A6A" });
  all = withOverride(all, "panes", null);
  assert.deepEqual(all, { "primary-buttons": { background: "#006A6A" } });
});

test("css is generated for built-in groups and tagged elements", () => {
  const css = overridesToCss({ "primary-buttons": { background: "#006A6A", radius: 8 }, "my-card": { scale: 120, foreground: "#000000" } });
  assert.match(css, /\.m3 \.btn\.filled \{ background: #006A6A !important; border-radius: 8px !important; \}/);
  assert.match(css, /\.m3 \[data-appearance-id="my-card"\] \{ color: #000000 !important; zoom: 1\.2; \}/);
});
