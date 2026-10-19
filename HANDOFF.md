# Implementation handoff

## Windows automation setup

The branch-push/manual Windows build-and-release workflow invokes the existing desktop and
offline-handbook installer entrypoints on `windows-2025`, with pinned Node/Rust setup and
safe output retention. It publishes uniquely tagged normal development releases without
changing the latest accepted release channel. Tests and lint remain local. Hosted build,
publication, native installation and fresh-image bootstrap proof are pending the first run.
See `docs/features/delivery/windows-automation.md` for the complete job dependency inventory
and boundaries. Existing unrelated recovery branches remain untouched.

## Current priority

Material Browser remains incomplete. The latest user correction prioritizes the missing
required features in Settings. Main now includes ten Settings categories and 37 validated
local controls, with help, searches, schedules, notifications, local history and exports.
The 109-row inventory contains 65 desktop-applicable rows, with none claimed complete.
A control inventory is not comprehensive feature acceptance.

## Integrated and preserved source

- Main `0685702` integrated the categorized Settings slice through `353711a`. Its exact
  Desktop build, 33 source tests and three IPC tests passed. Real built transitions verified
  initial and docked navigation, durable selection and append-only Undo/Redo behavior.
- Main `590592a` integrated hardened protected-history storage. Twenty-one focused checks
  passed, including real Credential Manager roundtrip, process concurrency and termination,
  abandoned temporary files, filesystem boundaries and local execution-configuration attacks.
- Main `5179045` added independent history-password changes and session-generation revocation;
  four integrated focused authentication checks passed.
- Main `ebba6fd` added verified portable Git acquisition to the real Desktop/All entrypoints.
  The exact Desktop build passed after the build selected its own built-in PowerShell module.
  The pinned archive and all 373 extracted files are verified before execution. Fresh Rust
  toolchain acquisition and complete fresh-host bootstrap remain unfinished.
- Main `02bf0b2` requires original semantic state and native revision expectations for restore
  and recovery. Its focused integrated run passed four cases and failed one existing
  display-name case: `HISTORY_LOCK_TIMEOUT` instead of `HISTORY_LOCKED`. The run lasted
  572640.6127 ms while a separate native compile saturated the host CPU. No causal diagnosis
  or passing rerun is claimed; retain the failure and repeat only after conditions change.
- Desktop branch `b8bd4fb` has independent source approval for native preference persistence
  and asynchronous-save repairs, including preservation of the previous notification Undo
  target when a new dismissal fails. Its later coupled history interface at `d5ecc5c` is an
  inactive recovery candidate awaiting independent review and real runtime verification.
  These later slices are not yet integrated into main.

The native preference candidate uses a validated main-owned file, cross-process locking and
revision comparison. Protected history uses independent authentication and trusted callbacks.
Private personal wording remains outside these synchronized or exported records. Coupled
settings/history lock ordering, packaged runtime admission and complete GUI workflows still
need real built verification. Drop outcome sounds remain unfinished.

## Native browser evidence and limits

Final lifecycle candidate `7031adb`, documented at `7856399`, is integrated in main `7df4e81`.
Six hidden-desktop runs verified complete owned-job exit before releasing profile leases,
including local and paired LAN automation, active Firefox BiDi contention and an already
closed browser. The integrated Host build passed 45 Rust workspace tests and two adapter
checks. Earlier `4434a65` and `bfd4fb5` launcher-only stop evidence remains superseded.

On `feature/browser-engines`, Firefox baseline `3ebb68c` compiled successfully. Candidate
`58864e1` compiled the cookie write-queue pause implementation and passed its one native
queue/lease test. That unopened-storage fixture does not prove database/WAL durability,
session-cookie persistence, all-store consistency or a whole-profile live snapshot.
All 13 snapshot providers remain unregistered and live capability remains disabled.

Chromium candidate `90c2af7` passed a standalone protected-channel fixture. It is a threaded,
single-process transport fixture, not a production broker or cross-computer credential proof.
The production broker and an early-startup key handoff remain absent. Source inspection also
found platform encryption initialization preceding the proposed replacement-provider use.

