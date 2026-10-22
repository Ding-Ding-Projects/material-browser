# Password-manager pairing continuation

```text
Objective: continue the Material Browser handoff. Latest user direction: no subagents; initialize the shared agent memory first; prefer an installed KeePassXC when present and otherwise run KeePassXC inside the WSL guest; Material Browser writes the per-profile browser registration itself.

Repository: Ding-Ding-Projects/material-browser, branch main, primary checkout on a Linux cloud session. This file records state up to its own commit; read the remote main reference for the final hash.

Implemented: passwordManager profile field with strict validation; installed KeePassXC detection (KeePassXC.Material and KeePassXC installer roots, Squirrel app-<version> layouts); per-profile Chromium native messaging manifest and external extension registration inside the profile user data directory; Firefox ExtensionSettings merge into the bundled distribution policies.json plus a per-user native messaging manifest and registry registration; passwordManager.detect method; optional password-manager section in profile creation with source, database mode, .kdbx picker, extension and passkeys switches defaulting on; inspector facts with redacted database name and a removal action; feature article, docs index, roadmap and wiki updates. The README links to the live evidence gallery (commit 7035f1c047d2a29eb3081e292a9ef778e2bdc9a4), with all eight live image hashes verified.

Verified: cargo test core 26 passed and host 57 passed on Linux; desktop tsc clean; desktop tests 112 passed; docs tests 112 passed; rustfmt on new modules; publication-language scan green on every changed file. Dependencies installed without touching lock files.

Unfinished: build.bat and build-installer.bat on the Windows host; built creation-form capture; real extension connectivity; passkey behavior; Firefox registry registration; installer and installed update of the existing 0.1.0; WSL guest KeePassXC provisioning from the maintained lineage (launch reports PASSWORD_MANAGER_WSL_UNAVAILABLE); desktop package-lock refresh (npm ci reports @types/react@19.3.0 missing, pre-existing); remaining 150%/200% matrix cells, hosted documentation and offline handbook refresh from the earlier handoff.

Blockers: none on the source lane. Windows-only verification cannot run on this Linux session.

Next safe steps: on the Windows host run the root build entrypoints, exercise the creation form with a synthetic database, confirm the Chromium enable prompt and KeePassXC-Browser connection, verify the Firefox policy and registry registration, capture inspected screenshots, then refresh the package lock and the hosted documentation. Keep scope fixed; no credential storage; no history rewriting.
```
