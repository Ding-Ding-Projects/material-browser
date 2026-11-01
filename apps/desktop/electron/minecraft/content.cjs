// Players, plugins and backups for one server, through its host file access.
const { fail, assertPlayerName, downloadVerified } = require("./util.cjs");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const PROFILE_API = "https://api.mojang.com/users/profiles/minecraft/";
const MODRINTH = "https://api.modrinth.com/v2";

/** Look up the exact account so lists hold real UUIDs, not guesses. */
async function lookupPlayer(name, { fetchImpl = fetch } = {}) {
  assertPlayerName(name);
  const response = await fetchImpl(PROFILE_API + encodeURIComponent(name));
  if (response.status === 404 || response.status === 204) throw fail("PLAYER_NOT_FOUND", name);
  if (!response.ok) throw fail("PROFILE_SERVICE_UNAVAILABLE", String(response.status));
  const json = await response.json();
  if (!/^[0-9a-f]{32}$/.test(json?.id || "")) throw fail("PROFILE_SERVICE_MALFORMED");
  const id = json.id;
  return { name: json.name, uuid: `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}` };
}

async function readJsonList(files, name) {
  const text = await files.readText(name);
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    throw fail("PLAYER_LIST_MALFORMED", name);
  }
}

/** Allowlist and operators as one permission view. */
async function players(files) {
  const [allow, ops, bans] = await Promise.all([
    readJsonList(files, "whitelist.json"),
    readJsonList(files, "ops.json"),
    readJsonList(files, "banned-players.json"),
  ]);
  const byUuid = new Map();
  const get = (p) => {
    if (!byUuid.has(p.uuid)) byUuid.set(p.uuid, { uuid: p.uuid, name: p.name, allowlisted: false, operator: false, level: 0, banned: false });
    return byUuid.get(p.uuid);
  };
  for (const p of allow) get(p).allowlisted = true;
  for (const p of ops) Object.assign(get(p), { operator: true, level: p.level ?? 4 });
  for (const p of bans) Object.assign(get(p), { banned: true, reason: p.reason || "" });
  return [...byUuid.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Change one player's permissions. When the server is running the change goes through its own
 * commands so it takes effect live; when stopped, the JSON lists are edited and other entries kept.
 */
async function setPlayer(files, adapter, running, player, changes) {
  const name = assertPlayerName(player.name);
  if (running) {
    if ("allowlisted" in changes) await adapter.command(`whitelist ${changes.allowlisted ? "add" : "remove"} ${name}`);
    if ("operator" in changes) await adapter.command(`${changes.operator ? "op" : "deop"} ${name}`);
    if ("banned" in changes) await adapter.command(changes.banned ? `ban ${name}` : `pardon ${name}`);
    return { applied: "live" };
  }
  const edit = async (file, on, make) => {
    const list = (await readJsonList(files, file)).filter((p) => p.uuid !== player.uuid);
    if (on) list.push(make());
    await files.writeText(file, JSON.stringify(list, null, 2) + "\n");
  };
  if ("allowlisted" in changes) await edit("whitelist.json", changes.allowlisted, () => ({ uuid: player.uuid, name }));
  if ("operator" in changes) await edit("ops.json", changes.operator, () => ({ uuid: player.uuid, name, level: 4, bypassesPlayerLimit: false }));
  if ("banned" in changes)
    await edit("banned-players.json", changes.banned, () => ({ uuid: player.uuid, name, created: new Date().toISOString(), source: "Material Browser", expires: "forever", reason: "Banned by an operator." }));
  return { applied: "files" };
}

function loaderFacet(flavour) {
  if (flavour === "paper") return { loader: "paper", type: "plugin", folder: "plugins" };
  if (flavour === "fabric") return { loader: "fabric", type: "mod", folder: "mods" };
  throw fail("NO_PLUGIN_SUPPORT", flavour);
}

/** Search the Modrinth catalogue for packages that declare this loader and game version. */
async function searchPlugins(server, query, { fetchImpl = fetch } = {}) {
  const { loader, type } = loaderFacet(server.flavour);
  if (typeof query !== "string" || query.length > 100) throw fail("INVALID_REQUEST");
  const facets = JSON.stringify([[`categories:${loader}`], [`versions:${server.version}`], [`project_type:${type}`]]);
  const url = `${MODRINTH}/search?limit=20&query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}`;
  const response = await fetchImpl(url, { headers: { "user-agent": "Ding-Ding-Projects/material-browser" } });
  if (!response.ok) throw fail("CATALOGUE_UNAVAILABLE", String(response.status));
  const json = await response.json();
  return (json.hits || []).map((h) => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, license: h.license || "unknown", downloads: h.downloads, icon: h.icon_url || null }));
}

