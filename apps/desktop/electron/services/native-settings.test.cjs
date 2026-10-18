'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const path = require('node:path');
const {listInstalledFonts} = require('./fonts.cjs');
const {discoverEditors, openInEditor} = require('./editors.cjs');
test('real Windows installed font enumeration returns family and style identities', {skip:process.platform !== 'win32'}, async () => {
  const result = await listInstalledFonts();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.fonts.length > 0);
  assert.ok(result.fonts.every(font => font.id && font.family && font.style));
});
test('font command is fixed and provider output is validated', async () => {
  const result = await listInstalledFonts({platform:'win32',execute(exe,args,opts,done) {
    assert.ok(exe.endsWith('powershell.exe')); assert.equal(opts.shell,false); assert.equal(opts.windowsHide,true);
    assert.ok(args.includes('-NonInteractive')); done(null, JSON.stringify([{family:'Fixture Font',style:'Regular'}]));
  }});
  assert.equal(result.fonts[0].family,'Fixture Font');
  assert.equal((await listInstalledFonts({platform:'win32', execute:(e,a,o,cb)=>cb(null,'{}')})).error.code,'INVALID_RESPONSE');
  assert.equal((await listInstalledFonts({platform:'win32',execute:(e,a,o,cb)=>cb({killed:true})})).error.code,'TIMEOUT');
  assert.equal((await listInstalledFonts({timeoutMs:1})).error.code,'INVALID_OPTIONS');
});
const root = path.resolve('native-settings-fixture');
const file = path.join(root,'settings.json');
const exe = path.join(root,'editor.exe');
const io = {realpath:async p => p, stat:async p=>({isFile:()=>true,size:100})};
const options = {platform:'win32',env:{},selectedEditor:exe,io,trustedRequest:true,exportRoot:root,approvedFiles:[{id:'settings',path:file,nonSecret:true,applicationOwned:true}]};
test('discovery checks existing known executables and never launches', async () => {
  const result = await discoverEditors(options);
  assert.equal(result.editors.length,1);
  assert.equal(result.editors[0].id,'selected');
  assert.equal((await discoverEditors({...options,selectedEditor:'https://bad/editor.exe'})).error.code,'INVALID_EDITOR');
  assert.equal((await discoverEditors({...options,selectedEditor:path.join(root,'bad.cmd')})).error.code,'INVALID_EDITOR');
  assert.deepEqual((await discoverEditors({...options,selectedEditor:undefined,env:{},io})).editors,[]);
});
test('opening requires explicit trust, approval, bounded file and resolved containment', async () => {
  assert.equal((await openInEditor({editorId:'selected',fileId:'settings'},{...options,trustedRequest:false})).error.code,'INVALID_REQUEST');
  assert.equal((await openInEditor({editorId:'selected',fileId:'settings',command:'calc'},options)).error.code,'INVALID_REQUEST');
  assert.equal((await openInEditor({editorId:'selected',fileId:'settings'},{...options,approvedFiles:[{id:'settings',path:file,applicationOwned:true,nonSecret:false}]})).error.code,'INVALID_FILE');
  assert.equal((await openInEditor({editorId:'selected',fileId:'settings'},{...options,io:{...io,realpath:async p=>p===file?path.resolve('outside.json'):p}})).error.code,'INVALID_FILE');
  assert.equal((await openInEditor({editorId:'selected',fileId:'settings'},{...options,io:{...io,stat:async()=>({isFile:()=>true,size:1048577})}})).error.code,'INVALID_FILE');
});
test('editor receives only approved file as literal argument and launch failures are bounded', async () => {
  const result = await openInEditor({editorId:'selected',fileId:'settings'},{...options,launch(command,args,opts) {
    assert.equal(command,exe); assert.deepEqual(args,[file]); assert.equal(opts.shell,false);
    const child = new EventEmitter(); child.unref=()=>{}; process.nextTick(()=>child.emit('spawn')); return child;
  }});
  assert.equal(result.state,'launched');
  const timeout = await openInEditor({editorId:'selected',fileId:'settings'},{...options,timeoutMs:50,launch:()=>({once(){},kill(){}})});
  assert.equal(timeout.error.code,'TIMEOUT');
  const failed = await openInEditor({editorId:'selected',fileId:'settings'},{...options,launch:()=>{throw new Error('private details');}});
  assert.equal(failed.error.code,'LAUNCH_FAILED'); assert.ok(!JSON.stringify(failed).includes('private details'));
});
