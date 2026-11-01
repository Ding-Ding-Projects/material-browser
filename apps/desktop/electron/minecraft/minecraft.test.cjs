const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");

const util = require("./util.cjs");
const catalogue = require("./catalogue.cjs");
const properties = require("./properties.cjs");
const targets = require("./targets.cjs");
const hostfs = require("./hostfs.cjs");
const content = require("./content.cjs");
const { createService } = require("./service.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mb-mc-test-"));
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");

function fakeFetch(routes) {
  return async (url) => {
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    return { ok: true, status: 200, url, body: Readable.from([buffer]), text: async () => buffer.toString("utf8"), json: async () => JSON.parse(buffer.toString("utf8")) };
  };
}

const manifest = {
  latest: { release: "1.21.4", snapshot: "24w99a" },
  versions: [
    { id: "24w99a", type: "snapshot", url: "https://piston-meta.mojang.com/v1/packages/x/24w99a.json", sha1: "a".repeat(40), releaseTime: "2024-01-01" },
    { id: "1.21.4", type: "release", url: "https://piston-meta.mojang.com/v1/packages/y/1.21.4.json", sha1: "b".repeat(40), releaseTime: "2024-12-03" },
    { id: "b1.7.3", type: "old_beta", url: "https://piston-meta.mojang.com/v1/packages/z/b1.7.3.json", sha1: "c".repeat(40), releaseTime: "2011-07-08" },
    { id: "rd-132211", type: "old_alpha", url: "https://piston-meta.mojang.com/v1/packages/w/rd.json", sha1: "d".repeat(40), releaseTime: "2009-05-13" },
  ],
};

test("catalogue keeps every channel and every entry, with no curated ceiling", () => {
  const parsed = catalogue.parseJavaManifest(manifest);
  assert.equal(parsed.versions.length, 4);
  assert.deepEqual(new Set(parsed.versions.map((v) => v.channel)), new Set(catalogue.CHANNELS));
});

test("malformed or duplicated catalogue entries fail the refresh instead of being skipped", () => {
  assert.throws(() => catalogue.parseJavaManifest({ latest: {}, versions: [{ id: "x", type: "release", url: "u", sha1: "bad" }] }), /CATALOGUE_MALFORMED/);
  const dup = { ...manifest, versions: [manifest.versions[1], manifest.versions[1]] };
  assert.throws(() => catalogue.parseJavaManifest(dup), /CATALOGUE_MALFORMED/);
});

test("offline catalogue returns the last verified copy marked stale", async () => {
  const root = tmp();
  await catalogue.refreshJava(root, { fetchImpl: fakeFetch({ [catalogue.JAVA_MANIFEST]: manifest }) });
  const offline = await catalogue.javaCatalogue(root, { fetchImpl: async () => { throw Object.assign(new Error("offline"), { code: "ENOTFOUND" }); } });
  assert.equal(offline.stale, true);
  assert.equal(offline.count, 4);
  assert.ok(offline.retrievedAt);
});

test("version metadata must match the catalogue SHA-1, and a missing server download is explicit", async () => {
  const root = tmp();
  const body = JSON.stringify({ id: "b1.7.3", downloads: { client: {} } });
  const entry = { id: "b1.7.3", channel: "old_beta", url: "https://piston-meta.mojang.com/m.json", sha1: sha1(body) };
  const detail = await catalogue.javaVersionDetail(root, entry, { fetchImpl: fakeFetch({ [entry.url]: body }) });
  assert.equal(detail.server, null);
  assert.match(detail.unavailableReason, /no server download/);
  assert.equal(detail.javaMajor, null);
  const bad = { ...entry, id: "x", sha1: "0".repeat(40) };
  await assert.rejects(catalogue.javaVersionDetail(root, bad, { fetchImpl: fakeFetch({ [entry.url]: body }) }), /CATALOGUE_INTEGRITY_FAILED/);
});

test("Bedrock is reported unavailable with a reason, never as supported", () => {
  assert.equal(catalogue.BEDROCK_STATUS.available, false);
  assert.ok(catalogue.BEDROCK_STATUS.reason.length > 40);
});

