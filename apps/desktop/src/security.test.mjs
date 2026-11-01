import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
const desktopRequire = createRequire(import.meta.url);

function fixture({
  argv = [],
  destroyed = false,
  contentsDestroyed = destroyed,
} = {}) {
  const handlers = new Map();
  let options;
  let dataDirectory;
  let sent = 0;
  let hostSpawns = 0;
  const exitCodes = [];
  let appUserModelId;
  const windowActions = [];
  const windowEvents = new Map();
  let maximized = false;
  const contents = {
    mainFrame: {
      url: pathToFileURL(path.join("/test", "../dist/index.html")).href,
    },
    isDestroyed: () => contentsDestroyed,
    send() {
      if (destroyed || contentsDestroyed)
        throw new Error("Object has been destroyed");
      sent++;
    },
    setWindowOpenHandler(fn) {
      this.popup = fn;
    },
    on() {},
  };
  const host = new EventEmitter();
  host.stdout = new EventEmitter();
  host.stdin = { writable: true, write() {} };
  host.kill = () => {};
  class BrowserWindow {
    constructor(value) {
      options = value;
      this.webContents = contents;
    }
    isDestroyed() {
      return destroyed;
    }
    on(name, handler) { windowEvents.set(name, handler); }
    isMaximized() { return maximized; }
    minimize() { windowActions.push("minimize"); }
    maximize() { maximized = true; windowActions.push("maximize"); windowEvents.get("maximize")?.(); }
    unmaximize() { maximized = false; windowActions.push("restore"); windowEvents.get("unmaximize")?.(); }
    close() { windowActions.push("close"); }
    loadFile() {}
  }
  const electron = {
    BrowserWindow,
    app: {
      isPackaged: false,
      getPath: () => dataDirectory || "/test-data",
      setPath: (_key, value) => {
        dataDirectory = value;
      },
      whenReady: () => ({ then: (fn) => fn() }),
      on() {},
      quit() {},
      exit(code) { exitCodes.push(code); },
      setAppUserModelId(value) { appUserModelId = value; },
    },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    shell: { openPath: async () => "" },
    session: {
      defaultSession: {
        setPermissionRequestHandler() {},
        setPermissionCheckHandler() {},
      },
    },
  };
  vm.runInNewContext(
    `(function () {\n${readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8")}\n})()`,
    {
      require: (name) => name === "./squirrel-events.cjs"
        ? { handleSquirrelEvent: options => desktopRequire('../electron/squirrel-events.cjs').handleSquirrelEvent({ ...options, statFile: () => { throw new Error('fixture updater missing'); }, report() {} }) }
        :
        ({
          electron,
          "./settings-ipc.cjs": { registerSettingsIpc() {} },
          "./services/element-locks.cjs": desktopRequire("../electron/services/element-locks.cjs"),
          "./game-servers-ipc.cjs": desktopRequire("../electron/game-servers-ipc.cjs"),
          "./session-events.cjs": desktopRequire("../electron/session-events.cjs"),
          "node:child_process": { spawn: () => { hostSpawns++; return host; } },
          "node:path": path,
          "node:url": { pathToFileURL },
          "node:readline": { createInterface: () => new EventEmitter() },
          "node:crypto": { randomUUID: () => "request-id" },
        })[name],
      __dirname: "/test",
      setTimeout,
      clearTimeout,
      Buffer,
      process: { resourcesPath: "/test", argv, platform: "win32", execPath: "C:\\fixture\\MaterialBrowser\\app-0.1.1\\MaterialBrowser.exe" },
    },
  );
  return { windowActions, windowEvents, handlers, options, contents, host, dataDirectory, sent: () => sent, hostSpawns, exitCodes, appUserModelId };
}

test('Squirrel maintenance never opens a workspace or starts its native host', () => {
  for (const event of ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete']) {
    const f = fixture({ argv: ['MaterialBrowser.exe', event, '0.1.1'] });
    assert.equal(f.options, undefined);
    assert.equal(f.hostSpawns, 0);
    assert.equal(f.handlers.size, 0);
    assert.deepEqual(f.exitCodes, [event === '--squirrel-obsolete' ? 0 : 1]);
  }
});

test('first productive launch retains its workspace and matching shell identity', () => {
  const f = fixture({ argv: ['MaterialBrowser.exe', '--squirrel-firstrun'] });
  assert.ok(f.options);
  assert.equal(f.hostSpawns, 1);
  assert.equal(f.appUserModelId, 'com.squirrel.MaterialBrowser.MaterialBrowser');
});

test("main denies arbitrary methods and untrusted frames before dispatch", () => {
  const { handlers, contents } = fixture();
  const call = handlers.get("material:request");
  assert.throws(() =>
    call(
      { sender: contents, senderFrame: contents.mainFrame },
      "filesystem.read",
      {},
    ),
  );
  assert.throws(() =>
    call({ sender: {}, senderFrame: {} }, "vault.unlock", {
      password: "synthetic",
    }),
  );
  assert.throws(() =>
    call({ sender: contents, senderFrame: {} }, "profiles.list", {}),
  );
});

