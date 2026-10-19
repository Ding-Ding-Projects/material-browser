import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function setReleaseVersion(root, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
      version.split('.').some(part => Number(part) > 65535)) {
    throw Error('Expected a bounded three-part numeric package version.');
  }
  const updates = [];
  for (const app of ['desktop', 'docs-companion']) {
    for (const filename of ['package.json', 'package-lock.json']) {
      const target = path.join(root, 'apps', app, filename);
      const document = JSON.parse(await readFile(target, 'utf8'));
      if (!document.name || !document.version ||
          (filename === 'package-lock.json' && !document.packages?.[''])) {
        throw Error('Incomplete package version metadata.');
      }
      document.version = version;
      if (filename === 'package-lock.json') document.packages[''].version = version;
      updates.push([target, JSON.stringify(document, null, 2) + '\n']);
    }
  }
  for (const [target, contents] of updates) await writeFile(target, contents);
  return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  console.log(`Package version: ${await setReleaseVersion(root, process.argv[2] ?? '')}`);
}
