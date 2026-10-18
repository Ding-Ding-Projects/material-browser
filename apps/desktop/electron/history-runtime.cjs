"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { inspect, read } = require("./settings-files.cjs");

async function verifyHistoryRuntime({ manifestPath, payloadParent }) {
  const manifest = JSON.parse(
    (await read(manifestPath, 1048576)).toString("utf8"),
  );
  if (
    manifest.schemaVersion !== 1 ||
    !/^\d+\.\d+\.\d+\.windows\.\d+$/.test(manifest.version) ||
    manifest.release !== `v${manifest.version}` ||
    manifest.executable !== "cmd/git.exe" ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > 5000
  )
    throw Error("HISTORY_RUNTIME_UNAVAILABLE");
  const root = path.join(payloadParent, manifest.release),
    expected = new Map(),
    directories = new Set();
  for (const entry of manifest.files) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      !/^[a-zA-Z0-9_.+@/-]+$/.test(entry.path) ||
      entry.path
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      entry.size > 134217728 ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      expected.has(entry.path.toLowerCase())
    )
      throw Error("HISTORY_RUNTIME_UNAVAILABLE");
    expected.set(entry.path.toLowerCase(), entry);
    let parent = path.posix.dirname(entry.path);
    while (parent !== ".") {
      directories.add(parent.toLowerCase());
      parent = path.posix.dirname(parent);
    }
  }
  if (!expected.has("cmd/git.exe")) throw Error("HISTORY_RUNTIME_UNAVAILABLE");
  await inspect(root, "directory");
  const queue = [root];
  let count = 0,
    entries = 0;
  while (queue.length) {
    const directory = queue.pop();
    await inspect(directory, "directory");
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (++entries > 10000) throw Error("HISTORY_RUNTIME_UNAVAILABLE");
      const target = path.join(directory, entry.name),
        relative = path
          .relative(root, target)
          .split(path.sep)
          .join("/")
          .toLowerCase();
      if (entry.isDirectory()) {
        if (!directories.has(relative))
          throw Error("HISTORY_RUNTIME_UNAVAILABLE");
        await inspect(target, "directory");
        queue.push(target);
      } else {
        const wanted = expected.get(relative);
        if (!wanted) throw Error("HISTORY_RUNTIME_UNAVAILABLE");
        await inspect(target, "file", { maxBytes: wanted.size });
        const before = await fs.lstat(target);
        if (before.size !== wanted.size)
          throw Error("HISTORY_RUNTIME_UNAVAILABLE");
        const handle = await fs.open(target, "r");
        try {
          const opened = await handle.stat();
          if (
            opened.dev !== before.dev ||
            opened.ino !== before.ino ||
            opened.nlink !== 1
          )
            throw Error("HISTORY_RUNTIME_UNAVAILABLE");
          const hash = createHash("sha256"),
            buffer = Buffer.alloc(65536);
          let total = 0;
          while (true) {
            const { bytesRead } = await handle.read(
              buffer,
              0,
              buffer.length,
              total,
            );
            if (!bytesRead) break;
            total += bytesRead;
            if (total > wanted.size) throw Error("HISTORY_RUNTIME_UNAVAILABLE");
            hash.update(buffer.subarray(0, bytesRead));
          }
          if (total !== wanted.size || hash.digest("hex") !== wanted.sha256)
            throw Error("HISTORY_RUNTIME_UNAVAILABLE");
        } finally {
          await handle.close();
        }
        await inspect(target, "file", { maxBytes: wanted.size });
        count++;
      }
    }
  }
  if (count !== expected.size) throw Error("HISTORY_RUNTIME_UNAVAILABLE");
  return {
    gitExecutable: path.join(root, "cmd", "git.exe"),
    gitSha256: expected.get("cmd/git.exe").sha256,
    version: manifest.version,
    verifiedFiles: count,
  };
}
module.exports = { verifyHistoryRuntime };
