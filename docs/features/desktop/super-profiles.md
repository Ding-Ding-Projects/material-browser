# Super Profiles

Super Profiles store reusable environment templates in the encrypted vault. They are separate
from ordinary browser profiles. Template changes and explicit save-back create immutable
revisions; stale writes are rejected rather than overwriting a newer revision.

## Create a template

Unlock the vault, open **Super Profiles**, and choose **Create Super Profile**. Give the
template a name, choose a browser engine and environment, then review its configuration.
Saving a template does not prove that the host can launch that environment. Read the actual
capability result before launching.

**Save progress** stores the current step and every backend configuration, selected path,
installer recipe, command and imported bookmark document in the encrypted vault. It keeps
the wizard open. After a restart, unlock the vault and edit the saved draft to resume its
step. Drafts cannot launch and create no guest resources. Completing **Save template** clears
the draft state. Repeated progress saves update the acknowledged immutable revision rather
than creating another template. Existing plaintext resume metadata is no longer written.

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

Session health is shown separately from lifecycle state. WSL observations use a bounded
stream created during the authorized launch; polling status does not execute a new guest
command. Readiness records require the owned session, launch nonce, increasing sequence and
fresh host receipt time. Terminal readiness requires the normal user's interactive PTY.
Desktop readiness requires its authenticated Xfce session and matching-display window manager.
These observations verify processes, not visible desktop pixels. Stale or missing observations
remain unknown, and restarting the host requires explicit recovery rather than reattachment.
Stop an active session before saving when its current readiness is unknown.

Full desktop mode provides browser and workspace entries. The browser entry uses the selected
engine with the same managed profile directory as browser mode. It does not silently import
the host's everyday browser profile.

Explicit save-back requires a stopped browser and validated output. It creates a new encrypted
revision and preserves previous revisions. Restore selects an earlier revision and creates a
new current revision, so history remains available. Discard must destroy only the positively
identified owned session. Closing a Sandbox window directly can lose unexported changes.

**Save back and close** first queues browser shutdown and collection of the selected workspace
and browser categories. Collection reports progress without holding the vault open. A collected
archive is not yet a saved revision. If the vault locks or the host restarts during collection,
unlock it and explicitly confirm that operation before encrypted finalization. A changed template
revision rejects finalization and retains the collected data for recovery. Stop and discard remain
available while locked, with private template metadata omitted from their responses.

The Sandbox guest includes explicit save-and-close and discard-and-close controls. Save-and-close
exports stopped-browser state and a complete manifest before asking the host to finalize it.
Closing the Sandbox window itself cannot export state that has already been destroyed.

## Portable bookmark documents

A template can store a user-selected neutral JSON bookmark document in its encrypted backend
configuration. The native API accepts `portableBookmarks` with this shape:

```json
{"version":1,"folderName":"Imported bookmarks","bookmarks":[{"name":"Example","url":"https://example.com/"}]}
```

Folders use `{"name":"Reference","children":[...]}` instead of `url`. Documents are limited
to64 KiB,500 entries, eight levels,256-character names and4096-character URLs. Unknown fields,
control characters, credentials, mixed folder/link entries and schemes other than HTTP(S) are
rejected. Validation makes no network requests and never discovers host browser directories.

The guest receives a generated `ManagedBookmarks` policy containing a separate read-only folder.
Existing editable bookmark files and restored browser state are not overwritten. Each backend
retains its own import, and immutable template revisions retain the associated document.
Removing an import affects the next fresh guest. Credentials and authenticated sessions are
outside this import format. The built wizard verified file input, replacement, removal, backend
separation and invalid UTF-8/lone-surrogate retention at source 50ddbbc. Separate pinned-browser
policy recognition passed for Linux Chromium and Firefox; Sandbox recognition and Chromium
import removal remain unverified.

## Storage and compatibility

Template metadata and saved archives use the existing vault encryption. Archive objects are
streamed in authenticated chunks rather than passing large payloads through renderer IPC.
Super Profiles are currently local-only and excluded from ordinary browser folder sync.
An interrupted import may leave unreachable encrypted objects, but must not publish an
incomplete revision. Existing browser profiles retain their original API and launch behavior.

