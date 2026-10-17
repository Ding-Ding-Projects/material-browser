import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { createService, createCiphertextStore } from './service.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t, options={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cipher-storage-'));
 const secret='random-test-pairing-secret-123456789';
 const configFile=path.join(root,'config.json');
 await fs.writeFile(configFile,JSON.stringify({bootstrapHash:sha(secret),allowedHosts:['127.0.0.1:8174']}));
 const server=await createService({root,configFile,maxChunk:1024,quota:4096,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=(url,init={})=>new Promise((resolve,reject)=>{const payload=init.body?Buffer.from(init.body):null;const req=http.request(base+url,{method:init.method||'GET',headers:{Host:'127.0.0.1:8174',...(payload?{'Content-Length':payload.length}:{}),...init.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const data=Buffer.concat(chunks);resolve({status:res.statusCode,headers:{get:key=>Array.isArray(res.headers[key])?res.headers[key][0]:res.headers[key]},json:async()=>JSON.parse(data),arrayBuffer:async()=>data});});});req.on('error',reject);req.end(payload);});
 const pair=await request('/api/pair',{method:'POST',body:JSON.stringify({secret})});assert.equal(pair.status,200);
 const session=await pair.json(),cookie=pair.headers.get('set-cookie').split(';')[0];
 const auth=(url,init={})=>request(url,{...init,headers:{Cookie:cookie,'X-CSRF-Token':session.csrfToken,...init.headers}});
 return {root,request,auth,secret,session};
}
test('ciphertext immutable write, integrity, opaque head CAS and revocation',async t=>{
 const f=await fixture(t),vault='a'.repeat(64),data=Buffer.from('opaque ciphertext'),id=sha(data),url=`/api/vaults/${vault}/chunks/${id}`;
 assert.equal((await f.request(url)).status,401);
 assert.equal((await f.auth(url,{method:'PUT',body:data})).status,201);
 assert.equal(Buffer.from(await (await f.auth(url)).arrayBuffer()).toString(),data.toString());
 assert.equal((await f.auth(url,{method:'PUT',body:Buffer.from('different bytes')})).status,422);
 assert.equal((await f.auth(`/api/vaults/${vault}/revisions/${id}`,{method:'PUT',body:data})).status,201);
 const head=`/api/vaults/${vault}/head`;
 assert.equal((await f.auth(head,{method:'PUT',body:JSON.stringify({revisionId:id,expectedHead:null})})).status,200);
 assert.equal((await f.auth(head,{method:'PUT',body:JSON.stringify({revisionId:id,expectedHead:null})})).status,409);
 assert.equal((await (await f.auth(head)).json()).revisionId,id);
 assert.equal((await f.auth(`/api/sessions/${f.session.id}`,{method:'DELETE'})).status,200);
 assert.equal((await f.auth('/api/stats')).status,401);
});
test('one-use pairing survives restart marker, CSRF and hostile origins rejected',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('/api/pair',{method:'POST',body:JSON.stringify({secret:f.secret})})).status,401);
 assert.equal((await f.auth('/api/logout',{method:'POST',headers:{'X-CSRF-Token':''}})).status,403);
 assert.equal((await f.auth('/api/stats',{headers:{Origin:'http://hostile.invalid'}})).status,403);
 assert.equal((await f.request('/health',{headers:{Host:'attacker.invalid'}})).status,403);
 assert.equal((await fs.readdir(path.join(f.root,'pairing-consumed'))).length,1);
});
test('oversize and wrong digest do not publish or leave temporary objects',async t=>{
 const f=await fixture(t),vault='b'.repeat(64),id='c'.repeat(64),url=`/api/vaults/${vault}/chunks/${id}`;
 assert.equal((await f.auth(url,{method:'PUT',body:Buffer.alloc(1025)})).status,413);
 assert.equal((await f.auth(url,{method:'PUT',body:Buffer.from('wrong')})).status,422);
 assert.equal((await f.auth(url)).status,404);
 assert.deepEqual(await fs.readdir(path.join(f.root,'vaults',vault,'chunks')),[]);
 assert.equal((await (await f.auth('/api/stats')).json()).bytes,0);
});
test('interrupted source removes temporary object; quota and path identifiers fail closed',async t=>{
 const f=await fixture(t),store=await createCiphertextStore(f.root,{maxChunk:1024,quota:8}),vault='d'.repeat(64),bytes=Buffer.from('12345678'),id=sha(bytes);
 async function* interrupted(){yield bytes.subarray(0,4);throw new Error('simulated disconnect');}
 await assert.rejects(store.put(vault,'chunks',id,interrupted(),8),/simulated disconnect/);
 assert.deepEqual(await store.list(vault,'chunks'),[]);
 assert.equal((await store.stats()).bytes,0);
 await store.put(vault,'chunks',id,[bytes],8);
 await assert.rejects(store.put(vault,'chunks',sha('x'),[Buffer.from('x')],1),e=>e.status===507);
 await assert.rejects(store.get('../outside','chunks',id),e=>e.status===400);
 const reopened=await createCiphertextStore(f.root,{maxChunk:1024,quota:8});assert.deepEqual(await reopened.get(vault,'chunks',id),bytes);
});
