const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const zip = require("./zip.cjs");
const w = require("./worldgen.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mb-wg-"));

function writeTree(root, files) {
  for (const [rel, value] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
  }
}

/** A bundled jar whose inner jar holds a tiny but real-shaped worldgen data set. */
const fixturePresetIds = ["normal", "flat", "large_biomes", "amplified", "single_biome_surface", "debug_all_block_states"];
function catalogue({ presets = true, presetIds = fixturePresetIds, packVersion = { resource: 46, data: 61 }, noiseOverrides = {}, dimensionOverrides = {} } = {}) {
  const inner = tmp(), jarTree = tmp(), out = tmp();
  const files = {
    "version.json": { id: "1.21.4", pack_version: packVersion },
    "data/minecraft/worldgen/biome/plains.json": {},
    "data/minecraft/worldgen/biome/desert.json": {},
    "data/minecraft/worldgen/structure_set/villages.json": {},
    "data/minecraft/worldgen/structure_set/strongholds.json": {},
    "data/minecraft/worldgen/flat_level_generator_preset/classic_flat.json": { settings: { biome: "minecraft:plains", features: false, lakes: false, layers: [{ block: "minecraft:bedrock", height: 1 }, { block: "minecraft:dirt", height: 2 }], structure_overrides: "minecraft:villages" } },
    "data/minecraft/worldgen/noise_settings/overworld.json": { sea_level: 63, aquifers_enabled: true, ore_veins_enabled: true, disable_mob_generation: false, default_block: { Name: "minecraft:stone" }, default_fluid: { Name: "minecraft:water" }, noise: { min_y: -64, height: 384, size_horizontal: 1, size_vertical: 2 } },
    "data/minecraft/dimension_type/overworld.json": { height: 384, min_y: -64, logical_height: 384, natural: true },
  };
  Object.assign(files["data/minecraft/worldgen/noise_settings/overworld.json"], noiseOverrides);
  Object.assign(files["data/minecraft/dimension_type/overworld.json"], dimensionOverrides);
  if (presets) for (const p of presetIds) files[`data/minecraft/worldgen/world_preset/${p}.json`] = { dimensions: {} };
  writeTree(inner, files);
  fs.mkdirSync(path.join(jarTree, "META-INF/versions/1.21.4"), { recursive: true });
  zip.zipFolder(inner, path.join(jarTree, "META-INF/versions/1.21.4/server-1.21.4.jar"), "");
  zip.zipFolder(jarTree, path.join(out, "server.jar"), "");
  return w.catalogueFrom(fs.readFileSync(path.join(out, "server.jar")), reportsDir());
}

function reportsDir() {
  const dir = tmp();
  writeTree(dir, {
    "reports/registries.json": { "minecraft:block": { entries: { "minecraft:stone": {}, "minecraft:water": {}, "minecraft:bedrock": {}, "minecraft:dirt": {}, "minecraft:grass_block": {} } } },
    "reports/commands.json": { children: { execute: {children:{if:{children:{loaded:{children:{pos:{type:"argument",parser:"minecraft:block_pos",redirect:["execute"]}}}}},run:{type:"literal"}}}, say:{children:{message:{parser:"minecraft:message",executable:true}}}, gamerule: { children: { keepInventory: { children: { value: { parser: "brigadier:bool" } } }, randomTickSpeed: { children: { value: { parser: "brigadier:integer" } } }, futureRule: { children: { value: { parser: "minecraft:something_new" } } } } } } },
  });
  return dir;
}

test("zip writes, reopens and detects corruption", () => {
  const src = tmp(), out = path.join(tmp(), "w.zip");
  writeTree(src, { "level.dat": "abc", "region/r.0.0.mca": "x".repeat(5000) });
  const z = zip.zipFolder(src, out, "My-world");
  assert.equal(z.files, 2);
  assert.deepEqual([...zip.openZip(fs.readFileSync(out)).keys()].sort(), ["My-world/level.dat", "My-world/region/r.0.0.mca"]);
  assert.equal(zip.verifyZip(out, 2).entries, 2);
  assert.throws(() => zip.zipFolder(src, out, "again"), /DESTINATION_EXISTS/);
  const bytes = fs.readFileSync(out);
  bytes[30 + "My-world/level.dat".length + 1] ^= 0xff;
  fs.writeFileSync(out, bytes);
  assert.throws(() => zip.verifyZip(out));
});

