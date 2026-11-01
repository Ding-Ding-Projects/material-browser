// Builds apps/desktop/assets/changelog.json from the repository's release history file.
//
// The history file is CHANGELOG.md at the repository root, written in the common
// "Keep a Changelog" shape:
//
//   ## [1.2.0] - 2026-11-01
//   Optional one-line summary.
//   - A change
//   - Another change
//
// When no history file exists, the existing changelog.json is kept and only checked: it
// must contain an entry for the current desktop package version. Nothing is fetched from
// the network and git is not consulted, so the result is the same on every machine.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseChangelog(markdown) {
  const releases = [];
  let current = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/);
    if (heading) {
      if (/^unreleased$/i.test(heading[1])) {
        current = null;
        continue;
      }
      if (!VERSION.test(heading[1])) throw Error(`Release heading has an invalid version: ${heading[1]}`);
      current = { version: heading[1], date: heading[2] ?? null, summary: '', notes: [] };
      releases.push(current);
      continue;
    }
    if (!current || !line.trim() || /^#/.test(line)) continue;
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) current.notes.push(item[1].trim());
    else if (!current.summary && !current.notes.length) current.summary = line.trim();
    else if (current.notes.length) current.notes[current.notes.length - 1] += ` ${line.trim()}`;
  }
  return sortReleases(releases);
}

function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
}

export function sortReleases(releases) {
  const seen = new Set();
  for (const release of releases) {
    if (seen.has(release.version)) throw Error(`Release ${release.version} appears twice.`);
    seen.add(release.version);
  }
  return [...releases].sort((a, b) => compareVersions(a.version, b.version));
}

export function validate(document, currentVersion) {
  if (!document || document.format !== 1 || !Array.isArray(document.releases)) throw Error('changelog.json must have format 1 and a releases array.');
  for (const r of document.releases) {
    if (!VERSION.test(r.version)) throw Error(`Invalid version ${r.version}.`);
    if (r.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw Error(`Invalid date for ${r.version}.`);
    if (typeof r.summary !== 'string' || !Array.isArray(r.notes) || r.notes.some((n) => typeof n !== 'string'))
      throw Error(`Invalid notes for ${r.version}.`);
  }
  if (!document.releases.some((r) => r.version === currentVersion))
    throw Error(`changelog.json has no entry for the current version ${currentVersion}.`);
  return document;
}

export async function buildChangelog(root) {
  const pkg = JSON.parse(await readFile(path.join(root, 'apps/desktop/package.json'), 'utf8'));
  const target = path.join(root, 'apps/desktop/assets/changelog.json');
  const history = path.join(root, 'CHANGELOG.md');
  if (!existsSync(history)) {
    validate(JSON.parse(await readFile(target, 'utf8')), pkg.version);
    return { source: null, target, written: false };
  }
  const document = { format: 1, source: 'CHANGELOG.md', releases: parseChangelog(await readFile(history, 'utf8')) };
  validate(document, pkg.version);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(document, null, 2) + '\n');
  await rename(temporary, target);
  return { source: history, target, written: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = await buildChangelog(root);
  console.log(result.written ? `Changelog written from ${result.source}` : 'No CHANGELOG.md; kept and checked the bundled changelog.json');
}
