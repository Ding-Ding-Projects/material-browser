# Material Browser handoff

## Super Profiles implementation in progress

Current steering: the user explicitly resumed implementation after the goal service pause
was reported unintended. The service still displays paused and exposes no resume API;
its record was retained without replacement. Work continues under that resume direction.

Latest preserved source: 50ddbbc1953ce1919422848ac9c0969fec086d1a on
ai/feature/20261021-super-profiles, with exact remote reference verified. Main contains
work through 1ce75f5 after the maintainer merged PR 4. Encrypted full setup drafts and the
completed wizard remain on the task branch pending integration. A focused desktop credential
diagnostic extraction is being tested after this immutable candidate.

Current checks: 53 native host tests, 25 native core tests and 101 desktop tests passed;
one native-only desktop check was skipped in the Linux run. The 13 focused wizard/model
checks passed, including malformed UTF-8 and lone-surrogate rejection. The exact root
Desktop installer and DocsCompanion installer entrypoints both completed with exit 0 at
stable source 50ddbbc. See docs/evidence/super-profiles/build-50ddbbc.json and
handbook-build-50ddbbc.json for sizes, hashes and source binding.

The real packaged wizard saved a complete encrypted draft, kept one identity on double
click and repeated saves, advanced immutable revisions, resumed step three after cancel
and after process restart with real vault unlock, retained prior bookmark input on invalid
UTF-8 or lone surrogates, supported replacement/removal and backend separation, and cleared
draft flags on completion. All eight owned process identities and desktops were absent
after teardown. Four inspected original images and two validated layout receipts remain
private pending complete promotion validation. This slice proves English/light/normal size,
not the full language/theme/scale matrix or lock during an unresolved save.

Native runtime evidence already retained: Chromium and Firefox each completed two headless
browser/workspace save and restoration cycles. Default uncached acquisition verified the
388975696-byte pinned base, completed setup and disposed only its owned guest. Managed
bookmark policies were recognized by both Linux engines; Firefox import removal preserved
editable bookmarks through an encrypted revision. The foreground browser repair passed
launch-owned readiness, browser closure recovery and non-waking status through guest-local
virtual X. These do not establish WSLg or full-desktop visual operation.

Full desktop provisioning reaches credential preparation but fails before RDP file creation.
A basic CurrentUser DPAPI test passed in both normal and hidden contexts, and normal-user
PATH discovery was refuted as the cause. The new helper records only bounded phase and
numeric results, without credentials or exception text. Native phase diagnosis is pending.
Cancellation descendant teardown remains unverified. All attempted guest resources were
removed by exact ownership, with unrelated distro inventory preserved. Sandbox is absent
on the selected host; no feature enablement or restart was initiated.

Remaining: phase-specific full-desktop repair and runtime roundtrip, actual terminal/WSLg
proof, Sandbox runtime, full interface matrix, evidence promotion and README refresh,
current handbook runtime/publication, installer acceptance and completed-work integration.
The matching local installation is currently absent according to live discovery; the older
installed-version statements below are historical. No accepted installed update is claimed.
Projects discovery lacks read:project and remains skipped. The separate wiki initialization
route remains unavailable; complete wiki source is retained in the documentation bundle.

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

Native runtime milestones now have sanitized receipts: observer-1ce75f5.json proves product
readiness, managed browser closure recovery and three status polls without waking a stopped
guest, through guest-local virtual X only. portable-policy-ac36bb9.json proves actual pinned
WSL browser policy recognition and Firefox import removal with editable bookmark restoration.
native-ui-save-f1816d6.json records real cancellation, stopped workspace-only save and teardown.
Concurrent sibling guests are explicitly reconciled; full raw inventory equality is not claimed.

Encrypted setup-progress backend is now implemented: setupDraft boolean and draftStep0..3
are validated in active and inactive settings. Draft launch returns SETUP_INCOMPLETE before
session resources. Native core25 passed, and the native no-journal/no-worker/no-guest draft
launch regression passed. Existing platform/identity-consent ordering is retained. The prior
native privacy-test lock lifetime is repaired with no skipped files. GUI input/resume wiring
and high-scale paint diagnosis are still active; the48-tuple matrix uses renderer-page frames
from the native-launched application, with native geometry/ownership receipts separately.

Wizard completion candidate now includes encrypted Save progress with acknowledged identity
and revision continuity, current-step resume, launch-disabled draft records, and portable
bookmark file input/counts/replace/remove. An independently confirmed lone-surrogate mismatch
was repaired; strict UTF-8 decoding and scalar validation preserve prior input on rejection.
Two new regressions were observed failing before repair, then13 focused checks passed;
full desktop101 passed,0 failed,1 Windows-only skip. TypeScript passed. Built callback,
resume, double-click and lock-lifetime workflows remain next. The earlier native matrix is
renderer-page evidence with actual native geometry; its incomplete-paint frames remain
unaccepted despite a successful separate settled native/renderer comparison.
