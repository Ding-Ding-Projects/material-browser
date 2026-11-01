import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInventory, validateChildSurfaces, root } from './check-feature-acceptance.mjs';
const data = JSON.parse(readFileSync(`${root}/docs/features/acceptance/inventory.json`, 'utf8'));
const required = JSON.parse(readFileSync(`${root}/docs/features/acceptance/required-identities.json`, 'utf8'));
test('inventory structural validation does not claim product completion', () => {
  assert.deepEqual(validateInventory(data).errors, []);
  assert.ok(validateInventory(data, required, { requireComplete: true }).errors.length > 0);
});
for (const [name, mutate] of [
  ['missing identity', d => d.features.pop()],
  ['missing surface row', d => d.records.pop()],
  ['duplicate row', d => d.records.push(d.records[0])],
  ['unexplained exclusion', d => { d.records[0].reason = null; }],
  ['unsupported verified claim', d => { const r = d.records.find(x => x.applicability === 'applicable'); r.implementationState = 'verified'; r.missing = []; }],
  ['stale current evidence', d => { const r = d.records.find(x => x.applicability === 'applicable'); r.implementationState = 'verified'; r.missing = []; for (const field of ['source','documentation','localization','persistence','tests']) r[field] = ['build.bat']; r.runtimeEvidence = r.screenshots = [{sourceCommit:'old',artifactSha256:'a'.repeat(64),path:'build.bat',inspected:true,privacy:'reviewed'}]; }],
  ['false completion', d => { d.completed = true; }],
  ['missing source', d => { d.surfaces[0].source = 'absent-file'; }],
]) test(`rejects ${name}, restored baseline passes`, () => {
  const changed = structuredClone(data); mutate(changed);
  assert.ok(validateInventory(changed).errors.length > 0);
  assert.deepEqual(validateInventory(data).errors, []);
});

const children = JSON.parse(readFileSync(`${root}/docs/features/acceptance/child-surfaces.json`, 'utf8'));
const requiredChildren = ['workspace-title','workspace-tabs','profile-list','profile-create','profile-launch','profile-appearance','setup-wizard','super-profile-wizard','synchronization','command-palette','context-menu-primitive','regex-workbench','notification-overlay','accessibility-overlay','attention-controls','unlock-dialog','settings-finder','setting-row','settings-schedules','settings-notifications','settings-history','settings-history-transfer','settings-editors','presentation-effects','settings-presentation-lock','personal-wording-import','server-world-generator'];
test('child discovery retains the reviewed source-backed inventory', () => {
  assert.deepEqual(children.records.map(x => x.id), requiredChildren);
  assert.deepEqual(validateChildSurfaces(children, data), []);
});
for (const [name, change] of [
  ['missing source', d => d.records[0].source = 'absent'],
  ['unknown parent', d => d.records[0].parent = 'absent'],
  ['false runtime claim', d => d.records[0].runtimeState = 'verified'],
  ['empty consumer', d => d.records[0].consumer = ''],
  ['unknown requirement', d => d.records[0].reviewedFeatures = ['absent']],
]) test(`child discovery rejects ${name}`, () => {
  const changed = structuredClone(children); change(changed);
  assert.ok(validateChildSurfaces(changed, data).length > 0);
  assert.deepEqual(validateChildSurfaces(children, data), []);
});


test('current catalogue has 112 identities and world generation remains unfinished', () => {
  assert.equal(required.length, 112);
  assert.equal(data.features.length, 112);
  assert.ok(required.includes('minecraft-world-generator'));
  const generator = data.records.filter(x => x.feature === 'minecraft-world-generator');
  const manager = data.records.filter(x => x.feature === 'minecraft-server-manager');
  assert.equal(generator.length, data.surfaces.length);
  assert.deepEqual(generator.map(x => [x.surface, x.applicability, x.reason]), manager.map(x => [x.surface, x.applicability, x.reason]));
  for (const row of generator.filter(x => x.applicability === 'applicable')) {
    assert.equal(row.implementationState, 'missing');
    assert.ok(row.missing.length > 0);
    for (const field of ['source','documentation','localization','persistence','tests','runtimeEvidence','screenshots']) assert.deepEqual(row[field], []);
  }
});
test('removing the new world-generator identity or child scope fails', () => {
  const changed = structuredClone(data);
  changed.features = changed.features.filter(x => x.id !== 'minecraft-world-generator');
  changed.records = changed.records.filter(x => x.feature !== 'minecraft-world-generator');
  assert.ok(validateInventory(changed).errors.length > 0);
  assert.ok(validateChildSurfaces(children, changed).length > 0);
  assert.deepEqual(validateInventory(data).errors, []);
});