Pinned source `499a20f` is undergoing a real Chromium build. Verified SDK 28000.2957 installation
completed with exit zero and no requested restart, and GN generation succeeded. The last
resource sample at 08:55 UTC on 2026-10-18 observed 32 compiler children and 100% host CPU;
no terminal compile result is claimed. Keep those producer inputs fixed. The one-hour
observation boundary is 09:35:17 UTC. A blocked optional x86 updater test payload must not
be retrieved again or used as a reason to weaken host protection.

Portable credentials, advanced identity and consistent whole-profile live snapshots remain
unverified and disabled. A second physical Windows computer is still needed for restoration
acceptance. Existing personal browsers and credentials remain outside management.

## Documentation and delivery

The public handbook is verified at https://ding-ding-projects.github.io/material-browser/ .
Its deployed source is `b9b892b`, publication `fa7557312906abcd956b3478e19112b6158dda35`.
All 21 article/wiki routes rendered; all eight delivered files matched published hashes.
Guides, searches, persisted reading preferences, keyboard focus and inspected narrow layouts
passed bounded real-browser checks. Deployment run 39108839843 succeeded and the exact About
homepage was read back. Later source articles and images have not yet been republished.

The separate offline handbook at `1cd196b` passed actual single-file launch and restart,
all 21 routes, bundled image checks, isolated runtime security and preference persistence.
Unsigned executable SHA-256:
`dcdd08b18afb848cb6d6f8020abf43a86ea8d50026f00ee51b891243295e2f49`.
Four inspected source-bound captures were promoted in `28fdbfe`, integrated as `b368bf2`,
under `docs/evidence/handbook/`. Their full private receipts passed the evidence validator;
the restart capture remains excluded because contemporaneous diagnostic observation was absent.
Main `62ba5de` built 24 articles with the four newly approved assets. Later articles remain
unbuilt and undeployed. Generated announcement images are never runtime evidence.

The repository wiki is enabled, but its Git endpoint reports repository not found. Complete
local wiki articles are bundled in the handbook; separate hosted-wiki synchronization remains
unavailable through that endpoint. Positive storage deployment, published container image,
LAN setup, full installer/update acceptance, build companion and a normal release remain
unfinished. No release or whole-product completion is claimed.

## Preservation and next steps

Retain all active task branches, worktrees, ignored runtime evidence and private announcement
variants. No task-owned branch or recovery reference has been deleted. Temporary documentation
profiles remain retained after automatic approval review rejected scoped deletion. Do not retry
that deletion through another route. Recorded documentation browsers/listeners/desktops closed.

1. Integrate the independently approved native preference and asynchronous-save tranche.
2. Review and verify the coupled protected-history GUI, trusted callbacks and packaged runtime;
   rerun the timed-out display-name case only after the load condition changes.
3. Continue the full Settings inventory, including missing genuine workflows and drop sounds.
4. Observe the pinned native compile within its recorded bound, preserve its actual result,
   then implement the production early-startup broker and complete snapshot coordination.
5. Rebuild and republish current documentation, retaining exact source/image provenance.
6. Complete two-computer restoration, storage, packaging, release and installed-update proof.

See `CLOSEOUT_PROMPT.md` for the continuation objective and constraints.

## First hosted run and packaging correction

Run 39193430232 built the real desktop Squirrel installer, then failed handbook packaging
because the packager inferred an automatic publication target from workflow credentials.
The handbook now explicitly disables automatic publishing so the release helper is the sole
publisher. The corrected run remains pending.

The user also requested the installed application and installer icon. The desktop executable,
window, Squirrel setup and handbook now reference the reviewed browser/globe icon. Seven ICO
sizes (16 through 256) and JavaScript syntax checks passed. Built executable resources and
native installed icon display remain unverified until rebuilt and exercised.

## Hosted package delivery and filename correction

Run 39194115797 built both installers and published normal development release
`build-2-39194115797-1` from a6b4a78e5379fd631083ce97da83a0133559c069. Its final readback
failed because GitHub replaced a space with a dot in the setup asset name. Publication
helper staging now gives every upload an explicit safe filename and rejects collisions.
The matching mocked flow and empty-output, source-mismatch and asset-mismatch checks pass.
A new hosted run must verify the corrected publication flow. Existing release timing notes
need a factual correction, and the old asset inventory retains its original local names.

