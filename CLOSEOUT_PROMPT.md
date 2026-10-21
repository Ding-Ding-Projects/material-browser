# Super Profiles continuation

Implement the approved Super Profiles plan in Ding-Ding-Projects/material-browser.
Preserve existing browser profiles and all unrelated host environments.

Preserved milestone: 07c8702c164379f494c773b6dd0395f541cc76e6 is verified on
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

Save collection and guest-request reconciliation remain bounded synchronous work;
continuous external guest-process health remains unfinished. Packaging, installation,
current-source screenshots, handbook deployment and default-branch integration
remain outstanding. Keep roadmap/handoff accurate and retain unverified states.
Projects discovery lacks read:project and is skipped without changing scopes.

Progress: https://github.com/Ding-Ding-Projects/material-browser/discussions/3
