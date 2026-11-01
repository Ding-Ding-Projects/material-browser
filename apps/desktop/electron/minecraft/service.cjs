// The Minecraft server manager service: a registry of servers this app created or adopted,
// guided creation, lifecycle, configuration, players, plugins and backups.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const util = require("./util.cjs");
const catalogue = require("./catalogue.cjs");
const properties = require("./properties.cjs");
const targets = require("./targets.cjs");
const content = require("./content.cjs");

const { fail } = util;
const FLAVOURS = ["vanilla", "paper", "fabric"];

function createService({ root, emit = () => {}, fetchImpl = fetch, deps = {} }) {
  const registryFile = path.join(root, "servers.json");
  const processes = new Map();
  const jobs = new Map();

  function load() {
    try {
      const value = JSON.parse(fs.readFileSync(registryFile, "utf8"));
      return Array.isArray(value.servers) ? value.servers : [];
    } catch {
      return [];
    }
  }
  function save(servers) {
    util.atomicWrite(registryFile, JSON.stringify({ v: 1, servers }, null, 2));
  }
  function find(id) {
    util.assertId(id);
    const server = load().find((s) => s.id === id);
    if (!server) throw fail("SERVER_NOT_FOUND");
    return server;
  }
  function update(id, patch) {
    const servers = load();
    const i = servers.findIndex((s) => s.id === id);
    if (i < 0) throw fail("SERVER_NOT_FOUND");
    servers[i] = { ...servers[i], ...patch, updatedAt: new Date().toISOString() };
    save(servers);
    return servers[i];
  }
  const adapter = (server) => targets.adapterFor(server, { ...deps, emit, processes });

  /** Validate a creation plan before anything is downloaded or written. */
  function validatePlan(plan) {
    if (!plan || typeof plan !== "object") throw fail("INVALID_REQUEST");
    if (!targets.TARGETS[plan.target]) throw fail("UNKNOWN_TARGET");
    if (plan.edition !== "java") throw fail("EDITION_UNAVAILABLE", catalogue.BEDROCK_STATUS.reason);
    if (!FLAVOURS.includes(plan.flavour)) throw fail("UNKNOWN_FLAVOUR");
    if (typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 60) throw fail("INVALID_NAME");
    if (typeof plan.version !== "string" || !/^[A-Za-z0-9._ -]{1,40}$/.test(plan.version)) throw fail("INVALID_VERSION");
    util.assertPort(plan.port);
    targets.javaOptions(plan.memoryMb);
    const shell = targets.TARGETS[plan.target].shell;
    const ssh = shell ? util.assertSshHost(plan.ssh) : undefined;
    const folder = shell ? util.assertRemotePath(plan.folder) : util.assertLocalFolder(plan.folder);
    if (plan.eulaAccepted !== true && plan.eulaAccepted !== false) throw fail("INVALID_REQUEST");
    return { ...plan, name: plan.name.trim(), ssh, folder };
  }

  /** Resolve the exact server file for the plan from the right catalogue. */
  async function resolveDistribution(plan, signal) {
    const java = await catalogue.javaCatalogue(root, { fetchImpl, signal });
    const entry = java.versions.find((v) => v.id === plan.version);
    if (!entry) throw fail("VERSION_NOT_IN_CATALOGUE");
    const detail = await catalogue.javaVersionDetail(root, entry, { fetchImpl, signal });
    if (plan.flavour === "vanilla") {
      if (!detail.server) throw fail("NO_SERVER_DOWNLOAD", detail.unavailableReason);
      return { url: detail.server.url, expect: { sha1: detail.server.sha1, size: detail.server.size }, javaMajor: detail.javaMajor, source: "Mojang version metadata" };
    }
    if (plan.flavour === "paper") {
      const build = await catalogue.paperBuild(plan.version, { fetchImpl, signal });
      return { url: build.url, expect: { sha256: build.sha256, size: build.size }, javaMajor: detail.javaMajor, source: `Paper build ${build.build}` };
    }
    const fabric = await catalogue.fabricVersions(root, { fetchImpl, signal });
    if (!fabric.versions.includes(plan.version)) throw fail("NO_BUILD_FOR_VERSION");
    return {
      url: catalogue.fabricServerUrl(plan.version, fabric.loader, fabric.installer),
      expect: {},
      javaMajor: detail.javaMajor,
      source: `Fabric loader ${fabric.loader}`,
      integrityNote: "Fabric publishes no checksum for its server launcher, so its bytes cannot be verified against the catalogue.",
    };
  }

  /** Guided creation as a cancellable job with progress events. */
  function create(rawPlan) {
    const plan = validatePlan(rawPlan);
    const id = `${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "server"}-${randomUUID().slice(0, 6)}`;
    const controller = new AbortController();
    const job = { id, steps: [], state: "running", controller };
    jobs.set(id, job);
    const step = (key, state, detail) => {
      const existing = job.steps.find((s) => s.key === key);
      if (existing) Object.assign(existing, { state, detail });
      else job.steps.push({ key, state, detail });
      emit({ type: "minecraft.create", id, steps: job.steps, state: job.state });
    };
    (async () => {
      let server = { id, ...plan, edition: "java", createdAt: new Date().toISOString() };
      const a = adapter(server);
      try {
        step("target", "running");
        const probe = await a.probe();
        if (!probe.ready) throw fail("TARGET_NOT_READY", probe.problem);
        step("target", "done", probe.label);
        step("download", "running");
        const dist = await resolveDistribution(plan, controller.signal);
        if (!plan.target.includes("docker") && probe.javaMajor && dist.javaMajor && probe.javaMajor < dist.javaMajor)
          throw fail("JAVA_TOO_OLD", `${probe.javaMajor} < ${dist.javaMajor}`);
        const local = path.join(root, "downloads", `${id}.jar`);
        const got = await util.downloadVerified(dist.url, local, dist.expect, {
          fetchImpl,
          signal: controller.signal,
          onProgress: (bytes, total) => emit({ type: "minecraft.progress", id, bytes, total }),
        });
        step("download", "done", got.integrityKnown ? `verified by ${got.verifiedBy.join(", ")}` : dist.integrityNote);
        step("install", "running");
        await a.files.mkdir(".");
        const sha256 = await a.files.putFile(local, "server.jar");
        fs.rmSync(local, { force: true });
        const props = properties.applyChanges("", plan.version, { "server-port": plan.port, motd: plan.name.slice(0, 59) }).text;
        if (!(await a.files.readText("server.properties"))) await a.files.writeText("server.properties", props);
        if (plan.eulaAccepted) await a.files.writeText("eula.txt", "# Accepted in Material Browser by the user.\neula=true\n");
        server = { ...server, javaMajor: dist.javaMajor, jar: { sha256, source: dist.source, verifiedBy: got.verifiedBy, integrityKnown: got.integrityKnown } };
        if (targets.TARGETS[plan.target].docker) {
          step("runtime", "running");
          const runtime = await adapter(server).prepareRuntime();
          server.runtime = runtime;
          step("runtime", "done", `${runtime.image}${runtime.exact ? "" : " (closest available)"}`);
        }
        save([...load(), server]);
        step("install", "done");
        job.state = "done";
        step("finish", "done");
      } catch (error) {
        job.state = controller.signal.aborted ? "cancelled" : "failed";
        step("error", "failed", error.code || error.message);
      }
    })();
    return { id };
  }

  async function view(server) {
    const a = adapter(server);
    return { ...server, status: await a.status() };
  }

  const ops = {
    targets: () => Object.entries(targets.TARGETS).map(([id, t]) => ({ id, ...t })),
    editions: () => ({ java: { available: true }, bedrock: catalogue.BEDROCK_STATUS }),
    catalogue: async ({ flavour = "vanilla" } = {}) => {
      const java = await catalogue.javaCatalogue(root, { fetchImpl });
      if (flavour === "vanilla") return java;
      const list = flavour === "paper" ? await catalogue.paperVersions(root, { fetchImpl }) : await catalogue.fabricVersions(root, { fetchImpl });
      const allowed = new Set(list.versions);
      return { ...java, versions: java.versions.filter((v) => allowed.has(v.id)), flavourSource: list.source, flavourRetrievedAt: list.retrievedAt };
    },
    versionDetail: async ({ version }) => {
      const java = await catalogue.javaCatalogue(root, { fetchImpl });
      const entry = java.versions.find((v) => v.id === version);
      if (!entry) throw fail("VERSION_NOT_IN_CATALOGUE");
      return catalogue.javaVersionDetail(root, entry, { fetchImpl });
    },
    probe: async (plan) => adapter({ id: "probe", ...validatePlan({ name: "probe", version: "probe", edition: "java", flavour: "vanilla", port: 25565, memoryMb: 1024, eulaAccepted: false, ...plan }) }).probe(),
    list: async () => Promise.all(load().map(view)),
    get: async ({ id }) => view(find(id)),
    create: (plan) => create(plan),
    cancelCreate: ({ id }) => {
      jobs.get(id)?.controller.abort();
      return { ok: true };
    },
    rename: ({ id, name }) => {
      if (typeof name !== "string" || !name.trim() || name.length > 60) throw fail("INVALID_NAME");
      return update(find(id).id, { name: name.trim() });
    },
    forget: ({ id }) => {
      const server = find(id);
      save(load().filter((s) => s.id !== server.id));
      return { forgotten: true, filesKept: true };
    },
    start: ({ id }) => adapter(find(id)).start(),
    stop: ({ id }) => adapter(find(id)).stop(),
    restart: async ({ id }) => {
      const a = adapter(find(id));
      await a.stop();
      return a.start();
    },
    command: ({ id, line }) => adapter(find(id)).command(line),
    logs: ({ id }) => adapter(find(id)).logs(),
    acceptEula: async ({ id, accepted }) => {
      if (accepted !== true) throw fail("INVALID_REQUEST");
      const server = find(id);
      await adapter(server).files.writeText("eula.txt", "# Accepted in Material Browser by the user.\neula=true\n");
      return update(id, { eulaAccepted: true });
    },
    config: async ({ id }) => {
      const server = find(id);
      const text = (await adapter(server).files.readText("server.properties")) || "";
      return properties.typedView(text, server.version);
    },
    setConfig: async ({ id, changes }) => {
      const server = find(id);
      const a = adapter(server);
      const before = (await a.files.readText("server.properties")) || "";
      const result = properties.applyChanges(before, server.version, changes);
      await a.files.writeText("server.properties.bak", before);
      await a.files.writeText("server.properties", result.text);
      if (typeof changes["server-port"] === "number") update(id, { port: changes["server-port"] });
      const running = (await a.status()).state === "running";
      return { saved: true, needsRestart: running ? result.restart : [] };
    },
    players: async ({ id }) => content.players(adapter(find(id)).files),
    lookupPlayer: ({ name }) => content.lookupPlayer(name, { fetchImpl }),
    setPlayer: async ({ id, player, changes }) => {
      const server = find(id);
      const a = adapter(server);
      const running = (await a.status()).state === "running";
      return content.setPlayer(a.files, a, running, player, changes);
    },
    plugins: async ({ id }) => {
      const server = find(id);
      return content.listPlugins(server, adapter(server).files);
    },
    searchPlugins: ({ id, query }) => content.searchPlugins(find(id), query, { fetchImpl }),
    installPlugin: async ({ id, project }) => {
      const server = find(id);
      const a = adapter(server);
      await content.backup(a.files, "world", "before-plugin").catch(() => null);
      return content.installPlugin(server, a.files, project, { fetchImpl, cacheDir: path.join(root, "downloads") });
    },
    setPluginEnabled: ({ id, file, enabled }) => {
      const server = find(id);
      return content.setPluginEnabled(server, adapter(server).files, file, enabled === true);
    },
    backups: ({ id }) => content.listBackups(adapter(find(id)).files),
    backup: async ({ id }) => {
      const server = find(id);
      const a = adapter(server);
      const running = (await a.status()).state === "running";
      if (running) {
        await a.command("save-off");
        await a.command("save-all flush");
        await new Promise((r) => setTimeout(r, deps.saveWaitMs ?? 3000));
      }
      try {
        return await content.backup(a.files, "world");
      } finally {
        if (running) await a.command("save-on");
      }
    },
    restore: async ({ id, folder }) => {
      const server = find(id);
      const a = adapter(server);
      if ((await a.status()).state !== "stopped") throw fail("STOP_SERVER_FIRST");
      return content.restore(a.files, folder, "world");
    },
  };

  async function handle(operation, params = {}) {
    if (!Object.hasOwn(ops, operation)) throw fail("INVALID_REQUEST");
    return ops[operation](params || {});
  }

  /** Stop every server this app started locally when the app quits; remote ones keep running. */
  async function shutdown() {
    for (const [id, child] of processes) {
      if (child.exitCode === null) {
        try {
          child.stdin.write("stop\n");
        } catch {}
      }
      processes.delete(id);
    }
  }

  return { handle, shutdown, ops: Object.keys(ops), validatePlan };
}

function registerMinecraftIpc({ ipcMain, app, trusted, getWindow }) {
  const service = createService({
    root: path.join(app.getPath("userData"), "minecraft-servers"),
    emit: (event) => {
      const window = getWindow();
      if (window && !window.isDestroyed()) window.webContents.send("material:event", event);
    },
  });
  ipcMain.handle("material:minecraft", async (event, operation, params = {}) => {
    if (!trusted(event) || typeof operation !== "string") throw new Error("INVALID_REQUEST");
    try {
      return await service.handle(operation, params);
    } catch (error) {
      throw new Error(error.detail ? `${error.code || "FAILED"}: ${error.detail}` : error.code || error.message);
    }
  });
  app.on("before-quit", () => void service.shutdown());
  return service;
}

module.exports = { createService, registerMinecraftIpc, FLAVOURS };
