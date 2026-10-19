# Continuation handoff

Objective: finish Windows build/release automation, the application/installer icon, explicit
profile-launch capability handling, browser engines bundled inside the installer, and genuine
updated README screenshots. The user's latest steering requires both engines bundled and
screenshots linked beside source.

Verified history: workflow run 39195138374 is green and published normal release
build-3-39195138374-1 from ed7ad0a68c49af05d9d6f456c58cdfb4050cb7d2. The icon was inspected
in the local packaged application, local setup and a published setup download; that download
matched its SHA-256 and byte count. Tests/lint remain local, not in Actions.

Launch repair f697b38855a18d1307d5308edc0bb714d8355f86 is on main: explicit per-launch
standard-identity consent, captured profile target, invalidation, duplicate-submit protection
and approved localized error explanations. Native strict defaults remain unchanged. Source
review was dry and seven focused security/message checks passed. Its CI run is 39195958871.

Current candidate adds archive/file-pinned Chromium snapshot 158.0.8111.0 and Firefox 158.0,
matching drivers, Node 26.4.0 and locked adapter dependencies to resources/engines. Build scripts
stage them automatically; the desktop and native host use a separate trusted engine root and
contained relative adapter paths. Full browser directories and vendor notices are retained.
Advanced identity, portable credentials and live snapshots remain unsupported.

The exact Desktop staging/build passed before final source/notice updates. Native Host build
and nine JavaScript checks passed; the fully qualified containment test ran one and passed.
Next: rebuild the exact preserved candidate through build-installer.bat, verify both engines
in Off/Selenium/Puppeteer from packaged resources, exercise real launch consent using UI-owned
synthetic setup, inspect genuine screenshots, promote safe evidence into README, and verify a
new normal hosted release with complete assets and exact source tag.

The first isolated UI fixture used direct backend seeding and remained stale; its screenshots
are not promoted. Its task window was closed; lifecycle cleanup reported UNKNOWN_PROCESS_TREE
after root exit, so retain the private receipt and treat desktop teardown proof as incomplete.
Existing recovery branches/worktrees and prior user data remain outside this task's ownership.
No task-owned linked worktree, branch or stash was created.

A separate private instruction update is preserved in the maintainer's instruction repository.
No private wording, paths or payloads belong in this public source or its release records.

## Current follow-up candidate

The bundled source a588bfd passed local packaging and hosted run 39198295866. Chromium Off
launched/stopped through real UI controls; Firefox Off through the protocol. The next candidate
repairs Firefox launcher lifetime, dialog footer/focus and individual published digest checks.
Five focused JS checks and four publisher fixture scenarios passed. Rebuild, verify six
engine/mode combinations and dialog keyboard/focus behavior, inspect genuine screenshots and
update README. Installer installation and complete runtime acceptance remain unverified.
The prior hidden run's six owned process identities were proven absent and its desktop closed.

Current source repairs all four automation startup failures traced to Node rejecting extended
Windows helper paths. Internal canonical containment/hash/ownership checks remain intact;
external paths require a same-identity round trip. Two focused tests passed after a deliberate
red assertion. Rebuild the final combined package and verify the four automation modes, then
promote current genuine screenshots and record the hosted release. UNC-share execution remains
unverified; pure UNC construction is tested. Do not claim complete runtime acceptance yet.

Latest state: source9011b28 passed all six bundled engine/mode launch-stop cases. English,
Cantonese and bilingual consent Cancel restored focus; minimum logical viewport action bounds
passed. Package version metadata now advances beyond the installed0.1.0 build, with per-run
hosted stamping and an actual-manifest desktop label. Version fixture passed. Preserve this
candidate, rebuild, refresh current genuine README evidence, and verify its normal release.
The existing installation is running; do not close active work or apply a disruptive update.
Keep installation and release proof separate.