WSL export omits only the transient root `browser/lock` marker. Literal anchored matching
preserves nested lock files and similarly named workspace files. Arbitrary links remain
invalid archive members. A forged or linked output cannot replace an encrypted revision.

## Verification status

The core has focused checks for locked-vault access, older metadata, validation, revision
conflicts, immutable restore, backend/engine isolation, multi-chunk encryption, tampered
objects and restart persistence. Source implementation is separate from native runtime proof.
Whole-template provisioning, all guest experiences, save-back, disposal, built-interface
accessibility and installer verification require their own source-bound acceptance evidence.
The roadmap and handoff retain outstanding work; this article is not a runtime receipt.

A [native WSL workspace roundtrip receipt](../../evidence/super-profiles/wsl-roundtrip-e92b352.json)
records two owned guest cycles against source `e92b352`. It proves synthetic workspace restoration,
encrypted save-back and exact owned-distro removal, with the unrelated distro inventory unchanged.
It used a separately verified base cache and canceled before graphical launch. It does not prove
the default download route, browser state, terminal UI, WSLg, desktop connection or Sandbox runtime.

The [Chromium roundtrip](../../evidence/super-profiles/chromium-roundtrip-0719755.json)
and [Firefox roundtrip](../../evidence/super-profiles/firefox-roundtrip-f1816d6.json)
separately verify synthetic browser local storage and workspace restoration across two fresh
owned guests. Both run as the normal guest user with browser sandboxing enabled. The Firefox
result also verifies successful export with its transient root lock marker present. These
headless browser runs do not establish graphical WSLg, terminal or full desktop readiness.

The [default base acquisition](../../evidence/super-profiles/default-acquisition-f1816d6.json)
started without a cached base or custom override, downloaded the pinned archive, verified its
checksum, completed setup and removed the exact owned guest. The [installer build receipt](../../evidence/super-profiles/build-f1816d6.json)
records successful root entrypoint production and package hashes. Package production does not
prove installation, accepted-channel update or every guest experience.


The [portable policy receipt](../../evidence/super-profiles/portable-policy-ac36bb9.json)
records actual pinned Firefox policy-service and Chromium policy-page recognition. Firefox
also saved editable bookmarks, removed the managed import and restored the editable bookmark
in a fresh guest. Sandbox policy recognition and Chromium import removal remain unverified.

The [repaired observer receipt](../../evidence/super-profiles/observer-1ce75f5.json) records
actual product readiness, exact managed-browser closure recovery and status polls that did not
wake a stopped guest. It uses guest-local virtual X, not graphical WSLg or a host desktop.
Concurrent sibling-owned guest changes are explicitly reconciled; raw inventory equality is
not claimed. The [native interface save receipt](../../evidence/super-profiles/native-ui-save-f1816d6.json)
records real cancellation, stopped workspace-only preview, asynchronous collection and saved
revision readback. That interface run did not decrypt or relaunch its new archive.

The [encrypted wizard receipt](../../evidence/super-profiles/wizard-50ddbbc.json) records
repeated progress saves, one template identity, revision advancement, resume after process
restart and actual vault unlock, strict file input and final completion. Its English/light
normal-size scope does not establish the full accessibility or scale matrix. The
[portable handbook runtime](../../evidence/super-profiles/handbook-runtime-50ddbbc.json)
separately records one-file launch, internal navigation and guide progress after reload.

The [credential command comparison](../../evidence/super-profiles/desktop-credential-path-8f010e5.json)
isolates bare executable resolution from the protected handoff. Using /usr/sbin/chpasswd
completed the real helper through DPAPI and connection-file creation. A bounded xrdp
identity/listener readiness loop now reaches the native RDP first-use prompt. That account-wide
consent remains a user decision. A separate native sender/PAM comparison proved and repaired
a CRLF mismatch with explicit LF delivery. These [desktop repair results](../../evidence/super-profiles/desktop-readiness-and-line-ending-3f4f73c.json)
do not establish authenticated Xfce, managed-browser interaction or desktop save/restore.
The [native test receipt](../../evidence/super-profiles/native-tests-4d81c91.json) records
56 Windows host tests and three Linux-focused protocol/path checks.
