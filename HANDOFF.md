# Material Browser handoff

## WorldLens desktop adaptation, 2026-10-24

The desktop remake follows the independently reviewed design in `design/desktop/`, based on WorldLens commit `aaf1063e1ad7826591fa4dd6f504d086451e645b`. The target remains React, TypeScript, Material Web and Electron. Framework-neutral color/token sources and the upstream MIT license are pinned under `apps/desktop/src/design-system/`; `scripts/sync-worldlens-design-system.mjs` verifies their hashes.

Fresh defaults are dark and Roboto. Saved choices, custom accents and fonts survive; high contrast overrides accent changes. Shell, tables, inspectors, dialogs, onboarding and Settings use the shared design. Completion/failure sounds are synthesized locally, with persisted mute/volume, preview and quiet/accessibility suppression. Existing native operations, revision checks and consent flows are retained.

Local sound, theme, settings and workflow checks accompany the change. Linux GUI verification uses a task-owned Electron runtime and disposable data. Native preference writes explicitly require the existing Windows lock implementation and cannot be verified on Linux; the lock was not bypassed. Theme/language matrix preference injection must be labelled separately from actual native save/restart proof. Windows installer, guest lifecycle, physical input and audio output require their own evidence. Earlier screenshots below remain historical.

The final renderer source is `284fc88f94487a7716099469daadeec258d97b07`. Local desktop checks passed 126 with one Windows mutex skip; TypeScript, the production renderer build and documentation checks passed. Final Linux evidence contains 143 genuine captures, all 72 representative Appearance tuples, and 61/241 inventory states with exact remaining gaps. Ten independently inspected originals are retained in [the current evidence](docs/evidence/desktop/worldlens/README.md). Real synthetic profile/template operations, scrolling, narrow Back focus, settled dialogs and bundled-font availability were checked. Native preference writes and audible output remain unverified. The floating Accessibility entry can overlap content at some offsets; scrolling restored pointer access in the measured case. Windows packaging uses the existing hosted workflow and needs its own exact-source result.

## WSL password-manager sources and lock refresh, 2026-10-23

Latest direction: implement everything remaining and push to main. Both WSL routes now exist in source. An ordinary profile with `source: "wsl"` names an existing distribution; before launch the host verifies `/usr/bin/keepassxc-proxy` inside it and writes an app-owned `keepassxc-proxy-<distribution>.cmd` bridge that the Chromium and Firefox registrations point at (`crates/host/src/password_manager.rs`, `crates/host/src/main.rs`). A WSL Super Profile template can carry `passwordManager` with `wslDistribution: "guest"`; provisioning stages and installs guest registrations after verifying the guest proxy, merging the Firefox policy with managed bookmarks (`crates/host/src/super_profiles/password_manager_guest.rs`, `crates/core/src/super_profiles.rs`). `passwordManager.detect` lists distributions from `wsl -l -q`; the creation form offers a distribution picker and the Super Profile wizard offers guest pairing fields. The desktop `package-lock.json` was regenerated with `npm install --package-lock-only`; `npm ci` now succeeds.

