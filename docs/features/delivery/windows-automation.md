# Windows build and release automation

The `Windows build and release` workflow runs for every branch push and manual dispatch.
Tag events are excluded to prevent release recursion. Each successful run publishes one
normal release with an immutable `build-<run-number>-<run-id>-<attempt>` tag targeting the
exact source commit. Development builds do not update the accepted latest-release channel.

## Build inventory

The single `windows-release` job uses the pinned `windows-2025` x64 hosted image.
Repository runner discovery returned no self-hosted runners; organization runner discovery
was unavailable to the configuring account. No unavailable local label is required.

The image supplies PowerShell, Git, GitHub CLI and the Visual Studio C++ build tools/Windows
SDK used by Rust's MSVC linker. Pinned setup actions install Node.js 26.4.0 and Rust 1.96.1.
The existing entrypoints install locked npm dependencies, acquire the hash-verified portable
history runtime and invoke Cargo. The workflow invokes `build-installer.bat -Component Desktop`
and `build-installer.bat -Component DocsCompanion`; those invoke the real `build.bat`.
Upstream managed Chromium/Firefox source builds and optional storage deployment are outside
this installer workflow. Managed engines remain separately acquired capabilities.

The desktop bundles using `build:bundle` in automation. Normal local `build` retains its
TypeScript check. No tests, lint or standalone type checks run in Actions. A release can
therefore ship from source whose local checks would fail. Packaging success is not runtime
or installation acceptance.

## Outputs and authentication

The desktop executable, application window, Squirrel setup and portable handbook use the
checked-in browser/globe icon in `apps/desktop/assets`. The editable SVG and reproducible
Windows drawing script `scripts/generate-icon.ps1` accompany PNG and multi-resolution ICO
outputs (16 through 256 pixels). Handbook executable resources are edited without signing.
Its packager has automatic publication explicitly disabled; only the release helper publishes.

Release assets include the unsigned Squirrel.Windows installer, `RELEASES`, full package,
any produced delta packages, the single-file offline handbook and a SHA-256/size inventory.
Unsigned executables can show unknown-publisher or SmartScreen warnings.
Publication reads the release back and checks its normal classification, exact source tag,
asset names and sizes. Notes record actual workflow start and publication-readback timing.
No signature or installed-update verification is claimed.

API authentication uses the first available Actions secret from `RELEASE_TOKEN`, `ORG_TOKEN`
and `GITHUB_TOKEN`. Secrets are never stored in the source tree or release assets. Checkout
does not persist authentication. There is no pull-request trigger executing untrusted code
with publication credentials.

Safe installer outputs and run metadata are retained for seven days even after earlier
failure. Collection/upload failure does not replace the build's original outcome. Source,
dependency directories, caches and credentials are excluded from upload paths.

## Operation and recovery

Use the Actions page's **Run workflow** control or `gh workflow run release.yml`.
Inspect the failing step before rerunning. A rerun gets a new attempt tag; it never overwrites
the previous tag or assets. Build, packaging or publication failure produces a failed run,
not a fabricated installer. Native UI, two-computer restoration and installation checks
remain separate local acceptance work.

The first hosted run is the cache-miss bootstrap proof for this job. Until it finishes,
fresh-image completeness and published delivery remain unverified. The dedicated portable
build interface and storage hosting wizard are not delivered by this workflow yet.
