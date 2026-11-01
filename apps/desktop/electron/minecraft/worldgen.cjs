// World generator: per-version extraction, typed options, data pack building, batch planning
// and the generation run. Pickers always come from the selected version's own server jar.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { fail, atomicWrite } = require("./util.cjs");
const { openZip, zipFolder, verifyZip } = require("./zip.cjs");
const { localTreeDigest } = require("./hostfs.cjs");
const { portFree } = require("./targets.cjs");

const NAMESPACE = "materialbrowser";
const PACK = "materialbrowser-generated";
const DEFAULT_AREA = Object.freeze({ width: 100, depth: 100 });
const MAX_AREA_CHUNKS = 1000;
const FORCELOAD_MAX = 256;
const PRESET_IDS = ["normal", "flat", "large_biomes", "amplified", "single_biome_surface"];

/** Bundled server jars (1.18 and newer) keep the real server jar inside META-INF/versions. */
function innerJar(outer) {
  for (const [name, entry] of outer) if (/^META-INF\/versions\/[^/]+\/[^/]+\.jar$/.test(name)) return openZip(entry.read());
  return outer;
}

function verifyJarIdentity(bytes, expectedVersion) {
  const version = readJson(innerJar(openZip(bytes)), "version.json");
  if (!version || version.id !== expectedVersion) throw fail("JAR_VERSION_MISMATCH");
}

function probeY(dimension) {
  return Math.max(dimension.min_y, Math.min(0, dimension.min_y + dimension.height - 1));
}

function stems(jar, folder) {
  const out = [];
  for (const name of jar.keys()) {
    const m = new RegExp(`^${folder}/([a-z0-9_./-]+)\\.json$`).exec(name);
    if (m) out.push(`minecraft:${m[1]}`);
  }
  return out.sort();
}

function readJson(jar, name) {
  const entry = jar.get(name);
  return entry ? JSON.parse(entry.read().toString("utf8")) : null;
}

/** Run Mojang's data generator for the registry and command reports. It does not start a server. */
function runReports(jarPath, outDir, { spawnImpl = spawn, java = "java", timeout = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outDir, { recursive: true });
    const child = spawnImpl(java, ["-DbundlerMainClass=net.minecraft.data.Main", "-jar", jarPath, "--reports", "--output", outDir], { cwd: outDir, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      reject(fail("REPORTS_TIMEOUT"));
    }, timeout);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(fail(e.code === "ENOENT" ? "JAVA_MISSING" : "REPORTS_FAILED"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(fail("REPORTS_FAILED", String(code)));
    });
  });
}

