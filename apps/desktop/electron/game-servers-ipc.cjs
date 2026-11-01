"use strict";
const { createGameServerService } = require("./services/game-servers/index.cjs");
const actions = new Set([
  "capabilities", "list", "discoverVersions", "resolveVersion", "create", "configure",
  "readConfiguration", "start", "stop", "restart", "command", "logs", "cancel",
  "backup", "restore", "remove", "listBackups", "listContent", "installContent", "removeContent",
]);
function registerGameServersIpc({ ipcMain, app, trusted, createService = createGameServerService }) {
  let service;
  let closing = false;
  const getService = () => service || (service = createService({ dataDir: app.getPath("userData") }));
  ipcMain.handle("material:game-servers", async (event, action, params = {}) => {
    if (!trusted(event) || !actions.has(action) || !params || typeof params !== "object" || Array.isArray(params))
      throw new Error("INVALID_REQUEST");
    let serialized;
    try { serialized = JSON.stringify(params); } catch { throw new Error("INVALID_REQUEST"); }
    if (Buffer.byteLength(serialized) > 256 * 1024) throw new Error("REQUEST_TOO_LARGE");
    if (closing) throw new Error("SHUTDOWN_PENDING");
    try { return await getService().request({ action, params }); }
    catch (error) {
      // Never propagate process output, paths or untrusted upstream messages to the renderer.
      const code = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)
        ? error.code : "SERVER_OPERATION_FAILED";
      throw new Error(code);
    }
  });
  return {
    get active() { return Boolean(service); },
    async dispose() {
      closing = true;
      try { if (service) await service.dispose(); }
      catch (error) { closing = false; throw error; }
    },
  };
}
module.exports = { registerGameServersIpc };
