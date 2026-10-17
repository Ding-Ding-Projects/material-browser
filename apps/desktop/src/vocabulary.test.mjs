import test from "node:test";
import assert from "node:assert/strict";
import { parseVocabulary, replaceLabel } from "./vocabulary.mjs";
test("valid dynamic entries and exact label boundary", () => {
  const v = parseVocabulary(
    '{"schemaVersion":1,"entries":{"Settings":"Preferences"}}',
  );
  assert.equal(replaceLabel("Settings", v.entries), "Preferences");
  assert.equal(replaceLabel("Settings/file", v.entries), "Settings/file");
});
test("reject duplicate, unknown, prototype, nested and non-string entries", () => {
  for (const text of [
    '{"schemaVersion":1,"schemaVersion":1,"entries":{}}',
    '{"schemaVersion":2,"entries":{}}',
    '{"schemaVersion":1,"entries":{"__proto__":"x"}}',
    '{"schemaVersion":1,"entries":{"x":{}}}',
    '{"schemaVersion":1,"entries":{},"extra":true}',
  ])
    assert.throws(() => parseVocabulary(text));
});
test("bounds are enforced without partial application", () => {
  assert.throws(() =>
    parseVocabulary(
      JSON.stringify({ schemaVersion: 1, entries: { x: "a".repeat(1001) } }),
    ),
  );
  assert.throws(() => parseVocabulary(" ".repeat(262145)));
  assert.throws(() =>
    parseVocabulary(
      JSON.stringify({ schemaVersion: 1, entries: { ["x".repeat(161)]: "x" } }),
    ),
  );
});
