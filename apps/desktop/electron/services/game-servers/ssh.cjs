const path = require("node:path");
const { fail } = require("./catalogue.cjs");
function validateSsh(value, id) {
  if (
    !value ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(value.host || "") ||
    !/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(value.username || "")
  )
    fail("INVALID_SSH", "A valid SSH hostname and username are required");
  if (
    !Number.isInteger(value.port ?? 22) ||
    (value.port ?? 22) < 1 ||
    (value.port ?? 22) > 65535
  )
    fail("INVALID_SSH", "Invalid SSH port");
  if (
    !/^\/[a-zA-Z0-9_./-]+$/.test(value.remoteRoot || "") ||
    value.remoteRoot.split("/").includes("..") ||
    value.remoteRoot === "/"
  )
    fail(
      "INVALID_SSH",
      "Select an absolute dedicated remote server storage directory",
    );
  if (
    !/^\/[a-zA-Z0-9_./-]+$/.test(value.javaPath || "") ||
    value.javaPath.split("/").includes("..") ||
    !value.javaPath.endsWith("/java")
  )
    fail("INVALID_SSH", "Select an absolute remote Java executable");
  if (value.identityFile && !path.isAbsolute(value.identityFile))
    fail("INVALID_SSH", "SSH identity file must be absolute");
  if (value.knownHostsFile && !path.isAbsolute(value.knownHostsFile))
    fail("INVALID_SSH", "Known-hosts file must be absolute");
  return {
    host: value.host,
    username: value.username,
    port: value.port ?? 22,
    remoteRoot: value.remoteRoot.replace(/\/$/, ""),
    javaPath: value.javaPath,
    identityFile: value.identityFile || null,
    knownHostsFile: value.knownHostsFile || null,
    directory: `${value.remoteRoot.replace(/\/$/, "")}/${id}`,
  };
}
function quote(value) {
  if (typeof value !== "string" || /[\0\r\n]/.test(value))
    fail("INVALID_SSH", "Invalid remote argument");
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
function options(ssh, scp = false) {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=2",
    scp ? "-P" : "-p",
    String(ssh.port),
  ];
  if (ssh.identityFile) args.push("-i", ssh.identityFile);
  if (ssh.knownHostsFile)
    args.push("-o", `UserKnownHostsFile=${ssh.knownHostsFile}`);
  return args;
}
function command(ssh, args) {
  return [
    ...options(ssh),
    `${ssh.username}@${ssh.host}`,
    args.map(quote).join(" "),
  ];
}
function execute(spawn, exe, args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        Object.assign(new Error("SSH operation timed out"), {
          code: "SSH_TIMEOUT",
        }),
      );
    }, timeout);
    child.stdout.on("data", (b) => {
      output = (output + b).slice(-16384);
    });
    child.stderr.on("data", (b) => {
      errors = (errors + b).slice(-4096);
    });
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output + errors);
      else
        reject(
          Object.assign(
            new Error(
              "SSH operation failed; verify host identity, authentication and remote runtime",
            ),
            {
              code: code === 255 ? "SSH_DISCONNECTED" : "SSH_OPERATION_FAILED",
            },
          ),
        );
    });
  });
}
async function provision(spawn, ssh, localDir, provisioned) {
  if (!provisioned) {
    const marker = `${ssh.directory}/.material-browser-owner`;
    const identity = ssh.directory.split("/").at(-1);
    const script = `if test -e ${quote(ssh.directory)}; then test ! -L ${quote(ssh.directory)} && test "$(cat -- ${quote(marker)})" = ${quote(identity)}; else mkdir -p -- ${quote(ssh.directory)} && printf %s ${quote(identity)} > ${quote(marker)}; fi`;
    await execute(spawn, "ssh", [
      ...options(ssh),
      `${ssh.username}@${ssh.host}`,
      script,
    ]);
  }
  // Only installation/configuration files are transferred; existing remote worlds are never overwritten.
  const files = provisioned
    ? ["server.properties"]
    : ["server.jar", "server.properties", "eula.txt"];
  for (const file of files) {
    await execute(spawn, "ssh", [
      ...options(ssh),
      `${ssh.username}@${ssh.host}`,
      `test ! -L ${quote(ssh.directory)} && test ! -L ${quote(ssh.directory + "/" + file)}`,
    ]);
    await execute(
      spawn,
      "scp",
      [
        ...options(ssh, true),
        path.join(localDir, file),
        `${ssh.username}@${ssh.host}:${ssh.directory}/${file}`,
      ],
      120000,
    );
  }
}
function launchArgs(ssh, javaArgs, imageDigest, port, memoryMb) {
  const commandArgs = imageDigest
    ? [
        "docker",
        "run",
        "--rm",
        "-i",
        "--name",
        `material-browser-server-${ssh.directory.split("/").at(-1)}`,
        "--label",
        `com.material-browser.server=${ssh.directory.split("/").at(-1)}`,
        "--network",
        "bridge",
        "-p",
        `127.0.0.1:${port}:${port}`,
        "--memory",
        `${memoryMb + 512}m`,
        "--mount",
        `type=bind,source=${ssh.directory},target=/server`,
        "-w",
        "/server",
        "--entrypoint",
        "java",
        imageDigest,
        ...javaArgs,
      ]
    : [ssh.javaPath, ...javaArgs];
  return [
    ...options(ssh),
    `${ssh.username}@${ssh.host}`,
    `cd ${quote(ssh.directory)} && exec ${commandArgs.map(quote).join(" ")}`,
  ];
}
module.exports = { validateSsh, command, execute, provision, launchArgs };
