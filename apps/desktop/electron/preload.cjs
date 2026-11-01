const { contextBridge, ipcRenderer, webUtils } = require("electron");
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
    minecraft: (operation, params = {}) =>
      ipcRenderer.invoke("material:minecraft", operation, params),
    ollama: (operation, params = {}) =>
      ipcRenderer.invoke("material:ollama", operation, params),
    converter: (operation, params = {}) =>
      ipcRenderer.invoke("material:converter", operation, params),
    pathForFile: (file) => webUtils.getPathForFile(file),
    onEvent: (listener) => {
      const handler = (_event, value) => listener(value);
      ipcRenderer.on("material:event", handler);
      return () => ipcRenderer.removeListener("material:event", handler);
    },
  }),
);
