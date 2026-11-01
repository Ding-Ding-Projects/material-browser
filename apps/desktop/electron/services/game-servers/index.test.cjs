const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createGameServerService } = require("./index.cjs");
const { createCatalogue } = require("./catalogue.cjs");
async function fixture(t, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "material-server-"));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const bytes = Buffer.from("test distribution");
  const sha1 = crypto.createHash("sha1").update(bytes).digest("hex");
  const catalogue = {
    resolve: async () => ({
      available: true,
      javaMajor: 21,
      download: {
        sha1,
        size: bytes.length,
        url: "https://piston-data.mojang.com/server.jar",
      },
    }),
    download: async () => bytes,
    discover: async () => ({ versions: [] }),
  };
  return {
    dataDir,
    service: createGameServerService({ dataDir, catalogue, ...options }),
  };
}
test("creation requires consent and persists validated official distribution", async (t) => {
  const { dataDir, service } = await fixture(t);
  await assert.rejects(
    service.request({
      action: "create",
      params: { name: "One", version: "test" },
    }),
    { code: "EULA_REQUIRED" },
  );
  const item = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  assert.equal(item.status, "stopped");
  const next = createGameServerService({ dataDir });
  assert.equal((await next.request({ action: "list" }))[0].id, item.id);
  assert.equal(
    await fs.readFile(
      path.join(dataDir, "game-servers", item.id, "eula.txt"),
      "utf8",
    ),
    "eula=true\n",
  );
});
test("unsupported targets and arbitrary identifiers fail without mutation", async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(
    service.request({ action: "create", params: { target: "invalid" } }),
    { code: "TARGET_UNAVAILABLE" },
  );
  await assert.rejects(
    service.request({ action: "start", params: { id: "../other" } }),
    { code: "INVALID_ID" },
  );
  assert.equal(
    (await service.request({ action: "capabilities" })).targets.filter(
      (t) => t.available,
    ).length,
    4,
  );
});
test("configuration preserves unknown keys and rejects arbitrary properties", async (t) => {
  const { dataDir, service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  const file = path.join(dataDir, "game-servers", s.id, "server.properties");
  await fs.appendFile(file, "unknown-option=preserved\n");
  await service.request({
    action: "configure",
    params: { id: s.id, properties: { motd: "Hello" } },
  });
  assert.match(await fs.readFile(file, "utf8"), /unknown-option=preserved/);
  await assert.rejects(
    service.request({
      action: "configure",
      params: { id: s.id, properties: { "online-mode": false } },
    }),
    { code: "UNSUPPORTED_PROPERTY" },
  );
});
test("metadata hash mismatch and foreign endpoints are rejected", async () => {
  const bytes = Buffer.from(
    JSON.stringify({
      versions: [
        {
          id: "test",
          type: "release",
          url: "https://piston-meta.mojang.com/test.json",
          sha1: "0".repeat(40),
        },
      ],
    }),
  );
  const catalogue = createCatalogue(
    async (url) =>
      new Response(url.endsWith("version_manifest_v2.json") ? bytes : "{}"),
  );
  await assert.rejects(catalogue.resolve("test"), { code: "INTEGRITY_FAILED" });
  const bad = createCatalogue(
    async () =>
      new Response(
        JSON.stringify({
          versions: [
            { id: "test", url: "https://example.com/a", sha1: "0".repeat(40) },
          ],
        }),
      ),
  );
  await assert.rejects(bad.discover(), { code: "INVALID_SOURCE" });
});
test("historical client-only entries remain discoverable but unavailable for installation", async () => {
  const metadata = Buffer.from("{}");
  const hash = crypto.createHash("sha1").update(metadata).digest("hex");
  const manifest = JSON.stringify({
    versions: [
      {
        id: "old",
        type: "old_alpha",
        url: "https://piston-meta.mojang.com/old.json",
        sha1: hash,
      },
    ],
  });
  const catalogue = createCatalogue(
    async (url) =>
      new Response(
        url.endsWith("version_manifest_v2.json") ? manifest : metadata,
      ),
  );
  const list = await catalogue.discover();
  assert.equal(list.versions[0].type, "old_alpha");
  assert.equal((await catalogue.resolve("old")).available, false);
});
test("backups verify bytes, preserve a rollback point and restore stopped servers", async (t) => {
  const { dataDir, service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  const saved = await service.request({
    action: "backup",
    params: { id: s.id },
  });
  await service.request({
    action: "configure",
    params: { id: s.id, properties: { motd: "Changed" } },
  });
  const result = await service.request({
    action: "restore",
    params: { id: s.id, backupId: saved.id },
  });
  assert.equal(result.restored, true);
  assert.ok(result.rollbackBackupId);
  assert.equal(
    (await service.request({ action: "listBackups", params: { id: s.id } }))
      .length,
    2,
  );
  assert.doesNotMatch(
    await fs.readFile(
      path.join(dataDir, "game-servers", s.id, "server.properties"),
      "utf8",
    ),
    /Changed/,
  );
});
test("tampered backup and backup path traversal fail before replacement", async (t) => {
  const { dataDir, service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  const b = await service.request({ action: "backup", params: { id: s.id } });
  await fs.appendFile(
    path.join(dataDir, "game-servers", "backups", s.id, b.id, "server.jar"),
    "tamper",
  );
  await assert.rejects(
    service.request({
      action: "restore",
      params: { id: s.id, backupId: b.id },
    }),
    { code: "INVALID_BACKUP" },
  );
  await assert.rejects(
    service.request({
      action: "restore",
      params: { id: s.id, backupId: "../escape" },
    }),
    { code: "INVALID_ID" },
  );
  assert.equal((await service.request({ action: "list" })).length, 1);
});
test("duplicate properties all receive the same effective value", async (t) => {
  const { dataDir, service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  const file = path.join(dataDir, "game-servers", s.id, "server.properties");
  await fs.writeFile(file, "server-port=25565\nserver-port=25566\n");
  await service.request({
    action: "configure",
    params: { id: s.id, properties: { "server-port": 25570 } },
  });
  assert.equal(
    await fs.readFile(file, "utf8"),
    "server-port=25570\nserver-port=25570\n",
  );
});
test("a surviving prior-session receipt is unknown and blocks mutation", async (t) => {
  const { dataDir, service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  await fs.writeFile(
    path.join(dataDir, "game-servers", s.id, "process-state.json"),
    '{"pid":123}',
  );
  assert.equal(
    (await service.request({ action: "list" }))[0].status,
    "unknown",
  );
  await assert.rejects(
    service.request({ action: "backup", params: { id: s.id } }),
    { code: "OWNERSHIP_UNRESOLVED" },
  );
});
test("container creation requires an immutable trusted runtime image", async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(
    service.request({
      action: "create",
      params: {
        name: "Container",
        target: "local-docker",
        version: "test",
        eulaAccepted: true,
        imageDigest: "eclipse-temurin:latest",
      },
    }),
    { code: "PINNED_IMAGE_REQUIRED" },
  );
  const s = await service.request({
    action: "create",
    params: {
      name: "Container",
      target: "local-docker",
      version: "test",
      eulaAccepted: true,
      imageDigest: "eclipse-temurin@sha256:" + "a".repeat(64),
    },
  });
  assert.equal(s.target, "local-docker");
});
test("content rejects incompatible kinds and malformed imports without partial files", async (t) => {
  const { service } = await fixture(t);
  const s = await service.request({
    action: "create",
    params: { name: "One", version: "test", eulaAccepted: true },
  });
  await assert.rejects(
    service.request({
      action: "installContent",
      params: { id: s.id, kind: "plugin" },
    }),
    { code: "CONTENT_UNAVAILABLE" },
  );
  await assert.rejects(
    service.request({
      action: "installContent",
      params: {
        id: s.id,
        kind: "datapack",
        compatibilityAcknowledged: true,
        bytesBase64: "bm90emlw",
        sha256: "0".repeat(64),
      },
    }),
    { code: "INVALID_CONTENT" },
  );
  assert.deepEqual(
    await service.request({ action: "listContent", params: { id: s.id } }),
    [],
  );
});

test("SSH descriptors reject command injection and preserve strict host-key checking", () => {
  const ssh = require("./ssh.cjs");
  assert.throws(
    () =>
      ssh.validateSsh(
        {
          host: "host;touch file",
          username: "user",
          remoteRoot: "/srv/servers",
          javaPath: "/usr/bin/java",
        },
        "id",
      ),
    { code: "INVALID_SSH" },
  );
  const target = ssh.validateSsh(
    {
      host: "server.example",
      username: "user",
      remoteRoot: "/srv/servers",
      javaPath: "/usr/bin/java",
    },
    "id",
  );
  const args = ssh.command(target, ["/usr/bin/java", "-version"]);
  assert.ok(args.includes("StrictHostKeyChecking=yes"));
  assert.ok(args.includes("BatchMode=yes"));
  assert.equal(args.at(-1), "'/usr/bin/java' '-version'");
  assert.throws(
    () => ssh.validateSsh({ ...target, remoteRoot: "/srv/../etc" }, "id"),
    { code: "INVALID_SSH" },
  );
});
test("owned lifecycle probes Java, remains starting and stops gracefully without shell execution", async (t) => {
  const { EventEmitter } = require("node:events");
  const { PassThrough } = require("node:stream");
  const calls = [];
  const spawn = (exe, args, options) => {
    calls.push({ exe, args, options });
    const child = new EventEmitter();
    child.pid = 8123;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {};
    process.nextTick(() => {
      child.emit("spawn");
      if (args.includes("-version")) {
        child.stderr.write('openjdk version "21.0.1"');
        child.emit("exit", 0, null);
      }
    });
    child.stdin.on("data", (b) => {
      if (b.toString() === "stop\n")
        process.nextTick(() => child.emit("exit", 0, null));
    });
    return child;
  };
  const { service } = await fixture(t, { spawn });
  const server = await service.request({
    action: "create",
    params: { name: "Lifecycle", version: "test", eulaAccepted: true },
  });
  const started = await service.request({
    action: "start",
    params: { id: server.id, javaPath: path.resolve("java.exe") },
  });
  assert.equal(started.status, "starting");
  assert.equal(calls[1].options.shell, false);
  assert.deepEqual(calls[1].args, [
    "-Xms512M",
    "-Xmx2048M",
    "-jar",
    "server.jar",
    "nogui",
  ]);
  await service.request({ action: "stop", params: { id: server.id } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    (await service.request({ action: "list" }))[0].status,
    "stopped",
  );
  await service.dispose();
});
