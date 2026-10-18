import { readdir, readFile, mkdir, writeFile, cp, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(here, '../..'), source = path.join(root, 'dist/site'), destination = path.join(here, 'dist');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'}).trim();
const inventory = JSON.parse(await readFile(path.join(source, 'inventory.json'), 'utf8'));
if (inventory.source !== revision || !inventory.articles.length) throw Error('Documentation output does not match the current source. Run build.bat -Component DocsCompanion.');
const files=[];
async function walk(directory, prefix='') {
  for (const item of await readdir(directory, {withFileTypes:true})) {
    const full=path.join(directory,item.name), name=prefix+item.name;
    if ((await lstat(full)).isSymbolicLink()) throw Error('Linked offline content is not supported.');
    if (item.isDirectory()) await walk(full,name+'/');
    else { const bytes=await readFile(full); files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}); }
  }
}
await walk(source);files.sort((a,b)=>a.name.localeCompare(b.name));
if (!files.some(f=>f.name==='index.html') || !files.some(f=>f.name==='app.js')) throw Error('Offline entrypoint is missing.');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});await cp(source,path.join(destination,'site'),{recursive:true});
await writeFile(path.join(destination,'bundle-manifest.json'),JSON.stringify({version:1,source:revision,builtAt:new Date().toISOString(),articles:inventory.articles,files},null,2));
for (const file of ['main.cjs','policy.cjs']) execFileSync(process.execPath,['--check',path.join(here,file)],{stdio:'inherit'});
console.log(`Offline handbook staged: ${inventory.articles.length} articles, ${files.length} files, source ${revision}.`);
