const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
if (require("./squirrel-events.cjs").handleSquirrelEvent({
  app, argv: process.argv, execPath: process.execPath, platform: process.platform,
})) return;
if (process.platform === "win32") {
  app.setAppUserModelId("com.squirrel.MaterialBrowser.MaterialBrowser");
}
const { spawn } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const readline = require("node:readline");
const { randomUUID } = require("node:crypto");
const { registerSettingsIpc } = require("./settings-ipc.cjs");
const rendererFile = path.join(__dirname, "../dist/index.html");
const rendererUrl = pathToFileURL(rendererFile).href;
const dataArguments = process.argv.filter((value) =>
  value.startsWith("--material-data-dir="),
);
if (dataArguments.length > 1) throw new Error("INVALID_DATA_DIRECTORY");
if (dataArguments.length === 1) {
  const directory = dataArguments[0].slice("--material-data-dir=".length);
  const resolved = path.resolve(directory);
  if (
    !path.isAbsolute(directory) ||
    directory.includes("\0") ||
    path.parse(resolved).root === resolved
  )
    throw new Error("INVALID_DATA_DIRECTORY");
  app.setPath("userData", resolved);
}
const allowed = new Set([
  "system.status",
  "vault.create",
  "vault.join",
  "vault.unlock",
  "vault.lock",
  "vault.changePassword",
  "profiles.list",
  "profiles.create",
  "profiles.update",
  "profiles.duplicate",
  "profiles.remove",
  "profiles.snapshot",
  "profiles.launch",
  "profiles.stop",
  "profiles.focus",
  "profiles.status",
  "superProfiles.list",
  "superProfiles.create",
  "superProfiles.update",
  "superProfiles.duplicate",
  "superProfiles.remove",
  "superProfiles.revisions.list",
  "superProfiles.revisions.restore",
  "superProfiles.capabilities",
  "superProfiles.sessions.launch",
  "superProfiles.sessions.status",
  "superProfiles.sessions.stop",
  "superProfiles.sessions.save",
  "superProfiles.sessions.preview",
  "superProfiles.sessions.discard",
  "engines.list",
  "revisions.list",
  "revisions.restore",
  "sync.configure",
  "sync.push",
  "sync.pull",
  "sync.conflicts",
  "sync.resolve",
  "settings.get",
  "settings.update",
]);
let host, window;
const pending = new Map();
function failPending() {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error("BACKEND_UNAVAILABLE"));
  }
  pending.clear();
}
function startHost() {
  const executable = app.isPackaged
    ? path.join(process.resourcesPath, "material-browser.exe")
    : path.resolve(__dirname, "../../../target/release/material-browser.exe");
  host = spawn(
    executable,
    [
      "--data-dir",
      path.join(app.getPath("userData"), "vault"),
      "--engine-dir",
      app.isPackaged
        ? path.join(process.resourcesPath, "engines")
        : path.resolve(__dirname, "../../../engines/builds/packaged/engines"),
      "serve",
      "--stdio",
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
  );
  host.on("error", failPending);
  host.on("exit", () => {
    host = undefined;
    failPending();
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("material:event", {
        type: "backend-disconnected",
      });
    }
  });
  const lines = readline.createInterface({ input: host.stdout });
  lines.on("line", (line) => {
    if (line.length > 4 * 1024 * 1024) return;
    try {
      const msg = JSON.parse(line);
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        msg.error
          ? p.reject(new Error(String(msg.error.code || "OPERATION_FAILED")))
          : p.resolve(msg.result);
      }
    } catch {
      /* Invalid host output never reaches the renderer. */
    }
  });
}
function trusted(event) {
  return (
    window &&
    !window.isDestroyed() &&
    !window.webContents.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === rendererUrl
  );
}
registerSettingsIpc({
  ipcMain,
  app,
  dialog,
  trusted,
  getWindow: () => window,
  resourcesPath: process.resourcesPath,
  explicitDataDirectory: dataArguments.length === 1,
});
ipcMain.handle("material:request", (event, method, params) => {
  if (
    !trusted(event) ||
    !allowed.has(method) ||
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  )
    throw new Error("INVALID_REQUEST");
  const data = JSON.stringify(params);
  if (Buffer.byteLength(data) > 512 * 1024)
    throw new Error("REQUEST_TOO_LARGE");
  if (!host?.stdin?.writable) throw new Error("BACKEND_UNAVAILABLE");
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("REQUEST_TIMEOUT"));
    }, 120000);
    pending.set(id, { resolve, reject, timer });
    host.stdin.write(JSON.stringify({ id, method, params }) + "\n", (err) => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(new Error("BACKEND_UNAVAILABLE"));
      }
    });
  });
});
ipcMain.handle("material:directory", async (event) => {
  if (!trusted(event)) throw new Error("INVALID_REQUEST");
  const result = await dialog.showOpenDialog(window, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  startHost();
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 580,
    backgroundColor: "#f7f9fc",
    icon: path.join(__dirname, "../assets/material-browser.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(rendererFile);
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  host?.kill();
  failPending();
});
