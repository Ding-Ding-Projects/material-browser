const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { fail } = require("./catalogue.cjs");
const remote = require("./ssh.cjs");
function createLifecycle({
  load,
  stopped,
  safeFolder,
  safeFile,
  spawn,
  save,
  running,
  state,
  atomic,
  targets,
}) {
  async function start(p) {
    const s = await load(p.id);
    await stopped(s.id);
    const dir = await safeFolder(s.id);
    if (!targets.includes(s.target))
      fail("TARGET_UNAVAILABLE", "Target adapter is unavailable");
    const docker = s.target === "local-docker";
    const ssh = s.target.startsWith("ssh-")
      ? remote.validateSsh(s.ssh, s.id)
      : null;
    if (
      !docker &&
      !ssh &&
      (!p.javaPath ||
        !path.isAbsolute(p.javaPath) ||
        !/java(?:\.exe)?$/i.test(path.basename(p.javaPath)))
    )
      fail("RUNTIME_REQUIRED", "Select an absolute Java executable path");
    if (s.runtime.javaMajor === null)
      fail(
        "RUNTIME_UNRESOLVED",
        "Official metadata does not declare a compatible Java version",
      );
    const jar = await fs.readFile(await safeFile(dir, "server.jar"));
    if (
      crypto.createHash("sha1").update(jar).digest("hex") !== s.integrity.sha1
    )
      fail("INTEGRITY_FAILED", "Installed distribution has changed");
    if (
      !(await fs.readFile(await safeFile(dir, "eula.txt"), "utf8"))
        .split(/\r?\n/)
        .includes("eula=true")
    )
      fail("EULA_REQUIRED", "Server EULA acceptance is absent");
    if (ssh) {
      await remote.provision(spawn, ssh, dir, s.remoteProvisioned);
      s.remoteProvisioned = true;
      await save(s);
    }
    const probe = ssh
      ? await remote.execute(
          spawn,
          "ssh",
          remote.command(
            ssh,
            s.target === "ssh-docker"
              ? [
                  "docker",
                  "run",
                  "--rm",
                  "--network",
                  "none",
                  "--entrypoint",
                  "java",
                  s.imageDigest,
                  "-version",
                ]
              : [ssh.javaPath, "-version"],
          ),
        )
      : await new Promise((resolve, reject) => {
          const c = spawn(
            docker ? "docker" : p.javaPath,
            docker
              ? [
                  "run",
                  "--rm",
                  "--network",
                  "none",
                  "--entrypoint",
                  "java",
                  s.imageDigest,
                  "-version",
                ]
              : ["-version"],
            { windowsHide: true, shell: false },
          );
          let output = "";
          const timer = setTimeout(() => {
            c.kill();
            reject(
              Object.assign(new Error("Java detection timed out"), {
                code: "RUNTIME_TIMEOUT",
              }),
            );
          }, 10000);
          c.stdout?.on("data", (b) => {
            output = (output + b).slice(-8192);
          });
          c.stderr?.on("data", (b) => {
            output = (output + b).slice(-8192);
          });
          c.once("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
          c.once("exit", (code) => {
            clearTimeout(timer);
            if (code !== 0) reject(new Error("Java detection failed"));
            else resolve(output);
          });
        });
    const match = /version "(?:1\.)?(\d+)/.exec(probe);
    if (!match || Number(match[1]) !== s.runtime.javaMajor)
      fail(
        "RUNTIME_MISMATCH",
        `Java ${s.runtime.javaMajor} is required by the official metadata`,
      );
    const javaArgs = [
      `-Xms${Math.min(512, s.memoryMb)}M`,
      `-Xmx${s.memoryMb}M`,
      "-jar",
      "server.jar",
      "nogui",
    ];
    const containerName = `material-browser-server-${s.id}`;
    const child = spawn(
      ssh ? "ssh" : docker ? "docker" : p.javaPath,
      ssh
        ? remote.launchArgs(ssh, javaArgs, s.imageDigest, s.port, s.memoryMb)
        : docker
          ? [
              "run",
              "--rm",
              "-i",
              "--name",
              containerName,
              "--label",
              `com.material-browser.server=${s.id}`,
              "--network",
              "bridge",
              "-p",
              `127.0.0.1:${s.port}:${s.port}`,
              "--memory",
              `${s.memoryMb + 512}m`,
              "--mount",
              `type=bind,source=${dir},target=/server`,
              "-w",
              "/server",
              "--entrypoint",
              "java",
              s.imageDigest,
              ...javaArgs,
            ]
          : javaArgs,
      {
        cwd: dir,
        windowsHide: true,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const owned = { child, status: "starting", logs: [], exited: null };
    running.set(s.id, owned);
    owned.exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        owned.logs.push(`Process exited (${code ?? signal})`);
        if (running.get(s.id) === owned) running.delete(s.id);
        owned.remoteDisconnected =
          (!!ssh || docker) && (code !== 0 || !!signal);
        resolve();
      });
      child.once("error", (e) => {
        owned.logs.push(`Process error: ${e.code || "unknown"}`);
        if (running.get(s.id) === owned) running.delete(s.id);
        resolve();
      });
    });
    const log = (data) => {
      for (const line of data.toString().split(/\r?\n/))
        if (line) {
          owned.logs.push(line.slice(0, 4096));
          if (owned.logs.length > 500) owned.logs.shift();
        }
    };
    child.stdout.on("data", log);
    child.stderr.on("data", log);
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    await atomic(
      path.join(dir, "process-state.json"),
      JSON.stringify({
        pid: child.pid,
        target: s.target,
        startedAt: new Date().toISOString(),
      }),
    );
    owned.cleanup = owned.exited.then(async () => {
      if (owned.remoteDisconnected) {
        try {
          await atomic(
            path.join(dir, "process-state.json"),
            JSON.stringify({
              pid: child.pid,
              target: s.target,
              status: "disconnected",
              startedAt: new Date().toISOString(),
            }),
          );
        } catch {}
        return;
      }
      try {
        await fs.rm(path.join(dir, "process-state.json"), { force: true });
      } catch {}
    });
    return state(s);
  }
  async function stop(p) {
    const s = await load(p.id);
    const owned = running.get(s.id);
    if (!owned) {
      if (s.ownershipUnresolved)
        fail(
          "OWNERSHIP_UNRESOLVED",
          "Previous owned process state must be reconciled",
        );
      return state(s);
    }
    owned.status = "stopping";
    owned.child.stdin.write("stop\n");
    let timer;
    const done = await Promise.race([
      owned.exited.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), 15000);
      }),
    ]);
    clearTimeout(timer);
    if (!done)
      fail(
        "STOP_PENDING",
        "Graceful stop is still pending; the owned process was not forcibly terminated",
      );
    await owned.cleanup;
    if (owned.remoteDisconnected)
      fail(
        "SSH_DISCONNECTED",
        "Connection ended before a successful owned server exit was verified",
      );
    return state(s);
  }
  return { start, stop };
}
module.exports = { createLifecycle };
