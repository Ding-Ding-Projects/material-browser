const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "materialBrowser",
  Object.freeze({
    request: (method, params = {}) =>
      ipcRenderer.invoke("material:request", method, params),
    windowAction: (action) => ipcRenderer.invoke("material:window", action),
    chooseDirectory: () => ipcRenderer.invoke("material:directory"),
    chooseDatabaseFile: () => ipcRenderer.invoke("material:database-file"),
    settingsService: (operation, params = {}) =>
      ipcRenderer.invoke("material:settings-service", operation, params),
    elementLocks: (operation, params = {}) =>
      ipcRenderer.invoke("material:element-locks", operation, params),
    onEvent: (listener) => {
      const handler = (_event, value) => listener(value);
      ipcRenderer.on("material:event", handler);
      return () => ipcRenderer.removeListener("material:event", handler);
    },
  }),
);
