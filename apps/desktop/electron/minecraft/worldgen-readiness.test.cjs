const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const w = require('./worldgen.cjs');
const zip = require('./zip.cjs');
function fixture(t, { ready = true, version = '1.21.4' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-world-readiness-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tree = path.join(root, 'jar-tree'), reports = path.join(root, 'reports');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
  for (const [name, value] of Object.entries({
    'version.json': { id: version, pack_version: { data: 61 } },
    'data/minecraft/worldgen/world_preset/normal.json': {},
    'data/minecraft/worldgen/biome/plains.json': {},
    'data/minecraft/worldgen/noise_settings/overworld.json': { sea_level:63, default_block:{Name:'minecraft:stone'}, default_fluid:{Name:'minecraft:water'}, aquifers_enabled:true, ore_veins_enabled:true, disable_mob_generation:false, noise:{min_y:-64,height:384} },
    'data/minecraft/dimension_type/overworld.json': {min_y:-64,height:384,logical_height:384},
  })) write(path.join(tree, name), value);
  write(path.join(reports, 'reports/registries.json'), {'minecraft:block':{entries:{'minecraft:stone':{},'minecraft:water':{}}}});
  const commands = {children:{say:{children:{message:{type:'argument',parser:'minecraft:message',executable:true}}},execute:{children:{run:{type:'literal'},if:{children:{}}}}}};
  if (ready) commands.children.execute.children.if.children.loaded = {type:'literal',children:{pos:{type:'argument',parser:'minecraft:block_pos',redirect:['execute']}}};
  write(path.join(reports, 'reports/commands.json'), commands);
  const jar = path.join(root, 'server.jar'); zip.zipFolder(tree, jar, '');
  const catalogue = w.catalogueFrom(fs.readFileSync(jar), reports);
  return {root,jar,catalogue,commands,write,reports};
}
function simulation(f, onProbe) {
  const commands = [], events = [];
  let child, probes = 0;
  const output = line => setImmediate(() => child.stdout.emit('data', Buffer.from(line+'\n')));
  const spawn = () => {
    child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin = {write(text) {
      const command = text.trim(); commands.push(command);
      const tag = /run say (MBGEN-[A-Za-z0-9-]+)$/.exec(command)?.[1];
      if (tag) onProbe({command,tag,output,probe:++probes});
      if (command === 'save-all flush') output('Saved the game');
      if (command === 'stop') setImmediate(()=>child.emit('exit',0));
    }};
    fs.writeFileSync(path.join(f.root,'level-fixture'), 'not a real world');
    output('Done (fixture)!'); return child;
  };
  return {commands,events,spawn};
}
function generation(f, s, area={width:16,depth:16,centerX:8,centerZ:8}, outputName='output') {
  return w.generate({catalogue:f.catalogue, jarPath:f.jar, stagingRoot:path.join(f.root,'runs'), eulaAccepted:true,
    options:{...w.defaults(f.catalogue),area,output:{kind:'folder',destination:path.join(f.root,outputName)}},
    emit:e=>s.events.push(e),deps:{spawn:s.spawn,portFree:async()=>true,pollMs:2,batchTimeout:200,startTimeout:100,saveTimeout:100,stopTimeout:100}});
}
const success = tag => `[12:34:56] [Server thread/INFO]: [Server] ${tag}`;
test('preset-bearing reports without loaded readiness remain discoverable but cannot spawn',async t=>{
  const f=fixture(t,{ready:false,version:'1.19.2'});
  assert.equal(f.catalogue.version,'1.19.2'); assert.equal(f.catalogue.supported,false);
  assert.match(f.catalogue.reason,/readiness|loaded/i);
  let spawned=false;
  await assert.rejects(w.generate({catalogue:f.catalogue, options:{},eulaAccepted:true,deps:{spawn:()=>{spawned=true;}}}),/WORLDGEN_UNSUPPORTED/);
  assert.equal(spawned,false);
});
test('readiness admission follows actual command schema instead of version number',t=>{
  const f=fixture(t,{ready:true,version:'1.19.2'}); assert.equal(f.catalogue.supported,true);
  f.commands.children.execute.children.if.children.loaded.children.pos.parser='minecraft:vec3';
  f.write(path.join(f.reports,'reports/commands.json'),f.commands);
  assert.equal(w.catalogueFrom(fs.readFileSync(f.jar),f.reports).supported,false);
});
test('a pending interior chunk prevents batch completion and ticket removal',async t=>{
  const f=fixture(t);const s=simulation(f,({command,tag,output})=>{const parts=command.split(' ');if(!(parts[3]==='128'&&parts[5]==='128'))output(success(tag));});
  await assert.rejects(generation(f,s),/SERVER_TIMEOUT/);
  assert.equal(s.events.some(e=>e.step==='batch'),false);
  assert.equal(s.commands.some(c=>c.startsWith('forceload remove')),false);
});
for(const [name,line] of [
  ['diagnostic echo',({command})=>`[12:34:56] [Server thread/ERROR]: Unknown command ${command}`],
  ['ordinary player chat',({tag})=>`[12:34:56] [Server thread/INFO]: <Player> ${tag}`],
  ['prefix',({tag})=>success('prefix '+tag)],
  ['suffix',({tag})=>success(tag+' suffix')],
  ['unframed response',({tag})=>'[Server] '+tag],
])test(`readiness rejects ${name}`,async t=>{
  const f=fixture(t);const s=simulation(f,p=>p.output(line(p)));
  await assert.rejects(generation(f,s,{width:1,depth:1,centerX:0,centerZ:0}),/SERVER_TIMEOUT/);
  assert.equal(s.events.some(e=>e.step==='batch'),false);
});
test('all requested chunks require distinct bounded probes and real-shaped acknowledgements',async t=>{
  const f=fixture(t);const s=simulation(f,({tag,output})=>output(success(tag)));
  await generation(f,s);
  const probes=s.commands.filter(c=>c.startsWith('execute if loaded'));
  const positions=new Set(probes.map(c=>c.split(' ').slice(3,6).join(' ')));
  assert.equal(positions.size,256); assert.ok(probes.every(c=>c.length<200));
  assert.equal(s.events.filter(e=>e.step==='batch').length,1);
});
test('a stale prior-batch acknowledgement cannot finish the current batch',async t=>{
  const f=fixture(t);let firstTag;
  const s=simulation(f,({command,tag,output})=>{firstTag ||= tag;output(success(Number(command.split(' ')[3])<256?tag:firstTag));});
  await assert.rejects(generation(f,s,{width:17,depth:1,centerX:8,centerZ:0}),/SERVER_TIMEOUT/);
  assert.equal(s.events.filter(e=>e.step==='batch').length,1);
});

test('run and batch identities are fresh and prior-run replies cannot finish a new run',async t=>{
  const f=fixture(t), tags=[];
  const s=simulation(f,({tag,output})=>{tags.push(tag);output(success(tag));});
  await generation(f,s,{width:17,depth:1,centerX:8,centerZ:0});
  const identities=tags.map(tag=>/^MBGEN-([a-f0-9]{32})-([a-f0-9]{32})-/.exec(tag));
  assert.ok(identities.every(Boolean));
  assert.equal(new Set(identities.map(x=>x[1])).size,1);
  assert.equal(new Set(identities.map(x=>x[2])).size,2);
  const repeated=simulation(f,({output})=>output(success(tags[0])));
  await assert.rejects(generation(f,repeated,{width:1,depth:1,centerX:0,centerZ:0},'second-output'),/SERVER_TIMEOUT/);
  assert.equal(repeated.events.some(e=>e.step==='batch'),false);
  const currentTag=/run say (\S+)$/.exec(repeated.commands.find(c=>c.startsWith('execute if loaded')))[1];
  assert.notEqual(currentTag.split('-')[1],identities[0][1]);
});

test('actual vanilla root-run report omission is admitted while non-root redirects fail closed',t=>{
  const f=fixture(t);
  assert.deepEqual(f.commands.children.execute.children.run,{type:'literal'});
  assert.equal(f.catalogue.supported,true);
  for (const redirect of [[], ['execute'], ['say'], '']) {
    f.commands.children.execute.children.run.redirect=redirect;
    f.write(path.join(f.reports,'reports/commands.json'),f.commands);
    assert.equal(w.catalogueFrom(fs.readFileSync(f.jar),f.reports).supported,Array.isArray(redirect)&&redirect.length===0);
  }
});
