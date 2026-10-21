# Material Browser handoff

## Super Profiles implementation in progress

Preserved milestones: 07c8702c164379f494c773b6dd0395f541cc76e6 and
e92b352069a1b2884e15feaa01fe027b705a91bd on ai/feature/20261021-super-profiles,
with exact remote references verified. Subsequent source adds asynchronous provisioning,
durable progress/cancellation, separate backend archive history, selected Linux installers,
explicit save-and-close, guest save/discard controls and decrypted staging disposal.
The core and scoped archives remain encrypted; browser profiles remain separate.

Checks against e92b352: 19 core tests and 36 Linux host tests passed.
The earlier preservation milestone passed 28 Windows host tests, 89 desktop tests,
17 real native stdio protocol checks and exact root Windows builds for Core, Host,
Desktop and Docs. The e92b352 root Desktop installer build also completed successfully.
The latest host suite reports41 passed, including asynchronous save, lock and capability checks.
The exact root Host build passed after the final backend-key correction.
The latest desktop suite reports 95 passed, zero failed and one Windows-only test skipped
on Linux. The native protocol check did not launch guests. New native builds
and current-source UI proof remain pending. Windows Sandbox is absent on the selected
host. Projects discovery lacks read:project and was skipped without changing scopes.

Outstanding acceptance: actual WSL terminal/browser/full-desktop and Sandbox launch,
setup, installer execution, save-back and disposal; full desktop authentication;
current-source UI evidence; packaging/deployment and installed update. Save-back and
guest-request reconciliation have further lifecycle changes awaiting native verification.
Launch provisioning runs in a worker. Continuous external guest-process health is unfinished.
Do not treat source, compilation or protocol checks as complete guest runtime proof.

Two actual WSL cycles against e92b352 verified synthetic workspace save, encrypted revision
restoration, owned-distro removal and plaintext staging disposal, while unrelated distributions
were unchanged. See docs/evidence/super-profiles/wsl-roundtrip-e92b352.json. These used a verified
base cache and cancellation before graphical launch. Default acquisition timed out separately;
its downloader repair is not yet runtime-verified. Packaged native UI interaction against
e92b352 covered template CRUD, restore, backend/engine retention and canceled identity consent,
with zero guest sessions. Later async-save and lock changes need fresh built UI proof.

Task progress: https://github.com/Ding-Ding-Projects/material-browser/discussions/3

## Current delivery

The productive repair has a successful hosted run39207217449 and normal release build-17-39207217449-1. The live handbook now serves source29c4c83 through publication4dccbf2, with37 articles and all19 declared file hashes verified. Its home, shortcut/current-evidence articles, all three images, search, dark-preference reload and390px layout checks passed. Eight saved browser identities were proven absent and its exact desktop closed. The later documentation build39208676657 remains a separate pending release result. See docs/evidence/handbook/verification-29c4c83.json.

## Combined source verification

Source04e003fb37fcdc5fecb8ef45806aaae74a69b603 completed build-installer.bat -Component Desktop with exit0. The 809,221,120-byte setup SHA-256 is d19dff36008ee8de9ab7ff57ed3070079873fbdbb26638ca5247b114f48c7686. All87 local desktop tests passed. The real packaged interface saved preferences and protected history, rejected a stale revision and retained dark theme, compact density and a synthetic display name through process restart. History reopened locked and retained its record after unlocking. Both GUI runs proved six complete process identities absent and closed their exact hidden desktops. Three original1920x1500 images passed promotion validation; a deliberate missing-README-link check rejected the omission, then passed after restoration.

The same combined native host passed six engine/mode launch-stop cases, four automation title roundtrips and vault lock/unlock, then exited0. Its separate verification wrapper and desktop are retained because an older unrelated process claims a reused parentPID and complete ancestry verification rejected cleanup. No termination or desktop-close action was attempted. Do not confuse this limit with the separately complete GUI teardown.

All five integrated component worktrees and branches remain retained pending backup access and archive verification. Existing installed0.1.0 remains active; supported update and actual shortcuts await a safe lifecycle boundary. The latest hosted release and refreshed handbook deployment remain separate pending results.


