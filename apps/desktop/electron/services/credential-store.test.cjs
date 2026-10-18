'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {createCredentialStore}=require('./credential-store.cjs');
test('credential targets are restricted to application-owned namespaces',()=>{
  for(const namespace of ['other-app','primary/../../x','test-bad'])assert.throws(()=>createCredentialStore({namespace}));
});
test('actual application-owned Windows credential roundtrip and callback buffer clearing',{skip:process.platform!=='win32'},async()=>{
  const store=createCredentialStore({namespace:`test-${randomUUID()}`});
  let borrowed;
  try {
    await assert.rejects(store.withKey(()=>{}),/HISTORY_KEY_MISSING/);
    let first;
    await store.withKey(key=>{borrowed=key;first=Buffer.from(key);},{create:true});
    assert.ok(borrowed.every(byte=>byte===0));
    await store.withKey(key=>assert.deepEqual(key,first));first.fill(0);
  } finally {await store.deleteTestKey();}
});
test('unavailable credential vault never returns a key',async()=>{
  await assert.rejects(createCredentialStore({platform:'linux'}).withKey(()=>{}),/UNAVAILABLE/);
  await assert.rejects(createCredentialStore().deleteTestKey(),/INVALID_CREDENTIAL_OPERATION/);
});
test('credential helper uses fixed arguments and protected stdin with bounded failure',async()=>{
  let request, killed=false;
  const store=createCredentialStore({timeoutMs:50,launch(exe,args,options){
    assert.ok(exe.endsWith('powershell.exe'));assert.equal(options.shell,false);assert.equal(options.windowsHide,true);
    assert.equal(options.env,undefined);assert.equal(args.length,5);assert.equal(args.at(-2),'-Command');
    const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();
    child.stdin.on('data',data=>{request=JSON.parse(data.toString());});child.kill=()=>{killed=true;};return child;
  }});
  await assert.rejects(store.withKey(()=>{}),/CREDENTIAL_VAULT_TIMEOUT/);
  assert.equal(killed,true);assert.equal(request.operation,'read');assert.equal(request.target,'MaterialBrowser.SettingsHistory.v1/primary');
});
