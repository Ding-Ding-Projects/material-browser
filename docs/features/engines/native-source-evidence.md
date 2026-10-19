# Native source acquisition evidence

Chromium source is pinned to `0e66b94549a8bd85f03fbdf189b752d6e7b63c32`
(155.0.8059.85). Firefox source is pinned to
`3c71aeacdb296402e41fb2084b13e797d1770642` (158.0).

The first Chromium dependency synchronization stopped with CIPD exit 1. Windows returned:

> Operation did not complete successfully because the file contains a virus or potentially unwanted software.

The exact package was `chromium/third_party/updater/chrome_win_x86`, instance
`NuXBEfKu8082d55WUbs6_3P0puTPCI4A1Df4BnQ1Z40C`. This records the scanner's result,
not a determination of malware or a false-positive claim. No security setting or exclusion
was changed, and the blocked payload was not renamed, repackaged or retried separately.

The selected build target is unbranded `chrome` for x64. The pinned upstream
[`third_party/updater/BUILD.gn`](https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/third_party/updater/BUILD.gn)
lines 7-21 declares the consuming `old_updater` copy target `testonly = true`, with the
affected payload inside `is_chrome_branded`. The other reference in
[`chrome/updater/BUILD.gn`](https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/chrome/updater/BUILD.gn)
lines 1128-1134 belongs to updater test data under `target_cpu == "x86"`.
An attempted `.gclient` `custom_deps` override for exactly
`src/third_party/updater/chrome_win_x86/cipd` did not suppress the CIPD package in the pinned
depot-tools implementation. The changed-configuration retry ended with the same scanner
rejection. No further retry is authorized without first proving, offline, that a reviewed
source-level optional-fixture filter actually omits it. Updater integration tests needing this
fixture remain unavailable. No security protection was changed. Native Chromium dependency
synchronization and compilation remain incomplete.

Firefox acquisition completed at its exact revision. MozillaBuild 4.2.1 was verified with
a valid Mozilla publisher signature and installer SHA-256
`8ef5b3d2087e4867dc75bf19f5e62f12e917f518239415723cc70896b6f1e3d8`.
The installer used its supported default destination, which was independently read back.
The initial presence probe found no default shell; this is current-host evidence, not a
fresh-environment claim. Firefox bootstrap uses its supported `--no-system-changes` option;
the selected source's `Bootstrapper._add_microsoft_defender_antivirus_exclusions` returns
immediately under that option. No antivirus exclusions are authorized by this build route.

## Preservation state

The native Rust engine's eleven focused tests passed after the bounded graceful-close repair.
An earlier revision completed the root release build. The latest graceful-close revision still
requires the real hidden-browser retry; do not infer that result from the unit tests.

`chromium-155-profile-key.patch` adds a current provider, production startup registration and
GN source ownership. Patch application was checked against the pinned source. It is not applied
to the native build tree, compiled, or enabled. The authenticated host-side key channel, Firefox
key integration, stable identity across frames/workers and whole-profile live snapshot barrier
are unfinished. All advanced capabilities remain disabled.

Firefox's root-entrypoint operation was still bootstrapping its private Visual Studio toolchain
at the preservation boundary. It had not produced a native browser. Preserve its existing
operation and read the eventual exit result before deciding whether any retry is appropriate.
The managed stock browser bundles are baseline automation inputs only and remain immutable
while their independent runtime matrix is active.