/** Turn a jar and its reports into the picker catalogue for that exact version. */
function catalogueFrom(jarBuffer, reportsDir) {
  const jar = innerJar(openZip(jarBuffer));
  const version = readJson(jar, "version.json");
  const presets = stems(jar, "data/minecraft/worldgen/world_preset");
  if (!presets.length)
    return { supported: false, reason: "This version predates data-driven world presets, so only seed, world type and structures can be set.", version: version?.id ?? null };
  const registries = JSON.parse(fs.readFileSync(path.join(reportsDir, "reports", "registries.json"), "utf8"));
  const commands = JSON.parse(fs.readFileSync(path.join(reportsDir, "reports", "commands.json"), "utf8"));
  const rules = commands?.children?.gamerule?.children || {};
  const gameRules = Object.entries(rules)
    .map(([name, node]) => {
      const parser = node?.children?.value?.parser;
      return { name, type: parser === "brigadier:bool" ? "boolean" : parser === "brigadier:integer" ? "integer" : "unknown", parser };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const flatPresets = stems(jar, "data/minecraft/worldgen/flat_level_generator_preset").map((id) => ({
    id,
    settings: readJson(jar, `data/minecraft/worldgen/flat_level_generator_preset/${id.slice(10)}.json`)?.settings ?? null,
  }));
  const overworldNoise = readJson(jar, "data/minecraft/worldgen/noise_settings/overworld.json");
  const overworldType = readJson(jar, "data/minecraft/dimension_type/overworld.json");
  return {
    supported: true,
    version: version.id,
    packFormat: version.pack_version?.data ?? version.pack_version,
    presets: presets.filter((p) => PRESET_IDS.includes(p.slice(10))),
    biomes: stems(jar, "data/minecraft/worldgen/biome"),
    structureSets: stems(jar, "data/minecraft/worldgen/structure_set"),
    blocks: Object.keys(registries["minecraft:block"]?.entries || {}).sort(),
    gameRules,
    flatPresets,
    noise: overworldNoise && {
      sea_level: overworldNoise.sea_level,
      aquifers_enabled: overworldNoise.aquifers_enabled,
      ore_veins_enabled: overworldNoise.ore_veins_enabled,
      disable_mob_generation: overworldNoise.disable_mob_generation,
      default_block: overworldNoise.default_block?.Name,
      default_fluid: overworldNoise.default_fluid?.Name,
      height: overworldNoise.noise.height,
      min_y: overworldNoise.noise.min_y,
    },
    dimension: overworldType && { height: overworldType.height, min_y: overworldType.min_y, logical_height: overworldType.logical_height },
    raw: { jarNoise: (name) => readJson(jar, `data/minecraft/worldgen/noise_settings/${name}.json`), overworldType },
  };
}

function defaults(catalogue) {
  return {
    name: "Generated world",
    seed: "",
    preset: "normal",
    flat: catalogue.flatPresets.find((p) => p.id === "minecraft:classic_flat")?.settings || { biome: "minecraft:plains", features: false, lakes: false, layers: [{ block: "minecraft:bedrock", height: 1 }], structure_overrides: [] },
    singleBiome: "minecraft:plains",
    structures: catalogue.structureSets.slice(),
    generateStructures: true,
    noise: { ...catalogue.noise },
    dimension: { ...catalogue.dimension },
    difficulty: "normal",
    hardcore: false,
    gameRules: {},
    area: { ...DEFAULT_AREA, centerX: 0, centerZ: 0 },
    worldBorder: true,
    output: { kind: "zip", destination: "" },
  };
}

const isInt = (v) => Number.isInteger(v);

/** Validate every option against the version's catalogue. Anything not typed is refused. */
function validate(options, catalogue) {
  if (!catalogue.supported) throw fail("WORLDGEN_UNSUPPORTED", catalogue.reason);
  const o = { ...defaults(catalogue), ...options };
  if (typeof o.name !== "string" || !/^[A-Za-z0-9 _-]{1,40}$/.test(o.name)) throw fail("INVALID_NAME");
  if (typeof o.seed !== "string" || o.seed.length > 64 || /[\r\n]/.test(o.seed)) throw fail("INVALID_SEED");
  if (!PRESET_IDS.includes(o.preset) || !catalogue.presets.includes(`minecraft:${o.preset}`)) throw fail("INVALID_PRESET");
  if (!["peaceful", "easy", "normal", "hard"].includes(o.difficulty)) throw fail("INVALID_DIFFICULTY");
  if (typeof o.hardcore !== "boolean" || typeof o.generateStructures !== "boolean" || typeof o.worldBorder !== "boolean") throw fail("INVALID_REQUEST");
  const blocks = new Set(catalogue.blocks), biomes = new Set(catalogue.biomes), sets = new Set(catalogue.structureSets);
  if (!Array.isArray(o.structures) || o.structures.some((s) => !sets.has(s))) throw fail("INVALID_STRUCTURES");
  const dim = o.dimension;
  if (!isInt(dim.height) || !isInt(dim.min_y) || dim.height % 16 || dim.min_y % 16 || dim.height < 16 || dim.height > 4064 || dim.min_y < -2032 || dim.min_y + dim.height > 2032)
    throw fail("INVALID_DIMENSION", "height and min_y must be multiples of 16 within -2032 to 2031");
  if (!isInt(dim.logical_height) || dim.logical_height < 0 || dim.logical_height > dim.height) throw fail("INVALID_DIMENSION", "logical height cannot exceed height");
  if (o.preset === "flat") {
    const f = o.flat;
    if (!f || !Array.isArray(f.layers) || f.layers.length > 64) throw fail("INVALID_FLAT");
    let total = 0;
    for (const l of f.layers) {
      if (!blocks.has(l.block) || !isInt(l.height) || l.height < 1 || l.height > dim.height) throw fail("INVALID_FLAT_LAYER", String(l.block));
      total += l.height;
    }
    if (total > dim.height) throw fail("INVALID_FLAT", "layers are taller than the world");
    if (!biomes.has(f.biome)) throw fail("INVALID_BIOME");
  }
  if (o.preset === "single_biome_surface" && !biomes.has(o.singleBiome)) throw fail("INVALID_BIOME");
  const n = o.noise;
  if (!isInt(n.sea_level) || n.sea_level < dim.min_y || n.sea_level > dim.min_y + dim.height) throw fail("INVALID_NOISE", "sea level must be inside the world");
  if (!blocks.has(n.default_block) || !blocks.has(n.default_fluid)) throw fail("INVALID_NOISE");
  for (const k of ["aquifers_enabled", "ore_veins_enabled", "disable_mob_generation"]) if (typeof n[k] !== "boolean") throw fail("INVALID_NOISE", k);
  const rules = new Map(catalogue.gameRules.map((r) => [r.name, r]));
  for (const [name, value] of Object.entries(o.gameRules || {})) {
    const rule = rules.get(name);
    if (!rule || rule.type === "unknown") throw fail("INVALID_GAME_RULE", name);
    if (rule.type === "boolean" ? typeof value !== "boolean" : !isInt(value)) throw fail("INVALID_GAME_RULE", name);
  }
  const a = o.area;
  for (const k of ["width", "depth"]) if (!isInt(a[k]) || a[k] < 1 || a[k] > MAX_AREA_CHUNKS) throw fail("INVALID_AREA");
  if (!isInt(a.centerX) || !isInt(a.centerZ) || Math.abs(a.centerX) > 100000 || Math.abs(a.centerZ) > 100000) throw fail("INVALID_AREA");
  if (!o.output || !["folder", "zip"].includes(o.output.kind) || typeof o.output.destination !== "string" || !path.isAbsolute(o.output.destination))
    throw fail("INVALID_OUTPUT");
  if (o.output.kind === "zip" && !/\.zip$/i.test(o.output.destination)) throw fail("INVALID_OUTPUT", "a ZIP file name must end in .zip");
  return o;
}

/** Chunk rectangle covered by the area, as inclusive chunk coordinates. */
function chunkBounds(area) {
  const x1 = area.centerX - Math.floor(area.width / 2), z1 = area.centerZ - Math.floor(area.depth / 2);
  return { x1, z1, x2: x1 + area.width - 1, z2: z1 + area.depth - 1 };
}

/** Split the area into forceload rectangles of at most 16 x 16 chunks (256, the command's limit). */
function planBatches(area) {
  const b = chunkBounds(area), out = [];
  for (let z = b.z1; z <= b.z2; z += 16)
    for (let x = b.x1; x <= b.x2; x += 16) out.push({ x1: x, z1: z, x2: Math.min(x + 15, b.x2), z2: Math.min(z + 15, b.z2) });
  return out;
}

/** The private data pack: one world preset plus edited noise settings and dimension type. */
function buildPack(o, catalogue) {
  const ns = NAMESPACE;
  const base = o.preset === "large_biomes" ? "large_biomes" : o.preset === "amplified" ? "amplified" : "overworld";
  const noise = JSON.parse(JSON.stringify(catalogue.raw.jarNoise(base)));
  noise.sea_level = o.noise.sea_level;
  noise.aquifers_enabled = o.noise.aquifers_enabled;
  noise.ore_veins_enabled = o.noise.ore_veins_enabled;
  noise.disable_mob_generation = o.noise.disable_mob_generation;
  noise.default_block = { Name: o.noise.default_block };
  noise.default_fluid = { Name: o.noise.default_fluid, Properties: { level: "0" } };
  noise.noise.min_y = o.dimension.min_y;
  noise.noise.height = o.dimension.height;
  const dimensionType = { ...catalogue.raw.overworldType, height: o.dimension.height, min_y: o.dimension.min_y, logical_height: o.dimension.logical_height };
  let overworld;
  if (o.preset === "flat") {
    overworld = {
      type: `${ns}:overworld`,
      generator: { type: "minecraft:flat", settings: { biome: o.flat.biome, features: !!o.flat.features, lakes: !!o.flat.lakes, layers: o.flat.layers.map((l) => ({ block: l.block, height: l.height })), structure_overrides: o.structures } },
    };
  } else {
    overworld = {
      type: `${ns}:overworld`,
      generator: {
        type: "minecraft:noise",
        biome_source: o.preset === "single_biome_surface" ? { type: "minecraft:fixed", biome: o.singleBiome } : { type: "minecraft:multi_noise", preset: "minecraft:overworld" },
        settings: `${ns}:generated`,
      },
    };
  }
  const preset = {
    dimensions: {
      "minecraft:overworld": overworld,
      "minecraft:the_nether": { type: "minecraft:the_nether", generator: { type: "minecraft:noise", biome_source: { type: "minecraft:multi_noise", preset: "minecraft:nether" }, settings: "minecraft:nether" } },
      "minecraft:the_end": { type: "minecraft:the_end", generator: { type: "minecraft:noise", biome_source: { type: "minecraft:the_end" }, settings: "minecraft:end" } },
    },
  };
  return {
    "pack.mcmeta": { pack: { pack_format: catalogue.packFormat, description: "World settings chosen in Material Browser" } },
    [`data/${ns}/worldgen/world_preset/generated.json`]: preset,
    [`data/${ns}/worldgen/noise_settings/generated.json`]: noise,
    [`data/${ns}/dimension_type/overworld.json`]: dimensionType,
  };
}

function serverProperties(o, port) {
  const lines = {
    "level-name": "world",
    "level-seed": o.seed,
    "level-type": `${NAMESPACE}:generated`,
    "generate-structures": String(o.generateStructures),
    difficulty: o.difficulty,
    hardcore: String(o.hardcore),
    "server-ip": "127.0.0.1",
    "server-port": String(port),
    "enable-status": "false",
    "max-players": "1",
    "spawn-protection": "0",
    "online-mode": "true",
  };
  return Object.entries(lines).map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, "")}`).join("\n") + "\n";
}

function setupCommands(o) {
  const cmds = [];
  for (const [rule, value] of Object.entries(o.gameRules || {})) cmds.push(`gamerule ${rule} ${value}`);
  const b = chunkBounds(o.area);
  if (o.worldBorder) {
    const cx = ((b.x1 + b.x2 + 1) * 16) / 2, cz = ((b.z1 + b.z2 + 1) * 16) / 2;
    cmds.push(`worldborder center ${cx} ${cz}`, `worldborder set ${Math.max(o.area.width, o.area.depth) * 16}`);
  }
  return cmds;
}

/**
 * Run the generation. `deps.spawn` launches java; events report each step and batch.
 * The caller supplies an EULA flag the user switched on; without it nothing starts.
 */
async function generate({ options, catalogue, jarPath, stagingRoot, eulaAccepted, emit = () => {}, signal, deps = {} }) {
  if (eulaAccepted !== true) throw fail("EULA_NOT_ACCEPTED");
  const o = validate(options, catalogue);
  if (fs.existsSync(o.output.destination)) throw fail("DESTINATION_EXISTS");
  const spawnImpl = deps.spawn || spawn;
  const dir = path.join(stagingRoot, `run-${Date.now()}`);
  const world = path.join(dir, "world");
  fs.mkdirSync(path.join(world, "datapacks", PACK), { recursive: true });
  for (const [rel, value] of Object.entries(buildPack(o, catalogue))) atomicWrite(path.join(world, "datapacks", PACK, rel), JSON.stringify(value, null, 2));
  fs.copyFileSync(jarPath, path.join(dir, "server.jar"));
  let port = 0;
  for (let p = 25600; p < 25700; p++) if (await (deps.portFree || portFree)(p, "127.0.0.1")) { port = p; break; }
  if (!port) throw fail("NO_FREE_PORT");
  fs.writeFileSync(path.join(dir, "server.properties"), serverProperties(o, port));
  fs.writeFileSync(path.join(dir, "eula.txt"), "# Accepted in Material Browser by the user for this world generation.\neula=true\n");
  const step = (key, detail) => emit({ type: "minecraft.worldgen", step: key, detail });
  step("start");
  const child = spawnImpl(deps.java || "java", ["-Xmx2G", "-jar", "server.jar", "nogui"], { cwd: dir, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const waiters = [];
  let exited = false;
  const onLine = (line) => {
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].test.test(line)) waiters.splice(i, 1)[0].resolve(line);
  };
  let buffer = "";
  child.stdout.on("data", (d) => {
    buffer += d.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    lines.forEach(onLine);
  });
  child.stderr?.on("data", () => {});
  const exit = new Promise((resolve) => child.on("exit", (code) => { exited = true; resolve(code); }));
  const waitFor = (test, ms) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = waiters.indexOf(w);
        if (i >= 0) { waiters.splice(i, 1); reject(fail("SERVER_TIMEOUT")); }
      }, ms);
      const w = { test, resolve: (line) => { clearTimeout(timer); resolve(line); } };
      waiters.push(w);
      exit.then(() => { clearTimeout(timer); reject(fail("SERVER_EXITED")); });
    });
  const send = (cmd) => child.stdin.write(`${cmd}\n`);
  const cancelled = () => signal?.aborted;
  try {
    await waitFor(/Done \(/, deps.startTimeout ?? 600000);
    step("ready");
    for (const cmd of setupCommands(o)) send(cmd);
    const batches = planBatches(o.area);
    for (let i = 0; i < batches.length; i++) {
      if (cancelled()) throw fail("CANCELLED");
      const r = batches[i];
      const bx1 = r.x1 * 16, bz1 = r.z1 * 16, bx2 = r.x2 * 16 + 15, bz2 = r.z2 * 16 + 15;
      send(`forceload add ${bx1} ${bz1} ${bx2} ${bz2}`);
      const tag = `MBGEN-${i}`;
      const done = waitFor(new RegExp(`\\b${tag}\\b`), deps.batchTimeout ?? 300000);
      const y = probeY(o.dimension);
      const poll = setInterval(() => send(`execute if loaded ${bx1} ${y} ${bz1} if loaded ${bx2} ${y} ${bz2} if loaded ${bx1} ${y} ${bz2} if loaded ${bx2} ${y} ${bz1} run say ${tag}`), deps.pollMs ?? 1000);
      try {
        await done;
      } finally {
        clearInterval(poll);
      }
      send(`forceload remove ${bx1} ${bz1} ${bx2} ${bz2}`);
      emit({ type: "minecraft.worldgen", step: "batch", done: i + 1, total: batches.length });
    }
    send("save-all flush");
    await waitFor(/Saved the game/, deps.saveTimeout ?? 300000);
    send("stop");
    await exit;
    step("saved");
  } catch (error) {
    if (!exited) {
      send("stop");
      let t;
      await Promise.race([exit, new Promise((r) => { t = setTimeout(r, 60000); })]);
      clearTimeout(t);
    }
    throw error;
  }
  for (const f of ["session.lock"]) fs.rmSync(path.join(world, f), { force: true });
  const digest = localTreeDigest(world);
  let result;
  if (o.output.kind === "folder") {
    fs.cpSync(world, o.output.destination, { recursive: true, errorOnExist: true, force: false });
    const copied = localTreeDigest(o.output.destination);
    if (copied.sha256 !== digest.sha256) throw fail("OUTPUT_VERIFY_FAILED");
    result = { kind: "folder", path: o.output.destination, files: copied.files };
  } else {
    const z = zipFolder(world, o.output.destination, o.name.replace(/\s+/g, "-"));
    verifyZip(o.output.destination, z.files);
    result = { kind: "zip", path: o.output.destination, files: z.files, bytes: z.bytes };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  step("done");
  return { ...result, sha256: digest.sha256, chunksRequested: o.area.width * o.area.depth };
}

module.exports = { verifyJarIdentity, probeY, NAMESPACE, DEFAULT_AREA, FORCELOAD_MAX, PRESET_IDS, runReports, catalogueFrom, defaults, validate, chunkBounds, planBatches, buildPack, serverProperties, setupCommands, generate, innerJar };
