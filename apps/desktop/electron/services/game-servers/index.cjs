const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const { createCatalogue, fail } = require("./catalogue.cjs");
const { createBackups } = require("./backups.cjs");
const content = require("./content.cjs");
const properties = require("../../minecraft/properties.cjs");
const remote = require("./ssh.cjs");
const { createLifecycle } = require("./lifecycle.cjs");
const TARGETS = ["local-process", "local-docker", "ssh-process", "ssh-docker"];
function createGameServerService({
  dataDir,
  fetch: fetcher,
  spawn = childProcess.spawn,
  catalogue = createCatalogue(fetcher),
} = {}) {
  if (!dataDir || !path.isAbsolute(dataDir))
    fail(
      "INVALID_STORAGE",
      "An absolute managed storage directory is required",
    );
  const root = path.join(dataDir, "game-servers");
  const running = new Map();
  const operations = new Map();
  let queue = Promise.resolve();
  let closing = false;
  const backups = createBackups(root);
  async function safeRoot() {
    await fs.mkdir(root, { recursive: true });
    if ((await fs.lstat(root)).isSymbolicLink())
      fail("UNSAFE_PATH", "Managed root cannot be a symbolic link");
  }
  function folder(id) {
    if (!/^[a-f0-9-]{36}$/.test(id || ""))
      fail("INVALID_ID", "Invalid managed server identifier");
    return path.join(root, id);
  }
  async function safeFolder(id) {
    const dir = folder(id);
    if ((await fs.lstat(dir)).isSymbolicLink())
      fail("UNSAFE_PATH", "Managed server cannot be a symbolic link");
    return dir;
  }
  async function atomic(file, value) {
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, value, { flag: "wx", mode: 0o600 });
    try {
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  async function safeFile(dir, name) {
    const file = path.join(dir, name);
    try {
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)
        fail("UNSAFE_PATH", "Managed files must be ordinary unshared files");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return file;
  }
  async function load(id) {
    const dir = await safeFolder(id);
    await safeFile(dir, "record.json");
    const s = JSON.parse(
      await fs.readFile(path.join(dir, "record.json"), "utf8"),
    );
    if (s.id !== id) fail("INVALID_RECORD", "Server identity mismatch");
    if (
      !TARGETS.includes(s.target) ||
      !Number.isInteger(s.memoryMb) ||
      s.memoryMb < 512 ||
      s.memoryMb > 65536 ||
      !Number.isInteger(s.port) ||
      s.port < 1024 ||
      s.port > 65535
    )
      fail("INVALID_RECORD", "Managed server configuration is invalid");
    if (
      s.target.endsWith("docker") &&
      !/^eclipse-temurin@sha256:[a-f0-9]{64}$/.test(s.imageDigest || "")
    )
      fail("INVALID_RECORD", "Managed image identity is invalid");
    try {
      const receipt = JSON.parse(
        await fs.readFile(await safeFile(dir, "process-state.json"), "utf8"),
      );
      s.ownershipUnresolved = !running.has(id);
      s.recoveryStatus = receipt.status || "unknown";
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return s;
  }
  async function save(s) {
    await atomic(
      await safeFile(await safeFolder(s.id), "record.json"),
      JSON.stringify(s, null, 2),
    );
  }
  const state = (s) => ({
    ...s,
    status: running.has(s.id)
      ? running.get(s.id).status
      : s.ownershipUnresolved
        ? s.recoveryStatus === "disconnected"
          ? "disconnected"
          : "unknown"
        : "stopped",
    pid: running.get(s.id)?.child.pid ?? null,
  });
  async function list() {
    await safeRoot();
    const items = [];
    for (const name of await fs.readdir(root)) {
      if (/^[a-f0-9-]{36}$/.test(name)) items.push(state(await load(name)));
    }
    return items;
  }
  async function stopped(id) {
    const s = await load(id);
    if (s.ownershipUnresolved)
      fail(
        "OWNERSHIP_UNRESOLVED",
        "A previous process receipt exists; verify that process before further mutation",
      );
    if (running.has(id))
      fail("SERVER_ACTIVE", "Stop the managed server before changing files");
  }
  async function create(p) {
    if (p.target && !TARGETS.includes(p.target))
      fail(
        "TARGET_UNAVAILABLE",
        "This target adapter has not been verified and is disabled",
      );
    if (p.edition && p.edition !== "java")
      fail(
        "EDITION_UNAVAILABLE",
        "Bedrock distribution installation is not implemented",
      );
    if (p.flavour && !["vanilla", "paper", "fabric"].includes(p.flavour))
      fail(
        "FLAVOUR_UNAVAILABLE",
        "Only official vanilla distributions are currently installed",
      );
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 100)
      fail("INVALID_NAME", "Provide a server name of at most 100 characters");
    if (p.eulaAccepted !== true)
      fail(
        "EULA_REQUIRED",
        "Explicit acceptance of the Minecraft EULA is required",
      );
    if (
      ["local-docker", "ssh-docker"].includes(p.target) &&
      !/^eclipse-temurin@sha256:[a-f0-9]{64}$/.test(p.imageDigest || "")
    )
      fail(
        "PINNED_IMAGE_REQUIRED",
        "Select a verified immutable eclipse-temurin image digest",
      );
    const memoryMb = p.memoryMb ?? 2048;
    const port = p.port ?? 25565;
    if (
      !Number.isInteger(memoryMb) ||
      memoryMb < 512 ||
      memoryMb > 65536 ||
      !Number.isInteger(port) ||
      port < 1024 ||
      port > 65535
    )
      fail(
        "INVALID_CONFIGURATION",
        "Memory or port is outside the supported range",
      );
    await safeRoot();
    if (
      p.operationId &&
      (!/^[a-zA-Z0-9-]{1,80}$/.test(p.operationId) ||
        operations.has(p.operationId))
    )
      fail("INVALID_OPERATION", "Invalid or active operation identifier");
    const id = crypto.randomUUID();
    const controller = new AbortController();
    operations.set(id, controller);
    // The operation identity is supplied by the caller so cancellation can interrupt downloads.
    if (p.operationId) {
      if (
        !/^[a-zA-Z0-9-]{1,80}$/.test(p.operationId) ||
        operations.has(p.operationId)
      )
        fail("INVALID_OPERATION", "Invalid or active operation identifier");
      operations.set(p.operationId, controller);
    }
    let created = false;
    try {
      const version = await catalogue.resolve(p.version, controller.signal, {
        flavour: p.flavour || "vanilla",
        buildId: p.buildId,
        loaderVersion: p.loaderVersion,
        installerVersion: p.installerVersion,
      });
      if (!version.available) fail("DISTRIBUTION_UNAVAILABLE", version.reason);
      if (
        version.integrityKnown === false &&
        p.unverifiedDistributionAccepted !== true
      )
        fail(
          "INTEGRITY_ACKNOWLEDGEMENT_REQUIRED",
          "This bootstrap has no published checksum; review and explicitly accept its disclosed integrity limit",
        );
      const bytes = await catalogue.download(
        version.download,
        controller.signal,
      );
      if (controller.signal.aborted)
        fail("CANCELLED", "Installation cancelled");
      const ssh = p.target?.startsWith("ssh-")
        ? remote.validateSsh(p.ssh, id)
        : null;
      const dir = folder(id);
      await fs.mkdir(dir);
      created = true;
      const s = {
        id,
        name: p.name.trim(),
        edition: "java",
        flavour: p.flavour || "vanilla",
        distribution: {
          buildId: version.buildId,
          loaderVersion: version.loaderVersion,
          installerVersion: version.installerVersion,
          licence: version.licence,
          licenceUrl: version.licenceUrl,
        },
        version: p.version,
        target: p.target || "local-process",
        imageDigest: ["local-docker", "ssh-docker"].includes(p.target)
          ? p.imageDigest
          : null,
        ssh,
        remoteProvisioned: false,
        memoryMb,
        port,
        createdAt: new Date().toISOString(),
        eulaAcceptedAt: new Date().toISOString(),
        integrity: {
          sha1: version.download.sha1 || null,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          publishedSha256: version.download.sha256 || null,
          integrityKnown: version.integrityKnown !== false,
          integrityNote: version.integrityNote || null,
          size: bytes.length,
          source: version.download.url,
        },
        runtime: { javaMajor: version.javaMajor },
        properties: {},
      };
      await fs.writeFile(path.join(dir, "server.jar"), bytes, { flag: "wx" });
      await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n", {
        flag: "wx",
      });
      await fs.writeFile(
        path.join(dir, "server.properties"),
        `server-port=${port}\n${p.target?.endsWith("docker") ? "" : "server-ip=127.0.0.1\n"}`,
        { flag: "wx" },
      );
      await save(s);
      return state(s);
    } catch (e) {
      if (created) await fs.rm(folder(id), { recursive: true, force: true });
      throw e;
    } finally {
      operations.delete(id);
      if (p.operationId) operations.delete(p.operationId);
    }
  }
  async function configure(p) {
    await stopped(p.id);
    const s = await load(p.id);
    const file = await safeFile(await safeFolder(p.id), "server.properties");
    const original = await fs.readFile(file, "utf8");
    const changes = p.properties;
    if (
      !changes ||
      Array.isArray(changes) ||
      typeof changes !== "object" ||
      Object.keys(changes).length > 100
    )
      fail("INVALID_CONFIGURATION", "Provide bounded property changes");
    if (
      Object.hasOwn(changes, "server-port") &&
      (!Number.isInteger(changes["server-port"]) ||
        changes["server-port"] < 1024 ||
        changes["server-port"] > 65535)
    )
      fail(
        "INVALID_CONFIGURATION",
        "Managed server port must be between 1024 and 65535",
      );
    let result;
    try {
      result = properties.applyChanges(original, s.version, changes);
    } catch (error) {
      if (error.code === "NO_CONTROL_FOR_KEY")
        fail(
          "UNSUPPORTED_PROPERTY",
          "This property has no supported version-bound descriptor",
        );
      throw error;
    }
    await atomic(file, result.text);
    s.properties = { ...s.properties, ...changes };
    if (changes["server-port"]) s.port = changes["server-port"];
    await save(s);
    if (s.ssh && s.remoteProvisioned)
      await remote.provision(
        spawn,
        remote.validateSsh(s.ssh, s.id),
        await safeFolder(s.id),
        true,
      );
    return state(s);
  }
  const lifecycle = createLifecycle({
    load,
    stopped,
    safeFolder,
    safeFile,
    spawn,
    save,
    running,
    state,
    atomic,
    targets: TARGETS,
  });
  async function dispatch({ action, params: p = {} } = {}) {
    switch (action) {
      case "capabilities":
        return {
          targets: TARGETS.map((id) => ({
            id,
            available: true,
            runtimeVerified: false,
            reason: id.startsWith("ssh-")
              ? "Requires preverified SSH host identity and authentication; Linux remote only"
              : null,
          })),
          editions: [
            { id: "java", available: true },
            {
              id: "bedrock",
              available: false,
              reason: "Official distribution adapter is incomplete",
            },
          ],
          flavours: ["vanilla", "paper", "fabric"],
          actions: [
            "list",
            "discoverVersions",
            "resolveVersion",
            "create",
            "configure",
            "readConfiguration",
            "start",
            "stop",
            "restart",
            "logs",
            "cancel",
            "backup",
            "listBackups",
            "restore",
            "listContent",
            "installContent",
            "removeContent",
          ],
          metricsAvailable: false,
          commandsAvailable: false,
          backupsAvailable: true,
          contentKinds: [
            { id: "datapack", available: true, compatibility: "unknown" },
            {
              id: "plugin",
              available: false,
              reason: "Vanilla does not load plugins",
            },
            {
              id: "mod",
              available: false,
              reason: "Mod loader installation is incomplete",
            },
          ],
        };
      case "list":
        return list();
      case "discoverVersions":
        return catalogue.discover(undefined, {
          flavour: p.flavour || "vanilla",
        });
      case "resolveVersion":
        return catalogue.resolve(p.version, undefined, p);
      case "create":
        return create(p);
      case "start":
        return lifecycle.start(p);
      case "stop":
        return lifecycle.stop(p);
      case "restart":
        await lifecycle.stop(p);
        return lifecycle.start(p);
      case "configure":
        return configure(p);
      case "listContent":
        await load(p.id);
        return content.listContent(await safeFolder(p.id));
      case "installContent":
        if ((await load(p.id)).ssh)
          fail(
            "REMOTE_STORAGE_UNAVAILABLE",
            "Remote content transfer is incomplete",
          );
        await stopped(p.id);
        return content.installContent(await safeFolder(p.id), p);
      case "removeContent":
        if ((await load(p.id)).ssh)
          fail(
            "REMOTE_STORAGE_UNAVAILABLE",
            "Remote content transfer is incomplete",
          );
        await stopped(p.id);
        await backups.backup(await load(p.id), await safeFolder(p.id));
        return content.removeContent(await safeFolder(p.id), p);
      case "listBackups":
        await load(p.id);
        return backups.list(p.id);
      case "backup": {
        await stopped(p.id);
        const s = await load(p.id);
        if (s.ssh)
          fail(
            "REMOTE_STORAGE_UNAVAILABLE",
            "Remote world backup transfer is incomplete",
          );
        return backups.backup(s, await safeFolder(p.id));
      }
      case "restore": {
        await stopped(p.id);
        const s = await load(p.id);
        if (s.ssh)
          fail(
            "REMOTE_STORAGE_UNAVAILABLE",
            "Remote world restore transfer is incomplete",
          );
        return backups.restore(s, await safeFolder(p.id), p.backupId);
      }
      case "readConfiguration": {
        const s = await load(p.id);
        const file = await safeFile(
          await safeFolder(p.id),
          "server.properties",
        );
        const text = await fs.readFile(file, "utf8");
        const sourceView = properties.typedView(text, s.version);
        const view = {
          ...sourceView,
          typed: sourceView.typed.map((descriptor) => ({
            ...descriptor,
            declaredApply: descriptor.apply,
            ...(descriptor.key === "server-port" ? { min: 1024 } : {}),
            apply: "restart",
            liveAvailable: false,
          })),
        };
        return {
          id: s.id,
          properties: properties.toObject(properties.parse(text)),
          descriptors: view.typed.map((descriptor) => ({
            ...descriptor,
            type:
              descriptor.control === "number"
                ? "integer"
                : descriptor.control === "switch"
                  ? "boolean"
                  : descriptor.control === "choice"
                    ? "enum"
                    : "text",
            restartRequired: true,
          })),
          typed: view.typed,
          unknown: view.unknown,
          unknownPreserved: true,
          version: s.version,
          verification: "implemented-unverified",
        };
      }
      case "logs":
        await load(p.id);
        return {
          lines: running.get(p.id)?.logs.slice() || [],
          source: "owned-process",
          available: running.has(p.id),
        };
      case "cancel": {
        const controller = operations.get(p.operationId);
        if (!controller) return { cancelled: false };
        controller.abort();
        return { cancelled: true };
      }
      default:
        fail("UNSUPPORTED_ACTION", "This server operation is not implemented");
    }
  }
  return {
    request(input) {
      if (closing)
        return Promise.reject(
          Object.assign(new Error("Server service is shutting down"), {
            code: "SERVICE_CLOSING",
          }),
        );
      if (
        [
          "cancel",
          "logs",
          "list",
          "capabilities",
          "discoverVersions",
          "resolveVersion",
        ].includes(input?.action)
      )
        return dispatch(input);
      const result = queue.then(() => {
        if (closing) fail("SERVICE_CLOSING", "Server service is shutting down");
        return dispatch(input);
      });
      queue = result.catch(() => {});
      return result;
    },
    async dispose() {
      closing = true;
      for (const c of operations.values()) c.abort();
      await queue;
      const results = await Promise.allSettled(
        [...running.keys()].map((id) => lifecycle.stop({ id })),
      );
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length)
        throw Object.assign(
          new AggregateError(
            failures.map((result) => result.reason),
            "Owned server shutdown remains incomplete",
          ),
          { code: "STOP_PENDING" },
        );
    },
  };
}
module.exports = { createGameServerService };
