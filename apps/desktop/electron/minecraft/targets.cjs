// The four execution targets. Each adapter starts, stops, sends console lines to and reports on
// exactly the server it owns. Nothing here terminates a process or container it did not start.
const { spawn } = require("node:child_process");
const net = require("node:net");
const { fail, shQuote, assertConsoleLine, assertId } = require("./util.cjs");
const { sshRun, localFs, sshFs } = require("./hostfs.cjs");

const TARGETS = Object.freeze({
  local: { label: "This PC", shell: false, docker: false },
  docker: { label: "Docker on this PC", shell: false, docker: true },
  ssh: { label: "Process on an SSH host", shell: true, docker: false },
  "ssh-docker": { label: "Docker on an SSH host", shell: true, docker: true },
});

const TEMURIN_JRE = [8, 11, 17, 21, 25];
const LABEL = "material-browser.server";
const LOG_LINES = 400;

/** The launcher used on POSIX hosts and inside containers: console lines arrive through console.in. */
const RUN_SCRIPT = `#!/bin/sh
cd "$(dirname "$0")" || exit 1
: > console.in
{ tail -n0 -f console.in & echo $! > tail.pid; wait; } | java $MB_JAVA_OPTS -jar server.jar nogui
CODE=$?
kill "$(cat tail.pid)" 2>/dev/null
rm -f tail.pid run.pid
exit $CODE
`;

function javaOptions(memoryMb) {
  if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 262144) throw fail("INVALID_MEMORY");
  return `-Xms${Math.min(memoryMb, 1024)}M -Xmx${memoryMb}M`;
}

function imageFor(javaMajor) {
  if (!Number.isInteger(javaMajor)) throw fail("RUNTIME_UNRESOLVED");
  const tag = TEMURIN_JRE.find((v) => v >= javaMajor);
  if (!tag) throw fail("NO_RUNTIME_IMAGE", String(javaMajor));
  return { image: `eclipse-temurin:${tag}-jre`, javaMajor: tag, exact: tag === javaMajor };
}

function parseJavaMajor(text) {
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text || "");
  if (!m) return null;
  return m[1] === "1" ? Number(m[2]) : Number(m[1]);
}

function portFree(port, hostname = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, hostname, () => server.close(() => resolve(true)));
  });
}

