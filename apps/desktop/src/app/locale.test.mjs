import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Every label the redesigned screens pass to t("...") has Cantonese wording.
test("redesigned screens have Cantonese for every literal label", () => {
  const known = new Set();
  for (const f of ["./locale.ts", "../i18n.ts", "../workspace/locale.ts", "../SuperProfiles.locale.ts", "../settings/locale.mjs", "./Servers.locale.ts", "./Ollama.locale.ts", "./Toolbox.locale.ts"]) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const m of text.matchAll(/(?:^|[{,\s])(?:"((?:[^"\\]|\\.)+)"|'((?:[^'\\]|\\.)+)'|([A-Za-z][A-Za-z0-9]*))\s*:\s*["'`]/gm))
      known.add(m[1] || m[2] || m[3]);
  }
  const missing = [];
  for (const file of readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".tsx"))) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    for (const m of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"\s*\)/g)) {
      const key = m[1];
      if (!known.has(key)) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
