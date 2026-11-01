const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const { createCatalogue, fail } = require('./catalogue.cjs');
const TARGETS = ['local-process', 'local-docker', 'ssh-process', 'ssh-docker'];
function createGameServerService({ dataDir, fetch: fetcher, spawn = childProcess.spawn, catalogue = createCatalogue(fetcher) } = {}) {
  if (!dataDir || !path.isAbsolute(dataDir)) fail('INVALID_STORAGE', 'An absolute managed storage directory is required');
  const root = path.join(dataDir, 'game-servers'); const running = new Map(); const operations = new Map(); let queue = Promise.resolve();
  async function safeRoot() { await fs.mkdir(root, { recursive: true }); if ((await fs.lstat(root)).isSymbolicLink()) fail('UNSAFE_PATH', 'Managed root cannot be a symbolic link'); }
  function folder(id) { if (!/^[a-f0-9-]{36}$/.test(id || '')) fail('INVALID_ID', 'Invalid managed server identifier'); return path.join(root, id); }
  async function safeFolder(id) { const dir = folder(id); if ((await fs.lstat(dir)).isSymbolicLink()) fail('UNSAFE_PATH', 'Managed server cannot be a symbolic link'); return dir; }
  async function atomic(file, value) { const temp = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temp, value, { flag: 'wx', mode: 0o600 }); try { await fs.rename(temp, file); } finally { await fs.rm(temp, { force: true }); } }
  async function safeFile(dir, name) { const file = path.join(dir, name); try { const stat = await fs.lstat(file); if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail('UNSAFE_PATH', 'Managed files must be ordinary unshared files'); } catch (e) { if (e.code !== 'ENOENT') throw e; } return file; }
  async function load(id) { const dir = await safeFolder(id); await safeFile(dir, 'record.json'); const s = JSON.parse(await fs.readFile(path.join(dir, 'record.json'), 'utf8')); if (s.id !== id) fail('INVALID_RECORD', 'Server identity mismatch'); return s; }
  async function save(s) { await atomic(await safeFile(await safeFolder(s.id), 'record.json'), JSON.stringify(s, null, 2)); }
  const state = s => ({ ...s, status: running.has(s.id) ? running.get(s.id).status : 'stopped', pid: running.get(s.id)?.child.pid ?? null });
  async function list() { await safeRoot(); const items = []; for (const name of await fs.readdir(root)) { if (/^[a-f0-9-]{36}$/.test(name)) items.push(state(await load(name))); } return items; }
  function stopped(id) { if (running.has(id)) fail('SERVER_ACTIVE', 'Stop the managed server before changing files'); }
  async function create(p) {
    if (p.target && p.target !== 'local-process') fail('TARGET_UNAVAILABLE', 'This target adapter has not been verified and is disabled');
    if (p.edition && p.edition !== 'java') fail('EDITION_UNAVAILABLE', 'Bedrock distribution installation is not implemented');
    if (p.flavour && p.flavour !== 'vanilla') fail('FLAVOUR_UNAVAILABLE', 'Only official vanilla distributions are currently installed');
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) fail('INVALID_NAME', 'Provide a server name of at most 100 characters');
    if (p.eulaAccepted !== true) fail('EULA_REQUIRED', 'Explicit acceptance of the Minecraft EULA is required');
    const memoryMb = p.memoryMb ?? 2048; const port = p.port ?? 25565;
    if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 65536 || !Number.isInteger(port) || port < 1024 || port > 65535) fail('INVALID_CONFIGURATION', 'Memory or port is outside the supported range');
    await safeRoot(); const id = crypto.randomUUID(); const controller = new AbortController(); operations.set(id, controller);
    // The operation identity is supplied by the caller so cancellation can interrupt downloads.
    if (p.operationId) { if (!/^[a-zA-Z0-9-]{1,80}$/.test(p.operationId) || operations.has(p.operationId)) fail('INVALID_OPERATION', 'Invalid or active operation identifier'); operations.set(p.operationId, controller); }
    let created = false;
    try {
      const version = await catalogue.resolve(p.version, controller.signal); if (!version.available) fail('DISTRIBUTION_UNAVAILABLE', version.reason);
      const bytes = await catalogue.download(version.download, controller.signal); if (controller.signal.aborted) fail('CANCELLED', 'Installation cancelled');
      const dir = folder(id); await fs.mkdir(dir); created = true;
      const s = { id, name: p.name.trim(), edition: 'java', flavour: 'vanilla', version: p.version, target: 'local-process', memoryMb, port, createdAt: new Date().toISOString(), eulaAcceptedAt: new Date().toISOString(), integrity: { sha1: version.download.sha1, size: version.download.size, source: version.download.url }, runtime: { javaMajor: version.javaMajor }, properties: {} };
      await fs.writeFile(path.join(dir, 'server.jar'), bytes, { flag: 'wx' });
      await fs.writeFile(path.join(dir, 'eula.txt'), 'eula=true\n', { flag: 'wx' });
      await fs.writeFile(path.join(dir, 'server.properties'), `server-port=${port}\n`, { flag: 'wx' }); await save(s); return state(s);
    } catch (e) { if (created) await fs.rm(folder(id), { recursive: true, force: true }); throw e; }
    finally { operations.delete(id); if (p.operationId) operations.delete(p.operationId); }
  }
  async function start(p) {
    const s = await load(p.id); stopped(s.id); const dir = await safeFolder(s.id);
    if (s.target !== 'local-process') fail('TARGET_UNAVAILABLE', 'Target adapter is unavailable');
    if (!p.javaPath || !path.isAbsolute(p.javaPath) || !/java(?:\.exe)?$/i.test(path.basename(p.javaPath))) fail('RUNTIME_REQUIRED', 'Select an absolute Java executable path');
    if (s.runtime.javaMajor === null) fail('RUNTIME_UNRESOLVED', 'Official metadata does not declare a compatible Java version');
    const jar = await fs.readFile(await safeFile(dir, 'server.jar')); if (crypto.createHash('sha1').update(jar).digest('hex') !== s.integrity.sha1) fail('INTEGRITY_FAILED', 'Installed distribution has changed');
    if (!(await fs.readFile(await safeFile(dir, 'eula.txt'), 'utf8')).split(/\r?\n/).includes('eula=true')) fail('EULA_REQUIRED', 'Server EULA acceptance is absent');
    const probe = await new Promise((resolve, reject) => { const c = spawn(p.javaPath, ['-version'], { windowsHide: true, shell: false }); let output = ''; const timer = setTimeout(() => { c.kill(); reject(Object.assign(new Error('Java detection timed out'), { code: 'RUNTIME_TIMEOUT' })); }, 10000); c.stdout?.on('data', b => { output = (output + b).slice(-8192); }); c.stderr?.on('data', b => { output = (output + b).slice(-8192); }); c.once('error', e => { clearTimeout(timer); reject(e); }); c.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Java detection failed')); else resolve(output); }); });
    const match = /version "(?:1\.)?(\d+)/.exec(probe); if (!match || Number(match[1]) !== s.runtime.javaMajor) fail('RUNTIME_MISMATCH', `Java ${s.runtime.javaMajor} is required by the official metadata`);
    const child = spawn(p.javaPath, [`-Xms${Math.min(512, s.memoryMb)}M`, `-Xmx${s.memoryMb}M`, '-jar', 'server.jar', 'nogui'], { cwd: dir, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const owned = { child, status: 'starting', logs: [], exited: null }; running.set(s.id, owned);
    owned.exited = new Promise(resolve => { child.once('exit', (code, signal) => { owned.logs.push(`Process exited (${code ?? signal})`); if (running.get(s.id) === owned) running.delete(s.id); resolve(); }); child.once('error', e => { owned.logs.push(`Process error: ${e.code || 'unknown'}`); if (running.get(s.id) === owned) running.delete(s.id); resolve(); }); });
    const log = data => { for (const line of data.toString().split(/\r?\n/)) if (line) { owned.logs.push(line.slice(0, 4096)); if (owned.logs.length > 500) owned.logs.shift(); } };
    child.stdout.on('data', log); child.stderr.on('data', log);
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); owned.status = 'running'; return state(s);
  }
  async function stop(p) { const s = await load(p.id); const owned = running.get(s.id); if (!owned) return state(s); owned.status = 'stopping'; owned.child.stdin.write('stop\n'); let timer; const done = await Promise.race([owned.exited.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 15000); })]); clearTimeout(timer); if (!done) fail('STOP_PENDING', 'Graceful stop is still pending; the owned process was not forcibly terminated'); return state(s); }
  async function configure(p) { stopped(p.id); const s = await load(p.id); const file = await safeFile(await safeFolder(p.id), 'server.properties'); const original = await fs.readFile(file, 'utf8'); const changes = p.properties; if (!changes || Array.isArray(changes) || typeof changes !== 'object' || Object.keys(changes).length > 100) fail('INVALID_CONFIGURATION', 'Provide bounded property changes');
    const supported = { 'motd': v => typeof v === 'string' && v.length <= 200 && /^[\x20-\x7e]*$/.test(v), 'server-port': v => Number.isInteger(v) && v >= 1024 && v <= 65535 };
    for (const [key, value] of Object.entries(changes)) if (!supported[key]?.(value)) fail('UNSUPPORTED_PROPERTY', 'This property lacks a verified editable descriptor');
    const remaining = new Map(Object.entries(changes)); const lines = original.split(/\r?\n/).map(line => { const m = /^([^#!\s][^=:]*?)[=:]/.exec(line); if (m && remaining.has(m[1])) { const value = remaining.get(m[1]); remaining.delete(m[1]); return `${m[1]}=${value}`; } return line; }); for (const [k,v] of remaining) lines.push(`${k}=${v}`);
    await atomic(file, lines.join('\n')); s.properties = { ...s.properties, ...changes }; if (changes['server-port']) s.port = changes['server-port']; await save(s); return state(s);
  }
  async function dispatch({ action, params: p = {} } = {}) {
    switch (action) {
      case 'capabilities': return { targets: TARGETS.map(id => ({ id, available: id === 'local-process', reason: id === 'local-process' ? null : 'Adapter installation and runtime verification remain incomplete' })), editions: [{ id: 'java', available: true }, { id: 'bedrock', available: false, reason: 'Official distribution adapter is incomplete' }], flavours: ['vanilla'], actions: ['list','discoverVersions','resolveVersion','create','configure','readConfiguration','start','stop','restart','logs','cancel'], metricsAvailable: false, commandsAvailable: false, backupsAvailable: false };
      case 'list': return list();
      case 'discoverVersions': return catalogue.discover();
      case 'resolveVersion': return catalogue.resolve(p.version);
      case 'create': return create(p);
      case 'start': return start(p);
      case 'stop': return stop(p);
      case 'restart': await stop(p); return start(p);
      case 'configure': return configure(p);
      case 'readConfiguration': { const s = await load(p.id); const file = await safeFile(await safeFolder(p.id), 'server.properties'); const text = await fs.readFile(file, 'utf8'); const properties = {}; for (const line of text.split(/\r?\n/)) { const match = /^([^#!\s][^=:]*?)[=:](.*)$/.exec(line); if (match) properties[match[1]] = match[2]; } return { id:s.id, properties, descriptors:[{key:'motd',type:'text',maxLength:200,restartRequired:true},{key:'server-port',type:'integer',min:1024,max:65535,restartRequired:true}], unknownPreserved:true }; }
      case 'logs': await load(p.id); return { lines: running.get(p.id)?.logs.slice() || [], source: 'owned-process', available: running.has(p.id) };
      case 'cancel': { const controller = operations.get(p.operationId); if (!controller) return { cancelled: false }; controller.abort(); return { cancelled: true }; }
      default: fail('UNSUPPORTED_ACTION', 'This server operation is not implemented');
    }
  }
  return { request(input) { if (['cancel','logs','list','capabilities','discoverVersions','resolveVersion'].includes(input?.action)) return dispatch(input); const result = queue.then(() => dispatch(input)); queue = result.catch(() => {}); return result; }, async dispose() { for (const c of operations.values()) c.abort(); for (const [id] of running) await stop({ id }); } };
}
module.exports = { createGameServerService };