function runLocal(command, args, { timeout = 60000, spawnImpl = spawn, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, { windowsHide: true });
    const out = [], err = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(fail("COMMAND_TIMEOUT", command));
    }, timeout);
    child.stdout?.on("data", (d) => out.push(d));
    child.stderr?.on("data", (d) => err.push(d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(fail(e.code === "ENOENT" ? `${command.toUpperCase()}_MISSING` : "COMMAND_FAILED", command));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8") });
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}

function containerName(id) {
  return `mb-mc-${assertId(id)}`;
}

/** Build an adapter for one server record. `deps` lets tests replace process launching. */
function adapterFor(server, deps = {}) {
  const spawnImpl = deps.spawn || spawn;
  const ssh = deps.sshRun || sshRun;
  const emit = deps.emit || (() => {});
  const processes = deps.processes || new Map();
  const target = TARGETS[server.target];
  if (!target) throw fail("UNKNOWN_TARGET", server.target);
  const files = target.shell ? sshFs(server.ssh, server.folder, ssh) : localFs(server.folder);

  const exec = (command, args) =>
    target.shell
      ? ssh(server.ssh, [command, ...args].map((a, i) => (i === 0 ? a : shQuote(a))).join(" "))
      : runLocal(command, args, { spawnImpl });

  const docker = (...args) => exec("docker", args);

  async function javaMajor() {
    if (target.docker) return null;
    const r = target.shell ? await ssh(server.ssh, "java -version 2>&1") : await runLocal(server.javaPath || "java", ["-version"], { spawnImpl });
    return parseJavaMajor((r.stdout.toString("utf8") || "") + (r.stderr || ""));
  }

  async function probe() {
    const facts = { target: server.target, label: target.label };
    try {
      if (target.docker) {
        const r = await docker("version", "--format", "{{.Server.Version}}");
        facts.docker = r.code === 0 ? r.stdout.toString("utf8").trim() : null;
        facts.ready = !!facts.docker;
        if (!facts.ready) facts.problem = "The Docker engine did not answer.";
      } else {
        facts.javaMajor = await javaMajor();
        facts.ready = facts.javaMajor !== null;
        if (!facts.ready) facts.problem = "No Java runtime was found.";
      }
    } catch (error) {
      facts.ready = false;
      facts.problem = error.code || error.message;
      if (error.code === "SSH_DISCONNECTED" || error.code === "SSH_HOST_NOT_APPROVED") facts.connection = error.code;
    }
    return facts;
  }

  async function status() {
    try {
      if (server.target === "local") {
        const owned = processes.get(server.id);
        return { state: owned && owned.exitCode === null ? "running" : "stopped", pid: owned?.pid ?? null };
      }
      if (target.docker) {
        const r = await docker("inspect", "-f", `{{.State.Status}} {{index .Config.Labels "${LABEL}"}}`, containerName(server.id));
        if (r.code !== 0) return { state: "stopped", container: null };
        const [state, label] = r.stdout.toString("utf8").trim().split(" ");
        if (label !== server.id) return { state: "not-owned" };
        return { state: state === "running" ? "running" : "stopped", container: containerName(server.id) };
      }
      const r = await ssh(server.ssh, `cd ${shQuote(server.folder)} && test -f run.pid && kill -0 "$(cat run.pid)" 2>/dev/null && cat run.pid`);
      return r.code === 0 ? { state: "running", pid: Number(r.stdout.toString("utf8").trim()) } : { state: "stopped" };
    } catch (error) {
      if (error.code === "SSH_DISCONNECTED" || error.code === "SSH_TIMEOUT") return { state: "disconnected", reason: error.code };
      throw error;
    }
  }

  async function start() {
    if (!server.eulaAccepted) throw fail("EULA_NOT_ACCEPTED");
    if ((await status()).state === "running") throw fail("ALREADY_RUNNING");
    const opts = javaOptions(server.memoryMb);
    if (server.target === "local") {
      if (!(await portFree(server.port))) throw fail("PORT_IN_USE", String(server.port));
      const major = await javaMajor();
      if (major === null) throw fail("JAVA_MISSING");
      if (server.javaMajor && major < server.javaMajor) throw fail("JAVA_TOO_OLD", `${major} < ${server.javaMajor}`);
      const child = spawnImpl(server.javaPath || "java", [...opts.split(" "), "-jar", "server.jar", "nogui"], { cwd: server.folder, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      child.exitCode = null;
      const log = [];
      child.log = log;
      const push = (chunk) => {
        for (const line of chunk.toString("utf8").split(/\r?\n/)) {
          if (!line) continue;
          log.push(line);
          if (log.length > LOG_LINES) log.shift();
          emit({ type: "minecraft.log", id: server.id, line });
        }
      };
      child.stdout.on("data", push);
      child.stderr.on("data", push);
      child.on("exit", (code) => {
        child.exitCode = code ?? 0;
        emit({ type: "minecraft.state", id: server.id, state: "stopped", exitCode: child.exitCode });
      });
      processes.set(server.id, child);
      emit({ type: "minecraft.state", id: server.id, state: "running" });
      return { state: "running", pid: child.pid };
    }
    await files.writeText("mb-run.sh", RUN_SCRIPT);
    if (target.docker) {
      const name = containerName(server.id);
      const existing = await docker("inspect", "-f", `{{index .Config.Labels "${LABEL}"}}`, name);
      if (existing.code === 0) {
        if (existing.stdout.toString("utf8").trim() !== server.id) throw fail("CONTAINER_NAME_TAKEN", name);
        const r = await docker("start", name);
        if (r.code !== 0) throw fail("DOCKER_START_FAILED", r.stderr);
      } else {
        const { image } = imageFor(server.javaMajor);
        const r = await docker(
          "run", "-d", "--name", name, "--label", `${LABEL}=${server.id}`,
          "-v", `${server.folder}:/data`, "-w", "/data",
          "-p", `${server.port}:${server.port}/tcp`,
          "-e", `MB_JAVA_OPTS=${opts}`, image, "sh", "/data/mb-run.sh",
        );
        if (r.code !== 0) throw fail("DOCKER_START_FAILED", r.stderr);
      }
      emit({ type: "minecraft.state", id: server.id, state: "running" });
      return { state: "running", container: name };
    }
    const r = await ssh(server.ssh, `cd ${shQuote(server.folder)} && MB_JAVA_OPTS=${shQuote(opts)} nohup sh mb-run.sh > console.log 2>&1 & echo $! > ${shQuote(server.folder)}/run.pid`);
    if (r.code !== 0) throw fail("REMOTE_START_FAILED", r.stderr);
    emit({ type: "minecraft.state", id: server.id, state: "running" });
    return { state: "running" };
  }

  async function command(line) {
    const text = assertConsoleLine(line);
    if ((await status()).state !== "running") throw fail("NOT_RUNNING");
    if (server.target === "local") {
      processes.get(server.id).stdin.write(`${text}\n`);
      return { sent: true };
    }
    const prior = (await files.readText("console.in")) || "";
    await files.writeText("console.in", `${prior}${text}\n`);
    return { sent: true };
  }

  async function waitStopped(timeoutMs) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const s = await status();
      if (s.state === "stopped") return true;
      if (s.state === "disconnected") throw fail("SSH_DISCONNECTED");
      await new Promise((r) => setTimeout(r, deps.pollMs ?? 1000));
    }
    return false;
  }

  /** Graceful stop: the server's own stop command, then wait. A timeout is reported, not forced. */
  async function stop({ timeoutMs = 90000 } = {}) {
    const s = await status();
    if (s.state !== "running") return { state: s.state };
    if (server.target === "local") {
      processes.get(server.id).stdin.write("stop\n");
    } else {
      await command("stop");
    }
    const stopped = await waitStopped(timeoutMs);
    if (!stopped) throw fail("STOP_TIMEOUT");
    if (target.docker) await docker("stop", "-t", "5", containerName(server.id));
    emit({ type: "minecraft.state", id: server.id, state: "stopped" });
    return { state: "stopped" };
  }

  async function logs() {
    if (server.target === "local") return processes.get(server.id)?.log?.slice() || [];
    if (target.docker) {
      const r = await docker("logs", "--tail", String(LOG_LINES), containerName(server.id));
      return (r.stdout.toString("utf8") + r.stderr).split(/\r?\n/).filter(Boolean).slice(-LOG_LINES);
    }
    const text = (await files.readText("console.log")) || "";
    return text.split(/\r?\n/).filter(Boolean).slice(-LOG_LINES);
  }

  /** Pull the runtime image ahead of time and record the digest actually used. */
  async function prepareRuntime() {
    if (!target.docker) return { javaMajor: await javaMajor() };
    const chosen = imageFor(server.javaMajor);
    const pull = await docker("pull", chosen.image);
    if (pull.code !== 0) throw fail("IMAGE_PULL_FAILED", pull.stderr);
    const r = await docker("image", "inspect", "-f", "{{index .RepoDigests 0}}", chosen.image);
    return { ...chosen, digest: r.stdout.toString("utf8").trim() || null };
  }

  return { files, probe, status, start, stop, command, logs, prepareRuntime, javaMajor };
}

/** Read-only discovery of containers this app labelled on a Docker host. */
async function discoverContainers({ ssh: sshHost, sshRun: runner = sshRun, spawnImpl = spawn } = {}) {
  const args = ["ps", "-a", "--filter", `label=${LABEL}`, "--format", `{{.Names}}\t{{.State}}\t{{.Label "${LABEL}"}}`];
  const r = sshHost ? await runner(sshHost, ["docker", ...args].map((a, i) => (i ? shQuote(a) : a)).join(" ")) : await runLocal("docker", args, { spawnImpl });
  return r.stdout.toString("utf8").split("\n").filter(Boolean).map((l) => {
    const [name, state, id] = l.split("\t");
    return { name, state, id };
  });
}

module.exports = { TARGETS, TEMURIN_JRE, LABEL, RUN_SCRIPT, javaOptions, imageFor, parseJavaMajor, portFree, containerName, adapterFor, discoverContainers };
