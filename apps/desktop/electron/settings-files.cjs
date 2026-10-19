"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Only main-process-owned paths may enter this module. No renderer path is accepted.
async function inspect(
  target,
  kind,
  { missing = false, maxBytes = 1048576 } = {},
) {
  if (!path.isAbsolute(target)) throw Error("INVALID_SETTINGS_PATH");
  let current = path.resolve(target);
  while (true) {
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw Error("UNSAFE_SETTINGS_PATH");
      if (current === path.resolve(target)) {
        if (
          kind === "directory"
            ? !stat.isDirectory()
            : !stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes
        )
          throw Error("UNSAFE_SETTINGS_PATH");
      } else if (!stat.isDirectory()) throw Error("UNSAFE_SETTINGS_PATH");
    } catch (error) {
      if (error.code !== "ENOENT" || !missing) throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function directory(target) {
  await inspect(target, "directory", { missing: true });
  await fs.mkdir(target, { recursive: true, mode: 0o700 });
  await inspect(target, "directory");
}

async function read(target, maxBytes = 1048576) {
  await inspect(target, "file", { maxBytes });
  const before = await fs.lstat(target);
  const handle = await fs.open(target, "r");
  try {
    const actual = await handle.stat();
    if (
      !actual.isFile() ||
      actual.nlink !== 1 ||
      actual.size > maxBytes ||
      actual.dev !== before.dev ||
      actual.ino !== before.ino
    )
      throw Error("UNSAFE_SETTINGS_PATH");
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
        length,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw Error("SETTINGS_FILE_TOO_LARGE");
    const bytes = buffer.subarray(0, length);
    await inspect(target, "file", { maxBytes });
    return bytes;
  } finally {
    await handle.close();
  }
}

async function writeExclusive(target, data) {
  const parent = path.dirname(target);
  await inspect(parent, "directory");
  await inspect(target, "file", { missing: true });
  const handle = await fs.open(target, "wx", 0o600);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) throw Error("UNSAFE_SETTINGS_PATH");
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await inspect(target, "file", { maxBytes: Buffer.byteLength(data) });
}

async function atomic(target, data, { replace = fs.rename } = {}) {
  await directory(path.dirname(target));
  await inspect(target, "file", { missing: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeExclusive(temporary, data);
  // Recheck the destination and all ancestors immediately before replacement.
  await inspect(target, "file", { missing: true });
  await replace(temporary, target);
  await inspect(target, "file", { maxBytes: Buffer.byteLength(data) });
}

module.exports = { inspect, directory, read, writeExclusive, atomic };
