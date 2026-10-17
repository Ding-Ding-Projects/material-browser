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
The supported `.gclient` `custom_deps` override therefore omits exactly
`src/third_party/updater/chrome_win_x86/cipd`. It does not omit the browser target's required
code or replace any test with a passing claim. Updater integration tests needing this fixture
remain unavailable. A successful source sync alone is not a native compilation verdict.

Firefox acquisition completed at its exact revision. MozillaBuild 4.2.1 was verified with
a valid Mozilla publisher signature and installer SHA-256
`8ef5b3d2087e4867dc75bf19f5e62f12e917f518239415723cc70896b6f1e3d8`.
The installer used its supported default destination, which was independently read back.
The initial presence probe found no default shell; this is current-host evidence, not a
fresh-environment claim. Firefox bootstrap uses its supported `--no-system-changes` option;
the selected source's `Bootstrapper._add_microsoft_defender_antivirus_exclusions` returns
immediately under that option. No antivirus exclusions are authorized by this build route.
