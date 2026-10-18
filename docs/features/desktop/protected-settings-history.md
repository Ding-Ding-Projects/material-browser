# Protected local settings history

The native history service records validated presentation preferences and local
schedule rules. It is an isolated local Git repository inside the application's
stable data directory, independent of profile vault unlock and synchronization.
There are no network commands, remotes or user-selected repository paths.

## Main-process integration

Create `createHistoryService` from `electron/services/history.cjs` with trusted
`appDataRoot`, `historyRoot: path.join(appDataRoot, 'settings-history')`, an
absolute `gitExecutable` and its independently verified SHA-256 `gitSha256`,
`credentialStore`, and `validatePreferences`/`validateSchedule` imported from
`shared/settings-model.mjs`. Never accept these options from renderer input.
The executable hash is checked before every bounded Git invocation; shell
execution, hooks, global/system configuration and network protocols are disabled.
Paths are checked for symbolic links. Main owns and serializes this service;
concurrent independent application processes are not supported.

The exact v1 snapshot is `{schemaVersion:1, preferences, schedules}`. Unknown
fields are rejected, not silently imported. The shared model validates all
preference values and local schedule rules. Personal wording, imported file
metadata, custom-image data, profiles, credentials and arbitrary user records
have no place in this schema. A snapshot is limited to 256 KiB and 200 schedules.

Every method returns `{ok:true,...}` or `{ok:false,error:{code,message}}`.
Error messages exclude user content, helper output and paths.

## Authentication and recording

`setup(secret)` establishes an independent password or PIN (6 to 256 characters).
`unlock(secret)` verifies its salted scrypt verifier locally; `lock()` closes the
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
multi-process locking and physical pruning remain unfinished.

Secret, authenticator and display-name mutations are outside this snapshot schema.
`protectedMutation:true` returns `PROTECTED_TRANSACTION_REQUIRED`; main must not
advertise those mutation histories as implemented or treat this as permission to
complete a protected mutation without its own durable transaction adapter.

Focused tests exercise actual local Git commits, independent authentication,
restart, no-op recording, encrypted file contents, append-only restoration,
redacted export, wrong passwords, unknown fields, executable-hash mismatch,
missing keys and interrupted-restore recovery. Credential tests use a fresh
application-owned Windows test target and remove it after the real roundtrip.
Built Settings interaction and installed-package acceptance remain separate.
