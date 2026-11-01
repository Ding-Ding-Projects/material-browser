import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(root, 'docs/features/acceptance', name), 'utf8'));
export function validateInventory(data, required = read('required-identities.json'), { requireComplete = false } = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  if (data.schemaVersion !== 1 || !/^[a-f0-9]{7,40}$/.test(data.baseline || '')) fail('Invalid schema or baseline');
  const features = data.features || [], surfaces = data.surfaces || [], records = data.records || [];
  const unique = (items, label) => { if (new Set(items).size !== items.length) fail(`Duplicate ${label}`); };
  unique(features.map(x => x.id), 'feature'); unique(surfaces.map(x => x.id), 'surface');
  const featureIds = new Set(features.map(x => x.id)), surfaceIds = new Set(surfaces.map(x => x.id));
  if (required.length !== featureIds.size || required.some(id => !featureIds.has(id))) fail('Required feature identity mismatch');
  for (const feature of features) if (!feature.requirement?.trim() || !feature.acceptance?.trim()) fail(`Missing requirement: ${feature.id}`);
  for (const surface of surfaces) if (!surface.description?.trim() || !surface.source || !existsSync(path.join(root, surface.source))) fail(`Missing surface source: ${surface.id}`);
  const keys = new Set();
  for (const row of records) {
    const key = `${row.feature}:${row.surface}`;
    if (keys.has(key)) fail(`Duplicate row: ${key}`); keys.add(key);
    if (!featureIds.has(row.feature) || !surfaceIds.has(row.surface)) fail(`Unknown row: ${key}`);
    if (!['applicable','not-applicable'].includes(row.applicability)) fail(`Invalid applicability: ${key}`);
    if (!['not-applicable','not-audited','missing','partial','implemented','verified'].includes(row.implementationState)) fail(`Invalid implementation state: ${key}`);
    const fields = ['source','documentation','localization','persistence','tests','runtimeEvidence','screenshots','missing'];
    for (const field of fields) if (!Array.isArray(row[field])) fail(`Missing evidence array ${field}: ${key}`);
    if (row.applicability === 'not-applicable') {
      if (!row.reason?.trim() || row.implementationState !== 'not-applicable') fail(`Unexplained exclusion: ${key}`);
    } else {
      if (row.reason || row.implementationState === 'not-applicable') fail(`Contradictory applicability: ${key}`);
      if (row.implementationState !== 'verified' && !row.missing?.length) fail(`Unreported gap: ${key}`);
      if (row.implementationState === 'verified') {
        for (const field of fields.filter(x => x !== 'missing')) if (!row[field]?.length) fail(`Unproven verified ${field}: ${key}`);
        if (row.missing?.length) fail(`Verified row has gaps: ${key}`);
        for (const evidence of [...(row.runtimeEvidence || []), ...(row.screenshots || [])]) {
          if (!evidence || typeof evidence !== 'object' || evidence.sourceCommit !== data.baseline ||
              !/^[a-f0-9]{64}$/.test(evidence.artifactSha256 || '') || !evidence.path ||
              path.isAbsolute(evidence.path) || evidence.path.split(/[\\/]/).includes('..') ||
              !existsSync(path.join(root, evidence.path)) || evidence.inspected !== true || evidence.privacy !== 'reviewed') {
            fail(`Unbound or uninspected current evidence: ${key}`);
          }
        }
      }
      if (requireComplete && row.implementationState !== 'verified') fail(`Incomplete: ${key}`);
    }
    for (const entry of row.source || []) if (typeof entry !== 'string' || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..') || !existsSync(path.join(root, entry))) fail(`Invalid source reference: ${key}`);
  }
  for (const feature of featureIds) for (const surface of surfaceIds) if (!keys.has(`${feature}:${surface}`)) fail(`Missing row: ${feature}:${surface}`);
  const unfinished = records.filter(x => x.applicability === 'applicable' && x.implementationState !== 'verified').length;
  if (data.completed !== (unfinished === 0)) fail('Completion claim does not match evidence');
  return { errors, unfinished, rows: records.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateInventory(read('inventory.json'), undefined, { requireComplete: process.argv.includes('--require-complete') });
  console.log(`Acceptance inventory: ${result.rows} rows, ${result.unfinished} unfinished, ${result.errors.length} validation errors`);
  for (const message of result.errors.slice(0, 20)) console.error(message);
  process.exitCode = result.errors.length ? 1 : 0;
}
