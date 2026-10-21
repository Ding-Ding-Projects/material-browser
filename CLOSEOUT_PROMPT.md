# Super Profiles continuation

Implement the approved Super Profiles plan in Ding-Ding-Projects/material-browser.
Preserve existing browser profiles and all unrelated host environments.

Preserved milestones: 07c8702c164379f494c773b6dd0395f541cc76e6 and
e92b352069a1b2884e15feaa01fe027b705a91bd are verified on
ai/feature/20261021-super-profiles. Subsequent task changes implement asynchronous
provisioning, durable progress/cancellation, separate backend archive histories,
selected guest installers, save-and-close, Sandbox guest controls and explicit
plaintext staging disposal. Preserve these changes before stopping.

Verified: current core 19 tests, Linux host 36 tests. Earlier source passed exact
Windows root Core/Host/Desktop/Docs builds, 28 native Windows host tests,
89 desktop tests and 17 isolated native stdio checks. The stdio check did not launch
guests. Source implementation and compilation do not prove guest runtime behavior.

Next: complete current-source UI polling and save-close controls, rebuild through
build.bat, run focused native checks and genuine hidden-desktop UI interaction.
Verify WSL terminal/browser/full-desktop setup, save and discard using only owned
distributions, and Windows Sandbox when available. Sandbox is absent on the selected
host. Do not change host features, power or login state to manufacture acceptance.

New source adds asynchronous save collection, operation-bound confirmation after lock,
locked stop/discard with redacted responses, host capability preflight and early WSL
integration configuration. Current desktop checks:95 passed, zero failed, one Windows-only
test skipped on Linux. The final host suite41 checks passed, including the capability preflight correction.
The exact current root Host build passed with exit0. Native runtime proof remains pending.
Two real WSL cycles at e92b352 proved synthetic workspace encrypted save/restore/discard,
with unrelated distributions unchanged. See docs/evidence/super-profiles/wsl-roundtrip-e92b352.json.
These canceled before graphical launch and used a separately verified base cache.
Earlier e92b352 root installer production and packaged native UI CRUD passed, but do not
prove these latest lifecycle changes. Default acquisition repair requires a fresh check;
continuous external guest-process health remains unfinished. Packaging, installation,
current-source screenshots, handbook deployment and default-branch integration
remain outstanding. Keep roadmap/handoff accurate and retain unverified states.
Projects discovery lacks read:project and is skipped without changing scopes.

Progress: https://github.com/Ding-Ding-Projects/material-browser/discussions/3

Latest followup: current-source native WSL launch stopped at strict isolation flag
readback, before browser provisioning, then owned stop/discard passed. A native
API-only probe proved WSL2 preserves its internal VM bit8 while host-integration
bits1/2/4 are zero. The narrow readback repair and negative regression passed,
and root Host build passed. Retry browser cycles against that rebuilt source.
Fresh77cb8cf packaged CRUD/consent/lock proof exists; minimum bilingual dark
760x580 navigation overflow was observed. CSS repair awaits same-tuple rebuild.
Root Desktop and portable Handbook installer builds completed for77cb8cf;
source-bound hashes are in docs/evidence/super-profiles/build-77cb8cf.json.
