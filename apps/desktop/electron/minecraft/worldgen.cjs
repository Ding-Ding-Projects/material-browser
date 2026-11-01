// World generator: per-version extraction, typed options, data pack building, batch planning
// and the generation run. Pickers always come from the selected version's own server jar.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const crypto = require("node:crypto");
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
const PRESET_UNSUPPORTED_REASON = "This preset is present in the selected version, but its generator is not implemented by the world customization builder.";

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

/** Observe one exact child for its whole lifetime. Timeouts retain ownership. */
function ownChild(child, { server = false, stopTimeout = 60000, onOwned = () => {} } = {}) {
  let active = true, outcome = null, stopSent = false, spawned = false;
  const listeners = new Set();
  let resolveExit;
  const exit = new Promise((resolve) => { resolveExit = resolve; });
  const finish = (value) => {
    if (!active) return;
    active = false; outcome = value; resolveExit(value);
    for (const listener of [...listeners]) listener(value);
    listeners.clear();
  };
  child.once("spawn", () => { spawned = true; });
  child.on("error", (error) => { if (!spawned) finish({ error: fail(error.code === "ENOENT" ? "JAVA_MISSING" : "SERVER_LAUNCH_FAILED") }); });
  child.once("exit", (code) => finish({ code }));
  child.once("close", (code) => finish({ code }));
  child.stdin?.on?.("error", () => {});
  const receipt = {
    child, exit,
    get active() { return active; },
    get outcome() { return outcome; },
    subscribe(listener) { if (!active) listener(outcome); else listeners.add(listener); return () => listeners.delete(listener); },
    async wait(ms, signal) {
      return new Promise((resolve, reject) => {
        let timer, unsubscribe = () => {};
        const cleanup = () => { clearTimeout(timer); unsubscribe(); signal?.removeEventListener("abort", aborted); };
        const aborted = () => { cleanup(); reject(fail("CANCELLED")); };
        unsubscribe = receipt.subscribe((value) => { cleanup(); resolve(value); });
        if (!active) return;
        timer = setTimeout(() => { cleanup(); reject(fail("STOP_PENDING")); }, ms);
        signal?.addEventListener("abort", aborted, { once: true });
        if (signal?.aborted) aborted();
      });
    },
    requestStop() {
      if (active && !stopSent) {
        stopSent = true;
        try { if (server) child.stdin?.write("stop\n"); else child.stdin?.end?.(); } catch {}
      }
    },
    async stop() {
      receipt.requestStop();
      return receipt.wait(stopTimeout);
    },
  };
  onOwned(receipt);
  return receipt;
}

