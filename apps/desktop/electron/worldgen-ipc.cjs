"use strict";
// Trusted IPC for the Minecraft world generator. Pickers come from the selected version's own
// verified server jar; generation only starts after the user switches on EULA acceptance.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const catalogue = require("./minecraft/catalogue.cjs");
const util = require("./minecraft/util.cjs");
const worldgen = require("./minecraft/worldgen.cjs");

function createWorldgenService({ root, dialog, getWindow = () => null, emit = () => {}, fetchImpl = fetch, deps = {} }) {
  const catalogues = new Map();
  let job = null, closing = false;
  const pending = new Set(), controllers = new Set(), owned = new Set();
  const track = (promise) => {
    pending.add(promise);
    promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };
  const onOwned = (receipt) => {
    owned.add(receipt);
    receipt.exit.then(() => {
      owned.delete(receipt);
      if (job?.settled && !owned.size) job = null;
    });
  };
  const checkAbort = (signal) => { if (signal?.aborted) throw util.fail("CANCELLED"); };

  async function releases(_, signal) {
    const java = await catalogue.javaCatalogue(root, { fetchImpl, signal });
    return { latest: java.latest.release, retrievedAt: java.retrievedAt, stale: java.stale, versions: java.versions.filter((v) => v.channel === "release").map((v) => v.id) };
  }

  /** The verified vanilla jar for a version, downloaded once into the app's cache. */
  async function cachedJar(version, signal) {
    checkAbort(signal);
    const file = path.join(root, "jars", `${version.replace(/[^A-Za-z0-9._-]/g, "_")}.jar`);
    const java = await catalogue.javaCatalogue(root, { fetchImpl, signal });
    const entry = java.versions.find((v) => v.id === version);
    if (!entry) throw util.fail("VERSION_NOT_IN_CATALOGUE");
    const detail = await catalogue.javaVersionDetail(root, entry, { fetchImpl, signal });
    if (!detail.server) throw util.fail("NO_SERVER_DOWNLOAD");
    if (detail.id !== version || !/^[a-f0-9]{40}$/.test(detail.server.sha1 || "") ||
        !Number.isSafeInteger(detail.server.size) || detail.server.size < 1 || detail.server.size > 1024 ** 3)
      throw util.fail("JAR_METADATA_INVALID");
    // Reject existing linked components before a missing cache entry can be downloaded.
    let candidate = path.resolve(root);
    for (const part of ["", ...path.relative(root, file).split(path.sep)]) {
      if (part) candidate = path.join(candidate, part);
      try { if (fs.lstatSync(candidate).isSymbolicLink()) throw util.fail("UNSAFE_JAR_PATH"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (!fs.existsSync(file)) await util.downloadVerified(detail.server.url, file, { sha1: detail.server.sha1, size: detail.server.size }, { fetchImpl, signal });
    checkAbort(signal);
    // Check every cache component and the open file, not just a stale cache receipt.
    let at = path.resolve(root);
    for (const part of ["", ...path.relative(root, file).split(path.sep)]) {
      if (part) at = path.join(at, part);
      if (fs.lstatSync(at).isSymbolicLink()) throw util.fail("UNSAFE_JAR_PATH");
    }
    const before = fs.lstatSync(file);
    if (!before.isFile() || before.nlink !== 1) throw util.fail("UNSAFE_JAR_PATH");
    const fd = fs.openSync(file, "r");
    let bytes;
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== detail.server.size)
        throw util.fail("JAR_INTEGRITY_FAILED");
      bytes = fs.readFileSync(fd);
      if (bytes.length !== detail.server.size || crypto.createHash("sha1").update(bytes).digest("hex") !== detail.server.sha1)
        throw util.fail("JAR_INTEGRITY_FAILED");
      worldgen.verifyJarIdentity(bytes, version);
    } finally { fs.closeSync(fd); }
    return { file, bytes, integrity: { version, sha1: detail.server.sha1, size: detail.server.size } };
  }

  async function versionCatalogue(version, signal) {
    if (typeof version !== "string" || !/^[A-Za-z0-9._ -]{1,40}$/.test(version)) throw util.fail("INVALID_VERSION");
    const admitted = await cachedJar(version, signal);
    const { file: jar, bytes: jarBytes, integrity } = admitted;
    checkAbort(signal);
    if (catalogues.has(version)) return { ...catalogues.get(version), jarBytes, integrity };
    const reports = path.join(root, "worldgen-reports", `${version.replace(/[^A-Za-z0-9._-]/g, "_")}-${integrity.sha1}`);
    if (!fs.existsSync(path.join(reports, "reports", "registries.json"))) await worldgen.runReports(jar, reports, { spawnImpl: deps.spawn, signal, onOwned, stopTimeout: deps.stopTimeout, jarBytes, jarIntegrity: integrity });
    checkAbort(signal);
    const value = { ...worldgen.catalogueFrom(jarBytes, reports), jar };
    catalogues.set(version, value);
    return { ...value, jarBytes, integrity };
  }

  const ops = {
    releases,
    catalogue: async ({ version }, signal) => {
      const { raw, jar, jarBytes, integrity, ...rest } = await versionCatalogue(version, signal);
      return { ...rest, defaults: rest.supported ? worldgen.defaults({ ...rest, raw }) : null };
    },
    browse: async ({ kind, name }) => {
      if (!dialog) throw util.fail("BACKEND_UNAVAILABLE");
      const safe = typeof name === "string" && /^[A-Za-z0-9 _-]{1,40}$/.test(name) ? name.trim().replace(/\s+/g, "-") : "world";
      if (kind === "zip") {
        const r = await dialog.showSaveDialog(getWindow(), { defaultPath: `${safe}.zip`, filters: [{ name: "ZIP archive", extensions: ["zip"] }] });
        return r.canceled ? null : r.filePath;
      }
      if (kind !== "folder") throw util.fail("INVALID_REQUEST");
      const r = await dialog.showOpenDialog(getWindow(), { properties: ["openDirectory", "createDirectory"] });
      return r.canceled || !r.filePaths[0] ? null : path.join(r.filePaths[0], safe);
    },
    start: async ({ version, options, eulaAccepted }, signal) => {
      if (job || owned.size) throw util.fail("ALREADY_GENERATING");
      if (eulaAccepted !== true) throw util.fail("EULA_NOT_ACCEPTED");
      const current = { id: crypto.randomUUID(), controller: new AbortController(), settled: false, completion: null };
      job = current;
      const aborted = () => current.controller.abort();
      signal?.addEventListener("abort", aborted, { once: true });
      if (signal?.aborted) aborted();
      try {
        const c = await versionCatalogue(version, current.controller.signal);
        checkAbort(current.controller.signal);
        const optionsValidated = worldgen.validate(options, c);
        current.completion = track(worldgen.generate({ options: optionsValidated, catalogue: c, jarPath: c.jar, jarBytes: c.jarBytes, jarIntegrity: c.integrity,
          stagingRoot: path.join(root, "worldgen-runs"), eulaAccepted, emit, signal: current.controller.signal,
          deps: { ...deps.worldgen, stopTimeout: deps.stopTimeout, onOwned } })
          .then((result) => emit({ type: "minecraft.worldgen", step: "done", result }))
          .catch((error) => emit({ type: "minecraft.worldgen", step: "failed", error: error.code || "GENERATION_FAILED" }))
          .finally(() => {
            current.settled = true;
            if (job === current && !owned.size) job = null;
          }));
        return { started: true, batches: worldgen.planBatches(optionsValidated.area).length };
      } catch (error) {
        current.settled = true;
        if (job === current && !owned.size) job = null;
        throw error;
      } finally { signal?.removeEventListener("abort", aborted); }
    },
    cancel: () => {
      job?.controller.abort();
      return { ok: true };
    },
  };

  return {
    get active() { return Boolean(job || owned.size || pending.size); },
    async handle(operation, params = {}) {
      if (!Object.hasOwn(ops, operation)) throw util.fail("INVALID_REQUEST");
      if (closing && operation !== "cancel") throw util.fail("SHUTDOWN_PENDING");
      const controller = new AbortController();
      controllers.add(controller);
      try { return await track(Promise.resolve().then(() => ops[operation](params || {}, controller.signal))); }
      finally { controllers.delete(controller); }
    },
    async dispose() {
      closing = true;
      for (const controller of controllers) controller.abort();
      job?.controller.abort();
      const stopping = [...owned].map((receipt) => receipt.stop());
      let timer;
      try {
        await Promise.race([
          Promise.allSettled([...pending, ...stopping]),
          new Promise((_, reject) => { timer = setTimeout(() => reject(util.fail("STOP_PENDING")), deps.disposeTimeout ?? 60000); }),
        ]);
      } finally { clearTimeout(timer); }
      // A canceled acquisition must settle before this final ownership sweep.
      const results = await Promise.allSettled([...owned].map((receipt) => receipt.stop()));
      if (pending.size || [...owned].some((receipt) => receipt.active) || results.some((result) => result.status === "rejected"))
        throw util.fail("STOP_PENDING");
      if (job?.settled) job = null;
    },
  };
}

function registerWorldgenIpc({ ipcMain, app, dialog, trusted, getWindow, createService = createWorldgenService }) {
  let service, closing = false;
  const get = () =>
    service ||
    (service = createService({
      root: path.join(app.getPath("userData"), "minecraft-worldgen"),
      dialog,
      getWindow,
      emit: (event) => {
        const window = getWindow();
        if (window && !window.isDestroyed()) window.webContents.send("material:event", event);
      },
    }));
  ipcMain.handle("material:worldgen", async (event, operation, params = {}) => {
    if (!trusted(event) || typeof operation !== "string" || !params || typeof params !== "object" || Array.isArray(params)) throw new Error("INVALID_REQUEST");
    if (Buffer.byteLength(JSON.stringify(params)) > 256 * 1024) throw new Error("REQUEST_TOO_LARGE");
    try {
      if (closing) throw util.fail("SHUTDOWN_PENDING");
      return await get().handle(operation, params);
    } catch (error) {
      const code = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code) ? error.code : "WORLDGEN_FAILED";
      throw new Error(code);
    }
  });
  return {
    get active() { return Boolean(service?.active); },
    async dispose() { closing = true; if (service) await service.dispose(); },
  };
}

module.exports = { createWorldgenService, registerWorldgenIpc };