test("server.properties round trip keeps comments, order and unknown keys", () => {
  const text = "#Minecraft server properties\n#Sun Nov 01\nmotd=Hello \\u00e9\ncustom-plugin-key=keep me\nmax-players=10\n";
  assert.equal(properties.serialize(properties.parse(text)), text);
  const view = properties.typedView(text, "1.21.4");
  assert.equal(view.typed.find((d) => d.key === "motd").value, "Hello é");
  assert.deepEqual(view.unknown.map((u) => u.key), ["custom-plugin-key"]);
});

test("every descriptor has a typed control; a generic textbox substitution turns red", () => {
  for (const d of properties.DESCRIPTORS) {
    assert.ok(["switch", "choice", "number", "text"].includes(d.control), d.key);
    if (d.control === "number") assert.ok(Number.isInteger(d.min) && Number.isInteger(d.max), d.key);
    if (d.control === "choice") assert.ok(d.choices.length >= 2, d.key);
    if (d.control === "text") assert.ok(d.maxLength > 0, d.key);
  }
  const typedKinds = properties.DESCRIPTORS.filter((d) => d.control !== "text").length;
  assert.ok(typedKinds >= properties.DESCRIPTORS.length * 0.7, "most settings must use rich non-text controls");
  assert.throws(() => properties.coerce({ key: "x", control: "textbox" }, "1"), /NO_CONTROL_FOR_KEY/);
});

test("typed changes validate bounds and refuse keys without a control", () => {
  assert.throws(() => properties.applyChanges("", "1.21.4", { "view-distance": 99 }), /INVALID_VALUE/);
  assert.throws(() => properties.applyChanges("", "1.21.4", { difficulty: "nightmare" }), /INVALID_VALUE/);
  assert.throws(() => properties.applyChanges("", "1.21.4", { "made-up": "1" }), /NO_CONTROL_FOR_KEY/);
  const r = properties.applyChanges("a=b\n", "1.21.4", { pvp: false, difficulty: "hard" });
  assert.match(r.text, /^a=b\npvp=false\ndifficulty=hard\n$/);
  assert.deepEqual(r.restart, ["pvp"]);
});

test("descriptors are version-bound: newer keys and defaults never apply to older servers", () => {
  const old = properties.descriptorsFor("1.16.5").map((d) => d.key);
  assert.ok(!old.includes("simulation-distance"));
  const newer = properties.descriptorsFor("1.21.9").map((d) => d.key);
  assert.ok(!newer.includes("pvp"), "pvp moved to a game rule in 1.21.9");
  const wl = properties.BY_KEY.get("white-list");
  assert.equal(properties.defaultFor(wl, "1.21.4"), false);
  assert.equal(properties.defaultFor(wl, "26.3"), true);
});

test("all four execution targets exist; removing one turns red", () => {
  assert.deepEqual(Object.keys(targets.TARGETS).sort(), ["docker", "local", "ssh", "ssh-docker"]);
});

test("validation rejects shell metacharacters and option injection everywhere", () => {
  assert.throws(() => util.assertSshHost({ hostname: "-oProxyCommand=x", user: "u" }), /INVALID_SSH_HOST/);
  assert.throws(() => util.assertSshHost({ hostname: "h", user: "a;b" }), /INVALID_SSH_USER/);
  assert.throws(() => util.assertRemotePath("/srv/../etc"), /INVALID_REMOTE_PATH/);
  assert.throws(() => util.assertRemotePath("/srv/$(id)"), /INVALID_REMOTE_PATH/);
  assert.throws(() => util.assertConsoleLine("say hi\nstop"), /INVALID_COMMAND/);
  assert.throws(() => util.assertPlayerName("bad name"), /INVALID_PLAYER_NAME/);
  assert.equal(util.shQuote("it's"), `'it'\\''s'`);
});

test("ssh always runs in batch mode against known hosts only", () => {
  const args = hostfs.sshArgs({ hostname: "example.org", user: "mc", port: 2222 }, "true");
  assert.ok(args.includes("BatchMode=yes"));
  assert.ok(args.includes("StrictHostKeyChecking=yes"));
  assert.deepEqual(args.slice(-2), ["mc@example.org", "true"]);
});

