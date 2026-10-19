# Main-process settings file boundary

Settings exports and the optional editor choice use application-owned destinations. Renderer requests cannot supply a directory, filename, executable path, or command. The native picker supplies an editor candidate, which becomes the effective selection only after its record has been saved successfully.

Before creating a directory, reading a record, or replacing a record, the desktop bridge checks the destination and every existing ancestor. Symbolic links and directory junctions are rejected. Existing records must be ordinary files with one hard link and bounded size. Reads verify the opened file identity and use a bounded buffer. New files use exclusive creation. Atomic replacement writes and flushes a unique temporary file before renaming it over a validated destination. A rejected replacement preserves the previous record and does not switch the selected editor.

These checks reject pre-existing redirected paths and reduce replacement races. They do not claim protection against an adversarial process with the same filesystem permissions repeatedly replacing ancestors between native filesystem calls. An interrupted write can leave an application-owned temporary file; it is not treated as a completed save.

The focused native bridge tests cover a linked export root with an unchanged victim sentinel, a linked ancestor, a hard-linked destination, exclusive-write collisions, rejected atomic replacement, and a rejected editor save followed by discovery of the original choice. These checks establish the file boundary, not complete protected-history integration or installed-package acceptance.

## Native preference snapshot model

The main-owned preference store validates the packaged shared preference schema, schedule collection, explicit field provenance and monotonically increasing revision. It serializes operations under an application-scoped platform mutex. Writes require the expected revision; stale migrations and conflicting edits fail without replacing the current record. A missing record is distinguishable from a corrupt record. Only an absent record permits initial migration, and corrupt bytes remain available for recovery.

The trusted history apply callback requires a numeric native revision and compares it with the complete expected preference/schedule snapshot under the same mutex. An already-applied target is idempotent; a different live snapshot or intervening revision produces a conflict, including a change away from and back to the same values. Ordinary saves must release this mutex before recording protected history. History restore may hold its own mutex while invoking the preference callback, which never calls history recursively.

Seven model tests cover one-time initialization, provenance, stale revision rejection, reopening persisted values, corrupt-record preservation, expected-state restoration, idempotent recovery, intervening revisions, rejected writes, excluded payload fields and contention between independent store instances using the actual platform mutex.

The renderer now loads the main-owned record through allowlisted operations. It migrates a valid legacy browser record only when no native record exists, using revision compare-and-swap; a competing migration is read back. Existing native preferences take precedence without parsing obsolete legacy bytes. Personal wording remains in its separate local renderer cache and never enters these requests. Invalid legacy content produces a generic recovery message without echoing its contents.

Saving indicators reflect pending operations. Preference controls retain their last durable value when native writes fail. A visible reload action reads the current authoritative record or retries a valid first migration. The local workspace cache still holds navigation, notifications and the explicitly interim local revision list; failure to update that cache after a native save is reported separately from failure to save preferences. Native protected-history controls and coupled two-process history/write overlap remain unfinished. The packaged candidate `bef71f766f3b96fe027b72309a082580a200b0fd` passed fresh-profile initialization, actual schedule/import/reset rejection and retry, and native-value readback after process restart. Existing populated legacy-cache migration remains covered by source-level transition tests, not yet by a packaged legacy fixture.

## Protected display name and bundled history runtime

The display-name store uses a typed semantic record and a separate numeric revision. Its only mutation API is the trusted expected-state callback used by protected history. Missing expectations, stale revisions, changed current values and extra fields are rejected; retrying an already-applied desired value is idempotent.

The runtime verifier reads the product-owned history runtime manifest and checks its complete file inventory, declared sizes and SHA-256 values, including auxiliary runtime files. Missing, extra, modified, linked and hard-linked files are rejected before returning an executable path. No PATH lookup is used. The explicit diagnostic data-directory route derives an isolated credential namespace in the main process; ordinary launches keep their original namespace. Namespace values and their derivation inputs are never returned to the renderer or included in exports. This is diagnostic isolation, not cross-computer history portability.

These modules have focused tests but are not yet wired to the protected-history screen. Synthetic runtime fixtures are never executed and do not prove the installed official runtime package.
