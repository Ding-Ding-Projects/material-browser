const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { fail } = require("./catalogue.cjs");
async function contentDirectory(dir, create = true) {
  for (const component of ["world", "datapacks"]) {
    dir = path.join(dir, component);
    if (create) await fs.mkdir(dir, { recursive: true });
    const s = await fs.lstat(dir);
    if (s.isSymbolicLink() || !s.isDirectory())
      fail("UNSAFE_PATH", "Content directories must not be linked");
  }
  return dir;
}
async function listContent(dir) {
  let folder;
  try {
    folder = await contentDirectory(dir, false);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const items = [];
  for (const name of await fs.readdir(folder)) {
    const file = path.join(folder, name);
    const s = await fs.lstat(file);
    if (s.isSymbolicLink() || !s.isFile() || s.nlink !== 1)
      fail("UNSAFE_PATH", "Content must be ordinary unshared files");
    if (s.size > 32 * 1024 ** 2) {
      items.push({
        id: name,
        name,
        size: s.size,
        managed: false,
        compatibility: "unknown",
        reason: "File exceeds managed inspection bound",
      });
      continue;
    }
    const bytes = await fs.readFile(file);
    items.push({
      id: name,
      name,
      size: s.size,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      managed: /^[a-f0-9]{64}\.zip$/.test(name),
      compatibility: "unknown",
      kind: "datapack",
    });
  }
  return items;
}
async function installContent(dir, p) {
  if (p.kind !== "datapack")
    fail(
      "CONTENT_UNAVAILABLE",
      "Only Java vanilla data packs are currently supported",
    );
  if (p.compatibilityAcknowledged !== true)
    fail(
      "COMPATIBILITY_REQUIRED",
      "Compatibility is unknown; explicit acknowledgement is required",
    );
  if (
    typeof p.bytesBase64 !== "string" ||
    p.bytesBase64.length > 44739244 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(p.bytesBase64)
  )
    fail(
      "INVALID_CONTENT",
      "Provide a bounded base64 ZIP from an explicit file selection",
    );
  const bytes = Buffer.from(p.bytesBase64, "base64");
  if (
    bytes.length < 4 ||
    bytes.length > 32 * 1024 ** 2 ||
    bytes.readUInt32LE(0) !== 0x04034b50
  )
    fail(
      "INVALID_CONTENT",
      "Data pack must be a ZIP archive of at most 32 MiB",
    );
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(p.sha256 || "") || sha256 !== p.sha256)
    fail("INTEGRITY_FAILED", "Selected package SHA-256 does not match");
  const folder = await contentDirectory(dir);
  const name = `${sha256}.zip`;
  await fs.writeFile(path.join(folder, name), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  return {
    id: name,
    name,
    size: bytes.length,
    sha256,
    kind: "datapack",
    managed: true,
    compatibility: "unknown",
    restartRequired: true,
  };
}
async function removeContent(dir, p) {
  if (!/^[a-f0-9]{64}\.zip$/.test(p.contentId || ""))
    fail("INVALID_CONTENT", "Only managed content may be removed");
  const folder = await contentDirectory(dir, false);
  const target = path.join(folder, p.contentId);
  const s = await fs.lstat(target);
  if (s.isSymbolicLink() || !s.isFile() || s.nlink !== 1)
    fail("UNSAFE_PATH", "Managed content identity changed");
  const bytes = await fs.readFile(target);
  if (
    crypto.createHash("sha256").update(bytes).digest("hex") + ".zip" !==
    p.contentId
  )
    fail("INTEGRITY_FAILED", "Content changed since installation");
  await fs.unlink(target);
  return { removed: true, id: p.contentId };
}
module.exports = { listContent, installContent, removeContent };