test("catalogue retains complete version-derived registries and labels unsupported presets", () => {
  const c = catalogue();
  assert.equal(c.supported, true);
  assert.equal(c.packFormat, 61);
  assert.deepEqual(c.biomes, ["minecraft:desert", "minecraft:plains"]);
  assert.deepEqual(c.structureSets, ["minecraft:strongholds", "minecraft:villages"]);
  assert.deepEqual(c.presets, fixturePresetIds.map((id) => `minecraft:${id}`).sort());
  assert.deepEqual(c.presetOptions.map((entry) => entry.id).sort(), c.presets);
  assert.equal(c.presetOptions.filter((entry) => entry.supported).length, 5);
  const debug = c.presetOptions.find((entry) => entry.id === "minecraft:debug_all_block_states");
  assert.equal(debug.supported, false);
  assert.match(debug.reason, /generator is not implemented/);
  assert.equal(c.blocks.length, 5);
  assert.deepEqual(c.gameRules.map((r) => [r.name, r.type]), [["futureRule", "unknown"], ["keepInventory", "boolean"], ["randomTickSpeed", "integer"]]);
});

test("an unfamiliar discovered preset remains visible and cannot enter the current pack builder", () => {
  const c = catalogue({ presetIds: [...fixturePresetIds, "future_archipelago"] });
  assert.deepEqual(c.presets, [...fixturePresetIds, "future_archipelago"].map((id) => `minecraft:${id}`).sort());
  assert.deepEqual(c.presetOptions.map((entry) => entry.id).sort(), c.presets);
  assert.equal(c.presetOptions.find((entry) => entry.id === "minecraft:future_archipelago").supported, false);
  assert.throws(() => w.validate({ ...w.defaults(c), preset: "future_archipelago" }, c), /WORLD_PRESET_UNSUPPORTED/);
});

test("preset defaults use an implemented discovered identity and no supported route is explicit", () => {
  const flat = catalogue({ presetIds: ["flat", "future_archipelago"] });
  assert.equal(w.defaults(flat).preset, "flat");
  const unknown = catalogue({ presetIds: ["future_archipelago"] });
  assert.equal(unknown.supported, false);
  assert.match(unknown.reason, /No preset in this version/);
  assert.deepEqual(unknown.presets, ["minecraft:future_archipelago"]);
  assert.equal(unknown.presetOptions[0].supported, false);
});

test("modern string states and graph settings remain discoverable without invalid editable defaults", () => {
  const c = catalogue({ packVersion: { resource_major: 97, resource_minor: 1, data_major: 121, data_minor: 0 }, noiseOverrides: {
    default_block: "minecraft:stone", default_fluid: "minecraft:water", aquifers_enabled: undefined,
    ore_veins_enabled: undefined, aquifers: { barrier: "minecraft:overworld/barrier" }, material_rule: "minecraft:overworld",
  } });
  assert.equal(c.supported, false);
  assert.equal(c.capabilities.customization.available, false);
  assert.match(c.reason, /customization builder does not support yet/);
  assert.deepEqual(c.presets, fixturePresetIds.map(id => `minecraft:${id}`).sort());
  assert.equal(c.blocks.length, 5);
  assert.equal(c.packFormat, null);
  assert.throws(() => w.defaults(c), /WORLDGEN_UNSUPPORTED/);
  assert.throws(() => w.validate({}, c), /WORLDGEN_UNSUPPORTED/);
});

test("unsupported typed fields never retain a supported customization verdict", () => {
  for (const noiseOverrides of [{ default_block: "minecraft:stone" }, { default_fluid: null }, { aquifers_enabled: undefined }, { ore_veins_enabled: "false" }, { noise: null }]) {
    const c = catalogue({ noiseOverrides });
    assert.equal(c.supported, false);
    assert.ok(c.capabilities.customization.unsupportedFields.length > 0);
    assert.throws(() => w.defaults(c), /WORLDGEN_UNSUPPORTED/);
  }
  assert.equal(catalogue({ dimensionOverrides: { logical_height: "384" } }).supported, false);
  assert.equal(catalogue().capabilities.customization.available, true);
});

