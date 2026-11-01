const crypto = require("node:crypto");
const MANIFEST =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const allowed = new Set([
  "piston-meta.mojang.com",
  "piston-data.mojang.com",
  "launcher.mojang.com",
  "launchermeta.mojang.com",
  "fill.papermc.io",
  "fill-data.papermc.io",
  "meta.fabricmc.net",
]);
function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}
function officialUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    !allowed.has(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    fail("INVALID_SOURCE", "Only official distribution endpoints are allowed");
  return u.href;
}
function digest(bytes, hash, algorithm = "sha1") {
  return crypto.createHash(algorithm).update(bytes).digest("hex") === hash;
}
function createCatalogue(fetcher = globalThis.fetch) {
  async function read(
    url,
    { hash, algorithm = "sha1", size, max = 8 * 1024 * 1024, signal } = {},
  ) {
    const response = await fetcher(officialUrl(url), {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      redirect: "error",
      headers: {
        "user-agent":
          "MaterialBrowser/0.1 (https://github.com/Ding-Ding-Projects/material-browser)",
        accept: "application/json, application/octet-stream",
      },
    });
    if (!response.ok)
      fail("DOWNLOAD_FAILED", `Official endpoint returned ${response.status}`);
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > max)
        fail("DOWNLOAD_TOO_LARGE", "Download exceeds its declared bound");
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    if (size !== undefined && bytes.length !== size)
      fail("INTEGRITY_FAILED", "Distribution size does not match");
    if (hash && !digest(bytes, hash, algorithm))
      fail("INTEGRITY_FAILED", "Published distribution digest does not match");
    return bytes;
  }
  async function discoverVanilla(signal) {
    const manifest = JSON.parse(
      (await read(MANIFEST, { signal })).toString("utf8"),
    );
    if (!Array.isArray(manifest.versions) || !manifest.versions.length)
      fail("INVALID_CATALOGUE", "Official catalogue is empty");
    const seen = new Set();
    const versions = manifest.versions.map((v) => {
      if (
        typeof v.id !== "string" ||
        !v.id ||
        seen.has(v.id) ||
        typeof v.type !== "string" ||
        !/^[a-f0-9]{40}$/.test(v.sha1)
      )
        fail("INVALID_CATALOGUE", "Invalid version identity");
      seen.add(v.id);
      officialUrl(v.url);
      return {
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
        url: v.url,
        sha1: v.sha1,
        serverDistribution: "unresolved",
      };
    });
    return {
      versions,
      latest: manifest.latest,
      retrievedAt: new Date().toISOString(),
      source: MANIFEST,
      complete: true,
    };
  }
  async function resolveVanilla(version, signal) {
    const catalogue = await discoverVanilla(signal);
    const entry = catalogue.versions.find((v) => v.id === version);
    if (!entry)
      fail("UNKNOWN_VERSION", "Version is absent from the official catalogue");
    const metadata = JSON.parse(
      (await read(entry.url, { hash: entry.sha1, signal })).toString("utf8"),
    );
    if (metadata.id !== undefined && metadata.id !== version)
      fail(
        "INVALID_CATALOGUE",
        "Metadata identity does not match the selected version",
      );
    const server = metadata.downloads?.server;
    if (!server)
      return {
        ...entry,
        javaMajor: metadata.javaVersion?.majorVersion ?? null,
        available: false,
        reason: "Official metadata has no dedicated server distribution",
      };
    officialUrl(server.url);
    if (
      !Number.isSafeInteger(server.size) ||
      server.size <= 0 ||
      server.size > 1024 ** 3 ||
      !/^[a-f0-9]{40}$/.test(server.sha1)
    )
      fail(
        "INVALID_DISTRIBUTION",
        "Invalid official distribution integrity metadata",
      );
    return {
      ...entry,
      available: true,
      download: server,
      javaMajor: metadata.javaVersion?.majorVersion ?? null,
    };
  }
  const flavours = require("./flavours.cjs").createFlavours({
    json: async (url, signal) =>
      JSON.parse((await read(url, { signal })).toString("utf8")),
    resolveVanilla,
    discoverVanilla,
    fail,
    sourceUrl: officialUrl,
  });
  return {
    discover: (signal, options = {}) =>
      options.flavour && options.flavour !== "vanilla"
        ? flavours.discover(options.flavour, signal)
        : discoverVanilla(signal),
    resolve: (version, signal, options = {}) =>
      flavours.resolve(version, signal, options),
    download: (d, signal) =>
      read(d.url, {
        hash: d.sha256 || d.sha1,
        algorithm: d.sha256 ? "sha256" : "sha1",
        size: d.size,
        max: d.size || d.max || 32 * 1024 ** 2,
        signal,
      }),
  };
}
module.exports = { createCatalogue, fail };