function admittedBytes(jarPath, jarBytes, integrity) {
  let bytes;
  if (jarBytes === undefined) {
    const before = fs.lstatSync(jarPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw fail("UNSAFE_JAR_PATH");
    const fd = fs.openSync(jarPath, "r");
    try {
      const opened = fs.fstatSync(fd);
      if (opened.ino !== before.ino || opened.dev !== before.dev || !opened.isFile() || opened.nlink !== 1)
        throw fail("UNSAFE_JAR_PATH");
      bytes = fs.readFileSync(fd);
    } finally { fs.closeSync(fd); }
  } else bytes = Buffer.from(jarBytes);
  if (integrity) {
    if (bytes.length !== integrity.size || crypto.createHash("sha1").update(bytes).digest("hex") !== integrity.sha1)
      throw fail("JAR_INTEGRITY_FAILED");
    verifyJarIdentity(bytes, integrity.version);
  }
  return bytes;
}

/** Report generation is owned too; cancellation never force-kills its JVM. */
async function runReports(jarPath, outDir, { spawnImpl = spawn, java = "java", timeout = 300000, signal, onOwned, stopTimeout, jarBytes, jarIntegrity } = {}) {
  if (signal?.aborted) throw fail("CANCELLED");
  fs.mkdirSync(outDir, { recursive: true });
  const runtimeDir = fs.mkdtempSync(path.join(outDir, ".runtime-"));
  const snapshot = path.join(runtimeDir, "server.jar");
  fs.writeFileSync(snapshot, admittedBytes(jarPath, jarBytes, jarIntegrity), { flag: "wx", mode: 0o600 });
  admittedBytes(snapshot, undefined, jarIntegrity);
  const child = spawnImpl(java, ["-DbundlerMainClass=net.minecraft.data.Main", "-jar", snapshot, "--reports", "--output", outDir], { cwd: outDir, windowsHide: true });
  const receipt = ownChild(child, { onOwned, stopTimeout });
  receipt.exit.then(() => { try { fs.rmSync(runtimeDir, { recursive: true, force: true }); } catch {} });
  child.stdout?.resume?.(); child.stderr?.resume?.();
  try {
    const result = await receipt.wait(timeout, signal);
    if (result.error) throw result.error;
    if (result.code !== 0) throw fail("REPORTS_FAILED");
  } catch (error) {
    if (receipt.active) await receipt.stop();
    throw error;
  }
}

/** Admit only the command-report route actually used by readiness probes. */
function readinessCapability(commands) {
  const execute = commands?.children?.execute?.children;
  const position = execute?.if?.children?.loaded?.children?.pos;
  const run = execute?.run;
  const message = commands?.children?.say?.children?.message;
  // The vanilla report exporter omits an empty root redirect on execute run.
  const available = position?.type === "argument" && position.parser === "minecraft:block_pos" &&
    Array.isArray(position.redirect) && position.redirect.length === 1 && position.redirect[0] === "execute" &&
    run?.type === "literal" && (run.redirect === undefined || (Array.isArray(run.redirect) && run.redirect.length === 0)) &&
    message?.parser === "minecraft:message" && message.executable === true;
  return {
    available,
    route: available ? "execute-if-loaded-say" : null,
    reason: available ? null : "This version's command report does not provide the verified execute if loaded readiness route. World generation remains unavailable for this version.",
  };
}

/** Turn a jar and its reports into the picker catalogue for that exact version. */
function catalogueFrom(jarBuffer, reportsDir) {
  const jar = innerJar(openZip(jarBuffer));
  const version = readJson(jar, "version.json");
  const presets = stems(jar, "data/minecraft/worldgen/world_preset");
  if (!presets.length)
    return { supported: false, reason: "This version predates data-driven world presets, so only seed, world type and structures can be set.", version: version?.id ?? null, presets: [], presetOptions: [] };
  const registries = JSON.parse(fs.readFileSync(path.join(reportsDir, "reports", "registries.json"), "utf8"));
  const commands = JSON.parse(fs.readFileSync(path.join(reportsDir, "reports", "commands.json"), "utf8"));
  const readiness = readinessCapability(commands);
  const presetOptions = presets.map((id) => {
    const supported = PRESET_IDS.includes(id.slice(10));
    return { id, supported, reason: supported ? null : PRESET_UNSUPPORTED_REASON };
  });
  const hasImplementedPreset = presetOptions.some((entry) => entry.supported);
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
    supported: readiness.available && hasImplementedPreset,
    reason: readiness.reason || (hasImplementedPreset ? null : "No preset in this version has an implemented customization route."),
    capabilities: { chunkReadiness: readiness },
    version: version.id,
    packFormat: version.pack_version?.data ?? version.pack_version,
    presets,
    presetOptions,
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
  const supportedPresets = catalogue.presets.filter((id) => PRESET_IDS.includes(id.slice(10)));
  if (!supportedPresets.length) throw fail("WORLDGEN_UNSUPPORTED", "No preset in this version has an implemented customization route.");
  return {
    name: "Generated world",
    seed: "",
    preset: (supportedPresets.includes("minecraft:normal") ? "minecraft:normal" : supportedPresets[0]).slice(10),
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
  if (!catalogue.supported || catalogue.capabilities?.chunkReadiness?.available !== true)
    throw fail("WORLDGEN_UNSUPPORTED", catalogue.reason || "No verified chunk readiness route is available.");
  const o = { ...defaults(catalogue), ...options };
  if (typeof o.name !== "string" || !/^[A-Za-z0-9 _-]{1,40}$/.test(o.name)) throw fail("INVALID_NAME");
  if (typeof o.seed !== "string" || o.seed.length > 64 || /[\r\n]/.test(o.seed)) throw fail("INVALID_SEED");
  if (!catalogue.presets.includes(`minecraft:${o.preset}`)) throw fail("INVALID_PRESET");
  if (!PRESET_IDS.includes(o.preset)) throw fail("WORLD_PRESET_UNSUPPORTED", PRESET_UNSUPPORTED_REASON);
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
async function generate({ options, catalogue, jarPath, jarBytes, jarIntegrity, stagingRoot, eulaAccepted, emit = () => {}, signal, deps = {} }) {
  if (eulaAccepted !== true) throw fail("EULA_NOT_ACCEPTED");
  const o = validate(options, catalogue);
  if (fs.existsSync(o.output.destination)) throw fail("DESTINATION_EXISTS");
  const spawnImpl = deps.spawn || spawn;
  if (signal?.aborted) throw fail("CANCELLED");
  const dir = path.join(stagingRoot, `run-${crypto.randomUUID()}`);
  const world = path.join(dir, "world");
  fs.mkdirSync(path.join(world, "datapacks", PACK), { recursive: true });
  for (const [rel, value] of Object.entries(buildPack(o, catalogue))) atomicWrite(path.join(world, "datapacks", PACK, rel), JSON.stringify(value, null, 2));
  fs.writeFileSync(path.join(dir, "server.jar"), admittedBytes(jarPath, jarBytes, jarIntegrity), { flag: "wx", mode: 0o600 });
  let port = 0;
  for (let p = 25600; p < 25700; p++) if (await (deps.portFree || portFree)(p, "127.0.0.1")) { port = p; break; }
  if (!port) throw fail("NO_FREE_PORT");
  fs.writeFileSync(path.join(dir, "server.properties"), serverProperties(o, port));
  fs.writeFileSync(path.join(dir, "eula.txt"), "# Accepted in Material Browser by the user for this world generation.\neula=true\n");
  const step = (key, detail) => emit({ type: "minecraft.worldgen", step: key, detail });
  step("start");
  if (signal?.aborted) throw fail("CANCELLED");
  admittedBytes(path.join(dir, "server.jar"), undefined, jarIntegrity);
  const child = spawnImpl(deps.java || "java", ["-Xmx2G", "-jar", "server.jar", "nogui"], { cwd: dir, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const receipt = ownChild(child, { server: true, stopTimeout: deps.stopTimeout, onOwned: deps.onOwned });
  const waiters = new Set();
  let buffer = "", outputError = null;
  const rejectWaiters = (error) => { for (const waiter of [...waiters]) waiter.reject(error); };
  child.stdout.on("data", (data) => {
    buffer += data.toString("utf8");
    if (buffer.length > 65536) { buffer = ""; outputError = fail("SERVER_OUTPUT_TOO_LARGE"); rejectWaiters(outputError); return; }
    const lines = buffer.split(/\r?\n/); buffer = lines.pop();
    for (const line of lines) for (const waiter of [...waiters]) if (waiter.test.test(line)) waiter.resolve(line);
  });
  child.stderr?.on("data", () => {});
  const waitFor = (test, ms) => new Promise((resolve, reject) => {
    let timer, unsubscribe = () => {};
    const cleanup = () => { clearTimeout(timer); waiters.delete(waiter); unsubscribe(); signal?.removeEventListener("abort", aborted); };
    const waiter = { test, resolve: (line) => { cleanup(); resolve(line); }, reject: (error) => { cleanup(); reject(error); } };
    const aborted = () => waiter.reject(fail("CANCELLED"));
    waiters.add(waiter);
    unsubscribe = receipt.subscribe((result) => waiter.reject(result.error || fail("SERVER_EXITED")));
    if (!receipt.active) return;
    timer = setTimeout(() => waiter.reject(fail("SERVER_TIMEOUT")), ms);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted(); else if (outputError) waiter.reject(outputError);
  });
  const send = (cmd) => {
    if (!receipt.active) throw receipt.outcome?.error || fail("SERVER_EXITED");
    if (signal?.aborted) throw fail("CANCELLED");
    child.stdin.write(`${cmd}\n`);
  };
  try {
    await waitFor(/Done \(/, deps.startTimeout ?? 600000);
    step("ready");
    for (const cmd of setupCommands(o)) send(cmd);
    const runIdentity = crypto.randomBytes(16).toString("hex");
    const batches = planBatches(o.area);
    for (let i = 0; i < batches.length; i++) {
      const r = batches[i];
      const bx1 = r.x1 * 16, bz1 = r.z1 * 16, bx2 = r.x2 * 16 + 15, bz2 = r.z2 * 16 + 15;
      send(`forceload add ${bx1} ${bz1} ${bx2} ${bz2}`);
      const batchIdentity = crypto.randomBytes(16).toString("hex");
      const pending = new Map();
      const y = probeY(o.dimension);
      for (let z = r.z1; z <= r.z2; z++) for (let x = r.x1; x <= r.x2; x++) {
        const tag = `MBGEN-${runIdentity}-${batchIdentity}-${pending.size}`;
        pending.set(tag, `execute if loaded ${x * 16} ${y} ${z * 16} run say ${tag}`);
      }
      // One exact current-run/current-batch response per requested chunk. Diagnostic
      // echoes, player chat and partial text never discharge a readiness probe.
      const response = /^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: \[Server\] (MBGEN-[a-f0-9]{32}-[a-f0-9]{32}-\d+)$/;
      const done = waitFor({ test(line) {
        const match = response.exec(line);
        if (!match || !pending.delete(match[1])) return false;
        return pending.size === 0;
      } }, deps.batchTimeout ?? 300000);
      const poll = setInterval(() => {
        try { for (const command of pending.values()) send(command); }
        catch (error) { rejectWaiters(error); }
      }, deps.pollMs ?? 1000);
      try { await done; } finally { clearInterval(poll); }
      send(`forceload remove ${bx1} ${bz1} ${bx2} ${bz2}`);
      emit({ type: "minecraft.worldgen", step: "batch", done: i + 1, total: batches.length });
    }
    const saved = waitFor(/Saved the game/, deps.saveTimeout ?? 300000);
    send("save-all flush");
    await saved;
    receipt.requestStop();
    const result = await receipt.wait(deps.stopTimeout ?? 60000, signal);
    if (result.error) throw result.error;
    if (result.code !== 0) throw fail("SERVER_EXITED");
    step("saved");
  } catch (error) {
    rejectWaiters(error);
    if (receipt.active) await receipt.stop();
    throw error;
  }
  if (signal?.aborted) throw fail("CANCELLED");
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

module.exports = { admittedBytes, ownChild, verifyJarIdentity, probeY, NAMESPACE, DEFAULT_AREA, FORCELOAD_MAX, PRESET_IDS, runReports, catalogueFrom, defaults, validate, chunkBounds, planBatches, buildPack, serverProperties, setupCommands, generate, innerJar };