/** Install the newest file Modrinth declares compatible, verified by its published SHA-512. */
async function installPlugin(server, files, projectId, { fetchImpl = fetch, cacheDir = os.tmpdir() } = {}) {
  const { loader, folder } = loaderFacet(server.flavour);
  if (!/^[A-Za-z0-9]{6,16}$/.test(projectId || "")) throw fail("INVALID_REQUEST");
  const url = `${MODRINTH}/project/${projectId}/version?loaders=${encodeURIComponent(JSON.stringify([loader]))}&game_versions=${encodeURIComponent(JSON.stringify([server.version]))}`;
  const response = await fetchImpl(url, { headers: { "user-agent": "Ding-Ding-Projects/material-browser" } });
  if (!response.ok) throw fail("CATALOGUE_UNAVAILABLE", String(response.status));
  const versions = await response.json();
  const version = versions.find((v) => v.version_type === "release") || versions[0];
  if (!version) throw fail("NO_COMPATIBLE_VERSION");
  const file = version.files.find((f) => f.primary) || version.files[0];
  if (!file || !/^[A-Za-z0-9._+-]{1,120}\.jar$/.test(file.filename) || !/^[0-9a-f]{128}$/.test(file.hashes?.sha512 || ""))
    throw fail("CATALOGUE_MALFORMED");
  const required = (version.dependencies || []).filter((d) => d.dependency_type === "required").map((d) => d.project_id).filter(Boolean);
  const local = path.join(cacheDir, `mb-plugin-${process.pid}-${file.filename}`);
  try {
    await downloadVerified(file.url, local, { sha512: file.hashes.sha512, size: file.size }, { fetchImpl });
    await files.putFile(local, `${folder}/${file.filename}`);
  } finally {
    fs.rmSync(local, { force: true });
  }
  return { installed: file.filename, version: version.version_number, folder, requiredDependencies: required, needsRestart: true };
}

async function listPlugins(server, files) {
  let folder;
  try {
    folder = loaderFacet(server.flavour).folder;
  } catch {
    return { supported: false, items: [] };
  }
  const items = (await files.list(folder))
    .filter((f) => !f.dir && /\.jar(\.disabled)?$/.test(f.name))
    .map((f) => ({ file: f.name, enabled: f.name.endsWith(".jar"), managed: false }));
  return { supported: true, folder, items };
}

async function setPluginEnabled(server, files, file, enabled) {
  const { folder } = loaderFacet(server.flavour);
  if (!/^[A-Za-z0-9._+-]{1,120}\.jar(\.disabled)?$/.test(file)) throw fail("INVALID_REQUEST");
  const base = file.replace(/\.disabled$/, "");
  const from = `${folder}/${file}`, to = `${folder}/${enabled ? base : `${base}.disabled`}`;
  if (from === to) return { file };
  if (!(await files.exists(from))) throw fail("NOT_FOUND");
  if (files.kind === "local") fs.renameSync(path.join(files.root, from), path.join(files.root, to));
  else await files.run(`mv -f -- '${files.root}/${from}' '${files.root}/${to}'`);
  return { file: path.basename(to), needsRestart: true };
}

