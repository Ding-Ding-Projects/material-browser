# Super Profiles

Super Profiles store reusable environment templates in the encrypted vault. They are separate
from ordinary browser profiles. Template changes and explicit save-back create immutable
revisions; stale writes are rejected rather than overwriting a newer revision.

## Create a template

Unlock the vault, open **Super Profiles**, and choose **Create Super Profile**. Give the
template a name, choose a browser engine and environment, then review its configuration.
Saving a template does not prove that the host can launch that environment. Read the actual
capability result before launching.

WSL templates offer terminal, Linux browser and desktop modes. A locally supplied root
filesystem archive requires a matching SHA-256 digest. Browser and desktop modes also need
the corresponding guest packages and display support. Windows browser binaries cannot run
as Linux browser binaries.

## Launch and save deliberately

Review the standard-identity explanation before launching. These environments do not promise
anonymity, stable identity, portable credentials or recognition by websites. Browser state is
kept separate when the backend, engine or base environment changes.

Use the session's actual returned state. Provisioning, a spawned process and a visually ready
desktop are different observations. A failed launch retains owned staging for recovery.
Never remove an unrelated WSL distribution to resolve a launch failure.

Explicit save-back requires a stopped browser and validated output. It creates a new encrypted
revision and preserves previous revisions. Restore selects an earlier revision and creates a
new current revision, so history remains available. Discard must destroy only the positively
identified owned session. Closing a Sandbox window directly can lose unexported changes.

## Storage and compatibility

Template metadata and saved archives use the existing vault encryption. Archive objects are
streamed in authenticated chunks rather than passing large payloads through renderer IPC.
Super Profiles are currently local-only and excluded from ordinary browser folder sync.
An interrupted import may leave unreachable encrypted objects, but must not publish an
incomplete revision. Existing browser profiles retain their original API and launch behavior.

## Verification status

The core has focused checks for locked-vault access, older metadata, validation, revision
conflicts, immutable restore, backend/engine isolation, multi-chunk encryption, tampered
objects and restart persistence. Source implementation is separate from native runtime proof.
Whole-template provisioning, all guest experiences, save-back, disposal, built-interface
accessibility and installer verification require their own source-bound acceptance evidence.
The roadmap and handoff retain outstanding work; this article is not a runtime receipt.
