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

test('portable bookmarks reject unsafe URLs and unknown fields before replacing data',async()=>{
 const {parsePortableBookmarks}=await import('./SuperProfiles.model.mjs');
 const document={version:1,folderName:'Imported',bookmarks:[{name:'Example',url:'https://example.com'}]};
 let previous=parsePortableBookmarks(JSON.stringify(document)).document;
 for(const url of ['javascript:alert(1)','file:///x','https://user:pass@example.com','https://@example.com','https:example.com','https://example.com\\x','https://example.com/\u0085']) {
  assert.throws(()=>{previous=parsePortableBookmarks(JSON.stringify({...document,bookmarks:[{name:'Bad',url}]})).document;});
  assert.deepEqual(previous,document);
 }
 assert.throws(()=>parsePortableBookmarks(JSON.stringify({...document,extra:true})));
 assert.throws(()=>parsePortableBookmarks(JSON.stringify({...document,bookmarks:[{name:'Bad',url:'https://example.com',children:[]}]})));
 assert.throws(()=>parsePortableBookmarks(JSON.stringify({...document,bookmarks:Array(501).fill(document.bookmarks[0])})));
 assert.throws(()=>parsePortableBookmarks(' '.repeat(65537)));
 let node=document.bookmarks[0];for(let i=0;i<8;i++)node={name:'Folder',children:[node]};
 assert.throws(()=>parsePortableBookmarks(JSON.stringify({...document,bookmarks:[node]})));
 assert.deepEqual(parsePortableBookmarks(JSON.stringify({...document,bookmarks:[{name:'Folder',children:document.bookmarks}]})),{document:{...document,bookmarks:[{name:'Folder',children:document.bookmarks}]},count:2,links:1});
});
test('encrypted progress preserves all backend inputs and completion removes draft flags without mutation',async()=>{
 const {superProfileWizardSave}=await import('./SuperProfiles.model.mjs');
 const bookmarks={version:1,folderName:'Imported',bookmarks:[]};
 const input={name:'',engine:'firefox',step:2,settings:{backend:'wsl2',launchMode:'terminal',setupCommands:['echo fixture'],portableBookmarks:bookmarks,configurations:{'windows-sandbox':{launchMode:'browser',workspacePath:'C:/fixture',setupDraft:true,draftStep:1}}}};
 const before=structuredClone(input);
 const progress=superProfileWizardSave(input,true,'Untitled');
 assert.equal(progress.name,'Untitled');assert.equal(progress.settings.setupDraft,true);assert.equal(progress.settings.draftStep,2);
 assert.deepEqual(progress.settings.setupCommands,['echo fixture']);assert.equal(progress.settings.configurations['windows-sandbox'].workspacePath,'C:/fixture');
 const complete=superProfileWizardSave({...input,settings:progress.settings},false,'Untitled');
 assert.equal(complete.settings.setupDraft,undefined);assert.equal(complete.settings.draftStep,undefined);
 for(const config of Object.values(complete.settings.configurations))assert.equal(config.setupDraft,undefined);
 assert.deepEqual(input,before);
 const switched=switchSuperProfileBackend(complete.settings,'windows-sandbox');
 assert.equal(switched.portableBookmarks,undefined);
 assert.deepEqual(switchSuperProfileBackend(switched,'wsl2').portableBookmarks,bookmarks);
 const removed=persistSuperProfileConfiguration({...complete.settings,portableBookmarks:undefined});
 assert.equal(JSON.stringify(removed).includes('portableBookmarks'),false);
});

test('portable bookmark Unicode validation preserves valid pairs and rejects unpaired surrogates',async()=>{
 const {parsePortableBookmarks}=await import('./SuperProfiles.model.mjs');
 const good={version:1,folderName:'Imported 😀',bookmarks:[{name:'Folder 🗂️',children:[{name:'Link 🌐',url:'https://example.com/😀'}]}]};
 assert.deepEqual(parsePortableBookmarks(JSON.stringify(good)).document,good);
 let current=good;
 for(const invalid of ['\ud800','\udfff','\ud800x','x\udfff','\ud800\ud800','\udfff\ud800']) {
  const documents=[{...good,folderName:invalid},{...good,bookmarks:[{name:invalid,children:[]}]},{...good,bookmarks:[{name:invalid,url:'https://example.com'}]},{...good,bookmarks:[{name:'Link',url:'https://example.com/'+invalid}]}];
  for(const document of documents){assert.throws(()=>{current=parsePortableBookmarks(JSON.stringify(document)).document;});assert.equal(current,good);}
 }
});

test('portable bookmark file decoding rejects malformed UTF-8 without replacement',async()=>{
 const {parsePortableBookmarkBytes}=await import('./SuperProfiles.model.mjs');
 const good={version:1,folderName:'Imported 😀',bookmarks:[{name:'Link',url:'https://example.com'}]};
 const encode=text=>new TextEncoder().encode(text);
 assert.deepEqual(parsePortableBookmarkBytes(encode(JSON.stringify(good))).document,good);
 let current=good;
 for(const invalid of [[0xc3,0x28],[0xed,0xa0,0x80],[0xf0,0x9f,0x98],[0xff]]) {
  const prefix=encode('{"version":1,"folderName":"'),suffix=encode('","bookmarks":[]}');
  const bytes=new Uint8Array([...prefix,...invalid,...suffix]);
  assert.throws(()=>{current=parsePortableBookmarkBytes(bytes).document;});assert.equal(current,good);
 }
 assert.throws(()=>parsePortableBookmarkBytes(new Uint8Array(65537)));
});
