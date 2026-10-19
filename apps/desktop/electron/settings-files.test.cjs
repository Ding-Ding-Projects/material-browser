const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const files = require("./settings-files.cjs");
const { registerSettingsIpc } = require("./settings-ipc.cjs");

async function fixture(t) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "material-settings-files-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
function bridge(root, overrides = {}) {
  let handler;
  registerSettingsIpc({
    ipcMain: {
      handle: (_name, fn) => {
        handler = fn;
      },
    },
    app: { getPath: () => root },
    trusted: (event) => event.trusted,
    getWindow: () => null,
    dialog: {
      showOpenDialog: async () => ({
        canceled: false,
        filePaths: [path.join(root, "chosen.exe")],
      }),
    },
    ...overrides,
  });
  return (operation, params = {}) =>
    handler({ trusted: true }, operation, params);
}

test("linked export root never writes into its victim directory", async (t) => {
  const root = await fixture(t);
  const app = path.join(root, "app"),
    victim = path.join(root, "victim");
  await fs.mkdir(app);
  await fs.mkdir(victim);
  await fs.writeFile(path.join(victim, "sentinel.txt"), "untouched");
  await fs.symlink(
    victim,
    path.join(app, "settings-exports"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const call = bridge(app);
  const result = await call("open-export", {
    editorId: "selected",
    format: "json",
    preferences: {},
    schedules: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(await fs.readdir(victim), ["sentinel.txt"]);
  assert.equal(
    await fs.readFile(path.join(victim, "sentinel.txt"), "utf8"),
    "untouched",
  );
});

test("linked ancestors and hardlinked settings files are rejected before mutation", async (t) => {
  const root = await fixture(t),
    victim = path.join(root, "victim");
  await fs.mkdir(victim);
  const alias = path.join(root, "alias");
  await fs.symlink(
    victim,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    files.atomic(path.join(alias, "nested", "record.json"), "new"),
    /UNSAFE_SETTINGS_PATH/,
  );
  assert.deepEqual(await fs.readdir(victim), []);
  const original = path.join(root, "original.json"),
    linked = path.join(root, "linked.json");
  await fs.writeFile(original, "old");
  await fs.link(original, linked);
  await assert.rejects(files.atomic(linked, "new"), /UNSAFE_SETTINGS_PATH/);
  await assert.rejects(files.read(linked), /UNSAFE_SETTINGS_PATH/);
  assert.equal(await fs.readFile(original, "utf8"), "old");
});

test("failed durable editor save preserves the previous effective selection", async (t) => {
  const root = await fixture(t),
    previous = path.join(root, "previous.exe");
  await files.atomic(
    path.join(root, "editor-choice.json"),
    JSON.stringify({ version: 1, executable: previous }),
  );
  const discovered = [];
  const call = bridge(root, {
    files: {
      ...files,
      atomic: async () => {
        throw Error("DISK_WRITE_REJECTED");
      },
    },
    editors: {
      discoverEditors: async (options) => {
        discovered.push(options.selectedEditor);
        return { ok: true, editors: [{ id: "selected", name: "Editor" }] };
      },
      openInEditor: async () => {
        throw Error("Not expected");
      },
    },
  });
  await call("editors");
  assert.equal((await call("choose-editor")).ok, false);
  await call("editors");
  assert.deepEqual(discovered, [
    previous,
    path.join(root, "chosen.exe"),
    previous,
  ]);
  assert.equal(
    JSON.parse(await files.read(path.join(root, "editor-choice.json")))
      .executable,
    previous,
  );
});

test("exclusive writes preserve existing bytes and atomic replacement survives a rejected rename", async (t) => {
  const root = await fixture(t),
    target = path.join(root, "record.json");
  await files.writeExclusive(target, "original");
  await assert.rejects(files.writeExclusive(target, "replacement"), {
    code: "EEXIST",
  });
  await assert.rejects(
    files.atomic(target, "replacement", {
      replace: async () => {
        throw Error("RENAME_REJECTED");
      },
    }),
    /RENAME_REJECTED/,
  );
  assert.equal((await files.read(target)).toString(), "original");
  await files.atomic(target, "replacement");
  assert.equal((await files.read(target)).toString(), "replacement");
});
