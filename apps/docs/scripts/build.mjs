import {readdir,readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {build} from 'esbuild';import {renderArticle} from './content.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'dist/site');
async function walk(dir){const all=[];for(const item of await readdir(path.join(root,dir),{withFileTypes:true}).catch(()=>[])){const p=dir+'/'+item.name;if(item.isDirectory())all.push(...await walk(p));else if(p.endsWith('.md'))all.push(p);}return all;}
const files=[...await walk('docs'),...await walk('wiki')].sort(),available=new Set(files);
const articles=await Promise.all(files.map(async file=>{const body=await readFile(path.join(root,file),'utf8');return{id:file,title:body.match(/^#\s+(.+)$/m)?.[1]||file,category:file.split('/')[1],html:renderArticle(body,file,available),text:body};}));
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();await mkdir(out,{recursive:true});
await build({entryPoints:[path.join(root,'apps/docs/src/main.mjs')],bundle:true,format:'iife',outfile:path.join(out,'app.js'),minify:true,target:'es2022',define:{__DOCS__:JSON.stringify({source,updatedAt:new Date().toISOString(),articles})}});
for(const name of ['style.css','regex.worker.js'])await copyFile(path.join(root,'apps/docs/src',name),path.join(out,name));await copyFile(path.join(root,'apps/docs/index.html'),path.join(out,'index.html'));await writeFile(path.join(out,'inventory.json'),JSON.stringify({source,articles:files},null,2));console.log(`Documentation built: ${articles.length} complete articles; source ${source}`);
