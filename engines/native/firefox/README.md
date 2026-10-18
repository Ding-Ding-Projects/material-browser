# Firefox native snapshot coordinator

`MaterialSnapshotBarrier.sys.mjs` is staged into the pinned Firefox source's
`browser/components/` directory and registered in `MOZ_SRC_FILES` by
`engines/build-native.ps1`. Production builds enter through
`build.bat -Component BrowserNative -NativeEngine firefox`. The source cache uses
the short `ff-<revision-prefix>` directory because Mozilla rejects Windows source
paths longer than 62 characters.

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

## Verification

`node --test engines/native/firefox/snapshot-barrier.test.mjs` executes the actual
module's state machine with synthetic providers. It covers missing stores,
binding/shape rejection, retained barriers, reverse release, acquisition failure,
abort, generation replay, concurrency and poisoned recovery. This is coordinator
logic evidence only. It proves neither native packaging/import nor real store
quiescence, IPC authentication, browser recovery or snapshot restoration.

`engines/recipes/firefox-snapshot.json` records inspected upstream source hashes.
Native compilation and built-browser acceptance must be recorded separately.
