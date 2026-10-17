const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hosting', Object.freeze({
  check: () => ipcRenderer.invoke('setup:check'), browse: () => ipcRenderer.invoke('setup:browse'),
  start: input => ipcRenderer.invoke('setup:start', input), cancel: () => ipcRenderer.invoke('setup:cancel'),
  open: () => ipcRenderer.invoke('setup:open'),
  progress: callback => { const handler = (_event, state) => callback(state); ipcRenderer.on('setup:progress', handler); return () => ipcRenderer.removeListener('setup:progress', handler); }
}));
