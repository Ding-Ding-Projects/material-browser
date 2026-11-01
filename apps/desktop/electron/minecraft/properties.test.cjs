const test = require("node:test");
const assert = require("node:assert/strict");
const properties = require("./properties.cjs");
test("untouched properties preserve CRLF, comments, whitespace, escaped keys and continuation bytes", () => {
  const text =
    "# heading\r\n motd : Hello \\u4f60\\u597d\r\ncustom\\ key=one\\\r\n  two\r\nlast=value";
  assert.equal(properties.serialize(properties.parse(text)), text);
  const values = properties.toObject(properties.parse(text));
  assert.equal(values.motd, "Hello 你好");
  assert.equal(values["custom key"], "onetwo");
});
test("every duplicate key changes including Unicode escaped identities", () => {
  const text = "motd=one\nmot\\u0064=two\nmotd=three\nunknown=kept\n";
  const result = properties.applyChanges(text, "1.21.4", { motd: "你好 🎮" });
  const lines = properties.parse(result.text);
  assert.equal(lines.filter((l) => l.key === "motd").length, 3);
  assert.ok(
    lines.filter((l) => l.key === "motd").every((l) => l.value === "你好 🎮"),
  );
  assert.match(result.text, /unknown=kept/);
  assert.ok(result.text.includes("\\ud83c\\udfae"));
});
test("unknown snapshot schemas never invent defaults or expose newer controls as supported", () => {
  const view = properties.typedView(
    "simulation-distance=12\n",
    "26.4-snapshot-6",
  );
  const simulation = view.typed.find((d) => d.key === "simulation-distance");
  assert.equal(simulation.available, false);
  assert.equal(simulation.versionApplicability, "unresolved");
  assert.equal(simulation.value, 12);
  assert.equal(view.typed.find((d) => d.key === "white-list").value, null);
  assert.throws(
    () =>
      properties.applyChanges("", "26.4-snapshot-6", {
        "simulation-distance": 12,
      }),
    { code: "NO_CONTROL_FOR_KEY" },
  );
});
test("declared release boundaries omit moved settings and retain actual unknown values", () => {
  assert.equal(
    properties
      .descriptorsFor("1.16.5")
      .some((d) => d.key === "simulation-distance"),
    false,
  );
  assert.equal(
    properties.descriptorsFor("1.21.9").some((d) => d.key === "pvp"),
    false,
  );
  assert.equal(
    properties.defaultFor(properties.BY_KEY.get("white-list"), "26.3"),
    true,
  );
  assert.deepEqual(
    properties.typedView("pvp=false\n", "1.21.9").unknown.map((x) => x.key),
    ["pvp"],
  );
});
test("numeric, choice and switch controls reject wrong types and leave original input untouched", () => {
  const original = "difficulty=easy\n";
  for (const changes of [
    { difficulty: "impossible" },
    { "view-distance": 33 },
    { "online-mode": "false" },
    { motd: "bad\nline" },
  ])
    assert.throws(() => properties.applyChanges(original, "1.21.4", changes), {
      code: "INVALID_VALUE",
    });
  assert.equal(original, "difficulty=easy\n");
});
test("new values append safely when the original file lacks a final newline", () => {
  const result = properties.applyChanges("unknown=value", "1.21.4", {
    difficulty: "hard",
  });
  assert.equal(result.text, "unknown=value\ndifficulty=hard\n");
});
test("special property names do not change object prototypes", () => {
  const parsed = properties.toObject(
    properties.parse("__proto__=unchanged\nconstructor=value\n"),
  );
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(parsed.__proto__, "unchanged");
});
test("invalid stored numbers and switches remain visible without invented fallback values", () => {
  const view = properties.typedView(
    "max-players=broken\nonline-mode=maybe\n",
    "1.21.4",
  );
  for (const key of ["max-players", "online-mode"]) {
    const descriptor = view.typed.find((d) => d.key === key);
    assert.equal(descriptor.valid, false);
    assert.equal(descriptor.value, null);
    assert.ok(descriptor.validationMessage);
  }
  assert.equal(
    properties.serialize(properties.parse("max-players=broken\n")),
    "max-players=broken\n",
  );
});
