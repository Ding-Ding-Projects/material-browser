const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { historyContext } = require("./history-context.cjs");
test("explicit diagnostic data directories receive stable isolated credential namespaces", () => {
  const root = path.resolve("synthetic-capture-root");
  const options = {
    app: { isPackaged: true, getPath: () => root },
    resourcesPath: path.resolve("synthetic-resources"),
  };
  assert.equal(historyContext(options).namespace, "primary");
  const first = historyContext({ ...options, explicitDataDirectory: true });
  const second = historyContext({
    ...options,
    app: { ...options.app, getPath: () => root.toUpperCase() },
    explicitDataDirectory: true,
  });
  assert.equal(first.namespace === second.namespace, true);
  assert.equal(/^test-[a-f0-9-]{36}$/.test(first.namespace), true);
  assert.equal(first.namespace === "primary", false);
  assert.equal(first.namespace.includes(root), false);
  assert.equal(
    first.manifestPath,
    path.join(options.resourcesPath, "history-git.lock.json"),
  );
  assert.equal(first.payloadParent, options.resourcesPath);
});