The exact local Desktop installer build passed with its normal TypeScript check. Inspection
of both the packaged application and setup executable confirmed the requested browser/globe
icon. This is embedded-resource proof, not native installation or full UI acceptance.

## Latest user-reported launch failure

The user reported wrapped `IDENTITY_UNAVAILABLE` from desktop Launch. The interface omitted
`requireStableIdentity`, while the host defaults it to true and the native engine correctly
rejects the unavailable guarantee. The repair adds explicit per-launch standard-identity
consent, captured profile identity, cancellation/invalidation and duplicate-submission
protection. Strict backend defaults are unchanged. Known exceptions get localized approved
copy before footer, toast and narration; arbitrary exception text is never reflected.
Three focused mapper tests pass. Exact candidate build and real consent interaction are pending.

Windows build/release automation is verified by green run 39195138374, normal release
build-3-39195138374-1 and exact source ed7ad0a. Both installers and all five assets were
read back by the workflow. Earlier setup icon download also matched SHA-256 and byte count.

## Latest bundled-engine implementation, 2026-10-19

The user requires Chromium and Firefox inside the installer and genuine updated screenshots
in README. The desktop build now verifies five pinned vendor archives plus complete extracted
inventories, stages full browsers/drivers/Node/locked adapter dependencies outside ASAR, and
packages `resources/engines`. The host receives that separate engine root; manifest and adapter
paths remain relocatable and canonically contained. Legacy in-bundle absolute adapter paths
remain accepted only when contained. Standalone packaged host startup discovers adjacent engines.

Pins: official Chromium development snapshot 158.0.8111.0, revision 1721569/source
8b90bd52655dcdf5456cda56ae4d53b184c4dbd3; Mozilla Firefox 158.0; matching ChromeDriver;
geckodriver 0.37.1; Node 26.4.0. Licenses and accurate source notices are retained. Advanced
identity, portable credentials and live snapshots are still false capabilities.

Verified so far: exact Desktop runtime staging/build, native Host build before its final
adjacent-discovery correction, nine focused JavaScript checks, and one real adapter path
containment/relocation test. The earlier Rust test invocation used an over-specific filter
and ran zero tests; its corrected fully qualified invocation ran one and passed. A synthetic
pre-bundle UI fixture remained stale and was not promoted. The task-owned window was closed
through its isolated page; the lifecycle helper then reported UNKNOWN_PROCESS_TREE because
its saved root had exited. No PID-only termination was attempted. Its private receipt remains
retained. Fresh combined packaging, actual browser launch/stop, current UI evidence and the
new hosted release are still pending. No completed runtime or installer acceptance is claimed.

## Follow-up candidate, 2026-10-19

Source a588bfd completed local packaging and hosted run 39198295866, publishing normal release
build-5-39198295866-1. Chromium Off launched/stopped through real desktop controls. Firefox Off
launched/stopped through the protocol; its early launcher exit prevented full window ancestry
proof. The pending repair uses -wait-for-browser in every Firefox mode. Dialog actions now stay
in a wrapping footer, with deferred focus restoration after removal. Publication transfers
individual bounded assets with immediate published digest checks. Five focused JavaScript
checks and four publisher fixture scenarios passed. Updated runtime proof remains pending.
The completed hidden run's six owned process identities were proven absent and its exact
desktop closed. Diagnostic images remain private, not current README proof.

## Automation path repair, 2026-10-19

The four packaged automation launch modes returned ADAPTER_START_FAILED at source7af90f7,
while both Off launches passed. A direct reproduction identified Node26.4.0 rejecting a
Windows extended helper filename with EISDIR before executing the helper. Equivalent ordinary
absolute spelling reaches the unchanged helper. The new boundary converter accepts drive/UNC
paths only, verifies canonical round-trip equality and representability, and leaves canonical
hash/containment/ownership identities intact. It converts Node/helper/browser/profile/driver
paths only where passed to external runtimes. Two focused tests passed after the original
extended-prefix assertion was observed failing. They include spaces, non-ASCII names, file and
directory identities, namespace rejection, UNC construction and a trailing-dot ambiguity.
Live UNC-share proof is unavailable. The rebuilt native Host passed before the final input
namespace assertion; final combined packaging and native automation remain pending.
