const test=require('node:test'), assert=require('node:assert/strict'), os=require('node:os'), fs=require('node:fs'),path=require('node:path');
const {assetForUrl,allowsDocument,verificationDirectory}=require('../policy.cjs');
test('only packaged assets and the fixed document origin are reachable',()=>{
 const files=new Set(['index.html','app.js','assets/a.png']);
 assert.equal(assetForUrl('handbook://local/index.html#/article/wiki%2FHome.md',files),'index.html');
 assert.equal(assetForUrl('handbook://local/assets/a.png',files),'assets/a.png');
 for(const url of ['https://example.com/','file:///C:/secret','handbook://other/index.html','handbook://user@local/index.html','handbook://local:80/index.html','handbook://local/%2e%2e/secret','handbook://local/%2e%2e%5csecret','handbook://local/app.js?q=1','javascript:alert(1)'])assert.equal(assetForUrl(url,files),null,url);
 assert.equal(allowsDocument('handbook://local/index.html#/home'),true);
 for(const url of ['https://example.com','handbook://local/app.js','handbook://other/index.html','handbook://local/index.html?x=1'])assert.equal(allowsDocument(url),false,url);
});
test('verification profile requires explicit safe ownership and preserves unrelated content',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'handbook-policy-'));try{
 const normal=path.join(root,'normal'),owned=path.join(root,'owned');fs.mkdirSync(normal);fs.writeFileSync(path.join(normal,'valuable'),'unchanged');
 for(const input of [path.parse(root).root,os.homedir(),normal,'relative'])assert.throws(()=>verificationDirectory(input,os.homedir(),normal));
 assert.equal(verificationDirectory(owned,os.homedir(),normal),owned);fs.writeFileSync(path.join(owned,'preferences'),'saved');assert.equal(verificationDirectory(owned,os.homedir(),normal),owned);
 const unrelated=path.join(root,'unrelated');fs.mkdirSync(unrelated);fs.writeFileSync(path.join(unrelated,'valuable'),'unchanged');assert.throws(()=>verificationDirectory(unrelated,os.homedir(),normal));assert.equal(fs.readFileSync(path.join(unrelated,'valuable'),'utf8'),'unchanged');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
