# Material Browser continuation

## Objective and latest direction

Continue the approved Windows x64 browser-profile manager with shared Rust core, managed
Chromium/Firefox engines, encrypted profile transfer, persistent opt-in automation, API/CLI,
optional encrypted remote storage and verified delivery. The product remains incomplete.
The latest correction prioritizes missing required features in Settings. Its inventory has
109 rows, 65 desktop-applicable, none claimed complete. Implement real workflows and proof.

## Durable source and ownership

Public repository: https://github.com/Ding-Ding-Projects/material-browser . Default branch: main.
This prompt records state up to its own commit; `HANDOFF.md` carries the detailed evidence.
Main was verified on the remote through `02bf0b247038bf3831a26c27bd16c78d32a7e4d1` before
this prompt update. Never infer later remote state from this statement.

Retain these active task-owned branches and their worktrees:

- `feature/desktop-workspace`: native preference persistence and async-save corrections are
  independently source-approved through `b8bd4fb`. Coupled history GUI candidate `d5ecc5c`
  needs independent review and real runtime proof; it is not integrated into main.
- `feature/encrypted-core`: strict history context candidate `53a6598` is integrated as
  `02bf0b2`. Earlier filesystem/execution hardening and auth-generation changes are integrated.
- `feature/native-host`: lifecycle proof and the pinned portable Git helper are integrated.
- `feature/browser-engines`: Firefox queue/lease native proof at `58864e1`, standalone Chromium
  protected-channel proof at `90c2af7`, active pinned Chromium compile at `499a20f`.
- `feature/storage-service`: offline handbook proof at `1cd196b`, promoted evidence `28fdbfe`
  integrated into main. Storage positive deployment remains unfinished.
- `gh-pages`: generated, load-bearing publication branch. Do not merge its generated root into
  source main or remove it as redundant task state.

Do not delete unfinished branches, worktrees, ignored evidence, private announcements or
retained documentation profiles. The latter deletion was rejected by automatic approval review.

## Verified progress and current failures

Main includes categorized Settings with 37 local validated controls. Its exact Desktop build,
33 source tests and three IPC tests passed at the recorded integration. Eleven reviewed
renderer repairs and genuine navigation/Undo/Redo proof are recorded. Native preference and
coupled protected-history candidates still need their own integration/runtime verdicts.

Protected history passed 21 integrated safety/concurrency/storage checks at `590592a` and
four independent-authentication checks at `5179045`. The strict restore run at `02bf0b2`
passed four cases but failed one existing display-name case with `HISTORY_LOCK_TIMEOUT`
instead of `HISTORY_LOCKED`, duration 572640.6127 ms. Host CPU was observed at 100% with
32 native compiler children. Do not claim that load is the proven cause, weaken the timeout,
or rerun unchanged checks until the relevant condition changes.

Main `ebba6fd` passed the exact Desktop entrypoint with pinned, full-inventory portable Git
acquisition. Fresh Rust toolchain bootstrap and packaged GUI admission remain unfinished.

Native lifecycle `7031adb` passed six actual hidden-desktop runs; integrated main passed
45 Rust workspace tests and two adapter checks. Old launcher-only stop evidence is superseded.
Firefox native queue test passed one fixture, not all-store durability or live snapshot proof.
Chromium channel fixture passed, not a production broker, first-creation portable credential
provider or cross-computer proof. Platform encryption still initializes before the proposed
replacement-provider handoff. Keep portability/live capabilities disabled.

The real Chromium build at `499a20f` is active after successful verified SDK 28000.2957 setup
and GN generation. Keep its inputs fixed. Observation bound: 2026-10-18 09:35:17 UTC.
Record the actual terminal result or timeout separately from successful acquisition/fixtures.
Never retrieve the host-blocked optional x86 updater payload again or weaken protection.

Public handbook source `b9b892b`, publication `fa7557312906abcd956b3478e19112b6158dda35`,
is live at https://ding-ding-projects.github.io/material-browser/ . Its 21 routes, eight
file hashes, bounded interactions and exact About homepage were verified. Newer source is
not yet deployed. Offline handbook proof at `1cd196b` covers actual single-file launch/restart;
executable SHA-256 `dcdd08b18afb848cb6d6f8020abf43a86ea8d50026f00ee51b891243295e2f49`.
Four approved captures are in `docs/evidence/handbook/`; excluded restart pixels remain private.
Main `62ba5de` built 24 articles. Separate hosted-wiki Git endpoint remains unavailable.

## Remaining work and safe continuation

Integrate the approved Settings tranche; review and drive the coupled history interface,
main-owned semantic/native CAS, idempotent recovery, independent authentication and lock order.
Verify packaged fixed-runtime inventory admission. Complete missing Settings workflows and
personal-wording outcome sounds. Personal wording stays local and outside exports/history.

Complete protected early-startup key delivery, actual all-store snapshot barriers, stable
identity and a real second-computer restoration. Complete positive storage hosting, published
image, both host modes, portable wizard, current documentation publication, Squirrel installer,
normal release, installed update and remaining per-surface acceptance. Existing tests, source
approval or successful publication never substitute for those runtime outcomes.

Keep personal browsers, credentials and unrelated host state untouched. No Internet exposure,
security weakening, host power/login actions, force pushes or unfinished-state deletion.
Use exact root build/installer entrypoints. Run tests locally; CI builds/publishes without tests
or lint. Preserve coherent milestones promptly, verify remote refs and retain honest failures.
Integrate completed task work into main; unfinished recovery remains inactive on its owning
branch. Cleanup requires complete preservation and remote ancestry proof first.