/** Copy every world folder into backups/<stamp>/ and record a digest of what was copied. */
async function backup(files, worldName, label = "manual", now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dir = `backups/${stamp}-${label.replace(/[^a-z0-9-]/gi, "")}`;
  await files.mkdir(`${dir}/data`);
  const worlds = [worldName, `${worldName}_nether`, `${worldName}_the_end`];
  const copied = [];
  for (const w of worlds) {
    if (!(await files.exists(w))) continue;
    await files.copyTree(w, `${dir}/data/${w}`);
    copied.push(w);
  }
  if (!copied.length) throw fail("NO_WORLD_TO_BACK_UP");
  const digest = await files.treeDigest(`${dir}/data`);
  await files.writeText(`${dir}/backup.json`, JSON.stringify({ createdAt: now.toISOString(), label, worlds: copied, ...digest }, null, 2));
  return { folder: dir, worlds: copied, ...digest };
}

async function listBackups(files) {
  const out = [];
  for (const entry of await files.list("backups")) {
    if (!entry.dir) continue;
    const meta = await files.readText(`backups/${entry.name}/backup.json`);
    try {
      out.push({ folder: `backups/${entry.name}`, ...JSON.parse(meta) });
    } catch {
      out.push({ folder: `backups/${entry.name}`, damaged: true });
    }
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Restore a backup into place. The current world is backed up first, so a restore can be undone. */
async function restore(files, backupFolder, worldName) {
  if (!/^backups\/[A-Za-z0-9-]+$/.test(backupFolder)) throw fail("INVALID_REQUEST");
  const meta = JSON.parse((await files.readText(`${backupFolder}/backup.json`)) || "null");
  if (!meta) throw fail("BACKUP_DAMAGED");
  const allowed = new Set([worldName, `${worldName}_nether`, `${worldName}_the_end`]);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(worldName) || !Array.isArray(meta.worlds) ||
      !meta.worlds.length || meta.worlds.length > 3 || new Set(meta.worlds).size !== meta.worlds.length ||
      meta.worlds.some((w) => typeof w !== "string" || !allowed.has(w))) throw fail("BACKUP_DAMAGED");
  const check = await files.treeDigest(`${backupFolder}/data`);
  if (check.sha256 !== meta.sha256) throw fail("BACKUP_INTEGRITY_FAILED");
  const safety = await backup(files, worldName, "before-restore").catch((e) => (e.code === "NO_WORLD_TO_BACK_UP" ? null : Promise.reject(e)));
  const stage = `.restore-${require("node:crypto").randomUUID()}`;
  const moved = [], installed = [];
  await files.mkdir(`${stage}/new`);
  await files.mkdir(`${stage}/old`);
  try {
    for (const w of meta.worlds) await files.copyTree(`${backupFolder}/data/${w}`, `${stage}/new/${w}`);
    const staged = await files.treeDigest(`${stage}/new`);
    if (staged.sha256 !== meta.sha256) throw fail("BACKUP_INTEGRITY_FAILED");
    try {
      for (const w of meta.worlds) {
        if (await files.exists(w)) { await files.rename(w, `${stage}/old/${w}`); moved.push(w); }
        await files.rename(`${stage}/new/${w}`, w);
        installed.push(w);
      }
    } catch (error) {
      // Preserve the recovery directory if rollback itself fails.
      try {
        for (const w of installed.reverse()) await files.rename(w, `${stage}/new/${w}`);
        for (const w of moved.reverse()) await files.rename(`${stage}/old/${w}`, w);
      } catch { throw fail("RESTORE_ROLLBACK_REQUIRED"); }
      throw error;
    }
  } catch (error) {
    if (error.code !== "RESTORE_ROLLBACK_REQUIRED") await files.remove(stage);
    throw error;
  }
  await files.remove(stage);
  return { restored: meta.worlds, safetyBackup: safety?.folder ?? null, verifiedFiles: check.files };
}

module.exports = { lookupPlayer, players, setPlayer, searchPlugins, installPlugin, listPlugins, setPluginEnabled, backup, listBackups, restore };
