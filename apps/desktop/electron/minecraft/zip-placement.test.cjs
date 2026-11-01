const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {zipFolder}=require('./zip.cjs');
test('corrupt owned temporary archive is rejected before any destination placement',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mb-zip-admission-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const source=path.join(root,'world'),destination=path.join(root,'output.zip'),sentinel=path.join(root,'unrelated.part');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'level.dat'),'world data');fs.writeFileSync(sentinel,'retain');
 const open=fs.openSync,close=fs.closeSync,link=fs.linkSync;let ownedFd,ownedPath,placements=0;
 fs.openSync=(file,flags,...args)=>{const fd=open(file,flags,...args);if(flags==='wx'&&String(file).endsWith('.part')){ownedFd=fd;ownedPath=file;}return fd;};
 fs.closeSync=fd=>{close(fd);if(fd===ownedFd){ownedFd=undefined;fs.writeFileSync(ownedPath,Buffer.from('damaged archive'));}};
 fs.linkSync=(...args)=>{placements++;return link(...args);};
 try{assert.throws(()=>zipFolder(source,destination,'world'),/ZIP_MALFORMED/);}finally{fs.openSync=open;fs.closeSync=close;fs.linkSync=link;}
 assert.equal(placements,0);assert.equal(fs.existsSync(destination),false);assert.equal(fs.existsSync(ownedPath),false);assert.equal(fs.readFileSync(sentinel,'utf8'),'retain');assert.equal(fs.readFileSync(path.join(source,'level.dat'),'utf8'),'world data');
});