Verified here: core 28 and host 59 Rust tests on Linux, desktop `tsc --noEmit`, desktop tests 112, docs tests 6, rustfmt on the touched files, publication scan on every changed file (the scanner's `cat` match in the pre-existing provisioning script predates this change and is a literal shell command). Not verified: any WSL runtime, the wrapper launch, guest provisioning with a KeePassXC package, the Windows registry write, built screenshots, installers, and the installed update.

## Password-manager pairing source implementation, 2026-10-22

Latest direction: continue the handoff from a Linux cloud session without subagents. The KeePassXC pairing requested below now has a source implementation; built verification on the Windows host remains pending.

Implemented on this pass: `passwordManager` profile field with strict core validation (`crates/core/src/password_manager.rs`), host-side detection of an installed KeePassXC from the maintained lineage and per-profile Chromium and Firefox registrations written only into application-owned paths (`crates/host/src/password_manager.rs`, staged from `profiles.launch`), a `passwordManager.detect` method, the optional password-manager section in the profile creation form, inspector facts with a redacted database name and a pairing removal action, a `.kdbx` file picker bridge, Cantonese strings, and the [feature article](docs/features/desktop/password-manager.md). Installed KeePassXC is preferred when present; the WSL guest source is recorded but launch reports `PASSWORD_MANAGER_WSL_UNAVAILABLE` until guest provisioning exists.

Verified here: `cargo test` for the core (26 passed) and host (57 passed) crates on Linux, desktop `tsc --noEmit`, desktop tests (112 passed), documentation checks (112 passed), rustfmt on the new modules and the publication-language scan on every changed file. Dependencies were installed without modifying the committed lock files; `npm ci` currently rejects the desktop lock file because `@types/react@19.3.0` is missing from it, which predates this pass and still needs a lock refresh on the maintainer's host.

Not verified: root `build.bat` and `build-installer.bat`, the built creation form, real extension connectivity, passkey behavior, the Windows registry registration for Firefox, and the installer. The separate gallery backlink is delivered: the source README links to the live gallery, and every live image hash matched the inventory.

## Desktop GUI preservation, 2026-10-22

Latest direction: stop new implementation and verification, preserve current work, and perform only proven task-owned cleanup. The full task remains unfinished.

### Pending new-profile password-manager integration

Original request, now implemented in source as recorded above: offer an optional KeePassXC database during new-profile creation, install and configure the KeePassXC browser extension for profiles that select it, and enable passkey support by default. Use the maintainer-owned [Ding-Ding-Projects/keepassxc](https://github.com/Ding-Ding-Projects/keepassxc) source lineage rather than substituting another distribution. This is a requested follow-up, not implemented or verified behavior. Preserve existing databases and credentials, provide explicit database selection or creation, and verify actual extension connectivity, default passkey behavior and persistence in the built application. Record engine-specific compatibility limits honestly.

### Separate gallery publication review

The separate evidence gallery has a historical publication-language incident. The maintainer explicitly chose to keep its history unchanged and retain the local recovery candidate. Its current files were reviewed; the earlier reachable commit remains unresolved. A local replacement candidate and verified private backup exist; no history rewrite was performed. The source README gallery backlink remains pending. Do not reproduce the historical content in public records.

### Completed task-owned cleanup

The full repository archive passed integrity and entry-list verification before deletion, covering all seven registered worktrees and Git administrative history. All eight ignored announcement-image variants were separately copied and hash-verified in private backup storage. The completed desktop-rewrite branch tip `29528b77e95f604445a3174674a868f632314e23` was proven an ancestor of remote main `4809cf21c4201c66f2091d89bfd03bd62b02a38b`. Its clean, inactive linked worktree and local/remote branch were removed. The five other linked worktrees, documentation branch, gallery checkout and gallery recovery candidate were retained. The primary dependency directory was preserved when its junction was removed from the retired worktree.

GUI source `baa9512ecbc2727929547059f3b5d95f7cde989f` is integrated on main with remote proof. Implementation commits are `6206ddf92965a707eb3d916d8b2ceb1a8de313b2` and `29528b77e95f604445a3174674a868f632314e23`. Local desktop checks: 109 passed, zero failed; TypeScript passed; documentation checks: six passed; offline-handbook policy checks: three passed. Exact root desktop installer production completed successfully. Normal release [build-44](https://github.com/Ding-Ding-Projects/material-browser/releases/tag/build-44-39834158436-1) and [workflow](https://github.com/Ding-Ding-Projects/material-browser/actions/runs/39834158436) are verified for the GUI source, with five uploaded assets. This later preservation documentation commit has its own workflow verdict, which must be checked separately.

The rebuilt package passed focused real profile actions, persisted choice/reset, compact section renderer-keyboard behavior and inspected layout. The representative matrix stopped at 138 completed cells; 200% and broader states remain unverified. All owned product processes and named hidden desktops were closed with absence proof. Synthetic credentials were memory-only and released. [Images, exact evidence, limitations](docs/evidence/desktop/gui-rewrite/README.md) and [coverage](docs/evidence/desktop/gui-rewrite/coverage.json) are retained.

The matching existing installation remains 0.1.0. No installed update was attempted because closeout stopped that lane. Full updater-feed acceptance, native physical input, guest lifecycle, sync conflicts, current hosted documentation and refreshed offline-handbook runtime remain unfinished. The wiki endpoint returned Repository not found; complete local wiki source remains bundled in documentation. Status delivery was unavailable because the live service rejected current client metadata; no delivery was claimed.

Resume with the remaining coverage and the supported matching installed update, then refresh and verify hosted documentation and the offline handbook. Preserve default user data, existing installations, unrelated worktrees and all original evidence. Do not relabel the earlier green workflow as proof for this preservation commit.

---

The following earlier handoff is retained as historical context; its prior task/goal state is not this closeout's current state.

## Super Profiles implementation in progress

Current steering: the user explicitly resumed implementation after the goal service pause
was reported unintended. The service still displays paused and exposes no resume API;
its record was retained without replacement. Work continues under that resume direction.

Latest preserved source:f1816d6b59b5a73bf315c40f13577b626219713e on
ai/feature/20261021-super-profiles, with exact remote reference verified. Current candidate
adds bounded owned guest observations, terminal/desktop readiness, managed desktop browser
launchers, typed client interfaces and explicit UI health/recovery presentation.

The host suite passes51 checks. Desktop passes97, with one Windows-only check skipped on
Linux; the targeted native platform checks passed14 earlier. Core19 passed at e92b352.
The exact root Desktop installer production passed at f1816d6 with stable source and exit0.
Its setup is809554944 bytes, SHA256 0a29f9b5b41aaad857ee2eaf57cb925132560bcbf5dcbeca724c3517030dc086.

Actual runtime proof: Chromium completed two owned headless cycles at0719755 with encrypted
browser/workspace save and restoration, normal guest user, browser sandboxing enabled,
owned teardown and unchanged unrelated distro inventory. Firefox completed two headless cycles at f1816d6, restoring browser local storage and workspace
changes after encrypted save. The root browser/lock link was present before successful export;
other links remain rejected. Default uncached acquisition downloaded and verified the pinned
388975696-byte base in6860ms, completed setup and disposed only its owned guest.
These results supersede the earlier retained Firefox export and default download failures.

Native GUI CRUD/consent/lock proof belongs to77cb8cf. The0719755 minimum760x580 bilingual-dark
reduced-motion navigation retest passed inspected pixels and bounds. Later successful native
desktop enumeration proved all task-owned desktops absent. Portable handbook0049c2d passed
native single-file launch, corrected0.1.1 footer and guide/internal navigation. Earlier
77cb8cf proof covered reading-progress persistence. Original receipts/images remain private;
final source-bound image promotion and README refresh are pending.

Current host changes observe cached launch-owned streams without executing guests from
status. Records are nonce/sequence/freshness bounded. Missing or stale readiness is explicit,
late observations cannot replace save/cleanup states, and visualVerified stays false.
Terminal requires an actual guest PTY; desktop requires same-display Xfce and window manager.
Native observation/readiness proof remains pending. Full desktop launchers use the selected
managed browser profile and workspace. Sandbox runtime is unavailable on the selected host.

Next: preserve/build current candidate, retry Firefox and default acquisition, exercise real
GUI cancellation/workspace save, verify observation and graphical guest workflows where safe,
complete layout/localization/accessibility matrix, evidence promotion, wiki/handbook publication,
installer/update proof and completed-work integration. Keep all unrun proof incomplete.
Projects discovery lacks read:project and remains skipped without changing scopes.

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

Portable bookmark API slice: strict bounded neutral JSON is encrypted in per-backend template
settings and immutable revisions. Guest-only managed policy generation preserves editable
profile files. Core23 and host52 checks passed; independent source review found no confirmed
defect. Wizard input and exact pinned-engine policy recognition remain pending. Source-only
review and successful policy-file generation do not prove browser recognition.

Managed WSL browser launch diagnosis at f1816d6 showed the detached command returning0,
then the readiness probe returning1 with no browser left. Identical foreground managed
Chromium survived10 seconds in the proven guest-local virtual display. Current repair
retains the foreground WSL child before cancellation/readiness and detects launcher loss.
Focused launch1 and health8 checks passed. Native repaired readiness remains next. The
workspace-wide formatting check reports existing unrelated formatting drift; no broad
formatting rewrite was applied. GUI cancellation/stopped workspace-only save completed on
immutable f1816d6, with its final receipt and teardown inventory pending inspection.
