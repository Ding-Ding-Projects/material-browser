import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(here, '../..');
const { build } = await import('../../storage/web/node_modules/esbuild/lib/main.js');
await build({entryPoints:[path.join(here,'web/src/app.js')],bundle:true,format:'esm',target:'es2022',outfile:path.join(here,'web/app.js'),minify:true});
await copyFile(path.join(root,'apps/storage/web/styles.css'),path.join(here,'web/styles.css'));
for (const file of ['main.cjs','preload.cjs','web/app.js']) {
  const result = spawnSync(process.execPath, ['--check',path.join(here,file)], { stdio:'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const destination = path.join(here,'resources/hosting');
await mkdir(path.join(destination,'scripts'),{recursive:true});
await copyFile(path.join(root,'scripts/host.ps1'),path.join(destination,'scripts/host.ps1'));
await copyFile(path.join(root,'compose.yaml'),path.join(destination,'compose.yaml'));
await copyFile(path.join(root,'host.bat'),path.join(destination,'host.bat'));
const manifest = JSON.parse(await readFile(path.join(here,'package.json'),'utf8'));
await writeFile(path.join(destination,'version.json'),JSON.stringify({version:manifest.version})+'\n');
console.log('Hosting companion sources validated and exact host resources staged. Native setup remains unverified.');
