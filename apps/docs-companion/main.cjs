'use strict';
const { app, BrowserWindow, session, protocol, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { HOME, assetForUrl, allowsDocument, verificationDirectory } = require('./policy.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'handbook', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Material Browser Handbook');
const verification = app.commandLine.getSwitchValue('verification-data-dir');
if (verification) app.setPath('userData', verificationDirectory(verification, app.getPath('home'), app.getPath('userData')));
// Debugging is opt-in only for an isolated verification profile, never normal reading.
if (!verification) { app.commandLine.removeSwitch('remote-debugging-port'); app.commandLine.removeSwitch('remote-debugging-pipe'); }
if (app.commandLine.hasSwitch('remote-debugging-port')) app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('disable-background-networking');
let window;
app.whenReady().then(async () => {
  const bundle = path.join(__dirname, 'dist', 'site');
  const manifest = JSON.parse(await fs.readFile(path.join(__dirname, 'dist', 'bundle-manifest.json'), 'utf8'));
  const files = new Map();
  for (const entry of manifest.files) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(entry.name) || entry.name.split('/').includes('..')) throw Error('Invalid offline bundle path.');
    const bytes = await fs.readFile(path.join(bundle, entry.name));
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Offline bundle integrity check failed.');
    files.set(entry.name, bytes);
  }
  const readerSession = session.fromPartition('persist:handbook');
  readerSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  readerSession.setPermissionCheckHandler(() => false);
  readerSession.on('will-download', event => event.preventDefault());
  readerSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !assetForUrl(details.url, files) && !details.url.startsWith('data:') }));
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  readerSession.protocol.handle('handbook', request => {
    const name = assetForUrl(request.url, files);
    if (request.method !== 'GET' || !name) return new Response('Not found', { status: 404 });
    return new Response(files.get(name), { headers: { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  });
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({ width: 1280, height: 900, minWidth: 360, minHeight: 500, show: false, title: 'Material Browser Handbook', webPreferences: { session: readerSession, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!allowsDocument(url)) event.preventDefault(); });
  window.webContents.on('will-frame-navigate', event => { if (!allowsDocument(event.url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  await window.loadURL(HOME);
  window.show();
}).catch(() => { console.error('The offline handbook could not start. Verify the portable package and its bundled content.'); app.exit(1); });
app.on('window-all-closed', () => app.quit());
