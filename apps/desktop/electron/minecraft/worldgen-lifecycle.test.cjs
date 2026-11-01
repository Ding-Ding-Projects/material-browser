const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');const zip=require('./zip.cjs');
function tmp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mb-wg-life-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function load(){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'worldgen.cjs'),'utf8'),{module,Buffer,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,require:n=>n==='./targets.cjs'?{portFree:async()=>true}:require(n.startsWith('./')?path.join(__dirname,n):n)});return module.exports;}
function catalogue(){return {supported:true,capabilities:{chunkReadiness:{available:true}},flatPresets:[],structureSets:[],presets:['minecraft:normal'],blocks:['minecraft:stone','minecraft:water'],biomes:['minecraft:plains'],gameRules:[],noise:{sea_level:63,default_block:'minecraft:stone',default_fluid:'minecraft:water',aquifers_enabled:true,ore_veins_enabled:true,disable_mob_generation:false},dimension:{min_y:-64,height:384,logical_height:384},packFormat:61,raw:{jarNoise:()=>({noise:{}}),overworldType:{}}};}
function fakeChild(){const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();c.stdin.end=()=>{};c.kill=()=>assert.fail('must not force kill');return c;}
for(const stage of ['startup','batch','save','exit'])test(`cancellation interrupts ${stage} and gracefully awaits owned exit`,async t=>{
 const w=load(),root=tmp(t),jar=path.join(root,'server.jar');fs.writeFileSync(jar,'fixture');const controller=new AbortController();let owned,child,stops=0;
 const spawn=(exe,args,opts)=>{child=fakeChild();const say=line=>setImmediate(()=>child.stdout.emit('data',Buffer.from(`${line}\n`)));child.stdin.write=text=>{const line=text.trim();if(line==='stop'){stops++;if(stage==='exit'&&stops===1){controller.abort();setImmediate(()=>child.emit('exit',0));return;}setImmediate(()=>child.emit('exit',0));}else if(line.startsWith('forceload add')&&stage==='batch')controller.abort();else if(line.includes('run say MBGEN-'))say('[12:34:56] [Server thread/INFO]: [Server] '+line.split('run say ')[1]);else if(line==='save-all flush'){if(stage==='save')controller.abort();else say('Saved the game');}};setImmediate(()=>stage==='startup'?controller.abort():say('Done (1s)'));return child;};
 const c=catalogue(),options={...w.defaults(c),area:{width:1,depth:1,centerX:0,centerZ:0},output:{kind:'folder',destination:path.join(root,'out')}};
 await assert.rejects(w.generate({options,catalogue:c,jarPath:jar,stagingRoot:root,eulaAccepted:true,signal:controller.signal,deps:{spawn,portFree:async()=>true,pollMs:1,startTimeout:100,batchTimeout:100,saveTimeout:100,stopTimeout:20,onOwned:r=>owned=r}}),/CANCELLED/);assert.equal(owned.active,false);assert.ok(stops>=1);assert.equal(fs.existsSync(options.output.destination),false);
});
test('launch error rejects through owned state without unhandled error',async t=>{
 const w=load(),root=tmp(t),jar=path.join(root,'server.jar');fs.writeFileSync(jar,'fixture');const c=catalogue();let owned;
 await assert.rejects(w.generate({options:{...w.defaults(c),output:{kind:'folder',destination:path.join(root,'out')}},catalogue:c,jarPath:jar,stagingRoot:root,eulaAccepted:true,deps:{portFree:async()=>true,spawn:()=>{const child=fakeChild();child.stdin.write=()=>{};setImmediate(()=>child.emit('error',Object.assign(new Error('not found'),{code:'ENOENT'})));return child;},onOwned:r=>owned=r}}),/JAVA_MISSING/);assert.equal(owned.active,false);
});
test('failed graceful stop retains child and staging for later safe retry',async t=>{
 const w=load(),root=tmp(t),jar=path.join(root,'server.jar');fs.writeFileSync(jar,'fixture');const c=catalogue(),controller=new AbortController();let owned,child;
 await assert.rejects(w.generate({options:{...w.defaults(c),output:{kind:'folder',destination:path.join(root,'out')}},catalogue:c,jarPath:jar,stagingRoot:root,eulaAccepted:true,signal:controller.signal,deps:{portFree:async()=>true,stopTimeout:5,spawn:()=>{child=fakeChild();child.stdin.write=()=>{};setImmediate(()=>controller.abort());return child;},onOwned:r=>owned=r}}),/STOP_PENDING/);
 assert.equal(owned.active,true);assert.ok(fs.readdirSync(root).some(n=>n.startsWith('run-')));await assert.rejects(owned.stop(),/STOP_PENDING/);child.emit('exit',0);await owned.stop();assert.equal(owned.active,false);
});
test('report execution uses admitted bytes after the cache path is replaced',async t=>{
 const w=load(),root=tmp(t),source=path.join(root,'jar-src');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'version.json'),'{"id":"1.21.4"}');const jar=path.join(root,'cached.jar');zip.zipFolder(source,jar,'');const bytes=fs.readFileSync(jar),integrity={version:'1.21.4',size:bytes.length,sha1:crypto.createHash('sha1').update(bytes).digest('hex')};fs.writeFileSync(jar,'changed cache');let executed;
 await w.runReports(jar,path.join(root,'reports'),{jarBytes:bytes,jarIntegrity:integrity,spawnImpl:(exe,args)=>{executed=fs.readFileSync(args[args.indexOf('-jar')+1]);const child=fakeChild();setImmediate(()=>child.emit('exit',0));return child;}});assert.deepEqual(executed,bytes);
});
function loadService(root,{gate=Promise.resolve(),generate}={}) {
 const module={exports:{}},bytes=Buffer.from('1.21.4');fs.mkdirSync(path.join(root,'jars'),{recursive:true});fs.writeFileSync(path.join(root,'jars','1.21.4.jar'),bytes);
 const fail=code=>Object.assign(new Error(code),{code});
 const catalogueApi={javaCatalogue:async()=>{await gate;return {versions:[{id:'1.21.4'}]};},javaVersionDetail:async()=>({id:'1.21.4',server:{size:bytes.length,sha1:crypto.createHash('sha1').update(bytes).digest('hex')}})};
 const worldgen={verifyJarIdentity:()=>{},runReports:async()=>{},catalogueFrom:()=>({supported:true}),validate:o=>o,planBatches:()=>[],generate:generate||(()=>Promise.resolve({}))};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../worldgen-ipc.cjs'),'utf8'),{module,Buffer,AbortController,fetch,setTimeout,clearTimeout,require:n=>n==='./minecraft/catalogue.cjs'?catalogueApi:n==='./minecraft/worldgen.cjs'?worldgen:n==='./minecraft/util.cjs'?{fail}:require(n)});
 return module.exports.createWorldgenService({root,deps:{stopTimeout:5,disposeTimeout:30}});
}
test('start reserves before catalogue awaits; disposal cancels admitted acquisition',async t=>{
 const root=tmp(t);let release,generated=0;const gate=new Promise(r=>release=r);const service=loadService(root,{gate,generate:async()=>{generated++;}});const first=service.handle('start',{version:'1.21.4',options:{area:{}},eulaAccepted:true});
 await new Promise(r=>setImmediate(r));await assert.rejects(service.handle('start',{version:'1.21.4',options:{area:{}},eulaAccepted:true}),/ALREADY_GENERATING/);
 const disposed=service.dispose();release();await assert.rejects(first,/CANCELLED/);await disposed;assert.equal(generated,0);assert.equal(service.active,false);
});
test('service disposal retains timed-out ownership and succeeds on later retry',async t=>{
 const w=load(),root=tmp(t);let child,receipt;const service=loadService(root,{generate:({signal,deps})=>{child=fakeChild();child.stdin.write=()=>{};receipt=w.ownChild(child,{server:true,stopTimeout:5,onOwned:deps.onOwned});return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancelled'),{code:'CANCELLED'})),{once:true}));}});
 await service.handle('start',{version:'1.21.4',options:{area:{}},eulaAccepted:true});await assert.rejects(service.dispose(),/STOP_PENDING/);assert.equal(service.active,true);assert.equal(receipt.active,true);await assert.rejects(service.handle('start',{}),/SHUTDOWN_PENDING/);child.emit('exit',0);await service.dispose();assert.equal(service.active,false);
});
test('canceled report generation retains its owned JVM until exit',async t=>{
 const w=load(),root=tmp(t),jar=path.join(root,'fixture.jar');fs.writeFileSync(jar,'fixture');const controller=new AbortController();let child,owned;
 await assert.rejects(w.runReports(jar,path.join(root,'reports'),{signal:controller.signal,stopTimeout:5,onOwned:r=>owned=r,spawnImpl:()=>{child=fakeChild();setImmediate(()=>controller.abort());return child;}}),/STOP_PENDING/);
 assert.equal(owned.active,true);assert.ok(fs.readdirSync(path.join(root,'reports')).some(n=>n.startsWith('.runtime-')));child.emit('exit',0);await owned.stop();await new Promise(r=>setImmediate(r));assert.equal(owned.active,false);assert.equal(fs.readdirSync(path.join(root,'reports')).some(n=>n.startsWith('.runtime-')),false);
});
test('a post-spawn child error never releases a still-running process',async()=>{
 const w=load(),child=fakeChild();child.stdin.write=()=>{};const owned=w.ownChild(child,{server:true,stopTimeout:5});child.emit('spawn');child.emit('error',new Error('later IPC error'));assert.equal(owned.active,true);child.emit('exit',0);await owned.stop();assert.equal(owned.active,false);
});
