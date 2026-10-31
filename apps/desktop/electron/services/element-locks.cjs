// Element locks and support tickets live in their own folder, apart from the vault,
// so removing that folder resets every lock without touching any profile data.
const fs = require("node:fs");
const path = require("node:path");

const FILES = { locks: "locks.json", tickets: "support-tickets.json" };
const LIMIT = 256 * 1024;

function folderFor(userData) {
  return path.join(userData, "element-locks");
}

function readStore(userData, kind) {
  if (!Object.hasOwn(FILES, kind)) throw new Error("INVALID_REQUEST");
  const file = path.join(folderFor(userData), FILES[kind]);
  try {
    const text = fs.readFileSync(file, "utf8");
    if (Buffer.byteLength(text) > LIMIT) return {};
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeStore(userData, kind, value) {
  if (!Object.hasOwn(FILES, kind)) throw new Error("INVALID_REQUEST");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_REQUEST");
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > LIMIT) throw new Error("REQUEST_TOO_LARGE");
  const folder = folderFor(userData);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, FILES[kind]);
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { ok: true };
}

function registerElementLocksIpc({ ipcMain, app, shell, trusted }) {
  ipcMain.handle("material:element-locks", async (event, operation, params = {}) => {
    if (!trusted(event) || typeof operation !== "string") throw new Error("INVALID_REQUEST");
    const userData = app.getPath("userData");
    if (operation === "read") return readStore(userData, params.kind);
    if (operation === "write") return writeStore(userData, params.kind, params.value);
    if (operation === "folder") return { path: folderFor(userData) };
    if (operation === "open") {
      const folder = folderFor(userData);
      fs.mkdirSync(folder, { recursive: true });
      const error = await shell.openPath(folder);
      return { ok: !error, path: folder };
    }
    throw new Error("INVALID_REQUEST");
  });
}

module.exports = { registerElementLocksIpc, readStore, writeStore, folderFor };
