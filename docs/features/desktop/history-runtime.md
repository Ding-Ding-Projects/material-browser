# Portable runtime for protected settings history

## Official source and contents

The product dependency is the standard x64 MinGit package from the official
[Git for Windows release](https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2).
It is separate from any developer installation or private distribution.

`engines/runtime/history-git.lock.json` records the release, asset, official URL,
archive size and SHA-256, executable path and complete per-file inventory. Its 373
files total 96,142,395 bytes after extraction. The archive is 39,806,486 bytes and
has SHA-256 `da35e72aa21c005a5a0d298cfbae110bc1609a815730ea0dde84b01a1b3cd3be`.

The entrypoint is `cmd/git.exe`, SHA-256
`54bda91c773c6bba2b970424423cfcb80552d92dc6967d766f98931fe1251a54`.
The full payload is required, including the second native executable, supporting
DLLs and tools, configuration and license files. Copying only the small entrypoint
does not deliver a working or verified runtime.

The original root license is retained byte-for-byte in
`engines/runtime/licenses/history-git-LICENSE.txt`. Its SHA-256 is
`454649ddc02b5cc098513cea28db6592b45ac0a906386287c4d48cf8dbde651c`.
The package also contains individual third-party licenses; preserve all of them
when packaging the complete payload. The inventory describes their original paths
and hashes. This record does not replace the upstream license terms or notices.

## Acquisition and verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1
```

The script uses `gh release download` with the exact official repository, release
and asset. It verifies the pinned archive before extraction and checks every
payload file against the source-controlled inventory before executing the real
absolute entrypoint's version command. Cache reuse repeats verification. Missing
files, changed files, extra files/directories, links and hardlinks are rejected.
A corrupt archive or cache is retained for inspection rather than overlaid or
executed. Download and extraction use fresh staging directories.

The default cache is `.cache/history-git/`, already excluded by the repository's
cache rule. No PATH change, installer, elevation, global configuration or personal
credential operation is performed. GitHub CLI must already be available for a cold
build acquisition; its absence is a clear non-success result. A packaged user
installation must receive the complete payload and must not require that CLI or
a runtime download.

The script returns a JSON descriptor with `version`, absolute `payloadRoot`,
absolute `gitExecutable`, `gitSha256`, `payloadFileCount` and `licensePath`.
Consume it as trusted local build data; do not publish local machine paths.

Read-only verification for an explicitly selected trusted packaged directory is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1 -VerifyOnly -PayloadRoot ABSOLUTE_PAYLOAD_DIRECTORY
```

That route validates the complete inventory without acquiring or executing a
runtime. It is not a version-command or installation proof.

## Integration boundary

The owning build should call the acquisition script before Desktop compilation or
packaging, parse its descriptor and retain the complete verified payload. Forge's
`packagerConfig.extraResource` accepts paths, not builder-style `{from,to}` objects.
For example, adding the verified version directory and the lock JSON as resource
paths preserves the directory basename `v2.56.0.windows.2` in the packaged resources.
Alternatively, stage a verified copy with a deliberate stable basename and verify
that copy again before packaging.

Trusted main-process resolution must derive the directory from packaged resources
or the managed development cache, load its bundled trusted lock, and verify the
complete inventory and path/link boundaries before handing `gitExecutable` and
`gitSha256` to `createHistoryService`. Renderer requests, preferences, environment
PATH and user-selected executable paths must never choose this dependency. The
service's existing per-invocation executable hash check remains required; startup
inventory verification does not replace it. Filesystem checks and later execution
are separate operations, so this alone does not prove resistance to concurrent
same-user payload replacement.

This slice intentionally does not modify the root build, Forge configuration,
main process or preload. Their wiring, packaged-resource verification, built
Settings interactions and installed-package acceptance remain separate work.

## Verification

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-history-git.ps1`
performs a real cold official acquisition, full payload verification, the actual
pinned version command and cache reuse. It then checks changed executable bytes,
changed support configuration, an unexpected file, a missing license, a changed
archive and an identical-bytes hardlink. Each must stop before the runtime
execution boundary. PATH must remain unchanged. This proves the current supported
host's bootstrap and cache behavior, not an installed product or a fresh operating
system without GitHub CLI.

The verified descriptor can also be piped to
`node scripts/test-history-git-service.cjs`. This exercises the real history service
with the pinned portable executable: encrypted local records, restart, independent
unlock and diff. Its fresh temporary credential adapter uses an ephemeral test key;
it does not establish Windows Credential Manager or packaged Settings acceptance.
