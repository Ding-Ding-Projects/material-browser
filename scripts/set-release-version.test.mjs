import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setReleaseVersion } from './set-release-version.mjs';

test('version stamping preserves dependency locks and refuses invalid or incomplete inputs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'material-version-'));
  try {
    for (const app of ['desktop', 'docs-companion']) {
      const directory = path.join(root, 'apps', app);
      await mkdir(directory, { recursive: true });
      for (const name of ['package.json', 'package-lock.json']) {
        await writeFile(path.join(directory, name), JSON.stringify({ name: app, version: '0.1.0',
          packages: { '': { version: '0.1.0' }, 'node_modules/example': { version: '7.2.3', integrity: 'fixture' } } }));
      }
    }
    await setReleaseVersion(root, '0.1.8');
    const target = path.join(root, 'apps/desktop/package-lock.json');
    const result = JSON.parse(await readFile(target, 'utf8'));
    assert.equal(result.version, '0.1.8');
    assert.equal(result.packages[''].version, '0.1.8');
    assert.deepEqual(result.packages['node_modules/example'], { version: '7.2.3', integrity: 'fixture' });
    for (const bad of ['', '0.1.01', '0.1.8-preview', '0.1.65536']) {
      await assert.rejects(setReleaseVersion(root, bad));
    }
    const before = await readFile(target, 'utf8');
    await writeFile(path.join(root, 'apps/docs-companion/package-lock.json'), '{}');
    await assert.rejects(setReleaseVersion(root, '0.1.9'));
    assert.equal(await readFile(target, 'utf8'), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
