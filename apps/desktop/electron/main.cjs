const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");
const { randomUUID } = require("node:crypto");
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
      "serve",
      "--stdio",
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
  );
  host.on("error", failPending);
  host.on("exit", () => {
    host = undefined;
    failPending();
    window?.webContents.send("material:event", {
      type: "backend-disconnected",
    });
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
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame
  );
}
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
  window.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  host?.kill();
  failPending();
});