test("downloads only from allowlisted hosts and verify size and digest", async () => {
  const dir = tmp();
  const payload = Buffer.from("server bytes");
  const url = "https://piston-data.mojang.com/v1/objects/abc/server.jar";
  const ok = await util.downloadVerified(url, path.join(dir, "a.jar"), { sha1: sha1(payload), size: payload.length }, { fetchImpl: fakeFetch({ [url]: payload }) });
  assert.deepEqual(ok.verifiedBy, ["sha1"]);
  await assert.rejects(util.downloadVerified(url, path.join(dir, "b.jar"), { sha1: "0".repeat(40) }, { fetchImpl: fakeFetch({ [url]: payload }) }), /DOWNLOAD_INTEGRITY_FAILED/);
  assert.ok(!fs.existsSync(path.join(dir, "b.jar")));
  await assert.rejects(util.downloadVerified("https://evil.example/x.jar", path.join(dir, "c.jar")), /DOWNLOAD_HOST_NOT_ALLOWED/);
});

test("runtime images follow the version's Java and never guess an unresolved runtime", () => {
  assert.deepEqual(targets.imageFor(21), { image: "eclipse-temurin:21-jre", javaMajor: 21, exact: true });
  assert.equal(targets.imageFor(16).javaMajor, 17);
  assert.throws(() => targets.imageFor(null), /RUNTIME_UNRESOLVED/);
  assert.equal(targets.parseJavaMajor('openjdk version "21.0.4" 2024'), 21);
  assert.equal(targets.parseJavaMajor('java version "1.8.0_402"'), 8);
});

test("local server lifecycle: EULA gate, owned process, stdin commands and graceful stop", async () => {
  const folder = tmp();
  const processes = new Map();
  const spawned = [];
  const fakeSpawn = (cmd, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 4242;
    if (args[0] === "-version") {
      setImmediate(() => {
        child.stderr.emit("data", Buffer.from('openjdk version "21.0.4"'));
        child.emit("close", 0);
      });
      return child;
    }
    const written = [];
    child.stdin = { write: (s) => { written.push(s); if (s === "stop\n") setImmediate(() => { child.exitCode = 0; child.emit("exit", 0); }); } };
    child.written = written;
    child.kill = () => {};
    spawned.push({ cmd, args, child });
    return child;
  };
  const server = { id: "family-abc123", target: "local", folder, memoryMb: 2048, port: 0, javaMajor: 21, eulaAccepted: false };
  const a = targets.adapterFor(server, { spawn: fakeSpawn, processes, pollMs: 5 });
  await assert.rejects(a.start(), /EULA_NOT_ACCEPTED/);
  server.eulaAccepted = true;
  server.port = 0;
  // port 0 is outside the user range; bypass the free-port check by using an ephemeral port
  server.port = 45678;
  const started = await a.start();
  assert.equal(started.state, "running");
  assert.deepEqual(spawned[0].args.slice(-3), ["-jar", "server.jar", "nogui"]);
  await a.command("say hello");
  assert.deepEqual(spawned[0].child.written, ["say hello\n"]);
  const stopped = await a.stop({ timeoutMs: 2000 });
  assert.equal(stopped.state, "stopped");
  assert.deepEqual(spawned[0].child.written, ["say hello\n", "stop\n"]);
});

test("an SSH connection failure is Disconnected, never Stopped", async () => {
  const server = { id: "remote-abc123", target: "ssh", ssh: { hostname: "h.example", user: "mc", port: 22 }, folder: "/srv/mc", memoryMb: 2048, port: 25565 };
  const sshRun = async () => { throw Object.assign(new Error("SSH_DISCONNECTED"), { code: "SSH_DISCONNECTED" }); };
  const a = targets.adapterFor(server, { sshRun });
  assert.deepEqual(await a.status(), { state: "disconnected", reason: "SSH_DISCONNECTED" });
});

test("docker status ignores containers this app did not label", async () => {
  const server = { id: "box-abc123", target: "docker", folder: tmp(), memoryMb: 2048, port: 25565 };
  const fakeSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      child.stdout.emit("data", Buffer.from("running someone-else\n"));
      child.emit("close", 0);
    });
    return child;
  };
  const a = targets.adapterFor(server, { spawn: fakeSpawn });
  assert.equal((await a.status()).state, "not-owned");
});

