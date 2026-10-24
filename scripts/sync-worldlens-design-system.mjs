#!/usr/bin/env node
/** Verify vendored reference bytes, or explicitly refresh them from the pinned checkout. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'apps/desktop/src/design-system');
const manifest = JSON.parse(await readFile(resolve(target, 'provenance.json'), 'utf8'));
const args = process.argv.slice(2);
const sourceArg = args.indexOf('--source');
const source = sourceArg === -1 ? null : resolve(args[sourceArg + 1] || '');
const write = args.includes('--write');
if (write && !source) throw new Error('--write requires --source <WorldLens checkout>');
if (source) {
  const head = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== manifest.sourceCommit) throw new Error('Reference checkout does not match the pinned commit');
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Verify every source before changing any destination.
const files = await Promise.all(manifest.files.map(async (file) => {
  const bytes = await readFile(resolve(source || target, source ? file.source : file.destination));
  if (digest(bytes) !== file.sha256) throw new Error(`Pinned hash mismatch: ${file.source}`);
  return { file, bytes };
}));
if (write) for (const { file, bytes } of files) await writeFile(resolve(target, file.destination), bytes);
for (const { file } of files) {
  if (digest(await readFile(resolve(target, file.destination))) !== file.sha256)
    throw new Error(`Vendored file differs: ${file.destination}; use --source <checkout> --write to restore pinned bytes`);
}
console.log(`Verified ${files.length} WorldLens files at ${manifest.sourceCommit}`);