test("the legacy metadata writer admits only its documented integer format range", () => {
  assert.equal(catalogue({ packVersion: { data: 81 } }).supported, true);
  for (const data of [0, 82, 88, 61.5]) {
    const c = catalogue({ packVersion: { data } });
    assert.equal(c.supported, false);
    assert.ok(c.capabilities.customization.unsupportedFields.includes("pack_format"));
  }
});

test("versions without data-driven presets are reported unsupported with a reason", () => {
  const c = catalogue({ presets: false });
  assert.equal(c.supported, false);
  assert.match(c.reason, /predates data-driven world presets/);
});

test("the default size is 100 x 100 chunks", () => {
  const d = w.defaults(catalogue());
  assert.equal(d.area.width, 100);
  assert.equal(d.area.depth, 100);
  assert.deepEqual(w.DEFAULT_AREA, { width: 100, depth: 100 });
});

test("batches never exceed the forceload limit and cover the area exactly", () => {
  for (const area of [{ width: 100, depth: 100, centerX: 0, centerZ: 0 }, { width: 1, depth: 37, centerX: -5, centerZ: 9 }, { width: 333, depth: 17, centerX: 40, centerZ: -40 }]) {
    const batches = w.planBatches(area);
    let covered = 0;
    for (const r of batches) {
      const n = (r.x2 - r.x1 + 1) * (r.z2 - r.z1 + 1);
      assert.ok(n <= w.FORCELOAD_MAX);
      covered += n;
    }
    assert.equal(covered, area.width * area.depth);
  }
  assert.equal(w.planBatches({ width: 100, depth: 100, centerX: 0, centerZ: 0 }).length, 49);
});

test("validation refuses anything without a typed, version-backed value", () => {
  const c = catalogue();
  const base = { ...w.defaults(c), output: { kind: "zip", destination: path.join(tmp(), "w.zip") } };
  assert.ok(w.validate(base, c));
  const bad = (patch, code) => assert.throws(() => w.validate({ ...base, ...patch }, c), code);
  bad({ preset: "flat", flat: { ...base.flat, layers: [{ block: "minecraft:unobtainium", height: 1 }] } }, /INVALID_FLAT_LAYER/);
  bad({ preset: "flat", flat: { ...base.flat, layers: [{ block: "minecraft:stone", height: 400 }] } }, /INVALID_FLAT/);
  bad({ dimension: { height: 380, min_y: -64, logical_height: 380 } }, /INVALID_DIMENSION/);
  bad({ dimension: { height: 384, min_y: -64, logical_height: 400 } }, /INVALID_DIMENSION/);
  bad({ gameRules: { madeUp: true } }, /INVALID_GAME_RULE/);
  bad({ gameRules: { futureRule: 1 } }, /INVALID_GAME_RULE/);
  bad({ gameRules: { randomTickSpeed: true } }, /INVALID_GAME_RULE/);
  bad({ structures: ["minecraft:castles"] }, /INVALID_STRUCTURES/);
  bad({ output: { kind: "zip", destination: path.join(tmp(), "w.tar") } }, /INVALID_OUTPUT/);
  bad({ output: { kind: "folder", destination: "relative" } }, /INVALID_OUTPUT/);
  bad({ area: { width: 0, depth: 10, centerX: 0, centerZ: 0 } }, /INVALID_AREA/);
  bad({ noise: { ...base.noise, sea_level: 9000 } }, /INVALID_NOISE/);
});

