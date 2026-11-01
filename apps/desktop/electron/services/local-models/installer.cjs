const fs = require("node:fs/promises");
const path = require("node:path");
const { fail } = require("./transport.cjs");
const PINNED = Object.freeze({
  version: "0.40.13",
  platform: "win32",
  architecture: "x64",
  file: "ollama-windows-amd64.zip",
  url: "https://github.com/ollama/ollama/releases/download/v0.40.13/ollama-windows-amd64.zip",
  bytes: 1601969847,
  sha256: "7afa38624fa62ee5d8293422d0ab084c1bb4603134c7f4dafce11a033b57cc19",
  source: "https://github.com/ollama/ollama/releases/tag/v0.40.13",
  retrievedOn: "2026-11-01",
  verifiedTimestamp: null,
});
async function probeInstalled() {
  const candidates =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? [
          path.join(
            process.env.LOCALAPPDATA,
            "Programs",
            "Ollama",
            "ollama.exe",
          ),
        ]
      : [];
  for (const candidate of candidates) {
    try {
      const s = await fs.lstat(candidate);
      if (s.isFile() && !s.isSymbolicLink() && s.nlink === 1)
        return {
          found: true,
          path: candidate,
          version: null,
          executionVerified: false,
          reason:
            "Executable found; this service has not admitted or started the existing installation",
        };
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return { found: false, version: null, executionVerified: false };
}
function installerPlan() {
  return {
    ...PINNED,
    hostPlatform: process.platform,
    hostArchitecture: process.arch,
    available: false,
    reasons:
      process.platform !== "win32" || process.arch !== "x64"
        ? ["This pinned payload targets Windows x64 only"]
        : [
            "Complete archive member inventory and native publisher/file-identity admission are not yet integrated",
            "Install preserves existing state and never starts the runtime implicitly",
          ],
    requiredBytes: PINNED.bytes * 3,
  };
}
async function install() {
  fail(
    "INSTALLER_ADMISSION_INCOMPLETE",
    "The official payload is pinned, but complete member and native publisher/file-identity admission must be integrated before installation",
  );
}
module.exports = { probeInstalled, installerPlan, install, PINNED };
