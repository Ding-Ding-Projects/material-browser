const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "materialBrowser",
  Object.freeze({
    request: (method, params = {}) =>
      ipcRenderer.invoke("material:request", method, params),
    chooseDirectory: () => ipcRenderer.invoke("material:directory"),
    chooseDatabaseFile: () => ipcRenderer.invoke("material:database-file"),
    settingsService: (operation, params = {}) =>
      ipcRenderer.invoke("material:settings-service", operation, params),
    onEvent: (listener) => {
      const handler = (_event, value) => listener(value);
      ipcRenderer.on("material:event", handler);
      return () => ipcRenderer.removeListener("material:event", handler);
    },
  }),
);
