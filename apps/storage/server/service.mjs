import http from 'node:http';
import { createCiphertextStore } from './store.mjs';
export { createCiphertextStore } from './store.mjs';
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const hex = /^[a-f0-9]{64}$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
class Fault extends Error { constructor(status, message) { super(message); this.status = status; } }
async function directory(p) { await fs.mkdir(p, { recursive: true, mode: 0o700 }); if (!(await fs.lstat(p)).isDirectory() || (await fs.lstat(p)).isSymbolicLink()) throw new Error('Unsafe storage directory'); }
async function readRegular(p) { const f = await fs.open(p, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); try { if (!(await f.stat()).isFile()) throw new Error('Not a regular file'); return await f.readFile(); } finally { await f.close(); } }
async function body(req, limit) { const chunks=[]; let size=0; for await (const chunk of req) { size+=chunk.length; if(size>limit) throw new Fault(413,'Request too large'); chunks.push(chunk); } return Buffer.concat(chunks); }
async function jsonBody(req) { try { return JSON.parse(await body(req,65536)); } catch(e) { if(e instanceof Fault) throw e; throw new Fault(400,'Invalid JSON'); } }
function send(res,status,value) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }

export async function createService(options={}) {
  const root=path.resolve(options.root || process.env.STORAGE_ROOT || './data');
  const configFile=options.configFile || process.env.STORAGE_CONFIG || path.join(root,'config.json');
  await directory(root);
  const config=JSON.parse(await readRegular(configFile));
  if(!hex.test(config.bootstrapHash) || !Array.isArray(config.allowedHosts) || !config.allowedHosts.length) throw new Error('Protected bootstrap configuration required');
  const maxChunk=options.maxChunk || 16*1024*1024, quota=options.quota || 100*1024*1024*1024;
  const sessions=new Map(), rates=new Map();
  const consumed=path.join(root,'pairing-consumed'); await directory(consumed);
  const store=options.store || await createCiphertextStore(root,{maxChunk,quota});
  const web=path.resolve(options.web || fileURLToPath(new URL('../web/',import.meta.url)));
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if(!config.allowedHosts.includes(req.headers.host)) throw new Fault(403,'Host not permitted');
      const origin=`http://${req.headers.host}`;
      if(req.headers.origin && req.headers.origin!==origin) throw new Fault(403,'Origin not permitted');
      if(req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])) throw new Fault(403,'Cross-site request not permitted');
      const url=new URL(req.url,origin), p=url.pathname, method=req.method;
      if(p==='/health'&&method==='GET') return send(res,200,{status:'ok',version:'0.1.0',transport:'http'});
      const now=Date.now(), address=req.socket.remoteAddress;
      let rate=rates.get(address); if(!rate||now-rate.start>60000) {rate={start:now,count:0}; rates.set(address,rate);} if(++rate.count>300) throw new Fault(429,'Rate limit exceeded');
      if(rates.size>4096) for(const [key,value] of rates) if(now-value.start>60000) rates.delete(key);
      if(p==='/api/pair'&&method==='POST') {
        if(rate.count>12) throw new Fault(429,'Pairing rate limit exceeded');
        const input=await jsonBody(req); if(!equal(digest(String(input.secret||'')),config.bootstrapHash)) throw new Fault(401,'Pairing rejected');
        for(const [key,s] of sessions) if(s.expiresAt<now) sessions.delete(key);
        if(sessions.size>=32) throw new Fault(429,'Session limit reached');
        try {const ticket=await fs.open(path.join(consumed,config.bootstrapHash),'wx',0o600); await ticket.sync(); await ticket.close();} catch(e) {if(e.code==='EEXIST') throw new Fault(401,'Pairing code already used; generate a new code on the host'); throw e;}
        const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex'); sessions.set(digest(token),{id,csrf,createdAt:now,expiresAt:now+8*3600000});
        res.setHeader('Set-Cookie',`storage_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`); return send(res,200,{id,csrfToken:csrf,expiresAt:now+8*3600000});
      }
      if(!p.startsWith('/api/')) {
        if(method!=='GET') throw new Fault(405,'Method not permitted');
        const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
        if(!assets[p]) throw new Fault(404,'Not found'); const bytes=await readRegular(path.join(web,assets[p])); res.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'}); return res.end(bytes);
      }
      const cookie=/\bstorage_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
      const session=cookie&&sessions.get(digest(cookie[1]));
      if(!session||session.expiresAt<now) throw new Fault(401,'Authentication required');
      if(!['GET','HEAD'].includes(method)&&!equal(req.headers['x-csrf-token'],session.csrf)) throw new Fault(403,'CSRF token required');
      if(p==='/api/session'&&method==='GET') return send(res,200,{...session,csrfToken:session.csrf,csrf:undefined});
      if(p==='/api/stats'&&method==='GET') return send(res,200,await store.stats());
      if(p==='/api/sessions'&&method==='GET') return send(res,200,{sessions:[...sessions.values()].map(({id,createdAt,expiresAt})=>({id,createdAt,expiresAt,current:id===session.id}))});
      if(p==='/api/logout'&&method==='POST') {sessions.delete(digest(cookie[1])); res.setHeader('Set-Cookie','storage_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res,200,{ok:true});}
      if(p.startsWith('/api/sessions/')&&method==='DELETE') {const id=p.slice('/api/sessions/'.length); for(const [key,s] of sessions) if(s.id===id) sessions.delete(key); return send(res,200,{ok:true});}
      const headMatch=/^\/api\/vaults\/([a-f0-9]{64})\/head$/.exec(p);
      if(headMatch && method==='GET') return send(res,200,await store.getHead(headMatch[1]));
      if(headMatch && method==='PUT') {const input=await jsonBody(req);return send(res,200,await store.compareAndSetHead(headMatch[1],input.revisionId,input.expectedHead));}
      const match=/^\/api\/vaults\/([a-f0-9]{64})\/(chunks|revisions)\/([a-f0-9]{64})$/.exec(p);
      if(match) {
        const [,vault,kind,id]=match;
        if(method==='GET') {const data=await store.get(vault,kind,id);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});return res.end(data);}
        if(method==='PUT') return send(res,201,await store.put(vault,kind,id,req,Number(req.headers['content-length'])));
      }
      throw new Fault(404,'Not found');
    } catch(e) { if(!res.headersSent) send(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'Not found':'Storage operation failed'}); else res.destroy(); }
  });
  server.requestTimeout=30000; server.headersTimeout=10000; server.maxHeadersCount=40; server.maxConnections=128;
  return server;
}

