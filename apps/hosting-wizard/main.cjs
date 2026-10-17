const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
let window, operation = null, verifiedUrl = null;
const root = app.isPackaged ? path.join(process.resourcesPath, 'hosting') : path.resolve(__dirname, '../..');
async function durableHostRoot() {
  const destination = path.join(app.getPath('userData'), 'hosting');
  await fs.mkdir(path.join(destination, 'scripts'), { recursive: true });
  // Only shipped launch resources are refreshed. The host's protected settings and data survive.
  for (const name of ['compose.yaml', 'host.bat', 'scripts/host.ps1']) await fs.copyFile(path.join(root, name), path.join(destination, name));
  return destination;
}
const run = (command, args, timeout = 15000) => new Promise(resolve => {
  const child = spawn(command, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', settled = false;
  const done = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
  const timer = setTimeout(() => { child.kill(); done({ ok: false, reason: 'timeout' }); }, timeout);
  child.stdout.on('data', b => { if (output.length < 4096) output += b.toString(); });
  child.on('error', () => done({ ok: false, reason: 'unavailable' }));
  child.on('close', code => done({ ok: code === 0, version: code === 0 ? output.trim().slice(0, 120) : undefined, reason: code === 0 ? undefined : 'not-ready' }));
});
function authorized(event) { if (!window || event.sender !== window.webContents || !event.senderFrame.url.startsWith('file:')) throw new Error('Invalid sender'); }
app.whenReady().then(() => {
  window = new BrowserWindow({ width: 1100, height: 760, minWidth: 720, minHeight: 600, show: false, title: 'Material Browser Storage Setup', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, 'web/index.html'));
  window.once('ready-to-show', () => window.show());
  window.on('close', event => { if (operation) { event.preventDefault(); window.webContents.send('setup:progress', { state: 'close-blocked' }); } });
});
app.on('window-all-closed', () => app.quit());
ipcMain.handle('setup:check', async event => {
  authorized(event);
  const [docker, compose] = await Promise.all([run('docker', ['info', '--format', '{{.ServerVersion}}']), run('docker', ['compose', 'version', '--short'])]);
  let existing = null;
  try {
    const settingsPath = path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'MaterialBrowser', 'hosting', 'host-settings.json');
    const stat = await fs.lstat(settingsPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error('Invalid settings');
    const value = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    if (Number.isInteger(value.port) && value.port >= 1024 && value.port <= 65535 && typeof value.storageDir === 'string') existing = { port: value.port, storageDirectory: value.storageDir };
  } catch (error) { if (error.code !== 'ENOENT') return { docker, compose, configurationUnreadable: true }; }
  return { docker, compose, existing };
});
ipcMain.handle('setup:browse', async event => { authorized(event); const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'], title: 'Choose encrypted storage directory' }); return result.canceled ? null : result.filePaths[0]; });
ipcMain.handle('setup:start', async (event, input) => {
  authorized(event);
  if (operation) return { ok: false, reason: 'already-running' };
  if (!input || !Number.isInteger(input.port) || input.port < 1024 || input.port > 65535 || typeof input.storageDirectory !== 'string' || !path.isAbsolute(input.storageDirectory) || input.storageDirectory.length > 1000 || typeof input.pairingCode !== 'string' || (input.pairingCode.length > 0 && input.pairingCode.length < 20) || input.pairingCode.length > 256 || /[\r\n\0]/.test(input.pairingCode)) return { ok: false, reason: 'invalid-input' };
  // The host script owns configuration protection, container preservation and health verification.
  const hostingRoot = await durableHostRoot();
  const script = path.join(hostingRoot, 'scripts/host.ps1');
  const source = await fs.readFile(script, 'utf8');
  if (!/JsonSetup/i.test(source)) return { ok: false, reason: 'host-protocol-unavailable' };
  verifiedUrl = null;
  return new Promise(resolve => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-File', script, '-JsonSetup'], { windowsHide: true, shell: false, cwd: hostingRoot, stdio: ['pipe', 'pipe', 'pipe'] });
    operation = child;
    let line = '', cancelled = false, settled = false, terminal = null, discardLine = false;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); operation = null; resolve(result); };
    child.cancel = () => { cancelled = true; child.kill(); };
    const timer = setTimeout(() => { cancelled = true; child.kill(); finish({ ok: false, reason: 'timeout-containers-retained' }); }, 10 * 60 * 1000);
    child.stdout.on('data', bytes => {
      const pieces = bytes.toString().split('\n'), lines = [];
      for (let i = 0; i < pieces.length; i++) {
        if (!discardLine) { line += pieces[i]; if (line.length > 16384) { line = ''; discardLine = true; } }
        if (i < pieces.length - 1) { if (!discardLine) lines.push(line); line = ''; discardLine = false; }
      }
      for (const value of lines) {
        try {
          const message = JSON.parse(value);
          if (message.type === 'progress' && ['validate','runtime','configuration','pull','start','health'].includes(message.stage) && ['running','complete'].includes(message.state)) window?.webContents.send('setup:progress', { stage: message.stage, state: message.state });
          if (message.type === 'result') {
            terminal = { ok: message.ok === true };
            if (terminal.ok && Array.isArray(message.urls)) verifiedUrl = message.urls.find(url => typeof url === 'string' && /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:\d+\/$/.test(url)) || null;
          }
        } catch { /* Unstructured child output never reaches the renderer. */ }
      }
    });
    child.stderr.resume();
    child.on('error', () => finish({ ok: false, reason: 'launch-failed' }));
    child.on('close', code => finish({ ok: code === 0 && terminal?.ok === true && Boolean(verifiedUrl) && !cancelled, reason: cancelled ? 'cancelled-containers-retained' : code !== 0 || !terminal?.ok ? 'setup-failed' : !verifiedUrl ? 'health-unverified' : undefined, url: code === 0 && terminal?.ok && !cancelled ? verifiedUrl : undefined }));
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ port: input.port, storageDir: input.storageDirectory, pairingCode: input.pairingCode, rotatePairingCode: input.rotatePairingCode === true }) + '\n');
    input.pairingCode = '';
  });
});
ipcMain.handle('setup:cancel', event => { authorized(event); operation?.cancel(); return { requested: Boolean(operation) }; });
ipcMain.handle('setup:open', async event => { authorized(event); if (!verifiedUrl) return false; await shell.openExternal(verifiedUrl); return true; });

