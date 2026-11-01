// File and command access for a server's host: this PC directly, or an SSH host through the
// system OpenSSH client. SSH runs in batch mode against known_hosts only, so an unapproved host
// key or a password prompt fails instead of being accepted silently. No password is stored.
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fail, shQuote, assertSshHost, assertRemotePath, atomicWrite } = require("./util.cjs");

const SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15"];

function sshArgs(host, command) {
  const { hostname, user, port } = assertSshHost(host);
  return [...SSH_OPTIONS, "-p", String(port), `${user}@${hostname}`, command];
}

/** Run one remote command. Exit 255 is OpenSSH's own failure: the host is unreachable or refused us. */
function sshRun(host, command, { input, inputFile, timeout = 60000, spawnImpl = spawn, maxOutput = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl("ssh", sshArgs(host, command), { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const out = [], err = [];
    let size = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(fail("SSH_TIMEOUT"));
    }, timeout);
    child.stdout.on("data", (d) => {
      size += d.length;
      if (size <= maxOutput) out.push(d);
    });
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(fail(e.code === "ENOENT" ? "SSH_CLIENT_MISSING" : "SSH_FAILED"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString("utf8").slice(0, 2000);
      if (code === 255) return reject(fail(/host key/i.test(stderr) ? "SSH_HOST_NOT_APPROVED" : "SSH_DISCONNECTED", stderr));
      resolve({ code, stdout: Buffer.concat(out), stderr });
    });
    if (inputFile) fs.createReadStream(inputFile).pipe(child.stdin);
    else child.stdin.end(input ?? "");
  });
}

function localFs(root) {
  const inside = (rel) => {
    const full = path.resolve(root, rel);
    if (full !== root && !full.startsWith(root + path.sep)) throw fail("PATH_OUTSIDE_SERVER");
    return full;
  };
  return {
    kind: "local",
    root,
    join: (...p) => path.join(...p),
    async readText(rel) {
      try {
        return fs.readFileSync(inside(rel), "utf8");
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async writeText(rel, text) {
      atomicWrite(inside(rel), text);
    },
    async putFile(localSource, rel) {
      const dest = inside(rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (path.resolve(localSource) !== dest) fs.copyFileSync(localSource, dest);
      return crypto.createHash("sha256").update(fs.readFileSync(dest)).digest("hex");
    },
    async exists(rel) {
      return fs.existsSync(inside(rel));
    },
    async mkdir(rel) {
      fs.mkdirSync(inside(rel), { recursive: true });
    },
    async list(rel) {
      try {
        return fs.readdirSync(inside(rel), { withFileTypes: true }).map((d) => ({ name: d.name, dir: d.isDirectory() }));
      } catch {
        return [];
      }
    },
    async remove(rel) {
      fs.rmSync(inside(rel), { recursive: true, force: true });
    },
    async copyTree(fromRel, toRel) {
      fs.cpSync(inside(fromRel), inside(toRel), { recursive: true, errorOnExist: true, force: false });
    },
    async treeDigest(rel) {
      return localTreeDigest(inside(rel));
    },
  };
}

function localTreeDigest(dir) {
  const files = [];
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name), rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, rel);
      else if (e.isFile()) files.push(`${crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex")}  ${rel}`);
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return { files: files.length, sha256: crypto.createHash("sha256").update(files.join("\n")).digest("hex") };
}

function sshFs(host, root, runner = sshRun) {
  root = assertRemotePath(root);
  const inside = (rel) => {
    const clean = path.posix.normalize(`${root}/${rel}`);
    if (clean !== root && !clean.startsWith(`${root}/`)) throw fail("PATH_OUTSIDE_SERVER");
    return assertRemotePath(clean);
  };
  const run = async (command, options) => {
    const result = await runner(host, command, options);
    if (result.code !== 0) throw fail("REMOTE_COMMAND_FAILED", result.stderr);
    return result.stdout;
  };
  return {
    kind: "ssh",
    root,
    host,
    join: (...p) => path.posix.join(...p),
    run,
    async readText(rel) {
      const p = inside(rel);
      const result = await runner(host, `test -f ${shQuote(p)} && cat -- ${shQuote(p)} || echo __MB_MISSING__`);
      const text = result.stdout.toString("utf8");
      return text === "__MB_MISSING__\n" ? null : text;
    },
    async writeText(rel, text) {
      const p = inside(rel), tmp = `${p}.mb-tmp`;
      await run(`mkdir -p ${shQuote(path.posix.dirname(p))} && cat > ${shQuote(tmp)} && mv -f ${shQuote(tmp)} ${shQuote(p)}`, { input: text });
    },
    /** Stream a verified local file to the host, then compare the remote SHA-256 before promoting it. */
    async putFile(localSource, rel) {
      const p = inside(rel), tmp = `${p}.mb-tmp`;
      const expected = crypto.createHash("sha256").update(fs.readFileSync(localSource)).digest("hex");
      await run(`mkdir -p ${shQuote(path.posix.dirname(p))} && cat > ${shQuote(tmp)}`, { inputFile: localSource, timeout: 600000 });
      const actual = (await run(`sha256sum -- ${shQuote(tmp)}`)).toString("utf8").split(/\s+/)[0];
      if (actual !== expected) {
        await run(`rm -f -- ${shQuote(tmp)}`);
        throw fail("TRANSFER_INTEGRITY_FAILED");
      }
      await run(`mv -f ${shQuote(tmp)} ${shQuote(p)}`);
      return actual;
    },
    async exists(rel) {
      const r = await runner(host, `test -e ${shQuote(inside(rel))}`);
      return r.code === 0;
    },
    async mkdir(rel) {
      await run(`mkdir -p ${shQuote(inside(rel))}`);
    },
    async list(rel) {
      const r = await runner(host, `cd ${shQuote(inside(rel))} 2>/dev/null && for f in * ; do [ -e "$f" ] || continue; if [ -d "$f" ]; then echo "d $f"; else echo "f $f"; fi; done`);
      return r.stdout.toString("utf8").split("\n").filter(Boolean).map((l) => ({ name: l.slice(2), dir: l[0] === "d" }));
    },
    async remove(rel) {
      const p = inside(rel);
      if (p === root) throw fail("PATH_OUTSIDE_SERVER");
      await run(`rm -rf -- ${shQuote(p)}`);
    },
    async copyTree(fromRel, toRel) {
      await run(`test ! -e ${shQuote(inside(toRel))} && cp -a -- ${shQuote(inside(fromRel))} ${shQuote(inside(toRel))}`);
    },
    async treeDigest(rel) {
      const p = inside(rel);
      const out = (await run(`cd ${shQuote(p)} && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum`)).toString("utf8");
      const lines = out.split("\n").filter(Boolean).map((l) => l.replace("  ./", "  "));
      return { files: lines.length, sha256: crypto.createHash("sha256").update(lines.join("\n")).digest("hex") };
    },
  };
}

module.exports = { SSH_OPTIONS, sshArgs, sshRun, localFs, sshFs, localTreeDigest };
