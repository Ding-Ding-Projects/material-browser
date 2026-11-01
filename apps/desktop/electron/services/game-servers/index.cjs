const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const { createCatalogue, fail } = require('./catalogue.cjs');
const { createBackups } = require('./backups.cjs');
const content = require('./content.cjs');
const TARGETS = ['local-process', 'local-docker', 'ssh-process', 'ssh-docker'];
function createGameServerService({ dataDir, fetch: fetcher, spawn = childProcess.spawn, catalogue = createCatalogue(fetcher) } = {}) {
  if (!dataDir || !path.isAbsolute(dataDir)) fail('INVALID_STORAGE', 'An absolute managed storage directory is required');
  const root = path.join(dataDir, 'game-servers'); const running = new Map(); const operations = new Map(); let queue = Promise.resolve(); const backups = createBackups(root);
  async function safeRoot() { await fs.mkdir(root, { recursive: true }); if ((await fs.lstat(root)).isSymbolicLink()) fail('UNSAFE_PATH', 'Managed root cannot be a symbolic link'); }
  function folder(id) { if (!/^[a-f0-9-]{36}$/.test(id || '')) fail('INVALID_ID', 'Invalid managed server identifier'); return path.join(root, id); }
  async function safeFolder(id) { const dir = folder(id); if ((await fs.lstat(dir)).isSymbolicLink()) fail('UNSAFE_PATH', 'Managed server cannot be a symbolic link'); return dir; }
  async function atomic(file, value) { const temp = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temp, value, { flag: 'wx', mode: 0o600 }); try { await fs.rename(temp, file); } finally { await fs.rm(temp, { force: true }); } }
  async function safeFile(dir, name) { const file = path.join(dir, name); try { const stat = await fs.lstat(file); if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail('UNSAFE_PATH', 'Managed files must be ordinary unshared files'); } catch (e) { if (e.code !== 'ENOENT') throw e; } return file; }
  async function load(id) { const dir = await safeFolder(id); await safeFile(dir, 'record.json'); const s = JSON.parse(await fs.readFile(path.join(dir, 'record.json'), 'utf8')); if (s.id !== id) fail('INVALID_RECORD', 'Server identity mismatch'); try { await fs.access(await safeFile(dir,'process-state.json')); s.ownershipUnresolved = !running.has(id); } catch(e) { if(e.code!=='ENOENT')throw e; } return s; }
  async function save(s) { await atomic(await safeFile(await safeFolder(s.id), 'record.json'), JSON.stringify(s, null, 2)); }
  const state = s => ({ ...s, status: running.has(s.id) ? running.get(s.id).status : (s.ownershipUnresolved ? 'unknown' : 'stopped'), pid: running.get(s.id)?.child.pid ?? null });
  async function list() { await safeRoot(); const items = []; for (const name of await fs.readdir(root)) { if (/^[a-f0-9-]{36}$/.test(name)) items.push(state(await load(name))); } return items; }
  async function stopped(id) { const s=await load(id); if(s.ownershipUnresolved)fail('OWNERSHIP_UNRESOLVED','A previous process receipt exists; verify that process before further mutation'); if (running.has(id)) fail('SERVER_ACTIVE', 'Stop the managed server before changing files'); }
  async function create(p) {
    if (p.target && !['local-process','local-docker'].includes(p.target)) fail('TARGET_UNAVAILABLE', 'This target adapter has not been verified and is disabled');
    if (p.edition && p.edition !== 'java') fail('EDITION_UNAVAILABLE', 'Bedrock distribution installation is not implemented');
    if (p.flavour && p.flavour !== 'vanilla') fail('FLAVOUR_UNAVAILABLE', 'Only official vanilla distributions are currently installed');
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) fail('INVALID_NAME', 'Provide a server name of at most 100 characters');
    if (p.eulaAccepted !== true) fail('EULA_REQUIRED', 'Explicit acceptance of the Minecraft EULA is required');
    if (p.target === 'local-docker' && !/^eclipse-temurin@sha256:[a-f0-9]{64}$/.test(p.imageDigest || '')) fail('PINNED_IMAGE_REQUIRED', 'Select a verified immutable eclipse-temurin image digest');
    const memoryMb = p.memoryMb ?? 2048; const port = p.port ?? 25565;
    if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 65536 || !Number.isInteger(port) || port < 1024 || port > 65535) fail('INVALID_CONFIGURATION', 'Memory or port is outside the supported range');
    await safeRoot(); if (p.operationId && (!/^[a-zA-Z0-9-]{1,80}$/.test(p.operationId) || operations.has(p.operationId))) fail('INVALID_OPERATION', 'Invalid or active operation identifier');
    const id = crypto.randomUUID(); const controller = new AbortController(); operations.set(id, controller);
    // The operation identity is supplied by the caller so cancellation can interrupt downloads.
    if (p.operationId) { if (!/^[a-zA-Z0-9-]{1,80}$/.test(p.operationId) || operations.has(p.operationId)) fail('INVALID_OPERATION', 'Invalid or active operation identifier'); operations.set(p.operationId, controller); }
    let created = false;
    try {
      const version = await catalogue.resolve(p.version, controller.signal); if (!version.available) fail('DISTRIBUTION_UNAVAILABLE', version.reason);
      const bytes = await catalogue.download(version.download, controller.signal); if (controller.signal.aborted) fail('CANCELLED', 'Installation cancelled');
      const dir = folder(id); await fs.mkdir(dir); created = true;
      const s = { id, name: p.name.trim(), edition: 'java', flavour: 'vanilla', version: p.version, target: p.target || 'local-process', imageDigest: p.target === 'local-docker' ? p.imageDigest : null, memoryMb, port, createdAt: new Date().toISOString(), eulaAcceptedAt: new Date().toISOString(), integrity: { sha1: version.download.sha1, size: version.download.size, source: version.download.url }, runtime: { javaMajor: version.javaMajor }, properties: {} };
      await fs.writeFile(path.join(dir, 'server.jar'), bytes, { flag: 'wx' });
      await fs.writeFile(path.join(dir, 'eula.txt'), 'eula=true\n', { flag: 'wx' });
      await fs.writeFile(path.join(dir, 'server.properties'), `server-port=${port}\n`, { flag: 'wx' }); await save(s); return state(s);
    } catch (e) { if (created) await fs.rm(folder(id), { recursive: true, force: true }); throw e; }
    finally { operations.delete(id); if (p.operationId) operations.delete(p.operationId); }
  }
  async function start(p) {
    const s = await load(p.id); await stopped(s.id); const dir = await safeFolder(s.id);
    if (!['local-process','local-docker'].includes(s.target)) fail('TARGET_UNAVAILABLE', 'Target adapter is unavailable');
    const docker = s.target === 'local-docker';
    if (!docker && (!p.javaPath || !path.isAbsolute(p.javaPath) || !/java(?:\.exe)?$/i.test(path.basename(p.javaPath)))) fail('RUNTIME_REQUIRED', 'Select an absolute Java executable path');
    if (s.runtime.javaMajor === null) fail('RUNTIME_UNRESOLVED', 'Official metadata does not declare a compatible Java version');
    const jar = await fs.readFile(await safeFile(dir, 'server.jar')); if (crypto.createHash('sha1').update(jar).digest('hex') !== s.integrity.sha1) fail('INTEGRITY_FAILED', 'Installed distribution has changed');
    if (!(await fs.readFile(await safeFile(dir, 'eula.txt'), 'utf8')).split(/\r?\n/).includes('eula=true')) fail('EULA_REQUIRED', 'Server EULA acceptance is absent');
    const probe = await new Promise((resolve, reject) => { const c = spawn(docker ? 'docker' : p.javaPath, docker ? ['run','--rm','--network','none','--entrypoint','java',s.imageDigest,'-version'] : ['-version'], { windowsHide: true, shell: false }); let output = ''; const timer = setTimeout(() => { c.kill(); reject(Object.assign(new Error('Java detection timed out'), { code: 'RUNTIME_TIMEOUT' })); }, 10000); c.stdout?.on('data', b => { output = (output + b).slice(-8192); }); c.stderr?.on('data', b => { output = (output + b).slice(-8192); }); c.once('error', e => { clearTimeout(timer); reject(e); }); c.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Java detection failed')); else resolve(output); }); });
    const match = /version "(?:1\.)?(\d+)/.exec(probe); if (!match || Number(match[1]) !== s.runtime.javaMajor) fail('RUNTIME_MISMATCH', `Java ${s.runtime.javaMajor} is required by the official metadata`);
    const javaArgs = [`-Xms${Math.min(512, s.memoryMb)}M`, `-Xmx${s.memoryMb}M`, '-jar', 'server.jar', 'nogui'];
    const containerName = `material-browser-server-${s.id}`;
    const child = spawn(docker ? 'docker' : p.javaPath, docker ? ['run','--rm','-i','--name',containerName,'--label',`com.material-browser.server=${s.id}`,'--network','bridge','-p',`127.0.0.1:${s.port}:${s.port}`,'--memory',`${s.memoryMb + 512}m`,'--mount',`type=bind,source=${dir},target=/server`,'-w','/server','--entrypoint','java',s.imageDigest,...javaArgs] : javaArgs, { cwd: dir, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const owned = { child, status: 'starting', logs: [], exited: null }; running.set(s.id, owned);
    owned.exited = new Promise(resolve => { child.once('exit', (code, signal) => { owned.logs.push(`Process exited (${code ?? signal})`); if (running.get(s.id) === owned) running.delete(s.id); resolve(); }); child.once('error', e => { owned.logs.push(`Process error: ${e.code || 'unknown'}`); if (running.get(s.id) === owned) running.delete(s.id); resolve(); }); });
    const log = data => { for (const line of data.toString().split(/\r?\n/)) if (line) { owned.logs.push(line.slice(0, 4096)); if (owned.logs.length > 500) owned.logs.shift(); } };
    child.stdout.on('data', log); child.stderr.on('data', log);
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); await atomic(path.join(dir,'process-state.json'),JSON.stringify({pid:child.pid,target:s.target,startedAt:new Date().toISOString()})); owned.exited.then(async()=>{ try { await fs.rm(path.join(dir,'process-state.json'),{force:true}); } catch {} }); return state(s);
  }
  async function stop(p) { const s = await load(p.id); const owned = running.get(s.id); if (!owned) { if(s.ownershipUnresolved)fail('OWNERSHIP_UNRESOLVED','Previous owned process state must be reconciled'); return state(s); } owned.status = 'stopping'; owned.child.stdin.write('stop\n'); let timer; const done = await Promise.race([owned.exited.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 15000); })]); clearTimeout(timer); if (!done) fail('STOP_PENDING', 'Graceful stop is still pending; the owned process was not forcibly terminated'); return state(s); }
  async function configure(p) { await stopped(p.id); const s = await load(p.id); const file = await safeFile(await safeFolder(p.id), 'server.properties'); const original = await fs.readFile(file, 'utf8'); const changes = p.properties; if (!changes || Array.isArray(changes) || typeof changes !== 'object' || Object.keys(changes).length > 100) fail('INVALID_CONFIGURATION', 'Provide bounded property changes');
    const supported = { 'motd': v => typeof v === 'string' && v.length <= 200 && /^[\x20-\x7e]*$/.test(v), 'server-port': v => Number.isInteger(v) && v >= 1024 && v <= 65535 };
    for (const [key, value] of Object.entries(changes)) if (!supported[key]?.(value)) fail('UNSUPPORTED_PROPERTY', 'This property lacks a verified editable descriptor');
    const remaining = new Map(Object.entries(changes)); const lines = original.split(/\r?\n/).map(line => { const m = /^([^#!\s][^=:]*?)[=:]/.exec(line); if (m && Object.hasOwn(changes,m[1])) { const value = changes[m[1]]; remaining.delete(m[1]); return `${m[1]}=${value}`; } return line; }); for (const [k,v] of remaining) lines.push(`${k}=${v}`);
    await atomic(file, lines.join('\n')); s.properties = { ...s.properties, ...changes }; if (changes['server-port']) s.port = changes['server-port']; await save(s); return state(s);
  }
  async function dispatch({ action, params: p = {} } = {}) {
    switch (action) {
      case 'capabilities': return { targets: TARGETS.map(id => ({ id, available: ['local-process','local-docker'].includes(id), reason: ['local-process','local-docker'].includes(id) ? null : 'Adapter installation and runtime verification remain incomplete' })), editions: [{ id: 'java', available: true }, { id: 'bedrock', available: false, reason: 'Official distribution adapter is incomplete' }], flavours: ['vanilla'], actions: ['list','discoverVersions','resolveVersion','create','configure','readConfiguration','start','stop','restart','logs','cancel','backup','listBackups','restore','listContent','installContent','removeContent'], metricsAvailable: false, commandsAvailable: false, backupsAvailable: true, contentKinds: [{id:'datapack',available:true,compatibility:'unknown'},{id:'plugin',available:false,reason:'Vanilla does not load plugins'},{id:'mod',available:false,reason:'Mod loader installation is incomplete'}] };
      case 'list': return list();
      case 'discoverVersions': return catalogue.discover();
      case 'resolveVersion': return catalogue.resolve(p.version);
      case 'create': return create(p);
      case 'start': return start(p);
      case 'stop': return stop(p);
      case 'restart': await stop(p); return start(p);
      case 'configure': return configure(p);
      case 'listContent': await load(p.id); return content.listContent(await safeFolder(p.id));
      case 'installContent': await stopped(p.id); return content.installContent(await safeFolder(p.id),p);
      case 'removeContent': await stopped(p.id); await backups.backup(await load(p.id),await safeFolder(p.id)); return content.removeContent(await safeFolder(p.id),p);
      case 'listBackups': await load(p.id); return backups.list(p.id);
      case 'backup': { await stopped(p.id); const s=await load(p.id); return backups.backup(s,await safeFolder(p.id)); }
      case 'restore': { await stopped(p.id); const s=await load(p.id); return backups.restore(s,await safeFolder(p.id),p.backupId); }
      case 'readConfiguration': { const s = await load(p.id); const file = await safeFile(await safeFolder(p.id), 'server.properties'); const text = await fs.readFile(file, 'utf8'); const properties = {}; for (const line of text.split(/\r?\n/)) { const match = /^([^#!\s][^=:]*?)[=:](.*)$/.exec(line); if (match) properties[match[1]] = match[2]; } return { id:s.id, properties, descriptors:[{key:'motd',type:'text',maxLength:200,restartRequired:true},{key:'server-port',type:'integer',min:1024,max:65535,restartRequired:true}], unknownPreserved:true }; }
      case 'logs': await load(p.id); return { lines: running.get(p.id)?.logs.slice() || [], source: 'owned-process', available: running.has(p.id) };
      case 'cancel': { const controller = operations.get(p.operationId); if (!controller) return { cancelled: false }; controller.abort(); return { cancelled: true }; }
      default: fail('UNSUPPORTED_ACTION', 'This server operation is not implemented');
    }
  }
  return { request(input) { if (['cancel','logs','list','capabilities','discoverVersions','resolveVersion'].includes(input?.action)) return dispatch(input); const result = queue.then(() => dispatch(input)); queue = result.catch(() => {}); return result; }, async dispose() { for (const c of operations.values()) c.abort(); for (const [id] of running) await stop({ id }); } };
}
module.exports = { createGameServerService };
