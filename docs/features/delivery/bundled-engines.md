# Browser engines included in the installer

Desktop builds stage Chromium and Firefox inside `resources/engines`, outside ASAR. The
installer includes their full browser directories, DLLs, resources and locales, matching
drivers, portable Node.js and locked production automation dependencies. Launch requires no
browser or driver download and does not use the user's existing browser installation.

## Pinned distributions and acquisition

`engines/runtime/browser-binaries.lock.json` records official HTTPS archive URLs, byte counts,
SHA-256 values and complete extracted-file inventories. The current browser payloads are
Chromium development snapshot 158.0.8111.0 (revision 1721569) and Mozilla Firefox 158.0.
ChromeDriver matches the Chromium snapshot; geckodriver is 0.37.1 and portable Node is 26.4.0.
These binary-distribution pins are distinct from the unfinished product-patched native-source
recipes in `engines/recipes/native-pins.json`.

The initial Chromium archives were checked against published Google Storage object metadata
and independently downloaded bytes. Firefox and Node matched their published archive checksums;
geckodriver matched its published release digest. Subsequent builds require the checked-in
SHA-256 and byte count before extraction, then compare every extracted file against the lock.
Changed cached payloads fail without execution. Archive paths, linked files and normalized
duplicate names are rejected. New generated candidates preserve earlier staging directories.

The exact root `build.bat` installs the desktop's locked packaging dependencies, then invokes
`engines/prepare-runtime.mjs`. Its 7-Zip executable comes from the locked installer dependency.
Production adapter dependencies are installed through their own npm lock without install scripts.
The root `build-installer.bat` packages that staged directory with the real native host.

## Registration and relocation

The desktop passes `--engine-dir <resources/engines>` to its native stdio host. Vault and active
profile data remain in the user's existing application-data directory. Browser manifests use
relative paths; adapter Node/helper/driver paths resolve inside their owning engine bundle,
with canonical containment checks. Installation paths containing spaces are supported.
Standalone native CLI startup also discovers engines beside its own executable when present.

Standard-identity launch remains an explicit per-launch choice. Bundling does not implement
stable identity, portable browser credential encryption or consistent live snapshots. Those
three capability flags remain false. Browser version, executable/hash, adapter, driver and
owned-process lifetime checks continue to apply.

## Licensing and verification boundaries

The bundle retains vendor notices and source links in `resources/engines/NOTICES.md`, browser
internal licensing pages, driver notices, Node licensing and individual npm package notices.
Chromium is explicitly identified as a development snapshot. Packaging does not rename it a
stable release or a product-patched browser.

Local verified staging and the native Host build passed, along with nine focused JavaScript
checks and a relocation/containment test. The combined installer, actual launches/stops and
fresh screenshots remain pending the candidate-bound verification run. A file inventory alone
does not prove browser startup, automation or installer behavior.

## Follow-up verification, 2026-10-19

Source a588bfd passed the full local desktop installer entrypoint and hosted run 39198295866,
with normal release build-5-39198295866-1. Bundled Chromium Off launched and stopped through
real desktop controls. Firefox Off launched and stopped through the native protocol, but its
early launcher exit prevented complete live window ancestry proof. The next candidate adds
Mozilla's -wait-for-browser option in every Firefox mode. Updated Firefox lifetime, both
automation modes, current screenshots and native installer installation remain unverified.
