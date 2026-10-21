import test from 'node:test';
import assert from 'node:assert/strict';
import { readSuperProfileDraft, superProfileResumeMetadata, switchSuperProfileBackend, persistSuperProfileConfiguration } from './SuperProfiles.model.mjs';
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
 const wsl={backend:'wsl2',launchMode:'desktop',rootfsPath:'C:/linux.tar',setupCommands:['apt-get update']};
 const sandbox=switchSuperProfileBackend(wsl,'windows-sandbox');
 assert.equal(sandbox.launchMode,'browser');
 assert.equal(sandbox.rootfsPath,undefined);
 sandbox.networking=false;
 const back=switchSuperProfileBackend(sandbox,'wsl2');
 assert.equal(back.rootfsPath,wsl.rootfsPath);
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
