const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('real main wiring keeps renderer isolated and denies network, permissions and extra windows',async()=>{
 const handlers={},sessionHandlers={},appHandlers={},state={};const bytes=Buffer.from('<h1>Offline</h1>');
 const manifest={files:[{name:'index.html',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};
 const reader={setPermissionRequestHandler:f=>state.permission=f,setPermissionCheckHandler:f=>state.permissionCheck=f,on:(n,f)=>sessionHandlers[n]=f,webRequest:{onBeforeRequest:f=>state.request=f},protocol:{handle:(scheme,f)=>{state.scheme=scheme;state.serve=f;}}};
 class Window{constructor(options){state.options=options;this.webContents={setWindowOpenHandler:f=>state.open=f,on:(n,f)=>handlers[n]=f};}loadURL(url){state.url=url;return Promise.resolve();}show(){state.shown=true;}}
 const app={setName(){},commandLine:{getSwitchValue:()=>'',removeSwitch(){},hasSwitch:()=>false,appendSwitch(){}},whenReady:()=>Promise.resolve(),on:(n,f)=>appHandlers[n]=f,quit(){state.quit=true;},exit(code){state.exit=code;}};
 const fakeFs={readFile:async p=>p.endsWith('bundle-manifest.json')?JSON.stringify(manifest):bytes};
 const imports={'electron':{app,BrowserWindow:Window,session:{fromPartition:()=>reader},protocol:{registerSchemesAsPrivileged:s=>state.schemes=s},Menu:{setApplicationMenu(){}}},'node:fs/promises':fakeFs,'./policy.cjs':require('../policy.cjs')};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),{require:n=>imports[n]||require(n),__dirname:path.join(__dirname,'..'),Response,console});
 await new Promise(r=>setImmediate(r));
 assert.equal(state.shown,true);assert.equal(state.options.webPreferences.sandbox,true);assert.equal(state.options.webPreferences.contextIsolation,true);assert.equal(state.options.webPreferences.nodeIntegration,false);assert.equal(state.options.webPreferences.preload,undefined);
 assert.equal(state.permissionCheck(),false);state.permission(null,'camera',value=>assert.equal(value,false));assert.equal(state.open().action,'deny');
 for(const url of ['https://example.test/','file:///C:/sensitive','ftp://example.test/file'])state.request({url},result=>assert.equal(result.cancel,true));
 state.request({url:'handbook://local/index.html'},result=>assert.equal(result.cancel,false));
 let prevented=0;handlers['will-frame-navigate']({url:'https://example.test/',preventDefault(){prevented++;}});assert.equal(prevented,1);handlers['will-frame-navigate']({url:'handbook://local/index.html#/home',preventDefault(){prevented++;}});assert.equal(prevented,1);
 handlers['will-navigate']({preventDefault(){prevented++;}},'file:///C:/sensitive');assert.equal(prevented,2);
 assert.equal((await state.serve({method:'GET',url:'handbook://local/index.html'})).status,200);assert.equal((await state.serve({method:'POST',url:'handbook://local/index.html'})).status,404);
 sessionHandlers['will-download']({preventDefault(){prevented++;}});assert.equal(prevented,3);appHandlers['window-all-closed']();assert.equal(state.quit,true);
});