test("window has sandbox, isolated context and no Node; popups are denied", () => {
  const { options, contents } = fixture();
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(contents.popup().action, "deny");
});

test("privileged requests require the exact bundled document URL even in the owning frame", () => {
  const { handlers, contents } = fixture();
  const call = handlers.get("material:request");
  for (const url of [
    "https://example.invalid/",
    "file:///different/index.html",
    "about:blank",
  ]) {
    contents.mainFrame.url = url;
    assert.throws(
      () =>
        call(
          { sender: contents, senderFrame: contents.mainFrame },
          "profiles.list",
          {},
        ),
      /INVALID_REQUEST/,
    );
  }
});

test("late host exit never sends into a destroyed window", () => {
  const closed = fixture({ destroyed: true });
  assert.doesNotThrow(() => closed.host.emit("exit", 0));
  assert.equal(closed.sent(), 0);
  const contentsOnly = fixture({ contentsDestroyed: true });
  assert.doesNotThrow(() => contentsOnly.host.emit("exit", 0));
  assert.equal(contentsOnly.sent(), 0);
  const live = fixture();
  live.host.emit("exit", 1);
  assert.equal(live.sent(), 1);
});

test("explicit data directory accepts only one absolute non-root directory", () => {
  const directory = path.resolve("isolated-test-data");
  assert.equal(
    fixture({ argv: [`--material-data-dir=${directory}`] }).dataDirectory,
    directory,
  );
  for (const argv of [
    ["--material-data-dir=relative"],
    ["--material-data-dir="],
    [`--material-data-dir=${path.parse(directory).root}`],
    [
      `--material-data-dir=${path.join(path.parse(directory).root, "unused")}${path.sep}..`,
    ],
    ...(process.platform === "win32"
      ? [
          ["--material-data-dir=\\\\server\\share\\child\\.."],
          ["--material-data-dir=C:/unused/.."],
        ]
      : []),
    [`--material-data-dir=${directory}`, `--material-data-dir=${directory}`],
  ])
    assert.throws(() => fixture({ argv }), /INVALID_DATA_DIRECTORY/);
});

test("custom window actions retain trusted-frame and exact-action boundaries", () => {
  const f = fixture();
  assert.equal(f.options.frame, false);
  const call = f.handlers.get("material:window");
  const trusted = { sender: f.contents, senderFrame: f.contents.mainFrame };
  for (const action of ["minimize", "maximize", "restore", "close"]) {
    assert.throws(() => call({ sender: {}, senderFrame: {} }, action), /INVALID_REQUEST/);
    assert.throws(() => call({ sender: f.contents, senderFrame: {} }, action), /INVALID_REQUEST/);
  }
  for (const action of ["destroy", "executeJavaScript", "", null, {}]) assert.throws(() => call(trusted, action), /INVALID_REQUEST/);
  assert.deepEqual(f.windowActions, []);
  assert.equal(call(trusted, "maximize").maximized, true);
  assert.equal(call(trusted, "restore").maximized, false);
  call(trusted, "minimize"); call(trusted, "close");
  assert.deepEqual(f.windowActions, ["maximize", "restore", "minimize", "close"]);
  assert.equal(f.sent(), 2);
});

test("element lock storage refuses untrusted frames and unknown operations", async () => {
  const f = fixture();
  const call = f.handlers.get("material:element-locks");
  const trusted = { sender: f.contents, senderFrame: f.contents.mainFrame };
  await assert.rejects(call({ sender: {}, senderFrame: {} }, "read", { kind: "locks" }), /INVALID_REQUEST/);
  await assert.rejects(call({ sender: f.contents, senderFrame: {} }, "folder"), /INVALID_REQUEST/);
  await assert.rejects(call(trusted, "delete", {}), /INVALID_REQUEST/);
  await assert.rejects(call(trusted, "read", { kind: "../vault" }), /INVALID_REQUEST/);
  assert.equal((await call(trusted, "folder")).path.endsWith("element-locks"), true);
});

test("Minecraft server manager refuses untrusted frames and unknown operations", async () => {
  const f = fixture();
  const call = f.handlers.get("material:game-servers");
  assert.equal(f.handlers.has("material:minecraft"), false);
  const trusted = { sender: f.contents, senderFrame: f.contents.mainFrame };
  await assert.rejects(call({ sender: {}, senderFrame: {} }, "list"), /INVALID_REQUEST/);
  await assert.rejects(call({ sender: f.contents, senderFrame: {} }, "capabilities"), /INVALID_REQUEST/);
  await assert.rejects(call(trusted, "shell", { line: "rm -rf /" }), /INVALID_REQUEST/);
  await assert.rejects(call(trusted, "start", { id: "../x" }), /INVALID_ID/);
  assert.deepEqual((await call(trusted, "capabilities")).targets.map((t) => t.id).sort(), ["local-docker", "local-process", "ssh-docker", "ssh-process"]);
});
