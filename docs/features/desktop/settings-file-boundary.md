# Main-process settings file boundary

Settings exports and the optional editor choice use application-owned destinations. Renderer requests cannot supply a directory, filename, executable path, or command. The native picker supplies an editor candidate, which becomes the effective selection only after its record has been saved successfully.

Before creating a directory, reading a record, or replacing a record, the desktop bridge checks the destination and every existing ancestor. Symbolic links and directory junctions are rejected. Existing records must be ordinary files with one hard link and bounded size. Reads verify the opened file identity and use a bounded buffer. New files use exclusive creation. Atomic replacement writes and flushes a unique temporary file before renaming it over a validated destination. A rejected replacement preserves the previous record and does not switch the selected editor.

These checks reject pre-existing redirected paths and reduce replacement races. They do not claim protection against an adversarial process with the same filesystem permissions repeatedly replacing ancestors between native filesystem calls. An interrupted write can leave an application-owned temporary file; it is not treated as a completed save.

The focused native bridge tests cover a linked export root with an unchanged victim sentinel, a linked ancestor, a hard-linked destination, exclusive-write collisions, rejected atomic replacement, and a rejected editor save followed by discovery of the original choice. These checks establish the file boundary, not complete protected-history integration or installed-package acceptance.

## Native preference snapshot model

The main-owned preference store validates the packaged shared preference schema, schedule collection, explicit field provenance and monotonically increasing revision. It serializes operations under an application-scoped platform mutex. Writes require the expected revision; stale migrations and conflicting edits fail without replacing the current record. A missing record is distinguishable from a corrupt record. Only an absent record permits initial migration, and corrupt bytes remain available for recovery.

The trusted history apply callback compares the complete expected preference/schedule snapshot under the same mutex. An already-applied target is idempotent; a different live snapshot produces a conflict. Ordinary saves must release this mutex before recording protected history. History restore may hold its own mutex while invoking the preference callback, which never calls history recursively.

Six model tests cover one-time initialization, provenance, stale revision rejection, reopening persisted values, corrupt-record preservation, expected-state restoration, idempotent recovery, rejected writes, excluded payload fields and contention between independent store instances using the actual platform mutex. This module is not yet connected to renderer startup or the protected-history controls. Coupled two-process history/write overlap remains a separate acceptance check.
