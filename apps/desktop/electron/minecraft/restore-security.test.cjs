const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { localFs } = require('./hostfs.cjs');
const { backup, restore } = require('./content.cjs');
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mb-restore-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return { root, files:localFs(root) };
}
test('root aliases and forged manifest roots are rejected before removal',async t=>{
 const {root,files}=fixture(t);fs.mkdirSync(path.join(root,'world'));fs.writeFileSync(path.join(root,'world','level.dat'),'original');
 const b=await backup(files,'world');
 for(const alias of ['.','./','world/..','world/../','']) await assert.rejects(files.remove(alias),/PATH_OUTSIDE_SERVER/);
 for(const worlds of [['.'],['world/..'],['world','world'],['unrelated']]) {
  const meta=JSON.parse(await files.readText(`${b.folder}/backup.json`));meta.worlds=worlds;await files.writeText(`${b.folder}/backup.json`,JSON.stringify(meta));
  await assert.rejects(restore(files,b.folder,'world'),/BACKUP_DAMAGED/);
  assert.equal(fs.readFileSync(path.join(root,'world','level.dat'),'utf8'),'original');
 }
});
test('failed staged replacement rolls back every original world',async t=>{
 const {root,files}=fixture(t);
 for(const w of ['world','world_nether']) {fs.mkdirSync(path.join(root,w));fs.writeFileSync(path.join(root,w,'level.dat'),'backup');}
 const b=await backup(files,'world');
 for(const w of ['world','world_nether']) fs.writeFileSync(path.join(root,w,'level.dat'),'current');
 const rename=files.rename;let injected=false;
 files.rename=async(from,to)=>{if(!injected&&from.includes('/new/world_nether')){injected=true;throw new Error('injected promotion failure');}return rename(from,to);};
 await assert.rejects(restore(files,b.folder,'world'),/injected promotion failure/);
 for(const w of ['world','world_nether']) assert.equal(fs.readFileSync(path.join(root,w,'level.dat'),'utf8'),'current');
 assert.equal(fs.readdirSync(root).some(n=>n.startsWith('.restore-')),false);
});
test('verified staged restoration replaces worlds and retains safety backup',async t=>{
 const {root,files}=fixture(t);fs.mkdirSync(path.join(root,'world'));fs.writeFileSync(path.join(root,'world','level.dat'),'backup');
 const b=await backup(files,'world');fs.writeFileSync(path.join(root,'world','level.dat'),'current');
 const result=await restore(files,b.folder,'world');assert.equal(fs.readFileSync(path.join(root,'world','level.dat'),'utf8'),'backup');assert.ok(result.safetyBackup);
});
