# Implementation handoff

## Current priority

The approved product is incomplete. The latest user correction prioritizes the missing
required features in Settings. The current desktop Settings surface implements appearance
and personal wording only. A comprehensive per-surface inventory, reviewed design and real
working settings are in progress on `feature/desktop-workspace`.

Existing personal browsers, credentials and unrelated services remain outside scope.

## Verified integrated components

- Core: 12 focused tests cover encrypted revisions, folder join, concurrent conflicts,
  transactional restore recovery and in-process profile-key derivation.
- Native integration `bf1d305`: exact Host build and 39 Rust workspace tests passed
  (14 host, 12 core, 13 engine), plus two adapter launch-option tests.
- Desktop integration `98d6eea`: exact Desktop build and seven focused tests passed.
  Three genuine captures and their evidence inventory are in `docs/evidence/desktop/`.
  They are bound to production source `7257d22`, not the later integrated native host.
- Documentation `193861b`: exact Docs build and a real local runtime check rendered all
  19 article routes. The evidence article delivered all three approved images with exact
  hashes and decoded dimensions. The favicon no longer caused a missing-resource request.
- Documentation accessibility `e979aa5`: all three repaired controls had English and
  Cantonese accessible names, with zero unnamed targets across 12 observations. Their
  state persisted after reload. Baseline search, guides and narrow layouts were exercised.
- Storage: six server tests passed at their recorded component candidate. The portable
  setup wizard was built and exercised on a hidden desktop for missing-runtime handling
  and appearance persistence. Positive container setup remains unverified.

These are bounded component results, not release or whole-product acceptance.

## Corrected browser-runtime verdict

Historical candidates `4434a65` and `bfd4fb5` reached local automation and stopped-profile
snapshot paths. Stronger native job verification subsequently confirmed that Firefox's
launcher can exit while the actual browser and its descendants survive. Earlier results
must not be described as proof of graceful browser shutdown: dropping the owned job could
terminate surviving descendants.

The active native-host branch now verifies complete owned-job membership, exact process
identity and window ownership before requesting normal close, and requires actual job
completion before releasing the profile lease. These changes still require their final
runtime matrix. Firefox BiDi active-client contention, browser-already-closed handling and
the paired WebSocket Host-authority repair are included in that work. Preserve all raw
candidate evidence and distinguish superseded results from the final verdict.

## Native engine work

`feature/browser-engines` preserves pinned source acquisition, an uncompiled Chromium key
provider and the Firefox snapshot coordinator/cookie-pause candidates. Whole-profile live
snapshots, protected key delivery and advanced identity remain disabled and unverified.
The Firefox baseline is compiling. Cookie patches are retained separately until that
producer settles, then require native compilation and focused runtime checks.

A Chromium optional test payload was blocked by host protection. Do not weaken protection
or repeat retrieval of that same blocked payload. A second physical Windows computer is
still required for restoration proof.

## Active delivery work and limits

The offline documentation portable companion is being built and verified separately on
`feature/storage-service`. Its packaging does not establish complete Settings coverage.
No public container, LAN deployment, hosted documentation, About homepage or normal release
has been verified. Bootstrap, build companion, updater and required per-surface acceptance
remain unfinished.

Raw documentation captures remain unpromoted because complete original build receipts were
unavailable. Temporary documentation profiles remain ignored after automatic approval review
rejected their scoped deletion. Do not retry through an alternate deletion route. All
recorded documentation browsers, listeners and hidden desktops were closed normally.

Five earlier wizard captures remain private because contemporaneous build receipts are
missing. Generated announcement images are private and never runtime evidence. No task-owned
branch, worktree or recovery reference has been deleted.

## Next steps

1. Complete and independently review the Settings inventory and design, then implement and
   verify the missing working controls and workflows.
2. Finish native process ownership/shutdown repairs and run the required local and paired matrix.
3. Complete native key, storage-barrier and identity integrations with decisive engine proof.
4. Verify the portable documentation companion and remaining packaging/bootstrap paths.
5. Prove restoration on a second physical Windows computer, then complete storage, hosting,
   public documentation, release and installation acceptance.

See `CLOSEOUT_PROMPT.md` for ownership and continuation constraints.
