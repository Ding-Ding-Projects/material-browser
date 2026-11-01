const test = require('node:test');
const assert = require('node:assert/strict');
const { registerGameServersIpc } = require('./game-servers-ipc.cjs');
function fixture({request = async input => input, dispose = async () => {}} = {}) {
  let handler, creations = 0;
  const lifecycle = registerGameServersIpc({
    ipcMain: { handle(channel, fn) { assert.equal(channel, 'material:game-servers'); handler = fn; } },
    app: { getPath(name) { assert.equal(name, 'userData'); return 'managed-data'; } },
    trusted: event => event === 'trusted',
    createService: ({dataDir}) => { assert.equal(dataDir, 'managed-data'); creations++; return {request,dispose}; },
  });
  return { call: (...args) => handler(...args), lifecycle, creations: () => creations };
}
test('untrusted senders and malformed operations never instantiate a service', async () => {
  const f = fixture();
  for (const args of [['other','list',{}], ['trusted','shell',{}], ['trusted','list',[]], ['trusted','list',null]])
    await assert.rejects(f.call(...args), /INVALID_REQUEST/);
  assert.equal(f.creations(), 0);
});
test('request bounds reject oversized and circular inputs before execution', async () => {
  const f = fixture(); const circular = {}; circular.self = circular;
  await assert.rejects(f.call('trusted','create',{name:'a'.repeat(262145)}), /REQUEST_TOO_LARGE/);
  await assert.rejects(f.call('trusted','create',circular), /INVALID_REQUEST/);
  assert.equal(f.creations(), 0);
});
test('trusted actions use one lazy service and preserve structured parameters', async () => {
  const f = fixture(); assert.equal(f.lifecycle.active, false);
  assert.deepEqual(await f.call('trusted','configure',{id:'server',properties:{motd:'hello'}}),
    {action:'configure',params:{id:'server',properties:{motd:'hello'}}});
  await f.call('trusted','list'); assert.equal(f.creations(), 1); assert.equal(f.lifecycle.active, true);
});
test('upstream messages never cross the bridge', async () => {
  const f = fixture({request: async () => { throw Object.assign(new Error('private path and credential'), {code:'INTEGRITY_FAILED'}); }});
  await assert.rejects(f.call('trusted','start',{}), error => error.message === 'INTEGRITY_FAILED');
  const g = fixture({request: async () => { throw Object.assign(new Error('sensitive'), {code:'bad code sensitive'}); }});
  await assert.rejects(g.call('trusted','start',{}), error => error.message === 'SERVER_OPERATION_FAILED');
});
test('shutdown prevents new operations until a failed stop is retried', async () => {
  let stops = 0;
  const f = fixture({dispose: async () => { if (++stops === 1) throw new Error('STOP_PENDING'); }});
  await f.call('trusted','list');
  await assert.rejects(f.lifecycle.dispose(), /STOP_PENDING/);
  await f.call('trusted','list');
  await f.lifecycle.dispose();
  await assert.rejects(f.call('trusted','start',{}), /SHUTDOWN_PENDING/);
});
