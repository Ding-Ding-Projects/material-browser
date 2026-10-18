import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { EventEmitter } from 'node:events';

function fixture({ argv = [], destroyed = false } = {}) {
  const handlers = new Map();
  let options;
  let dataDirectory;
  let sent = 0;
  const contents = {
    mainFrame: {},
    isDestroyed: () => destroyed,
    send() { if (destroyed) throw new Error('Object has been destroyed'); sent++; },
    setWindowOpenHandler(fn) { this.popup = fn; },
    on() {},
  };
  const host = new EventEmitter();
  host.stdout = new EventEmitter();
  host.stdin = { writable: true, write() {} };
  host.kill = () => {};
  class BrowserWindow {
    constructor(value) { options = value; this.webContents = contents; }
    isDestroyed() { return destroyed; }
    loadFile() {}
  }
  const electron = {
    BrowserWindow,
    app: {
      isPackaged: false,
      getPath: () => dataDirectory || '/test-data',
      setPath: (_key, value) => { dataDirectory = value; },
      whenReady: () => ({ then: fn => fn() }),
      on() {}, quit() {},
    },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  };
  vm.runInNewContext(readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8'), {
    require: name => ({
      electron,
      'node:child_process': { spawn: () => host },
      'node:path': path,
      'node:readline': { createInterface: () => new EventEmitter() },
      'node:crypto': { randomUUID: () => 'request-id' },
    })[name],
    __dirname: '/test', setTimeout, clearTimeout, Buffer,
    process: { resourcesPath: '/test', argv },
  });
  return { handlers, options, contents, host, dataDirectory, sent: () => sent };
}

test('main denies arbitrary methods and untrusted frames before dispatch', () => {
  const { handlers, contents } = fixture();
  const call = handlers.get('material:request');
  assert.throws(() => call({ sender: contents, senderFrame: contents.mainFrame }, 'filesystem.read', {}));
  assert.throws(() => call({ sender: {}, senderFrame: {} }, 'vault.unlock', { password: 'synthetic' }));
  assert.throws(() => call({ sender: contents, senderFrame: {} }, 'profiles.list', {}));
});

test('window has sandbox, isolated context and no Node; popups are denied', () => {
  const { options, contents } = fixture();
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(contents.popup().action, 'deny');
});

test('late host exit never sends into a destroyed window', () => {
  const closed = fixture({ destroyed: true });
  assert.doesNotThrow(() => closed.host.emit('exit', 0));
  assert.equal(closed.sent(), 0);
  const live = fixture();
  live.host.emit('exit', 1);
  assert.equal(live.sent(), 1);
});

test('explicit data directory accepts only one absolute non-root directory', () => {
  const directory = path.resolve('isolated-test-data');
  assert.equal(fixture({ argv: [`--material-data-dir=${directory}`] }).dataDirectory, directory);
  for (const argv of [
    ['--material-data-dir=relative'], ['--material-data-dir='],
    [`--material-data-dir=${path.parse(directory).root}`],
    [`--material-data-dir=${directory}`, `--material-data-dir=${directory}`],
  ]) assert.throws(() => fixture({ argv }), /INVALID_DATA_DIRECTORY/);
});
