const { spawn } = require("node:child_process");
const { statSync } = require("node:fs");
const path = require("node:path").win32;

const events = new Map([
  ["--squirrel-install", "--createShortcut"],
  ["--squirrel-updated", "--createShortcut"],
  ["--squirrel-uninstall", "--removeShortcut"],
  ["--squirrel-obsolete", null],
]);

// Maintenance must finish before opening the workspace or starting its host.
function handleSquirrelEvent({
  app, argv, execPath, platform, spawnProcess = spawn, statFile = statSync,
  setTimer = setTimeout, clearTimer = clearTimeout,
  report = (code) => console.error(code),
}) {
  if (platform !== "win32" || !events.has(argv[1])) return false;
  const action = events.get(argv[1]);
  if (!action) { app.exit(0); return true; }
  let child;
  let timer;
  let finished = false;
  const finish = (code, beforeExit) => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) clearTimer(timer);
    if (code) report("SHORTCUT_MAINTENANCE_FAILED");
    try { beforeExit?.(); } finally { app.exit(code); }
  };
  try {
    const directory = path.dirname(execPath);
    const executable = path.basename(execPath);
    if (!path.isAbsolute(execPath) ||
        executable.toLowerCase() !== "materialbrowser.exe" ||
        !/^app-\d+\.\d+\.\d+$/.test(path.basename(directory))) {
      throw new Error("INVALID_INSTALLATION_LAYOUT");
    }
    const updater = path.join(path.dirname(directory), "Update.exe");
    if (!statFile(updater).isFile()) throw new Error("UPDATER_MISSING");
    child = spawnProcess(updater, [`${action}=${executable}`], {
      shell: false, windowsHide: true, stdio: "ignore",
    });
    child.once("error", () => finish(1));
    child.once("close", (code, signal) => finish(code === 0 && !signal ? 0 : 1));
    timer = setTimer(() => {
      if (finished) return;
      finish(1, () => child.kill());
    }, 10_000);
  } catch {
    finish(1);
  }
  return true;
}

module.exports = { handleSquirrelEvent };
