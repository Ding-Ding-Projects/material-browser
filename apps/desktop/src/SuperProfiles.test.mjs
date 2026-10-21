import test from 'node:test';
import assert from 'node:assert/strict';
import { readSuperProfileDraft, superProfileResumeMetadata, switchSuperProfileBackend, persistSuperProfileConfiguration, finishSuperProfileMutation, superSessionPresentation } from './SuperProfiles.model.mjs';
const draft={name:'Work',engine:'chromium',settings:{backend:'wsl2',launchMode:'browser',rootfsPath:'C:\\approved.tar'},step:2};
test('window draft resumes configuration and bounds the current step',()=>{
 assert.deepEqual(readSuperProfileDraft(JSON.stringify(draft)),draft);
 assert.equal(readSuperProfileDraft(JSON.stringify({...draft,step:999})).step,3);
});
test('malformed saved fields cannot reach wizard array rendering',()=>{
 for(const value of [null,{}, {...draft,settings:{...draft.settings,installers:'not an array'}}, {...draft,settings:{...draft.settings,rootfsPath:4}}, {...draft,settings:{backend:'unknown'}}]) assert.throws(()=>readSuperProfileDraft(JSON.stringify(value)));
 assert.throws(()=>readSuperProfileDraft('x'.repeat(65537)));
});

test('persistent resume metadata excludes guest paths and commands',()=>{
 const value=superProfileResumeMetadata({...draft,settings:{...draft.settings,setupCommands:['private command'],rootfsSha256:'hash',workspacePath:'private path'}});
 assert.deepEqual(Object.keys(value.settings).sort(),['backend','launchMode']);
 assert.equal(readSuperProfileDraft(JSON.stringify(value)).step,2);
});

test('backend changes keep independent settings and flatten only the selected configuration',()=>{
 const wsl={backend:'wsl2',launchMode:'desktop',engine:'firefox',rootfsPath:'C:/linux.tar',setupCommands:['apt-get update']};
 const sandbox=switchSuperProfileBackend(wsl,'windows-sandbox');
 assert.equal(sandbox.launchMode,'browser');
 assert.equal(sandbox.rootfsPath,undefined);
 sandbox.networking=false;
 const back=switchSuperProfileBackend(sandbox,'wsl2');
 assert.equal(back.rootfsPath,wsl.rootfsPath);
 assert.equal(back.engine,'firefox');
 assert.equal(sandbox.engine,undefined);
 assert.equal(back.networking,undefined);
 const persisted=persistSuperProfileConfiguration(back);
 assert.equal(persisted.configurations['windows-sandbox'].networking,false);
 assert.deepEqual(persisted.configurations.wsl2.setupCommands,['apt-get update']);
 assert.throws(()=>switchSuperProfileBackend(back,'other'));
});

test('invalid inactive backend draft is rejected before switching',()=>{
 assert.throws(()=>readSuperProfileDraft(JSON.stringify({...draft,settings:{...draft.settings,configurations:{'windows-sandbox':{launchMode:'browser',installers:'invalid'}}}})));
 const persisted=persistSuperProfileConfiguration({...draft.settings,workspacePath:''});
 assert.equal(Object.hasOwn(persisted,'workspacePath'),false);
});

test('a failed refresh cannot turn an acknowledged save into a failed save',async()=>{
 const message=await finishSuperProfileMutation({kind:'save',result:{saved:true,cleanupPending:true},clearSelection:()=>{},refresh:async()=>{throw Error('offline')}});
 assert.equal(message,'Data saved. Cleanup is incomplete; retry Discard and close.');
});
test('deletion clears the selected revision owner before reloading',async()=>{
 let selected='deleted';
 const message=await finishSuperProfileMutation({kind:'remove',clearSelection:()=>{selected=''},refresh:async()=>{assert.equal(selected,'');throw Error('offline')}});
 assert.equal(message,'Action completed. The view could not refresh; retry Refresh.');
});
test('stale running observations cannot enable save before a confirmed stop',()=>{
 for(const health of [undefined,{status:'unknown'},{status:'exited'}]) {
  const view=superSessionPresentation({state:'running',health});
  assert.equal(view.canSave,false);
  assert.equal(view.canStop,true);
 }
 assert.equal(superSessionPresentation({state:'running',health:{status:'ready'}}).canSave,true);
 assert.equal(superSessionPresentation({state:'stopped',health:{status:'unknown'}}).canSave,true);
});
test('retained sessions expose recovery actions without treating output as saved',()=>{
 for(const state of ['recovery-required','disposed-unexported']) {
  const view=superSessionPresentation({state,health:{status:'ready',detail:'unexpected private path'}});
  assert.equal(view.retained,true);
  assert.equal(view.canSave,false);
  assert.equal(view.canStop,true);
  assert.equal(view.canDiscard,true);
  assert.equal(view.healthDetail,'Observation state is unavailable');
 }
});