test("the data pack ties the preset, noise and dimension height together", () => {
  const c = catalogue();
  const o = w.validate({ ...w.defaults(c), preset: "single_biome_surface", singleBiome: "minecraft:desert", dimension: { height: 256, min_y: 0, logical_height: 256 }, noise: { ...w.defaults(c).noise, sea_level: 40 }, output: { kind: "zip", destination: path.join(tmp(), "a.zip") } }, c);
  const pack = w.buildPack(o, c);
  assert.equal(pack["pack.mcmeta"].pack.pack_format, 61);
  const ow = pack["data/materialbrowser/worldgen/world_preset/generated.json"].dimensions["minecraft:overworld"];
  assert.deepEqual(ow.generator.biome_source, { type: "minecraft:fixed", biome: "minecraft:desert" });
  const noise = pack["data/materialbrowser/worldgen/noise_settings/generated.json"];
  assert.equal(noise.sea_level, 40);
  assert.equal(noise.noise.height, 256);
  assert.equal(pack["data/materialbrowser/dimension_type/overworld.json"].height, 256);
  assert.match(w.serverProperties(o, 25601), /level-type=materialbrowser:generated\n/);
});

function fakeServer() {
  return (cmd, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const say = (line) => setImmediate(() => child.stdout.emit("data", Buffer.from(`${line}\n`)));
    fs.mkdirSync(path.join(opts.cwd, "world", "region"), { recursive: true });
    fs.writeFileSync(path.join(opts.cwd, "world", "level.dat"), "level");
    child.commands = [];
    child.stdin = {
      write(text) {
        const line = text.trim();
        child.commands.push(line);
        const m = /run say (MBGEN-[a-f0-9]{32}-[a-f0-9]{32}-\d+)$/.exec(line);
        if (m) say(`[12:34:56] [Server thread/INFO]: [Server] ${m[1]}`);
        if (line === "save-all flush") say("Saved the game");
        if (line === "stop") setImmediate(() => child.emit("exit", 0));
      },
    };
    fakeServer.last = child;
    say('Done (1.0s)! For help, type "help"');
    return child;
  };
}

test("generation needs EULA consent, runs the batches and writes a verified ZIP or folder", async () => {
  const c = catalogue();
  const jarPath = path.join(tmp(), "server.jar");
  fs.writeFileSync(jarPath, "jar");
  const area = { width: 20, depth: 20, centerX: 0, centerZ: 0 };
  const zipOut = path.join(tmp(), "family.zip");
  const options = { ...w.defaults(c), name: "Family", area, gameRules: { keepInventory: true }, output: { kind: "zip", destination: zipOut } };
  const deps = { spawn: fakeServer(), portFree: async () => true, pollMs: 5 };
  await assert.rejects(w.generate({ options, catalogue: c, jarPath, stagingRoot: tmp(), eulaAccepted: false, deps }), /EULA_NOT_ACCEPTED/);
  const events = [];
  const r = await w.generate({ options, catalogue: c, jarPath, stagingRoot: tmp(), eulaAccepted: true, deps, emit: (e) => events.push(e) });
  assert.equal(r.kind, "zip");
  assert.ok(fs.existsSync(zipOut));
  assert.equal(events.filter((e) => e.step === "batch").length, w.planBatches(area).length);
  const cmds = fakeServer.last.commands;
  assert.ok(cmds.includes("gamerule keepInventory true"));
  assert.ok(cmds.some((x) => x.startsWith("worldborder set 320")));
  for (const x of cmds.filter((x) => x.startsWith("forceload add"))) {
    const [x1, z1, x2, z2] = x.split(" ").slice(2).map(Number);
    assert.ok(((x2 - x1 + 1) / 16) * ((z2 - z1 + 1) / 16) <= 256);
  }
  const folderOut = path.join(tmp(), "family-folder");
  const f = await w.generate({ options: { ...options, output: { kind: "folder", destination: folderOut } }, catalogue: c, jarPath, stagingRoot: tmp(), eulaAccepted: true, deps: { ...deps, spawn: fakeServer() } });
  assert.equal(f.kind, "folder");
  assert.ok(fs.existsSync(path.join(folderOut, "datapacks", "materialbrowser-generated", "pack.mcmeta")));
  await assert.rejects(w.generate({ options: { ...options, output: { kind: "folder", destination: folderOut } }, catalogue: c, jarPath, stagingRoot: tmp(), eulaAccepted: true, deps }), /DESTINATION_EXISTS/);
});
