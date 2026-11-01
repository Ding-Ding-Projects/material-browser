const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { fail } = require("./catalogue.cjs");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function inventory(dir) {
  const files = [];
  let total = 0;
  async function walk(at, prefix = "") {
    const stat = await fs.lstat(at);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      fail("UNSAFE_PATH", "Backup directories must not be links");
    for (const name of await fs.readdir(at)) {
      const full = path.join(at, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      const s = await fs.lstat(full);
      if (
        s.isSymbolicLink() ||
        (!s.isDirectory() && (!s.isFile() || s.nlink !== 1))
      )
        fail("UNSAFE_PATH", "Linked or special files are excluded from backup");
      if (s.isDirectory()) await walk(full, relative);
      else {
        total += s.size;
        if (files.length >= 10000 || total > 10 * 1024 ** 3)
          fail("BACKUP_LIMIT", "Backup exceeds 10000 files or 10 GiB");
        files.push({
          path: relative,
          size: s.size,
          sha256: hash(await fs.readFile(full)),
        });
      }
    }
  }
  await walk(dir);
  return { files, total };
}
async function copyVerified(source, destination, expected) {
  await fs.mkdir(destination, { recursive: false });
  for (const file of expected.files) {
    if (
      file.path.split("/").some((p) => !p || p === "." || p === "..") ||
      file.path.includes("\\") ||
      path.isAbsolute(file.path)
    )
      fail("UNSAFE_PATH", "Invalid backup manifest path");
    const bytes = await fs.readFile(path.join(source, file.path));
    if (bytes.length !== file.size || hash(bytes) !== file.sha256)
      fail("BACKUP_CHANGED", "Backup input changed during transfer");
    const target = path.join(destination, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  }
}
function createBackups(root) {
  const base = path.join(root, "backups");
  async function baseDir(id) {
    await fs.mkdir(base, { recursive: true });
    if ((await fs.lstat(base)).isSymbolicLink())
      fail("UNSAFE_PATH", "Backup root cannot be linked");
    const dir = path.join(base, id);
    await fs.mkdir(dir, { recursive: true });
    if ((await fs.lstat(dir)).isSymbolicLink())
      fail("UNSAFE_PATH", "Backup directory cannot be linked");
    return dir;
  }
  async function list(id) {
    const dir = await baseDir(id);
    const result = [];
    for (const name of await fs.readdir(dir)) {
      if (!/^[a-f0-9-]{36}$/.test(name)) continue;
      const item = path.join(dir, name);
      if ((await fs.lstat(item)).isSymbolicLink())
        fail("UNSAFE_PATH", "Backup cannot be linked");
      const manifest = JSON.parse(
        await fs.readFile(path.join(item, "manifest.json"), "utf8"),
      );
      result.push({
        id: name,
        createdAt: manifest.createdAt,
        files: manifest.files.length,
        total: manifest.total,
        version: manifest.version,
      });
    }
    return result;
  }
  async function backup(server, source) {
    const dir = await baseDir(server.id);
    const id = crypto.randomUUID();
    const dest = path.join(dir, id);
    const manifest = {
      ...(await inventory(source)),
      createdAt: new Date().toISOString(),
      version: server.version,
      serverId: server.id,
    };
    try {
      await copyVerified(source, dest, manifest);
      await fs.writeFile(
        path.join(dest, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        { flag: "wx" },
      );
      return {
        id,
        createdAt: manifest.createdAt,
        files: manifest.files.length,
        total: manifest.total,
        version: server.version,
      };
    } catch (e) {
      await fs.rm(dest, { recursive: true, force: true });
      throw e;
    }
  }
  async function restore(server, destination, backupId) {
    if (!/^[a-f0-9-]{36}$/.test(backupId || ""))
      fail("INVALID_ID", "Invalid backup identifier");
    const source = path.join(await baseDir(server.id), backupId);
    if ((await fs.lstat(source)).isSymbolicLink())
      fail("UNSAFE_PATH", "Backup cannot be linked");
    const manifest = JSON.parse(
      await fs.readFile(path.join(source, "manifest.json"), "utf8"),
    );
    if (manifest.serverId !== server.id || manifest.version !== server.version)
      fail(
        "INCOMPATIBLE_BACKUP",
        "Only the same server version can be restored",
      );
    const actual = await inventory(source);
    const expected = manifest.files;
    if (!Array.isArray(expected) || actual.files.length !== expected.length + 1)
      fail("INVALID_BACKUP", "Backup inventory changed");
    for (const f of expected) {
      const a = actual.files.find((x) => x.path === f.path);
      if (!a || a.sha256 !== f.sha256 || a.size !== f.size)
        fail("INVALID_BACKUP", "Backup contents failed integrity verification");
    }
    const rollback = await backup(server, destination);
    const stage = `${destination}.restore-${crypto.randomUUID()}`;
    const previous = `${destination}.previous-${crypto.randomUUID()}`;
    try {
      await copyVerified(source, stage, manifest);
      await fs.rename(destination, previous);
      try {
        await fs.rename(stage, destination);
      } catch (e) {
        await fs.rename(previous, destination);
        throw e;
      }
      await fs.rm(previous, { recursive: true });
      return { restored: true, backupId, rollbackBackupId: rollback.id };
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
  }
  return { list, backup, restore };
}
module.exports = { createBackups, inventory };
