// Version discovery from the official catalogues. Every entry the catalogue returns is kept;
// whether a version has a server download is resolved per version from its own metadata.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fail, atomicWrite } = require("./util.cjs");

const JAVA_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const PAPER_PROJECT = "https://fill.papermc.io/v3/projects/paper";
const FABRIC_GAME = "https://meta.fabricmc.net/v2/versions/game";
const FABRIC_LOADER = "https://meta.fabricmc.net/v2/versions/loader";
const FABRIC_INSTALLER = "https://meta.fabricmc.net/v2/versions/installer";
const MAX_JSON = 32 * 1024 * 1024;

const CHANNELS = ["release", "snapshot", "old_beta", "old_alpha"];

const BEDROCK_STATUS = Object.freeze({
  available: false,
  reason:
    "Mojang publishes Bedrock Dedicated Server downloads only through its download page, " +
    "behind a licence agreement, with no machine-readable version catalogue. This build does " +
    "not scrape that page, so Bedrock servers cannot be created yet.",
});

async function getJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw fail("CATALOGUE_UNAVAILABLE", `${response.status} ${url}`);
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_JSON) throw fail("CATALOGUE_TOO_LARGE");
  return { text, json: JSON.parse(text) };
}

function cacheFile(root, name) {
  return path.join(root, "catalogue", `${name}.json`);
}

function readCache(root, name) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(root, name), "utf8"));
  } catch {
    return null;
  }
}

function writeCache(root, name, value) {
  atomicWrite(cacheFile(root, name), JSON.stringify(value));
}

/** Validate and normalize the Java manifest. Malformed entries fail the whole refresh. */
function parseJavaManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.versions) || !manifest.latest)
    throw fail("CATALOGUE_MALFORMED");
  const seen = new Set();
  const versions = manifest.versions.map((v) => {
    if (
      !v ||
      typeof v.id !== "string" ||
      typeof v.url !== "string" ||
      !/^[0-9a-f]{40}$/.test(v.sha1 || "") ||
      !CHANNELS.includes(v.type) ||
      seen.has(v.id)
    )
      throw fail("CATALOGUE_MALFORMED", String(v?.id));
    seen.add(v.id);
    return { id: v.id, channel: v.type, url: v.url, sha1: v.sha1, releaseTime: v.releaseTime };
  });
  return { latest: manifest.latest, versions };
}

async function refreshJava(root, { fetchImpl = fetch, signal, now = () => new Date() } = {}) {
  const { json } = await getJson(JAVA_MANIFEST, fetchImpl, signal);
  const parsed = parseJavaManifest(json);
  const record = {
    source: JAVA_MANIFEST,
    retrievedAt: now().toISOString(),
    complete: true,
    count: parsed.versions.length,
    ...parsed,
  };
  writeCache(root, "java", record);
  return record;
}

/** The cached catalogue, or a fresh one. Offline returns the last verified copy with `stale`. */
async function javaCatalogue(root, options = {}) {
  try {
    return { ...(await refreshJava(root, options)), stale: false };
  } catch (error) {
    const cached = readCache(root, "java");
    if (cached) return { ...cached, stale: true, refreshError: error.code || error.message };
    throw error;
  }
}

/**
 * Resolve one version's server download and Java runtime from its own metadata.
 * The metadata body must match the SHA-1 the catalogue listed for it.
 */
async function javaVersionDetail(root, entry, { fetchImpl = fetch, signal } = {}) {
  const key = `java-${entry.id.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  const cached = readCache(root, key);
  if (cached && cached.metadataSha1 === entry.sha1) return cached;
  const { text, json } = await getJson(entry.url, fetchImpl, signal);
  const actual = crypto.createHash("sha1").update(text).digest("hex");
  if (actual !== entry.sha1) throw fail("CATALOGUE_INTEGRITY_FAILED", entry.id);
  const server = json?.downloads?.server;
  const detail = {
    id: entry.id,
    channel: entry.channel,
    metadataSha1: entry.sha1,
    server:
      server && typeof server.url === "string" && /^[0-9a-f]{40}$/.test(server.sha1 || "")
        ? { url: server.url, sha1: server.sha1, size: server.size }
        : null,
    unavailableReason: server ? null : "The official metadata for this version lists no server download.",
    javaMajor: Number.isInteger(json?.javaVersion?.majorVersion) ? json.javaVersion.majorVersion : null,
    javaNote: Number.isInteger(json?.javaVersion?.majorVersion)
      ? null
      : "This version's metadata does not name a Java version; the runtime is unresolved.",
  };
  writeCache(root, key, detail);
  return detail;
}

async function paperVersions(root, { fetchImpl = fetch, signal } = {}) {
  try {
    const { json } = await getJson(PAPER_PROJECT, fetchImpl, signal);
    if (!json || typeof json.versions !== "object") throw fail("CATALOGUE_MALFORMED");
    const list = Object.values(json.versions).flat().filter((v) => typeof v === "string");
    const record = { source: PAPER_PROJECT, retrievedAt: new Date().toISOString(), versions: list };
    writeCache(root, "paper", record);
    return { ...record, stale: false };
  } catch (error) {
    const cached = readCache(root, "paper");
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

/** Latest stable Paper build for one game version, with its published SHA-256. */
async function paperBuild(version, { fetchImpl = fetch, signal } = {}) {
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(version)) throw fail("INVALID_VERSION");
  const { json } = await getJson(`${PAPER_PROJECT}/versions/${version}/builds`, fetchImpl, signal);
  if (!Array.isArray(json) || !json.length) throw fail("NO_BUILD_FOR_VERSION");
  const build = json.find((b) => b.channel === "STABLE") || json[0];
  const file = build?.downloads?.["server:default"];
  if (!file || !/^[0-9a-f]{64}$/.test(file?.checksums?.sha256 || "")) throw fail("CATALOGUE_MALFORMED");
  return {
    build: build.id,
    channel: build.channel,
    url: file.url,
    name: file.name,
    sha256: file.checksums.sha256,
    size: file.size,
  };
}

async function fabricVersions(root, { fetchImpl = fetch, signal } = {}) {
  try {
    const [{ json: game }, { json: loader }, { json: installer }] = await Promise.all([
      getJson(FABRIC_GAME, fetchImpl, signal),
      getJson(FABRIC_LOADER, fetchImpl, signal),
      getJson(FABRIC_INSTALLER, fetchImpl, signal),
    ]);
    const record = {
      source: FABRIC_GAME,
      retrievedAt: new Date().toISOString(),
      versions: game.map((g) => g.version),
      loader: (loader.find((l) => l.stable) || loader[0])?.version,
      installer: (installer.find((i) => i.stable) || installer[0])?.version,
    };
    writeCache(root, "fabric", record);
    return { ...record, stale: false };
  } catch (error) {
    const cached = readCache(root, "fabric");
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

function fabricServerUrl(game, loader, installer) {
  for (const part of [game, loader, installer])
    if (!/^[A-Za-z0-9._+-]{1,60}$/.test(part || "")) throw fail("INVALID_VERSION");
  return `https://meta.fabricmc.net/v2/versions/loader/${game}/${loader}/${installer}/server/jar`;
}

module.exports = {
  JAVA_MANIFEST,
  CHANNELS,
  BEDROCK_STATUS,
  parseJavaManifest,
  refreshJava,
  javaCatalogue,
  javaVersionDetail,
  paperVersions,
  paperBuild,
  fabricVersions,
  fabricServerUrl,
};
