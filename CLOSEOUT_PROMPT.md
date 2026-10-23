# WSL password-manager sources continuation

```text
Objective: finish the KeePassXC pairing in source and push to main. Latest user direction: implement everything and push to main; no subagents; prefer an installed KeePassXC, otherwise KeePassXC inside WSL; Material Browser writes the per-profile browser registrations.

Repository: Ding-Ding-Projects/material-browser, branch main, Linux cloud session. This file records state up to its own commit; read the remote main reference for the final hash.

Implemented this pass: wslDistribution field with strict validation and the stdio wrapper script in core; host-side distribution listing, proxy verification, owned wrapper file and the WSL launch route; guest pairing for WSL Super Profile templates (core validation, staging, guest install with merged Firefox policy, provisioning wiring); detect method lists distributions; creation form distribution picker; Super Profile wizard guest pairing fields; docs for both routes; roadmap; regenerated desktop package-lock.json so npm ci succeeds. Earlier this session: installed-KeePassXC route, creation form, inspector, docs (a96d2ec) and the README gallery backlink (7035f1c).

Verified: cargo test core 28 and host 59 on Linux; desktop tsc clean; desktop tests 112; docs tests 6; rustfmt on touched files; publication scan green on every new or changed file except the pre-existing literal cat command in provisioning.rs, which the scanner matches against a private alias and which was already on main.

Unfinished: Windows build.bat and build-installer.bat; built creation-form and wizard captures; real WSL wrapper launch and guest provisioning with a KeePassXC package from the maintained lineage; extension connectivity; passkey behavior; Firefox registry registration; installer and installed update of the existing 0.1.0; remaining 150%/200% matrix cells; hosted documentation and offline handbook refresh.

Blockers: none on the source lane. Windows and WSL runtime verification cannot run on this Linux session.

Next safe steps: on the Windows host run the root build entrypoints, build or install KeePassXC from the maintained lineage inside a WSL distribution, pair a synthetic profile with both sources, confirm the enable prompt and KeePassXC-Browser connection, verify the Firefox policy and registry registration, capture inspected screenshots, then refresh hosted documentation. Keep scope fixed; no credential storage; no history rewriting.
```
