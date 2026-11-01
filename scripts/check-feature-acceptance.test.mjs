import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInventory, root } from './check-feature-acceptance.mjs';
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
