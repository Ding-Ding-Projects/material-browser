"use strict";
// Trusted IPC for the Minecraft world generator. Pickers come from the selected version's own
// verified server jar; generation only starts after the user switches on EULA acceptance.
const fs = require("node:fs");
const path = require("node:path");
const catalogue = require("./minecraft/catalogue.cjs");
const util = require("./minecraft/util.cjs");
const worldgen = require("./minecraft/worldgen.cjs");

function createWorldgenService({ root, dialog, getWindow = () => null, emit = () => {}, fetchImpl = fetch, deps = {} }) {
  const catalogues = new Map();
  let job = null;

  async function releases() {
    const java = await catalogue.javaCatalogue(root, { fetchImpl });
    return { latest: java.latest.release, retrievedAt: java.retrievedAt, stale: java.stale, versions: java.versions.filter((v) => v.channel === "release").map((v) => v.id) };
  }

  /** The verified vanilla jar for a version, downloaded once into the app's cache. */
  async function cachedJar(version) {
    const file = path.join(root, "jars", `${version.replace(/[^A-Za-z0-9._-]/g, "_")}.jar`);
    if (fs.existsSync(file)) return file;
    const java = await catalogue.javaCatalogue(root, { fetchImpl });
    const entry = java.versions.find((v) => v.id === version);
    if (!entry) throw util.fail("VERSION_NOT_IN_CATALOGUE");
    const detail = await catalogue.javaVersionDetail(root, entry, { fetchImpl });
    if (!detail.server) throw util.fail("NO_SERVER_DOWNLOAD");
    await util.downloadVerified(detail.server.url, file, { sha1: detail.server.sha1, size: detail.server.size }, { fetchImpl });
    return file;
  }

  async function versionCatalogue(version) {
    if (typeof version !== "string" || !/^[A-Za-z0-9._ -]{1,40}$/.test(version)) throw util.fail("INVALID_VERSION");
    if (catalogues.has(version)) return catalogues.get(version);
    const jar = await cachedJar(version);
    const reports = path.join(root, "worldgen-reports", version.replace(/[^A-Za-z0-9._-]/g, "_"));
    if (!fs.existsSync(path.join(reports, "reports", "registries.json"))) await worldgen.runReports(jar, reports, { spawnImpl: deps.spawn });
    const value = { ...worldgen.catalogueFrom(fs.readFileSync(jar), reports), jar };
    catalogues.set(version, value);
    return value;
  }

  const ops = {
    releases,
    catalogue: async ({ version }) => {
      const { raw, jar, ...rest } = await versionCatalogue(version);
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
    start: async ({ version, options, eulaAccepted }) => {
      if (job) throw util.fail("ALREADY_GENERATING");
      const c = await versionCatalogue(version);
      worldgen.validate(options, c);
      if (eulaAccepted !== true) throw util.fail("EULA_NOT_ACCEPTED");
      const controller = new AbortController();
      job = { controller };
      worldgen
        .generate({ options, catalogue: c, jarPath: c.jar, stagingRoot: path.join(root, "worldgen-runs"), eulaAccepted, emit, signal: controller.signal, deps: deps.worldgen })
        .then((result) => emit({ type: "minecraft.worldgen", step: "done", result }))
        .catch((error) => emit({ type: "minecraft.worldgen", step: "failed", error: error.code || "GENERATION_FAILED" }))
        .finally(() => {
          job = null;
        });
      return { started: true, batches: worldgen.planBatches(options.area).length };
    },
    cancel: () => {
      job?.controller.abort();
      return { ok: true };
    },
  };

  return {
    async handle(operation, params = {}) {
      if (!Object.hasOwn(ops, operation)) throw util.fail("INVALID_REQUEST");
      return ops[operation](params || {});
    },
  };
}

function registerWorldgenIpc({ ipcMain, app, dialog, trusted, getWindow, createService = createWorldgenService }) {
  let service;
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
      return await get().handle(operation, params);
    } catch (error) {
      const code = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code) ? error.code : "WORLDGEN_FAILED";
      throw new Error(code);
    }
  });
}

module.exports = { createWorldgenService, registerWorldgenIpc };
