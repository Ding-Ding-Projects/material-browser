const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { verifyHistoryRuntime } = require("./history-runtime.cjs");
async function fixture(t) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "material-history-runtime-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const payload = path.join(root, "v2.56.0.windows.2");
  const manifest = {
    schemaVersion: 1,
    version: "2.56.0.windows.2",
    release: "v2.56.0.windows.2",
    executable: "cmd/git.exe",
    files: [],
  };
  for (const name of ["cmd/git.exe", "mingw64/bin/helper.dll"]) {
    const bytes = Buffer.from(`non-executable fixture: ${name}`),
      file = path.join(payload, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    manifest.files.push({
      path: name,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const manifestPath = path.join(root, "history-git.lock.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  return {
    root,
    payload,
    manifest,
    manifestPath,
    options: { manifestPath, payloadParent: root },
  };
}
test("runtime verification covers every declared file without executing any fixture", async (t) => {
  const { options, payload } = await fixture(t);
  const result = await verifyHistoryRuntime(options);
  assert.equal(result.verifiedFiles, 2);
  assert.equal(result.gitExecutable, path.join(payload, "cmd/git.exe"));
});
test("modified auxiliary runtime bytes fail even when the executable is unchanged", async (t) => {
  const { options, payload } = await fixture(t);
  const file = path.join(payload, "mingw64/bin/helper.dll"),
    bytes = await fs.readFile(file);
  bytes[0] ^= 1;
  await fs.writeFile(file, bytes);
  await assert.rejects(
    verifyHistoryRuntime(options),
    /HISTORY_RUNTIME_UNAVAILABLE/,
  );
});
test("extra and missing runtime files both fail the complete inventory", async (t) => {
  const { options, payload } = await fixture(t);
  const extra = path.join(payload, "unlisted.dll");
  await fs.writeFile(extra, "extra");
  await assert.rejects(
    verifyHistoryRuntime(options),
    /HISTORY_RUNTIME_UNAVAILABLE/,
  );
  await fs.unlink(extra);
  await fs.unlink(path.join(payload, "mingw64/bin/helper.dll"));
  await assert.rejects(
    verifyHistoryRuntime(options),
    /HISTORY_RUNTIME_UNAVAILABLE/,
  );
});
test("linked runtime directories and hardlinked files are rejected", async (t) => {
  const { options, root, payload } = await fixture(t);
  const library = path.join(payload, "mingw64/bin/helper.dll"),
    alias = path.join(root, "alias.dll");
  await fs.link(library, alias);
  await assert.rejects(verifyHistoryRuntime(options), /UNSAFE_SETTINGS_PATH/);
  await fs.unlink(alias);
  const moved = path.join(root, "moved");
  await fs.rename(path.join(payload, "mingw64"), moved);
  await fs.symlink(
    moved,
    path.join(payload, "mingw64"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(verifyHistoryRuntime(options));
});
test("manifest traversal, duplicate identities and arbitrary executable names are rejected", async (t) => {
  const { options, manifest, manifestPath } = await fixture(t);
  for (const bad of [
    { ...manifest, executable: "outside.exe" },
    { ...manifest, files: [...manifest.files, manifest.files[0]] },
    { ...manifest, files: [{ ...manifest.files[0], path: "../outside" }] },
  ]) {
    await fs.writeFile(manifestPath, JSON.stringify(bad));
    await assert.rejects(
      verifyHistoryRuntime(options),
      /HISTORY_RUNTIME_UNAVAILABLE/,
    );
  }
});
