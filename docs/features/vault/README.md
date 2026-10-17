# Encrypted vault

The Rust core implements the command contract in `docs/architecture.md`. The host serializes
requests and verifies engine ownership and stopped state before snapshot or restore. The core
never launches a browser and never reads a default or personal browser directory.

## Create, unlock and lock

Call `vault.create` with `{ "password": "..." }` once, then use `vault.unlock` with the same
shape. `vault.lock` discards loaded metadata and zeroizes the loaded vault and profile keys.
`vault.changePassword` accepts `oldPassword` and `newPassword`. A random 256-bit vault key is
wrapped with an Argon2id derived password key (64 MiB, three passes, one lane in production).
Authenticated XChaCha20-Poly1305 encryption protects the metadata and every immutable object.
Random 24-byte nonces and context-specific associated data bind ciphertext to its purpose,
profile and object identifier. Unit tests use lower Argon2 costs for disposable synthetic data.

The header exposes only format, random salt and encrypted wrapped key. Metadata includes profile
keys, stable identity configuration, preferences and revision filenames and is encrypted on disk.
Sensitive arguments never appear in errors. Passwords must travel over protected local IPC or
standard input, never command arguments, logs or environment variables.

Locking protects the encrypted store, but does not erase a browser's active working directory or
retained restore backups. Those directories are plaintext working data owned by the vault root.
Use full-disk encryption and operating-system access controls, and close the managed engine
before locking. The host must not present lock as secure deletion of working data.

## Profiles and settings

`profiles.create` accepts `name` and optional `engine` (`chromium` or `firefox`). Automation
starts `off`; update it explicitly to `selenium` or `puppeteer`. A profile receives a random UUID,
per-profile encryption key and a stable random identity seed. The identity is configuration, not
proof that a managed engine can apply fingerprint changes. `profiles.update` accepts `id` and
optional `name`, `automation` and boolean `sync`. The host owns effective automation state and
restart reporting. `profiles.duplicate` accepts a source `id` and new `name`, and creates fresh
identity and keys while retaining engine choice; it does not copy browser data.

`profiles.list` returns an array. `settings.get` returns `{ "preferences": ... }`, while
`settings.update` accepts `{ "preferences": { ... } }`. Preferences remain encrypted and local,
and are excluded from synchronization. Personal wording payloads must never be stored here if
another layer could export, log or transmit them.

## Snapshots and restore

`profiles.snapshot` accepts `{ "id": "uuid", "running": false }`. The host must independently
verify its managed engine is stopped before supplying this assertion. Omitted or true `running`
returns `ENGINE_BARRIER_UNAVAILABLE`. No live engine barrier is currently implemented and no
live-safe snapshot claim is supported. Files are read only from `active/<profile UUID>` under
the manager root. Synthetic data can be placed there by a local test without launching browsers.

Snapshots store immutable encrypted chunks and an encrypted revision manifest. `revisions.list`
accepts `id` and returns revisions with `id`, `profileId`, `parents`, `createdAt` and `files`.
`revisions.restore` accepts `id` and `revisionId`; the host must stop the profile first. Restore
verifies all content into a new staging directory before swapping the active directory. It
retains the previous directory as a recovery backup. A restore creates a new revision preserving
current parents, so restoring old contents does not discard later history. Browser database
files are never merged. An interrupted directory swap can leave an old directory under staging;
retain it and inspect before recovery, never delete it automatically.

## Folder synchronization

`sync.configure` accepts an absolute `folder` separate from the vault root. Set a profile's
`sync` to true before `sync.push`. The shared directory receives immutable ciphertext chunks,
revision manifests and a random encrypted publication manifest, with publication written last.
No preferences or sync-folder path is exported. Each completed publication includes a small
wrapping header with format, random salt and authenticated encrypted vault key, published before
the encrypted manifest. A new computer calls `vault.join` with an absolute `folder` and `password`.
It authenticates the header, validates the complete encrypted publication and every referenced
chunk/ancestor, then publishes local encrypted metadata and the wrapping header. A wrong password
or incomplete transfer leaves the new vault locked and unpublished, allowing a safe retry.
No manual copying of keys or metadata is required. Join requires an empty local vault and a
dedicated synchronization folder. At most 64 enrollment-header candidates are attempted and
10,000 total directory entries are accepted; archive old complete publications before reaching
these bounds. Do not remove ciphertext still referenced by retained revisions. No timestamp
selects winning data. Password-based independent vault creation creates unrelated keys and does
not join a vault. Network provisioning is outside the core.

Changing a local password replaces its wrapping header for future publications. Previously
published headers remain immutable; changing a password does not revoke access to a vault key
already learned through an older header. Cryptographic access revocation requires key rotation
and re-encryption, which this version does not implement.

`sync.pull` validates authenticated manifests, file paths, profile key equality, every encrypted
chunk, revision identity, and parent completeness. A missing or modified object aborts the
metadata update. Immutable ciphertext copied before an abort may remain harmless unreferenced
objects. The revision DAG computes all heads and retains concurrent revisions. `sync.conflicts`
returns `profileId` and `revisionIds` arrays. `sync.resolve` accepts `id` and a selected
`revisionId`, and creates a new revision whose parents contain every preserved head. It chooses
contents explicitly without timestamp winner rules or database merging. Existing local profile
configuration is retained when a peer advertises an already known profile; distributed profile
rename/deletion reconciliation is not implemented.

## Bounds and security limits

Requests are limited to 1 MiB. Encrypted objects and restored or captured aggregate content are
limited to approximately 64 MiB; snapshots contain at most 10,000 files. Oversized inputs fail
explicitly. UUID identifiers, relative path validation and symbolic-link checks reject traversal
and links at the time of inspection. The root must be private to the current OS user; these
checks are not a defense against an adversary concurrently changing the filesystem between
inspection and open. The host must serialize operations, prevent two managers writing the same
root, and protect its local IPC. An OS-exclusive lock rejects a second manager for the same root. The core does not provide secure deletion,
network authentication, live engine barriers or cryptographic access revocation.

## Verification

Run `build.bat -Component Core` and `cargo test -p material-browser-core` locally. Tests use
synthetic temporary directories and cover wrong passwords, lock/unlock, password rotation,
tampered content, cross-profile restore refusal, traversal, plaintext metadata absence,
concurrent revision preservation, explicit resolution and incomplete synchronization.


