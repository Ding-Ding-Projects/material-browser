const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { fail } = require("./transport.cjs");
async function safeDirectory(root) {
  await fs.mkdir(root, { recursive: true });
  if ((await fs.lstat(root)).isSymbolicLink())
    fail("UNSAFE_STORAGE", "Managed model storage cannot be linked");
}
async function readJson(root, name, fallback) {
  await safeDirectory(root);
  const file = path.join(root, name);
  try {
    const s = await fs.lstat(file);
    if (
      s.isSymbolicLink() ||
      !s.isFile() ||
      s.nlink !== 1 ||
      s.size > 32 * 1024 ** 2
    )
      fail("UNSAFE_STORAGE", "Managed model record is unsafe or oversized");
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
async function writeJson(root, name, value) {
  await safeDirectory(root);
  const file = path.join(root, name);
  try {
    const s = await fs.lstat(file);
    if (s.isSymbolicLink() || !s.isFile() || s.nlink !== 1)
      fail("UNSAFE_STORAGE", "Managed model record is unsafe");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const serialized = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(serialized) > 32 * 1024 ** 2)
    fail("STORAGE_LIMIT", "Managed record exceeds 32 MiB");
  const temp = path.join(root, `${name}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, serialized, {
      flag: "wx",
      mode: 0o600,
    });
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
module.exports = { readJson, writeJson, safeDirectory };
