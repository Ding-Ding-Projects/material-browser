# Firefox native snapshot coordinator

`MaterialSnapshotBarrier.sys.mjs` is staged into the pinned Firefox source's
`browser/components/` directory and registered in `MOZ_SRC_FILES` by
`engines/build-native.ps1`. Production builds enter through
`build.bat -Component BrowserNative -NativeEngine firefox`. The source cache uses
the short `ff-<revision-prefix>` directory because Mozilla rejects Windows source
paths longer than 62 characters.

For a diagnostic retry of the baseline, set the process-local environment variable
`MATERIAL_BROWSER_NATIVE_BASELINE_ONLY=1` and invoke the same root command. This
retains the disabled privileged coordinator but skips the native cookie patch.
It rejects an already patched or modified cookie source instead of resetting it.
The default mode stages the candidate. Every Firefox build writes a unique
structured `mach` diagnostic log inside its private native cache. Logs contain
local build paths and must not be published without review and sanitization.

The coordinator implements the restricted begin, commit and abort state machine.
It binds requests to the trusted profile and executable digest, rejects extra
fields and competing transactions, and releases acquired barriers in reverse
order. Release failure attempts every remaining release and permanently marks
that coordinator unavailable. A provider that fails acquisition must undo its
own partial work before rejecting. The transport owner must handle peer loss,
deadlines and browser shutdown before this can be used by the host.

This is a privileged engine module, not an exposed control channel. There is no
web, extension, debugging, automation, command-line or native IPC endpoint. A
future native transport must authenticate its inherited peer and supervised
process before constructing the trusted binding. Caller-provided strings alone
are not authentication.

## Disabled capabilities and incomplete stores

No production barrier providers are registered. The default begin result is
`unavailable` and enumerates every missing barrier: network, renderers, service
workers, cookies, Places, logins, preferences, SessionStore, LocalStorage,
IndexedDB, CacheStorage, extension state and other profile writers. It never
returns a successful snapshot receipt. Portable encryption, stable identity and
whole-profile live snapshots remain disabled.

At revision `3c71aeacdb296402e41fb2084b13e797d1770642`:

- `CookiesBackupResource.canBackupResource` explicitly returns false.
- `CookiePersistentStorage::Close` calls `CookieDBWriteQueue::FlushNow` and then
  queues `AsyncClose`. This is a shutdown path, not a reusable live freeze.
- LocalStorage `ActorsParent.cpp` documents a 5000 ms flush delay downstream of
  content snapshot checkpointing. A database file copy can miss those writes.
- QuotaManager uses the `profile-before-change-qm` shutdown phase. Emitting this
  observer topic to pretend a reusable live barrier is unsupported.
- Password storage queues JSON saves through `saveSoon`. SessionStore writes
  through its own writer promise and final shutdown blockers. Neither proves a
  common freeze across the remaining stores.

Individual flushes, SQLite backup, upstream backup resources or a live directory
copy do not establish one consistent generation. Do not register any provider
until it closes new-write admission, drains outstanding work, flushes durable
state and holds the freeze until explicit release, including renderer and worker
coordination. The complete inventory still requires an engine-wide audit.

Known unfinished writers inside `otherProfileWriters` include:

| Store | Inspected source and outstanding boundary |
| --- | --- |
| NSS key and certificate storage | `security/nss/lib/softoken/sdb.c` and `sftkdb.c` use independent SQLite begin/commit operations. A cookie pause does not coordinate these records with saved logins. |
| Site permissions | `extensions/permissions/PermissionManager.cpp` owns `permissions.sqlite`; its shutdown barrier is registered at `xpcom-will-shutdown`, later than `profile-before-change`. No reusable snapshot admission barrier is implemented. |
| Form history | `toolkit/components/satchel/FormHistory.sys.mjs` uses its own SQLite transactions and shutdown-close blocker. No live write freeze is implemented. |
| Content preferences | `toolkit/components/contentprefs/ContentPrefService2.sys.mjs` owns `content-prefs.sqlite`, a separate connection and memory caches. Its shutdown observer is not a resumable live freeze. |
| Search settings | `toolkit/components/search/SearchSettings.sys.mjs` finalizes a pending batch task through `_ensurePendingWritesCompleted`; later settings changes can schedule more work. No admission freeze is implemented. |
| Persistent window state | `toolkit/components/xulstore/XULStore.sys.mjs` delays writes and disables future saves at `profile-before-change`. Triggering shutdown to borrow that behavior is not a reusable snapshot provider. |

These are identified gaps, not a claim that every profile writer has been found.

## Verification

`node --test engines/native/firefox/snapshot-barrier.test.mjs` executes the actual
module's state machine with synthetic providers. It covers missing stores,
binding/shape rejection, retained barriers, reverse release, acquisition failure,
abort, generation replay, concurrency and poisoned recovery. This is coordinator
logic evidence only. It proves neither native packaging/import nor real store
quiescence, IPC authentication, browser recovery or snapshot restoration.

`engines/recipes/firefox-snapshot.json` records inspected upstream source hashes.
Native compilation and built-browser acceptance must be recorded separately.

## Cookie write-pause implementation candidate

`engines/recipes/firefox-158-cookie-pause.patch` implements a native cookie
write-queue pause with monotonically increasing leases. Acquisition first drains
earlier batches and remains unavailable while a batch or delete-all operation is
in flight. A lease prevents future queue dispatch while keeping in-memory
mutations buffered. Reset, corruption and close invalidate the lease; stale
release requests cannot thaw a newer lease. Write errors permanently disable
snapshot acquisition for that storage instance without stopping normal recovery.

The patch also adds native cookie tests. The next root Firefox build stages it
after bootstrap and before compilation. Its recipe admits every affected file
against normalized SHA-256 hashes of the reviewed baseline and patched result,
then verifies each staged result. It resumes partial application only when all
files still match one of those two admitted states. The running baseline is
immutable and does not receive this candidate halfway through compilation.
Patch application and current-source admission were checked, not native compilation or execution. It remains
unregistered and does not complete the cookie provider: session cookies need
their own consistent state, WAL/connection durability and direct-writer coverage
need runtime validation, and the provider must propagate invalidation and thaw
through the authenticated native transaction before any output is published.

`refresh-cookie-receipt.py --source <pinned-source> --check` reconstructs the patch
against the pinned Git objects and verifies every expected receipt hash without
changing the native source. Omitting `--check` regenerates the receipt after a
reviewed patch change. Lease identifiers are monotonic across storage instances,
so replacement storage cannot accidentally accept a stale release.
`python -B engines/native/firefox/test_cookie_receipt.py` verifies reconstruction
and rejection of modified source, malformed hunk lengths, changed destinations,
path escapes and duplicate files. These checks do not open or mutate a profile.
