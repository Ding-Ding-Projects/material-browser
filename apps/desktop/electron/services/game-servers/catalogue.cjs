const crypto = require("node:crypto");
const MANIFEST =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const allowed = new Set([
  "piston-meta.mojang.com",
  "piston-data.mojang.com",
  "launcher.mojang.com",
  "launchermeta.mojang.com",
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
function digest(bytes, hash) {
  return crypto.createHash("sha1").update(bytes).digest("hex") === hash;
}
function createCatalogue(fetcher = globalThis.fetch) {
  async function read(url, { hash, size, max = 8 * 1024 * 1024, signal } = {}) {
    const response = await fetcher(officialUrl(url), {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      redirect: "error",
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
    if (hash && !digest(bytes, hash))
      fail("INTEGRITY_FAILED", "Official SHA-1 does not match");
    return bytes;
  }
  async function discover(signal) {
    const manifest = JSON.parse(
      (await read(MANIFEST, { signal })).toString("utf8"),
    );
    if (!Array.isArray(manifest.versions) || !manifest.versions.length)
      fail("INVALID_CATALOGUE", "Official catalogue is empty");
    const versions = manifest.versions.map((v) => {
      if (typeof v.id !== "string" || !/^[a-f0-9]{40}$/.test(v.sha1))
        fail("INVALID_CATALOGUE", "Invalid version identity");
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
  async function resolve(version, signal) {
    const catalogue = await discover(signal);
    const entry = catalogue.versions.find((v) => v.id === version);
    if (!entry)
      fail("UNKNOWN_VERSION", "Version is absent from the official catalogue");
    const metadata = JSON.parse(
      (await read(entry.url, { hash: entry.sha1, signal })).toString("utf8"),
    );
    const server = metadata.downloads?.server;
    if (!server)
      return {
        ...entry,
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
  return {
    discover,
    resolve,
    download: (d, signal) =>
      read(d.url, { hash: d.sha1, size: d.size, max: d.size, signal }),
  };
}
module.exports = { createCatalogue, fail };
