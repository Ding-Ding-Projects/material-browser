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

The final native candidate `7031adb`, documented at `7856399`, is integrated in `7df4e81`.
It verifies complete owned-job membership, exact process identity and window ownership
before normal close, and requires actual job completion before releasing the profile lease.
Six hidden-desktop runs passed: Chromium and Firefox locally and over paired LAN, Firefox
with an attached BiDi client, and Firefox already closed by its external client. Contention
kept stop incomplete and leases held until disconnect/retry succeeded. Every owned hidden
desktop was confirmed absent. LAN fixtures explicitly terminated their fixture server;
their server exit code is not evidence of graceful server shutdown.

The exact integrated Host build passed with 45 Rust workspace tests and two adapter tests.
See `docs/features/engines/native-automation-verification.md` for source-bound limits.

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

The offline documentation companion and hardened Node cache bootstrap are integrated in
`2196857`. Its exact DocsCompanion build staged 20 articles and eight files. Three security
tests and six bootstrap checks passed. The actual single-file runtime proof belongs to
`3a59755`, not the later cache repair or integration; no newer executable is claimed verified.
Native installed-font discovery and bounded external-editor services are integrated in
`1d5a210`; five focused tests passed, including real installed-font enumeration.

The Settings branch now has ten categories and 37 validated local controls, control help,
independent picker searches, schedules, notifications, local history and exports. Three
genuine progress captures and a process-restart persistence check exist for `fea7da5`.
This is not comprehensive acceptance. Nine independently reviewed state/accessibility
corrections are being repaired before integration. The 109-row inventory includes 65
desktop-applicable rows, none claimed complete. Protected history services remain separate
until managed-path and local Git execution-configuration hardening pass negative tests.
The public handbook is now deployed from source `b9b892b`, publication `fa75573`, at
https://ding-ding-projects.github.io/material-browser/ . All 21 article/wiki routes rendered;
all eight published file hashes matched, including three approved images. Guides, search,
preference persistence, keyboard focus and inspected 390/320 px layouts passed bounded real
browser checks. Deployment run 39108839843 succeeded. The exact About homepage was read back.
The separate current-source offline handbook passed one-file launch and restart checks at
`1cd196b`; its unsigned executable hash is
`dcdd08b18afb848cb6d6f8020abf43a86ea8d50026f00ee51b891243295e2f49`.
Its new captures remain unpromoted pending complete receipt validation.

Protected history corrections and readable modules are preserved through `ddec069`; a later
forced-overlap correction is at `b15a247`, pending independent review. The first nine renderer
repairs passed source review at `60ef5da`. Real runtime then found a docked-tab event binding
defect, repaired at `b90318b`; the same real transitions are being repeated before integration.

No public container, positive storage LAN deployment or normal release has been verified.
Bootstrap, build companion, updater and required per-surface acceptance remain unfinished.
The repository wiki is enabled, but its Git endpoint reports repository not found. Local wiki
articles are included in the deployed handbook; separate hosted-wiki synchronization remains
unavailable through that endpoint.

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
2. Repair and independently re-review the nine Settings findings, then verify real workflows.
3. Complete native key, storage-barrier and identity integrations with decisive engine proof.
4. Verify a current-source portable documentation package and remaining delivery paths.
5. Prove restoration on a second physical Windows computer, then complete storage, hosting,
   public documentation, release and installation acceptance.

See `CLOSEOUT_PROMPT.md` for ownership and continuation constraints.
