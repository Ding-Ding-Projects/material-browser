# Protected local settings history

The native history service records validated presentation preferences and local
schedule rules. It is an isolated local Git repository inside the application's
stable data directory, independent of profile vault unlock and synchronization.
There are no network commands, remotes or user-selected repository paths.

The service boundaries are explicit: `history.cjs` owns authentication and
transactions, `history-storage.cjs` owns managed filesystem and Git integrity,
`native-lock.cjs` owns the protected cross-process kernel lock, and
`credential-store.cjs` owns the application-scoped Credential Manager adapter.

## Main-process integration

Create `createHistoryService` from `electron/services/history.cjs` with trusted
`appDataRoot`, `historyRoot: path.join(appDataRoot, 'settings-history')`, an
absolute `gitExecutable` and its independently verified SHA-256 `gitSha256`,
`credentialStore`, and `validatePreferences`/`validateSchedule` imported from
`shared/settings-model.mjs`. Never accept these options from renderer input.
The executable hash is checked before every bounded Git invocation; shell
execution, hooks, global/system configuration and network protocols are disabled.
Paths are checked for symbolic links. Every service call holds the same
application-scoped kernel mutex across processes, including authentication,
recording and trusted apply callbacks. A fixed local helper holds the mutex until
its input pipe closes. Process termination releases it through normal pipe and
kernel abandonment handling, without guessing whether a PID is stale. Credential
creation has its own app-owned mutex, preventing simultaneous key replacement.
The mutex uses the global namespace and the current user's SID, with an explicit
protected owner-only ACL. Existing mutex ownership and access rules are checked;
an unsafe pre-created mutex is rejected. Actual second-logon-session acceptance
has not been performed; same-session process concurrency and crash recovery are
verified separately.

Before the first filesystem mutation and on every reuse, the service verifies
exact managed files and directories plus their ancestors. Links, hardlinks,
unexpected types and unexpected entries are rejected without deleting them.
The empty global config is created exclusively and never truncated. Atomic
updates use random exclusive temporary files, flush them and recheck destination
paths before rename. Abandoned `auth.json.<UUID>.tmp` and
`pending.json.<UUID>.tmp` files remain inert and preserved in place. The inventory
accepts only exact names, regular single-link files, up to 400,000 bytes each,
128 files and eight MiB combined. Their contents are never activated, imported,
authenticated or committed. Status reports only their count. Unknown, linked,
wrong-type or oversized leftovers remain explicit blockers. The last durable
journal governs recovery, so a failed phase update does not hide it.
Before every Git invocation, pure filesystem checks allow only the app's small
core configuration, reject includes and executable configuration, reject
attributes and repository indirection, and require an empty managed hooks folder.
Initialization uses that verified empty template and disables filesystem monitors.

The exact v1 snapshot is `{schemaVersion:1, preferences, schedules}`. Unknown
fields are rejected, not silently imported. The shared model validates all
preference values and local schedule rules. Personal wording, imported file
metadata, custom-image data, profiles, credentials and arbitrary user records
have no place in this schema. A snapshot is limited to 256 KiB and 200 schedules.

Every method returns `{ok:true,...}` or `{ok:false,error:{code,message}}`.
Error messages exclude user content, helper output and paths.

## Authentication and recording

`setup(secret)` establishes an independent password or PIN (6 to 256 characters).
`verify(secret)` checks its salted scrypt verifier without unlocking anything.
`unlock(secret)` performs that verification and opens a session; `lock()` closes the
session. The session expires after ten minutes. Vault unlock never unlocks history.
`status()` reports configured, unlocked and recovery-pending state without data.

`recordSettings({before,after,action})` records a real mutation as an encrypted
new file and a new Git commit. Identical before/after snapshots produce no commit.
Normal settings writes must happen independently: history failure returns
`recorded:false` and a warning, never a false recorded result or a rollback of
the user's ordinary preference change. Main surfaces the warning.
The fixed default action is `settings-changed`; supported snapshot actions are
created, updated, deleted, imported and restored as well.

AES-256-GCM encrypts each snapshot and event, including user text. Authentication
binds ciphertext to the stable application-history identity and immutable revision
identity. Keys are held only by the app-owned Windows Credential Manager adapter,
which supplies a temporary buffer to trusted internal callbacks and clears it
after use. No key method belongs on renderer RPC. The helper accepts only this
application's target prefix and exchanges values through local process pipes.

## Browse, restore and recovery

An independently unlocked session is required for `list({actions,from,to,limit})`,
`diff(revision)`, `label(revision,label)`, `restore(revision,apply)`,
`setRetention({visibleDays})`, and `exportRedacted()`.
List supports inclusive ISO date and action filters. Diff returns changed setting
keys and schedule counts, without freeform text or voice identifiers. Labels are
encrypted; redacted export excludes their contents, snapshot values and user text.

Restore first writes an encrypted recovery journal and commits a prepared record.
Only then does it call the trusted main-process apply callback. A successful apply
is followed by a new restored revision; history is never reset or rewritten.
An interruption leaves `recoveryPending:true`. After independent unlock, main
can offer `recover('retry', apply)` to retry the validated snapshot, or an explicit
`recover('discard')` to retain the current live state and record the decision.
No automatic recovery overwrites live preferences at startup.

## Limits and verification

Retention is logical visibility only. Its policy is itself a new revision;
physical pruning remains unavailable and is explicitly reported as unfinished.
The service caps storage at 2,000 event files and list/export at 500 entries per
request. A complete paginated export, freeform search, password reset/change,
and physical pruning remain unfinished.

Display-name changes use `transactDisplayName({before,after,action}, apply)` with
an independently unlocked session. Values are a bounded chosen string or null;
actions are created, updated, deleted and reset. The encrypted typed snapshot is
`{schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName}`.
The stable record identity is authenticated alongside the immutable revision ID,
so deleting and restoring a name cannot orphan its encrypted history. Legacy
settings envelopes remain readable, while new envelopes carry authenticated
record identity explicitly.

Main's trusted apply callback receives `(snapshot, {expected: previousSnapshot})`
and must compare the expected value with live state and write atomically. The
callback must be idempotent: if live state already equals the requested value,
return success without rewriting it. Recovery supplies `recovery:true` and may
retry after an earlier apply succeeded but its final history commit did not.
Recovery records a durable preparation again before calling apply.
The
service rejects a before-value conflicting with the latest committed display-name
record. Its cross-process mutex spans preparation, durable commit, apply and final
commit. Failure leaves the encrypted phase journal for explicit recovery and never
reports applied success. Main must route every display-name mutation through this
transaction API. Restore and recovery callbacks dispatch using snapshot kind.
Names are omitted from ordinary diff/export metadata.

Secret and authenticator mutations remain outside this snapshot schema.
`recordSettings` cannot accept a display-name record or a protected mutation;
those attempts return `PROTECTED_TRANSACTION_REQUIRED`.

Focused tests exercise actual local Git commits, independent authentication,
restart, no-op recording, encrypted file contents, append-only restoration,
redacted export, wrong passwords, unknown fields, executable-hash mismatch,
missing keys and interrupted-restore recovery. Credential tests use a fresh
application-owned Windows test target and remove it after the real roundtrip.
Built Settings interaction and installed-package acceptance remain separate.
