const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {Writable}=require('node:stream');
const {EventEmitter}=require('node:events');
const converter=require('./converter.cjs');
const {createOllamaService}=require('./ollama.cjs');
function tmp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mb-activation-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
test('exclusive-copy fallback preserves a concurrently created destination',t=>{
 const dir=tmp(t);const original=fs.linkSync;let once=true;
 fs.linkSync=(from,to)=>{if(once){once=false;fs.writeFileSync(to,'other work');}throw Object.assign(new Error('no hard links'),{code:'ENOTSUP'});};
 try{const out=converter.placeAtomically(dir,'result','json',Buffer.from('new'));assert.equal(fs.readFileSync(path.join(dir,'result.json'),'utf8'),'other work');assert.equal(fs.readFileSync(out,'utf8'),'new');assert.notEqual(out,path.join(dir,'result.json'));}finally{fs.linkSync=original;}
});
test('conversion queue rejects capacity overflow atomically',async t=>{
 const dir=tmp(t),input=path.join(dir,'input.json');fs.writeFileSync(input,'{}');const c=converter.createConverter();c.setOutputFolder(dir);
 c.enqueue(Array.from({length:100},()=>({path:input})));c.enqueue(Array.from({length:100},()=>({path:input})));
 assert.throws(()=>c.enqueue([{path:input}]),/QUEUE_FULL/);assert.equal(c.snapshot().jobs.length,200);
 for(const j of c.snapshot().jobs)c.cancel(j.id);await c.idle();
});
test('installer stream write errors reject without crashing or hanging',async t=>{
 const dir=tmp(t);const service=createOllamaService({userData:dir,fetchImpl:async()=>new Response('bytes')});service.state.installer={url:'https://example.invalid/',size:5,sha256:null};
 const original=fs.createWriteStream;fs.createWriteStream=()=>new Writable({write(chunk,encoding,done){done(Object.assign(new Error('disk full'),{code:'ENOSPC'}));}});
 try{await assert.rejects(service.handle('installer.download',{}),/disk full/);assert.equal(service.state.download,null);}finally{fs.createWriteStream=original;}
});
test('installer remains unavailable without native publisher admission',async t=>{
 const dir=tmp(t),file=path.join(dir,'installer.exe'),bytes=Buffer.from('fixture');fs.writeFileSync(file,bytes);
 const service=createOllamaService({userData:dir,spawnImpl:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Object.assign(new Error('launch failed'),{code:'ENOENT'})));return child;}});
 service.state.installer={file,size:bytes.length,actualSha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 await assert.rejects(service.handle('installer.run',{confirmed:true}),/INSTALLER_ADMISSION_INCOMPLETE/);
});
test('all local API routes prohibit redirects including chat payloads',async t=>{
 const requests=[];const service=createOllamaService({userData:tmp(t),fetchImpl:async(url,init)=>{requests.push({url,init});if(url.endsWith('/api/chat'))return new Response('{"done":true}\n');if(url.endsWith('/api/pull'))return new Response('{"status":"success"}\n');return new Response('{"version":"1"}');}});
 await service.handle('status',{});await service.handle('delete',{name:'model',confirmed:true});service.handle('queue.add',{name:'model'});await service.handle('queue.start',{});await service.handle('chat.send',{chatId:'chat',model:'model',messages:[{role:'user',content:'local message'}]});
 while(service.state.running||service.state.chats.size)await new Promise(r=>setImmediate(r));
 assert.ok(requests.some(r=>r.url.endsWith('/api/chat')));for(const request of requests)assert.equal(request.init.redirect,'error');
});

test('runtime start reports spawn errors instead of claiming launch',async t=>{
 const dir=tmp(t),exe=path.join(dir,'Programs','Ollama','ollama.exe');fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'fixture');
 const service=createOllamaService({userData:dir,platform:'win32',env:{LOCALAPPDATA:dir},fetchImpl:async()=>{throw Object.assign(new Error('fetch failed'),{code:'ECONNREFUSED'});},spawnImpl:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',new Error('launch failed')));return child;}});
 await assert.rejects(service.handle('start',{}),/launch failed/);
});