test("players merge allowlist, operators and bans; stopped edits keep other entries", async () => {
  const folder = tmp();
  const files = hostfs.localFs(folder);
  fs.writeFileSync(path.join(folder, "whitelist.json"), JSON.stringify([{ uuid: "u1", name: "Alex" }, { uuid: "u2", name: "Sam" }]));
  fs.writeFileSync(path.join(folder, "ops.json"), JSON.stringify([{ uuid: "u1", name: "Alex", level: 4 }]));
  const list = await content.players(files);
  assert.deepEqual(list.map((p) => [p.name, p.allowlisted, p.operator]), [["Alex", true, true], ["Sam", true, false]]);
  await content.setPlayer(files, null, false, { uuid: "u2", name: "Sam" }, { operator: true });
  const ops = JSON.parse(fs.readFileSync(path.join(folder, "ops.json"), "utf8"));
  assert.deepEqual(ops.map((o) => o.name).sort(), ["Alex", "Sam"]);
});

test("backup and restore are digest-checked and keep the current world as a restore point", async () => {
  const folder = tmp();
  const files = hostfs.localFs(folder);
  fs.mkdirSync(path.join(folder, "world", "region"), { recursive: true });
  fs.writeFileSync(path.join(folder, "world", "level.dat"), "v1");
  const b = await content.backup(files, "world", "manual", new Date("2026-11-01T00:00:00Z"));
  assert.equal(b.files, 1);
  fs.writeFileSync(path.join(folder, "world", "level.dat"), "v2");
  const r = await content.restore(files, b.folder, "world");
  assert.equal(fs.readFileSync(path.join(folder, "world", "level.dat"), "utf8"), "v1");
  assert.ok(r.safetyBackup);
  fs.writeFileSync(path.join(folder, b.folder, "data", "world", "level.dat"), "tampered");
  await assert.rejects(content.restore(files, b.folder, "world"), /BACKUP_INTEGRITY_FAILED/);
});

test("plugin install refuses vanilla servers and a file without a published hash", async () => {
  await assert.rejects(content.searchPlugins({ flavour: "vanilla", version: "1.21.4" }, "x"), /NO_PLUGIN_SUPPORT/);
  const files = hostfs.localFs(tmp());
  const fetchImpl = fakeFetch({
    [`https://api.modrinth.com/v2/project/abcdef12/version?loaders=${encodeURIComponent('["paper"]')}&game_versions=${encodeURIComponent('["1.21.4"]')}`]: [
      { version_type: "release", version_number: "1.0", dependencies: [], files: [{ primary: true, filename: "x.jar", url: "https://cdn.modrinth.com/x.jar", hashes: {} }] },
    ],
  });
  await assert.rejects(content.installPlugin({ flavour: "paper", version: "1.21.4" }, files, "abcdef12", { fetchImpl }), /CATALOGUE_MALFORMED/);
});

test("service refuses Bedrock and invalid plans before touching anything", () => {
  const service = createService({ root: tmp() });
  const base = { target: "local", edition: "java", flavour: "vanilla", name: "A", version: "1.21.4", port: 25565, memoryMb: 2048, folder: tmp(), eulaAccepted: false };
  assert.ok(service.validatePlan(base));
  assert.throws(() => service.validatePlan({ ...base, edition: "bedrock" }), /EDITION_UNAVAILABLE/);
  assert.throws(() => service.validatePlan({ ...base, target: "cloud" }), /UNKNOWN_TARGET/);
  assert.throws(() => service.validatePlan({ ...base, port: 80 }), /INVALID_PORT/);
  assert.throws(() => service.validatePlan({ ...base, folder: "relative" }), /INVALID_FOLDER/);
  assert.throws(() => service.validatePlan({ ...base, target: "ssh", folder: "/srv/mc", ssh: { hostname: "h", user: "root;x" } }), /INVALID_SSH_USER/);
});

test("the posix launcher reads console lines from a file and never evaluates them", () => {
  assert.match(targets.RUN_SCRIPT, /tail -n0 -f console\.in/);
  assert.doesNotMatch(targets.RUN_SCRIPT, /eval|\$\(cat console/);
});
