'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync,spawn}=require('node:child_process');
const {createHistoryService}=require('./history.cjs');
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'material-history-test-'));
 const gitExecutable=execFileSync(process.platform==='win32'?'where.exe':'which',['git'],{encoding:'utf8'}).trim().split(/\r?\n/)[0];
 const gitSha256=crypto.createHash('sha256').update(await fs.readFile(gitExecutable)).digest('hex');const key=crypto.randomBytes(32);
 const options={appDataRoot:root,historyRoot:path.join(root,'settings-history'),gitExecutable,gitSha256,credentialStore:{withKey:async fn=>fn(key)},validatePreferences:value=>{if(Object.keys(value).some(k=>!['theme','nextAction'].includes(k))||!['light','dark'].includes(value.theme))throw new Error('INVALID_PREFERENCES');return {...value};},validateSchedule:()=>{throw new Error('INVALID_SCHEDULE');}};
 return {root,key,options,service:createHistoryService(options),dispose:async()=>{key.fill(0);await fs.rm(root,{recursive:true,force:true});}};
}
const snapshot=(theme='light')=>({schemaVersion:1,preferences:{theme,nextAction:'local private text'},schedules:[]});
test('real local history authenticates independently, encrypts, records no-ops and restores append-only',async()=>{
 const f=await fixture();try{
  assert.equal((await f.service.list()).error.code,'HISTORY_NOT_CONFIGURED');
  assert.equal((await f.service.setup('fixture-only-password')).ok,true);
  const first=await f.service.recordSettings({after:snapshot()});assert.equal(first.recorded,true);
  assert.equal((await f.service.recordSettings({before:snapshot(),after:snapshot()})).unchanged,true);
  const second=await f.service.recordSettings({before:snapshot(),after:snapshot('dark')});assert.equal(second.recorded,true);
  assert.deepEqual((await f.service.diff(second.revision)).changedKeys,['theme']);
  await f.service.lock();assert.equal((await f.service.list()).error.code,'HISTORY_LOCKED');
  assert.equal((await f.service.verify('fixture-only-password')).verified,true);assert.equal((await f.service.status()).unlocked,false);
  assert.equal((await f.service.unlock('incorrect')).error.code,'HISTORY_AUTH_FAILED');
  assert.equal((await f.service.unlock('fixture-only-password')).ok,true);
  assert.equal((await f.service.label(first.revision,'A private label')).ok,true);
  let restored;const receipt=await f.service.restore(first.revision,value=>{restored=value;});assert.equal(receipt.recorded,true);assert.equal(restored.preferences.theme,'light');
  const exported=await f.service.exportRedacted();assert.ok(!JSON.stringify(exported).includes('local private text'));assert.ok(!JSON.stringify(exported).includes('A private label'));
  const files=await fs.readdir(path.join(f.options.historyRoot,'repository/events'));for(const file of files){const content=await fs.readFile(path.join(f.options.historyRoot,'repository/events',file),'utf8');assert.ok(!content.includes('local private text'));assert.ok(!content.includes('A private label'));}
  const restarted=createHistoryService(f.options);assert.equal((await restarted.status()).unlocked,false);await restarted.unlock('fixture-only-password');assert.equal((await restarted.list()).revisions.length,3);
  assert.equal((await restarted.setRetention({visibleDays:30})).logicalOnly,true);
 }finally{await f.dispose();}
});
const WORKER=String.raw`
const fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const {createHistoryService}=require(input.module);const key=Buffer.from(input.key,'base64');
const options={...input.options,credentialStore:{withKey:async fn=>fn(key)},validatePreferences:v=>({...v}),validateSchedule:v=>({...v}),onTransition:async phase=>{if(phase===input.stop){process.stdout.write('STOPPED\n');await new Promise(()=>{});}}};
const service=createHistoryService(options);(async()=>{if(input.restore){await service.unlock('fixture-only-password');console.log(JSON.stringify(await service.restore(input.restore,async()=>{})));}else console.log(JSON.stringify(await service.recordSettings({after:{schemaVersion:1,preferences:{theme:input.theme,nextAction:'worker text'},schedules:[]}})));})().catch(()=>{process.exitCode=1});setInterval(()=>{},1000).unref();
`;
function worker(f,extra={}){
 const child=spawn(process.execPath,['-e',WORKER],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,stdout,stderr}));});
 child.stdin.end(JSON.stringify({module:require.resolve('./history.cjs'),options:{appDataRoot:f.root,historyRoot:f.options.historyRoot,gitExecutable:f.options.gitExecutable,gitSha256:f.options.gitSha256},key:f.key.toString('base64'),...extra}));
 return {child,done,stopped:()=>new Promise((resolve,reject)=>{if(stdout.includes('STOPPED'))return resolve();const timer=setTimeout(()=>{child.kill();reject(new Error('WORKER_TIMEOUT'));},15000);child.stdout.on('data',()=>{if(stdout.includes('STOPPED')){clearTimeout(timer);resolve();}});})};
}
test('real concurrent processes serialize local commits without losing either writer',async()=>{
 const f=await fixture();try{await f.service.setup('fixture-only-password');const a=worker(f,{theme:'light'}),b=worker(f,{theme:'dark'});const results=await Promise.all([a.done,b.done]);for(const result of results){assert.equal(result.code,0,result.stderr);assert.equal(JSON.parse(result.stdout).recorded,true);}assert.equal((await f.service.list()).revisions.length,2);}finally{await f.dispose();}
});
test('kernel lock releases after real process termination at restore transaction boundaries',async()=>{
 for(const stop of ['journal-prepared','prepared-committed','applied']){
  const f=await fixture();let child;try{await f.service.setup('fixture-only-password');const first=await f.service.recordSettings({after:snapshot()});const waiting=worker(f,{restore:first.revision,stop});child=waiting.child;await waiting.stopped();child.kill();await waiting.done;const restarted=createHistoryService(f.options);assert.equal((await restarted.status()).recoveryPending,true,stop);await restarted.unlock('fixture-only-password');assert.equal((await restarted.recover('retry',async()=>{})).recovered,true,stop);assert.equal((await restarted.status()).recoveryPending,false);}finally{child?.kill();await f.dispose();}
 }
});
test('unknown snapshot fields, key loss and Git tampering never claim recording',async()=>{
 const f=await fixture();try{
  await f.service.setup('fixture-only-password');
  const unknown=snapshot();unknown.preferences.personalVocabulary={entries:{}};
  assert.equal((await f.service.recordSettings({after:unknown})).recorded,false);
  const bad=createHistoryService({...f.options,gitSha256:'0'.repeat(64)});const failed=await bad.recordSettings({after:snapshot()});assert.equal(failed.recorded,false);assert.equal(failed.warning,'HISTORY_GIT_MISMATCH');
  const lost=createHistoryService({...f.options,credentialStore:{withKey:async()=>{throw new Error('HISTORY_KEY_MISSING');}}});assert.equal((await lost.unlock('fixture-only-password')).error.code,'HISTORY_KEY_MISSING');
  assert.equal((await f.service.recordSettings({after:snapshot(),protectedMutation:true})).warning,'PROTECTED_TRANSACTION_REQUIRED');
 }finally{await f.dispose();}
});
test('interrupted restore remains pending across restart and requires deliberate recovery',async()=>{
 const f=await fixture();try{
  await f.service.setup('fixture-only-password');const first=await f.service.recordSettings({after:snapshot()});
  const failed=await f.service.restore(first.revision,()=>{throw new Error('simulated apply interruption');});assert.equal(failed.error.code,'HISTORY_RECOVERY_REQUIRED');
  const restarted=createHistoryService(f.options);assert.equal((await restarted.status()).recoveryPending,true);
  assert.equal((await restarted.recover('retry',()=>{})).error.code,'HISTORY_LOCKED');await restarted.unlock('fixture-only-password');
  let restored;assert.equal((await restarted.recover('retry',value=>{restored=value;})).recovered,true);assert.equal(restored.preferences.theme,'light');assert.equal((await restarted.status()).recoveryPending,false);
 }finally{await f.dispose();}
});