All five component branches were integrated into main, with remote ancestry verified at
6566d71f4279cb27b653739e7fc0a1016af73c7f. This includes revision-checked settings persistence,
protected history, selected history export, engine/native-host integration and inactive
native-engine source candidates. Native-engine candidates remain uncompiled and their
advanced capability flags remain false. Earlier runtime evidence below covers its stated
source only, not the entire newly combined application.

The follow-up shortcut repair handles Squirrel maintenance before productive startup and
sets the matching shell identity. Fourteen focused startup/security tests passed after an
intentional failing regression. An independent source review found no critical concern.
Built installation, shortcut readback and launch remain unverified.

All five source tips are preserved remotely. Cleanup has not started: backup access and
archive verification remain pending. Keep the existing documentation publication branch.
Continue product work on main. Never delete an unverified backup source or active worktree.

Source 5922074548f3a79f56b69c25b67826c0be3e209e completed the exact local build-installer.bat -Component Desktop entrypoint with exit 0. The local package is version 0.1.1. Hosted builds stamp desktop and handbook manifests to 0.1.<workflow run number>, giving the existing 0.1.0 installation a normal newer-version upgrade path. The desktop label reads the actual package version.

The application and Squirrel setup use the same custom multi-size icon. Chromium, Firefox, matching drivers, Node and locked adapters are bundled outside the application archive. The native host retains canonical containment/hash/ownership checks and uses only same-identity ordinary paths at external-runtime boundaries. Firefox retains its launcher through -wait-for-browser.

## Verified behavior

- Six packaged native engine/mode launches and normal stops passed, with exact version receipts.
- Both Selenium and both Puppeteer clients completed real title roundtrips against synthetic data documents.
- Off rejected automation endpoints; vault lock/unlock worked after all stops; native host exit was 0.
- Explicit standard-identity consent, duplicate-submit protection and localized known-error mapping are integrated.
- Cancel returned opening focus in English, Cantonese and bilingual modes. Long-language dialog actions remained within the 760 by 580 logical viewport.
- Three current desktop images passed receipt validation and a missing-README-link negative check, with exact PNG bytes retained. Earlier presentation and provenance are archived.
- All completed final GUI/native-client fixtures proved owned processes absent and closed their exact hidden desktops. No PID-only termination was used.
- The publisher's four focused fixture scenarios passed, and hosted run 39200313184 verified per-asset digest readback in a real normal release. Hosted checks contain no tests or lint.

## Remaining work and honest limits

The existing 0.1.0 installation is active. Preserve its work, settings and authentication. Do not force-close it or apply a disruptive update; wait for a safe normal lifecycle boundary and verify the installed newer version afterward.

Final documentation publication, the current hosted release and installed-update proof are separate states. Public handbook sources include the complete categorized documentation and local wiki content. The wiki feature is enabled, but its separate Git transport returns Repository not found; git/gh cannot initialize that first wiki page here. Source wiki content and the issue/Discussion handoff remain available.

Advanced stable identity, portable browser credentials, consistent live snapshots, two-computer restoration, storage deployment, full physical display scales, keyboard-only use, full localization, all settings contracts, the dedicated portable build interface and current-source offline-handbook runtime acceptance remain incomplete or unverified. Keep the broader roadmap intact.

Unrelated internal-maintenance references accidentally entered a086a87 and were removed from current files in 5922074. The affected workflow was cancelled before publication. Historical source still retains that earlier reference; no history rewriting was performed. Issue1 and Discussion2 record the correction.

See docs/evidence/desktop/receipts-0.1.1.json, bundled-runtime-0.1.1.json and the archived presentation for exact public evidence.

Native verification teardown update: after the older unrelated process was independently observed absent, fresh complete ancestry proof passed. The owning wrapper exited normally, both recorded wrapper identities were proven absent and the exact named desktop closed at2026-10-19T06:21:04.275644+00:00. No PID kill or unrelated termination occurred. This supersedes the earlier retained-wrapper state while preserving the initial rejection receipt. The prior separately rejected handbook profile cleanup remains untouched.
