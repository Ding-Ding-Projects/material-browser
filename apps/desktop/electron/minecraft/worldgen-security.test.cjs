const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const zip=require('./zip.cjs');
const fail=code=>Object.assign(new Error(code),{code});
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mb-world-security-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function loadWorldgen(){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'worldgen.cjs'),'utf8'),{module,Buffer,require:n=>n==='./targets.cjs'?{portFree:async()=>true}:require(n.startsWith('./')?path.join(__dirname,n):n)});return module.exports;}
function service(root,expected,observed={}){const module={exports:{}};const source=fs.readFileSync(path.join(__dirname,'../worldgen-ipc.cjs'),'utf8');const fakeCatalogue={javaCatalogue:async()=>({versions:[{id:'1.21.4'}]}),javaVersionDetail:async()=>({id:'1.21.4',server:{sha1:crypto.createHash('sha1').update(expected).digest('hex'),size:expected.length}})};const worldgen={verifyJarIdentity(bytes,version){if(bytes.toString()!==version)throw fail('JAR_VERSION_MISMATCH');},runReports:async()=>{observed.executed=true;},catalogueFrom:()=>({supported:false,version:'1.21.4'}),defaults:()=>({})};vm.runInNewContext(source,{module,Buffer,AbortController,fetch,require:n=>n==='./minecraft/catalogue.cjs'?fakeCatalogue:n==='./minecraft/worldgen.cjs'?worldgen:n==='./minecraft/util.cjs'?{fail}:require(n)});return module.exports.createWorldgenService({root});}
test('cached execution rejects changed bytes, size, version and shared links',async t=>{
 const root=temp(t);fs.mkdirSync(path.join(root,'jars'));const file=path.join(root,'jars','1.21.4.jar');
 for(const [bytes,expected] of [['tampered','1.21.4'],['1.20.1','1.20.1']]){fs.writeFileSync(file,bytes);const observed={};await assert.rejects(service(root,Buffer.from(expected),observed).handle('catalogue',{version:'1.21.4'}));assert.equal(observed.executed,undefined);}
 fs.writeFileSync(file,'1.21.4');fs.linkSync(file,path.join(root,'shared'));await assert.rejects(service(root,Buffer.from('1.21.4')).handle('catalogue',{version:'1.21.4'}));
});
test('ZIP creation preserves legacy temporary sentinels and existing destinations',t=>{
 const root=temp(t),folder=path.join(root,'world'),dest=path.join(root,'out.zip');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'data'),'world');const sentinel=`${dest}.${process.pid}.part`;fs.writeFileSync(sentinel,'keep');zip.zipFolder(folder,dest,'world');assert.equal(fs.readFileSync(sentinel,'utf8'),'keep');const before=fs.readFileSync(dest);assert.throws(()=>zip.zipFolder(folder,dest,'world'),/DESTINATION_EXISTS/);assert.deepEqual(fs.readFileSync(dest),before);
});
test('readiness probes choose a Y inside every supported dimension',()=>{
 const w=loadWorldgen();for(const dimension of [{min_y:16,height:64},{min_y:-64,height:384},{min_y:-128,height:64}]){const y=w.probeY(dimension);assert.ok(y>=dimension.min_y&&y<dimension.min_y+dimension.height);}
});
test('valid cached bytes are checked again after catalogue memoization',async t=>{
 const root=temp(t);fs.mkdirSync(path.join(root,'jars'));const file=path.join(root,'jars','1.21.4.jar');fs.writeFileSync(file,'1.21.4');const s=service(root,Buffer.from('1.21.4'));await s.handle('catalogue',{version:'1.21.4'});fs.writeFileSync(file,'1.20.1');await assert.rejects(s.handle('catalogue',{version:'1.21.4'}),/JAR_INTEGRITY_FAILED/);
});
test('real jar version identity rejects another version before execution',t=>{
 const root=temp(t),source=path.join(root,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'version.json'),JSON.stringify({id:'1.21.4'}));const file=path.join(root,'server.jar');zip.zipFolder(source,file,'');const w=loadWorldgen();w.verifyJarIdentity(fs.readFileSync(file),'1.21.4');assert.throws(()=>w.verifyJarIdentity(fs.readFileSync(file),'1.20.1'),/JAR_VERSION_MISMATCH/);
});
test('ZIP creation preserves a shared legacy temporary sentinel and racing destination',t=>{
 const root=temp(t),folder=path.join(root,'world'),dest=path.join(root,'out.zip'),protectedFile=path.join(root,'keep');fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'data'),'world');fs.writeFileSync(protectedFile,'keep');fs.linkSync(protectedFile,`${dest}.${process.pid}.part`);
 const original=fs.linkSync;fs.linkSync=(from,to)=>{fs.writeFileSync(to,'racing output');return original(from,to);};
 try{assert.throws(()=>zip.zipFolder(folder,dest,'world'),/EEXIST/);}finally{fs.linkSync=original;}
 assert.equal(fs.readFileSync(protectedFile,'utf8'),'keep');assert.equal(fs.readFileSync(dest,'utf8'),'racing output');assert.deepEqual(fs.readdirSync(root).filter(n=>n.endsWith('.part')),[`out.zip.${process.pid}.part`]);
});
