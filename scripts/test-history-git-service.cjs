'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHistoryService } = require('../apps/desktop/electron/services/history.cjs');
(async () => {
  const descriptor = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  assert.equal(descriptor.payloadFileCount, 373);
  assert.equal(crypto.createHash('sha256').update(await fs.readFile(descriptor.gitExecutable)).digest('hex'), descriptor.gitSha256);
  const root = path.resolve(__dirname, '../.cache/history-git-service-test', crypto.randomUUID());
  const key = crypto.randomBytes(32);
  const options = { appDataRoot: root, historyRoot: path.join(root, 'settings-history'),
    gitExecutable: descriptor.gitExecutable, gitSha256: descriptor.gitSha256,
    credentialStore: { withKey: async callback => callback(key) },
    validatePreferences: value => {
      assert.deepEqual(Object.keys(value), ['theme']);
      assert.ok(['light', 'dark'].includes(value.theme));
      return { ...value };
    }, validateSchedule: () => { throw Error('No schedules in this synthetic fixture'); } };
  try {
    const service = createHistoryService(options);
    assert.equal((await service.setup('synthetic-runtime-test-only')).ok, true);
    const first = await service.recordSettings({ after: { schemaVersion: 1, preferences: { theme: 'light' }, schedules: [] } });
    assert.equal(first.recorded, true);
    const second = await service.recordSettings({ before: { schemaVersion: 1, preferences: { theme: 'light' }, schedules: [] },
      after: { schemaVersion: 1, preferences: { theme: 'dark' }, schedules: [] } });
    assert.equal(second.recorded, true);
    await service.lock();
    const restarted = createHistoryService(options);
    assert.equal((await restarted.unlock('synthetic-runtime-test-only')).ok, true);
    assert.equal((await restarted.list()).revisions.length, 2);
    assert.deepEqual((await restarted.diff(second.revision)).changedKeys, ['theme']);
    await restarted.lock();
    console.log('PASS: pinned portable runtime supports real encrypted history records, restart, independent unlock and diff. Temporary credential adapter is test-only; no installed-package proof.');
  } finally { key.fill(0); }
})().catch(() => { console.error('FAIL: pinned portable history service integration.'); process.exitCode = 1; });
