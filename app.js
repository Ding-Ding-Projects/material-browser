(()=>{var p={source:"09442f5b03c63136edb066ebcb8804a7fceec887",updatedAt:"2026-10-19T05:15:09.847Z",articles:[{id:"docs/architecture.md",title:"Architecture and integration contract",category:"architecture.md",html:`<h1 id="architecture-and-integration-contract">Architecture and integration contract</h1>
<h2 id="components">Components</h2>
<ul>
<li><code>crates/core</code>: encrypted vault, profile metadata, immutable snapshots, folder synchronization,
conflict preservation, and the shared command dispatcher.</li>
<li><code>crates/engine</code>: browser process ownership, explicit capabilities, launch modes and the
restricted snapshot protocol. Source acquisition and patch recipes live in <code>engines/</code>.</li>
<li><code>apps/desktop</code>: Electron main/preload and React/TypeScript renderer. The renderer talks only
to the typed preload bridge, never directly to browser processes or the filesystem.</li>
<li><code>apps/storage</code>: optional ciphertext-only container service and its browser dashboard.</li>
<li><code>crates/host</code>: Rust executable exposing the shared core through protected local IPC, CLI and
explicitly enabled paired LAN transport.</li>
</ul>
<h2 id="core-integration">Core integration</h2>
<p>The Rust library package is <code>material-browser-core</code> (import <code>material_browser_core</code>). It exports
<code>Manager::new(root: PathBuf) -&gt; Result&lt;Manager, CoreError&gt;</code> and
<code>Manager::execute(&amp;mut self, method: &amp;str, params: serde_json::Value) -&gt; Result&lt;serde_json::Value, CoreError&gt;</code>.
<code>CoreError</code> has public <code>code: String</code> and <code>message: String</code>, implements <code>Display</code> and <code>Error</code>,
and is serializable. Sensitive arguments must never be included in an error.</p>
<p>The local wire envelope is <code>{ "id": "request-id", "method": "profiles.list", "params": {} }</code>.
Replies are <code>{ "id": "request-id", "result": ... }</code> or
<code>{ "id": "request-id", "error": { "code": "...", "message": "..." } }</code>.
No passwords in argv, environment variables or logs. Native clients may supply secrets through
protected standard input or local IPC. The host owns long-running operation serialization.</p>
<p>Methods: <code>system.status</code>, <code>vault.create</code>, <code>vault.join</code>, <code>vault.unlock</code>, <code>vault.lock</code>, <code>vault.changePassword</code>,
<code>profiles.list</code>, <code>profiles.create</code>, <code>profiles.update</code>, <code>profiles.duplicate</code>, <code>profiles.remove</code>,
<code>profiles.snapshot</code>, <code>revisions.list</code>, <code>revisions.restore</code>, <code>sync.configure</code>, <code>sync.push</code>,
<code>sync.pull</code>, <code>sync.conflicts</code>, <code>sync.resolve</code>, <code>settings.get</code>, <code>settings.update</code>.
Profile ids are UUIDs. Profile fields use camelCase: <code>id</code>, <code>name</code>, <code>engine</code> (<code>chromium</code>/<code>firefox</code>),
<code>automation</code> (<code>off</code>/<code>selenium</code>/<code>puppeteer</code>), <code>identity</code>, <code>createdAt</code>, <code>updatedAt</code>, <code>sync</code>.
The host adds lifecycle methods <code>profiles.launch</code>, <code>profiles.stop</code>, <code>profiles.focus</code>,
<code>profiles.status</code> and automation/device/operation methods after capability verification.</p>
<h2 id="desktop-bridge">Desktop bridge</h2>
<p><code>window.materialBrowser.request(method, params)</code> resolves the result or throws a structured
error. <code>window.materialBrowser.chooseDirectory()</code> invokes a native folder picker.
<code>window.materialBrowser.onEvent(listener)</code> returns an unsubscribe function.
Use actual returned state. No seeded fake profiles, invented metrics or success toasts before
the underlying operation succeeds. Unsupported managed engine features have explicit reasons.</p>
<h2 id="data-and-safety">Data and safety</h2>
<p>The vault uses Argon2id and authenticated XChaCha20-Poly1305 encryption. Runtime keys remain in
the native process. Manifests and filenames are encrypted. A running browser uses an exclusive
local active directory. Snapshots and synchronization never read a personal/default browser
directory. Never copy a live browser directory and call it a consistent snapshot.</p>
<p>Automation defaults off, with no driver or debugging listener. Changing a running profile's
preference records a pending restart and never claims its effective mode changed immediately.
An engine without the required integration must return an explicit capability error.</p>
<p>Concurrent revisions preserve their parent relationships and both versions. Never merge browser
databases or use timestamps to overwrite a conflicting revision. Network storage sees only
ciphertext. HTTP administration has an explicit network-path tampering limitation.</p>
`,text:'# Architecture and integration contract\n\n## Components\n\n- `crates/core`: encrypted vault, profile metadata, immutable snapshots, folder synchronization,\n  conflict preservation, and the shared command dispatcher.\n- `crates/engine`: browser process ownership, explicit capabilities, launch modes and the\n  restricted snapshot protocol. Source acquisition and patch recipes live in `engines/`.\n- `apps/desktop`: Electron main/preload and React/TypeScript renderer. The renderer talks only\n  to the typed preload bridge, never directly to browser processes or the filesystem.\n- `apps/storage`: optional ciphertext-only container service and its browser dashboard.\n- `crates/host`: Rust executable exposing the shared core through protected local IPC, CLI and\n  explicitly enabled paired LAN transport.\n\n## Core integration\n\nThe Rust library package is `material-browser-core` (import `material_browser_core`). It exports\n`Manager::new(root: PathBuf) -> Result<Manager, CoreError>` and\n`Manager::execute(&mut self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, CoreError>`.\n`CoreError` has public `code: String` and `message: String`, implements `Display` and `Error`,\nand is serializable. Sensitive arguments must never be included in an error.\n\nThe local wire envelope is `{ "id": "request-id", "method": "profiles.list", "params": {} }`.\nReplies are `{ "id": "request-id", "result": ... }` or\n`{ "id": "request-id", "error": { "code": "...", "message": "..." } }`.\nNo passwords in argv, environment variables or logs. Native clients may supply secrets through\nprotected standard input or local IPC. The host owns long-running operation serialization.\n\nMethods: `system.status`, `vault.create`, `vault.join`, `vault.unlock`, `vault.lock`, `vault.changePassword`,\n`profiles.list`, `profiles.create`, `profiles.update`, `profiles.duplicate`, `profiles.remove`,\n`profiles.snapshot`, `revisions.list`, `revisions.restore`, `sync.configure`, `sync.push`,\n`sync.pull`, `sync.conflicts`, `sync.resolve`, `settings.get`, `settings.update`.\nProfile ids are UUIDs. Profile fields use camelCase: `id`, `name`, `engine` (`chromium`/`firefox`),\n`automation` (`off`/`selenium`/`puppeteer`), `identity`, `createdAt`, `updatedAt`, `sync`.\nThe host adds lifecycle methods `profiles.launch`, `profiles.stop`, `profiles.focus`,\n`profiles.status` and automation/device/operation methods after capability verification.\n\n## Desktop bridge\n\n`window.materialBrowser.request(method, params)` resolves the result or throws a structured\nerror. `window.materialBrowser.chooseDirectory()` invokes a native folder picker.\n`window.materialBrowser.onEvent(listener)` returns an unsubscribe function.\nUse actual returned state. No seeded fake profiles, invented metrics or success toasts before\nthe underlying operation succeeds. Unsupported managed engine features have explicit reasons.\n\n## Data and safety\n\nThe vault uses Argon2id and authenticated XChaCha20-Poly1305 encryption. Runtime keys remain in\nthe native process. Manifests and filenames are encrypted. A running browser uses an exclusive\nlocal active directory. Snapshots and synchronization never read a personal/default browser\ndirectory. Never copy a live browser directory and call it a consistent snapshot.\n\nAutomation defaults off, with no driver or debugging listener. Changing a running profile\'s\npreference records a pending restart and never claims its effective mode changed immediately.\nAn engine without the required integration must return an explicit capability error.\n\nConcurrent revisions preserve their parent relationships and both versions. Never merge browser\ndatabases or use timestamps to overwrite a conflicting revision. Network storage sees only\nciphertext. HTTP administration has an explicit network-path tampering limitation.\n\n'},{id:"docs/evidence/archive.md",title:"Earlier presentation archive",category:"evidence",html:`<h1 id="earlier-presentation-archive">Earlier presentation archive</h1>
<p>The earlier desktop and offline-handbook presentation is preserved below as source text. Its original claims and dates are historical, not relabelled as current verification.</p>
<p><a href="#/article/docs%2Fevidence%2Fdesktop%2Farchive.md">Historical desktop images and provenance</a> \xB7 <a href="#/article/docs%2Fevidence%2Fhandbook%2FREADME.md">Historical portable handbook images and provenance</a></p>
<pre><code class="language-markdown"># Material Browser

An encrypted browser-profile workspace for Windows, with optional self-hosted storage.

**Development status:** source implementation and focused local checks are in progress. Automated development installers are [published](https://github.com/Ding-Ding-Projects/material-browser/releases/tag/build-3-39195138374-1); the product is not release-ready and native installation acceptance remains incomplete.
Live snapshots, portable browser credentials and advanced identity controls require managed
browser integrations and must not be inferred from the interface or profile-file copying.

- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md)
- [Handoff](HANDOFF.md)
- [Continuation state](CLOSEOUT_PROMPT.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)
- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)

The encrypted core, desktop workspace, native control transports, interactive documentation,
storage service and portable hosting wizard have source implementations. Focused checks have
passed separately, but the combined application is not release-ready. The final native
lifecycle candidate passed six real hidden-desktop runs covering both engines locally and
over paired LAN, attached-client contention and an already-closed browser. It verifies exact
process ownership and complete owned-job exit before releasing the profile. Earlier
launcher-only stop results remain superseded. Native credential portability, consistent live
snapshots, advanced identity, published storage and two-computer proof remain incomplete.

The public handbook is deployed from source \`b9b892b\` and publication \`fa75573\`. All 21 bundled
documentation/wiki routes rendered in a real browser, and all eight delivered files matched
their published hashes. Guided examples, search, reading preferences and narrow navigation
were exercised. The repository homepage points to the exact deployed URL above. This bounded
documentation result does not establish complete required-feature acceptance.

The separate offline handbook was built and launched as one unsigned portable executable
at source \`1cd196b\`. All 21 routes, embedded assets and full-restart reading-state persistence
were verified locally. It has not yet been published as a downloadable release asset.


## Desktop capture evidence

These genuine captures show the packaged desktop at source \`7257d2238a6c6a495c84321a98bffc283450af9c\`, built through \`build-installer.bat -Component Desktop\`. They use a fresh synthetic vault and the real bundled native host on an isolated background desktop. The page viewport is explicitly emulated at 1280 by 1000, scale 1; this is not a claim of physical display-scale coverage.

![Initial encrypted vault setup](docs/evidence/desktop/onboarding.png)

![Profile workspace with saved automation preference](docs/evidence/desktop/automation-saved.png)

![Bilingual settings in dark theme](docs/evidence/desktop/settings-dark-bilingual.png)

The workflow created a vault and profile, skipped optional synchronization, saved automation from Off to Selenium, and changed language/theme through the interface. Effective automation remains unavailable: no managed browser was launched in this capture run. The updated-at value remains unavailable. Native installation, restart persistence, keyboard-only input, a complete scale/language matrix and overall accessibility acceptance remain unverified. [Evidence inventory](docs/evidence/desktop/inventory.json).

Settings now contains ten categories and 37 validated local preferences, with contextual help,
practice values, schedules, notifications, history/export workflows, installed-font discovery
and bounded external-editor handoff. Eleven reviewed state-transition repairs are integrated.
The native preference and protected-history GUI integration remains in progress. The
[required-feature inventory](docs/features/desktop/settings-acceptance.json) still records
65 desktop-applicable rows with none claimed comprehensively complete. Explanatory localization,
actual audio, deeper appearance controls, complete regex parity and the full layout matrix
remain among the explicit gaps.

## Portable handbook evidence

The single-file offline handbook was built and exercised at source
\`1cd196ba829f65d17c5a95bdf2ea5f6078f0009e\` through
\`build-installer.bat -Component DocsCompanion\`. These original page captures use an explicitly
emulated 1280 by 1000 viewport at scale 1, not a physical display-scale matrix.

![Offline handbook overview in English](docs/evidence/handbook/portable-home.png)

![Bundled handbook wiki and internal article links](docs/evidence/handbook/portable-wiki.png)

![Offline automation guide with saved reading progress and simulation](docs/evidence/handbook/portable-guide.png)

![Offline handbook reading settings in Cantonese and dark theme](docs/evidence/handbook/portable-settings.png)

All 21 bundled article/wiki routes rendered; guides, search and local preferences worked.
Separate runtime observations confirmed persistence across a full process restart. These images
do not establish updater behavior, installation, native browser operations or complete Settings
acceptance. The restart image is excluded because its diagnostic interval was not enabled.
See the [full evidence and limitations](docs/evidence/handbook/README.md),
[image inventory](docs/evidence/handbook/inventory.json) and
[public build/capture summary](docs/evidence/handbook/receipts.json).
</code></pre>
`,text:`# Earlier presentation archive

The earlier desktop and offline-handbook presentation is preserved below as source text. Its original claims and dates are historical, not relabelled as current verification.

[Historical desktop images and provenance](desktop/archive.md) \xB7 [Historical portable handbook images and provenance](handbook/README.md)

\`\`\`markdown
# Material Browser\r
\r
An encrypted browser-profile workspace for Windows, with optional self-hosted storage.\r
\r
**Development status:** source implementation and focused local checks are in progress. Automated development installers are [published](https://github.com/Ding-Ding-Projects/material-browser/releases/tag/build-3-39195138374-1); the product is not release-ready and native installation acceptance remains incomplete.\r
Live snapshots, portable browser credentials and advanced identity controls require managed\r
browser integrations and must not be inferred from the interface or profile-file copying.\r
\r
- [Architecture](docs/architecture.md)\r
- [Roadmap](ROADMAP.md)\r
- [Handoff](HANDOFF.md)\r
- [Continuation state](CLOSEOUT_PROMPT.md)\r
- [Windows build and release automation](docs/features/delivery/windows-automation.md)\r
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)\r
- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)\r
\r
The encrypted core, desktop workspace, native control transports, interactive documentation,\r
storage service and portable hosting wizard have source implementations. Focused checks have\r
passed separately, but the combined application is not release-ready. The final native\r
lifecycle candidate passed six real hidden-desktop runs covering both engines locally and\r
over paired LAN, attached-client contention and an already-closed browser. It verifies exact\r
process ownership and complete owned-job exit before releasing the profile. Earlier\r
launcher-only stop results remain superseded. Native credential portability, consistent live\r
snapshots, advanced identity, published storage and two-computer proof remain incomplete.\r
\r
The public handbook is deployed from source \`b9b892b\` and publication \`fa75573\`. All 21 bundled\r
documentation/wiki routes rendered in a real browser, and all eight delivered files matched\r
their published hashes. Guided examples, search, reading preferences and narrow navigation\r
were exercised. The repository homepage points to the exact deployed URL above. This bounded\r
documentation result does not establish complete required-feature acceptance.\r
\r
The separate offline handbook was built and launched as one unsigned portable executable\r
at source \`1cd196b\`. All 21 routes, embedded assets and full-restart reading-state persistence\r
were verified locally. It has not yet been published as a downloadable release asset.\r
\r
\r
## Desktop capture evidence\r
\r
These genuine captures show the packaged desktop at source \`7257d2238a6c6a495c84321a98bffc283450af9c\`, built through \`build-installer.bat -Component Desktop\`. They use a fresh synthetic vault and the real bundled native host on an isolated background desktop. The page viewport is explicitly emulated at 1280 by 1000, scale 1; this is not a claim of physical display-scale coverage.\r
\r
![Initial encrypted vault setup](docs/evidence/desktop/onboarding.png)\r
\r
![Profile workspace with saved automation preference](docs/evidence/desktop/automation-saved.png)\r
\r
![Bilingual settings in dark theme](docs/evidence/desktop/settings-dark-bilingual.png)\r
\r
The workflow created a vault and profile, skipped optional synchronization, saved automation from Off to Selenium, and changed language/theme through the interface. Effective automation remains unavailable: no managed browser was launched in this capture run. The updated-at value remains unavailable. Native installation, restart persistence, keyboard-only input, a complete scale/language matrix and overall accessibility acceptance remain unverified. [Evidence inventory](docs/evidence/desktop/inventory.json).\r
\r
Settings now contains ten categories and 37 validated local preferences, with contextual help,\r
practice values, schedules, notifications, history/export workflows, installed-font discovery\r
and bounded external-editor handoff. Eleven reviewed state-transition repairs are integrated.\r
The native preference and protected-history GUI integration remains in progress. The\r
[required-feature inventory](docs/features/desktop/settings-acceptance.json) still records\r
65 desktop-applicable rows with none claimed comprehensively complete. Explanatory localization,\r
actual audio, deeper appearance controls, complete regex parity and the full layout matrix\r
remain among the explicit gaps.\r
\r
## Portable handbook evidence\r
\r
The single-file offline handbook was built and exercised at source\r
\`1cd196ba829f65d17c5a95bdf2ea5f6078f0009e\` through\r
\`build-installer.bat -Component DocsCompanion\`. These original page captures use an explicitly\r
emulated 1280 by 1000 viewport at scale 1, not a physical display-scale matrix.\r
\r
![Offline handbook overview in English](docs/evidence/handbook/portable-home.png)\r
\r
![Bundled handbook wiki and internal article links](docs/evidence/handbook/portable-wiki.png)\r
\r
![Offline automation guide with saved reading progress and simulation](docs/evidence/handbook/portable-guide.png)\r
\r
![Offline handbook reading settings in Cantonese and dark theme](docs/evidence/handbook/portable-settings.png)\r
\r
All 21 bundled article/wiki routes rendered; guides, search and local preferences worked.\r
Separate runtime observations confirmed persistence across a full process restart. These images\r
do not establish updater behavior, installation, native browser operations or complete Settings\r
acceptance. The restart image is excluded because its diagnostic interval was not enabled.\r
See the [full evidence and limitations](docs/evidence/handbook/README.md),\r
[image inventory](docs/evidence/handbook/inventory.json) and\r
[public build/capture summary](docs/evidence/handbook/receipts.json).
\`\`\`
`},{id:"docs/evidence/desktop/README.md",title:"Current desktop evidence",category:"evidence",html:`<h1 id="current-desktop-evidence">Current desktop evidence</h1>
<p>Source: <code>5922074548f3a79f56b69c25b67826c0be3e209e</code>. Local package version: 0.1.1. The exact root build-installer.bat -Component Desktop completed with exit 0. The native executable is byte-identical to the <code>9011b28</code> host that passed all six bundled engine/mode launch-stop cases.</p>
<p>The images use synthetic data on a named hidden desktop through the Lowlevel route and one exact debugging target. Original PNG bytes were inspected, staged without transformation, hashed and read back. All three prospective observation intervals completed with zero console errors, page errors and unhandled exceptions. The six recorded owned processes were proven absent and the exact desktop closed afterward.</p>
<p><img src="assets/146d6457f95e6fd76ffe3ffb86df42989e77eb03b994138a0ab779ee26e3e761.png" alt="Initial encrypted vault setup in Material Browser 0.1.1" loading="lazy" /></p>
<p><img src="assets/2f4b30ea92cf7235f1c545630d21e431d54ffd70c350fd53400a2a3808b02e61.png" alt="Explicit standard-identity launch consent in Material Browser 0.1.1" loading="lazy" /></p>
<p><img src="assets/4e21d977863937507d4e8ecebbde9e5f9d986fb96a9f85c63ed76b99bffa0c4a.png" alt="Bilingual dark appearance settings in Material Browser 0.1.1" loading="lazy" /></p>
<p>The 1280 by 1000 viewport uses logical emulated scale 1. Capture dates and UTC timezone come from the producing observation receipts, not filenames or file timestamps. The build timestamp records observed package readiness before launch, with the separate installer completion receipt retained privately. No private vocabulary was imported and no real user data, credential or unrelated window is visible.</p>
<p>These images do not prove native installation/update, complete physical scale coverage, keyboard-only access, full localization, all feature contracts or current offline-handbook runtime acceptance. Minimum-viewport dialog observations are separate from full workspace layout acceptance.</p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/inventory.json">Inventory</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/receipts-0.1.1.json">Public receipt summary</a> \xB7 <a href="#/article/docs%2Fevidence%2Fdesktop%2Farchive.md">Historical desktop article and original images</a></p>
`,text:`# Current desktop evidence

Source: \`5922074548f3a79f56b69c25b67826c0be3e209e\`. Local package version: 0.1.1. The exact root build-installer.bat -Component Desktop completed with exit 0. The native executable is byte-identical to the \`9011b28\` host that passed all six bundled engine/mode launch-stop cases.

The images use synthetic data on a named hidden desktop through the Lowlevel route and one exact debugging target. Original PNG bytes were inspected, staged without transformation, hashed and read back. All three prospective observation intervals completed with zero console errors, page errors and unhandled exceptions. The six recorded owned processes were proven absent and the exact desktop closed afterward.

![Initial encrypted vault setup in Material Browser 0.1.1](onboarding-0.1.1.png)

![Explicit standard-identity launch consent in Material Browser 0.1.1](launch-consent-0.1.1.png)

![Bilingual dark appearance settings in Material Browser 0.1.1](settings-dark-bilingual-0.1.1.png)

The 1280 by 1000 viewport uses logical emulated scale 1. Capture dates and UTC timezone come from the producing observation receipts, not filenames or file timestamps. The build timestamp records observed package readiness before launch, with the separate installer completion receipt retained privately. No private vocabulary was imported and no real user data, credential or unrelated window is visible.

These images do not prove native installation/update, complete physical scale coverage, keyboard-only access, full localization, all feature contracts or current offline-handbook runtime acceptance. Minimum-viewport dialog observations are separate from full workspace layout acceptance.

[Inventory](inventory.json) \xB7 [Public receipt summary](receipts-0.1.1.json) \xB7 [Historical desktop article and original images](archive.md)
`},{id:"docs/evidence/desktop/archive.md",title:"Historical desktop evidence",category:"evidence",html:`<h1 id="historical-desktop-evidence">Historical desktop evidence</h1>
<p>The following article is retained from the earlier source7257d2238a6c6a495c84321a98bffc283450af9c evidence. It is historical and is not the current version0.1.1 presentation. Original PNG files and inventory identities remain unchanged.</p>
<h1 id="desktop-capture-evidence">Desktop capture evidence</h1>
<h2 id="verified-candidate">Verified candidate</h2>
<p>The images below were captured from the packaged desktop at source <code>7257d2238a6c6a495c84321a98bffc283450af9c</code> after the exact root <code>build-installer.bat -Component Desktop</code> completed successfully. The build ran from <code>2026-10-18T06:27:02.4686499Z</code> through <code>2026-10-18T06:28:26.6975690Z</code>.</p>
<p>The executable SHA-256 is <code>4fb75974bc9ff0d7e200c5bb4d4b06715a8cf987e12e350963c74cda8a6826a0</code>; the application archive is <code>54a7b6c27490140620bad37754f7282c78a2ce921eee226079c5e0d4aab252fe</code>; the bundled native host is <code>c0847da83f8f6cfce08f934520387790e2df399495d160af654351f76ef7264d</code>.</p>
<p>The captures use a newly created synthetic vault and profile, a named off-screen desktop, an exact single-page debugging target, and complete process ancestry validation. Page dimensions are 1280 by 1000 at explicitly emulated scale 1, not physical display-scale proof. Original PNG bytes were inspected, staged without transformation, independently hashed, read back and validated against the inventory and root README links.</p>
<h2 id="setup-and-productive-workspace">Setup and productive workspace</h2>
<p><img src="assets/7af317ca751cbad08313821107d22b11da8d302d21f2d777c55fd1f84fc35d9c.png" alt="Initial encrypted vault setup" loading="lazy" /></p>
<p>The real interface created the encrypted vault and one profile. Optional synchronization was skipped and completion opened the profile workspace. No host response was mocked.</p>
<p><img src="assets/0b60ceeadd1be9af130f7de71c4a9e5cf4a72a6ea3fc85ee6bc378b19158d253.png" alt="Profile workspace with saved automation preference" loading="lazy" /></p>
<p>The profile initially had automation Off. Selecting Selenium and saving updated the native host's stored profile, as observed after refresh. Effective mode remained unavailable because this run did not launch a managed browser. The image deliberately preserves that distinction.</p>
<h2 id="appearance">Appearance</h2>
<p><img src="assets/9a385b1ad9c40e05b1ecd476482691ec721493a682007e532fa4f6212c165350.png" alt="Bilingual settings in dark theme" loading="lazy" /></p>
<p>Language and theme were changed through their rendered controls. The measured dark field-label foreground was <code>rgb(196, 198, 208)</code> on <code>rgb(25, 28, 35)</code>, a contrast ratio of approximately 10.02:1. This measurement applies to that label and background, not the whole interface. Controls use the installed sans-serif stack rather than an unavailable font.</p>
<h2 id="verification-and-limits">Verification and limits</h2>
<p>Seven focused desktop security and vocabulary tests passed. The shutdown regression was also run against a private intentionally regressed fixture and failed on the original destroyed-window exception. The repaired packaged window closed normally; its root process and named desktop were subsequently absent. A closing debugging connection is not itself process-exit proof.</p>
<p>All three retained capture intervals reported zero observed console errors, unhandled exceptions and page errors. The layout receipt validated the profile grid, detail panel and automation panel against the actual package and capture hashes. These observations cover only their measured intervals, not startup history or native stderr.</p>
<p>The updated-at value remains unavailable. Complete display-scale/language coverage, native installation/update behavior, keyboard-only input, full localization, restart persistence and overall accessibility acceptance remain unverified. Earlier captures are retained privately as superseded observations; a native diagnostic containing a local path is excluded from publication. No release, engine automation execution or two-computer synchronization claim is made.</p>
<p>See <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/inventory.json">the machine-readable inventory</a> for exact image hashes and state tuples.</p>
`,text:`# Historical desktop evidence

The following article is retained from the earlier source7257d2238a6c6a495c84321a98bffc283450af9c evidence. It is historical and is not the current version0.1.1 presentation. Original PNG files and inventory identities remain unchanged.

# Desktop capture evidence\r
\r
## Verified candidate\r
\r
The images below were captured from the packaged desktop at source \`7257d2238a6c6a495c84321a98bffc283450af9c\` after the exact root \`build-installer.bat -Component Desktop\` completed successfully. The build ran from \`2026-10-18T06:27:02.4686499Z\` through \`2026-10-18T06:28:26.6975690Z\`.\r
\r
The executable SHA-256 is \`4fb75974bc9ff0d7e200c5bb4d4b06715a8cf987e12e350963c74cda8a6826a0\`; the application archive is \`54a7b6c27490140620bad37754f7282c78a2ce921eee226079c5e0d4aab252fe\`; the bundled native host is \`c0847da83f8f6cfce08f934520387790e2df399495d160af654351f76ef7264d\`.\r
\r
The captures use a newly created synthetic vault and profile, a named off-screen desktop, an exact single-page debugging target, and complete process ancestry validation. Page dimensions are 1280 by 1000 at explicitly emulated scale 1, not physical display-scale proof. Original PNG bytes were inspected, staged without transformation, independently hashed, read back and validated against the inventory and root README links.\r
\r
## Setup and productive workspace\r
\r
![Initial encrypted vault setup](onboarding.png)\r
\r
The real interface created the encrypted vault and one profile. Optional synchronization was skipped and completion opened the profile workspace. No host response was mocked.\r
\r
![Profile workspace with saved automation preference](automation-saved.png)\r
\r
The profile initially had automation Off. Selecting Selenium and saving updated the native host's stored profile, as observed after refresh. Effective mode remained unavailable because this run did not launch a managed browser. The image deliberately preserves that distinction.\r
\r
## Appearance\r
\r
![Bilingual settings in dark theme](settings-dark-bilingual.png)\r
\r
Language and theme were changed through their rendered controls. The measured dark field-label foreground was \`rgb(196, 198, 208)\` on \`rgb(25, 28, 35)\`, a contrast ratio of approximately 10.02:1. This measurement applies to that label and background, not the whole interface. Controls use the installed sans-serif stack rather than an unavailable font.\r
\r
## Verification and limits\r
\r
Seven focused desktop security and vocabulary tests passed. The shutdown regression was also run against a private intentionally regressed fixture and failed on the original destroyed-window exception. The repaired packaged window closed normally; its root process and named desktop were subsequently absent. A closing debugging connection is not itself process-exit proof.\r
\r
All three retained capture intervals reported zero observed console errors, unhandled exceptions and page errors. The layout receipt validated the profile grid, detail panel and automation panel against the actual package and capture hashes. These observations cover only their measured intervals, not startup history or native stderr.\r
\r
The updated-at value remains unavailable. Complete display-scale/language coverage, native installation/update behavior, keyboard-only input, full localization, restart persistence and overall accessibility acceptance remain unverified. Earlier captures are retained privately as superseded observations; a native diagnostic containing a local path is excluded from publication. No release, engine automation execution or two-computer synchronization claim is made.\r
\r
See [the machine-readable inventory](inventory.json) for exact image hashes and state tuples.\r
`},{id:"docs/evidence/handbook/README.md",title:"Portable handbook capture evidence",category:"evidence",html:`<h1 id="portable-handbook-capture-evidence">Portable handbook capture evidence</h1>
<h2 id="exact-candidate">Exact candidate</h2>
<p>These four images were captured from the real portable documentation companion at source
<code>1cd196ba829f65d17c5a95bdf2ea5f6078f0009e</code>. The exact production command was
<code>build-installer.bat -Component DocsCompanion</code>, which completed with exit code 0 from
<code>2026-10-18T07:39:22.0224037Z</code> to <code>2026-10-18T07:41:44.9510726Z</code>.</p>
<p>The unsigned <code>Material-Browser-Handbook-0.1.0-x64.exe</code> is 100494041 bytes, SHA-256
<code>dcdd08b18afb848cb6d6f8020abf43a86ea8d50026f00ee51b891243295e2f49</code>.
It was launched from a directory containing only that executable, with a new isolated reading
profile on a named off-screen desktop. The portable launcher extracted its bundled runtime
temporarily and removed that extraction after normal shutdown. No adjacent runtime folder was
used to supply the launch.</p>
<p>The capture viewport was explicitly emulated at <strong>1280 by 1000, scale 1</strong>. This is page-only
rendering evidence, not proof of physical display-scale coverage. The original PNG bytes were
inspected, staged without transformation and read back against their original SHA-256 values.
The later commit that records these images does not change their producing source identity.</p>
<h2 id="reading-overview-and-complete-wiki">Reading overview and complete wiki</h2>
<p><img src="assets/d72af2104bf4fca9cee5db7f41d01afaec4593f930ea1eaa22aa15f0bae919e2.png" alt="Offline handbook overview in English" loading="lazy" /></p>
<p>The overview provides guided reading tasks and visitor-owned progress. It does not perform
vault, browser, storage or other native product operations.</p>
<p><img src="assets/00a5ebd067339792a0a74266a2c339cfadbb61bc2fef0485279041c807506140.png" alt="Bundled handbook wiki and internal article links" loading="lazy" /></p>
<p>All 21 bundled article routes rendered, including every wiki article and the native automation
verification article. All eight embedded content files matched their bundle manifest, and all
three approved desktop images decoded. A separate real link activation opened the Getting
started article from the wiki home.</p>
<h2 id="guided-reading-and-local-preferences">Guided reading and local preferences</h2>
<p><img src="assets/ee4ff864ad45b26f6169153dae1dae75e818d05b035b5f5747cebaf7a9c4efff.png" alt="Offline automation guide with saved reading progress and simulation" loading="lazy" /></p>
<p>The guide retained its confirmed first reading step and resumed at the second step after reload.
The explanatory automation example changed its requested mode, then applied that mode only
after the simulated restart. These are documentation interactions, not native browser automation.</p>
<p><img src="assets/ae283e5e7f6d780192f90ef3b6a035a25ac22d1ebce2fe253a860ddfcfefbf79.png" alt="Offline handbook reading settings in Cantonese and dark theme" loading="lazy" /></p>
<p>Language and theme were changed through the rendered controls and survived reload. A separate
full-process restart confirmed that Cantonese, dark theme, reading progress, guide position,
the simulation state and regex-search preferences remained in the isolated reading profile.
The restart image is deliberately excluded from this four-image inventory because that run did
not enable its console/page-log observation interval. No missing diagnostic counts were inferred.</p>
<h2 id="security-observations-and-limits">Security observations and limits</h2>
<p>During the initial capture interval there were zero observed unhandled exceptions, console
errors and error-level page logs. The renderer exposed no Node globals or preload bridge.
An intentional external-link navigation was canceled, without an unexpected network request.
Separate runtime probes confirmed that a new window was denied and notification permission
returned denied. Both owned runtime launches closed normally, their debugging listener was
absent afterward, and their off-screen desktops closed. The isolated reading profile was retained.</p>
<p>This evidence does <strong>not</strong> establish updater behavior, native installation, native browser
capabilities, complete Settings functionality, a complete language/accessibility/display-scale
matrix, release publication or full product acceptance. The handbook retains the documented
required-feature gaps. The hosted documentation has separate source and deployment evidence;
these portable captures do not stand in for that verification.</p>
<p>See the <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/handbook/inventory.json">exact image inventory</a>, <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/handbook/receipts.json">public build and capture summary</a>,
and <a href="#/article/docs%2Ffeatures%2Fdocumentation%2FREADME.md">documentation delivery description</a>.
Full operational receipts remain private; public records omit local paths, window handles and
session identities.</p>
`,text:`# Portable handbook capture evidence\r
\r
## Exact candidate\r
\r
These four images were captured from the real portable documentation companion at source\r
\`1cd196ba829f65d17c5a95bdf2ea5f6078f0009e\`. The exact production command was\r
\`build-installer.bat -Component DocsCompanion\`, which completed with exit code 0 from\r
\`2026-10-18T07:39:22.0224037Z\` to \`2026-10-18T07:41:44.9510726Z\`.\r
\r
The unsigned \`Material-Browser-Handbook-0.1.0-x64.exe\` is 100494041 bytes, SHA-256\r
\`dcdd08b18afb848cb6d6f8020abf43a86ea8d50026f00ee51b891243295e2f49\`.\r
It was launched from a directory containing only that executable, with a new isolated reading\r
profile on a named off-screen desktop. The portable launcher extracted its bundled runtime\r
temporarily and removed that extraction after normal shutdown. No adjacent runtime folder was\r
used to supply the launch.\r
\r
The capture viewport was explicitly emulated at **1280 by 1000, scale 1**. This is page-only\r
rendering evidence, not proof of physical display-scale coverage. The original PNG bytes were\r
inspected, staged without transformation and read back against their original SHA-256 values.\r
The later commit that records these images does not change their producing source identity.\r
\r
## Reading overview and complete wiki\r
\r
![Offline handbook overview in English](portable-home.png)\r
\r
The overview provides guided reading tasks and visitor-owned progress. It does not perform\r
vault, browser, storage or other native product operations.\r
\r
![Bundled handbook wiki and internal article links](portable-wiki.png)\r
\r
All 21 bundled article routes rendered, including every wiki article and the native automation\r
verification article. All eight embedded content files matched their bundle manifest, and all\r
three approved desktop images decoded. A separate real link activation opened the Getting\r
started article from the wiki home.\r
\r
## Guided reading and local preferences\r
\r
![Offline automation guide with saved reading progress and simulation](portable-guide.png)\r
\r
The guide retained its confirmed first reading step and resumed at the second step after reload.\r
The explanatory automation example changed its requested mode, then applied that mode only\r
after the simulated restart. These are documentation interactions, not native browser automation.\r
\r
![Offline handbook reading settings in Cantonese and dark theme](portable-settings.png)\r
\r
Language and theme were changed through the rendered controls and survived reload. A separate\r
full-process restart confirmed that Cantonese, dark theme, reading progress, guide position,\r
the simulation state and regex-search preferences remained in the isolated reading profile.\r
The restart image is deliberately excluded from this four-image inventory because that run did\r
not enable its console/page-log observation interval. No missing diagnostic counts were inferred.\r
\r
## Security observations and limits\r
\r
During the initial capture interval there were zero observed unhandled exceptions, console\r
errors and error-level page logs. The renderer exposed no Node globals or preload bridge.\r
An intentional external-link navigation was canceled, without an unexpected network request.\r
Separate runtime probes confirmed that a new window was denied and notification permission\r
returned denied. Both owned runtime launches closed normally, their debugging listener was\r
absent afterward, and their off-screen desktops closed. The isolated reading profile was retained.\r
\r
This evidence does **not** establish updater behavior, native installation, native browser\r
capabilities, complete Settings functionality, a complete language/accessibility/display-scale\r
matrix, release publication or full product acceptance. The handbook retains the documented\r
required-feature gaps. The hosted documentation has separate source and deployment evidence;\r
these portable captures do not stand in for that verification.\r
\r
See the [exact image inventory](inventory.json), [public build and capture summary](receipts.json),\r
and [documentation delivery description](../../features/documentation/README.md).\r
Full operational receipts remain private; public records omit local paths, window handles and\r
session identities.\r
`},{id:"docs/evidence/storage-wizard/README.md",title:"Storage setup verification record",category:"evidence",html:`<h1 id="storage-setup-verification-record">Storage setup verification record</h1>
<p>Source: <code>815045eb1394addce3e96c5c8c857f82078c388d</code>.</p>
<p>Build entrypoint: <code>build-installer.bat -Component HostingWizard</code>, exit 0.</p>
<p>Output: <code>Material-Browser-Storage-Setup-0.1.0-x64.exe</code>, 100,321,184 bytes.
SHA-256: <code>6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5</code>.
Authenticode status: <code>NotSigned</code>.</p>
<h2 id="observed-behavior">Observed behavior</h2>
<ul>
<li>The actual portable executable launched on a named hidden desktop with an isolated profile.</li>
<li>The installed direct low-level tool performed the launch; a strict process-ancestry and single-page CDP helper drove renderer controls.</li>
<li>Next before a successful runtime check stayed on the first step and displayed a corrective message.</li>
<li>The actual Docker/Compose check reported unavailable runtime. No installation or successful setup was claimed.</li>
<li>Language and theme changes worked. A separate fresh process restored bilingual/light preferences from the same isolated profile and required a fresh runtime check.</li>
<li>The 720 \xD7 600 CSS viewport with scale 1.5 had no horizontal document overflow. It remained vertically scrollable.</li>
<li>Prospective console, exception and page-log observations reported zero errors during the bounded interaction intervals only. Startup and native stderr are not covered by those counts.</li>
<li>Both launch processes and their exact hidden desktops were absent after the owned renderer close action. Background Alt+F4 did not close the first launch; no PID termination was used.</li>
</ul>
<h2 id="remaining-evidence">Remaining evidence</h2>
<p>The local Docker daemon was unavailable. Successful readiness, configuration validation, later Back/Next actions, pull/start, cancellation, native folder browsing, actual LAN delivery and the full theme/language/scale matrix remain unverified.</p>
<p>Raw captures and private lifecycle receipts were retained outside the published inventory. Pixels were inspected and contained only setup UI. They are not promoted here because the run lacks a contemporaneous build-timing receipt required by the evidence promotion contract. No image was reconstructed or relabelled as accepted runtime evidence. Capture timing was measured by the CDP producer, but missing build timing remains missing.</p>
<p>The portable executable and generated runtime files remain excluded from source control. Release publication, remote image deployment and repository integration are separate verdicts.</p>
`,text:`# Storage setup verification record\r
\r
Source: \`815045eb1394addce3e96c5c8c857f82078c388d\`.\r
\r
Build entrypoint: \`build-installer.bat -Component HostingWizard\`, exit 0.\r
\r
Output: \`Material-Browser-Storage-Setup-0.1.0-x64.exe\`, 100,321,184 bytes.\r
SHA-256: \`6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5\`.\r
Authenticode status: \`NotSigned\`.\r
\r
## Observed behavior\r
\r
- The actual portable executable launched on a named hidden desktop with an isolated profile.\r
- The installed direct low-level tool performed the launch; a strict process-ancestry and single-page CDP helper drove renderer controls.\r
- Next before a successful runtime check stayed on the first step and displayed a corrective message.\r
- The actual Docker/Compose check reported unavailable runtime. No installation or successful setup was claimed.\r
- Language and theme changes worked. A separate fresh process restored bilingual/light preferences from the same isolated profile and required a fresh runtime check.\r
- The 720 \xD7 600 CSS viewport with scale 1.5 had no horizontal document overflow. It remained vertically scrollable.\r
- Prospective console, exception and page-log observations reported zero errors during the bounded interaction intervals only. Startup and native stderr are not covered by those counts.\r
- Both launch processes and their exact hidden desktops were absent after the owned renderer close action. Background Alt+F4 did not close the first launch; no PID termination was used.\r
\r
## Remaining evidence\r
\r
The local Docker daemon was unavailable. Successful readiness, configuration validation, later Back/Next actions, pull/start, cancellation, native folder browsing, actual LAN delivery and the full theme/language/scale matrix remain unverified.\r
\r
Raw captures and private lifecycle receipts were retained outside the published inventory. Pixels were inspected and contained only setup UI. They are not promoted here because the run lacks a contemporaneous build-timing receipt required by the evidence promotion contract. No image was reconstructed or relabelled as accepted runtime evidence. Capture timing was measured by the CDP producer, but missing build timing remains missing.\r
\r
The portable executable and generated runtime files remain excluded from source control. Release publication, remote image deployment and repository integration are separate verdicts.\r
`},{id:"docs/features/api/README.md",title:"Native command and control API",category:"features",html:`<h1 id="native-command-and-control-api">Native command and control API</h1>
<p>The native executable owns one <code>Manager</code>, one engine registry and one process supervisor. Use
an absolute application data directory. It does not inspect personal browser profiles.</p>
<h2 id="desktop-and-standard-input">Desktop and standard input</h2>
<pre><code class="language-text">material-browser.exe --data-dir C:\\MaterialBrowserData serve --stdio
</code></pre>
<p>Keep this process alive. Send one JSON object per line and read one reply per line:</p>
<pre><code class="language-json">{"id":"list-1","method":"profiles.list","params":{}}
</code></pre>
<p>Success is <code>{"id":"list-1","result":...}</code>. Failure is
<code>{"id":"list-1","error":{"code":"...","message":"..."}}</code>.
The maximum input line is 1 MiB. Malformed envelopes do not execute commands. Oversized input
closes the stream. There are no password arguments, secret environment variables or request logs.
Native standard input is a privileged channel, so do not expose it to an untrusted renderer.</p>
<h2 id="cli-and-local-daemon">CLI and local daemon</h2>
<pre><code class="language-text">material-browser.exe --data-dir C:\\MaterialBrowserData daemon
material-browser.exe --data-dir C:\\MaterialBrowserData status
material-browser.exe --data-dir C:\\MaterialBrowserData profiles list
material-browser.exe --data-dir C:\\MaterialBrowserData profiles create "Work" chromium
material-browser.exe --data-dir C:\\MaterialBrowserData profiles launch PROFILE_UUID
material-browser.exe --data-dir C:\\MaterialBrowserData profiles stop PROFILE_UUID
material-browser.exe --data-dir C:\\MaterialBrowserData vault create
material-browser.exe --data-dir C:\\MaterialBrowserData vault unlock
material-browser.exe --data-dir C:\\MaterialBrowserData vault lock
material-browser.exe --data-dir C:\\MaterialBrowserData call
</code></pre>
<p>Vault create/unlock/join commands read a JSON object with a <code>password</code> string from protected
standard input. Use a parent process with a private pipe and hidden password input. <code>call</code> reads a complete envelope from standard input,
including vault, sync and revision methods. Never place passwords in command arguments or pipes
saved to shell history. A running daemon retains the unlocked key between commands. Without a
daemon, a CLI invocation opens a short-lived host, so create/unlock state ends with that command.
For several operations without the daemon, use the persistent stdio process instead.</p>
<p>The daemon binds only <code>127.0.0.1</code> on an operating-system-selected port. It creates <code>api.json</code> in the
protected data directory containing the process id, URL and fresh bearer credential. The directory
has user-only access. Treat this descriptor as sensitive and never attach it to a support report.
CLI clients read it locally and never transmit its credential to a non-loopback address. A stale
descriptor produces a connection error. Confirm the recorded process has ended before removing it.</p>
<p>HTTP accepts only <code>POST /v1/call</code>, an exact <code>Host</code> authority, a bearer credential and a bounded
<code>Content-Length</code>. It rejects browser <code>Origin</code> headers, duplicate headers and transfer encoding.
It sets no CORS allowance. This is a native local API, not an API for websites. Requests are
serialized; a long vault operation can delay other operations. Parsing is isolated across at most
16 workers with an absolute five-second header/body deadline, so an incomplete connection does
not monopolize the accept loop. HTTP is not used on the LAN.
The OpenAPI document and Postman collection in this directory describe only this implemented route.</p>
<h2 id="methods-and-lifecycle-safety">Methods and lifecycle safety</h2>
<p>Trusted local engine bundles live under the data directory's <code>engines/chromium</code> and
<code>engines/firefox</code> directories. Each contains its verified <code>manifest.json</code>; optional <code>adapters.json</code>
maps <code>selenium</code> and/or <code>puppeteer</code> to the engine's <code>AdapterRuntime</code> configuration. It pins absolute
<code>node</code> and <code>helper</code> paths plus <code>nodeSha256</code>, <code>helperSha256</code> and <code>browserVersion</code>; Selenium also
pins <code>driver</code>, <code>driverSha256</code> and <code>driverVersion</code>. The host bounds this file to 64 KiB and the
engine verifies every hash and driver version. Never obtain this configuration from a renderer or
paired peer. Stock baseline bundles must declare advanced capabilities false and be launched
with the explicit <code>requireStableIdentity:false</code> choice; baseline automation proves no native
encryption, live snapshot or stable-identity integration.</p>
<p>The core methods in <a href="#/article/docs%2Farchitecture.md">the architecture contract</a> are available through all
native transports. The host adds <code>engines.list</code>, <code>profiles.status</code>, <code>profiles.launch</code> and
<code>profiles.stop</code>. A profile's stored automation preference supplies the launch mode. Automation
remains off unless explicitly configured. <code>requireStableIdentity</code> defaults to <code>true</code>; an explicitly
chosen basic launch may send <code>false</code>. An unverified native integration returns its capability
error. <code>profiles.focus</code> and <code>devices.list</code> currently return <code>CAPABILITY_UNAVAILABLE</code>.
<code>automation.endpoint</code> returns only a running, engine-owned endpoint whose effective mode matches
the stored preference. Turning automation off revokes this lookup immediately, including before
a pending restart. <code>automation.webdriver</code> accepts <code>id</code>, <code>verb</code> (<code>GET</code>, <code>POST</code>, <code>DELETE</code>), an optional
session-relative <code>path</code> and JSON <code>body</code>; the host supplies the owned WebDriver session id itself.
It cannot create another session or select another profile directory. Paths reject traversal,
encoding and query characters. Requests and replies have explicit size and time bounds.</p>
<p>Paired LAN sessions additionally support <code>tunnel.open</code>, <code>tunnel.exchange</code> and <code>tunnel.close</code> for
engine-owned CDP/BiDi endpoints. All require <code>id</code> and explicit method/profile grants. Open returns
<code>tunnelId</code>; exchange takes that id plus base64 <code>data</code> (at most 32 KiB decoded) and returns base64
data plus <code>eof</code>. Empty exchanges poll a response. Each peer connection owns at most four streams;
closing it drops every stream. Every chunk rechecks preference, effective endpoint and current
grants. WebDriver raw TCP tunnels are rejected, use the session-confined command instead. No
client-supplied host, port or URL is accepted.</p>
<p>The native forwarding client connects a standard Puppeteer client through that framed transport:</p>
<pre><code class="language-text">material-browser.exe --data-dir C:\\ClientIdentity lan-forward 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID
</code></pre>
<p>Create the client identity with <code>pair-key</code>, pair both public keys out of band, and grant the
client exact <code>tunnel.open</code>, <code>tunnel.exchange</code>, <code>tunnel.close</code> methods plus the profile id on the
server. The private key stays in the client's protected data directory. The command prints one
JSON line containing a local <code>ws://127.0.0.1:PORT/...</code> URL for <code>puppeteer.connect</code>'s
<code>browserWSEndpoint</code>. Keep it alive while connected. It binds only loopback, opens at most four
local streams and uses the paired encrypted transport for the LAN hop. Other local processes
under the same account can use that loopback endpoint, so run it only while needed. Browser
interoperability remains unverified until exercised with a matched engine bundle.</p>
<p>For an existing Selenium session, use the session-confined relay instead:</p>
<pre><code class="language-text">material-browser.exe --data-dir C:\\ClientIdentity lan-webdriver 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID
</code></pre>
<p>Grant <code>automation.endpoint</code> and <code>automation.webdriver</code> for that profile. This prints a loopback
HTTP URL and the owned <code>sessionId</code>. The example <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/examples/paired-selenium.py">paired-selenium.py</a>
attaches an ordinary Selenium client to that existing session. Creating a new session through the
relay is rejected. The relay accepts only the owned session path, exact loopback Host and bounded
JSON requests, with no browser-origin or transfer-encoding fallback. Host lifecycle operations
retain ownership, so examples do not quit the managed session behind the host's back.</p>
<p><code>operations.list</code> returns the latest 128 snapshot, restore, synchronization and password-change
attempts in this host process. Each has a random operation id, method, actual terminal state and
start/terminal events with Unix millisecond times. Successful object results include <code>operationId</code>.
These calls remain synchronous and serialized, so this is completion history rather than live
parallel progress. Records contain no request parameters, results or exception messages and do
not persist after host exit. LAN access to this global history requires an explicit method grant
and the all-profiles scope.</p>
<p>Snapshot, restore and removal check supervisor state and the engine's exclusive profile lock.
Caller-supplied <code>running</code> is overwritten with host-attested state. Locking the vault requires all
owned browser processes to stop and all active-directory locks to be available. A host failure can
leave browser processes alive; recovery must independently establish that they are stopped before
any destructive or snapshot operation. A source-only lock check does not prove crash recovery.</p>
<h2 id="explicitly-paired-lan-control">Explicitly paired LAN control</h2>
<p>Generate a native static key once:</p>
<pre><code class="language-text">material-browser.exe --data-dir C:\\MaterialBrowserData pair-key
</code></pre>
<p>The private key is written using create-new semantics to protected <code>lan-key</code>; only the base64
public key is printed. Exchange public keys through a trusted out-of-band channel. Never accept
a key copied from an untrusted WebSocket connection as authorization.</p>
<p>On Windows the host derives the current user's SID from the process identity, replaces the data
directory DACL with a protected user-only rule, and verifies the resulting rules. It separately
protects the local API descriptor and LAN identity file, including pre-existing explicit rules.
Create protected <code>lan-peers.json</code> locally with exact method and profile grants:</p>
<pre><code class="language-json">{"peers":[{"publicKey":"BASE64_32_BYTE_PEER_PUBLIC_KEY","methods":["profiles.list","profiles.status","profiles.stop"],"profileIds":["PROFILE_UUID"],"revoked":false}]}
</code></pre>
<p>Start with an explicit private IPv4 interface and nonzero port:</p>
<pre><code class="language-text">material-browser.exe --data-dir C:\\MaterialBrowserData lan 192.168.1.20:8788
</code></pre>
<p>This is native WebSocket transport protected by <code>Noise_KK_25519_ChaChaPoly_SHA256</code>, without TLS.
A client sends its paired public key as the first text frame, then the binary Noise KK handshake
message. The server sends the second handshake message. Both handshake application payloads are
empty. Only after the handshake completes may binary encrypted JSON envelopes execute. Each
request and reply occupies one Noise transport message, with a 65,535-byte ciphertext bound.
Plaintext commands, wrong keys, tampered records and replayed records are rejected. Noise provides
authentication and encryption; it does not conceal IP addresses, transport timing or traffic size.</p>
<p>Each method must appear verbatim in the peer grant. Profile methods and revision operations require
an explicitly granted profile id. <code>profiles.list</code> is filtered to those ids. Grants are reread before
execution and while connections idle. Setting <code>revoked</code> to <code>true</code> closes the peer's connection on
the next bounded check. Existing operations that have already begun are not rolled back.
The listener caps concurrent connections at 16 and applies handshake/read/write timeouts. Unknown
peers never reach the core. A native client must pin the server's out-of-band public key as well.
There is no unauthenticated LAN control or plaintext HTTP fallback.</p>
<p><code>lan-call PRIVATE_ADDRESS SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY</code> reads the same complete JSON
request envelope from standard input and prints one structured reply. Run it with the client
identity data directory to create/unlock the remote vault or manage remote profile lifecycle
through explicit grants. Passwords remain in the protected pipe, never arguments or environment.
The listener owns its own <code>Host</code>; do not start another stdio host for the same data directory.
Profile creation and duplication require both explicit method permission and the global <code>*</code>
profile scope because they mint new ids. An existing-profile grant cannot authorize either.</p>
<h2 id="verification-and-limitations">Verification and limitations</h2>
<p>Host unit tests cover message bounds, credential comparison, Noise tampering/replay/wrong-key
rejection, exact grants and private-address selection. Loopback HTTP and persistent stdio smoke
checks must be run against the exact built executable. Native/browser integration and LAN
reachability require separate runtime evidence. Unsupported engine capabilities remain unavailable.
The examples use the same stdio envelope, retain one process and place no password in argv.</p>
<p>CLI synchronization and revisions also have dedicated aliases:</p>
<pre><code class="language-text">material-browser.exe --data-dir C:\\MaterialBrowserData vault join C:\\SharedCiphertext
material-browser.exe --data-dir C:\\MaterialBrowserData sync configure C:\\SharedCiphertext
material-browser.exe --data-dir C:\\MaterialBrowserData sync push
material-browser.exe --data-dir C:\\MaterialBrowserData sync pull
material-browser.exe --data-dir C:\\MaterialBrowserData sync conflicts
material-browser.exe --data-dir C:\\MaterialBrowserData sync resolve PROFILE_UUID REVISION_UUID
material-browser.exe --data-dir C:\\MaterialBrowserData revisions list PROFILE_UUID
material-browser.exe --data-dir C:\\MaterialBrowserData revisions restore PROFILE_UUID REVISION_UUID
</code></pre>
<p>A LAN grant may explicitly name <code>"*"</code> in <code>profileIds</code> to authorize all profiles. This is required
for profile creation and vault, settings and synchronization methods, because those methods affect
the entire vault. It does not grant any method implicitly. <code>profiles.status</code> is filtered like
<code>profiles.list</code>. Use specific profile ids for a restricted operator and leave global methods out.</p>
`,text:`# Native command and control API\r
\r
The native executable owns one \`Manager\`, one engine registry and one process supervisor. Use\r
an absolute application data directory. It does not inspect personal browser profiles.\r
\r
## Desktop and standard input\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\MaterialBrowserData serve --stdio\r
\`\`\`\r
\r
Keep this process alive. Send one JSON object per line and read one reply per line:\r
\r
\`\`\`json\r
{"id":"list-1","method":"profiles.list","params":{}}\r
\`\`\`\r
\r
Success is \`{"id":"list-1","result":...}\`. Failure is\r
\`{"id":"list-1","error":{"code":"...","message":"..."}}\`.\r
The maximum input line is 1 MiB. Malformed envelopes do not execute commands. Oversized input\r
closes the stream. There are no password arguments, secret environment variables or request logs.\r
Native standard input is a privileged channel, so do not expose it to an untrusted renderer.\r
\r
## CLI and local daemon\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\MaterialBrowserData daemon\r
material-browser.exe --data-dir C:\\MaterialBrowserData status\r
material-browser.exe --data-dir C:\\MaterialBrowserData profiles list\r
material-browser.exe --data-dir C:\\MaterialBrowserData profiles create "Work" chromium\r
material-browser.exe --data-dir C:\\MaterialBrowserData profiles launch PROFILE_UUID\r
material-browser.exe --data-dir C:\\MaterialBrowserData profiles stop PROFILE_UUID\r
material-browser.exe --data-dir C:\\MaterialBrowserData vault create\r
material-browser.exe --data-dir C:\\MaterialBrowserData vault unlock\r
material-browser.exe --data-dir C:\\MaterialBrowserData vault lock\r
material-browser.exe --data-dir C:\\MaterialBrowserData call\r
\`\`\`\r
\r
Vault create/unlock/join commands read a JSON object with a \`password\` string from protected\r
standard input. Use a parent process with a private pipe and hidden password input. \`call\` reads a complete envelope from standard input,\r
including vault, sync and revision methods. Never place passwords in command arguments or pipes\r
saved to shell history. A running daemon retains the unlocked key between commands. Without a\r
daemon, a CLI invocation opens a short-lived host, so create/unlock state ends with that command.\r
For several operations without the daemon, use the persistent stdio process instead.\r
\r
The daemon binds only \`127.0.0.1\` on an operating-system-selected port. It creates \`api.json\` in the\r
protected data directory containing the process id, URL and fresh bearer credential. The directory\r
has user-only access. Treat this descriptor as sensitive and never attach it to a support report.\r
CLI clients read it locally and never transmit its credential to a non-loopback address. A stale\r
descriptor produces a connection error. Confirm the recorded process has ended before removing it.\r
\r
HTTP accepts only \`POST /v1/call\`, an exact \`Host\` authority, a bearer credential and a bounded\r
\`Content-Length\`. It rejects browser \`Origin\` headers, duplicate headers and transfer encoding.\r
It sets no CORS allowance. This is a native local API, not an API for websites. Requests are\r
serialized; a long vault operation can delay other operations. Parsing is isolated across at most\r
16 workers with an absolute five-second header/body deadline, so an incomplete connection does\r
not monopolize the accept loop. HTTP is not used on the LAN.\r
The OpenAPI document and Postman collection in this directory describe only this implemented route.\r
\r
## Methods and lifecycle safety\r
\r
Trusted local engine bundles live under the data directory's \`engines/chromium\` and\r
\`engines/firefox\` directories. Each contains its verified \`manifest.json\`; optional \`adapters.json\`\r
maps \`selenium\` and/or \`puppeteer\` to the engine's \`AdapterRuntime\` configuration. It pins absolute\r
\`node\` and \`helper\` paths plus \`nodeSha256\`, \`helperSha256\` and \`browserVersion\`; Selenium also\r
pins \`driver\`, \`driverSha256\` and \`driverVersion\`. The host bounds this file to 64 KiB and the\r
engine verifies every hash and driver version. Never obtain this configuration from a renderer or\r
paired peer. Stock baseline bundles must declare advanced capabilities false and be launched\r
with the explicit \`requireStableIdentity:false\` choice; baseline automation proves no native\r
encryption, live snapshot or stable-identity integration.\r
\r
The core methods in [the architecture contract](../../architecture.md) are available through all\r
native transports. The host adds \`engines.list\`, \`profiles.status\`, \`profiles.launch\` and\r
\`profiles.stop\`. A profile's stored automation preference supplies the launch mode. Automation\r
remains off unless explicitly configured. \`requireStableIdentity\` defaults to \`true\`; an explicitly\r
chosen basic launch may send \`false\`. An unverified native integration returns its capability\r
error. \`profiles.focus\` and \`devices.list\` currently return \`CAPABILITY_UNAVAILABLE\`.\r
\`automation.endpoint\` returns only a running, engine-owned endpoint whose effective mode matches\r
the stored preference. Turning automation off revokes this lookup immediately, including before\r
a pending restart. \`automation.webdriver\` accepts \`id\`, \`verb\` (\`GET\`, \`POST\`, \`DELETE\`), an optional\r
session-relative \`path\` and JSON \`body\`; the host supplies the owned WebDriver session id itself.\r
It cannot create another session or select another profile directory. Paths reject traversal,\r
encoding and query characters. Requests and replies have explicit size and time bounds.\r
\r
Paired LAN sessions additionally support \`tunnel.open\`, \`tunnel.exchange\` and \`tunnel.close\` for\r
engine-owned CDP/BiDi endpoints. All require \`id\` and explicit method/profile grants. Open returns\r
\`tunnelId\`; exchange takes that id plus base64 \`data\` (at most 32 KiB decoded) and returns base64\r
data plus \`eof\`. Empty exchanges poll a response. Each peer connection owns at most four streams;\r
closing it drops every stream. Every chunk rechecks preference, effective endpoint and current\r
grants. WebDriver raw TCP tunnels are rejected, use the session-confined command instead. No\r
client-supplied host, port or URL is accepted.\r
\r
The native forwarding client connects a standard Puppeteer client through that framed transport:\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\ClientIdentity lan-forward 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID\r
\`\`\`\r
\r
Create the client identity with \`pair-key\`, pair both public keys out of band, and grant the\r
client exact \`tunnel.open\`, \`tunnel.exchange\`, \`tunnel.close\` methods plus the profile id on the\r
server. The private key stays in the client's protected data directory. The command prints one\r
JSON line containing a local \`ws://127.0.0.1:PORT/...\` URL for \`puppeteer.connect\`'s\r
\`browserWSEndpoint\`. Keep it alive while connected. It binds only loopback, opens at most four\r
local streams and uses the paired encrypted transport for the LAN hop. Other local processes\r
under the same account can use that loopback endpoint, so run it only while needed. Browser\r
interoperability remains unverified until exercised with a matched engine bundle.\r
\r
For an existing Selenium session, use the session-confined relay instead:\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\ClientIdentity lan-webdriver 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID\r
\`\`\`\r
\r
Grant \`automation.endpoint\` and \`automation.webdriver\` for that profile. This prints a loopback\r
HTTP URL and the owned \`sessionId\`. The example [paired-selenium.py](../../../examples/paired-selenium.py)\r
attaches an ordinary Selenium client to that existing session. Creating a new session through the\r
relay is rejected. The relay accepts only the owned session path, exact loopback Host and bounded\r
JSON requests, with no browser-origin or transfer-encoding fallback. Host lifecycle operations\r
retain ownership, so examples do not quit the managed session behind the host's back.\r
\r
\`operations.list\` returns the latest 128 snapshot, restore, synchronization and password-change\r
attempts in this host process. Each has a random operation id, method, actual terminal state and\r
start/terminal events with Unix millisecond times. Successful object results include \`operationId\`.\r
These calls remain synchronous and serialized, so this is completion history rather than live\r
parallel progress. Records contain no request parameters, results or exception messages and do\r
not persist after host exit. LAN access to this global history requires an explicit method grant\r
and the all-profiles scope.\r
\r
Snapshot, restore and removal check supervisor state and the engine's exclusive profile lock.\r
Caller-supplied \`running\` is overwritten with host-attested state. Locking the vault requires all\r
owned browser processes to stop and all active-directory locks to be available. A host failure can\r
leave browser processes alive; recovery must independently establish that they are stopped before\r
any destructive or snapshot operation. A source-only lock check does not prove crash recovery.\r
\r
## Explicitly paired LAN control\r
\r
Generate a native static key once:\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\MaterialBrowserData pair-key\r
\`\`\`\r
\r
The private key is written using create-new semantics to protected \`lan-key\`; only the base64\r
public key is printed. Exchange public keys through a trusted out-of-band channel. Never accept\r
a key copied from an untrusted WebSocket connection as authorization.\r
\r
On Windows the host derives the current user's SID from the process identity, replaces the data\r
directory DACL with a protected user-only rule, and verifies the resulting rules. It separately\r
protects the local API descriptor and LAN identity file, including pre-existing explicit rules.\r
Create protected \`lan-peers.json\` locally with exact method and profile grants:\r
\r
\`\`\`json\r
{"peers":[{"publicKey":"BASE64_32_BYTE_PEER_PUBLIC_KEY","methods":["profiles.list","profiles.status","profiles.stop"],"profileIds":["PROFILE_UUID"],"revoked":false}]}\r
\`\`\`\r
\r
Start with an explicit private IPv4 interface and nonzero port:\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\MaterialBrowserData lan 192.168.1.20:8788\r
\`\`\`\r
\r
This is native WebSocket transport protected by \`Noise_KK_25519_ChaChaPoly_SHA256\`, without TLS.\r
A client sends its paired public key as the first text frame, then the binary Noise KK handshake\r
message. The server sends the second handshake message. Both handshake application payloads are\r
empty. Only after the handshake completes may binary encrypted JSON envelopes execute. Each\r
request and reply occupies one Noise transport message, with a 65,535-byte ciphertext bound.\r
Plaintext commands, wrong keys, tampered records and replayed records are rejected. Noise provides\r
authentication and encryption; it does not conceal IP addresses, transport timing or traffic size.\r
\r
Each method must appear verbatim in the peer grant. Profile methods and revision operations require\r
an explicitly granted profile id. \`profiles.list\` is filtered to those ids. Grants are reread before\r
execution and while connections idle. Setting \`revoked\` to \`true\` closes the peer's connection on\r
the next bounded check. Existing operations that have already begun are not rolled back.\r
The listener caps concurrent connections at 16 and applies handshake/read/write timeouts. Unknown\r
peers never reach the core. A native client must pin the server's out-of-band public key as well.\r
There is no unauthenticated LAN control or plaintext HTTP fallback.\r
\r
\`lan-call PRIVATE_ADDRESS SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY\` reads the same complete JSON\r
request envelope from standard input and prints one structured reply. Run it with the client\r
identity data directory to create/unlock the remote vault or manage remote profile lifecycle\r
through explicit grants. Passwords remain in the protected pipe, never arguments or environment.\r
The listener owns its own \`Host\`; do not start another stdio host for the same data directory.\r
Profile creation and duplication require both explicit method permission and the global \`*\`\r
profile scope because they mint new ids. An existing-profile grant cannot authorize either.\r
\r
## Verification and limitations\r
\r
Host unit tests cover message bounds, credential comparison, Noise tampering/replay/wrong-key\r
rejection, exact grants and private-address selection. Loopback HTTP and persistent stdio smoke\r
checks must be run against the exact built executable. Native/browser integration and LAN\r
reachability require separate runtime evidence. Unsupported engine capabilities remain unavailable.\r
The examples use the same stdio envelope, retain one process and place no password in argv.\r
\r
CLI synchronization and revisions also have dedicated aliases:\r
\r
\`\`\`text\r
material-browser.exe --data-dir C:\\MaterialBrowserData vault join C:\\SharedCiphertext\r
material-browser.exe --data-dir C:\\MaterialBrowserData sync configure C:\\SharedCiphertext\r
material-browser.exe --data-dir C:\\MaterialBrowserData sync push\r
material-browser.exe --data-dir C:\\MaterialBrowserData sync pull\r
material-browser.exe --data-dir C:\\MaterialBrowserData sync conflicts\r
material-browser.exe --data-dir C:\\MaterialBrowserData sync resolve PROFILE_UUID REVISION_UUID\r
material-browser.exe --data-dir C:\\MaterialBrowserData revisions list PROFILE_UUID\r
material-browser.exe --data-dir C:\\MaterialBrowserData revisions restore PROFILE_UUID REVISION_UUID\r
\`\`\`\r
\r
A LAN grant may explicitly name \`"*"\` in \`profileIds\` to authorize all profiles. This is required\r
for profile creation and vault, settings and synchronization methods, because those methods affect\r
the entire vault. It does not grant any method implicitly. \`profiles.status\` is filtered like\r
\`profiles.list\`. Use specific profile ids for a restricted operator and leave global methods out.\r
`},{id:"docs/features/delivery/README.md",title:"Build and release delivery",category:"features",html:`<h1 id="build-and-release-delivery">Build and release delivery</h1>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fwindows-automation.md">Windows automation</a>: triggers, toolchain inventory, installer delivery and evidence limits.</li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fbundled-engines.md">Bundled browser engines</a>: pinned offline browser, driver and automation payloads.</li>
</ul>
<p>This category does not expose an HTTP API, so no Postman collection applies.</p>
`,text:`# Build and release delivery

- [Windows automation](windows-automation.md): triggers, toolchain inventory, installer delivery and evidence limits.
- [Bundled browser engines](bundled-engines.md): pinned offline browser, driver and automation payloads.

This category does not expose an HTTP API, so no Postman collection applies.
`},{id:"docs/features/delivery/bundled-engines.md",title:"Browser engines bundled in the installer",category:"features",html:`<h1 id="browser-engines-bundled-in-the-installer">Browser engines bundled in the installer</h1>
<h2 id="contents-and-verified-acquisition">Contents and verified acquisition</h2>
<p>The desktop installer carries full Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching ChromeDriver, geckodriver 0.37.1, Node 26.4.0 and locked Selenium/Puppeteer dependencies. Browsers do not need a separate runtime download after installation.</p>
<p>The five official archives are pinned by URL, byte count, SHA-256 and complete extracted file inventories in engines/runtime/browser-binaries.lock.json. Acquisition rejects archive traversal, link entries, duplicate paths and extracted inventory differences. Production adapter dependencies come from their npm lock without install scripts. Downloads and staging are reusable local build data.</p>
<h2 id="build-and-relocation">Build and relocation</h2>
<p>The exact root build.bat stages resources/engines; build-installer.bat packages it with the native host. Complete browser directories remain outside the application archive. The desktop passes the separate engine root to its stdio host, and standalone native startup can discover adjacent engines.</p>
<p>Manifest and adapter paths stay inside their canonical bundle roots. Hash verification and process ownership retain canonical identities. At external-runtime boundaries, an ordinary absolute drive/UNC spelling must round-trip to exactly the same canonical path. Device namespaces, relative paths, unrepresentable text and changed identities fail closed. This avoids Node 26.4.0 rejecting extended helper filenames before executing the adapter. UNC construction is tested; execution on a real UNC share remains unverified.</p>
<h2 id="runtime-proof-and-limitations">Runtime proof and limitations</h2>
<p>The packaged native host at source 5922074548f3a79f56b69c25b67826c0be3e209e passed all six local combinations: Chromium and Firefox in Off, Selenium and Puppeteer modes. Each launch returned the exact expected engine version and each normal stop left zero active profiles. Off rejected endpoint access. Both Selenium and both Puppeteer clients navigated a synthetic data document and returned its exact title. Vault lock/unlock succeeded after all stops; the host exited with code 0 and owned processes/desktops were proven absent.</p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/bundled-runtime-0.1.1.json">Machine-readable runtime summary</a> and <a href="#/article/docs%2Fevidence%2Fdesktop%2FREADME.md">current desktop evidence</a> retain the scope and hashes. These results are local stdio proof. Paired LAN, attached-client contention and already-closed-browser behavior have separate earlier source-bound observations; this run does not reclassify them as current proof.</p>
<p>Standard-identity launch requires an explicit per-launch choice. Stock engines do not enforce saved advanced identity metadata, portable credential encryption or consistent live snapshots. Those capability flags remain false. Native installer installation/update, two-computer restoration and the full physical-scale matrix remain unverified.</p>
<h2 id="licenses">Licenses</h2>
<p>The package retains vendor notices/source links, Chromium's internal credits, Firefox about:license, driver notices, Node licensing and individual npm package notices. Chromium is described accurately as a development snapshot, not a stable release or a product-patched browser.</p>
`,text:`# Browser engines bundled in the installer

## Contents and verified acquisition

The desktop installer carries full Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching ChromeDriver, geckodriver 0.37.1, Node 26.4.0 and locked Selenium/Puppeteer dependencies. Browsers do not need a separate runtime download after installation.

The five official archives are pinned by URL, byte count, SHA-256 and complete extracted file inventories in engines/runtime/browser-binaries.lock.json. Acquisition rejects archive traversal, link entries, duplicate paths and extracted inventory differences. Production adapter dependencies come from their npm lock without install scripts. Downloads and staging are reusable local build data.

## Build and relocation

The exact root build.bat stages resources/engines; build-installer.bat packages it with the native host. Complete browser directories remain outside the application archive. The desktop passes the separate engine root to its stdio host, and standalone native startup can discover adjacent engines.

Manifest and adapter paths stay inside their canonical bundle roots. Hash verification and process ownership retain canonical identities. At external-runtime boundaries, an ordinary absolute drive/UNC spelling must round-trip to exactly the same canonical path. Device namespaces, relative paths, unrepresentable text and changed identities fail closed. This avoids Node 26.4.0 rejecting extended helper filenames before executing the adapter. UNC construction is tested; execution on a real UNC share remains unverified.

## Runtime proof and limitations

The packaged native host at source 5922074548f3a79f56b69c25b67826c0be3e209e passed all six local combinations: Chromium and Firefox in Off, Selenium and Puppeteer modes. Each launch returned the exact expected engine version and each normal stop left zero active profiles. Off rejected endpoint access. Both Selenium and both Puppeteer clients navigated a synthetic data document and returned its exact title. Vault lock/unlock succeeded after all stops; the host exited with code 0 and owned processes/desktops were proven absent.

[Machine-readable runtime summary](../../evidence/desktop/bundled-runtime-0.1.1.json) and [current desktop evidence](../../evidence/desktop/README.md) retain the scope and hashes. These results are local stdio proof. Paired LAN, attached-client contention and already-closed-browser behavior have separate earlier source-bound observations; this run does not reclassify them as current proof.

Standard-identity launch requires an explicit per-launch choice. Stock engines do not enforce saved advanced identity metadata, portable credential encryption or consistent live snapshots. Those capability flags remain false. Native installer installation/update, two-computer restoration and the full physical-scale matrix remain unverified.

## Licenses

The package retains vendor notices/source links, Chromium's internal credits, Firefox about:license, driver notices, Node licensing and individual npm package notices. Chromium is described accurately as a development snapshot, not a stable release or a product-patched browser.
`},{id:"docs/features/delivery/windows-automation.md",title:"Windows build and release automation",category:"features",html:`<h1 id="windows-build-and-release-automation">Windows build and release automation</h1>
<p>The <code>Windows build and release</code> workflow runs for every branch push and manual dispatch.
Tag events are excluded to prevent release recursion. Each successful run publishes one
normal release with an immutable <code>build-&lt;run-number&gt;-&lt;run-id&gt;-&lt;attempt&gt;</code> tag targeting the
exact source commit. Development builds do not update the accepted latest-release channel.</p>
<h2 id="build-inventory">Build inventory</h2>
<p>The single <code>windows-release</code> job uses the pinned <code>windows-2025</code> x64 hosted image.
Repository runner discovery returned no self-hosted runners; organization runner discovery
was unavailable to the configuring account. No unavailable local label is required.</p>
<p>The image supplies PowerShell, Git, GitHub CLI and the Visual Studio C++ build tools/Windows
SDK used by Rust's MSVC linker. Pinned setup actions install Node.js 26.4.0 and Rust 1.96.1.
The existing entrypoints install locked npm dependencies, acquire the hash-verified portable
history runtime and invoke Cargo. The workflow invokes <code>build-installer.bat -Component Desktop</code>
and <code>build-installer.bat -Component DocsCompanion</code>; those invoke the real <code>build.bat</code>.
The same entrypoint now stages pinned standard Chromium/Firefox binaries, drivers, portable
Node and locked automation dependencies for inclusion in the installer. Product-patched native
source builds and optional storage deployment remain outside this workflow. See the separate
<a href="#/article/docs%2Ffeatures%2Fdelivery%2Fbundled-engines.md">bundled-engine guide</a> for versions and unsupported capabilities.</p>
<p>The desktop bundles using <code>build:bundle</code> in automation. Normal local <code>build</code> retains its
TypeScript check. No tests, lint or standalone type checks run in Actions. A release can
therefore ship from source whose local checks would fail. Packaging success is not runtime
or installation acceptance.</p>
<h2 id="outputs-and-authentication">Outputs and authentication</h2>
<p>The desktop executable, application window, Squirrel setup and portable handbook use the
checked-in browser/globe icon in <code>apps/desktop/assets</code>. The editable SVG and reproducible
Windows drawing script <code>scripts/generate-icon.ps1</code> accompany PNG and multi-resolution ICO
outputs (16 through 256 pixels). Handbook executable resources are edited without signing.
Its packager has automatic publication explicitly disabled; only the release helper publishes.</p>
<p>Release assets include the unsigned Squirrel.Windows installer, <code>RELEASES</code>, full package,
any produced delta packages, the single-file offline handbook and a SHA-256/size inventory.
Unsigned executables can show unknown-publisher or SmartScreen warnings.
Publication reads the release back and checks its normal classification, exact source tag,
asset names and sizes. Notes record actual workflow start and publication-readback timing.
No signature or installed-update verification is claimed.</p>
<p>API authentication uses the first available Actions secret from <code>RELEASE_TOKEN</code>, <code>ORG_TOKEN</code>
and <code>GITHUB_TOKEN</code>. Secrets are never stored in the source tree or release assets. Checkout
does not persist authentication. There is no pull-request trigger executing untrusted code
with publication credentials.</p>
<p>Safe installer outputs and run metadata are retained for seven days even after earlier
failure. Collection/upload failure does not replace the build's original outcome. Source,
dependency directories, caches and credentials are excluded from upload paths.</p>
<h2 id="operation-and-recovery">Operation and recovery</h2>
<p>Use the Actions page's <strong>Run workflow</strong> control or <code>gh workflow run release.yml</code>.
Inspect the failing step before rerunning. A rerun gets a new attempt tag; it never overwrites
the previous tag or assets. Build, packaging or publication failure produces a failed run,
not a fabricated installer. Native UI, two-computer restoration and installation checks
remain separate local acceptance work.</p>
<p>Run 39195138374 verified the original desktop/handbook workflow and published its expected
assets. Fresh-image completeness for the newly added browser bundles remains pending.
The dedicated portable
build interface and storage hosting wizard are not delivered by this workflow yet.</p>
<p>The publisher stages explicit safe asset filenames before uploading and rejects collisions;
GitHub can otherwise rewrite a packaging filename containing spaces. The first hosted desktop
and handbook packages were built successfully, but their initial publication readback exposed
this difference. The local desktop installer build and embedded application/setup icon
inspection also passed. Native installation remains separate unverified acceptance.</p>
<h2 id="bounded-publication-follow-up">Bounded publication follow-up</h2>
<p>Run 39198295866 built the bundled-browser installer and published normal release
build-5-39198295866-1. The next publisher uploads setup first, then each remaining asset
separately. Every transfer is smaller than 1,400,000,000 bytes and must pass immediate name,
byte-count and SHA-256 digest readback. A partial publication returns failure.</p>
<h2 id="upgrade-versioning">Upgrade versioning</h2>
<p>Local source now uses package version0.1.1. Hosted builds stamp both desktop and handbook
manifests and their lock metadata to0.1.&lt;workflow run number&gt;, before invoking the retained
entrypoints. This gives the existing0.1.0 installation a normal newer-version upgrade path.
The desktop version label comes from its actual package manifest. Dependency resolutions stay
unchanged. A local fixture verified metadata synchronization, dependency preservation and
rejection of malformed versions or incomplete input before any file is written.</p>
`,text:`# Windows build and release automation

The \`Windows build and release\` workflow runs for every branch push and manual dispatch.
Tag events are excluded to prevent release recursion. Each successful run publishes one
normal release with an immutable \`build-<run-number>-<run-id>-<attempt>\` tag targeting the
exact source commit. Development builds do not update the accepted latest-release channel.

## Build inventory

The single \`windows-release\` job uses the pinned \`windows-2025\` x64 hosted image.
Repository runner discovery returned no self-hosted runners; organization runner discovery
was unavailable to the configuring account. No unavailable local label is required.

The image supplies PowerShell, Git, GitHub CLI and the Visual Studio C++ build tools/Windows
SDK used by Rust's MSVC linker. Pinned setup actions install Node.js 26.4.0 and Rust 1.96.1.
The existing entrypoints install locked npm dependencies, acquire the hash-verified portable
history runtime and invoke Cargo. The workflow invokes \`build-installer.bat -Component Desktop\`
and \`build-installer.bat -Component DocsCompanion\`; those invoke the real \`build.bat\`.
The same entrypoint now stages pinned standard Chromium/Firefox binaries, drivers, portable
Node and locked automation dependencies for inclusion in the installer. Product-patched native
source builds and optional storage deployment remain outside this workflow. See the separate
[bundled-engine guide](bundled-engines.md) for versions and unsupported capabilities.

The desktop bundles using \`build:bundle\` in automation. Normal local \`build\` retains its
TypeScript check. No tests, lint or standalone type checks run in Actions. A release can
therefore ship from source whose local checks would fail. Packaging success is not runtime
or installation acceptance.

## Outputs and authentication

The desktop executable, application window, Squirrel setup and portable handbook use the
checked-in browser/globe icon in \`apps/desktop/assets\`. The editable SVG and reproducible
Windows drawing script \`scripts/generate-icon.ps1\` accompany PNG and multi-resolution ICO
outputs (16 through 256 pixels). Handbook executable resources are edited without signing.
Its packager has automatic publication explicitly disabled; only the release helper publishes.

Release assets include the unsigned Squirrel.Windows installer, \`RELEASES\`, full package,
any produced delta packages, the single-file offline handbook and a SHA-256/size inventory.
Unsigned executables can show unknown-publisher or SmartScreen warnings.
Publication reads the release back and checks its normal classification, exact source tag,
asset names and sizes. Notes record actual workflow start and publication-readback timing.
No signature or installed-update verification is claimed.

API authentication uses the first available Actions secret from \`RELEASE_TOKEN\`, \`ORG_TOKEN\`
and \`GITHUB_TOKEN\`. Secrets are never stored in the source tree or release assets. Checkout
does not persist authentication. There is no pull-request trigger executing untrusted code
with publication credentials.

Safe installer outputs and run metadata are retained for seven days even after earlier
failure. Collection/upload failure does not replace the build's original outcome. Source,
dependency directories, caches and credentials are excluded from upload paths.

## Operation and recovery

Use the Actions page's **Run workflow** control or \`gh workflow run release.yml\`.
Inspect the failing step before rerunning. A rerun gets a new attempt tag; it never overwrites
the previous tag or assets. Build, packaging or publication failure produces a failed run,
not a fabricated installer. Native UI, two-computer restoration and installation checks
remain separate local acceptance work.

Run 39195138374 verified the original desktop/handbook workflow and published its expected
assets. Fresh-image completeness for the newly added browser bundles remains pending.
The dedicated portable
build interface and storage hosting wizard are not delivered by this workflow yet.

The publisher stages explicit safe asset filenames before uploading and rejects collisions;
GitHub can otherwise rewrite a packaging filename containing spaces. The first hosted desktop
and handbook packages were built successfully, but their initial publication readback exposed
this difference. The local desktop installer build and embedded application/setup icon
inspection also passed. Native installation remains separate unverified acceptance.\r

## Bounded publication follow-up

Run 39198295866 built the bundled-browser installer and published normal release
build-5-39198295866-1. The next publisher uploads setup first, then each remaining asset
separately. Every transfer is smaller than 1,400,000,000 bytes and must pass immediate name,
byte-count and SHA-256 digest readback. A partial publication returns failure.\r

## Upgrade versioning

Local source now uses package version0.1.1. Hosted builds stamp both desktop and handbook
manifests and their lock metadata to0.1.<workflow run number>, before invoking the retained
entrypoints. This gives the existing0.1.0 installation a normal newer-version upgrade path.
The desktop version label comes from its actual package manifest. Dependency resolutions stay
unchanged. A local fixture verified metadata synchronization, dependency preservation and
rejection of malformed versions or incomplete input before any file is written.\r
`},{id:"docs/features/desktop/README.md",title:"Desktop workspace",category:"features",html:`<h1 id="desktop-workspace">Desktop workspace</h1>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fprofile-launch.md">Profile launch and identity capabilities</a></li>
</ul>
<p>The desktop shell provides an isolated React interface backed by the native host. It never seeds demonstration profiles. A standalone web preview cannot operate the vault and explicitly reports that the native host is unavailable.</p>
<h2 id="security-and-process-boundary">Security and process boundary</h2>
<p>The renderer has no Node access and uses an allowlisted preload bridge. The main process checks sender and frame identity, bounds requests, rejects permission requests and new windows, and launches the native host with an application-owned data directory. Passwords travel through stdin JSON requests, not arguments or logs. Backend errors are reduced to stable error codes at the renderer boundary. Browser profiles are launched only by the native host. The bundled renderer has a restrictive content security policy.</p>
<h2 id="personal-wording">Personal wording</h2>
<p>Settings upload and window-wide file drop use the same full validator. Schema: <code>{ "schemaVersion": 1, "entries": { "Original label": "Replacement label" } }</code>. UTF-8 limit is 256 KiB, nesting limit 8, key length at most 160 Unicode code points and value length at most 1000. Duplicate keys, unknown fields/versions, unsafe keys and non-string values are rejected before state changes. Only exact product-authored labels are replaced. External records, profile names, paths, identifiers and backend responses are not transformed. The validated cache remains local and is omitted from synchronized settings, exports and history. Clearing removes it. No private mappings or filenames ship in the product.</p>
<h2 id="verification-status">Verification status</h2>
<p>Design reference is <code>design/desktop/REFERENCE.md</code>. Source implementation and package compilation are separate from native runtime, installer and screenshot verification. No visual parity or installation claim is made until actual built-surface evidence exists.</p>
<h2 id="capability-inventory-and-outstanding-acceptance">Capability inventory and outstanding acceptance</h2>
<p>Implemented source paths: isolated preload RPC, native folder picker, real vault creation/unlock, resumable setup progress, real profile list/create/duplicate/launch/stop/snapshot requests, immutable revision listing/restore requests, synchronization configuration/push/pull/conflict requests, saved automation preferences, local language/theme/density/accent, command navigation, strict local personal-wording upload/drop/clear and celebration. Host capability errors remain visible.</p>
<p>Incomplete: the regex workbench currently provides raw/guided constructs, actual worker matching/captures/replacement, timing and timeout but lacks saved snippets/import-export, structured syntax tree, test-case suites and full independent surface coverage. Settings localization has English fallback for explanatory paragraphs. Full universal features such as scheduled settings, narration, shared school mode, per-element appearance/locks, advanced tab docking/groups, authenticator, support recovery, exports/history, bulk operations, converter, local model manager and game-server manager are not implemented here. These are acceptance gaps, not nonapplicability claims. No decorative switches claim these capabilities.</p>
<p>Built runtime, accessibility, narrow/high-scale matrix, all-language copy, installer/update, restart persistence and backend integration acceptance remain unverified until actual evidence is recorded. The package source does not prove any of these.</p>
`,text:`# Desktop workspace\r
\r
- [Profile launch and identity capabilities](profile-launch.md)\r
\r
The desktop shell provides an isolated React interface backed by the native host. It never seeds demonstration profiles. A standalone web preview cannot operate the vault and explicitly reports that the native host is unavailable.\r
\r
## Security and process boundary\r
\r
The renderer has no Node access and uses an allowlisted preload bridge. The main process checks sender and frame identity, bounds requests, rejects permission requests and new windows, and launches the native host with an application-owned data directory. Passwords travel through stdin JSON requests, not arguments or logs. Backend errors are reduced to stable error codes at the renderer boundary. Browser profiles are launched only by the native host. The bundled renderer has a restrictive content security policy.\r
\r
## Personal wording\r
\r
Settings upload and window-wide file drop use the same full validator. Schema: \`{ "schemaVersion": 1, "entries": { "Original label": "Replacement label" } }\`. UTF-8 limit is 256 KiB, nesting limit 8, key length at most 160 Unicode code points and value length at most 1000. Duplicate keys, unknown fields/versions, unsafe keys and non-string values are rejected before state changes. Only exact product-authored labels are replaced. External records, profile names, paths, identifiers and backend responses are not transformed. The validated cache remains local and is omitted from synchronized settings, exports and history. Clearing removes it. No private mappings or filenames ship in the product.\r
\r
## Verification status\r
\r
Design reference is \`design/desktop/REFERENCE.md\`. Source implementation and package compilation are separate from native runtime, installer and screenshot verification. No visual parity or installation claim is made until actual built-surface evidence exists.\r
\r
## Capability inventory and outstanding acceptance\r
\r
Implemented source paths: isolated preload RPC, native folder picker, real vault creation/unlock, resumable setup progress, real profile list/create/duplicate/launch/stop/snapshot requests, immutable revision listing/restore requests, synchronization configuration/push/pull/conflict requests, saved automation preferences, local language/theme/density/accent, command navigation, strict local personal-wording upload/drop/clear and celebration. Host capability errors remain visible.\r
\r
Incomplete: the regex workbench currently provides raw/guided constructs, actual worker matching/captures/replacement, timing and timeout but lacks saved snippets/import-export, structured syntax tree, test-case suites and full independent surface coverage. Settings localization has English fallback for explanatory paragraphs. Full universal features such as scheduled settings, narration, shared school mode, per-element appearance/locks, advanced tab docking/groups, authenticator, support recovery, exports/history, bulk operations, converter, local model manager and game-server manager are not implemented here. These are acceptance gaps, not nonapplicability claims. No decorative switches claim these capabilities.\r
\r
Built runtime, accessibility, narrow/high-scale matrix, all-language copy, installer/update, restart persistence and backend integration acceptance remain unverified until actual evidence is recorded. The package source does not prove any of these.\r
`},{id:"docs/features/desktop/history-runtime.md",title:"Portable runtime for protected settings history",category:"features",html:`<h1 id="portable-runtime-for-protected-settings-history">Portable runtime for protected settings history</h1>
<h2 id="official-source-and-contents">Official source and contents</h2>
<p>The product dependency is the standard x64 MinGit package from the official
<a href="https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2">Git for Windows release</a>.
It is separate from any developer installation or private distribution.</p>
<p><code>engines/runtime/history-git.lock.json</code> records the release, asset, official URL,
archive size and SHA-256, executable path and complete per-file inventory. Its 373
files total 96,142,395 bytes after extraction. The archive is 39,806,486 bytes and
has SHA-256 <code>da35e72aa21c005a5a0d298cfbae110bc1609a815730ea0dde84b01a1b3cd3be</code>.</p>
<p>The entrypoint is <code>cmd/git.exe</code>, SHA-256
<code>54bda91c773c6bba2b970424423cfcb80552d92dc6967d766f98931fe1251a54</code>.
The full payload is required, including the second native executable, supporting
DLLs and tools, configuration and license files. Copying only the small entrypoint
does not deliver a working or verified runtime.</p>
<p>The original root license is retained byte-for-byte in
<code>engines/runtime/licenses/history-git-LICENSE.txt</code>. Its SHA-256 is
<code>454649ddc02b5cc098513cea28db6592b45ac0a906386287c4d48cf8dbde651c</code>.
The package also contains individual third-party licenses; preserve all of them
when packaging the complete payload. The inventory describes their original paths
and hashes. This record does not replace the upstream license terms or notices.</p>
<h2 id="acquisition-and-verification">Acquisition and verification</h2>
<pre><code class="language-powershell">powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1
</code></pre>
<p>The script uses <code>gh release download</code> with the exact official repository, release
and asset. It verifies the pinned archive before extraction and checks every
payload file against the source-controlled inventory before executing the real
absolute entrypoint's version command. Cache reuse repeats verification. Missing
files, changed files, extra files/directories, links and hardlinks are rejected.
A corrupt archive or cache is retained for inspection rather than overlaid or
executed. Download and extraction use fresh staging directories.</p>
<p>The default cache is <code>.cache/history-git/</code>, already excluded by the repository's
cache rule. No PATH change, installer, elevation, global configuration or personal
credential operation is performed. GitHub CLI must already be available for a cold
build acquisition; its absence is a clear non-success result. A packaged user
installation must receive the complete payload and must not require that CLI or
a runtime download.</p>
<p>The script returns a JSON descriptor with <code>version</code>, absolute <code>payloadRoot</code>,
absolute <code>gitExecutable</code>, <code>gitSha256</code>, <code>payloadFileCount</code> and <code>licensePath</code>.
Consume it as trusted local build data; do not publish local machine paths.</p>
<p>Read-only verification for an explicitly selected trusted packaged directory is:</p>
<pre><code class="language-powershell">powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1 -VerifyOnly -PayloadRoot ABSOLUTE_PAYLOAD_DIRECTORY
</code></pre>
<p>That route validates the complete inventory without acquiring or executing a
runtime. It is not a version-command or installation proof.</p>
<h2 id="integration-boundary">Integration boundary</h2>
<p>Root <code>build.bat -Component Desktop</code> and the Desktop portion of <code>All</code> now call the
acquisition script, validate its descriptor and retain the complete verified payload
before compilation. Desktop installer production reaches the same route through
<code>build-installer.bat</code>. The root build also reuses the verified Node bootstrap.
It explicitly loads the current PowerShell host's built-in utility manifest, so
a batch launch inheriting another PowerShell edition's module paths does not lose
the hashing command. This route passed on the current supported host; it is not a
fresh-operating-system or installed-product claim. Forge's
<code>packagerConfig.extraResource</code> accepts paths, not builder-style <code>{from,to}</code> objects.
For example, adding the verified version directory and the lock JSON as resource
paths preserves the directory basename <code>v2.56.0.windows.2</code> in the packaged resources.
Alternatively, stage a verified copy with a deliberate stable basename and verify
that copy again before packaging.</p>
<p>Trusted main-process resolution must derive the directory from packaged resources
or the managed development cache, load its bundled trusted lock, and verify the
complete inventory and path/link boundaries before handing <code>gitExecutable</code> and
<code>gitSha256</code> to <code>createHistoryService</code>. Renderer requests, preferences, environment
PATH and user-selected executable paths must never choose this dependency. The
service's existing per-invocation executable hash check remains required; startup
inventory verification does not replace it. Filesystem checks and later execution
are separate operations, so this alone does not prove resistance to concurrent
same-user payload replacement.</p>
<p>Forge resources, trusted main-process resolution, packaged-resource verification,
built Settings interactions and installed-package acceptance remain separate work.</p>
<h2 id="verification">Verification</h2>
<p><code>powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-history-git.ps1</code>
performs a real cold official acquisition, full payload verification, the actual
pinned version command and cache reuse. It then checks changed executable bytes,
changed support configuration, an unexpected file, a missing license, a changed
archive and an identical-bytes hardlink. Each must stop before the runtime
execution boundary. PATH must remain unchanged. This proves the current supported
host's bootstrap and cache behavior, not an installed product or a fresh operating
system without GitHub CLI.</p>
<p>The verified descriptor can also be piped to
<code>node scripts/test-history-git-service.cjs</code>. This exercises the real history service
with the pinned portable executable: encrypted local records, restart, independent
unlock and diff. Its fresh temporary credential adapter uses an ephemeral test key;
it does not establish Windows Credential Manager or packaged Settings acceptance.</p>
`,text:`# Portable runtime for protected settings history\r
\r
## Official source and contents\r
\r
The product dependency is the standard x64 MinGit package from the official\r
[Git for Windows release](https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2).\r
It is separate from any developer installation or private distribution.\r
\r
\`engines/runtime/history-git.lock.json\` records the release, asset, official URL,\r
archive size and SHA-256, executable path and complete per-file inventory. Its 373\r
files total 96,142,395 bytes after extraction. The archive is 39,806,486 bytes and\r
has SHA-256 \`da35e72aa21c005a5a0d298cfbae110bc1609a815730ea0dde84b01a1b3cd3be\`.\r
\r
The entrypoint is \`cmd/git.exe\`, SHA-256\r
\`54bda91c773c6bba2b970424423cfcb80552d92dc6967d766f98931fe1251a54\`.\r
The full payload is required, including the second native executable, supporting\r
DLLs and tools, configuration and license files. Copying only the small entrypoint\r
does not deliver a working or verified runtime.\r
\r
The original root license is retained byte-for-byte in\r
\`engines/runtime/licenses/history-git-LICENSE.txt\`. Its SHA-256 is\r
\`454649ddc02b5cc098513cea28db6592b45ac0a906386287c4d48cf8dbde651c\`.\r
The package also contains individual third-party licenses; preserve all of them\r
when packaging the complete payload. The inventory describes their original paths\r
and hashes. This record does not replace the upstream license terms or notices.\r
\r
## Acquisition and verification\r
\r
\`\`\`powershell\r
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1\r
\`\`\`\r
\r
The script uses \`gh release download\` with the exact official repository, release\r
and asset. It verifies the pinned archive before extraction and checks every\r
payload file against the source-controlled inventory before executing the real\r
absolute entrypoint's version command. Cache reuse repeats verification. Missing\r
files, changed files, extra files/directories, links and hardlinks are rejected.\r
A corrupt archive or cache is retained for inspection rather than overlaid or\r
executed. Download and extraction use fresh staging directories.\r
\r
The default cache is \`.cache/history-git/\`, already excluded by the repository's\r
cache rule. No PATH change, installer, elevation, global configuration or personal\r
credential operation is performed. GitHub CLI must already be available for a cold\r
build acquisition; its absence is a clear non-success result. A packaged user\r
installation must receive the complete payload and must not require that CLI or\r
a runtime download.\r
\r
The script returns a JSON descriptor with \`version\`, absolute \`payloadRoot\`,\r
absolute \`gitExecutable\`, \`gitSha256\`, \`payloadFileCount\` and \`licensePath\`.\r
Consume it as trusted local build data; do not publish local machine paths.\r
\r
Read-only verification for an explicitly selected trusted packaged directory is:\r
\r
\`\`\`powershell\r
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ensure-history-git.ps1 -VerifyOnly -PayloadRoot ABSOLUTE_PAYLOAD_DIRECTORY\r
\`\`\`\r
\r
That route validates the complete inventory without acquiring or executing a\r
runtime. It is not a version-command or installation proof.\r
\r
## Integration boundary\r
\r
Root \`build.bat -Component Desktop\` and the Desktop portion of \`All\` now call the\r
acquisition script, validate its descriptor and retain the complete verified payload\r
before compilation. Desktop installer production reaches the same route through\r
\`build-installer.bat\`. The root build also reuses the verified Node bootstrap.\r
It explicitly loads the current PowerShell host's built-in utility manifest, so\r
a batch launch inheriting another PowerShell edition's module paths does not lose\r
the hashing command. This route passed on the current supported host; it is not a\r
fresh-operating-system or installed-product claim. Forge's\r
\`packagerConfig.extraResource\` accepts paths, not builder-style \`{from,to}\` objects.\r
For example, adding the verified version directory and the lock JSON as resource\r
paths preserves the directory basename \`v2.56.0.windows.2\` in the packaged resources.\r
Alternatively, stage a verified copy with a deliberate stable basename and verify\r
that copy again before packaging.\r
\r
Trusted main-process resolution must derive the directory from packaged resources\r
or the managed development cache, load its bundled trusted lock, and verify the\r
complete inventory and path/link boundaries before handing \`gitExecutable\` and\r
\`gitSha256\` to \`createHistoryService\`. Renderer requests, preferences, environment\r
PATH and user-selected executable paths must never choose this dependency. The\r
service's existing per-invocation executable hash check remains required; startup\r
inventory verification does not replace it. Filesystem checks and later execution\r
are separate operations, so this alone does not prove resistance to concurrent\r
same-user payload replacement.\r
\r
Forge resources, trusted main-process resolution, packaged-resource verification,\r
built Settings interactions and installed-package acceptance remain separate work.\r
\r
## Verification\r
\r
\`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-history-git.ps1\`\r
performs a real cold official acquisition, full payload verification, the actual\r
pinned version command and cache reuse. It then checks changed executable bytes,\r
changed support configuration, an unexpected file, a missing license, a changed\r
archive and an identical-bytes hardlink. Each must stop before the runtime\r
execution boundary. PATH must remain unchanged. This proves the current supported\r
host's bootstrap and cache behavior, not an installed product or a fresh operating\r
system without GitHub CLI.\r
\r
The verified descriptor can also be piped to\r
\`node scripts/test-history-git-service.cjs\`. This exercises the real history service\r
with the pinned portable executable: encrypted local records, restart, independent\r
unlock and diff. Its fresh temporary credential adapter uses an ephemeral test key;\r
it does not establish Windows Credential Manager or packaged Settings acceptance.\r
`},{id:"docs/features/desktop/native-settings-services.md",title:"Native settings services",category:"features",html:`<h1 id="native-settings-services">Native settings services</h1>
<p>The desktop main process loads <code>electron/services/fonts.cjs</code> and
<code>electron/services/editors.cjs</code>. These modules have no renderer or network access.
All APIs are asynchronous and return either <code>{ok:true,...}</code> or
<code>{ok:false,error:{code,message}}</code>. Error messages omit file paths and child output.</p>
<h2 id="installed-fonts">Installed fonts</h2>
<p><code>listInstalledFonts()</code> invokes the operating system's fixed PowerShell executable
with a fixed, noninteractive script and no interpolated user input. It enumerates
installed GDI font families and their available Regular, Bold, Italic and combined
BoldItalic styles. Success returns <code>source: 'windows-gdi'</code> and
<code>fonts: [{id,family,style}]</code>. The stable identity is the serialized family/style
pair. It does not enumerate variable-font axes or promise OpenType feature coverage.
The operation has a ten-second default timeout and a bounded response buffer.
Unsupported platforms, empty inventory and invalid responses remain explicit errors.</p>
<h2 id="external-editors">External editors</h2>
<p><code>discoverEditors()</code> checks known local installation paths for Notepad, Visual
Studio Code and Notepad++. It never launches an editor. An optional main-process
<code>selectedEditor</code> path, obtained through an explicit executable-selection dialog,
adds the <code>selected</code> editor. Discovery returns <code>{id,name,executable}</code> entries only
for existing, resolved executable files. Network paths and command scripts are
excluded. No PATH search, shell, registry command or user-supplied argument string
is executed.</p>
<p><code>openInEditor({editorId,fileId}, options)</code> requires a trusted main-process call.
Main must supply <code>trustedRequest:true</code>, a dedicated <code>exportRoot</code>, and an
<code>approvedFiles</code> list with <code>{id,path,nonSecret:true,applicationOwned:true}</code> entries.
These options must never be copied from renderer input. The renderer sends opaque
identities only. Main creates a sanitized export in its owned area before approval:
never approve live settings, imported personal wording, credentials, profiles,
authentication state or arbitrary user documents. The service resolves the file,
requires containment inside that export area, permits JSON/text/Markdown files up
to one MiB, and launches only the selected discovered editor with that one literal
file argument. Selection itself is not permission to open a document.</p>
<p>A successful result reports <code>state:'launched'</code>, not that the editor finished
loading or saved changes. Startup timeout and process errors remain failures.
The service does not read back edits, import settings or execute document content.</p>
<h2 id="verification">Verification</h2>
<p>Run <code>node --test apps/desktop/electron/services/native-settings.test.cjs</code> locally.
Coverage includes a real Windows font enumeration, fixed-command assertions,
invalid responses, unavailable editors, rejected commands/network paths,
explicit trust and non-secret approval, resolved containment, file size, literal
argument delivery, process errors and startup timeout. Synthetic editor adapters
avoid launching personal applications during tests. Settings UI integration and
real editor interaction need separate runtime verification.</p>
`,text:`# Native settings services\r
\r
The desktop main process loads \`electron/services/fonts.cjs\` and\r
\`electron/services/editors.cjs\`. These modules have no renderer or network access.\r
All APIs are asynchronous and return either \`{ok:true,...}\` or\r
\`{ok:false,error:{code,message}}\`. Error messages omit file paths and child output.\r
\r
## Installed fonts\r
\r
\`listInstalledFonts()\` invokes the operating system's fixed PowerShell executable\r
with a fixed, noninteractive script and no interpolated user input. It enumerates\r
installed GDI font families and their available Regular, Bold, Italic and combined\r
BoldItalic styles. Success returns \`source: 'windows-gdi'\` and\r
\`fonts: [{id,family,style}]\`. The stable identity is the serialized family/style\r
pair. It does not enumerate variable-font axes or promise OpenType feature coverage.\r
The operation has a ten-second default timeout and a bounded response buffer.\r
Unsupported platforms, empty inventory and invalid responses remain explicit errors.\r
\r
## External editors\r
\r
\`discoverEditors()\` checks known local installation paths for Notepad, Visual\r
Studio Code and Notepad++. It never launches an editor. An optional main-process\r
\`selectedEditor\` path, obtained through an explicit executable-selection dialog,\r
adds the \`selected\` editor. Discovery returns \`{id,name,executable}\` entries only\r
for existing, resolved executable files. Network paths and command scripts are\r
excluded. No PATH search, shell, registry command or user-supplied argument string\r
is executed.\r
\r
\`openInEditor({editorId,fileId}, options)\` requires a trusted main-process call.\r
Main must supply \`trustedRequest:true\`, a dedicated \`exportRoot\`, and an\r
\`approvedFiles\` list with \`{id,path,nonSecret:true,applicationOwned:true}\` entries.\r
These options must never be copied from renderer input. The renderer sends opaque\r
identities only. Main creates a sanitized export in its owned area before approval:\r
never approve live settings, imported personal wording, credentials, profiles,\r
authentication state or arbitrary user documents. The service resolves the file,\r
requires containment inside that export area, permits JSON/text/Markdown files up\r
to one MiB, and launches only the selected discovered editor with that one literal\r
file argument. Selection itself is not permission to open a document.\r
\r
A successful result reports \`state:'launched'\`, not that the editor finished\r
loading or saved changes. Startup timeout and process errors remain failures.\r
The service does not read back edits, import settings or execute document content.\r
\r
## Verification\r
\r
Run \`node --test apps/desktop/electron/services/native-settings.test.cjs\` locally.\r
Coverage includes a real Windows font enumeration, fixed-command assertions,\r
invalid responses, unavailable editors, rejected commands/network paths,\r
explicit trust and non-secret approval, resolved containment, file size, literal\r
argument delivery, process errors and startup timeout. Synthetic editor adapters\r
avoid launching personal applications during tests. Settings UI integration and\r
real editor interaction need separate runtime verification.\r
`},{id:"docs/features/desktop/profile-launch.md",title:"Profile launch and identity capabilities",category:"features",html:`<h1 id="profile-launch-and-identity-capabilities">Profile launch and identity capabilities</h1>
<p>Launch first opens an explanation for the selected profile. Stable browser identity is not
implemented by the current native engine integration, so the saved profile identity cannot
be enforced. Websites may recognize a different browser identity. Standard launch does not
promise anonymity, identity spoofing, stable cross-device identity or portable credentials.</p>
<p>Choose <strong>Launch with standard identity</strong> only when this behavior suits the profile. That
affirmative choice sends one request with the captured profile ID and explicit
<code>requireStableIdentity: false</code>. Consent applies only to that launch. Cancel, Close, Escape
or changing the selected profile does not launch. Locking the vault or removing the profile
invalidates pending consent. Repeated activation during submission cannot duplicate it.</p>
<p>The native host keeps its strict default: omitted or true <code>requireStableIdentity</code> requests
still fail with <code>IDENTITY_UNAVAILABLE</code>. The interface never automatically retries a failed
strict request with weaker requirements. Managed engine registration, hashes, ownership and
automation checks still apply after standard-identity consent. No verified engine means no
launch, with a separate explanation of the missing installation requirement.</p>
<p>Known direct or wrapped IPC codes map to approved English and Cantonese messages before
footer, toast and narration delivery. Unknown exception text becomes a generic localized
message, so native paths and arbitrary exception content are not reflected. The existing
language and message-style settings apply. Focused message tests pass; built consent and
keyboard evidence are pending the source-bound verification run.</p>
`,text:`# Profile launch and identity capabilities

Launch first opens an explanation for the selected profile. Stable browser identity is not
implemented by the current native engine integration, so the saved profile identity cannot
be enforced. Websites may recognize a different browser identity. Standard launch does not
promise anonymity, identity spoofing, stable cross-device identity or portable credentials.

Choose **Launch with standard identity** only when this behavior suits the profile. That
affirmative choice sends one request with the captured profile ID and explicit
\`requireStableIdentity: false\`. Consent applies only to that launch. Cancel, Close, Escape
or changing the selected profile does not launch. Locking the vault or removing the profile
invalidates pending consent. Repeated activation during submission cannot duplicate it.

The native host keeps its strict default: omitted or true \`requireStableIdentity\` requests
still fail with \`IDENTITY_UNAVAILABLE\`. The interface never automatically retries a failed
strict request with weaker requirements. Managed engine registration, hashes, ownership and
automation checks still apply after standard-identity consent. No verified engine means no
launch, with a separate explanation of the missing installation requirement.

Known direct or wrapped IPC codes map to approved English and Cantonese messages before
footer, toast and narration delivery. Unknown exception text becomes a generic localized
message, so native paths and arbitrary exception content are not reflected. The existing
language and message-style settings apply. Focused message tests pass; built consent and
keyboard evidence are pending the source-bound verification run.
`},{id:"docs/features/desktop/protected-settings-history.md",title:"Protected local settings history",category:"features",html:`<h1 id="protected-local-settings-history">Protected local settings history</h1>
<p>The native history service records validated presentation preferences and local
schedule rules. It is an isolated local Git repository inside the application's
stable data directory, independent of profile vault unlock and synchronization.
There are no network commands, remotes or user-selected repository paths.</p>
<p>The service boundaries are explicit: <code>history.cjs</code> owns authentication and
transactions, <code>history-storage.cjs</code> owns managed filesystem and Git integrity,
<code>native-lock.cjs</code> owns the protected cross-process kernel lock, and
<code>credential-store.cjs</code> owns the application-scoped Credential Manager adapter.</p>
<h2 id="main-process-integration">Main-process integration</h2>
<p>Create <code>createHistoryService</code> from <code>electron/services/history.cjs</code> with trusted
<code>appDataRoot</code>, <code>historyRoot: path.join(appDataRoot, 'settings-history')</code>, an
absolute <code>gitExecutable</code> and its independently verified SHA-256 <code>gitSha256</code>,
<code>credentialStore</code>, and <code>validatePreferences</code>/<code>validateSchedule</code> imported from
<code>shared/settings-model.mjs</code>. Never accept these options from renderer input.
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
verified separately.</p>
<p>Before the first filesystem mutation and on every reuse, the service verifies
exact managed files and directories plus their ancestors. Links, hardlinks,
unexpected types and unexpected entries are rejected without deleting them.
For an existing application-data directory, only its safe canonical identity is
resolved before the mutex. Mutable repository inventory is checked after lock
acquisition, so readers wait for an active writer instead of inspecting its
transient files. A missing data directory still receives the full preflight before
creation.
The empty global config is created exclusively and never truncated. Atomic
updates use random exclusive temporary files, flush them and recheck destination
paths before rename. Abandoned <code>auth.json.&lt;UUID&gt;.tmp</code> and
<code>pending.json.&lt;UUID&gt;.tmp</code> files remain inert and preserved in place. The inventory
accepts only exact names, regular single-link files, up to 400,000 bytes each,
128 files and eight MiB combined. Their contents are never activated, imported,
authenticated or committed. Status reports only their count. Unknown, linked,
wrong-type or oversized leftovers remain explicit blockers. The last durable
journal governs recovery, so a failed phase update does not hide it.
Before every Git invocation, pure filesystem checks allow only the app's small
core configuration, reject includes and executable configuration, reject
attributes and repository indirection, and require an empty managed hooks folder.
Initialization uses that verified empty template and disables filesystem monitors.</p>
<p>The exact v1 snapshot is <code>{schemaVersion:1, preferences, schedules}</code>. Unknown
fields are rejected, not silently imported. The shared model validates all
preference values and local schedule rules. Personal wording, imported file
metadata, custom-image data, profiles, credentials and arbitrary user records
have no place in this schema. A snapshot is limited to 256 KiB and 200 schedules.</p>
<p>Every method returns <code>{ok:true,...}</code> or <code>{ok:false,error:{code,message}}</code>.
Error messages exclude user content, helper output and paths.</p>
<h2 id="authentication-and-recording">Authentication and recording</h2>
<p><code>setup(secret)</code> establishes an independent password or PIN (6 to 256 characters).
<code>verify(secret)</code> checks its salted scrypt verifier without unlocking anything.
<code>unlock(secret)</code> performs that verification and opens a session; <code>lock()</code> closes the
session. The session expires after ten minutes. Vault unlock never unlocks history.
<code>status()</code> reports configured, unlocked and recovery-pending state without data.</p>
<p><code>changePassword(oldSecret, newSecret)</code> independently verifies the current password
or PIN and atomically replaces only its salted verifier under the history mutex.
It preserves the credential-vault encryption key, encrypted revisions and pending
recovery journal. The calling instance stays unlocked after success. A persisted
authentication generation invalidates every other instance's old session before
its next protected operation or status read. Credential verification alone still
does not unlock anything. Version-one auth records remain readable and migrate
to version two only on password change. Interrupted writes leave the old auth
record active and preserve the inert temporary file; reset and erasure are not
implemented by this operation.</p>
<p><code>recordSettings({before,after,action})</code> records a real mutation as an encrypted
new file and a new Git commit. Identical before/after snapshots produce no commit.
Normal settings writes must happen independently: history failure returns
<code>recorded:false</code> and a warning, never a false recorded result or a rollback of
the user's ordinary preference change. Main surfaces the warning.
The fixed default action is <code>settings-changed</code>; supported snapshot actions are
created, updated, deleted, imported and restored as well.</p>
<p>AES-256-GCM encrypts each snapshot and event, including user text. Authentication
binds ciphertext to the stable application-history identity and immutable revision
identity. Keys are held only by the app-owned Windows Credential Manager adapter,
which supplies a temporary buffer to trusted internal callbacks and clears it
after use. No key method belongs on renderer RPC. The helper accepts only this
application's target prefix and exchanges values through local process pipes.</p>
<h2 id="browse-restore-and-recovery">Browse, restore and recovery</h2>
<p>An independently unlocked session is required for <code>list({actions,from,to,limit})</code>,
<code>diff(revision)</code>, <code>label(revision,label)</code>, <code>restore(revision,context,apply)</code>,
<code>setRetention({visibleDays})</code>, and <code>exportRedacted()</code>.
List supports inclusive ISO date and action filters. Diff returns changed setting
keys and schedule counts, without freeform text or voice identifiers. Labels are
encrypted; redacted export excludes their contents, snapshot values and user text.</p>
<p>Restore requires main-owned context <code>{expected, expectedNativeRevision}</code>. The
expected semantic snapshot must validate against the same record kind as the
desired snapshot; the native revision must be a nonnegative safe integer. Missing,
malformed and mixed-kind contexts fail before apply. Renderer callbacks and
renderer-supplied filesystem or native context are never accepted.
Restore first writes that exact context into an encrypted recovery journal and
commits a prepared record.
Only then does it call the trusted main-process apply callback. A successful apply
is followed by a new restored revision; history is never reset or rewritten.
An interruption leaves <code>recoveryPending:true</code>. After independent unlock, main
can offer <code>recover('retry', apply)</code> with the identical original expected semantic
snapshot and native revision, or an explicit
<code>recover('discard')</code> to retain the current live state and record the decision.
No automatic recovery overwrites live preferences at startup.
Historical journals without complete expectations remain incomplete, with
<code>HISTORY_RECOVERY_EXPECTATION_REQUIRED</code> and an authenticated status indication
<code>needsExplicitDiscard:true</code>. Recovery never guesses their current state.</p>
<h2 id="limits-and-verification">Limits and verification</h2>
<p>Retention is logical visibility only. Its policy is itself a new revision;
physical pruning remains unavailable and is explicitly reported as unfinished.
The service caps storage at 2,000 event files and list/export at 500 entries per
request. A complete paginated export, freeform search, password reset,
and physical pruning remain unfinished.</p>
<p>Display-name changes use
<code>transactDisplayName({before,after,action,expectedNativeRevision}, apply)</code> with
an independently unlocked session. Values are a bounded chosen string or null;
actions are created, updated, deleted and reset. The encrypted typed snapshot is
<code>{schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName}</code>.
The stable record identity is authenticated alongside the immutable revision ID,
so deleting and restoring a name cannot orphan its encrypted history. Legacy
settings envelopes remain readable, while new envelopes carry authenticated
record identity explicitly.</p>
<p>Main's trusted apply callback receives
<code>(snapshot, {expected: previousSnapshot, expectedNativeRevision})</code> and must compare
both the semantic state and revision under its own native preferences mutex
before writing atomically. The
callback must be idempotent: if live state already equals the requested value,
return success without rewriting it. Recovery supplies <code>recovery:true</code> and may
retry after an earlier apply succeeded but its final history commit did not.
Recovery records a durable preparation again before calling apply.
The service rejects a before-value conflicting with the latest committed display-name
record. Its cross-process mutex spans preparation, durable commit, apply and final
commit. Failure leaves the encrypted phase journal for explicit recovery and never
reports applied success. Main must route every display-name mutation through this
transaction API. Restore and recovery callbacks dispatch using snapshot kind.
Names are omitted from ordinary diff/export metadata.
Exactly <code>SETTINGS_CONFLICT</code> and <code>DISPLAY_NAME_CONFLICT</code> from trusted apply map to
the safe service code <code>HISTORY_STATE_CONFLICT</code>, preserving the pending journal.
Other callback text is not reflected to the renderer.</p>
<p>Secret and authenticator mutations remain outside this snapshot schema.
<code>recordSettings</code> cannot accept a display-name record or a protected mutation;
those attempts return <code>PROTECTED_TRANSACTION_REQUIRED</code>.</p>
<p>Focused tests exercise actual local Git commits, independent authentication,
restart, no-op recording, encrypted file contents, append-only restoration,
redacted export, wrong passwords, unknown fields, executable-hash mismatch,
missing keys and interrupted-restore recovery. Credential tests use a fresh
application-owned Windows test target and remove it after the real roundtrip.
Built Settings interaction and installed-package acceptance remain separate.</p>
`,text:`# Protected local settings history\r
\r
The native history service records validated presentation preferences and local\r
schedule rules. It is an isolated local Git repository inside the application's\r
stable data directory, independent of profile vault unlock and synchronization.\r
There are no network commands, remotes or user-selected repository paths.\r
\r
The service boundaries are explicit: \`history.cjs\` owns authentication and\r
transactions, \`history-storage.cjs\` owns managed filesystem and Git integrity,\r
\`native-lock.cjs\` owns the protected cross-process kernel lock, and\r
\`credential-store.cjs\` owns the application-scoped Credential Manager adapter.\r
\r
## Main-process integration\r
\r
Create \`createHistoryService\` from \`electron/services/history.cjs\` with trusted\r
\`appDataRoot\`, \`historyRoot: path.join(appDataRoot, 'settings-history')\`, an\r
absolute \`gitExecutable\` and its independently verified SHA-256 \`gitSha256\`,\r
\`credentialStore\`, and \`validatePreferences\`/\`validateSchedule\` imported from\r
\`shared/settings-model.mjs\`. Never accept these options from renderer input.\r
The executable hash is checked before every bounded Git invocation; shell\r
execution, hooks, global/system configuration and network protocols are disabled.\r
Paths are checked for symbolic links. Every service call holds the same\r
application-scoped kernel mutex across processes, including authentication,\r
recording and trusted apply callbacks. A fixed local helper holds the mutex until\r
its input pipe closes. Process termination releases it through normal pipe and\r
kernel abandonment handling, without guessing whether a PID is stale. Credential\r
creation has its own app-owned mutex, preventing simultaneous key replacement.\r
The mutex uses the global namespace and the current user's SID, with an explicit\r
protected owner-only ACL. Existing mutex ownership and access rules are checked;\r
an unsafe pre-created mutex is rejected. Actual second-logon-session acceptance\r
has not been performed; same-session process concurrency and crash recovery are\r
verified separately.\r
\r
Before the first filesystem mutation and on every reuse, the service verifies\r
exact managed files and directories plus their ancestors. Links, hardlinks,\r
unexpected types and unexpected entries are rejected without deleting them.\r
For an existing application-data directory, only its safe canonical identity is\r
resolved before the mutex. Mutable repository inventory is checked after lock\r
acquisition, so readers wait for an active writer instead of inspecting its\r
transient files. A missing data directory still receives the full preflight before\r
creation.\r
The empty global config is created exclusively and never truncated. Atomic\r
updates use random exclusive temporary files, flush them and recheck destination\r
paths before rename. Abandoned \`auth.json.<UUID>.tmp\` and\r
\`pending.json.<UUID>.tmp\` files remain inert and preserved in place. The inventory\r
accepts only exact names, regular single-link files, up to 400,000 bytes each,\r
128 files and eight MiB combined. Their contents are never activated, imported,\r
authenticated or committed. Status reports only their count. Unknown, linked,\r
wrong-type or oversized leftovers remain explicit blockers. The last durable\r
journal governs recovery, so a failed phase update does not hide it.\r
Before every Git invocation, pure filesystem checks allow only the app's small\r
core configuration, reject includes and executable configuration, reject\r
attributes and repository indirection, and require an empty managed hooks folder.\r
Initialization uses that verified empty template and disables filesystem monitors.\r
\r
The exact v1 snapshot is \`{schemaVersion:1, preferences, schedules}\`. Unknown\r
fields are rejected, not silently imported. The shared model validates all\r
preference values and local schedule rules. Personal wording, imported file\r
metadata, custom-image data, profiles, credentials and arbitrary user records\r
have no place in this schema. A snapshot is limited to 256 KiB and 200 schedules.\r
\r
Every method returns \`{ok:true,...}\` or \`{ok:false,error:{code,message}}\`.\r
Error messages exclude user content, helper output and paths.\r
\r
## Authentication and recording\r
\r
\`setup(secret)\` establishes an independent password or PIN (6 to 256 characters).\r
\`verify(secret)\` checks its salted scrypt verifier without unlocking anything.\r
\`unlock(secret)\` performs that verification and opens a session; \`lock()\` closes the\r
session. The session expires after ten minutes. Vault unlock never unlocks history.\r
\`status()\` reports configured, unlocked and recovery-pending state without data.\r
\r
\`changePassword(oldSecret, newSecret)\` independently verifies the current password\r
or PIN and atomically replaces only its salted verifier under the history mutex.\r
It preserves the credential-vault encryption key, encrypted revisions and pending\r
recovery journal. The calling instance stays unlocked after success. A persisted\r
authentication generation invalidates every other instance's old session before\r
its next protected operation or status read. Credential verification alone still\r
does not unlock anything. Version-one auth records remain readable and migrate\r
to version two only on password change. Interrupted writes leave the old auth\r
record active and preserve the inert temporary file; reset and erasure are not\r
implemented by this operation.\r
\r
\`recordSettings({before,after,action})\` records a real mutation as an encrypted\r
new file and a new Git commit. Identical before/after snapshots produce no commit.\r
Normal settings writes must happen independently: history failure returns\r
\`recorded:false\` and a warning, never a false recorded result or a rollback of\r
the user's ordinary preference change. Main surfaces the warning.\r
The fixed default action is \`settings-changed\`; supported snapshot actions are\r
created, updated, deleted, imported and restored as well.\r
\r
AES-256-GCM encrypts each snapshot and event, including user text. Authentication\r
binds ciphertext to the stable application-history identity and immutable revision\r
identity. Keys are held only by the app-owned Windows Credential Manager adapter,\r
which supplies a temporary buffer to trusted internal callbacks and clears it\r
after use. No key method belongs on renderer RPC. The helper accepts only this\r
application's target prefix and exchanges values through local process pipes.\r
\r
## Browse, restore and recovery\r
\r
An independently unlocked session is required for \`list({actions,from,to,limit})\`,\r
\`diff(revision)\`, \`label(revision,label)\`, \`restore(revision,context,apply)\`,\r
\`setRetention({visibleDays})\`, and \`exportRedacted()\`.\r
List supports inclusive ISO date and action filters. Diff returns changed setting\r
keys and schedule counts, without freeform text or voice identifiers. Labels are\r
encrypted; redacted export excludes their contents, snapshot values and user text.\r
\r
Restore requires main-owned context \`{expected, expectedNativeRevision}\`. The\r
expected semantic snapshot must validate against the same record kind as the\r
desired snapshot; the native revision must be a nonnegative safe integer. Missing,\r
malformed and mixed-kind contexts fail before apply. Renderer callbacks and\r
renderer-supplied filesystem or native context are never accepted.\r
Restore first writes that exact context into an encrypted recovery journal and\r
commits a prepared record.\r
Only then does it call the trusted main-process apply callback. A successful apply\r
is followed by a new restored revision; history is never reset or rewritten.\r
An interruption leaves \`recoveryPending:true\`. After independent unlock, main\r
can offer \`recover('retry', apply)\` with the identical original expected semantic\r
snapshot and native revision, or an explicit\r
\`recover('discard')\` to retain the current live state and record the decision.\r
No automatic recovery overwrites live preferences at startup.\r
Historical journals without complete expectations remain incomplete, with\r
\`HISTORY_RECOVERY_EXPECTATION_REQUIRED\` and an authenticated status indication\r
\`needsExplicitDiscard:true\`. Recovery never guesses their current state.\r
\r
## Limits and verification\r
\r
Retention is logical visibility only. Its policy is itself a new revision;\r
physical pruning remains unavailable and is explicitly reported as unfinished.\r
The service caps storage at 2,000 event files and list/export at 500 entries per\r
request. A complete paginated export, freeform search, password reset,\r
and physical pruning remain unfinished.\r
\r
Display-name changes use\r
\`transactDisplayName({before,after,action,expectedNativeRevision}, apply)\` with\r
an independently unlocked session. Values are a bounded chosen string or null;\r
actions are created, updated, deleted and reset. The encrypted typed snapshot is\r
\`{schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName}\`.\r
The stable record identity is authenticated alongside the immutable revision ID,\r
so deleting and restoring a name cannot orphan its encrypted history. Legacy\r
settings envelopes remain readable, while new envelopes carry authenticated\r
record identity explicitly.\r
\r
Main's trusted apply callback receives\r
\`(snapshot, {expected: previousSnapshot, expectedNativeRevision})\` and must compare\r
both the semantic state and revision under its own native preferences mutex\r
before writing atomically. The\r
callback must be idempotent: if live state already equals the requested value,\r
return success without rewriting it. Recovery supplies \`recovery:true\` and may\r
retry after an earlier apply succeeded but its final history commit did not.\r
Recovery records a durable preparation again before calling apply.\r
The service rejects a before-value conflicting with the latest committed display-name\r
record. Its cross-process mutex spans preparation, durable commit, apply and final\r
commit. Failure leaves the encrypted phase journal for explicit recovery and never\r
reports applied success. Main must route every display-name mutation through this\r
transaction API. Restore and recovery callbacks dispatch using snapshot kind.\r
Names are omitted from ordinary diff/export metadata.\r
Exactly \`SETTINGS_CONFLICT\` and \`DISPLAY_NAME_CONFLICT\` from trusted apply map to\r
the safe service code \`HISTORY_STATE_CONFLICT\`, preserving the pending journal.\r
Other callback text is not reflected to the renderer.\r
\r
Secret and authenticator mutations remain outside this snapshot schema.\r
\`recordSettings\` cannot accept a display-name record or a protected mutation;\r
those attempts return \`PROTECTED_TRANSACTION_REQUIRED\`.\r
\r
Focused tests exercise actual local Git commits, independent authentication,\r
restart, no-op recording, encrypted file contents, append-only restoration,\r
redacted export, wrong passwords, unknown fields, executable-hash mismatch,\r
missing keys and interrupted-restore recovery. Credential tests use a fresh\r
application-owned Windows test target and remove it after the real roundtrip.\r
Built Settings interaction and installed-package acceptance remain separate.\r
`},{id:"docs/features/desktop/settings-regressions.md",title:"Settings state-transition regressions",category:"features",html:`<h1 id="settings-state-transition-regressions">Settings state-transition regressions</h1>
<p>The first categorized Settings candidate exposed nine defects during independent review. This ledger records the concrete transitions and separates pure-model proof from built-interface acceptance. None of these results establishes complete Settings feature coverage.</p>
<table>
<thead>
<tr>
<th>ID</th>
<th>Required transition</th>
<th>Shared implementation and focused test</th>
<th>Current evidence</th>
</tr>
</thead>
<tbody>
<tr>
<td>R1</td>
<td>Delete the last schedule, narrow a history filter, or dismiss the last unread notification without stale search indices selecting a different record or crashing</td>
<td><code>interaction-model.mjs</code>, stable key snapshots in <code>Search.tsx</code>, <code>settings-regressions.test.mjs</code></td>
<td>Model cases pass; deliberately regressed identity resolver fails; new built transitions pending</td>
</tr>
<tr>
<td>R2</td>
<td>A \u2192 B \u2192 C; Undo \u2192 B \u2192 A; Redo \u2192 B \u2192 C; a new edit after Undo clears Redo while retaining the audit</td>
<td><code>history-model.mjs</code>, <code>store.ts</code></td>
<td>Model sequence passes; old second-to-last toggle fails; new built sequence pending</td>
</tr>
<tr>
<td>R3</td>
<td>Rename an imported disabled rule with multiple values without enabling it or losing untouched values</td>
<td><code>preserveScheduleEdit</code>, schedule editor</td>
<td>Model case passes; enabled/single-value regression fails; new built import/edit pending</td>
</tr>
<tr>
<td>R4</td>
<td>Load a valid current preferences record despite malformed unused legacy appearance JSON</td>
<td><code>readStoredPresentation</code>, store initialization</td>
<td>Model case passes; eager legacy parse fails; new built reload pending</td>
</tr>
<tr>
<td>R5</td>
<td>Reveal a setting excluded by the current section filter without discarding that filter</td>
<td><code>revealSettingKeys</code>, Settings workspace</td>
<td>Model case passes; hidden-target regression fails; new built focus proof pending</td>
</tr>
<tr>
<td>R6</td>
<td>Give two automatic voice selectors distinct names identifying their owning fields and current values</td>
<td><code>choiceAccessibleName</code>, shared picker</td>
<td>Name model passes; value-only regression fails; rendered accessibility-name proof pending</td>
</tr>
<tr>
<td>R7</td>
<td>Clear a numeric field and retain a partial color draft while preserving the last valid saved value</td>
<td><code>parseNumericDraft</code>, draft field controls</td>
<td>Validation cases pass; old ignored-blank behavior fails; rendered draft/focus proof pending</td>
</tr>
<tr>
<td>R8</td>
<td>Mount workspace and accessibility-dialog copies of the same setting without duplicate target/help IDs</td>
<td><code>settingInstanceId</code>, shared control</td>
<td>Instance model passes; fixed-ID regression fails; simultaneous DOM proof pending</td>
</tr>
<tr>
<td>R9</td>
<td>Keep an active bilingual continuation and queued critical messages when routine messages arrive</td>
<td><code>speech-queue.mjs</code>, narrator consumer</td>
<td>Queue-order case passes; replace-whole-queue regression fails; actual audio delivery remains unverified</td>
</tr>
</tbody>
</table>
<p>The local negative runner exercised one deliberate regression for each ID and observed all nine fail their intended assertion. Restored source passed all nine cases. The combined focused desktop, native bridge and font/editor checks passed 39 tests. Runtime records from the earlier candidate remain bound to that earlier source and are not relabeled as proof for these repairs.</p>
<p>Settings controls, pure validation, persistence, history transitions, speech queue and privileged IPC are separate modules. The current browser-storage history remains an interim local feature until the independently protected native history service is connected and verified.</p>
`,text:"# Settings state-transition regressions\r\n\r\nThe first categorized Settings candidate exposed nine defects during independent review. This ledger records the concrete transitions and separates pure-model proof from built-interface acceptance. None of these results establishes complete Settings feature coverage.\r\n\r\n| ID | Required transition | Shared implementation and focused test | Current evidence |\r\n| --- | --- | --- | --- |\r\n| R1 | Delete the last schedule, narrow a history filter, or dismiss the last unread notification without stale search indices selecting a different record or crashing | `interaction-model.mjs`, stable key snapshots in `Search.tsx`, `settings-regressions.test.mjs` | Model cases pass; deliberately regressed identity resolver fails; new built transitions pending |\r\n| R2 | A \u2192 B \u2192 C; Undo \u2192 B \u2192 A; Redo \u2192 B \u2192 C; a new edit after Undo clears Redo while retaining the audit | `history-model.mjs`, `store.ts` | Model sequence passes; old second-to-last toggle fails; new built sequence pending |\r\n| R3 | Rename an imported disabled rule with multiple values without enabling it or losing untouched values | `preserveScheduleEdit`, schedule editor | Model case passes; enabled/single-value regression fails; new built import/edit pending |\r\n| R4 | Load a valid current preferences record despite malformed unused legacy appearance JSON | `readStoredPresentation`, store initialization | Model case passes; eager legacy parse fails; new built reload pending |\r\n| R5 | Reveal a setting excluded by the current section filter without discarding that filter | `revealSettingKeys`, Settings workspace | Model case passes; hidden-target regression fails; new built focus proof pending |\r\n| R6 | Give two automatic voice selectors distinct names identifying their owning fields and current values | `choiceAccessibleName`, shared picker | Name model passes; value-only regression fails; rendered accessibility-name proof pending |\r\n| R7 | Clear a numeric field and retain a partial color draft while preserving the last valid saved value | `parseNumericDraft`, draft field controls | Validation cases pass; old ignored-blank behavior fails; rendered draft/focus proof pending |\r\n| R8 | Mount workspace and accessibility-dialog copies of the same setting without duplicate target/help IDs | `settingInstanceId`, shared control | Instance model passes; fixed-ID regression fails; simultaneous DOM proof pending |\r\n| R9 | Keep an active bilingual continuation and queued critical messages when routine messages arrive | `speech-queue.mjs`, narrator consumer | Queue-order case passes; replace-whole-queue regression fails; actual audio delivery remains unverified |\r\n\r\nThe local negative runner exercised one deliberate regression for each ID and observed all nine fail their intended assertion. Restored source passed all nine cases. The combined focused desktop, native bridge and font/editor checks passed 39 tests. Runtime records from the earlier candidate remain bound to that earlier source and are not relabeled as proof for these repairs.\r\n\r\nSettings controls, pure validation, persistence, history transitions, speech queue and privileged IPC are separate modules. The current browser-storage history remains an interim local feature until the independently protected native history service is connected and verified.\r\n"},{id:"docs/features/documentation/README.md",title:"Documentation delivery",category:"features",html:`<h1 id="documentation-delivery">Documentation delivery</h1>
<p>The static documentation component imports every Markdown article under <code>docs/</code> and <code>wiki/</code> at build time and emits a complete local bundle in <code>dist/site</code>. Internal article links and headings remain inside the bundle. Optional source links point to GitHub. Images in imported Markdown are omitted with a labelled source reference until a reviewed offline image inventory is available; no external image requests are made.</p>
<p>The website leads with task walkthroughs, local progress and explanatory examples. It is not an interface to native product operations. Root <code>build.bat -Component Docs</code> assembles the static output.</p>
<h2 id="portable-offline-handbook">Portable offline handbook</h2>
<p><code>build.bat -Component DocsCompanion</code> rebuilds the complete documentation and stages the same reviewed output for the offline handbook. <code>build-installer.bat -Component DocsCompanion</code> invokes that build and produces <code>apps/docs-companion/release/Material-Browser-Handbook-0.1.0-x64.exe</code>. This documentation-only portable companion is separate from the application's Squirrel installer. Its single executable contains its runtime and complete documentation; no adjacent runtime folder, installer or network download is needed to launch it. Temporary runtime extraction is managed by the portable launcher.</p>
<p>The sandboxed renderer has no Node integration or preload bridge. A restricted local protocol serves only hashed bundled assets. Permissions, new windows, downloads, external navigation and network requests are blocked. Optional online source links therefore do not open in the offline companion. All internal article/wiki routes, guides, examples, search and reading preferences use the bundled content. Preferences are stored under the companion's own user-data directory, separately from browser profiles and the main application.</p>
<p>For isolated verification, pass <code>--verification-data-dir=&lt;absolute-directory&gt;</code> using a new empty directory or a directory already marked by this companion. Root, home, normal-profile, linked and unowned nonempty directories are rejected. Debugging switches are disabled for normal reading; an explicitly isolated verification profile may use a loopback debugging port. This mode never reads or replaces the normal profile.</p>
<p>The companion bootstrap reuses a separately trusted compatible installed Node.js when available. Its managed portable cache is different: every executable, script and npm module must exactly match the pinned, hash-verified ZIP before any cached tool runs. Missing, modified, extra or linked cache entries stop the build and remain untouched for inspection. A cached version string alone is not integrity proof. Run <code>powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/docs-companion/test/bootstrap.test.ps1</code> for the focused cache-integrity regression, including modified npm content with an unchanged ZIP.</p>
<h2 id="security-and-privacy">Security and privacy</h2>
<p>Markdown raw HTML is disabled and rendered output is sanitized. Executable link schemes are removed. No remote fonts, CDN scripts or analytics are included. Personal wording is loaded only from a validated user-selected file into local browser storage; its payload is not exported or transmitted. Source articles remain in their authored language and preserve technical identifiers.</p>
<h2 id="verification-and-limitations">Verification and limitations</h2>
<p>Build checks validate complete source inventory, safe Markdown and internal links. Browser interaction, local persistence, narrow layouts, live publication, companion packaging and native launch need separate evidence. The design reference lists the required state and scale matrix. Broader universal settings, narrator, element locking/appearance, shared School mode and full regex tracing are incomplete acceptance items, not shipped claims.</p>
<p>Reviewed local images are supported through <code>apps/docs/approved-assets.json</code>: each entry requires a <code>docs/evidence/</code> image path, exact SHA-256, and <code>reviewedForPublication: true</code>. Builds reject traversal, unsupported files and changed hashes, then copy approved bytes into the offline bundle. The inventory includes the reviewed desktop captures. External images never load.</p>
`,text:`# Documentation delivery\r
\r
The static documentation component imports every Markdown article under \`docs/\` and \`wiki/\` at build time and emits a complete local bundle in \`dist/site\`. Internal article links and headings remain inside the bundle. Optional source links point to GitHub. Images in imported Markdown are omitted with a labelled source reference until a reviewed offline image inventory is available; no external image requests are made.\r
\r
The website leads with task walkthroughs, local progress and explanatory examples. It is not an interface to native product operations. Root \`build.bat -Component Docs\` assembles the static output.\r
\r
## Portable offline handbook\r
\r
\`build.bat -Component DocsCompanion\` rebuilds the complete documentation and stages the same reviewed output for the offline handbook. \`build-installer.bat -Component DocsCompanion\` invokes that build and produces \`apps/docs-companion/release/Material-Browser-Handbook-0.1.0-x64.exe\`. This documentation-only portable companion is separate from the application's Squirrel installer. Its single executable contains its runtime and complete documentation; no adjacent runtime folder, installer or network download is needed to launch it. Temporary runtime extraction is managed by the portable launcher.\r
\r
The sandboxed renderer has no Node integration or preload bridge. A restricted local protocol serves only hashed bundled assets. Permissions, new windows, downloads, external navigation and network requests are blocked. Optional online source links therefore do not open in the offline companion. All internal article/wiki routes, guides, examples, search and reading preferences use the bundled content. Preferences are stored under the companion's own user-data directory, separately from browser profiles and the main application.\r
\r
For isolated verification, pass \`--verification-data-dir=<absolute-directory>\` using a new empty directory or a directory already marked by this companion. Root, home, normal-profile, linked and unowned nonempty directories are rejected. Debugging switches are disabled for normal reading; an explicitly isolated verification profile may use a loopback debugging port. This mode never reads or replaces the normal profile.\r
\r
The companion bootstrap reuses a separately trusted compatible installed Node.js when available. Its managed portable cache is different: every executable, script and npm module must exactly match the pinned, hash-verified ZIP before any cached tool runs. Missing, modified, extra or linked cache entries stop the build and remain untouched for inspection. A cached version string alone is not integrity proof. Run \`powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/docs-companion/test/bootstrap.test.ps1\` for the focused cache-integrity regression, including modified npm content with an unchanged ZIP.\r
\r
## Security and privacy\r
\r
Markdown raw HTML is disabled and rendered output is sanitized. Executable link schemes are removed. No remote fonts, CDN scripts or analytics are included. Personal wording is loaded only from a validated user-selected file into local browser storage; its payload is not exported or transmitted. Source articles remain in their authored language and preserve technical identifiers.\r
\r
## Verification and limitations\r
\r
Build checks validate complete source inventory, safe Markdown and internal links. Browser interaction, local persistence, narrow layouts, live publication, companion packaging and native launch need separate evidence. The design reference lists the required state and scale matrix. Broader universal settings, narrator, element locking/appearance, shared School mode and full regex tracing are incomplete acceptance items, not shipped claims.\r
\r
Reviewed local images are supported through \`apps/docs/approved-assets.json\`: each entry requires a \`docs/evidence/\` image path, exact SHA-256, and \`reviewedForPublication: true\`. Builds reject traversal, unsupported files and changed hashes, then copy approved bytes into the offline bundle. The inventory includes the reviewed desktop captures. External images never load.\r
`},{id:"docs/features/engines/README.md",title:"Browser engine integration",category:"features",html:`<h1 id="browser-engine-integration">Browser engine integration</h1>
<p>The Rust engine crate manages only explicitly registered, hash-pinned engine bundles. It never
searches for or imports an installed personal browser. The native host chooses the bundle and
manifest, and passes the persisted profile automation preference into <code>LaunchRequest</code>.</p>
<h2 id="current-delivery">Current delivery</h2>
<ul>
<li>SHA-256 verification before registration and again immediately before process launch.</li>
<li>Canonical bundle containment, strict UUID profile paths, application-owned profile root and
exclusive supervisor lifetime lock. Browser-native profile locks remain necessary after a host crash.</li>
<li>Chromium and Firefox Off-mode launch arguments contain no driver, debugging port, debugging
pipe or automation flag. No extension or injected script is used to pretend native identity support.</li>
<li>Process status reports the launch root PID, effective mode and pinned engine version. A browser
launcher can exit while its actual browser child remains in the private process job.</li>
<li>Windows Off-mode stop posts WM_CLOSE only after pinning the window owner's live process handle
and checking exact private job membership, creation ordering, executable and the current window
owner. Stop waits at most 30 seconds for native exit and an empty private job. A close prompt,
hung process, failed identity check or unavailable window returns an explicit error and retains
ownership. It does not force-kill. Other platforms report graceful stop unavailable.</li>
</ul>
<h2 id="deliberate-unavailable-capabilities">Deliberate unavailable capabilities</h2>
<p>Portable encryption, stable identity and consistent live snapshots are
unavailable. A manifest setting any of these true is rejected. A version label or upstream
compatibility table alone cannot enable them. Opt-in automation implementation is described below; there are no bundled engines or driver binaries.
Engine installation must supply trusted native-host configuration, not untrusted renderer paths.
The manifest hashes the executable, not every resource in its bundle. Full bundle integrity and
protection against executable replacement between verification and spawn remain pending.</p>
<p>The restricted snapshot message schema has request/profile/executable binding and all required
barrier acknowledgements. It has no evaluation, arbitrary filesystem or debugging command.
Schema validation alone does not establish authenticated transport or real quiescence. The
launcher therefore never copies a live directory and always rejects live snapshot requests.
Missing implementation: inherited authenticated pipe, child peer verification, browser-wide
network/renderer/service-worker/storage barriers, database flush hooks, rollback and recovery,
concurrent mutation tests and cross-engine runtime evidence.</p>
<h2 id="pinned-source-research">Pinned source research</h2>
<p>Chromium <code>134.0.6998.35</code> source interfaces were acquired directly from
<a href="https://chromium.googlesource.com/chromium/src/+/refs/tags/134.0.6998.35/">Chromium source</a>.
This historical revision is a source prototype pin, not a recommendation to run an old browser.
See <code>engines/recipes/chromium-provider.json</code> for exact paths and SHA-256 values.
<code>KeyProvider</code> accepts asynchronous key delivery, encryption eligibility and sync-compatibility
reporting. <code>BrowserProcessImpl</code> assembles providers before constructing <code>OSCryptAsync</code>.
No portable-key provider is integrated or compiled here. A production provider must accept only
new application-owned profiles, receive key material through protected native IPC, prevent
legacy provider fallback, and prove restored new-profile data across supported machines.
It must never import existing browser credentials or alter operating-system protections.</p>
<p><a href="https://firefox-source-docs.mozilla.org/testing/geckodriver/Support.html">Mozilla's driver table</a>
provides compatibility constraints, not a verified adapter. Exact Firefox, geckodriver, Selenium,
Puppeteer and Chromium pins plus runtime handshakes remain required before enabling automation.</p>
<h2 id="opt-in-automation-adapters">Opt-in automation adapters</h2>
<p><code>EngineRegistry::register_adapter(kind, mode, AdapterRuntime)</code> accepts a trusted native-host
runtime configuration. The configuration pins Node and helper SHA-256, exact browser version,
and, for Selenium, the driver's SHA-256 and exact reported driver version. Install adapter
packages with <code>npm ci --ignore-scripts --prefix engines/adapters</code>; the lockfile pins package
integrity. It does not download browsers or drivers, and never invokes Selenium Manager.</p>
<p>The bundled helper pins <code>selenium-webdriver</code> 4.51.0 and <code>puppeteer-core</code> 25.14.0. Selenium uses
explicit ChromeDriver or geckodriver service builders and the application profile path.
Puppeteer uses a loopback Chromium CDP WebSocket, or Firefox WebDriver BiDi. Chromium explicitly
requests an ephemeral debugging port alongside its loopback debugging address. The helper
checks the exact browser version and a positive native PID before returning a launch receipt.
Version mismatch fails initialization and requests browser close. Configuration and shutdown
travel over inherited stdin. No arbitrary user script, navigation or page evaluation command
is exposed by this helper. Automation is enabled only by the persisted requested mode.</p>
<p><code>EngineRegistry::list()</code> reports configured adapters separately from runtime verification.
A configured adapter is not runtime proof. A successful <code>ProcessStatus</code> effective mode follows
the helper's exact browser receipt. Native-host trusted installation configuration must supply
a compatible exact browser and driver pair. Earlier launch-root-only results are superseded
for graceful-shutdown interpretation. See <a href="#/article/docs%2Ffeatures%2Fengines%2Fnative-automation-verification.md">the native automation verification record</a>
for the corrected six-run proof and remaining limits; it does not verify other versions.</p>
<p>Graceful adapter shutdown calls Puppeteer close or WebDriver quit. A timeout retains process
ownership instead of claiming it stopped. Initialization failure closes the helper input first
and then terminates the owned process job if it cannot settle. Each helper enters a private
Windows job before receiving launch configuration; Off-mode browsers start suspended and enter
that job before being resumed. Loss of the supervisor terminates its owned process family.
Registered manifests cannot enable custom encryption, identity or
snapshot features. Their automation booleans are informational and do not configure adapters.</p>
<p>Firefox permits one active BiDi session. The helper releases its initial launch session before
returning the endpoint, allowing the external client to connect. It reacquires a session for
graceful shutdown after the external client disconnects. While an external client remains
attached, stop reports incomplete and retains ownership. The helper stays alive after a Firefox
protocol close reply until the native supervisor proves browser exit and that the complete job
contains only the exact live helper child. The supervisor then sends a private settlement command
and still waits for an empty job. An external client closing the browser is handled through the
same independently verified transition. A retained process handle with a nonzero native exit
timestamp does not make the exited browser live. Paired RPC reads allow 40 seconds so the native
30-second stop result is not replaced by an earlier transport timeout.</p>
<h2 id="source-patch-prototype">Source patch prototype</h2>
<p><code>engines/recipes/chromium-new-profile-provider.patch</code> adds a concrete <code>KeyProvider</code> implementation
against the acquired pinned interface. It accepts an in-memory <code>Encryptor::Key</code> only through
a new application-owned-profile factory, provides the <code>mb1</code> tag, declines sync compatibility
and returns no key on reuse. Patch application was checked. It is not wired into GN or
<code>BrowserProcessImpl</code>, not compiled, and not enabled. An inherited protected key channel,
fail-closed startup without legacy-provider fallback, key lifecycle review and cross-machine
new-profile runtime evidence remain absent. The boolean factory input itself is not proof
of ownership; the future native host must establish it. No snapshot implementation patch is
claimed: a message schema cannot freeze browser subsystems.</p>
<h2 id="durable-lifetime-and-mutation-leases">Durable lifetime and mutation leases</h2>
<p>Before a native process can start, the supervisor durably writes a launch-intent journal outside
the browser profile. After launch it records the verified PID, native 100 ns creation timestamp,
canonical executable and exact profile argument. Interrupted, malformed and unreadable journals
fail closed. Recreated supervisors inspect the current process identity and independently scan
profile arguments; PID reuse never grants permission to control another process.</p>
<p><code>Supervisor::acquire_profile_idle(id)</code> returns a <code>ProfileLease</code> held through snapshot, restore or
removal. Its lock is outside the profile directory, so replacing the directory does not replace
the lock. <code>assert_profile_inactive</code> is an observation only and cannot replace that lease.
Ambiguous launch intents require explicit recovery; the supervisor never silently deletes them.
Native identity and job containment currently support Windows only. Job containment is a safety
boundary, not a claim that forced host termination preserves the browser's last unwritten data.</p>
<p><code>automation_endpoint(id)</code> returns a validated literal IPv4 loopback endpoint only for a running
opt-in profile. Chromium Puppeteer uses CDP, Firefox Puppeteer uses BiDi, and Selenium returns
the pinned driver's WebDriver URL plus the established session ID. Off returns
<code>AUTOMATION_DISABLED</code>. Paired forwarding must constrain WebDriver access to that exact session;
a raw driver endpoint alone allows a client to create unrelated sessions and is not profile
authorization. Native snapshot IPC remains separate and unavailable until engine-side barriers
are implemented.</p>
<p>Focused verification includes torn launch intent, exact profile argument matching, loopback and
mode rejection, independent-supervisor lease exclusion, a real hidden process surviving a
supervisor recreation, PID-reuse rejection, and native job-close termination. These fixtures are
process-control evidence, not browser encryption, identity or snapshot acceptance.</p>
<h2 id="current-native-source-acquisition">Current native source acquisition</h2>
<p><code>engines/recipes/native-pins.json</code> records Chromium 155.0.8059.85 at
<code>0e66b94549a8bd85f03fbdf189b752d6e7b63c32</code> and Firefox 158.0 at
<code>3c71aeacdb296402e41fb2084b13e797d1770642</code>. The root entrypoint accepts
<code>build.bat -Component BrowserNative -NativeEngine chromium -AcquireOnly</code> (or <code>firefox</code>).
It acquires exact upstream revisions into a short, user-scoped native source cache outside
the repository, preserves changes, and verifies the revision. Chromium dependency acquisition
uses a pinned depot-tools revision and the installed Visual Studio toolchain. Source acquisition
does not register a runtime or enable advanced capabilities. Product build and acceptance remain
incomplete until native encryption, identity and whole-profile snapshot integration are real.</p>
`,text:`# Browser engine integration\r
\r
The Rust engine crate manages only explicitly registered, hash-pinned engine bundles. It never\r
searches for or imports an installed personal browser. The native host chooses the bundle and\r
manifest, and passes the persisted profile automation preference into \`LaunchRequest\`.\r
\r
## Current delivery\r
\r
- SHA-256 verification before registration and again immediately before process launch.\r
- Canonical bundle containment, strict UUID profile paths, application-owned profile root and\r
  exclusive supervisor lifetime lock. Browser-native profile locks remain necessary after a host crash.\r
- Chromium and Firefox Off-mode launch arguments contain no driver, debugging port, debugging\r
  pipe or automation flag. No extension or injected script is used to pretend native identity support.\r
- Process status reports the launch root PID, effective mode and pinned engine version. A browser\r
  launcher can exit while its actual browser child remains in the private process job.\r
- Windows Off-mode stop posts WM_CLOSE only after pinning the window owner's live process handle\r
  and checking exact private job membership, creation ordering, executable and the current window\r
  owner. Stop waits at most 30 seconds for native exit and an empty private job. A close prompt,\r
  hung process, failed identity check or unavailable window returns an explicit error and retains\r
  ownership. It does not force-kill. Other platforms report graceful stop unavailable.\r
\r
## Deliberate unavailable capabilities\r
\r
Portable encryption, stable identity and consistent live snapshots are\r
unavailable. A manifest setting any of these true is rejected. A version label or upstream\r
compatibility table alone cannot enable them. Opt-in automation implementation is described below; there are no bundled engines or driver binaries.\r
Engine installation must supply trusted native-host configuration, not untrusted renderer paths.\r
The manifest hashes the executable, not every resource in its bundle. Full bundle integrity and\r
protection against executable replacement between verification and spawn remain pending.\r
\r
The restricted snapshot message schema has request/profile/executable binding and all required\r
barrier acknowledgements. It has no evaluation, arbitrary filesystem or debugging command.\r
Schema validation alone does not establish authenticated transport or real quiescence. The\r
launcher therefore never copies a live directory and always rejects live snapshot requests.\r
Missing implementation: inherited authenticated pipe, child peer verification, browser-wide\r
network/renderer/service-worker/storage barriers, database flush hooks, rollback and recovery,\r
concurrent mutation tests and cross-engine runtime evidence.\r
\r
## Pinned source research\r
\r
Chromium \`134.0.6998.35\` source interfaces were acquired directly from\r
[Chromium source](https://chromium.googlesource.com/chromium/src/+/refs/tags/134.0.6998.35/).\r
This historical revision is a source prototype pin, not a recommendation to run an old browser.\r
See \`engines/recipes/chromium-provider.json\` for exact paths and SHA-256 values.\r
\`KeyProvider\` accepts asynchronous key delivery, encryption eligibility and sync-compatibility\r
reporting. \`BrowserProcessImpl\` assembles providers before constructing \`OSCryptAsync\`.\r
No portable-key provider is integrated or compiled here. A production provider must accept only\r
new application-owned profiles, receive key material through protected native IPC, prevent\r
legacy provider fallback, and prove restored new-profile data across supported machines.\r
It must never import existing browser credentials or alter operating-system protections.\r
\r
[Mozilla's driver table](https://firefox-source-docs.mozilla.org/testing/geckodriver/Support.html)\r
provides compatibility constraints, not a verified adapter. Exact Firefox, geckodriver, Selenium,\r
Puppeteer and Chromium pins plus runtime handshakes remain required before enabling automation.\r
\r
## Opt-in automation adapters\r
\r
\`EngineRegistry::register_adapter(kind, mode, AdapterRuntime)\` accepts a trusted native-host\r
runtime configuration. The configuration pins Node and helper SHA-256, exact browser version,\r
and, for Selenium, the driver's SHA-256 and exact reported driver version. Install adapter\r
packages with \`npm ci --ignore-scripts --prefix engines/adapters\`; the lockfile pins package\r
integrity. It does not download browsers or drivers, and never invokes Selenium Manager.\r
\r
The bundled helper pins \`selenium-webdriver\` 4.51.0 and \`puppeteer-core\` 25.14.0. Selenium uses\r
explicit ChromeDriver or geckodriver service builders and the application profile path.\r
Puppeteer uses a loopback Chromium CDP WebSocket, or Firefox WebDriver BiDi. Chromium explicitly\r
requests an ephemeral debugging port alongside its loopback debugging address. The helper\r
checks the exact browser version and a positive native PID before returning a launch receipt.\r
Version mismatch fails initialization and requests browser close. Configuration and shutdown\r
travel over inherited stdin. No arbitrary user script, navigation or page evaluation command\r
is exposed by this helper. Automation is enabled only by the persisted requested mode.\r
\r
\`EngineRegistry::list()\` reports configured adapters separately from runtime verification.\r
A configured adapter is not runtime proof. A successful \`ProcessStatus\` effective mode follows\r
the helper's exact browser receipt. Native-host trusted installation configuration must supply
a compatible exact browser and driver pair. Earlier launch-root-only results are superseded
for graceful-shutdown interpretation. See [the native automation verification record](native-automation-verification.md)
for the corrected six-run proof and remaining limits; it does not verify other versions.\r
\r
Graceful adapter shutdown calls Puppeteer close or WebDriver quit. A timeout retains process\r
ownership instead of claiming it stopped. Initialization failure closes the helper input first\r
and then terminates the owned process job if it cannot settle. Each helper enters a private\r
Windows job before receiving launch configuration; Off-mode browsers start suspended and enter\r
that job before being resumed. Loss of the supervisor terminates its owned process family.\r
Registered manifests cannot enable custom encryption, identity or\r
snapshot features. Their automation booleans are informational and do not configure adapters.\r
\r
Firefox permits one active BiDi session. The helper releases its initial launch session before\r
returning the endpoint, allowing the external client to connect. It reacquires a session for\r
graceful shutdown after the external client disconnects. While an external client remains\r
attached, stop reports incomplete and retains ownership. The helper stays alive after a Firefox\r
protocol close reply until the native supervisor proves browser exit and that the complete job\r
contains only the exact live helper child. The supervisor then sends a private settlement command\r
and still waits for an empty job. An external client closing the browser is handled through the\r
same independently verified transition. A retained process handle with a nonzero native exit\r
timestamp does not make the exited browser live. Paired RPC reads allow 40 seconds so the native\r
30-second stop result is not replaced by an earlier transport timeout.\r
\r
## Source patch prototype\r
\r
\`engines/recipes/chromium-new-profile-provider.patch\` adds a concrete \`KeyProvider\` implementation\r
against the acquired pinned interface. It accepts an in-memory \`Encryptor::Key\` only through\r
a new application-owned-profile factory, provides the \`mb1\` tag, declines sync compatibility\r
and returns no key on reuse. Patch application was checked. It is not wired into GN or\r
\`BrowserProcessImpl\`, not compiled, and not enabled. An inherited protected key channel,\r
fail-closed startup without legacy-provider fallback, key lifecycle review and cross-machine\r
new-profile runtime evidence remain absent. The boolean factory input itself is not proof\r
of ownership; the future native host must establish it. No snapshot implementation patch is\r
claimed: a message schema cannot freeze browser subsystems.\r
\r
## Durable lifetime and mutation leases\r
\r
Before a native process can start, the supervisor durably writes a launch-intent journal outside\r
the browser profile. After launch it records the verified PID, native 100 ns creation timestamp,\r
canonical executable and exact profile argument. Interrupted, malformed and unreadable journals\r
fail closed. Recreated supervisors inspect the current process identity and independently scan\r
profile arguments; PID reuse never grants permission to control another process.\r
\r
\`Supervisor::acquire_profile_idle(id)\` returns a \`ProfileLease\` held through snapshot, restore or\r
removal. Its lock is outside the profile directory, so replacing the directory does not replace\r
the lock. \`assert_profile_inactive\` is an observation only and cannot replace that lease.\r
Ambiguous launch intents require explicit recovery; the supervisor never silently deletes them.\r
Native identity and job containment currently support Windows only. Job containment is a safety\r
boundary, not a claim that forced host termination preserves the browser's last unwritten data.\r
\r
\`automation_endpoint(id)\` returns a validated literal IPv4 loopback endpoint only for a running\r
opt-in profile. Chromium Puppeteer uses CDP, Firefox Puppeteer uses BiDi, and Selenium returns\r
the pinned driver's WebDriver URL plus the established session ID. Off returns\r
\`AUTOMATION_DISABLED\`. Paired forwarding must constrain WebDriver access to that exact session;\r
a raw driver endpoint alone allows a client to create unrelated sessions and is not profile\r
authorization. Native snapshot IPC remains separate and unavailable until engine-side barriers\r
are implemented.\r
\r
Focused verification includes torn launch intent, exact profile argument matching, loopback and\r
mode rejection, independent-supervisor lease exclusion, a real hidden process surviving a\r
supervisor recreation, PID-reuse rejection, and native job-close termination. These fixtures are\r
process-control evidence, not browser encryption, identity or snapshot acceptance.\r
\r
## Current native source acquisition\r
\r
\`engines/recipes/native-pins.json\` records Chromium 155.0.8059.85 at\r
\`0e66b94549a8bd85f03fbdf189b752d6e7b63c32\` and Firefox 158.0 at\r
\`3c71aeacdb296402e41fb2084b13e797d1770642\`. The root entrypoint accepts\r
\`build.bat -Component BrowserNative -NativeEngine chromium -AcquireOnly\` (or \`firefox\`).\r
It acquires exact upstream revisions into a short, user-scoped native source cache outside\r
the repository, preserves changes, and verifies the revision. Chromium dependency acquisition\r
uses a pinned depot-tools revision and the installed Visual Studio toolchain. Source acquisition\r
does not register a runtime or enable advanced capabilities. Product build and acceptance remain\r
incomplete until native encryption, identity and whole-profile snapshot integration are real.\r
\r
`},{id:"docs/features/engines/native-automation-verification.md",title:"Native automation verification",category:"features",html:`<h1 id="native-automation-verification">Native automation verification</h1>
<h2 id="candidate-and-method">Candidate and method</h2>
<p>The 2026-10-18 verification used source <code>7031adb</code>, the native host built through
<code>build.bat -Component Host</code>, and the exact normal adapter helper. The executable SHA-256 was
<code>4478b78b84d1ccf3554b2df92657e0359c07683783e4f33d6130835437f98906</code> and the helper SHA-256 was
<code>4ba93ccd80d74add40abf168e00d80a6f0461da247fa2d45eb11b98e2dc60833</code>.</p>
<p>The real Chromium 155.0.8059.84 and Firefox 158.0 bundles ran with synthetic, application-owned
profiles on named hidden Windows desktops through the direct Lowlevel launcher. Local and
paired encrypted LAN calls exercised actual browser processes. Private receipts retain launch
and process ancestry observations, source and file hashes, results, and desktop absence checks.
Diagnostic helper variants with browser output forwarding were excluded from acceptance.</p>
<h2 id="verified-behavior">Verified behavior</h2>
<table>
<thead>
<tr>
<th>Combination</th>
<th>Result</th>
</tr>
</thead>
<tbody>
<tr>
<td>Chromium local Off, Selenium, Puppeteer</td>
<td>Passed launch, stop and snapshot for each mode</td>
</tr>
<tr>
<td>Firefox local Off, Selenium, Puppeteer</td>
<td>Passed launch, stop and snapshot for each mode</td>
</tr>
<tr>
<td>Chromium paired LAN Off, Selenium, Puppeteer</td>
<td>Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips</td>
</tr>
<tr>
<td>Firefox paired LAN Off, Selenium, Puppeteer</td>
<td>Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips</td>
</tr>
<tr>
<td>Firefox with an attached external BiDi client</td>
<td>Stop reported incomplete; native ownership, snapshot exclusion and vault-lock exclusion remained active; disconnect and retry completed stop and vault locking</td>
</tr>
<tr>
<td>Firefox closed by an external BiDi client before host stop</td>
<td>Host stop settled the remaining helper, reported no active profiles and permitted vault locking</td>
</tr>
</tbody>
</table>
<p>New profiles defaulted to Off. Off rejected automation endpoint access. Changing a running
profile's preference to Off immediately rejected endpoint access. Snapshots in this fixture
occurred after verified stop and are not consistent live snapshots. The two local hosts exited
normally. LAN fixtures explicitly terminated their owned server during finalization; their
server exit code is not graceful server-shutdown proof.</p>
<p>The four normal matrix fixture launchers exited successfully. Exact hidden-desktop not-found
responses independently proved absence after each run. The targeted Firefox fixtures also
exited successfully; they do not turn an intentionally incomplete attached-client stop into a
successful stop. Their final host teardown is separate from the explicitly checked transitions.</p>
<h2 id="ownership-correction">Ownership correction</h2>
<p>Earlier fixture results that checked only the launch-root or adapter exit are superseded for
graceful-shutdown interpretation. Firefox can exit its launcher while another process in the
same private job owns the browser window. Dropping a kill-on-close job at that point could
terminate surviving browsers. Historical receipt states remain preserved; they are not current
graceful-stop evidence.</p>
<p>The corrected Off close path pins each candidate process handle and verifies exact private job
membership, native liveness, creation ordering, the pinned executable and the current window
owner before posting WM_CLOSE. Stop and reap retain the profile until the native identity is
gone and the complete private job reports zero active members. Native exit timestamps and
eventual job accounting distinguish exited objects from live processes. Observing missing
ancestry alone never authorizes release or termination.</p>
<p>Firefox's single-session BiDi launch client disconnects before exposing its endpoint. A failed
shutdown reconnect keeps the helper alive. After a successful protocol close reply, the helper
still waits for the supervisor's private settlement command. That command requires the exact
browser identity to be gone, the exact retained helper child to remain live, and the complete
job list to contain only that helper. The proof is rechecked within the original stop deadline
because client close can finish after stop begins. This prevents a helper exit hook from
forcing browser closure before native completion.</p>
<p>The paired WebSocket forwarder buffers a bounded upgrade request for the exact owned route,
rejects duplicate Host headers and oversized requests, translates Host to the authenticated
browser endpoint authority, then preserves subsequent frame bytes. Firefox otherwise rejects
the local forwarder's different port with HTTP 400. Paired RPC reads allow 40 seconds for the
native 30-second shutdown result.</p>
<h2 id="focused-checks-and-limitations">Focused checks and limitations</h2>
<p>The candidate passed 16 host tests, 16 engine tests and two adapter option tests. Native tests
cover a helper exiting while its browser survives, retained profile locking, native exit while
the exact child handle stays open, a contained child after its launcher handle is dropped, and
rejection of foreign job members, incorrect executables and invalid creation ordering. Adapter tests
exercise the actual launch options, including an explicit ephemeral loopback debugging port.</p>
<p>The normal matrix disconnects its external Puppeteer client before stop. The separate attached
client case verifies an explicit incomplete stop and retained exclusions, followed by a successful
retry. Neither proves every possible prompt or hung browser, or other engine and driver versions.
The targeted attached-client case does not snapshot after retry; an earlier diagnostic reached a
separate profile-size limit, which remains outside this lifecycle result. No result enables portable
encryption, stable identity, authenticated native snapshot
barriers, cross-machine restoration or live snapshot consistency. Browser resource integrity
beyond the executable pin and native source compilation remain separate acceptance work.</p>
`,text:`# Native automation verification\r
\r
## Candidate and method\r
\r
The 2026-10-18 verification used source \`7031adb\`, the native host built through\r
\`build.bat -Component Host\`, and the exact normal adapter helper. The executable SHA-256 was\r
\`4478b78b84d1ccf3554b2df92657e0359c07683783e4f33d6130835437f98906\` and the helper SHA-256 was\r
\`4ba93ccd80d74add40abf168e00d80a6f0461da247fa2d45eb11b98e2dc60833\`.\r
\r
The real Chromium 155.0.8059.84 and Firefox 158.0 bundles ran with synthetic, application-owned\r
profiles on named hidden Windows desktops through the direct Lowlevel launcher. Local and\r
paired encrypted LAN calls exercised actual browser processes. Private receipts retain launch\r
and process ancestry observations, source and file hashes, results, and desktop absence checks.\r
Diagnostic helper variants with browser output forwarding were excluded from acceptance.\r
\r
## Verified behavior\r
\r
| Combination | Result |\r
| --- | --- |\r
| Chromium local Off, Selenium, Puppeteer | Passed launch, stop and snapshot for each mode |\r
| Firefox local Off, Selenium, Puppeteer | Passed launch, stop and snapshot for each mode |\r
| Chromium paired LAN Off, Selenium, Puppeteer | Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips |\r
| Firefox paired LAN Off, Selenium, Puppeteer | Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips |\r
| Firefox with an attached external BiDi client | Stop reported incomplete; native ownership, snapshot exclusion and vault-lock exclusion remained active; disconnect and retry completed stop and vault locking |\r
| Firefox closed by an external BiDi client before host stop | Host stop settled the remaining helper, reported no active profiles and permitted vault locking |\r
\r
New profiles defaulted to Off. Off rejected automation endpoint access. Changing a running\r
profile's preference to Off immediately rejected endpoint access. Snapshots in this fixture\r
occurred after verified stop and are not consistent live snapshots. The two local hosts exited\r
normally. LAN fixtures explicitly terminated their owned server during finalization; their\r
server exit code is not graceful server-shutdown proof.\r
\r
The four normal matrix fixture launchers exited successfully. Exact hidden-desktop not-found\r
responses independently proved absence after each run. The targeted Firefox fixtures also\r
exited successfully; they do not turn an intentionally incomplete attached-client stop into a\r
successful stop. Their final host teardown is separate from the explicitly checked transitions.\r
\r
## Ownership correction\r
\r
Earlier fixture results that checked only the launch-root or adapter exit are superseded for\r
graceful-shutdown interpretation. Firefox can exit its launcher while another process in the\r
same private job owns the browser window. Dropping a kill-on-close job at that point could\r
terminate surviving browsers. Historical receipt states remain preserved; they are not current\r
graceful-stop evidence.\r
\r
The corrected Off close path pins each candidate process handle and verifies exact private job\r
membership, native liveness, creation ordering, the pinned executable and the current window\r
owner before posting WM_CLOSE. Stop and reap retain the profile until the native identity is\r
gone and the complete private job reports zero active members. Native exit timestamps and\r
eventual job accounting distinguish exited objects from live processes. Observing missing\r
ancestry alone never authorizes release or termination.\r
\r
Firefox's single-session BiDi launch client disconnects before exposing its endpoint. A failed\r
shutdown reconnect keeps the helper alive. After a successful protocol close reply, the helper\r
still waits for the supervisor's private settlement command. That command requires the exact\r
browser identity to be gone, the exact retained helper child to remain live, and the complete\r
job list to contain only that helper. The proof is rechecked within the original stop deadline\r
because client close can finish after stop begins. This prevents a helper exit hook from\r
forcing browser closure before native completion.\r
\r
The paired WebSocket forwarder buffers a bounded upgrade request for the exact owned route,\r
rejects duplicate Host headers and oversized requests, translates Host to the authenticated\r
browser endpoint authority, then preserves subsequent frame bytes. Firefox otherwise rejects\r
the local forwarder's different port with HTTP 400. Paired RPC reads allow 40 seconds for the\r
native 30-second shutdown result.\r
\r
## Focused checks and limitations\r
\r
The candidate passed 16 host tests, 16 engine tests and two adapter option tests. Native tests\r
cover a helper exiting while its browser survives, retained profile locking, native exit while\r
the exact child handle stays open, a contained child after its launcher handle is dropped, and\r
rejection of foreign job members, incorrect executables and invalid creation ordering. Adapter tests\r
exercise the actual launch options, including an explicit ephemeral loopback debugging port.\r
\r
The normal matrix disconnects its external Puppeteer client before stop. The separate attached\r
client case verifies an explicit incomplete stop and retained exclusions, followed by a successful\r
retry. Neither proves every possible prompt or hung browser, or other engine and driver versions.\r
The targeted attached-client case does not snapshot after retry; an earlier diagnostic reached a\r
separate profile-size limit, which remains outside this lifecycle result. No result enables portable\r
encryption, stable identity, authenticated native snapshot\r
barriers, cross-machine restoration or live snapshot consistency. Browser resource integrity\r
beyond the executable pin and native source compilation remain separate acceptance work.\r
`},{id:"docs/features/storage/README.md",title:"Optional ciphertext storage service",category:"features",html:`<h1 id="optional-ciphertext-storage-service">Optional ciphertext storage service</h1>
<p>The optional storage service keeps immutable encrypted objects and opaque revision references. It never accepts vault passwords, profile keys, unlocked browser data or unencrypted snapshots. Encryption and revision validation happen in the native client before transfer. The browser dashboard administers capacity and sessions; it does not unlock profiles.</p>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fstorage%2Fhosting.md">Hosting, pairing and security boundaries</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fstorage%2Fapi.md">HTTP storage API</a></li>
</ul>
<p>The HTTP API has no Postman collection because administration requires a browser-scoped session and a one-use local pairing ceremony. The documented request shapes are intended for integration tests and the bundled dashboard.</p>
`,text:`# Optional ciphertext storage service\r
\r
The optional storage service keeps immutable encrypted objects and opaque revision references. It never accepts vault passwords, profile keys, unlocked browser data or unencrypted snapshots. Encryption and revision validation happen in the native client before transfer. The browser dashboard administers capacity and sessions; it does not unlock profiles.\r
\r
- [Hosting, pairing and security boundaries](hosting.md)\r
- [HTTP storage API](api.md)\r
\r
The HTTP API has no Postman collection because administration requires a browser-scoped session and a one-use local pairing ceremony. The documented request shapes are intended for integration tests and the bundled dashboard.\r
`},{id:"docs/features/storage/api.md",title:"Storage HTTP API",category:"features",html:`<h1 id="storage-http-api">Storage HTTP API</h1>
<p>All paths use exact configured Host values. Browser requests with an Origin must match the HTTP origin exactly. No wildcard CORS or arbitrary filesystem route exists. Responses disable caching and send a restrictive Content Security Policy. Diagnostic failures omit filesystem paths and internal exceptions.</p>
<table>
<thead>
<tr>
<th>Method and path</th>
<th>Request</th>
<th>Response</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>GET /health</code></td>
<td>None</td>
<td>Minimal status, version and HTTP transport label</td>
</tr>
<tr>
<td><code>POST /api/pair</code></td>
<td>JSON <code>{secret}</code> containing the host-issued one-use pairing code</td>
<td>HttpOnly SameSite Strict session cookie; JSON <code>{id,csrfToken,expiresAt}</code></td>
</tr>
<tr>
<td><code>GET /api/session</code></td>
<td>Session cookie</td>
<td>Current id, creation/expiry timestamps and csrfToken</td>
</tr>
<tr>
<td><code>GET /api/stats</code></td>
<td>Session cookie</td>
<td><code>{bytes,chunks,revisions,quotaBytes,maxChunkBytes}</code></td>
</tr>
<tr>
<td><code>GET /api/sessions</code></td>
<td>Session cookie</td>
<td>Session ids and creation/expiry timestamps, with current flag</td>
</tr>
<tr>
<td><code>DELETE /api/sessions/:id</code></td>
<td>Session cookie and <code>X-CSRF-Token</code></td>
<td>Revokes the specified session immediately</td>
</tr>
<tr>
<td><code>POST /api/logout</code></td>
<td>Session cookie and <code>X-CSRF-Token</code></td>
<td>Revokes current session and clears its cookie</td>
</tr>
<tr>
<td><code>PUT /api/vaults/:vault/chunks/:sha256</code></td>
<td>Encrypted octet bytes, Content-Length, cookie and CSRF</td>
<td>Publishes immutable object only after size/hash verification and flush</td>
</tr>
<tr>
<td><code>GET /api/vaults/:vault/chunks/:sha256</code></td>
<td>Session cookie</td>
<td>Encrypted octet bytes</td>
</tr>
<tr>
<td><code>PUT /api/vaults/:vault/revisions/:sha256</code></td>
<td>Same as chunk upload</td>
<td>Immutable encrypted revision envelope</td>
</tr>
<tr>
<td><code>GET /api/vaults/:vault/revisions/:sha256</code></td>
<td>Session cookie</td>
<td>Encrypted revision envelope</td>
</tr>
<tr>
<td><code>GET /api/vaults/:vault/head</code></td>
<td>Session cookie</td>
<td><code>{revisionId}</code> or null</td>
</tr>
<tr>
<td><code>PUT /api/vaults/:vault/head</code></td>
<td>JSON <code>{revisionId,expectedHead}</code>, cookie and CSRF</td>
<td>New head, only if immutable revision exists and expected head matches</td>
</tr>
</tbody>
</table>
<p>Vault identifiers and object identifiers are exactly 64 lowercase hexadecimal characters. Object identifiers are SHA-256 over ciphertext. Head values expose only opaque revision identities. These routes provide administration access to ciphertext; they are not a native-client bearer API. No route uploads passwords, lists the host filesystem, deletes arbitrary paths or accepts command text.</p>
<p>Expected failures include 400 for invalid metadata, 401 for missing/revoked/expired authentication, 403 for Host/Origin/CSRF rejection, 404 for an unavailable object, 409 for a head conflict, 413 for bounds, 422 for a content mismatch, 429 for resource/rate limits and 507 for quota exhaustion. A non-success status never acknowledges durable publication.</p>
`,text:"# Storage HTTP API\r\n\r\nAll paths use exact configured Host values. Browser requests with an Origin must match the HTTP origin exactly. No wildcard CORS or arbitrary filesystem route exists. Responses disable caching and send a restrictive Content Security Policy. Diagnostic failures omit filesystem paths and internal exceptions.\r\n\r\n| Method and path | Request | Response |\r\n| --- | --- | --- |\r\n| `GET /health` | None | Minimal status, version and HTTP transport label |\r\n| `POST /api/pair` | JSON `{secret}` containing the host-issued one-use pairing code | HttpOnly SameSite Strict session cookie; JSON `{id,csrfToken,expiresAt}` |\r\n| `GET /api/session` | Session cookie | Current id, creation/expiry timestamps and csrfToken |\r\n| `GET /api/stats` | Session cookie | `{bytes,chunks,revisions,quotaBytes,maxChunkBytes}` |\r\n| `GET /api/sessions` | Session cookie | Session ids and creation/expiry timestamps, with current flag |\r\n| `DELETE /api/sessions/:id` | Session cookie and `X-CSRF-Token` | Revokes the specified session immediately |\r\n| `POST /api/logout` | Session cookie and `X-CSRF-Token` | Revokes current session and clears its cookie |\r\n| `PUT /api/vaults/:vault/chunks/:sha256` | Encrypted octet bytes, Content-Length, cookie and CSRF | Publishes immutable object only after size/hash verification and flush |\r\n| `GET /api/vaults/:vault/chunks/:sha256` | Session cookie | Encrypted octet bytes |\r\n| `PUT /api/vaults/:vault/revisions/:sha256` | Same as chunk upload | Immutable encrypted revision envelope |\r\n| `GET /api/vaults/:vault/revisions/:sha256` | Session cookie | Encrypted revision envelope |\r\n| `GET /api/vaults/:vault/head` | Session cookie | `{revisionId}` or null |\r\n| `PUT /api/vaults/:vault/head` | JSON `{revisionId,expectedHead}`, cookie and CSRF | New head, only if immutable revision exists and expected head matches |\r\n\r\nVault identifiers and object identifiers are exactly 64 lowercase hexadecimal characters. Object identifiers are SHA-256 over ciphertext. Head values expose only opaque revision identities. These routes provide administration access to ciphertext; they are not a native-client bearer API. No route uploads passwords, lists the host filesystem, deletes arbitrary paths or accepts command text.\r\n\r\nExpected failures include 400 for invalid metadata, 401 for missing/revoked/expired authentication, 403 for Host/Origin/CSRF rejection, 404 for an unavailable object, 409 for a head conflict, 413 for bounds, 422 for a content mismatch, 429 for resource/rate limits and 507 for quota exhaustion. A non-success status never acknowledges durable publication.\r\n"},{id:"docs/features/storage/dashboard.md",title:"Storage administration and setup",category:"features",html:`<h1 id="storage-administration-and-setup">Storage administration and setup</h1>
<p>The optional storage service keeps encrypted chunks and revisions. Its administration console never accepts a vault password or decrypts stored content. Counts and capacity come from the service API. It cannot display decrypted profile names, preview profile contents, or prove another machine can restore a profile.</p>
<h2 id="pair-a-browser">Pair a browser</h2>
<p>Open the host's verified LAN address. Read the HTTP warning, acknowledge the network limitation, and enter the one-use administration pairing code chosen on the host. The code is sent only to the same origin and is cleared after submission. A successful pairing creates an eight-hour HttpOnly, SameSite Strict session cookie. The page retains the CSRF value only in memory and recovers it through the authenticated session endpoint after reload. Sign out revokes the session.</p>
<p>HTTP traffic is not confidential or server-authenticated. Another device on the network may intercept administration traffic or modify the page. Client-side encryption of stored content does not protect the administration session or prevent page tampering. Use a trusted isolated LAN. Do not enter a vault password into this console. HTTPS deployment is not supplied by this version.</p>
<h2 id="inspect-capacity-and-sessions">Inspect capacity and sessions</h2>
<p>Overview reads actual used bytes, quota, chunk count, revision count and maximum chunk size. Refresh reads the service again. If a refresh fails, prior values are explicitly stale. A healthy HTTP response proves only current reachability, not backup integrity, restoration, or deployment completeness.</p>
<p>Sessions lists actual administration sessions. Revoking a session requires an explicit confirmation. Revoking the current session returns to pairing. Expired or restarted-service sessions require a newly generated host pairing code. No browser fingerprint, geolocation, or invented device label is shown.</p>
<h2 id="run-the-portable-setup-companion">Run the portable setup companion</h2>
<p>The Windows setup companion checks Docker Desktop and Compose, accepts a host port and storage directory, and collects the one-use pairing code in a protected field. The code goes over the child process's standard input, never command arguments or environment variables. The companion invokes the bundled supported host script, pulls the published image, starts the tracked Compose service and reports actual health and LAN-address results. Existing data is preserved. Changing an existing data location is refused by the host script rather than silently migrating it.</p>
<p>Cancellation stops the owned launcher but does not remove containers, images, configuration or data. An already-started container may remain running; the result says so. Closing during setup requires the explicit cancel action first. The companion does not approve UAC or change host power, sign-in, firewall or security settings. Missing runtime is reported honestly.</p>
<p>Build from the repository root with <code>build.bat -Component HostingWizard</code>; packaging is routed through <code>build-installer.bat -Component HostingWizard</code>. The <code>apps/hosting-wizard</code> package uses a single portable executable target. Its source validation and resource staging are not native installation proof.</p>
<h2 id="local-preferences-and-guidance">Local preferences and guidance</h2>
<p>Language, theme, density, reduced-motion preference and guide progress remain in this browser's local storage. Clearing browser storage resets those preferences. No pairing code, cookie, CSRF value or decrypted vault material is stored there. Guide checkboxes record the visitor's own progress and do not claim commands executed.</p>
<h2 id="verification-limits">Verification limits</h2>
<p><code>build.bat -Component StorageWeb</code> builds the dashboard without claiming a container build. <code>Storage</code> and <code>HostingWizard</code> build that same pinned local Material Web bundle before their own production step. The setup companion also bundles registered Material Web controls; it never loads scripts or fonts from a CDN. The renderer consumes only allowlisted structured progress states, not raw child output. Oversized output lines are discarded in full.</p>
<p>On resume the companion first checks runtime readiness and reads only the bounded, non-secret host settings file. Existing host port and storage-directory choices replace stale wizard preferences. Protected pairing configuration is never read into the renderer. Stored step progress never skips the readiness check and never restores a pairing code.</p>
<p>The focused service suite passed six cases, including the restrictive script policy plus separate worker allowance. Removing that worker allowance made the focused policy test fail; restoration passed. The root <code>HostingWizard</code> build completed source bundling and resource staging.</p>
<p>At source <code>815045eb1394addce3e96c5c8c857f82078c388d</code>, <code>build-installer.bat -Component HostingWizard</code> produced a 100,321,184-byte portable executable with SHA-256 <code>6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5</code>. Native Authenticode inspection reported <code>NotSigned</code>. The actual portable executable launched on an isolated hidden desktop. Full process-ancestry and exact single-page checks preceded renderer interaction. The unavailable Docker/Compose result and blocked Next action were observed on the actual host. A fresh process using the same isolated profile restored bilingual/light preferences and required a new runtime check. Both owned launch processes and hidden desktops were verified absent after closing.</p>
<p>The 720 \xD7 600 CSS viewport at 1.5 scale had no horizontal document overflow. Genuine captures were inspected, but formal image promotion remains pending because a contemporaneous build-timing receipt was not collected. This narrow observation is not the complete layout matrix. The local Docker daemon was unavailable, so successful configuration, Back/Next after readiness, invalid configuration, service start, cancellation and LAN deployment remain unverified. No readiness result was mocked to reach those later states. Native pointer and keyboard interaction were not established by DOM-action checks.</p>
<p>The current preference search supports plain text and an isolated regular-expression workbench with pattern, flags, escaping and whole-query anchoring. Evaluation is bounded by a worker timeout. This is not a claim that the complete universal visual expression-builder inventory is implemented. Other universal features not represented by this bounded storage interface remain explicit product follow-up work, not silently accepted exceptions.</p>
<p>The implementation owner must record API integration, failed pairing, expired session, revoke, logout, stale data, cancellation, persistence and narrow-layout evidence against the actual built source. Source inspection does not establish native setup success, LAN reachability, release availability or full required-feature compliance. The complete screenshot matrix remains pending until inspected captures are recorded.</p>
<h2 id="\u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981">\u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981</h2>
<p>\u5132\u5B58\u670D\u52D9\u53EA\u4FDD\u5B58\u52A0\u5BC6\u8CC7\u6599\u584A\u540C\u7248\u672C\uFF0C\u7BA1\u7406\u756B\u9762\u5514\u6703\u8981\u6C42\u4FDD\u7BA1\u5EAB\u5BC6\u78BC\uFF0C\u4EA6\u5514\u6703\u89E3\u5BC6\u5167\u5BB9\u3002\u958B\u555F\u4E3B\u6A5F\u5DF2\u9A57\u8B49\u5605\u5340\u57DF\u7DB2\u7D61\u7DB2\u5740\uFF0C\u5148\u95B1\u8B80 HTTP \u98A8\u96AA\uFF0C\u518D\u8F38\u5165\u4E3B\u6A5F\u8A2D\u5B9A\u5605\u4E00\u6B21\u6027\u7BA1\u7406\u914D\u5C0D\u78BC\u3002HTTP \u7121\u6CD5\u4FDD\u969C\u7BA1\u7406\u6D41\u91CF\u79C1\u96B1\uFF0C\u7DB2\u7D61\u4E0A\u5176\u4ED6\u88DD\u7F6E\u53EF\u80FD\u6514\u622A\u5DE5\u4F5C\u968E\u6BB5\u6216\u4FEE\u6539\u7DB2\u9801\uFF1B\u52A0\u5BC6\u5132\u5B58\u5167\u5BB9\u5514\u4EE3\u8868\u7BA1\u7406\u9023\u7DDA\u5B89\u5168\u3002</p>
<p>\u7E3D\u89BD\u986F\u793A\u670D\u52D9\u5BE6\u969B\u56DE\u50B3\u5605\u5BB9\u91CF\u540C\u6578\u91CF\u3002\u66F4\u65B0\u5931\u6557\u6642\uFF0C\u820A\u6578\u64DA\u6703\u6E05\u695A\u6A19\u793A\u3002\u5DE5\u4F5C\u968E\u6BB5\u9801\u9762\u53EF\u78BA\u8A8D\u5F8C\u64A4\u92B7\u5B58\u53D6\u6B0A\uFF1B\u64A4\u92B7\u76EE\u524D\u5DE5\u4F5C\u968E\u6BB5\u5C31\u6703\u8FD4\u56DE\u914D\u5C0D\u756B\u9762\u3002\u8A2D\u5B9A\u7CBE\u9748\u6703\u5BE6\u969B\u6AA2\u67E5 Docker \u540C Compose\uFF0C\u900F\u904E\u6A19\u6E96\u8F38\u5165\u50B3\u9001\u53D7\u4FDD\u8B77\u914D\u5C0D\u78BC\uFF0C\u518D\u555F\u52D5\u670D\u52D9\u540C\u9A57\u8B49\u5065\u5EB7\u72C0\u614B\u3002\u53D6\u6D88\u5514\u6703\u522A\u9664\u65E2\u6709\u8CC7\u6599\uFF0C\u5DF2\u555F\u52D5\u5605\u5BB9\u5668\u53EF\u80FD\u7E7C\u7E8C\u904B\u4F5C\u3002\u64CD\u4F5C\u6307\u5F15\u5605\u9032\u5EA6\u53EA\u4FC2\u4F7F\u7528\u8005\u81EA\u884C\u8A18\u9304\uFF0C\u5514\u4EE3\u8868\u4EFB\u4F55\u6307\u4EE4\u5DF2\u7D93\u57F7\u884C\u3002</p>
`,text:`# Storage administration and setup\r
\r
The optional storage service keeps encrypted chunks and revisions. Its administration console never accepts a vault password or decrypts stored content. Counts and capacity come from the service API. It cannot display decrypted profile names, preview profile contents, or prove another machine can restore a profile.\r
\r
## Pair a browser\r
\r
Open the host's verified LAN address. Read the HTTP warning, acknowledge the network limitation, and enter the one-use administration pairing code chosen on the host. The code is sent only to the same origin and is cleared after submission. A successful pairing creates an eight-hour HttpOnly, SameSite Strict session cookie. The page retains the CSRF value only in memory and recovers it through the authenticated session endpoint after reload. Sign out revokes the session.\r
\r
HTTP traffic is not confidential or server-authenticated. Another device on the network may intercept administration traffic or modify the page. Client-side encryption of stored content does not protect the administration session or prevent page tampering. Use a trusted isolated LAN. Do not enter a vault password into this console. HTTPS deployment is not supplied by this version.\r
\r
## Inspect capacity and sessions\r
\r
Overview reads actual used bytes, quota, chunk count, revision count and maximum chunk size. Refresh reads the service again. If a refresh fails, prior values are explicitly stale. A healthy HTTP response proves only current reachability, not backup integrity, restoration, or deployment completeness.\r
\r
Sessions lists actual administration sessions. Revoking a session requires an explicit confirmation. Revoking the current session returns to pairing. Expired or restarted-service sessions require a newly generated host pairing code. No browser fingerprint, geolocation, or invented device label is shown.\r
\r
## Run the portable setup companion\r
\r
The Windows setup companion checks Docker Desktop and Compose, accepts a host port and storage directory, and collects the one-use pairing code in a protected field. The code goes over the child process's standard input, never command arguments or environment variables. The companion invokes the bundled supported host script, pulls the published image, starts the tracked Compose service and reports actual health and LAN-address results. Existing data is preserved. Changing an existing data location is refused by the host script rather than silently migrating it.\r
\r
Cancellation stops the owned launcher but does not remove containers, images, configuration or data. An already-started container may remain running; the result says so. Closing during setup requires the explicit cancel action first. The companion does not approve UAC or change host power, sign-in, firewall or security settings. Missing runtime is reported honestly.\r
\r
Build from the repository root with \`build.bat -Component HostingWizard\`; packaging is routed through \`build-installer.bat -Component HostingWizard\`. The \`apps/hosting-wizard\` package uses a single portable executable target. Its source validation and resource staging are not native installation proof.\r
\r
## Local preferences and guidance\r
\r
Language, theme, density, reduced-motion preference and guide progress remain in this browser's local storage. Clearing browser storage resets those preferences. No pairing code, cookie, CSRF value or decrypted vault material is stored there. Guide checkboxes record the visitor's own progress and do not claim commands executed.\r
\r
## Verification limits\r
\r
\`build.bat -Component StorageWeb\` builds the dashboard without claiming a container build. \`Storage\` and \`HostingWizard\` build that same pinned local Material Web bundle before their own production step. The setup companion also bundles registered Material Web controls; it never loads scripts or fonts from a CDN. The renderer consumes only allowlisted structured progress states, not raw child output. Oversized output lines are discarded in full.\r
\r
On resume the companion first checks runtime readiness and reads only the bounded, non-secret host settings file. Existing host port and storage-directory choices replace stale wizard preferences. Protected pairing configuration is never read into the renderer. Stored step progress never skips the readiness check and never restores a pairing code.\r
\r
The focused service suite passed six cases, including the restrictive script policy plus separate worker allowance. Removing that worker allowance made the focused policy test fail; restoration passed. The root \`HostingWizard\` build completed source bundling and resource staging.\r
\r
At source \`815045eb1394addce3e96c5c8c857f82078c388d\`, \`build-installer.bat -Component HostingWizard\` produced a 100,321,184-byte portable executable with SHA-256 \`6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5\`. Native Authenticode inspection reported \`NotSigned\`. The actual portable executable launched on an isolated hidden desktop. Full process-ancestry and exact single-page checks preceded renderer interaction. The unavailable Docker/Compose result and blocked Next action were observed on the actual host. A fresh process using the same isolated profile restored bilingual/light preferences and required a new runtime check. Both owned launch processes and hidden desktops were verified absent after closing.\r
\r
The 720 \xD7 600 CSS viewport at 1.5 scale had no horizontal document overflow. Genuine captures were inspected, but formal image promotion remains pending because a contemporaneous build-timing receipt was not collected. This narrow observation is not the complete layout matrix. The local Docker daemon was unavailable, so successful configuration, Back/Next after readiness, invalid configuration, service start, cancellation and LAN deployment remain unverified. No readiness result was mocked to reach those later states. Native pointer and keyboard interaction were not established by DOM-action checks.\r
\r
The current preference search supports plain text and an isolated regular-expression workbench with pattern, flags, escaping and whole-query anchoring. Evaluation is bounded by a worker timeout. This is not a claim that the complete universal visual expression-builder inventory is implemented. Other universal features not represented by this bounded storage interface remain explicit product follow-up work, not silently accepted exceptions.\r
\r
The implementation owner must record API integration, failed pairing, expired session, revoke, logout, stale data, cancellation, persistence and narrow-layout evidence against the actual built source. Source inspection does not establish native setup success, LAN reachability, release availability or full required-feature compliance. The complete screenshot matrix remains pending until inspected captures are recorded.\r
\r
## \u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981\r
\r
\u5132\u5B58\u670D\u52D9\u53EA\u4FDD\u5B58\u52A0\u5BC6\u8CC7\u6599\u584A\u540C\u7248\u672C\uFF0C\u7BA1\u7406\u756B\u9762\u5514\u6703\u8981\u6C42\u4FDD\u7BA1\u5EAB\u5BC6\u78BC\uFF0C\u4EA6\u5514\u6703\u89E3\u5BC6\u5167\u5BB9\u3002\u958B\u555F\u4E3B\u6A5F\u5DF2\u9A57\u8B49\u5605\u5340\u57DF\u7DB2\u7D61\u7DB2\u5740\uFF0C\u5148\u95B1\u8B80 HTTP \u98A8\u96AA\uFF0C\u518D\u8F38\u5165\u4E3B\u6A5F\u8A2D\u5B9A\u5605\u4E00\u6B21\u6027\u7BA1\u7406\u914D\u5C0D\u78BC\u3002HTTP \u7121\u6CD5\u4FDD\u969C\u7BA1\u7406\u6D41\u91CF\u79C1\u96B1\uFF0C\u7DB2\u7D61\u4E0A\u5176\u4ED6\u88DD\u7F6E\u53EF\u80FD\u6514\u622A\u5DE5\u4F5C\u968E\u6BB5\u6216\u4FEE\u6539\u7DB2\u9801\uFF1B\u52A0\u5BC6\u5132\u5B58\u5167\u5BB9\u5514\u4EE3\u8868\u7BA1\u7406\u9023\u7DDA\u5B89\u5168\u3002\r
\r
\u7E3D\u89BD\u986F\u793A\u670D\u52D9\u5BE6\u969B\u56DE\u50B3\u5605\u5BB9\u91CF\u540C\u6578\u91CF\u3002\u66F4\u65B0\u5931\u6557\u6642\uFF0C\u820A\u6578\u64DA\u6703\u6E05\u695A\u6A19\u793A\u3002\u5DE5\u4F5C\u968E\u6BB5\u9801\u9762\u53EF\u78BA\u8A8D\u5F8C\u64A4\u92B7\u5B58\u53D6\u6B0A\uFF1B\u64A4\u92B7\u76EE\u524D\u5DE5\u4F5C\u968E\u6BB5\u5C31\u6703\u8FD4\u56DE\u914D\u5C0D\u756B\u9762\u3002\u8A2D\u5B9A\u7CBE\u9748\u6703\u5BE6\u969B\u6AA2\u67E5 Docker \u540C Compose\uFF0C\u900F\u904E\u6A19\u6E96\u8F38\u5165\u50B3\u9001\u53D7\u4FDD\u8B77\u914D\u5C0D\u78BC\uFF0C\u518D\u555F\u52D5\u670D\u52D9\u540C\u9A57\u8B49\u5065\u5EB7\u72C0\u614B\u3002\u53D6\u6D88\u5514\u6703\u522A\u9664\u65E2\u6709\u8CC7\u6599\uFF0C\u5DF2\u555F\u52D5\u5605\u5BB9\u5668\u53EF\u80FD\u7E7C\u7E8C\u904B\u4F5C\u3002\u64CD\u4F5C\u6307\u5F15\u5605\u9032\u5EA6\u53EA\u4FC2\u4F7F\u7528\u8005\u81EA\u884C\u8A18\u9304\uFF0C\u5514\u4EE3\u8868\u4EFB\u4F55\u6307\u4EE4\u5DF2\u7D93\u57F7\u884C\u3002\r
`},{id:"docs/features/storage/hosting.md",title:"Hosting and pairing",category:"features",html:`<h1 id="hosting-and-pairing">Hosting and pairing</h1>
<p>Run <code>host.bat --detached</code> to pull the published version and start the tracked Compose service. The default port is 8174 on all interfaces. Set <code>STORAGE_PORT</code>, <code>STORAGE_BIND</code> and <code>STORAGE_VERSION</code> before launch when needed. The launcher uses an existing Docker/Compose installation and reports a real failure if it is unavailable. It never installs Docker, changes system security, elevates, restarts the computer or stops unrelated containers.</p>
<p>On first launch the local console asks for a unique one-use pairing code through a protected input. Only its SHA-256 hash is written to the local configuration directory, with inheritance removed and access restricted to the current user and SYSTEM. The plaintext code is not written to configuration or service logs. The configuration directory is mounted read-only in the container. Enter that code in the dashboard to create an eight-hour administration session. Successful pairing atomically records the consumed hash in the persistent data volume, so it cannot be reused, including after restart. <code>host.bat --detached --newPairingCode</code> chooses a new code and recreates only this service to read it. Restarting the service invalidates its in-memory sessions. Keep the configuration and persistent volume private.</p>
<p>The service runs as a non-root user, drops capabilities and uses a read-only root filesystem. Persistent encrypted objects use the named <code>storage-data</code> volume. Normal start, log-view exit and image upgrades preserve that volume. Back up the volume through a consistent administrative storage procedure before destructive maintenance. The launcher never deletes it.</p>
<p><code>host.bat --logs</code> opens a keyboard-driven status/log view. F toggles following, R refreshes, and Q leaves the view while containers keep running. Double-clicking offers detached or log mode. There is one service, <code>storage</code>; no service-selection control is needed for this Compose inventory. Host-side HTTP health is checked through each discovered LAN address and a full verified URL is printed. This proves host-side LAN binding, not reachability from every other device or a firewall exception. The launcher does not weaken the firewall.</p>
<h2 id="http-limitations">HTTP limitations</h2>
<p>The dashboard uses plain HTTP. Browser code, pairing codes, administration cookies and CSRF values can be observed or altered by an active network attacker. Host and Origin validation, SameSite cookies, CSRF checks and CSP limit browser-origin attacks; they do not authenticate downloaded HTTP code or protect HTTP against interception. Pair only on a trusted network. The dashboard must never receive a vault password or profile encryption key. It cannot claim secure unlock or password protection merely because stored objects are encrypted.</p>
<p>Native encrypted transport is a separate endpoint and authentication boundary. Do not transmit a reusable native capability over plaintext LAN HTTP. Native clients must authenticate the pinned transport identity before sending any credential. A reverse proxy or TLS configuration is not silently assumed.</p>
<h2 id="limits-and-recovery">Limits and recovery</h2>
<p>Uploads require Content-Length and a matching lowercase SHA-256 identifier. The default maximum object is 16 MiB, with four active uploads, a 100 GiB service quota, a 30-second request timeout and 300 requests per source address per minute. Pairing is limited more tightly. Sessions are capped at 32. Capacity exhaustion, interruption or a wrong digest never produces an acknowledged object. Temporary files are not visible as objects. A crashed upload can leave a hidden temporary file, which an offline administrator may remove after stopping the service. Such files consume storage and must be included in operational capacity planning.</p>
<p>The server stores only opaque identifiers, byte counts and encrypted revision bodies. The native client authenticates and validates the revision DAG, parent references and chunk references. Head updates use expected-head comparison; a conflict preserves both immutable revisions for client reconciliation. The service does not infer a safe merge or a complete snapshot from object existence.</p>
<h2 id="portable-setup-integration">Portable setup integration</h2>
<p>The portable setup application invokes <code>scripts/host.ps1 -JsonSetup</code> and sends one JSON object through standard input, then closes input. The allowed fields are <code>port</code>, <code>storageDir</code>, <code>pairingCode</code> and <code>rotatePairingCode</code>. The pairing code is never an argument, environment variable, output or retained plaintext file. Input is bounded to 16 KiB. Output is newline-delimited JSON progress with <code>type</code>, <code>stage</code> and <code>state</code>, followed by a result with <code>ok</code>, <code>port</code> and verified <code>urls</code>. Failure returns <code>ok:false</code> and exit code 1 with a sanitized message. Progress stages are <code>validate</code>, <code>runtime</code>, <code>configuration</code>, <code>pull</code>, <code>start</code> and <code>health</code>.</p>
<p>Omitted settings reuse protected local settings. A custom storage directory must be absolute, local, not a drive root, not a link, and empty on first setup. Existing storage destinations cannot be switched through this wizard; data migration requires a separate reviewed operation. Configuration and settings retain their preceding copies under the protected directory. A failed pull or health check does not erase existing data. Port changes and explicit pairing rotation recreate only this service. The service image must already exist in the authorized registry; setup never substitutes a local image for publication proof.</p>
<p>Hosting settings and protected pairing hashes live under the current user's LocalApplicationData directory in <code>MaterialBrowser/hosting</code>, independent of a portable setup application's temporary extraction directory. An explicit <code>-ConfigRoot</code> may select another protected absolute local configuration directory. This argument is a path, never a secret. Compose uses the fixed project name <code>material-browser-storage</code>; named volumes and service identity remain stable across setup relaunches. Config mounts use an absolute directory. Existing source-local <code>.storage-config</code> files are copied to the protected destination only when corresponding destination files are absent; existing settings are never overwritten by migration, and the original files remain preserved. Storage payloads are not moved by this configuration migration.</p>
<p>Native transport adapters can share one <code>createCiphertextStore</code> instance with the HTTP service through <code>createService({store,...})</code>. Share the same instance to preserve head-update serialization across adapters. This option adds no unauthenticated HTTP endpoint.</p>
`,text:"# Hosting and pairing\r\n\r\nRun `host.bat --detached` to pull the published version and start the tracked Compose service. The default port is 8174 on all interfaces. Set `STORAGE_PORT`, `STORAGE_BIND` and `STORAGE_VERSION` before launch when needed. The launcher uses an existing Docker/Compose installation and reports a real failure if it is unavailable. It never installs Docker, changes system security, elevates, restarts the computer or stops unrelated containers.\r\n\r\nOn first launch the local console asks for a unique one-use pairing code through a protected input. Only its SHA-256 hash is written to the local configuration directory, with inheritance removed and access restricted to the current user and SYSTEM. The plaintext code is not written to configuration or service logs. The configuration directory is mounted read-only in the container. Enter that code in the dashboard to create an eight-hour administration session. Successful pairing atomically records the consumed hash in the persistent data volume, so it cannot be reused, including after restart. `host.bat --detached --newPairingCode` chooses a new code and recreates only this service to read it. Restarting the service invalidates its in-memory sessions. Keep the configuration and persistent volume private.\r\n\r\nThe service runs as a non-root user, drops capabilities and uses a read-only root filesystem. Persistent encrypted objects use the named `storage-data` volume. Normal start, log-view exit and image upgrades preserve that volume. Back up the volume through a consistent administrative storage procedure before destructive maintenance. The launcher never deletes it.\r\n\r\n`host.bat --logs` opens a keyboard-driven status/log view. F toggles following, R refreshes, and Q leaves the view while containers keep running. Double-clicking offers detached or log mode. There is one service, `storage`; no service-selection control is needed for this Compose inventory. Host-side HTTP health is checked through each discovered LAN address and a full verified URL is printed. This proves host-side LAN binding, not reachability from every other device or a firewall exception. The launcher does not weaken the firewall.\r\n\r\n## HTTP limitations\r\n\r\nThe dashboard uses plain HTTP. Browser code, pairing codes, administration cookies and CSRF values can be observed or altered by an active network attacker. Host and Origin validation, SameSite cookies, CSRF checks and CSP limit browser-origin attacks; they do not authenticate downloaded HTTP code or protect HTTP against interception. Pair only on a trusted network. The dashboard must never receive a vault password or profile encryption key. It cannot claim secure unlock or password protection merely because stored objects are encrypted.\r\n\r\nNative encrypted transport is a separate endpoint and authentication boundary. Do not transmit a reusable native capability over plaintext LAN HTTP. Native clients must authenticate the pinned transport identity before sending any credential. A reverse proxy or TLS configuration is not silently assumed.\r\n\r\n## Limits and recovery\r\n\r\nUploads require Content-Length and a matching lowercase SHA-256 identifier. The default maximum object is 16 MiB, with four active uploads, a 100 GiB service quota, a 30-second request timeout and 300 requests per source address per minute. Pairing is limited more tightly. Sessions are capped at 32. Capacity exhaustion, interruption or a wrong digest never produces an acknowledged object. Temporary files are not visible as objects. A crashed upload can leave a hidden temporary file, which an offline administrator may remove after stopping the service. Such files consume storage and must be included in operational capacity planning.\r\n\r\nThe server stores only opaque identifiers, byte counts and encrypted revision bodies. The native client authenticates and validates the revision DAG, parent references and chunk references. Head updates use expected-head comparison; a conflict preserves both immutable revisions for client reconciliation. The service does not infer a safe merge or a complete snapshot from object existence.\r\n\r\n## Portable setup integration\r\n\r\nThe portable setup application invokes `scripts/host.ps1 -JsonSetup` and sends one JSON object through standard input, then closes input. The allowed fields are `port`, `storageDir`, `pairingCode` and `rotatePairingCode`. The pairing code is never an argument, environment variable, output or retained plaintext file. Input is bounded to 16 KiB. Output is newline-delimited JSON progress with `type`, `stage` and `state`, followed by a result with `ok`, `port` and verified `urls`. Failure returns `ok:false` and exit code 1 with a sanitized message. Progress stages are `validate`, `runtime`, `configuration`, `pull`, `start` and `health`.\r\n\r\nOmitted settings reuse protected local settings. A custom storage directory must be absolute, local, not a drive root, not a link, and empty on first setup. Existing storage destinations cannot be switched through this wizard; data migration requires a separate reviewed operation. Configuration and settings retain their preceding copies under the protected directory. A failed pull or health check does not erase existing data. Port changes and explicit pairing rotation recreate only this service. The service image must already exist in the authorized registry; setup never substitutes a local image for publication proof.\r\n\r\nHosting settings and protected pairing hashes live under the current user's LocalApplicationData directory in `MaterialBrowser/hosting`, independent of a portable setup application's temporary extraction directory. An explicit `-ConfigRoot` may select another protected absolute local configuration directory. This argument is a path, never a secret. Compose uses the fixed project name `material-browser-storage`; named volumes and service identity remain stable across setup relaunches. Config mounts use an absolute directory. Existing source-local `.storage-config` files are copied to the protected destination only when corresponding destination files are absent; existing settings are never overwritten by migration, and the original files remain preserved. Storage payloads are not moved by this configuration migration.\r\n\r\nNative transport adapters can share one `createCiphertextStore` instance with the HTTP service through `createService({store,...})`. Share the same instance to preserve head-update serialization across adapters. This option adds no unauthenticated HTTP endpoint.\r\n"},{id:"docs/features/vault/README.md",title:"Encrypted vault",category:"features",html:`<h1 id="encrypted-vault">Encrypted vault</h1>
<p>The Rust core implements the command contract in <code>docs/architecture.md</code>. The host serializes
requests and verifies engine ownership and stopped state before snapshot or restore. The core
never launches a browser and never reads a default or personal browser directory.</p>
<h2 id="create-unlock-and-lock">Create, unlock and lock</h2>
<p>Call <code>vault.create</code> with <code>{ "password": "..." }</code> once, then use <code>vault.unlock</code> with the same
shape. <code>vault.lock</code> discards loaded metadata and zeroizes the loaded vault and profile keys.
<code>vault.changePassword</code> accepts <code>oldPassword</code> and <code>newPassword</code>. A random 256-bit vault key is
wrapped with an Argon2id derived password key (64 MiB, three passes, one lane in production).
Authenticated XChaCha20-Poly1305 encryption protects the metadata and every immutable object.
Random 24-byte nonces and context-specific associated data bind ciphertext to its purpose,
profile and object identifier. Unit tests use lower Argon2 costs for disposable synthetic data.</p>
<p>The header exposes only format, random salt and encrypted wrapped key. Metadata includes profile
keys, stable identity configuration, preferences and revision filenames and is encrypted on disk.
Sensitive arguments never appear in errors. Passwords must travel over protected local IPC or
standard input, never command arguments, logs or environment variables.</p>
<p>Locking protects the encrypted store, but does not erase a browser's active working directory or
retained restore backups. Those directories are plaintext working data owned by the vault root.
Use full-disk encryption and operating-system access controls, and close the managed engine
before locking. The host must not present lock as secure deletion of working data.</p>
<h2 id="profiles-and-settings">Profiles and settings</h2>
<p><code>profiles.create</code> accepts <code>name</code> and optional <code>engine</code> (<code>chromium</code> or <code>firefox</code>). Automation
starts <code>off</code>; update it explicitly to <code>selenium</code> or <code>puppeteer</code>. A profile receives a random UUID,
per-profile encryption key and a stable random identity seed. The identity is configuration, not
proof that a managed engine can apply fingerprint changes. <code>profiles.update</code> accepts <code>id</code> and
optional <code>name</code>, <code>automation</code> and boolean <code>sync</code>. The host owns effective automation state and
restart reporting. <code>profiles.duplicate</code> accepts a source <code>id</code> and new <code>name</code>, and creates fresh
identity and keys while retaining engine choice; it does not copy browser data.</p>
<p><code>profiles.list</code> returns an array. <code>settings.get</code> returns <code>{ "preferences": ... }</code>, while
<code>settings.update</code> accepts <code>{ "preferences": { ... } }</code>. Preferences remain encrypted and local,
and are excluded from synchronization. Personal wording payloads must never be stored here if
another layer could export, log or transmit them.</p>
<h2 id="snapshots-and-restore">Snapshots and restore</h2>
<p><code>profiles.snapshot</code> accepts <code>{ "id": "uuid", "running": false }</code>. The host must independently
verify its managed engine is stopped before supplying this assertion. Omitted or true <code>running</code>
returns <code>ENGINE_BARRIER_UNAVAILABLE</code>. No live engine barrier is currently implemented and no
live-safe snapshot claim is supported. Files are read only from <code>active/&lt;profile UUID&gt;</code> under
the manager root. Synthetic data can be placed there by a local test without launching browsers.</p>
<p>Snapshots store immutable encrypted chunks and an encrypted revision manifest. <code>revisions.list</code>
accepts <code>id</code> and returns revisions with <code>id</code>, <code>profileId</code>, <code>parents</code>, <code>createdAt</code> and <code>files</code>.
<code>revisions.restore</code> accepts <code>id</code> and <code>revisionId</code>; the host must stop the profile first. Restore
verifies all content into a new staging directory before swapping the active directory. It
retains the previous directory as a recovery backup. A restore creates a new revision preserving
current parents, so restoring old contents does not discard later history. Browser database
files are never merged. Restore prepares and authenticates content, a new immutable revision,
and candidate encrypted metadata before moving active data. A durable journal names the staged
and previous directories and a flushed encrypted copy of the previous metadata. Failure rolls
back both active data and metadata. Startup rolls back any transaction whose journal remains,
including an interruption after metadata publication. Removing the journal is the commit point.
If filesystem access prevents rollback, operations return <code>RECOVERY_REQUIRED</code>; fix the external
access condition and reopen the vault. Both directory versions and encrypted recovery metadata
remain retained. This is filesystem crash recovery, not a claim of protection from damaged
storage hardware or a filesystem that loses previously flushed writes.</p>
<p>Snapshot and restore check the managed <code>.material-browser.lock</code> with an OS-exclusive lock and
reject an engine collision with <code>PROFILE_RUNNING</code>. On Windows the lock file handle must close
before the directory swap, so the host must retain its process-ownership serialization through
the operation. Snapshot traversal omits the managed lock and native engine lock/IPC files
(<code>SingletonLock</code>, <code>SingletonCookie</code>, <code>SingletonSocket</code>, <code>parent.lock</code>, <code>.parentlock</code>, <code>lock</code>,
<code>DevToolsActivePort</code>, <code>MarionetteActivePort</code>). Restore rejects revisions containing those entries.
Malformed engine/automation or boolean option types return <code>INVALID_ARGUMENT</code> instead of
silently changing behavior.</p>
<h2 id="folder-synchronization">Folder synchronization</h2>
<p><code>sync.configure</code> accepts an absolute <code>folder</code> separate from the vault root. Set a profile's
<code>sync</code> to true before <code>sync.push</code>. The shared directory receives immutable ciphertext chunks,
revision manifests and a random encrypted publication manifest, with publication written last.
No preferences or sync-folder path is exported. Each completed publication includes a small
wrapping header with format, random salt and authenticated encrypted vault key, published before
the encrypted manifest. A new computer calls <code>vault.join</code> with an absolute <code>folder</code> and <code>password</code>.
It authenticates the header, validates the complete encrypted publication and every referenced
chunk/ancestor, then publishes local encrypted metadata and the wrapping header. A wrong password
or incomplete transfer leaves the new vault locked and unpublished, allowing a safe retry.
No manual copying of keys or metadata is required. Join requires an empty local vault and a
dedicated synchronization folder. At most 64 enrollment-header candidates are attempted and
10,000 total directory entries are accepted; archive old complete publications before reaching
these bounds. Do not remove ciphertext still referenced by retained revisions. No timestamp
selects winning data. Password-based independent vault creation creates unrelated keys and does
not join a vault. Network provisioning is outside the core.</p>
<p>Changing a local password replaces its wrapping header for future publications. Previously
published headers remain immutable; changing a password does not revoke access to a vault key
already learned through an older header. Cryptographic access revocation requires key rotation
and re-encryption, which this version does not implement.</p>
<p><code>sync.pull</code> validates authenticated manifests, file paths, profile key equality, every encrypted
chunk, revision identity, and parent completeness. A missing or modified object aborts the
metadata update. Immutable ciphertext copied before an abort may remain harmless unreferenced
objects. The revision DAG computes all heads and retains concurrent revisions. <code>sync.conflicts</code>
returns <code>profileId</code> and <code>revisionIds</code> arrays. <code>sync.resolve</code> accepts <code>id</code> and a selected
<code>revisionId</code>, and creates a new revision whose parents contain every preserved head. It chooses
contents explicitly without timestamp winner rules or database merging. Existing local profile
configuration is retained when a peer advertises an already known profile; distributed profile
rename/deletion reconciliation is not implemented.</p>
<h2 id="bounds-and-security-limits">Bounds and security limits</h2>
<p>Requests are limited to 1 MiB. Encrypted objects and restored or captured aggregate content are
limited to approximately 64 MiB; snapshots contain at most 10,000 files. Oversized inputs fail
explicitly. UUID identifiers, relative path validation and symbolic-link checks reject traversal
and links at the time of inspection. The root must be private to the current OS user; these
checks are not a defense against an adversary concurrently changing the filesystem between
inspection and open. The host must serialize operations, prevent two managers writing the same
root, and protect its local IPC. An OS-exclusive lock rejects a second manager for the same root. The core does not provide secure deletion,
network authentication, live engine barriers or cryptographic access revocation.</p>
<h2 id="native-browser-key-boundary">Native browser key boundary</h2>
<p>Trusted in-process host code can call <code>Manager::with_browser_key(profile_id, callback)</code>
while the vault is unlocked. It supplies a borrowed 32-byte browser key to the callback,
then zeroizes its temporary derived buffer. The callback must not retain, serialize,
log or export the bytes. No JSON command exposes this operation. A locked vault,
unknown profile or invalid profile key is rejected before invoking the callback.</p>
<p>HKDF-SHA256 derives this key from the encrypted per-profile random key, using the
<code>material-browser/browser-native-key/v1</code> salt and an information field containing the
browser purpose, version 1 and profile UUID bytes. Snapshot encryption continues using
its original key domain. Encrypted synchronization and vault joining preserve the
derivation; password changes rewrap the vault key without changing browser keys.
This API alone does not demonstrate browser support or authorize extraction of existing
browser keys. Native adapters must verify their capability and peer identity before
supplying the borrowed bytes through an authenticated protected in-process or pipe route.</p>
<h2 id="verification-commands">Verification commands</h2>
<p>Run <code>build.bat -Component Core</code> and <code>cargo test -p material-browser-core</code> locally. Tests use
synthetic temporary directories and cover wrong passwords, lock/unlock, password rotation,
tampered content, cross-profile restore refusal, traversal, plaintext metadata absence,
concurrent revision preservation, explicit resolution and incomplete synchronization.</p>
`,text:'# Encrypted vault\r\n\r\nThe Rust core implements the command contract in `docs/architecture.md`. The host serializes\r\nrequests and verifies engine ownership and stopped state before snapshot or restore. The core\r\nnever launches a browser and never reads a default or personal browser directory.\r\n\r\n## Create, unlock and lock\r\n\r\nCall `vault.create` with `{ "password": "..." }` once, then use `vault.unlock` with the same\r\nshape. `vault.lock` discards loaded metadata and zeroizes the loaded vault and profile keys.\r\n`vault.changePassword` accepts `oldPassword` and `newPassword`. A random 256-bit vault key is\r\nwrapped with an Argon2id derived password key (64 MiB, three passes, one lane in production).\r\nAuthenticated XChaCha20-Poly1305 encryption protects the metadata and every immutable object.\r\nRandom 24-byte nonces and context-specific associated data bind ciphertext to its purpose,\r\nprofile and object identifier. Unit tests use lower Argon2 costs for disposable synthetic data.\r\n\r\nThe header exposes only format, random salt and encrypted wrapped key. Metadata includes profile\r\nkeys, stable identity configuration, preferences and revision filenames and is encrypted on disk.\r\nSensitive arguments never appear in errors. Passwords must travel over protected local IPC or\r\nstandard input, never command arguments, logs or environment variables.\r\n\r\nLocking protects the encrypted store, but does not erase a browser\'s active working directory or\r\nretained restore backups. Those directories are plaintext working data owned by the vault root.\r\nUse full-disk encryption and operating-system access controls, and close the managed engine\r\nbefore locking. The host must not present lock as secure deletion of working data.\r\n\r\n## Profiles and settings\r\n\r\n`profiles.create` accepts `name` and optional `engine` (`chromium` or `firefox`). Automation\r\nstarts `off`; update it explicitly to `selenium` or `puppeteer`. A profile receives a random UUID,\r\nper-profile encryption key and a stable random identity seed. The identity is configuration, not\r\nproof that a managed engine can apply fingerprint changes. `profiles.update` accepts `id` and\r\noptional `name`, `automation` and boolean `sync`. The host owns effective automation state and\r\nrestart reporting. `profiles.duplicate` accepts a source `id` and new `name`, and creates fresh\r\nidentity and keys while retaining engine choice; it does not copy browser data.\r\n\r\n`profiles.list` returns an array. `settings.get` returns `{ "preferences": ... }`, while\r\n`settings.update` accepts `{ "preferences": { ... } }`. Preferences remain encrypted and local,\r\nand are excluded from synchronization. Personal wording payloads must never be stored here if\r\nanother layer could export, log or transmit them.\r\n\r\n## Snapshots and restore\r\n\r\n`profiles.snapshot` accepts `{ "id": "uuid", "running": false }`. The host must independently\r\nverify its managed engine is stopped before supplying this assertion. Omitted or true `running`\r\nreturns `ENGINE_BARRIER_UNAVAILABLE`. No live engine barrier is currently implemented and no\r\nlive-safe snapshot claim is supported. Files are read only from `active/<profile UUID>` under\r\nthe manager root. Synthetic data can be placed there by a local test without launching browsers.\r\n\r\nSnapshots store immutable encrypted chunks and an encrypted revision manifest. `revisions.list`\r\naccepts `id` and returns revisions with `id`, `profileId`, `parents`, `createdAt` and `files`.\r\n`revisions.restore` accepts `id` and `revisionId`; the host must stop the profile first. Restore\r\nverifies all content into a new staging directory before swapping the active directory. It\r\nretains the previous directory as a recovery backup. A restore creates a new revision preserving\r\ncurrent parents, so restoring old contents does not discard later history. Browser database\r\nfiles are never merged. Restore prepares and authenticates content, a new immutable revision,\r\nand candidate encrypted metadata before moving active data. A durable journal names the staged\r\nand previous directories and a flushed encrypted copy of the previous metadata. Failure rolls\r\nback both active data and metadata. Startup rolls back any transaction whose journal remains,\r\nincluding an interruption after metadata publication. Removing the journal is the commit point.\r\nIf filesystem access prevents rollback, operations return `RECOVERY_REQUIRED`; fix the external\r\naccess condition and reopen the vault. Both directory versions and encrypted recovery metadata\r\nremain retained. This is filesystem crash recovery, not a claim of protection from damaged\r\nstorage hardware or a filesystem that loses previously flushed writes.\r\n\r\nSnapshot and restore check the managed `.material-browser.lock` with an OS-exclusive lock and\r\nreject an engine collision with `PROFILE_RUNNING`. On Windows the lock file handle must close\r\nbefore the directory swap, so the host must retain its process-ownership serialization through\r\nthe operation. Snapshot traversal omits the managed lock and native engine lock/IPC files\r\n(`SingletonLock`, `SingletonCookie`, `SingletonSocket`, `parent.lock`, `.parentlock`, `lock`,\r\n`DevToolsActivePort`, `MarionetteActivePort`). Restore rejects revisions containing those entries.\r\nMalformed engine/automation or boolean option types return `INVALID_ARGUMENT` instead of\r\nsilently changing behavior.\r\n\r\n## Folder synchronization\r\n\r\n`sync.configure` accepts an absolute `folder` separate from the vault root. Set a profile\'s\r\n`sync` to true before `sync.push`. The shared directory receives immutable ciphertext chunks,\r\nrevision manifests and a random encrypted publication manifest, with publication written last.\r\nNo preferences or sync-folder path is exported. Each completed publication includes a small\r\nwrapping header with format, random salt and authenticated encrypted vault key, published before\r\nthe encrypted manifest. A new computer calls `vault.join` with an absolute `folder` and `password`.\r\nIt authenticates the header, validates the complete encrypted publication and every referenced\r\nchunk/ancestor, then publishes local encrypted metadata and the wrapping header. A wrong password\r\nor incomplete transfer leaves the new vault locked and unpublished, allowing a safe retry.\r\nNo manual copying of keys or metadata is required. Join requires an empty local vault and a\r\ndedicated synchronization folder. At most 64 enrollment-header candidates are attempted and\r\n10,000 total directory entries are accepted; archive old complete publications before reaching\r\nthese bounds. Do not remove ciphertext still referenced by retained revisions. No timestamp\r\nselects winning data. Password-based independent vault creation creates unrelated keys and does\r\nnot join a vault. Network provisioning is outside the core.\r\n\r\nChanging a local password replaces its wrapping header for future publications. Previously\r\npublished headers remain immutable; changing a password does not revoke access to a vault key\r\nalready learned through an older header. Cryptographic access revocation requires key rotation\r\nand re-encryption, which this version does not implement.\r\n\r\n`sync.pull` validates authenticated manifests, file paths, profile key equality, every encrypted\r\nchunk, revision identity, and parent completeness. A missing or modified object aborts the\r\nmetadata update. Immutable ciphertext copied before an abort may remain harmless unreferenced\r\nobjects. The revision DAG computes all heads and retains concurrent revisions. `sync.conflicts`\r\nreturns `profileId` and `revisionIds` arrays. `sync.resolve` accepts `id` and a selected\r\n`revisionId`, and creates a new revision whose parents contain every preserved head. It chooses\r\ncontents explicitly without timestamp winner rules or database merging. Existing local profile\r\nconfiguration is retained when a peer advertises an already known profile; distributed profile\r\nrename/deletion reconciliation is not implemented.\r\n\r\n## Bounds and security limits\r\n\r\nRequests are limited to 1 MiB. Encrypted objects and restored or captured aggregate content are\r\nlimited to approximately 64 MiB; snapshots contain at most 10,000 files. Oversized inputs fail\r\nexplicitly. UUID identifiers, relative path validation and symbolic-link checks reject traversal\r\nand links at the time of inspection. The root must be private to the current OS user; these\r\nchecks are not a defense against an adversary concurrently changing the filesystem between\r\ninspection and open. The host must serialize operations, prevent two managers writing the same\r\nroot, and protect its local IPC. An OS-exclusive lock rejects a second manager for the same root. The core does not provide secure deletion,\r\nnetwork authentication, live engine barriers or cryptographic access revocation.\r\n\r\n## Native browser key boundary\r\n\r\nTrusted in-process host code can call `Manager::with_browser_key(profile_id, callback)`\r\nwhile the vault is unlocked. It supplies a borrowed 32-byte browser key to the callback,\r\nthen zeroizes its temporary derived buffer. The callback must not retain, serialize,\r\nlog or export the bytes. No JSON command exposes this operation. A locked vault,\r\nunknown profile or invalid profile key is rejected before invoking the callback.\r\n\r\nHKDF-SHA256 derives this key from the encrypted per-profile random key, using the\r\n`material-browser/browser-native-key/v1` salt and an information field containing the\r\nbrowser purpose, version 1 and profile UUID bytes. Snapshot encryption continues using\r\nits original key domain. Encrypted synchronization and vault joining preserve the\r\nderivation; password changes rewrap the vault key without changing browser keys.\r\nThis API alone does not demonstrate browser support or authorize extraction of existing\r\nbrowser keys. Native adapters must verify their capability and peer identity before\r\nsupplying the borrowed bytes through an authenticated protected in-process or pipe route.\r\n\r\n## Verification commands\r\n\r\nRun `build.bat -Component Core` and `cargo test -p material-browser-core` locally. Tests use\r\nsynthetic temporary directories and cover wrong passwords, lock/unlock, password rotation,\r\ntampered content, cross-profile restore refusal, traversal, plaintext metadata absence,\r\nconcurrent revision preservation, explicit resolution and incomplete synchronization.\r\n'},{id:"wiki/API-and-CLI.md",title:"API and CLI reference",category:"API-and-CLI.md",html:`<h1 id="api-and-cli-reference">API and CLI reference</h1>
<p>The native host exposes a shared command dispatcher. The authoritative current method inventory is in <a href="#/article/docs%2Farchitecture.md">Architecture</a>.</p>
<h2 id="request-envelope">Request envelope</h2>
<pre><code class="language-json">{"id":"example-1","method":"profiles.list","params":{}}
</code></pre>
<p>Success returns <code>id</code> and <code>result</code>. Failure returns <code>id</code> and an <code>error</code> object with <code>code</code> and <code>message</code>. This is a protocol example, not a network request made by this page.</p>
<h2 id="profile-preference-example">Profile preference example</h2>
<pre><code class="language-json">{"id":"example-2","method":"profiles.update","params":{"id":"YOUR_PROFILE_UUID","automation":"off"}}
</code></pre>
<p>Use the exact parameter contract supported by the installed host. Capability-dependent lifecycle and automation operations may be unavailable. A response example must never be treated as a successful real operation.</p>
<h2 id="cli-safety">CLI safety</h2>
<p>Run the installed host's help command to inspect its actual flags before issuing commands. Secrets belong on the supported protected standard-input or local IPC route, never argv, environment variables, command history or logs. This handbook deliberately does not invent a command line whose flags have not been verified against the installed build.</p>
`,text:'# API and CLI reference\r\n\r\nThe native host exposes a shared command dispatcher. The authoritative current method inventory is in [Architecture](../docs/architecture.md).\r\n\r\n## Request envelope\r\n\r\n```json\r\n{"id":"example-1","method":"profiles.list","params":{}}\r\n```\r\n\r\nSuccess returns `id` and `result`. Failure returns `id` and an `error` object with `code` and `message`. This is a protocol example, not a network request made by this page.\r\n\r\n## Profile preference example\r\n\r\n```json\r\n{"id":"example-2","method":"profiles.update","params":{"id":"YOUR_PROFILE_UUID","automation":"off"}}\r\n```\r\n\r\nUse the exact parameter contract supported by the installed host. Capability-dependent lifecycle and automation operations may be unavailable. A response example must never be treated as a successful real operation.\r\n\r\n## CLI safety\r\n\r\nRun the installed host\'s help command to inspect its actual flags before issuing commands. Secrets belong on the supported protected standard-input or local IPC route, never argv, environment variables, command history or logs. This handbook deliberately does not invent a command line whose flags have not been verified against the installed build.\r\n'},{id:"wiki/Automation.md",title:"Automation and browser capabilities",category:"Automation.md",html:`<h1 id="automation-and-browser-capabilities">Automation and browser capabilities</h1>
<p>Automation is opt-in for each profile. The stored choices are off, Selenium and Puppeteer. Off means no automation driver or debugging listener is requested.</p>
<h2 id="requested-and-effective-mode">Requested and effective mode</h2>
<p>Changing the preference on a running profile persists the requested choice but does not change its effective mode immediately. The application must display pending restart. Stop and relaunch through the normal workflow to apply the new choice, and require an actual capability and operation result.</p>
<p>An unsupported engine/mode combination must return an explicit capability error. A saved selection does not prove that a driver or endpoint exists. In particular, managed engine acquisition, patch integration, live snapshot protocols and automation endpoint availability need their own evidence.</p>
<p>The documentation's mode simulator changes only a local example. It never opens a driver, connects to an endpoint or launches a browser.</p>
<h2 id="bundled-runtime-verification">Bundled runtime verification</h2>
<p>The installer now includes complete Chromium and Firefox runtimes, matching drivers and locked Node adapters. The packaged source5922074 passed Off, Selenium and Puppeteer launches/stops for both engines, plus four real automation title roundtrips. Standard launch requires explicit consent because advanced stable identity remains unavailable. See the bundled-engine delivery article and machine-readable desktop runtime summary for exact source/hash scope. Native installation/update remains separate unverified work.</p>
`,text:`# Automation and browser capabilities\r
\r
Automation is opt-in for each profile. The stored choices are off, Selenium and Puppeteer. Off means no automation driver or debugging listener is requested.\r
\r
## Requested and effective mode\r
\r
Changing the preference on a running profile persists the requested choice but does not change its effective mode immediately. The application must display pending restart. Stop and relaunch through the normal workflow to apply the new choice, and require an actual capability and operation result.\r
\r
An unsupported engine/mode combination must return an explicit capability error. A saved selection does not prove that a driver or endpoint exists. In particular, managed engine acquisition, patch integration, live snapshot protocols and automation endpoint availability need their own evidence.\r
\r
The documentation's mode simulator changes only a local example. It never opens a driver, connects to an endpoint or launches a browser.\r


## Bundled runtime verification

The installer now includes complete Chromium and Firefox runtimes, matching drivers and locked Node adapters. The packaged source5922074 passed Off, Selenium and Puppeteer launches/stops for both engines, plus four real automation title roundtrips. Standard launch requires explicit consent because advanced stable identity remains unavailable. See the bundled-engine delivery article and machine-readable desktop runtime summary for exact source/hash scope. Native installation/update remains separate unverified work.
`},{id:"wiki/Getting-started.md",title:"Getting started",category:"Getting-started.md",html:`<h1 id="getting-started">Getting started</h1>
<p>Material Browser manages explicit browser profiles in an encrypted vault. It does not import your ordinary browser profile automatically.</p>
<ol>
<li>Open the desktop application and inspect its connection and capability status.</li>
<li>Use the setup workflow to create a vault in a dedicated directory or join an existing encrypted data directory.</li>
<li>Enter the vault password only through the protected application field. Never put it in a shell argument, URL or log.</li>
<li>Create a named profile and choose an engine that reports support on this computer.</li>
<li>Leave automation off unless a specific task needs it.</li>
<li>Launch only when the engine reports that the requested mode is available.</li>
</ol>
<p>The documentation walkthrough records only your reading progress. Its checkmarks are your confirmations, not evidence that setup ran.</p>
<p>See <a href="#/article/wiki%2FVault-and-computers.md">vault setup</a>, <a href="#/article/wiki%2FAutomation.md">automation</a> and <a href="#/article/wiki%2FSnapshots-and-conflicts.md">snapshots</a>.</p>
`,text:`# Getting started\r
\r
Material Browser manages explicit browser profiles in an encrypted vault. It does not import your ordinary browser profile automatically.\r
\r
1. Open the desktop application and inspect its connection and capability status.\r
2. Use the setup workflow to create a vault in a dedicated directory or join an existing encrypted data directory.\r
3. Enter the vault password only through the protected application field. Never put it in a shell argument, URL or log.\r
4. Create a named profile and choose an engine that reports support on this computer.\r
5. Leave automation off unless a specific task needs it.\r
6. Launch only when the engine reports that the requested mode is available.\r
\r
The documentation walkthrough records only your reading progress. Its checkmarks are your confirmations, not evidence that setup ran.\r
\r
See [vault setup](Vault-and-computers.md), [automation](Automation.md) and [snapshots](Snapshots-and-conflicts.md).\r
`},{id:"wiki/Home.md",title:"Material Browser handbook",category:"Home.md",html:`<h1 id="material-browser-handbook">Material Browser handbook</h1>
<p>Start with <a href="#/article/wiki%2FGetting-started.md">Getting started</a>, then choose the task you need. These pages are bundled in the offline documentation companion and published with the documentation website.</p>
<ul>
<li><a href="#/article/wiki%2FVault-and-computers.md">Vault and computer setup</a></li>
<li><a href="#/article/wiki%2FAutomation.md">Automation and browser capabilities</a></li>
<li><a href="#/article/wiki%2FSnapshots-and-conflicts.md">Snapshots and conflict recovery</a></li>
<li><a href="#/article/wiki%2FStorage.md">Optional encrypted storage</a></li>
<li><a href="#/article/wiki%2FAPI-and-CLI.md">API and CLI</a></li>
<li><a href="#/article/docs%2Farchitecture.md">Architecture</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fwindows-automation.md">Windows build and release automation</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fprofile-launch.md">Profile launch and identity capabilities</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fbundled-engines.md">Bundled browser engines</a></li>
</ul>
<h2 id="evidence-boundaries">Evidence boundaries</h2>
<p>A documented interface is not proof that an installed engine implements it. Read the actual capability result and operation result. Cross-machine restoration, native browser launch, supported installers and deployed storage require separate runtime verification. Interactive examples in this handbook run only in the documentation page and never operate an installed browser or vault.</p>
`,text:`# Material Browser handbook\r
\r
Start with [Getting started](Getting-started.md), then choose the task you need. These pages are bundled in the offline documentation companion and published with the documentation website.\r
\r
- [Vault and computer setup](Vault-and-computers.md)\r
- [Automation and browser capabilities](Automation.md)\r
- [Snapshots and conflict recovery](Snapshots-and-conflicts.md)\r
- [Optional encrypted storage](Storage.md)\r
- [API and CLI](API-and-CLI.md)\r
- [Architecture](../docs/architecture.md)\r
- [Windows build and release automation](../docs/features/delivery/windows-automation.md)\r
- [Profile launch and identity capabilities](../docs/features/desktop/profile-launch.md)\r
- [Bundled browser engines](../docs/features/delivery/bundled-engines.md)\r
\r
## Evidence boundaries\r
\r
A documented interface is not proof that an installed engine implements it. Read the actual capability result and operation result. Cross-machine restoration, native browser launch, supported installers and deployed storage require separate runtime verification. Interactive examples in this handbook run only in the documentation page and never operate an installed browser or vault.\r
`},{id:"wiki/Snapshots-and-conflicts.md",title:"Snapshots and conflict recovery",category:"Snapshots-and-conflicts.md",html:`<h1 id="snapshots-and-conflict-recovery">Snapshots and conflict recovery</h1>
<h2 id="create-and-restore-a-revision">Create and restore a revision</h2>
<p>Use the application's snapshot action and inspect the returned immutable revision. Never manually copy a live browser profile and label it consistent. A running browser needs the supported restricted snapshot protocol; otherwise stop the browser before snapshotting.</p>
<p>Before restoring, preserve the current revision and stop the active browser. Choose the exact revision, review its identity and confirm through the supported restore workflow. Cross-machine restoration and live consistency remain unverified unless the target engine and source combination have actual runtime evidence.</p>
<h2 id="synchronization-conflicts">Synchronization conflicts</h2>
<p>Concurrent revisions preserve both parent relationships and both versions. Compare the two named revisions. Keep the version you intend through the explicit resolution workflow, retaining the other as history where supported. Never merge browser databases, infer a winner from modification time or silently overwrite a conflicting revision.</p>
<p>When an operation fails, keep both copies and retry only after resolving the stated cause. The documentation's conflict diagram explains these choices; it performs no synchronization.</p>
`,text:`# Snapshots and conflict recovery\r
\r
## Create and restore a revision\r
\r
Use the application's snapshot action and inspect the returned immutable revision. Never manually copy a live browser profile and label it consistent. A running browser needs the supported restricted snapshot protocol; otherwise stop the browser before snapshotting.\r
\r
Before restoring, preserve the current revision and stop the active browser. Choose the exact revision, review its identity and confirm through the supported restore workflow. Cross-machine restoration and live consistency remain unverified unless the target engine and source combination have actual runtime evidence.\r
\r
## Synchronization conflicts\r
\r
Concurrent revisions preserve both parent relationships and both versions. Compare the two named revisions. Keep the version you intend through the explicit resolution workflow, retaining the other as history where supported. Never merge browser databases, infer a winner from modification time or silently overwrite a conflicting revision.\r
\r
When an operation fails, keep both copies and retry only after resolving the stated cause. The documentation's conflict diagram explains these choices; it performs no synchronization.\r
`},{id:"wiki/Storage.md",title:"Optional encrypted storage",category:"Storage.md",html:`<h1 id="optional-encrypted-storage">Optional encrypted storage</h1>
<p>The optional container service stores ciphertext. It must not receive vault passwords or decrypted browser data. Keep administration authenticated and use the published deployment configuration for the release you actually installed.</p>
<p>Before deployment, review the storage directory, port, access controls and backup policy. Start only the intended service and verify its real health endpoint and LAN address. A container configuration or a successful image build alone is not deployment proof.</p>
<p>HTTP administration has a network-path tampering limitation. Use the supported protected transport for the intended environment; do not expose the service publicly merely to make a connectivity test pass.</p>
<p>The offline documentation bundle may be served at <code>/docs/</code> by the optional service. The same complete articles and task walkthroughs remain available locally. Installing documentation does not deploy storage, and a walkthrough checkmark never means a service has started.</p>
`,text:`# Optional encrypted storage\r
\r
The optional container service stores ciphertext. It must not receive vault passwords or decrypted browser data. Keep administration authenticated and use the published deployment configuration for the release you actually installed.\r
\r
Before deployment, review the storage directory, port, access controls and backup policy. Start only the intended service and verify its real health endpoint and LAN address. A container configuration or a successful image build alone is not deployment proof.\r
\r
HTTP administration has a network-path tampering limitation. Use the supported protected transport for the intended environment; do not expose the service publicly merely to make a connectivity test pass.\r
\r
The offline documentation bundle may be served at \`/docs/\` by the optional service. The same complete articles and task walkthroughs remain available locally. Installing documentation does not deploy storage, and a walkthrough checkmark never means a service has started.\r
`},{id:"wiki/Vault-and-computers.md",title:"Vault and computer setup",category:"Vault-and-computers.md",html:`<h1 id="vault-and-computer-setup">Vault and computer setup</h1>
<h2 id="create-a-vault">Create a vault</h2>
<p>Choose a dedicated application-owned directory. A vault uses Argon2id key derivation and authenticated XChaCha20-Poly1305 encryption. The native process owns runtime keys. Keep the password in your password manager; the documentation never asks for it.</p>
<p>A successful create or unlock response is required before profile actions become available. A password error or unavailable host is not a successful setup. Lock the vault when finished.</p>
<h2 id="join-another-computer">Join another computer</h2>
<p>Configure an authorized folder synchronization target and bring down the encrypted vault data through the product's supported synchronization workflow. Unlock with the same vault password in the protected native application. Use the capability report on the destination computer before launching any restored profile.</p>
<p>Do not assume a profile can migrate between operating systems, engine versions or computers. These combinations need explicit verification. Copying a running browser directory is not a consistent backup. Preserve source data until the destination has been independently verified.</p>
<h2 id="recovery">Recovery</h2>
<p>A lost password cannot be recovered by this documentation. Keep independent encrypted backups. If setup fails, retain the existing data directory and inspect the operation's structured error. Do not delete the original vault to make a new setup appear successful.</p>
`,text:`# Vault and computer setup\r
\r
## Create a vault\r
\r
Choose a dedicated application-owned directory. A vault uses Argon2id key derivation and authenticated XChaCha20-Poly1305 encryption. The native process owns runtime keys. Keep the password in your password manager; the documentation never asks for it.\r
\r
A successful create or unlock response is required before profile actions become available. A password error or unavailable host is not a successful setup. Lock the vault when finished.\r
\r
## Join another computer\r
\r
Configure an authorized folder synchronization target and bring down the encrypted vault data through the product's supported synchronization workflow. Unlock with the same vault password in the protected native application. Use the capability report on the destination computer before launching any restored profile.\r
\r
Do not assume a profile can migrate between operating systems, engine versions or computers. These combinations need explicit verification. Copying a running browser directory is not a consistent backup. Preserve source data until the destination has been independently verified.\r
\r
## Recovery\r
\r
A lost password cannot be recovered by this documentation. Keep independent encrypted backups. If setup fails, retain the existing data directory and inspect the operation's structured error. Do not delete the original vault to make a new setup appear successful.\r
`}]};function h(n,e,t,r){var a=arguments.length,i=a<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,t):r,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(n,e,t,r);else for(var c=n.length-1;c>=0;c--)(o=n[c])&&(i=(a<3?o(i):a>3?o(e,t,i):o(e,t))||i);return a>3&&i&&Object.defineProperty(e,t,i),i}var P=n=>(e,t)=>{t!==void 0?t.addInitializer(()=>{customElements.define(n,e)}):customElements.define(n,e)};var Te=globalThis,Se=Te.ShadowRoot&&(Te.ShadyCSS===void 0||Te.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ze=Symbol(),St=new WeakMap,pe=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==ze)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(Se&&e===void 0){let r=t!==void 0&&t.length===1;r&&(e=St.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&St.set(t,e))}return e}toString(){return this.cssText}},At=n=>new pe(typeof n=="string"?n:n+"",void 0,ze),w=(n,...e)=>{let t=n.length===1?n[0]:e.reduce((r,a,i)=>r+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(a)+n[i+1],n[0]);return new pe(t,n,ze)},Ct=(n,e)=>{if(Se)n.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let r=document.createElement("style"),a=Te.litNonce;a!==void 0&&r.setAttribute("nonce",a),r.textContent=t.cssText,n.appendChild(r)}},Ue=Se?n=>n:n=>n instanceof CSSStyleSheet?(e=>{let t="";for(let r of e.cssRules)t+=r.cssText;return At(t)})(n):n;var{is:rn,defineProperty:an,getOwnPropertyDescriptor:on,getOwnPropertyNames:sn,getOwnPropertySymbols:dn,getPrototypeOf:cn}=Object,Ae=globalThis,Et=Ae.trustedTypes,ln=Et?Et.emptyScript:"",pn=Ae.reactiveElementPolyfillSupport,he=(n,e)=>n,ue={toAttribute(n,e){switch(e){case Boolean:n=n?ln:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,e){let t=n;switch(e){case Boolean:t=n!==null;break;case Number:t=n===null?null:Number(n);break;case Object:case Array:try{t=JSON.parse(n)}catch{t=null}}return t}},Ce=(n,e)=>!rn(n,e),It={attribute:!0,type:String,converter:ue,reflect:!1,useDefault:!1,hasChanged:Ce};Symbol.metadata??=Symbol("metadata"),Ae.litPropertyMetadata??=new WeakMap;var j=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=It){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let r=Symbol(),a=this.getPropertyDescriptor(e,r,t);a!==void 0&&an(this.prototype,e,a)}}static getPropertyDescriptor(e,t,r){let{get:a,set:i}=on(this.prototype,e)??{get(){return this[t]},set(o){this[t]=o}};return{get:a,set(o){let c=a?.call(this);i?.call(this,o),this.requestUpdate(e,c,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??It}static _$Ei(){if(this.hasOwnProperty(he("elementProperties")))return;let e=cn(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(he("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(he("properties"))){let t=this.properties,r=[...sn(t),...dn(t)];for(let a of r)this.createProperty(a,t[a])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[r,a]of t)this.elementProperties.set(r,a)}this._$Eh=new Map;for(let[t,r]of this.elementProperties){let a=this._$Eu(t,r);a!==void 0&&this._$Eh.set(a,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let r=new Set(e.flat(1/0).reverse());for(let a of r)t.unshift(Ue(a))}else e!==void 0&&t.push(Ue(e));return t}static _$Eu(e,t){let r=t.attribute;return r===!1?void 0:typeof r=="string"?r:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ct(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){let r=this.constructor.elementProperties.get(e),a=this.constructor._$Eu(e,r);if(a!==void 0&&r.reflect===!0){let i=(r.converter?.toAttribute!==void 0?r.converter:ue).toAttribute(t,r.type);this._$Em=e,i==null?this.removeAttribute(a):this.setAttribute(a,i),this._$Em=null}}_$AK(e,t){let r=this.constructor,a=r._$Eh.get(e);if(a!==void 0&&this._$Em!==a){let i=r.getPropertyOptions(a),o=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:ue;this._$Em=a;let c=o.fromAttribute(t,i.type);this[a]=c??this._$Ej?.get(a)??c,this._$Em=null}}requestUpdate(e,t,r,a=!1,i){if(e!==void 0){let o=this.constructor;if(a===!1&&(i=this[e]),r??=o.getPropertyOptions(e),!((r.hasChanged??Ce)(i,t)||r.useDefault&&r.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,r))))return;this.C(e,t,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:a,wrapped:i},o){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),i!==!0||o!==void 0)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),a===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[a,i]of this._$Ep)this[a]=i;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[a,i]of r){let{wrapped:o}=i,c=this[a];o!==!0||this._$AL.has(a)||c===void 0||this.C(a,void 0,i,c)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(t)):this._$EM()}catch(r){throw e=!1,this._$EM(),r}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};j.elementStyles=[],j.shadowRootOptions={mode:"open"},j[he("elementProperties")]=new Map,j[he("finalized")]=new Map,pn?.({ReactiveElement:j}),(Ae.reactiveElementVersions??=[]).push("2.1.2");var hn={attribute:!0,type:String,converter:ue,reflect:!1,hasChanged:Ce},un=(n=hn,e,t)=>{let{kind:r,metadata:a}=t,i=globalThis.litPropertyMetadata.get(a);if(i===void 0&&globalThis.litPropertyMetadata.set(a,i=new Map),r==="setter"&&((n=Object.create(n)).wrapped=!0),i.set(t.name,n),r==="accessor"){let{name:o}=t;return{set(c){let d=e.get.call(this);e.set.call(this,c),this.requestUpdate(o,d,n,!0,c)},init(c){return c!==void 0&&this.C(o,void 0,n,c),c}}}if(r==="setter"){let{name:o}=t;return function(c){let d=this[o];e.call(this,c),this.requestUpdate(o,d,n,!0,c)}}throw Error("Unsupported decorator location: "+r)};function b(n){return(e,t)=>typeof t=="object"?un(n,e,t):((r,a,i)=>{let o=a.hasOwnProperty(i);return a.constructor.createProperty(i,r),o?Object.getOwnPropertyDescriptor(a,i):void 0})(n,e,t)}function F(n){return b({...n,state:!0,attribute:!1})}var q=(n,e,t)=>(t.configurable=!0,t.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(n,e,t),t);function M(n,e){return(t,r,a)=>{let i=o=>o.renderRoot?.querySelector(n)??null;if(e){let{get:o,set:c}=typeof r=="object"?t:a??(()=>{let d=Symbol();return{get(){return this[d]},set(f){this[d]=f}}})();return q(t,r,{get(){let d=o.call(this);return d===void 0&&(d=i(this),(d!==null||this.hasUpdated)&&c.call(this,d)),d}})}return q(t,r,{get(){return i(this)}})}}function Pt(n){return(e,t)=>{let{slot:r,selector:a}=n??{},i="slot"+(r?`[name=${r}]`:":not([name])");return q(e,t,{get(){let o=this.renderRoot?.querySelector(i),c=o?.assignedElements(n)??[];return a===void 0?c:c.filter(d=>d.matches(a))}})}}var Ye=globalThis,_t=n=>n,Ee=Ye.trustedTypes,Rt=Ee?Ee.createPolicy("lit-html",{createHTML:n=>n}):void 0,$t="$lit$",B=`lit$${Math.random().toFixed(9).slice(2)}$`,qt="?"+B,mn=`<${qt}>`,W=document,fe=()=>W.createComment(""),ve=n=>n===null||typeof n!="object"&&typeof n!="function",Je=Array.isArray,fn=n=>Je(n)||typeof n?.[Symbol.iterator]=="function",He=`[ 	
\f\r]`,me=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Nt=/-->/g,Dt=/>/g,V=RegExp(`>|${He}(?:([^\\s"'>=/]+)(${He}*=${He}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ot=/'/g,jt=/"/g,Mt=/^(?:script|style|textarea|title)$/i,Ze=n=>(e,...t)=>({_$litType$:n,strings:e,values:t}),y=Ze(1),$r=Ze(2),qr=Ze(3),L=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),Lt=new WeakMap,G=W.createTreeWalker(W,129);function Bt(n,e){if(!Je(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return Rt!==void 0?Rt.createHTML(e):e}var vn=(n,e)=>{let t=n.length-1,r=[],a,i=e===2?"<svg>":e===3?"<math>":"",o=me;for(let c=0;c<t;c++){let d=n[c],f,g,v=-1,S=0;for(;S<d.length&&(o.lastIndex=S,g=o.exec(d),g!==null);)S=o.lastIndex,o===me?g[1]==="!--"?o=Nt:g[1]!==void 0?o=Dt:g[2]!==void 0?(Mt.test(g[2])&&(a=RegExp("</"+g[2],"g")),o=V):g[3]!==void 0&&(o=V):o===V?g[0]===">"?(o=a??me,v=-1):g[1]===void 0?v=-2:(v=o.lastIndex-g[2].length,f=g[1],o=g[3]===void 0?V:g[3]==='"'?jt:Ot):o===jt||o===Ot?o=V:o===Nt||o===Dt?o=me:(o=V,a=void 0);let C=o===V&&n[c+1].startsWith("/>")?" ":"";i+=o===me?d+mn:v>=0?(r.push(f),d.slice(0,v)+$t+d.slice(v)+B+C):d+B+(v===-2?c:C)}return[Bt(n,i+(n[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),r]},ge=class n{constructor({strings:e,_$litType$:t},r){let a;this.parts=[];let i=0,o=0,c=e.length-1,d=this.parts,[f,g]=vn(e,t);if(this.el=n.createElement(f,r),G.currentNode=this.el.content,t===2||t===3){let v=this.el.content.firstChild;v.replaceWith(...v.childNodes)}for(;(a=G.nextNode())!==null&&d.length<c;){if(a.nodeType===1){if(a.hasAttributes())for(let v of a.getAttributeNames())if(v.endsWith($t)){let S=g[o++],C=a.getAttribute(v).split(B),A=/([.?@])?(.*)/.exec(S);d.push({type:1,index:i,name:A[2],strings:C,ctor:A[1]==="."?Ve:A[1]==="?"?Ge:A[1]==="@"?We:Z}),a.removeAttribute(v)}else v.startsWith(B)&&(d.push({type:6,index:i}),a.removeAttribute(v));if(Mt.test(a.tagName)){let v=a.textContent.split(B),S=v.length-1;if(S>0){a.textContent=Ee?Ee.emptyScript:"";for(let C=0;C<S;C++)a.append(v[C],fe()),G.nextNode(),d.push({type:2,index:++i});a.append(v[S],fe())}}}else if(a.nodeType===8)if(a.data===qt)d.push({type:2,index:i});else{let v=-1;for(;(v=a.data.indexOf(B,v+1))!==-1;)d.push({type:7,index:i}),v+=B.length-1}i++}}static createElement(e,t){let r=W.createElement("template");return r.innerHTML=e,r}};function J(n,e,t=n,r){if(e===L)return e;let a=r!==void 0?t._$Co?.[r]:t._$Cl,i=ve(e)?void 0:e._$litDirective$;return a?.constructor!==i&&(a?._$AO?.(!1),i===void 0?a=void 0:(a=new i(n),a._$AT(n,t,r)),r!==void 0?(t._$Co??=[])[r]=a:t._$Cl=a),a!==void 0&&(e=J(n,a._$AS(n,e.values),a,r)),e}var Fe=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:r}=this._$AD,a=(e?.creationScope??W).importNode(t,!0);G.currentNode=a;let i=G.nextNode(),o=0,c=0,d=r[0];for(;d!==void 0;){if(o===d.index){let f;d.type===2?f=new be(i,i.nextSibling,this,e):d.type===1?f=new d.ctor(i,d.name,d.strings,this,e):d.type===6&&(f=new Ke(i,this,e)),this._$AV.push(f),d=r[++c]}o!==d?.index&&(i=G.nextNode(),o++)}return G.currentNode=W,a}p(e){let t=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}},be=class n{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,a){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=a,this._$Cv=a?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=J(this,e,t),ve(e)?e===m||e==null||e===""?(this._$AH!==m&&this._$AR(),this._$AH=m):e!==this._$AH&&e!==L&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):fn(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==m&&ve(this._$AH)?this._$AA.nextSibling.data=e:this.T(W.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:r}=e,a=typeof r=="number"?this._$AC(e):(r.el===void 0&&(r.el=ge.createElement(Bt(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===a)this._$AH.p(t);else{let i=new Fe(a,this),o=i.u(this.options);i.p(t),this.T(o),this._$AH=i}}_$AC(e){let t=Lt.get(e.strings);return t===void 0&&Lt.set(e.strings,t=new ge(e)),t}k(e){Je(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,r,a=0;for(let i of e)a===t.length?t.push(r=new n(this.O(fe()),this.O(fe()),this,this.options)):r=t[a],r._$AI(i),a++;a<t.length&&(this._$AR(r&&r._$AB.nextSibling,a),t.length=a)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let r=_t(e).nextSibling;_t(e).remove(),e=r}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},Z=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,a,i){this.type=1,this._$AH=m,this._$AN=void 0,this.element=e,this.name=t,this._$AM=a,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=m}_$AI(e,t=this,r,a){let i=this.strings,o=!1;if(i===void 0)e=J(this,e,t,0),o=!ve(e)||e!==this._$AH&&e!==L,o&&(this._$AH=e);else{let c=e,d,f;for(e=i[0],d=0;d<i.length-1;d++)f=J(this,c[r+d],t,d),f===L&&(f=this._$AH[d]),o||=!ve(f)||f!==this._$AH[d],f===m?e=m:e!==m&&(e+=(f??"")+i[d+1]),this._$AH[d]=f}o&&!a&&this.j(e)}j(e){e===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Ve=class extends Z{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===m?void 0:e}},Ge=class extends Z{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==m)}},We=class extends Z{constructor(e,t,r,a,i){super(e,t,r,a,i),this.type=5}_$AI(e,t=this){if((e=J(this,e,t,0)??m)===L)return;let r=this._$AH,a=e===m&&r!==m||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,i=e!==m&&(r===m||a);a&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Ke=class{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){J(this,e)}};var gn=Ye.litHtmlPolyfillSupport;gn?.(ge,be),(Ye.litHtmlVersions??=[]).push("3.3.3");var zt=(n,e,t)=>{let r=t?.renderBefore??e,a=r._$litPart$;if(a===void 0){let i=t?.renderBefore??null;r._$litPart$=a=new be(e.insertBefore(fe(),i),i,void 0,t??{})}return a._$AI(n),a};var Xe=globalThis,k=class extends j{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=zt(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return L}};k._$litElement$=!0,k.finalized=!0,Xe.litElementHydrateSupport?.({LitElement:k});var bn=Xe.litElementPolyfillSupport;bn?.({LitElement:k});(Xe.litElementVersions??=[]).push("4.2.2");var Ie=class extends k{connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}render(){return y`<span class="shadow"></span>`}};var Qe=w`:host,.shadow,.shadow::before,.shadow::after{border-radius:inherit;inset:0;position:absolute;transition-duration:inherit;transition-property:inherit;transition-timing-function:inherit}:host{display:flex;pointer-events:none;transition-property:box-shadow,opacity}.shadow::before,.shadow::after{content:"";transition-property:box-shadow,opacity;--_level: var(--md-elevation-level, 0);--_shadow-color: var(--md-elevation-shadow-color, var(--md-sys-color-shadow, #000))}.shadow::before{box-shadow:0px calc(1px*(clamp(0,var(--_level),1) + clamp(0,var(--_level) - 3,1) + 2*clamp(0,var(--_level) - 4,1))) calc(1px*(2*clamp(0,var(--_level),1) + clamp(0,var(--_level) - 2,1) + clamp(0,var(--_level) - 4,1))) 0px var(--_shadow-color);opacity:.3}.shadow::after{box-shadow:0px calc(1px*(clamp(0,var(--_level),1) + clamp(0,var(--_level) - 1,1) + 2*clamp(0,var(--_level) - 2,3))) calc(1px*(3*clamp(0,var(--_level),2) + 2*clamp(0,var(--_level) - 2,3))) calc(1px*(clamp(0,var(--_level),4) + 2*clamp(0,var(--_level) - 4,1))) var(--_shadow-color);opacity:.15}
`,ia=Qe.styleSheet;var et=class extends Ie{};et.styles=[Qe];et=h([P("md-elevation")],et);var Ut=Symbol("attachableController"),Ht;Ht=new MutationObserver(n=>{for(let e of n)e.target[Ut]?.hostConnected()});var X=class{get htmlFor(){return this.host.getAttribute("for")}set htmlFor(e){e===null?this.host.removeAttribute("for"):this.host.setAttribute("for",e)}get control(){return this.host.hasAttribute("for")?!this.htmlFor||!this.host.isConnected?null:this.host.getRootNode().querySelector(`#${this.htmlFor}`):this.currentControl||this.host.parentElement}set control(e){e?this.attach(e):this.detach()}constructor(e,t){this.host=e,this.onControlChange=t,this.currentControl=null,e.addController(this),e[Ut]=this,Ht?.observe(e,{attributeFilter:["for"]})}attach(e){e!==this.currentControl&&(this.setCurrentControl(e),this.host.removeAttribute("for"))}detach(){this.setCurrentControl(null),this.host.setAttribute("for","")}hostConnected(){this.setCurrentControl(this.control)}hostDisconnected(){this.setCurrentControl(null)}setCurrentControl(e){this.onControlChange(this.currentControl,e),this.currentControl=e}};var yn=["focusin","focusout","pointerdown"],Q=class extends k{constructor(){super(...arguments),this.visible=!1,this.inward=!1,this.attachableController=new X(this,this.onControlChange.bind(this))}get htmlFor(){return this.attachableController.htmlFor}set htmlFor(e){this.attachableController.htmlFor=e}get control(){return this.attachableController.control}set control(e){this.attachableController.control=e}attach(e){this.attachableController.attach(e)}detach(){this.attachableController.detach()}connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}handleEvent(e){if(!e[Ft]){switch(e.type){default:return;case"focusin":this.visible=this.control?.matches(":focus-visible")??!1;break;case"focusout":case"pointerdown":this.visible=!1;break}e[Ft]=!0}}onControlChange(e,t){if(!!1)for(let r of yn)e?.removeEventListener(r,this),t?.addEventListener(r,this)}update(e){e.has("visible")&&this.dispatchEvent(new Event("visibility-changed")),super.update(e)}};h([b({type:Boolean,reflect:!0})],Q.prototype,"visible",void 0);h([b({type:Boolean,reflect:!0})],Q.prototype,"inward",void 0);var Ft=Symbol("handledByFocusRing");var tt=w`:host{animation-delay:0s,calc(var(--md-focus-ring-duration, 600ms)*.25);animation-duration:calc(var(--md-focus-ring-duration, 600ms)*.25),calc(var(--md-focus-ring-duration, 600ms)*.75);animation-timing-function:cubic-bezier(0.2, 0, 0, 1);box-sizing:border-box;color:var(--md-focus-ring-color, var(--md-sys-color-secondary, #625b71));display:none;pointer-events:none;position:absolute}:host([visible]){display:flex}:host(:not([inward])){animation-name:outward-grow,outward-shrink;border-end-end-radius:calc(var(--md-focus-ring-shape-end-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-end-start-radius:calc(var(--md-focus-ring-shape-end-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-start-end-radius:calc(var(--md-focus-ring-shape-start-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-start-start-radius:calc(var(--md-focus-ring-shape-start-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));inset:calc(-1*var(--md-focus-ring-outward-offset, 2px));outline:var(--md-focus-ring-width, 3px) solid currentColor}:host([inward]){animation-name:inward-grow,inward-shrink;border-end-end-radius:calc(var(--md-focus-ring-shape-end-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-end-start-radius:calc(var(--md-focus-ring-shape-end-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-start-end-radius:calc(var(--md-focus-ring-shape-start-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-start-start-radius:calc(var(--md-focus-ring-shape-start-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border:var(--md-focus-ring-width, 3px) solid currentColor;inset:var(--md-focus-ring-inward-offset, 0px)}@keyframes outward-grow{from{outline-width:0}to{outline-width:var(--md-focus-ring-active-width, 8px)}}@keyframes outward-shrink{from{outline-width:var(--md-focus-ring-active-width, 8px)}}@keyframes inward-grow{from{border-width:0}to{border-width:var(--md-focus-ring-active-width, 8px)}}@keyframes inward-shrink{from{border-width:var(--md-focus-ring-active-width, 8px)}}@media(prefers-reduced-motion){:host{animation:none}}
`,Aa=tt.styleSheet;var nt=class extends Q{};nt.styles=[tt];nt=h([P("md-focus-ring")],nt);var Vt={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Gt=n=>(...e)=>({_$litDirective$:n,values:e}),Pe=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};var K=Gt(class extends Pe{constructor(n){if(super(n),n.type!==Vt.ATTRIBUTE||n.name!=="class"||n.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(n){return" "+Object.keys(n).filter(e=>n[e]).join(" ")+" "}update(n,[e]){if(this.st===void 0){this.st=new Set,n.strings!==void 0&&(this.nt=new Set(n.strings.join(" ").split(/\s/).filter(r=>r!=="")));for(let r in e)e[r]&&!this.nt?.has(r)&&this.st.add(r);return this.render(e)}let t=n.element.classList;for(let r of this.st)r in e||(t.remove(r),this.st.delete(r));for(let r in e){let a=!!e[r];a===this.st.has(r)||this.nt?.has(r)||(a?(t.add(r),this.st.add(r)):(t.remove(r),this.st.delete(r)))}return L}});var Wt={STANDARD:"cubic-bezier(0.2, 0, 0, 1)",STANDARD_ACCELERATE:"cubic-bezier(.3,0,1,1)",STANDARD_DECELERATE:"cubic-bezier(0,0,0,1)",EMPHASIZED:"cubic-bezier(.3,0,0,1)",EMPHASIZED_ACCELERATE:"cubic-bezier(.3,0,.8,.15)",EMPHASIZED_DECELERATE:"cubic-bezier(.05,.7,.1,1)"};var wn=450,Kt=225,kn=.2,xn=10,Tn=75,Sn=.35,An="::after",Cn="forwards",E;(function(n){n[n.INACTIVE=0]="INACTIVE",n[n.TOUCH_DELAY=1]="TOUCH_DELAY",n[n.HOLDING=2]="HOLDING",n[n.WAITING_FOR_CLICK=3]="WAITING_FOR_CLICK"})(E||(E={}));var En=["click","contextmenu","pointercancel","pointerdown","pointerenter","pointerleave","pointerup"],In=150,Pn=window.matchMedia("(forced-colors: active)"),z=class extends k{constructor(){super(...arguments),this.disabled=!1,this.hovered=!1,this.pressed=!1,this.rippleSize="",this.rippleScale="",this.initialSize=0,this.state=E.INACTIVE,this.attachableController=new X(this,this.onControlChange.bind(this))}get htmlFor(){return this.attachableController.htmlFor}set htmlFor(e){this.attachableController.htmlFor=e}get control(){return this.attachableController.control}set control(e){this.attachableController.control=e}attach(e){this.attachableController.attach(e)}detach(){this.attachableController.detach()}connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}render(){let e={hovered:this.hovered,pressed:this.pressed};return y`<div class="surface ${K(e)}"></div>`}update(e){e.has("disabled")&&this.disabled&&(this.hovered=!1,this.pressed=!1),super.update(e)}handlePointerenter(e){this.shouldReactToEvent(e)&&(this.hovered=!0)}handlePointerleave(e){this.shouldReactToEvent(e)&&(this.hovered=!1,this.state!==E.INACTIVE&&this.endPressAnimation())}handlePointerup(e){if(this.shouldReactToEvent(e)){if(this.state===E.HOLDING){this.state=E.WAITING_FOR_CLICK;return}if(this.state===E.TOUCH_DELAY){this.state=E.WAITING_FOR_CLICK,this.startPressAnimation(this.rippleStartEvent);return}}}async handlePointerdown(e){if(this.shouldReactToEvent(e)){if(this.rippleStartEvent=e,!this.isTouch(e)){this.state=E.WAITING_FOR_CLICK,this.startPressAnimation(e);return}this.state=E.TOUCH_DELAY,await new Promise(t=>{setTimeout(t,In)}),this.state===E.TOUCH_DELAY&&(this.state=E.HOLDING,this.startPressAnimation(e))}}handleClick(){if(!this.disabled){if(this.state===E.WAITING_FOR_CLICK){this.endPressAnimation();return}this.state===E.INACTIVE&&(this.startPressAnimation(),this.endPressAnimation())}}handlePointercancel(e){this.shouldReactToEvent(e)&&this.endPressAnimation()}handleContextmenu(){this.disabled||this.endPressAnimation()}determineRippleSize(){let{height:e,width:t}=this.getBoundingClientRect(),r=Math.max(e,t),a=Math.max(Sn*r,Tn),i=this.currentCSSZoom??1,o=Math.floor(r*kn/i),d=Math.sqrt(t**2+e**2)+xn;this.initialSize=o;let f=(d+a)/o;this.rippleScale=`${f/i}`,this.rippleSize=`${o}px`}getNormalizedPointerEventCoords(e){let{scrollX:t,scrollY:r}=window,{left:a,top:i}=this.getBoundingClientRect(),o=t+a,c=r+i,{pageX:d,pageY:f}=e,g=this.currentCSSZoom??1;return{x:(d-o)/g,y:(f-c)/g}}getTranslationCoordinates(e){let{height:t,width:r}=this.getBoundingClientRect(),a=this.currentCSSZoom??1,i={x:(r/a-this.initialSize)/2,y:(t/a-this.initialSize)/2},o;return e instanceof PointerEvent?o=this.getNormalizedPointerEventCoords(e):o={x:r/a/2,y:t/a/2},o={x:o.x-this.initialSize/2,y:o.y-this.initialSize/2},{startPoint:o,endPoint:i}}startPressAnimation(e){if(!this.mdRoot)return;this.pressed=!0,this.growAnimation?.cancel(),this.determineRippleSize();let{startPoint:t,endPoint:r}=this.getTranslationCoordinates(e),a=`${t.x}px, ${t.y}px`,i=`${r.x}px, ${r.y}px`;this.growAnimation=this.mdRoot.animate({top:[0,0],left:[0,0],height:[this.rippleSize,this.rippleSize],width:[this.rippleSize,this.rippleSize],transform:[`translate(${a}) scale(1)`,`translate(${i}) scale(${this.rippleScale})`]},{pseudoElement:An,duration:wn,easing:Wt.STANDARD,fill:Cn})}async endPressAnimation(){this.rippleStartEvent=void 0,this.state=E.INACTIVE;let e=this.growAnimation,t=1/0;if(typeof e?.currentTime=="number"?t=e.currentTime:e?.currentTime&&(t=e.currentTime.to("ms").value),t>=Kt){this.pressed=!1;return}await new Promise(r=>{setTimeout(r,Kt-t)}),this.growAnimation===e&&(this.pressed=!1)}shouldReactToEvent(e){if(this.disabled||!e.isPrimary||this.rippleStartEvent&&this.rippleStartEvent.pointerId!==e.pointerId)return!1;if(e.type==="pointerenter"||e.type==="pointerleave")return!this.isTouch(e);let t=e.buttons===1;return this.isTouch(e)||t}isTouch({pointerType:e}){return e==="touch"}async handleEvent(e){if(!Pn?.matches)switch(e.type){case"click":this.handleClick();break;case"contextmenu":this.handleContextmenu();break;case"pointercancel":this.handlePointercancel(e);break;case"pointerdown":await this.handlePointerdown(e);break;case"pointerenter":this.handlePointerenter(e);break;case"pointerleave":this.handlePointerleave(e);break;case"pointerup":this.handlePointerup(e);break;default:break}}onControlChange(e,t){if(!!1)for(let r of En)e?.removeEventListener(r,this),t?.addEventListener(r,this)}};h([b({type:Boolean,reflect:!0})],z.prototype,"disabled",void 0);h([F()],z.prototype,"hovered",void 0);h([F()],z.prototype,"pressed",void 0);h([M(".surface")],z.prototype,"mdRoot",void 0);var rt=w`:host{display:flex;margin:auto;pointer-events:none}:host([disabled]){display:none}@media(forced-colors: active){:host{display:none}}:host,.surface{border-radius:inherit;position:absolute;inset:0;overflow:hidden}.surface{-webkit-tap-highlight-color:rgba(0,0,0,0)}.surface::before,.surface::after{content:"";opacity:0;position:absolute}.surface::before{background-color:var(--md-ripple-hover-color, var(--md-sys-color-on-surface, #1d1b20));inset:0;transition:opacity 15ms linear,background-color 15ms linear}.surface::after{background:radial-gradient(closest-side, var(--md-ripple-pressed-color, var(--md-sys-color-on-surface, #1d1b20)) max(100% - 70px, 65%), transparent 100%);transform-origin:center center;transition:opacity 375ms linear}.hovered::before{background-color:var(--md-ripple-hover-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-ripple-hover-opacity, 0.08)}.pressed::after{opacity:var(--md-ripple-pressed-opacity, 0.12);transition-duration:105ms}
`,ni=rt.styleSheet;var at=class extends z{};at.styles=[rt];at=h([P("md-ripple")],at);var it=["role","ariaAtomic","ariaAutoComplete","ariaBusy","ariaChecked","ariaColCount","ariaColIndex","ariaColSpan","ariaCurrent","ariaDisabled","ariaExpanded","ariaHasPopup","ariaHidden","ariaInvalid","ariaKeyShortcuts","ariaLabel","ariaLevel","ariaLive","ariaModal","ariaMultiLine","ariaMultiSelectable","ariaOrientation","ariaPlaceholder","ariaPosInSet","ariaPressed","ariaReadOnly","ariaRequired","ariaRoleDescription","ariaRowCount","ariaRowIndex","ariaRowSpan","ariaSelected","ariaSetSize","ariaSort","ariaValueMax","ariaValueMin","ariaValueNow","ariaValueText"],_n=it.map(ot);function _e(n){return _n.includes(n)}function ot(n){return n.replace("aria","aria-").replace(/Elements?/g,"").toLowerCase()}var Re=Symbol("privateIgnoreAttributeChangesFor");function ee(n){var e;if(!1)return n;class t extends n{constructor(){super(...arguments),this[e]=new Set}attributeChangedCallback(a,i,o){if(!_e(a)){super.attributeChangedCallback(a,i,o);return}if(this[Re].has(a))return;this[Re].add(a),this.removeAttribute(a),this[Re].delete(a);let c=dt(a);o===null?delete this.dataset[c]:this.dataset[c]=o,this.requestUpdate(dt(a),i)}getAttribute(a){return _e(a)?super.getAttribute(st(a)):super.getAttribute(a)}removeAttribute(a){super.removeAttribute(a),_e(a)&&(super.removeAttribute(st(a)),this.requestUpdate())}}return e=Re,Rn(t),t}function Rn(n){for(let e of it){let t=ot(e),r=st(t),a=dt(t);n.createProperty(e,{attribute:t,noAccessor:!0}),n.createProperty(Symbol(r),{attribute:r,noAccessor:!0}),Object.defineProperty(n.prototype,e,{configurable:!0,enumerable:!0,get(){return this.dataset[a]??null},set(i){let o=this.dataset[a]??null;i!==o&&(i===null?delete this.dataset[a]:this.dataset[a]=i,this.requestUpdate(e,o))}})}}function st(n){return`data-${n}`}function dt(n){return n.replace(/-\w/,e=>e[1].toUpperCase())}function te(n){let e=new MouseEvent("click",{bubbles:!0});return n.dispatchEvent(e),e}function ne(n){return n.currentTarget!==n.target||n.composedPath()[0]!==n.target||n.target.disabled?!1:!Nn(n)}function Nn(n){let e=ct;return e&&(n.preventDefault(),n.stopImmediatePropagation()),Dn(),e}var ct=!1;async function Dn(){ct=!0,await null,ct=!1}var _=Symbol("internals"),lt=Symbol("privateInternals");function re(n){class e extends n{get[_](){return this[lt]||(this[lt]=this.attachInternals()),this[lt]}}return e}var Y=Symbol("getFormValue"),ae=Symbol("getFormState");function ie(n){class e extends n{get form(){return this[_].form}get labels(){return this[_].labels}get name(){return this.getAttribute("name")??""}set name(r){this.setAttribute("name",r)}get disabled(){return this.hasAttribute("disabled")}set disabled(r){this.toggleAttribute("disabled",!!r)}attributeChangedCallback(r,a,i){if(r==="name"||r==="disabled"){let o=r==="disabled"?a!==null:a;this.requestUpdate(r,o);return}super.attributeChangedCallback(r,a,i)}requestUpdate(r,a,i){super.requestUpdate(r,a,i),this[_].setFormValue(this[Y](),this[ae]())}[Y](){return this.getAttribute("value")}[ae](){return this[Y]()}formDisabledCallback(r){this.disabled=r}}return e.formAssociated=!0,h([b({noAccessor:!0})],e.prototype,"name",null),h([b({type:Boolean,noAccessor:!0})],e.prototype,"disabled",null),e}var Jt=Symbol("dispatchHooks");function Ne(n,e){let t=n[Jt];if(!t)throw new Error(`'${n.type}' event needs setupDispatchHooks().`);t.addEventListener("after",e,{once:!0})}var Yt=new WeakMap;function De(n,...e){let t=Yt.get(n);t||(t=new Set,Yt.set(n,t));for(let r of e)t.has(r)||(n.addEventListener(r,a=>{let i=new EventTarget;a[Jt]=i;let o=new AbortController,c=()=>{o.abort(),i.dispatchEvent(new Event("after"))},d=v=>function(){v.call(this),c()};a.stopPropagation=d(a.stopPropagation),a.stopImmediatePropagation=d(a.stopImmediatePropagation);let f=a.composedPath(),g;a.composed&&a.bubbles?g=f[f.length-1]:a.bubbles?g=f[0].getRootNode():g=f[0],g.addEventListener(r,()=>{c()},{once:!0,signal:o.signal})},{capture:!0}),t.add(r))}function Zt(n){class e extends n{get name(){return this.getAttribute("name")??""}set name(r){this.setAttribute("name",r)}constructor(...r){super(...r),this.type="submit",this.value="",!!1&&(De(this,"click"),this.addEventListener("click",async a=>{let i=this.type==="reset",o=this.type==="submit",c=this[_],{form:d}=c;!d||!(o||i)||Ne(a,()=>{if(!a.defaultPrevented){if(i){d.reset();return}d.addEventListener("submit",f=>{Object.defineProperty(f,"submitter",{configurable:!0,enumerable:!0,get:()=>this})},{capture:!0,once:!0}),c.setFormValue(this.value),d.requestSubmit()}})}))}}return h([b()],e.prototype,"type",void 0),h([b({reflect:!0})],e.prototype,"value",void 0),e}var On=ee(Zt(ie(re(k)))),I=class extends On{constructor(){super(),this.softDisabled=!1,this.href="",this.download="",this.target="",this.trailingIcon=!1,this.hasIcon=!1,this.addEventListener("click",this.handleClick.bind(this))}focus(){this.buttonElement?.focus()}blur(){this.buttonElement?.blur()}render(){let e=this.disabled||this.softDisabled,t=this.href?this.renderLink():this.renderButton(),r=this.href?"link":"button";return y`
      ${this.renderElevationOrOutline?.()}
      <div class="background"></div>
      <md-focus-ring part="focus-ring" for=${r}></md-focus-ring>
      <md-ripple
        part="ripple"
        for=${r}
        ?disabled="${e}"></md-ripple>
      ${t}
    `}renderButton(){let{ariaLabel:e,ariaHasPopup:t,ariaExpanded:r}=this;return y`<button
      id="button"
      class="button"
      ?disabled=${this.disabled}
      aria-disabled=${this.softDisabled||m}
      aria-label="${e||m}"
      aria-haspopup="${t||m}"
      aria-expanded="${r||m}">
      ${this.renderContent()}
    </button>`}renderLink(){let{ariaLabel:e,ariaHasPopup:t,ariaExpanded:r}=this;return y`<a
      id="link"
      class="button"
      aria-label="${e||m}"
      aria-haspopup="${t||m}"
      aria-expanded="${r||m}"
      aria-disabled=${this.disabled||this.softDisabled||m}
      tabindex="${this.disabled&&!this.softDisabled?-1:m}"
      href=${this.href}
      download=${this.download||m}
      target=${this.target||m}
      >${this.renderContent()}
    </a>`}renderContent(){let e=y`<slot
      name="icon"
      @slotchange="${this.handleSlotChange}"></slot>`;return y`
      <span class="touch"></span>
      ${this.trailingIcon?m:e}
      <span class="label"><slot></slot></span>
      ${this.trailingIcon?e:m}
    `}handleClick(e){if(this.softDisabled||this.disabled&&this.href){e.stopImmediatePropagation(),e.preventDefault();return}!ne(e)||!this.buttonElement||(this.focus(),te(this.buttonElement))}handleSlotChange(){this.hasIcon=this.assignedIcons.length>0}};I.shadowRootOptions={mode:"open",delegatesFocus:!0};h([b({type:Boolean,attribute:"soft-disabled",reflect:!0})],I.prototype,"softDisabled",void 0);h([b()],I.prototype,"href",void 0);h([b()],I.prototype,"download",void 0);h([b()],I.prototype,"target",void 0);h([b({type:Boolean,attribute:"trailing-icon",reflect:!0})],I.prototype,"trailingIcon",void 0);h([b({type:Boolean,attribute:"has-icon",reflect:!0})],I.prototype,"hasIcon",void 0);h([M(".button")],I.prototype,"buttonElement",void 0);h([Pt({slot:"icon",flatten:!0})],I.prototype,"assignedIcons",void 0);var Oe=class extends I{renderElevationOrOutline(){return y`<md-elevation part="elevation"></md-elevation>`}};var pt=w`:host{--_container-color: var(--md-filled-button-container-color, var(--md-sys-color-primary, #6750a4));--_container-elevation: var(--md-filled-button-container-elevation, 0);--_container-height: var(--md-filled-button-container-height, 40px);--_container-shadow-color: var(--md-filled-button-container-shadow-color, var(--md-sys-color-shadow, #000));--_disabled-container-color: var(--md-filled-button-disabled-container-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-container-elevation: var(--md-filled-button-disabled-container-elevation, 0);--_disabled-container-opacity: var(--md-filled-button-disabled-container-opacity, 0.12);--_disabled-label-text-color: var(--md-filled-button-disabled-label-text-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-label-text-opacity: var(--md-filled-button-disabled-label-text-opacity, 0.38);--_focus-container-elevation: var(--md-filled-button-focus-container-elevation, 0);--_focus-label-text-color: var(--md-filled-button-focus-label-text-color, var(--md-sys-color-on-primary, #fff));--_hover-container-elevation: var(--md-filled-button-hover-container-elevation, 1);--_hover-label-text-color: var(--md-filled-button-hover-label-text-color, var(--md-sys-color-on-primary, #fff));--_hover-state-layer-color: var(--md-filled-button-hover-state-layer-color, var(--md-sys-color-on-primary, #fff));--_hover-state-layer-opacity: var(--md-filled-button-hover-state-layer-opacity, 0.08);--_label-text-color: var(--md-filled-button-label-text-color, var(--md-sys-color-on-primary, #fff));--_label-text-font: var(--md-filled-button-label-text-font, var(--md-sys-typescale-label-large-font, var(--md-ref-typeface-plain, Roboto)));--_label-text-line-height: var(--md-filled-button-label-text-line-height, var(--md-sys-typescale-label-large-line-height, 1.25rem));--_label-text-size: var(--md-filled-button-label-text-size, var(--md-sys-typescale-label-large-size, 0.875rem));--_label-text-weight: var(--md-filled-button-label-text-weight, var(--md-sys-typescale-label-large-weight, var(--md-ref-typeface-weight-medium, 500)));--_pressed-container-elevation: var(--md-filled-button-pressed-container-elevation, 0);--_pressed-label-text-color: var(--md-filled-button-pressed-label-text-color, var(--md-sys-color-on-primary, #fff));--_pressed-state-layer-color: var(--md-filled-button-pressed-state-layer-color, var(--md-sys-color-on-primary, #fff));--_pressed-state-layer-opacity: var(--md-filled-button-pressed-state-layer-opacity, 0.12);--_disabled-icon-color: var(--md-filled-button-disabled-icon-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-icon-opacity: var(--md-filled-button-disabled-icon-opacity, 0.38);--_focus-icon-color: var(--md-filled-button-focus-icon-color, var(--md-sys-color-on-primary, #fff));--_hover-icon-color: var(--md-filled-button-hover-icon-color, var(--md-sys-color-on-primary, #fff));--_icon-color: var(--md-filled-button-icon-color, var(--md-sys-color-on-primary, #fff));--_icon-size: var(--md-filled-button-icon-size, 18px);--_pressed-icon-color: var(--md-filled-button-pressed-icon-color, var(--md-sys-color-on-primary, #fff));--_container-shape-start-start: var(--md-filled-button-container-shape-start-start, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-start-end: var(--md-filled-button-container-shape-start-end, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-end: var(--md-filled-button-container-shape-end-end, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-start: var(--md-filled-button-container-shape-end-start, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_leading-space: var(--md-filled-button-leading-space, 24px);--_trailing-space: var(--md-filled-button-trailing-space, 24px);--_with-leading-icon-leading-space: var(--md-filled-button-with-leading-icon-leading-space, 16px);--_with-leading-icon-trailing-space: var(--md-filled-button-with-leading-icon-trailing-space, 24px);--_with-trailing-icon-leading-space: var(--md-filled-button-with-trailing-icon-leading-space, 24px);--_with-trailing-icon-trailing-space: var(--md-filled-button-with-trailing-icon-trailing-space, 16px)}
`,eo=pt.styleSheet;var ht=w`md-elevation{transition-duration:280ms}:host(:is([disabled],[soft-disabled])) md-elevation{transition:none}md-elevation{--md-elevation-level: var(--_container-elevation);--md-elevation-shadow-color: var(--_container-shadow-color)}:host(:focus-within) md-elevation{--md-elevation-level: var(--_focus-container-elevation)}:host(:hover) md-elevation{--md-elevation-level: var(--_hover-container-elevation)}:host(:active) md-elevation{--md-elevation-level: var(--_pressed-container-elevation)}:host(:is([disabled],[soft-disabled])) md-elevation{--md-elevation-level: var(--_disabled-container-elevation)}
`,ao=ht.styleSheet;var ye=w`:host{border-start-start-radius:var(--_container-shape-start-start);border-start-end-radius:var(--_container-shape-start-end);border-end-start-radius:var(--_container-shape-end-start);border-end-end-radius:var(--_container-shape-end-end);box-sizing:border-box;cursor:pointer;display:inline-flex;gap:8px;min-height:var(--_container-height);outline:none;padding-block:calc((var(--_container-height) - max(var(--_label-text-line-height),var(--_icon-size)))/2);padding-inline-start:var(--_leading-space);padding-inline-end:var(--_trailing-space);place-content:center;place-items:center;position:relative;font-family:var(--_label-text-font);font-size:var(--_label-text-size);line-height:var(--_label-text-line-height);font-weight:var(--_label-text-weight);text-overflow:ellipsis;text-wrap:nowrap;user-select:none;-webkit-tap-highlight-color:rgba(0,0,0,0);vertical-align:top;--md-ripple-hover-color: var(--_hover-state-layer-color);--md-ripple-pressed-color: var(--_pressed-state-layer-color);--md-ripple-hover-opacity: var(--_hover-state-layer-opacity);--md-ripple-pressed-opacity: var(--_pressed-state-layer-opacity)}md-focus-ring{--md-focus-ring-shape-start-start: var(--_container-shape-start-start);--md-focus-ring-shape-start-end: var(--_container-shape-start-end);--md-focus-ring-shape-end-end: var(--_container-shape-end-end);--md-focus-ring-shape-end-start: var(--_container-shape-end-start)}:host(:is([disabled],[soft-disabled])){cursor:default;pointer-events:none}.button{border-radius:inherit;cursor:inherit;display:inline-flex;align-items:center;justify-content:center;border:none;outline:none;-webkit-appearance:none;vertical-align:middle;background:rgba(0,0,0,0);text-decoration:none;min-width:calc(64px - var(--_leading-space) - var(--_trailing-space));width:100%;z-index:0;height:100%;font:inherit;color:var(--_label-text-color);padding:0;gap:inherit;text-transform:inherit}.button::-moz-focus-inner{padding:0;border:0}:host(:hover) .button{color:var(--_hover-label-text-color)}:host(:focus-within) .button{color:var(--_focus-label-text-color)}:host(:active) .button{color:var(--_pressed-label-text-color)}.background{background:var(--_container-color);border-radius:inherit;inset:0;position:absolute}.label{overflow:hidden}:is(.button,.label,.label slot),.label ::slotted(*){text-overflow:inherit}:host(:is([disabled],[soft-disabled])) .label{color:var(--_disabled-label-text-color);opacity:var(--_disabled-label-text-opacity)}:host(:is([disabled],[soft-disabled])) .background{background:var(--_disabled-container-color);opacity:var(--_disabled-container-opacity)}@media(forced-colors: active){.background{border:1px solid CanvasText}:host(:is([disabled],[soft-disabled])){--_disabled-icon-color: GrayText;--_disabled-icon-opacity: 1;--_disabled-container-opacity: 1;--_disabled-label-text-color: GrayText;--_disabled-label-text-opacity: 1}}:host([has-icon]:not([trailing-icon])){padding-inline-start:var(--_with-leading-icon-leading-space);padding-inline-end:var(--_with-leading-icon-trailing-space)}:host([has-icon][trailing-icon]){padding-inline-start:var(--_with-trailing-icon-leading-space);padding-inline-end:var(--_with-trailing-icon-trailing-space)}::slotted([slot=icon]){display:inline-flex;position:relative;writing-mode:horizontal-tb;fill:currentColor;flex-shrink:0;color:var(--_icon-color);font-size:var(--_icon-size);inline-size:var(--_icon-size);block-size:var(--_icon-size)}:host(:hover) ::slotted([slot=icon]){color:var(--_hover-icon-color)}:host(:focus-within) ::slotted([slot=icon]){color:var(--_focus-icon-color)}:host(:active) ::slotted([slot=icon]){color:var(--_pressed-icon-color)}:host(:is([disabled],[soft-disabled])) ::slotted([slot=icon]){color:var(--_disabled-icon-color);opacity:var(--_disabled-icon-opacity)}.touch{position:absolute;top:50%;height:max(48px,100%);left:0;right:0;transform:translateY(-50%)}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--_container-height))/2) 0}:host([touch-target=none]) .touch{display:none}
`,co=ye.styleSheet;var ut=class extends Oe{};ut.styles=[ye,ht,pt];ut=h([P("md-filled-button")],ut);var je=class extends I{renderElevationOrOutline(){return y`<div class="outline"></div>`}};var mt=w`:host{--_container-height: var(--md-outlined-button-container-height, 40px);--_disabled-label-text-color: var(--md-outlined-button-disabled-label-text-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-label-text-opacity: var(--md-outlined-button-disabled-label-text-opacity, 0.38);--_disabled-outline-color: var(--md-outlined-button-disabled-outline-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-outline-opacity: var(--md-outlined-button-disabled-outline-opacity, 0.12);--_focus-label-text-color: var(--md-outlined-button-focus-label-text-color, var(--md-sys-color-primary, #6750a4));--_hover-label-text-color: var(--md-outlined-button-hover-label-text-color, var(--md-sys-color-primary, #6750a4));--_hover-state-layer-color: var(--md-outlined-button-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--_hover-state-layer-opacity: var(--md-outlined-button-hover-state-layer-opacity, 0.08);--_label-text-color: var(--md-outlined-button-label-text-color, var(--md-sys-color-primary, #6750a4));--_label-text-font: var(--md-outlined-button-label-text-font, var(--md-sys-typescale-label-large-font, var(--md-ref-typeface-plain, Roboto)));--_label-text-line-height: var(--md-outlined-button-label-text-line-height, var(--md-sys-typescale-label-large-line-height, 1.25rem));--_label-text-size: var(--md-outlined-button-label-text-size, var(--md-sys-typescale-label-large-size, 0.875rem));--_label-text-weight: var(--md-outlined-button-label-text-weight, var(--md-sys-typescale-label-large-weight, var(--md-ref-typeface-weight-medium, 500)));--_outline-color: var(--md-outlined-button-outline-color, var(--md-sys-color-outline, #79747e));--_outline-width: var(--md-outlined-button-outline-width, 1px);--_pressed-label-text-color: var(--md-outlined-button-pressed-label-text-color, var(--md-sys-color-primary, #6750a4));--_pressed-outline-color: var(--md-outlined-button-pressed-outline-color, var(--md-sys-color-outline, #79747e));--_pressed-state-layer-color: var(--md-outlined-button-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--_pressed-state-layer-opacity: var(--md-outlined-button-pressed-state-layer-opacity, 0.12);--_disabled-icon-color: var(--md-outlined-button-disabled-icon-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-icon-opacity: var(--md-outlined-button-disabled-icon-opacity, 0.38);--_focus-icon-color: var(--md-outlined-button-focus-icon-color, var(--md-sys-color-primary, #6750a4));--_hover-icon-color: var(--md-outlined-button-hover-icon-color, var(--md-sys-color-primary, #6750a4));--_icon-color: var(--md-outlined-button-icon-color, var(--md-sys-color-primary, #6750a4));--_icon-size: var(--md-outlined-button-icon-size, 18px);--_pressed-icon-color: var(--md-outlined-button-pressed-icon-color, var(--md-sys-color-primary, #6750a4));--_container-shape-start-start: var(--md-outlined-button-container-shape-start-start, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-start-end: var(--md-outlined-button-container-shape-start-end, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-end: var(--md-outlined-button-container-shape-end-end, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-start: var(--md-outlined-button-container-shape-end-start, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_leading-space: var(--md-outlined-button-leading-space, 24px);--_trailing-space: var(--md-outlined-button-trailing-space, 24px);--_with-leading-icon-leading-space: var(--md-outlined-button-with-leading-icon-leading-space, 16px);--_with-leading-icon-trailing-space: var(--md-outlined-button-with-leading-icon-trailing-space, 24px);--_with-trailing-icon-leading-space: var(--md-outlined-button-with-trailing-icon-leading-space, 24px);--_with-trailing-icon-trailing-space: var(--md-outlined-button-with-trailing-icon-trailing-space, 16px);--_container-color: none;--_disabled-container-color: none;--_disabled-container-opacity: 0}.outline{inset:0;border-style:solid;position:absolute;box-sizing:border-box;border-color:var(--_outline-color);border-start-start-radius:var(--_container-shape-start-start);border-start-end-radius:var(--_container-shape-start-end);border-end-start-radius:var(--_container-shape-end-start);border-end-end-radius:var(--_container-shape-end-end)}:host(:active) .outline{border-color:var(--_pressed-outline-color)}:host(:is([disabled],[soft-disabled])) .outline{border-color:var(--_disabled-outline-color);opacity:var(--_disabled-outline-opacity)}@media(forced-colors: active){:host(:is([disabled],[soft-disabled])) .background{border-color:GrayText}:host(:is([disabled],[soft-disabled])) .outline{opacity:1}}.outline,md-ripple{border-width:var(--_outline-width)}md-ripple{inline-size:calc(100% - 2*var(--_outline-width));block-size:calc(100% - 2*var(--_outline-width));border-style:solid;border-color:rgba(0,0,0,0)}
`,Co=mt.styleSheet;var ft=class extends je{};ft.styles=[ye,mt];ft=h([P("md-outlined-button")],ft);function Le(n,e){e.bubbles&&(!n.shadowRoot||e.composed)&&e.stopPropagation();let t=Reflect.construct(e.constructor,[e.type,e]),r=n.dispatchEvent(t);return r||e.preventDefault(),r}var oe=Symbol("createValidator"),se=Symbol("getValidityAnchor"),vt=Symbol("privateValidator"),$=Symbol("privateSyncValidity"),$e=Symbol("privateCustomValidationMessage");function qe(n){var e;class t extends n{constructor(){super(...arguments),this[e]=""}get validity(){return this[$](),this[_].validity}get validationMessage(){return this[$](),this[_].validationMessage}get willValidate(){return this[$](),this[_].willValidate}checkValidity(){return this[$](),this[_].checkValidity()}reportValidity(){return this[$](),this[_].reportValidity()}setCustomValidity(a){this[$e]=a,this[$]()}requestUpdate(a,i,o){super.requestUpdate(a,i,o),this[$]()}firstUpdated(a){super.firstUpdated(a),this[$]()}[(e=$e,$)](){if(!1)return;this[vt]||(this[vt]=this[oe]());let{validity:a,validationMessage:i}=this[vt].getValidity(),o=!!this[$e],c=this[$e]||i;this[_].setValidity({...a,customError:o},c,this[se]()??void 0)}[oe](){throw new Error("Implement [createValidator]")}[se](){throw new Error("Implement [getValidityAnchor]")}}return t}var Me=class{constructor(e){this.getCurrentState=e,this.currentValidity={validity:{},validationMessage:""}}getValidity(){let e=this.getCurrentState();if(!(!this.prevState||!this.equals(this.prevState,e)))return this.currentValidity;let{validity:r,validationMessage:a}=this.computeValidity(e);return this.prevState=this.copy(e),this.currentValidity={validationMessage:a,validity:{badInput:r.badInput,customError:r.customError,patternMismatch:r.patternMismatch,rangeOverflow:r.rangeOverflow,rangeUnderflow:r.rangeUnderflow,stepMismatch:r.stepMismatch,tooLong:r.tooLong,tooShort:r.tooShort,typeMismatch:r.typeMismatch,valueMissing:r.valueMissing}},this.currentValidity}};var de=class extends Me{computeValidity(e){return this.checkboxControl||(this.checkboxControl=document.createElement("input"),this.checkboxControl.type="checkbox"),this.checkboxControl.checked=e.checked,this.checkboxControl.required=e.required,{validity:this.checkboxControl.validity,validationMessage:this.checkboxControl.validationMessage}}equals(e,t){return e.checked===t.checked&&e.required===t.required}copy({checked:e,required:t}){return{checked:e,required:t}}};var jn=ee(qe(ie(re(k)))),O=class extends jn{constructor(){super(),this.selected=!1,this.icons=!1,this.showOnlySelectedIcon=!1,this.required=!1,this.value="on",!!1&&(this.addEventListener("click",e=>{!ne(e)||!this.input||(this.focus(),te(this.input))}),De(this,"keydown"),this.addEventListener("keydown",e=>{Ne(e,()=>{e.defaultPrevented||e.key!=="Enter"||this.disabled||!this.input||this.input.click()})}))}render(){return y`
      <div class="switch ${K(this.getRenderClasses())}">
        <input
          id="switch"
          class="touch"
          type="checkbox"
          role="switch"
          aria-label=${this.ariaLabel||m}
          ?checked=${this.selected}
          ?disabled=${this.disabled}
          ?required=${this.required}
          @input=${this.handleInput}
          @change=${this.handleChange} />

        <md-focus-ring part="focus-ring" for="switch"></md-focus-ring>
        <span class="track"> ${this.renderHandle()} </span>
      </div>
    `}getRenderClasses(){return{selected:this.selected,unselected:!this.selected,disabled:this.disabled}}renderHandle(){let e={"with-icon":this.showOnlySelectedIcon?this.selected:this.icons};return y`
      ${this.renderTouchTarget()}
      <span class="handle-container">
        <md-ripple for="switch" ?disabled="${this.disabled}"></md-ripple>
        <span class="handle ${K(e)}">
          ${this.shouldShowIcons()?this.renderIcons():y``}
        </span>
      </span>
    `}renderIcons(){return y`
      <div class="icons">
        ${this.renderOnIcon()}
        ${this.showOnlySelectedIcon?y``:this.renderOffIcon()}
      </div>
    `}renderOnIcon(){return y`
      <slot class="icon icon--on" name="on-icon">
        <svg viewBox="0 0 24 24">
          <path
            d="M9.55 18.2 3.65 12.3 5.275 10.675 9.55 14.95 18.725 5.775 20.35 7.4Z" />
        </svg>
      </slot>
    `}renderOffIcon(){return y`
      <slot class="icon icon--off" name="off-icon">
        <svg viewBox="0 0 24 24">
          <path
            d="M6.4 19.2 4.8 17.6 10.4 12 4.8 6.4 6.4 4.8 12 10.4 17.6 4.8 19.2 6.4 13.6 12 19.2 17.6 17.6 19.2 12 13.6Z" />
        </svg>
      </slot>
    `}renderTouchTarget(){return y`<span class="touch"></span>`}shouldShowIcons(){return this.icons||this.showOnlySelectedIcon}handleInput(e){let t=e.target;this.selected=t.checked}handleChange(e){Le(this,e)}[Y](){return this.selected?this.value:null}[ae](){return String(this.selected)}formResetCallback(){this.selected=this.hasAttribute("selected")}formStateRestoreCallback(e){this.selected=e==="true"}[oe](){return new de(()=>({checked:this.selected,required:this.required}))}[se](){return this.input}};O.shadowRootOptions={mode:"open",delegatesFocus:!0};h([b({type:Boolean})],O.prototype,"selected",void 0);h([b({type:Boolean})],O.prototype,"icons",void 0);h([b({type:Boolean,attribute:"show-only-selected-icon"})],O.prototype,"showOnlySelectedIcon",void 0);h([b({type:Boolean})],O.prototype,"required",void 0);h([b()],O.prototype,"value",void 0);h([M("input")],O.prototype,"input",void 0);var gt=w`@layer styles, hcm;@layer styles{:host{display:inline-flex;outline:none;vertical-align:top;-webkit-tap-highlight-color:rgba(0,0,0,0);cursor:pointer}:host([disabled]){cursor:default}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--md-switch-track-height, 32px))/2) 0px}md-focus-ring{--md-focus-ring-shape-start-start: var(--md-switch-track-shape-start-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-start-end: var(--md-switch-track-shape-start-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-end-end: var(--md-switch-track-shape-end-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-end-start: var(--md-switch-track-shape-end-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)))}.switch{align-items:center;display:inline-flex;flex-shrink:0;position:relative;width:var(--md-switch-track-width, 52px);height:var(--md-switch-track-height, 32px);border-start-start-radius:var(--md-switch-track-shape-start-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-start-end-radius:var(--md-switch-track-shape-start-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-end-radius:var(--md-switch-track-shape-end-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-start-radius:var(--md-switch-track-shape-end-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)))}input{appearance:none;background:none;height:max(100%,var(--md-switch-touch-target-size, 48px));outline:none;margin:0;position:absolute;width:max(100%,var(--md-switch-touch-target-size, 48px));z-index:1;cursor:inherit;top:50%;left:50%;transform:translate(-50%, -50%)}:host([touch-target=none]) input{display:none}}@layer styles{.track{position:absolute;width:100%;height:100%;box-sizing:border-box;border-radius:inherit;display:flex;justify-content:center;align-items:center}.track::before{content:"";display:flex;position:absolute;height:100%;width:100%;border-radius:inherit;box-sizing:border-box;transition-property:opacity,background-color;transition-timing-function:linear;transition-duration:67ms}.disabled .track{background-color:rgba(0,0,0,0);border-color:rgba(0,0,0,0)}.disabled .track::before,.disabled .track::after{transition:none;opacity:var(--md-switch-disabled-track-opacity, 0.12)}.disabled .track::before{background-clip:content-box}.selected .track::before{background-color:var(--md-switch-selected-track-color, var(--md-sys-color-primary, #6750a4))}.selected:hover .track::before{background-color:var(--md-switch-selected-hover-track-color, var(--md-sys-color-primary, #6750a4))}.selected:focus-within .track::before{background-color:var(--md-switch-selected-focus-track-color, var(--md-sys-color-primary, #6750a4))}.selected:active .track::before{background-color:var(--md-switch-selected-pressed-track-color, var(--md-sys-color-primary, #6750a4))}.selected.disabled .track{background-clip:border-box}.selected.disabled .track::before{background-color:var(--md-switch-disabled-selected-track-color, var(--md-sys-color-on-surface, #1d1b20))}.unselected .track::before{background-color:var(--md-switch-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-track-outline-color, var(--md-sys-color-outline, #79747e));border-style:solid;border-width:var(--md-switch-track-outline-width, 2px)}.unselected:hover .track::before{background-color:var(--md-switch-hover-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-hover-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected:focus-visible .track::before{background-color:var(--md-switch-focus-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-focus-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected:active .track::before{background-color:var(--md-switch-pressed-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-pressed-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected.disabled .track::before{background-color:var(--md-switch-disabled-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-disabled-track-outline-color, var(--md-sys-color-on-surface, #1d1b20))}}@layer hcm{@media(forced-colors: active){.selected .track::before{background:ButtonText;border-color:ButtonText}.disabled .track::before{border-color:GrayText;opacity:1}.disabled.selected .track::before{background:GrayText}}}@layer styles{.handle-container{display:flex;place-content:center;place-items:center;position:relative;transition:margin 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)}.selected .handle-container{margin-inline-start:calc(var(--md-switch-track-width, 52px) - var(--md-switch-track-height, 32px))}.unselected .handle-container{margin-inline-end:calc(var(--md-switch-track-width, 52px) - var(--md-switch-track-height, 32px))}.disabled .handle-container{transition:none}.handle{border-start-start-radius:var(--md-switch-handle-shape-start-start, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-start-end-radius:var(--md-switch-handle-shape-start-end, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-end-radius:var(--md-switch-handle-shape-end-end, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-start-radius:var(--md-switch-handle-shape-end-start, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));height:var(--md-switch-handle-height, 16px);width:var(--md-switch-handle-width, 16px);transform-origin:center;transition-property:height,width;transition-duration:250ms,250ms;transition-timing-function:cubic-bezier(0.2, 0, 0, 1),cubic-bezier(0.2, 0, 0, 1);z-index:0}.handle::before{content:"";display:flex;inset:0;position:absolute;border-radius:inherit;box-sizing:border-box;transition:background-color 67ms linear}.disabled .handle,.disabled .handle::before{transition:none}.selected .handle{height:var(--md-switch-selected-handle-height, 24px);width:var(--md-switch-selected-handle-width, 24px)}.handle.with-icon{height:var(--md-switch-with-icon-handle-height, 24px);width:var(--md-switch-with-icon-handle-width, 24px)}.selected:not(.disabled):active .handle,.unselected:not(.disabled):active .handle{height:var(--md-switch-pressed-handle-height, 28px);width:var(--md-switch-pressed-handle-width, 28px);transition-timing-function:linear;transition-duration:100ms}.selected .handle::before{background-color:var(--md-switch-selected-handle-color, var(--md-sys-color-on-primary, #fff))}.selected:hover .handle::before{background-color:var(--md-switch-selected-hover-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected:focus-within .handle::before{background-color:var(--md-switch-selected-focus-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected:active .handle::before{background-color:var(--md-switch-selected-pressed-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected.disabled .handle::before{background-color:var(--md-switch-disabled-selected-handle-color, var(--md-sys-color-surface, #fef7ff));opacity:var(--md-switch-disabled-selected-handle-opacity, 1)}.unselected .handle::before{background-color:var(--md-switch-handle-color, var(--md-sys-color-outline, #79747e))}.unselected:hover .handle::before{background-color:var(--md-switch-hover-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected:focus-within .handle::before{background-color:var(--md-switch-focus-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected:active .handle::before{background-color:var(--md-switch-pressed-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected.disabled .handle::before{background-color:var(--md-switch-disabled-handle-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-switch-disabled-handle-opacity, 0.38)}md-ripple{border-radius:var(--md-switch-state-layer-shape, var(--md-sys-shape-corner-full, 9999px));height:var(--md-switch-state-layer-size, 40px);inset:unset;width:var(--md-switch-state-layer-size, 40px)}.selected md-ripple{--md-ripple-hover-color: var(--md-switch-selected-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-pressed-color: var(--md-switch-selected-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-hover-opacity: var(--md-switch-selected-hover-state-layer-opacity, 0.08);--md-ripple-pressed-opacity: var(--md-switch-selected-pressed-state-layer-opacity, 0.12)}.unselected md-ripple{--md-ripple-hover-color: var(--md-switch-hover-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-pressed-color: var(--md-switch-pressed-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-hover-opacity: var(--md-switch-hover-state-layer-opacity, 0.08);--md-ripple-pressed-opacity: var(--md-switch-pressed-state-layer-opacity, 0.12)}}@layer hcm{@media(forced-colors: active){.unselected .handle::before{background:ButtonText}.disabled .handle::before{opacity:1}.disabled.unselected .handle::before{background:GrayText}}}@layer styles{.icons{position:relative;height:100%;width:100%}.icon{position:absolute;inset:0;margin:auto;display:flex;align-items:center;justify-content:center;fill:currentColor;transition:fill 67ms linear,opacity 33ms linear,transform 167ms cubic-bezier(0.2, 0, 0, 1);opacity:0}.disabled .icon{transition:none}.selected .icon--on,.unselected .icon--off{opacity:1}.unselected .handle:not(.with-icon) .icon--on{transform:rotate(-45deg)}.icon--off{width:var(--md-switch-icon-size, 16px);height:var(--md-switch-icon-size, 16px);color:var(--md-switch-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:hover .icon--off{color:var(--md-switch-hover-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:focus-within .icon--off{color:var(--md-switch-focus-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:active .icon--off{color:var(--md-switch-pressed-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected.disabled .icon--off{color:var(--md-switch-disabled-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9));opacity:var(--md-switch-disabled-icon-opacity, 0.38)}.icon--on{width:var(--md-switch-selected-icon-size, 16px);height:var(--md-switch-selected-icon-size, 16px);color:var(--md-switch-selected-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:hover .icon--on{color:var(--md-switch-selected-hover-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:focus-within .icon--on{color:var(--md-switch-selected-focus-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:active .icon--on{color:var(--md-switch-selected-pressed-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected.disabled .icon--on{color:var(--md-switch-disabled-selected-icon-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-switch-disabled-selected-icon-opacity, 0.38)}}@layer hcm{@media(forced-colors: active){.icon--off{fill:Canvas}.icon--on{fill:ButtonText}.disabled.unselected .icon--off,.disabled.selected .icon--on{opacity:1}.disabled .icon--on{fill:GrayText}}}
`,ps=gt.styleSheet;var bt=class extends O{};bt.styles=[gt];bt=h([P("md-switch")],bt);var Ln=ee(qe(ie(re(k)))),N=class extends Ln{constructor(){super(),this.checked=!1,this.indeterminate=!1,this.required=!1,this.value="on",this.prevChecked=!1,this.prevDisabled=!1,this.prevIndeterminate=!1,this.addEventListener("click",e=>{!ne(e)||!this.input||(this.focus(),te(this.input))})}update(e){(e.has("checked")||e.has("disabled")||e.has("indeterminate"))&&(this.prevChecked=e.get("checked")??this.checked,this.prevDisabled=e.get("disabled")??this.disabled,this.prevIndeterminate=e.get("indeterminate")??this.indeterminate),super.update(e)}render(){let e=!this.prevChecked&&!this.prevIndeterminate,t=this.prevChecked&&!this.prevIndeterminate,r=this.prevIndeterminate,a=this.checked&&!this.indeterminate,i=this.indeterminate,o=K({disabled:this.disabled,selected:a||i,unselected:!a&&!i,checked:a,indeterminate:i,"prev-unselected":e,"prev-checked":t,"prev-indeterminate":r,"prev-disabled":this.prevDisabled}),{ariaLabel:c,ariaInvalid:d}=this;return y`
      <div class="container ${o}">
        <input
          type="checkbox"
          id="input"
          aria-checked=${i?"mixed":m}
          aria-label=${c||m}
          aria-invalid=${d||m}
          ?disabled=${this.disabled}
          ?required=${this.required}
          .indeterminate=${this.indeterminate}
          .checked=${this.checked}
          @input=${this.handleInput}
          @change=${this.handleChange} />

        <div class="outline"></div>
        <div class="background"></div>
        <md-focus-ring part="focus-ring" for="input"></md-focus-ring>
        <md-ripple for="input" ?disabled=${this.disabled}></md-ripple>
        <svg class="icon" viewBox="0 0 18 18" aria-hidden="true">
          <rect class="mark short" />
          <rect class="mark long" />
        </svg>
      </div>
    `}handleInput(e){let t=e.target;this.checked=t.checked,this.indeterminate=t.indeterminate}handleChange(e){Le(this,e)}[Y](){return!this.checked||this.indeterminate?null:this.value}[ae](){return String(this.checked)}formResetCallback(){this.checked=this.hasAttribute("checked")}formStateRestoreCallback(e){this.checked=e==="true"}[oe](){return new de(()=>this)}[se](){return this.input}};N.shadowRootOptions={...k.shadowRootOptions,delegatesFocus:!0};h([b({type:Boolean})],N.prototype,"checked",void 0);h([b({type:Boolean})],N.prototype,"indeterminate",void 0);h([b({type:Boolean})],N.prototype,"required",void 0);h([b()],N.prototype,"value",void 0);h([F()],N.prototype,"prevChecked",void 0);h([F()],N.prototype,"prevDisabled",void 0);h([F()],N.prototype,"prevIndeterminate",void 0);h([M("input")],N.prototype,"input",void 0);var yt=w`:host{border-start-start-radius:var(--md-checkbox-container-shape-start-start, var(--md-checkbox-container-shape, 2px));border-start-end-radius:var(--md-checkbox-container-shape-start-end, var(--md-checkbox-container-shape, 2px));border-end-end-radius:var(--md-checkbox-container-shape-end-end, var(--md-checkbox-container-shape, 2px));border-end-start-radius:var(--md-checkbox-container-shape-end-start, var(--md-checkbox-container-shape, 2px));display:inline-flex;height:var(--md-checkbox-container-size, 18px);position:relative;vertical-align:top;width:var(--md-checkbox-container-size, 18px);-webkit-tap-highlight-color:rgba(0,0,0,0);cursor:pointer}:host([disabled]){cursor:default}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--md-checkbox-container-size, 18px))/2)}md-focus-ring{height:44px;inset:unset;width:44px}input{appearance:none;height:48px;margin:0;opacity:0;outline:none;position:absolute;width:48px;z-index:1;cursor:inherit}:host([touch-target=none]) input{height:100%;width:100%}.container{border-radius:inherit;display:flex;height:100%;place-content:center;place-items:center;position:relative;width:100%}.outline,.background,.icon{inset:0;position:absolute}.outline,.background{border-radius:inherit}.outline{border-color:var(--md-checkbox-outline-color, var(--md-sys-color-on-surface-variant, #49454f));border-style:solid;border-width:var(--md-checkbox-outline-width, 2px);box-sizing:border-box}.background{background-color:var(--md-checkbox-selected-container-color, var(--md-sys-color-primary, #6750a4))}.background,.icon{opacity:0;transition-duration:150ms,50ms;transition-property:transform,opacity;transition-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15),linear;transform:scale(0.6)}:where(.selected) :is(.background,.icon){opacity:1;transition-duration:350ms,50ms;transition-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1),linear;transform:scale(1)}md-ripple{border-radius:var(--md-checkbox-state-layer-shape, var(--md-sys-shape-corner-full, 9999px));height:var(--md-checkbox-state-layer-size, 40px);inset:unset;width:var(--md-checkbox-state-layer-size, 40px);--md-ripple-hover-color: var(--md-checkbox-hover-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-hover-opacity: var(--md-checkbox-hover-state-layer-opacity, 0.08);--md-ripple-pressed-color: var(--md-checkbox-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-pressed-opacity: var(--md-checkbox-pressed-state-layer-opacity, 0.12)}.selected md-ripple{--md-ripple-hover-color: var(--md-checkbox-selected-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-hover-opacity: var(--md-checkbox-selected-hover-state-layer-opacity, 0.08);--md-ripple-pressed-color: var(--md-checkbox-selected-pressed-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-pressed-opacity: var(--md-checkbox-selected-pressed-state-layer-opacity, 0.12)}.icon{fill:var(--md-checkbox-selected-icon-color, var(--md-sys-color-on-primary, #fff));height:var(--md-checkbox-icon-size, 18px);width:var(--md-checkbox-icon-size, 18px)}.mark.short{height:2px;transition-property:transform,height;width:2px}.mark.long{height:2px;transition-property:transform,width;width:10px}.mark{animation-duration:150ms;animation-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15);transition-duration:150ms;transition-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15)}.selected .mark{animation-duration:350ms;animation-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1);transition-duration:350ms;transition-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1)}.checked .mark,.prev-checked.unselected .mark{transform:scaleY(-1) translate(7px, -14px) rotate(45deg)}.checked .mark.short,.prev-checked.unselected .mark.short{height:5.6568542495px}.checked .mark.long,.prev-checked.unselected .mark.long{width:11.313708499px}.indeterminate .mark,.prev-indeterminate.unselected .mark{transform:scaleY(-1) translate(4px, -10px) rotate(0deg)}.prev-unselected .mark{transition-property:none}.prev-unselected.checked .mark.long{animation-name:prev-unselected-to-checked}@keyframes prev-unselected-to-checked{from{width:0}}:where(:hover) .outline{border-color:var(--md-checkbox-hover-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-hover-outline-width, 2px)}:where(:hover) .background{background:var(--md-checkbox-selected-hover-container-color, var(--md-sys-color-primary, #6750a4))}:where(:hover) .icon{fill:var(--md-checkbox-selected-hover-icon-color, var(--md-sys-color-on-primary, #fff))}:where(:focus-within) .outline{border-color:var(--md-checkbox-focus-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-focus-outline-width, 2px)}:where(:focus-within) .background{background:var(--md-checkbox-selected-focus-container-color, var(--md-sys-color-primary, #6750a4))}:where(:focus-within) .icon{fill:var(--md-checkbox-selected-focus-icon-color, var(--md-sys-color-on-primary, #fff))}:where(:active) .outline{border-color:var(--md-checkbox-pressed-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-pressed-outline-width, 2px)}:where(:active) .background{background:var(--md-checkbox-selected-pressed-container-color, var(--md-sys-color-primary, #6750a4))}:where(:active) .icon{fill:var(--md-checkbox-selected-pressed-icon-color, var(--md-sys-color-on-primary, #fff))}:where(.disabled,.prev-disabled) :is(.background,.icon,.mark){animation-duration:0s;transition-duration:0s}:where(.disabled) .outline{border-color:var(--md-checkbox-disabled-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-disabled-outline-width, 2px);opacity:var(--md-checkbox-disabled-container-opacity, 0.38)}:where(.selected.disabled) .outline{visibility:hidden}:where(.selected.disabled) .background{background:var(--md-checkbox-selected-disabled-container-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-checkbox-selected-disabled-container-opacity, 0.38)}:where(.disabled) .icon{fill:var(--md-checkbox-selected-disabled-icon-color, var(--md-sys-color-surface, #fef7ff))}@media(forced-colors: active){.background{background-color:CanvasText}.selected.disabled .background{background-color:GrayText;opacity:1}.outline{border-color:CanvasText}.disabled .outline{border-color:GrayText;opacity:1}.icon{fill:Canvas}}
`,$s=yt.styleSheet;var wt=class extends N{};wt.styles=[yt];wt=h([P("md-checkbox")],wt);function kt(n){if(new TextEncoder().encode(n).length>262144)throw new Error("WORDING_TOO_LARGE");let e=0;function t(){for(;/\s/.test(n[e]||"")&&e<n.length;)e++}function r(){let o=e++;for(;e<n.length;){if(n[e]==="\\"){e+=2;continue}if(n[e++]==='"')return JSON.parse(n.slice(o,e))}throw new Error("INVALID_WORDING")}function a(o){if(o>8)throw new Error("WORDING_DEPTH");if(t(),n[e]==='"')return r();if(n[e]==="{"){e++;let d=Object.create(null),f=new Set;if(t(),n[e]==="}")return e++,d;for(;;){if(t(),n[e]!=='"')throw new Error("INVALID_WORDING");let g=r();if(f.has(g)||["__proto__","constructor","prototype"].includes(g))throw new Error("INVALID_WORDING");if(f.add(g),t(),n[e++]!==":")throw new Error("INVALID_WORDING");d[g]=a(o+1),t();let v=n[e++];if(v==="}")return d;if(v!==",")throw new Error("INVALID_WORDING")}}let c=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(n.slice(e));if(!c)throw new Error("INVALID_WORDING");return e+=c[0].length,JSON.parse(c[0])}let i=a(0);if(t(),e!==n.length||!i||typeof i!="object"||Object.keys(i).sort().join(",")!=="entries,schemaVersion"||i.schemaVersion!==1||!i.entries||typeof i.entries!="object"||Array.isArray(i.entries))throw new Error("INVALID_WORDING");for(let[o,c]of Object.entries(i.entries))if(!o.length||[...o].length>160||typeof c!="string"||[...c].length>1e3)throw new Error("INVALID_WORDING");return i}function Xt(n,e){return Object.prototype.hasOwnProperty.call(e,n)?e[n]:n}var ke=p,Qt=()=>{},u=(n,e=document)=>e.querySelector(n),l=n=>String(n).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),xe=!0;function le(n,e){try{let t=localStorage.getItem("mb-docs-"+n);return t?JSON.parse(t):e}catch{return xe=!1,e}}var T=le("settings",{language:"en",theme:"light",size:100,motion:!1}),U=le("progress",[]),ce={};try{let n=localStorage.getItem("mb-docs-wording");n&&(ce=kt(n).entries)}catch{ce={}}function D(n,e){try{localStorage.setItem("mb-docs-"+n,JSON.stringify(e))}catch{xe=!1,H(s("Storage unavailable. Changes last for this session only.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u8B8A\u66F4\u53EA\u4FDD\u7559\u81F3\u672C\u6B21\u700F\u89BD\u7D50\u675F\u3002"))}}function s(n,e=n){let t=T.language==="zh"?e:T.language==="both"&&n!==e?n+" \xB7 "+e:n;return Xt(t,ce)}function H(n){u("#notice").textContent=n}var xt=[{id:"vault",title:["Create a vault","\u5EFA\u7ACB\u4FDD\u7BA1\u5EAB"],article:"Vault-and-computers.md",steps:[["Choose a dedicated directory","\u9078\u64C7\u5C08\u7528\u8CC7\u6599\u593E","Use the application\u2019s native folder picker. Keep your ordinary browser data separate.","\u4F7F\u7528\u61C9\u7528\u7A0B\u5F0F\u7684\u8CC7\u6599\u593E\u9078\u64C7\u5668\uFF0C\u8207\u65E5\u5E38\u700F\u89BD\u5668\u8CC7\u6599\u5206\u958B\u3002"],["Create and unlock","\u5EFA\u7ACB\u4E26\u89E3\u9396","Enter a strong password in the protected application field. Wait for the actual successful result. Never enter it here.","\u5728\u61C9\u7528\u7A0B\u5F0F\u7684\u53D7\u4FDD\u8B77\u6B04\u4F4D\u8F38\u5165\u5BC6\u78BC\uFF0C\u7B49\u5019\u771F\u6B63\u6210\u529F\u7D50\u679C\u3002\u5207\u52FF\u5728\u6B64\u8F38\u5165\u3002"],["Create your first profile","\u5EFA\u7ACB\u7B2C\u4E00\u500B\u8A2D\u5B9A\u6A94","Choose a supported engine and keep automation off unless needed. A capability report decides what is available.","\u9078\u64C7\u652F\u63F4\u7684\u5F15\u64CE\u3002\u9664\u975E\u6709\u9700\u8981\uFF0C\u5426\u5247\u95DC\u9589\u81EA\u52D5\u5316\u3002\u4EE5\u80FD\u529B\u5831\u544A\u70BA\u6E96\u3002"]]},{id:"join",title:["Join another computer","\u52A0\u5165\u53E6\u4E00\u90E8\u96FB\u8166"],article:"Vault-and-computers.md",steps:[["Keep the original safe","\u4FDD\u7559\u539F\u6709\u8CC7\u6599","Preserve an independent encrypted backup before joining another device.","\u52A0\u5165\u53E6\u4E00\u88DD\u7F6E\u4E4B\u524D\uFF0C\u4FDD\u7559\u7368\u7ACB\u52A0\u5BC6\u5099\u4EFD\u3002"],["Pull encrypted data","\u4E0B\u8F09\u52A0\u5BC6\u8CC7\u6599","Configure the supported synchronization folder and pull through the application. Do not copy a live browser directory.","\u8A2D\u5B9A\u652F\u63F4\u7684\u540C\u6B65\u8CC7\u6599\u593E\uFF0C\u900F\u904E\u61C9\u7528\u7A0B\u5F0F\u4E0B\u8F09\u3002\u4E0D\u8981\u8907\u88FD\u57F7\u884C\u4E2D\u7684\u700F\u89BD\u5668\u8CC7\u6599\u593E\u3002"],["Verify destination capabilities","\u78BA\u8A8D\u76EE\u7684\u5730\u80FD\u529B","Unlock on the destination and check engine support. Cross-machine restoration remains unverified without evidence for that exact combination.","\u5728\u76EE\u7684\u5730\u89E3\u9396\u4E26\u6AA2\u67E5\u5F15\u64CE\u652F\u63F4\u3002\u8DE8\u96FB\u8166\u9084\u539F\u9700\u8981\u8A72\u7D44\u5408\u7684\u5BE6\u969B\u9A57\u8B49\u3002"]]},{id:"automation",title:["Understand automation","\u4E86\u89E3\u81EA\u52D5\u5316"],article:"Automation.md",steps:[["Start with off","\u5148\u4FDD\u6301\u95DC\u9589","Automation is opt-in per profile. Off requests no driver or debugging listener.","\u6BCF\u500B\u8A2D\u5B9A\u6A94\u5747\u9808\u4E3B\u52D5\u958B\u555F\u81EA\u52D5\u5316\u3002\u95DC\u9589\u6642\u4E0D\u8981\u6C42\u9A45\u52D5\u7A0B\u5F0F\u6216\u5075\u932F\u63A5\u807D\u3002"],["Choose a supported mode","\u9078\u64C7\u652F\u63F4\u6A21\u5F0F","Selenium or Puppeteer requires explicit engine support. A saved preference alone does not create an endpoint.","Selenium \u6216 Puppeteer \u9808\u6709\u5F15\u64CE\u652F\u63F4\u3002\u5132\u5B58\u504F\u597D\u4E0D\u4EE3\u8868\u7AEF\u9EDE\u5DF2\u5EFA\u7ACB\u3002"],["Restart when required","\u9700\u8981\u6642\u91CD\u65B0\u555F\u52D5","A running profile retains its effective mode until stopped and relaunched. Try the local example below.","\u57F7\u884C\u4E2D\u7684\u8A2D\u5B9A\u6A94\u6703\u4FDD\u7559\u76EE\u524D\u6A21\u5F0F\uFF0C\u505C\u6B62\u4E26\u91CD\u65B0\u555F\u52D5\u5F8C\u624D\u5957\u7528\u3002\u8A66\u7528\u4E0B\u65B9\u672C\u6A5F\u793A\u7BC4\u3002"]]},{id:"snapshot",title:["Snapshot and restore","\u5FEB\u7167\u8207\u9084\u539F"],article:"Snapshots-and-conflicts.md",steps:[["Reach a safe state","\u9032\u5165\u5B89\u5168\u72C0\u614B","Stop the browser unless the engine proves support for the restricted live snapshot protocol.","\u9664\u975E\u5F15\u64CE\u5DF2\u8B49\u5BE6\u652F\u63F4\u53D7\u9650\u5373\u6642\u5FEB\u7167\u5354\u5B9A\uFF0C\u5426\u5247\u5148\u505C\u6B62\u700F\u89BD\u5668\u3002"],["Preserve the revision","\u4FDD\u7559\u7248\u672C","Create a snapshot and inspect its returned revision identity. Keep the current revision before restore.","\u5EFA\u7ACB\u5FEB\u7167\u4E26\u6AA2\u67E5\u56DE\u50B3\u7684\u7248\u672C\u8B58\u5225\u3002\u9084\u539F\u524D\u5148\u4FDD\u7559\u76EE\u524D\u7248\u672C\u3002"],["Restore deliberately","\u614E\u91CD\u9084\u539F","Select the exact revision. Require a real success result and inspect the profile before discarding any backup.","\u9078\u64C7\u78BA\u5207\u7248\u672C\u3002\u78BA\u8A8D\u5BE6\u969B\u6210\u529F\u7D50\u679C\u4E26\u6AA2\u67E5\u8A2D\u5B9A\u6A94\uFF0C\u518D\u6C7A\u5B9A\u662F\u5426\u522A\u9664\u5099\u4EFD\u3002"]]},{id:"conflict",title:["Resolve a conflict","\u8655\u7406\u885D\u7A81"],article:"Snapshots-and-conflicts.md",steps:[["Preserve both branches","\u4FDD\u7559\u5169\u500B\u5206\u652F","Concurrent revisions are both valuable. Never overwrite one based only on its timestamp.","\u540C\u6642\u7522\u751F\u7684\u7248\u672C\u90FD\u6709\u50F9\u503C\u3002\u5207\u52FF\u53EA\u6191\u6642\u9593\u8986\u5BEB\u5176\u4E2D\u4E00\u500B\u3002"],["Compare the revisions","\u6BD4\u8F03\u7248\u672C","Read revision identities and parent relationships. Do not merge browser databases.","\u95B1\u8B80\u7248\u672C\u8B58\u5225\u53CA\u7236\u7248\u672C\u95DC\u4FC2\u3002\u4E0D\u8981\u5408\u4F75\u700F\u89BD\u5668\u8CC7\u6599\u5EAB\u3002"],["Choose explicitly","\u660E\u78BA\u9078\u64C7","Use the application\u2019s resolution workflow. Keep the other revision where supported.","\u4F7F\u7528\u61C9\u7528\u7A0B\u5F0F\u7684\u89E3\u6C7A\u6D41\u7A0B\uFF0C\u4E26\u5728\u652F\u63F4\u6642\u4FDD\u7559\u53E6\u4E00\u7248\u672C\u3002"]]},{id:"hosting",title:["Explore optional storage","\u63A2\u7D22\u9078\u7528\u5132\u5B58\u670D\u52D9"],article:"Storage.md",steps:[["Review the boundary","\u4E86\u89E3\u754C\u7DDA","Storage receives ciphertext, never the vault password or decrypted profile data.","\u5132\u5B58\u670D\u52D9\u53EA\u63A5\u6536\u5BC6\u6587\uFF0C\u4E0D\u61C9\u63A5\u6536\u4FDD\u7BA1\u5EAB\u5BC6\u78BC\u6216\u89E3\u5BC6\u8CC7\u6599\u3002"],["Configure the intended host","\u8A2D\u5B9A\u6307\u5B9A\u4E3B\u6A5F","Review ports, storage and authenticated administration. A configuration file is not deployment proof.","\u6AA2\u67E5\u9023\u63A5\u57E0\u3001\u5132\u5B58\u53CA\u9A57\u8B49\u7BA1\u7406\u3002\u8A2D\u5B9A\u6A94\u4E26\u975E\u90E8\u7F72\u8B49\u660E\u3002"],["Verify actual health","\u9A57\u8B49\u5BE6\u969B\u5065\u5EB7\u72C0\u614B","Verify the real service and intended LAN URL. This documentation cannot start or verify it for you.","\u9A57\u8B49\u5BE6\u969B\u670D\u52D9\u53CA\u6307\u5B9A\u5340\u57DF\u7DB2\u7D61\u7DB2\u5740\u3002\u672C\u6587\u4EF6\u7121\u6CD5\u4EE3\u4F60\u555F\u52D5\u6216\u9A57\u8B49\u3002"]]}];function R(n,e,t=!1){return`<md-${t?"outlined":"filled"}-button id="${e}">${l(n)}</md-${t?"outlined":"filled"}-button>`}function Be(){document.documentElement.dataset.theme=T.theme,document.documentElement.lang=T.language==="zh"?"yue-Hant":"en",document.documentElement.style.fontSize=T.size+"%",document.documentElement.dataset.motion=T.motion?"reduce":"normal"}function $n(){Be(),u("#app").innerHTML=`<header><a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">M</span><span>Material Browser<small>${l(s("FIELD GUIDE","\u5BE6\u7528\u624B\u518A"))}</small></span></a>${R(s("Navigation","\u5C0E\u89BD"),"navigation",!0)}</header><div class="layout"><nav id="nav" aria-label="${l(s("Documentation","\u6587\u4EF6"))}">${[["home","Overview","\u7E3D\u89BD"],["guide/vault","Guided tasks","\u4EFB\u52D9\u6307\u5357"],["reference","All articles","\u5168\u90E8\u6587\u7AE0"],["settings","Reading settings","\u95B1\u8B80\u8A2D\u5B9A"]].map(([n,e,t])=>`<a href="#/${n}" ${location.hash==="#/"+n?'aria-current="page"':""}>${l(s(e,t))}</a>`).join("")}<div class="rail-note">${l(s("Your progress stays on this device. Examples never operate the installed application.","\u9032\u5EA6\u53EA\u4FDD\u7559\u65BC\u6B64\u88DD\u7F6E\u3002\u793A\u7BC4\u4E0D\u6703\u64CD\u4F5C\u5DF2\u5B89\u88DD\u61C9\u7528\u7A0B\u5F0F\u3002"))}</div><a href="https://github.com/Ding-Ding-Projects/material-browser">${l(s("Source repository","\u539F\u59CB\u78BC\u5132\u5B58\u5EAB"))} \u2197</a></nav><main id="main" tabindex="-1"></main></div><footer>Material Browser \xB7 v0.1.0 \xB7 ${l(s("Documentation build","\u6587\u4EF6\u5EFA\u7F6E"))} ${l(ke.updatedAt)} \xB7 <code>${ke.source.slice(0,12)}</code></footer>`,u("#navigation").onclick=()=>{let n=u("#nav");n.classList.toggle("open"),u("#navigation").setAttribute("aria-expanded",String(n.classList.contains("open")))}}function Tt(){let n=U.length;u("#main").innerHTML=`<section class="hero"><p class="eyebrow">${l(s("A practical handbook","\u5BE6\u7528\u6307\u5357"))}</p><h1>${l(s("Your profiles. Your next step.","\u4F60\u7684\u8A2D\u5B9A\u6A94\uFF0C\u4F60\u7684\u4E0B\u4E00\u6B65\u3002"))}</h1><p class="lead">${l(s("Learn how to set up an encrypted workspace, understand browser capabilities and keep every revision recoverable.","\u5B78\u7FD2\u5EFA\u7ACB\u52A0\u5BC6\u5DE5\u4F5C\u5340\u3001\u4E86\u89E3\u700F\u89BD\u5668\u80FD\u529B\uFF0C\u4E26\u4FDD\u7559\u53EF\u9084\u539F\u7248\u672C\u3002"))}</p><a class="primary-link" href="#/guide/vault">${l(s("Start guided setup","\u958B\u59CB\u5F15\u5C0E\u8A2D\u5B9A"))} \u2192</a></section><section class="progress-panel"><div><h2>${l(s("Pick up where you left off","\u7E7C\u7E8C\u4E0A\u6B21\u9032\u5EA6"))}</h2><p>${n} / 18 ${l(s("reading steps confirmed","\u500B\u95B1\u8B80\u6B65\u9A5F\u5DF2\u78BA\u8A8D"))}</p></div><progress max="18" value="${n}" aria-label="${l(s("Reading progress","\u95B1\u8B80\u9032\u5EA6"))}"></progress>${R(s("Reset reading progress","\u91CD\u8A2D\u95B1\u8B80\u9032\u5EA6"),"reset-progress",!0)}</section><section><h2>${l(s("What do you want to do?","\u4F60\u60F3\u505A\u751A\u9EBC\uFF1F"))}</h2><div class="task-grid">${xt.map((e,t)=>`<a class="task-card" href="#/guide/${e.id}"><span class="task-number">0${t+1}</span><h3>${l(s(...e.title))}</h3><p>${l(s(e.steps[0][2],e.steps[0][3]))}</p><span aria-hidden="true">\u2192</span></a>`).join("")}</div></section><aside class="notice"><strong>${l(s("Know what is verified","\u4E86\u89E3\u9A57\u8B49\u7BC4\u570D"))}</strong><p>${l(s("These walkthroughs explain the workflow. Native launch, engine automation, live snapshots, cross-machine restoration and deployed storage require their own runtime evidence. Always read the actual capability and operation result.","\u9019\u4E9B\u6307\u5357\u89E3\u91CB\u6D41\u7A0B\u3002\u539F\u751F\u555F\u52D5\u3001\u81EA\u52D5\u5316\u3001\u5373\u6642\u5FEB\u7167\u3001\u8DE8\u6A5F\u9084\u539F\u53CA\u5132\u5B58\u90E8\u7F72\u5747\u9808\u7368\u7ACB\u5BE6\u969B\u9A57\u8B49\u3002\u8ACB\u4EE5\u80FD\u529B\u53CA\u64CD\u4F5C\u7D50\u679C\u70BA\u6E96\u3002"))}</p><a href="#/article/wiki%2FHome.md">${l(s("Read the handbook","\u95B1\u8B80\u624B\u518A"))}</a></aside>`,u("#reset-progress").onclick=()=>{U=[],D("progress",U),Tt(),H(s("Reading progress reset.","\u5DF2\u91CD\u8A2D\u95B1\u8B80\u9032\u5EA6\u3002"))}}function qn(n){let e=xt.find(a=>a.id===n)||xt[0],t=Math.max(0,Math.min(2,Number(le("step-"+e.id,0))||0));function r(){let a=e.steps[t];u("#main").innerHTML=`<p class="eyebrow">${l(s("Guided task","\u4EFB\u52D9\u6307\u5357"))} \xB7 ${t+1} / 3</p><h1>${l(s(...e.title))}</h1><p class="note">${l(s("Documentation only. No vault, browser or service operation runs here.","\u50C5\u4F9B\u6587\u4EF6\u8AAA\u660E\uFF0C\u6B64\u8655\u4E0D\u6703\u57F7\u884C\u4FDD\u7BA1\u5EAB\u3001\u700F\u89BD\u5668\u6216\u670D\u52D9\u64CD\u4F5C\u3002"))}</p><div class="steps" aria-label="${l(s("Steps","\u6B65\u9A5F"))}">${e.steps.map((i,o)=>`<button class="step ${o===t?"active":""}" data-step="${o}" aria-current="${o===t?"step":"false"}">${o+1}. ${l(s(i[0],i[1]))}</button>`).join("")}</div><section class="lesson"><h2>${l(s(a[0],a[1]))}</h2><p class="lead">${l(s(a[2],a[3]))}</p><label class="check"><md-checkbox id="confirm" aria-label="${l(s("I have reviewed this step","\u6211\u5DF2\u95B1\u8B80\u9019\u4E00\u6B65"))}" ${U.includes(e.id+t)?"checked":""}></md-checkbox>${l(s("I have reviewed this step","\u6211\u5DF2\u95B1\u8B80\u9019\u4E00\u6B65"))}</label><div class="actions">${R(s("Back","\u4E0A\u4E00\u6B65"),"back",!0)}${R(t===2?s("Finish reading","\u5B8C\u6210\u95B1\u8B80"):s("Next","\u4E0B\u4E00\u6B65"),"next")}</div></section><section id="example"></section><p><a href="#/article/${encodeURIComponent("wiki/"+e.article)}">${l(s("Read the complete article","\u95B1\u8B80\u5B8C\u6574\u6587\u7AE0"))} \u2192</a></p>`,document.querySelectorAll("[data-step]").forEach(i=>i.onclick=()=>{t=Number(i.dataset.step),D("step-"+e.id,t),r()}),u("#confirm").onchange=i=>{let o=e.id+t;U=U.filter(c=>c!==o),i.target.checked&&U.push(o),D("progress",U),H(s("Reading progress saved.","\u5DF2\u5132\u5B58\u95B1\u8B80\u9032\u5EA6\u3002"))},u("#back").disabled=t===0,u("#back").onclick=()=>{t--,D("step-"+e.id,t),r()},u("#next").onclick=()=>{t<2?(t++,D("step-"+e.id,t),r()):location.hash="#/home"},n==="automation"&&Mn(),n==="conflict"&&Bn()}r()}function Mn(){let n=le("example",{requested:"off",effective:"off",running:!0}),e=u("#example");function t(){e.innerHTML=`<h2>${l(s("Try the automation example","\u8A66\u7528\u81EA\u52D5\u5316\u793A\u7BC4"))}</h2><p>${l(s("Simulation only. Change the requested mode, then simulate a restart to see the boundary.","\u7D14\u7CB9\u793A\u7BC4\u3002\u66F4\u6539\u8981\u6C42\u6A21\u5F0F\uFF0C\u518D\u6A21\u64EC\u91CD\u65B0\u555F\u52D5\u4EE5\u4E86\u89E3\u754C\u7DDA\u3002"))}</p><div class="actions">${["off","selenium","puppeteer"].map(r=>R(r,"mode-"+r,n.requested!==r)).join("")}</div><div class="diagram"><div><small>${l(s("Requested","\u8981\u6C42"))}</small><strong>${n.requested}</strong></div><span aria-hidden="true">\u2192</span><div><small>${l(s("Effective","\u751F\u6548"))}</small><strong>${n.effective}</strong></div></div><p role="status">${l(n.requested!==n.effective?s("Pending restart in this example.","\u6B64\u793A\u7BC4\u4E2D\u6B63\u7B49\u5019\u91CD\u65B0\u555F\u52D5\u3002"):s("Requested and effective modes agree in this example.","\u6B64\u793A\u7BC4\u7684\u8981\u6C42\u8207\u751F\u6548\u6A21\u5F0F\u76F8\u540C\u3002"))}</p>${R(s("Simulate restart","\u6A21\u64EC\u91CD\u65B0\u555F\u52D5"),"simulate",!0)}`;for(let r of["off","selenium","puppeteer"])u("#mode-"+r).onclick=()=>{n.requested=r,D("example",n),t()};u("#simulate").onclick=()=>{n.effective=n.requested,D("example",n),t()}}t()}function Bn(){let n=le("conflict-choice","both"),e=u("#example");function t(){e.innerHTML=`<h2>${l(s("Explore a revision fork","\u63A2\u7D22\u7248\u672C\u5206\u652F"))}</h2><div class="diagram"><div><small>${l(s("Shared parent","\u5171\u540C\u7236\u7248\u672C"))}</small><strong>R1</strong></div><span aria-hidden="true">\u2192</span><div><strong>A \xB7 R2</strong><strong>B \xB7 R3</strong></div></div><p>${l(s("Select a revision to inspect the explanation. Both remain preserved in this demonstration.","\u9078\u64C7\u7248\u672C\u67E5\u770B\u89E3\u91CB\u3002\u6B64\u793A\u7BC4\u6703\u4FDD\u7559\u5169\u500B\u7248\u672C\u3002"))}</p><div class="actions">${R(s("Inspect A","\u67E5\u770B A"),"inspect-a",!0)}${R(s("Inspect B","\u67E5\u770B B"),"inspect-b",!0)}</div><p role="status">${l(n==="both"?s("Two children of R1: compare before choosing.","R1 \u7684\u5169\u500B\u5B50\u7248\u672C\uFF1A\u5148\u6BD4\u8F03\uFF0C\u518D\u9078\u64C7\u3002"):s("Inspecting "+n+". The other revision remains available; timestamps do not decide the winner.","\u6B63\u5728\u67E5\u770B "+n+"\u3002\u53E6\u4E00\u7248\u672C\u4ECD\u4FDD\u7559\uFF0C\u6642\u9593\u4E26\u4E0D\u6C7A\u5B9A\u52DD\u8CA0\u3002"))}</p>`;for(let r of["a","b"])u("#inspect-"+r).onclick=()=>{n=r.toUpperCase(),D("conflict-choice",n),t()}}t()}function en(n,e,t){n.innerHTML=`<label>${l(s("Search this collection","\u641C\u5C0B\u6B64\u96C6\u5408"))}<input type="search" id="query" maxlength="512"></label><div class="actions">${R(s("Clear search","\u6E05\u9664\u641C\u5C0B"),"clear",!0)}${R(s("Regex builder","\u6B63\u898F\u8868\u793A\u5F0F\u5DE5\u5177"),"builder",!0)}</div><section class="regex" hidden><label><input type="checkbox" id="regex-mode">${l(s("Use regex","\u4F7F\u7528\u6B63\u898F\u8868\u793A\u5F0F"))}</label><label>${l(s("Flags (i m s u)","\u65D7\u6A19 (i m s u)"))}<input id="flags" value="i" maxlength="4"></label>${R(s("Clear flags","\u6E05\u9664\u65D7\u6A19"),"clear-flags",!0)}<div class="actions">${[["literal","Escape literal"],["start","Start anchor"],["end","End anchor"],["group","Capture group"],["any","Any characters"]].map(([C,A])=>R(A,"insert-"+C,!0)).join("")}</div><p>${l(s("ECMAScript regex. Isolated worker, 200 ms limit. Atomic groups, conditionals, subroutines and engine tracing are unsupported. Results show matched article indices and captures.","ECMAScript \u6B63\u898F\u8868\u793A\u5F0F\u3002\u7368\u7ACB\u5DE5\u4F5C\u7A0B\u5E8F\uFF0C\u9650\u6642 200 \u6BEB\u79D2\u3002\u4E0D\u652F\u63F4\u539F\u5B50\u7FA4\u7D44\u3001\u689D\u4EF6\u5F0F\u3001\u5B50\u7A0B\u5E8F\u53CA\u5F15\u64CE\u8FFD\u8E64\u3002\u7D50\u679C\u986F\u793A\u6587\u7AE0\u7D22\u5F15\u53CA\u64F7\u53D6\u3002"))}</p><pre id="captures"></pre></section><p id="search-status" role="status"></p>`;let r,a,i=0;Qt=()=>{i++,r&&r.terminate(),clearTimeout(a)};let o=u("#query",n),c=u("#regex-mode",n),d=u("#flags",n);function f(){let C=++i;if(r&&r.terminate(),clearTimeout(a),!c.checked){t(e.filter(A=>A.text.toLowerCase().includes(o.value.toLowerCase()))),u("#search-status",n).textContent="";return}r=new Worker("./regex.worker.js"),a=setTimeout(()=>{r.terminate(),u("#search-status",n).textContent=s("Pattern exceeded the time limit. Shorten it.","\u6A21\u5F0F\u8D85\u904E\u9650\u6642\uFF0C\u8ACB\u7E2E\u77ED\u3002"),t([])},200),r.onmessage=({data:A})=>{C===i&&(clearTimeout(a),r.terminate(),u("#search-status",n).textContent=A.error||"",u("#captures",n).textContent=A.captures?JSON.stringify(A.captures,null,2):"",t(A.indices?A.indices.map(tn=>e[tn]):[]))},r.postMessage({pattern:o.value,flags:d.value,items:e.map(A=>A.text)})}let g="search-"+n.id,v=le(g,{query:"",mode:!1,flags:"i"});o.value=typeof v.query=="string"?v.query:"",c.checked=v.mode===!0,d.value=typeof v.flags=="string"?v.flags:"i";let S=()=>{D(g,{query:o.value,mode:c.checked,flags:d.value}),f()};o.oninput=S,c.onchange=S,d.oninput=S,u("#clear-flags",n).onclick=()=>{d.value="",S(),d.focus()},u("#clear",n).onclick=()=>{o.value="",S(),o.focus()},u("#builder",n).onclick=()=>{u(".regex",n).hidden=!u(".regex",n).hidden};for(let C of["literal","start","end","group","any"])u("#insert-"+C,n).onclick=()=>{o.value={literal:()=>o.value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),start:()=>"^"+o.value,end:()=>o.value+"$",group:()=>"("+o.value+")",any:()=>o.value+".*"}[C](),c.checked=!0,S()};f()}function zn(){u("#main").innerHTML=`<p class="eyebrow">${l(s("Complete reference","\u5B8C\u6574\u53C3\u8003"))}</p><h1>${l(s("Every article, in one place","\u6240\u6709\u6587\u7AE0\uFF0C\u96C6\u4E2D\u95B1\u8B80"))}</h1><p>${ke.articles.length} ${l(s("complete source articles bundled locally. Source language is retained.","\u7BC7\u5B8C\u6574\u539F\u6587\u5DF2\u5305\u542B\u65BC\u672C\u6A5F\uFF0C\u4FDD\u7559\u539F\u6587\u8A9E\u8A00\u3002"))}</p><div id="search"></div><div id="results" class="article-list"></div>`,en(u("#search"),ke.articles,n=>{u("#results").innerHTML=n.length?n.map(e=>`<a href="#/article/${encodeURIComponent(e.id)}"><strong>${l(e.title)}</strong><small>${l(e.id)}</small></a>`).join(""):`<p>${l(s("No matching articles.","\u6C92\u6709\u7B26\u5408\u7684\u6587\u7AE0\u3002"))}</p>`})}function Un(n,e){let t=ke.articles.find(r=>r.id===n);if(!t){u("#main").innerHTML=`<h1>${l(s("Article unavailable","\u6587\u7AE0\u4E0D\u53EF\u7528"))}</h1><a href="#/reference">${l(s("Open all articles","\u958B\u555F\u5168\u90E8\u6587\u7AE0"))}</a>`;return}u("#main").innerHTML=`<p class="eyebrow">${l(s("Complete article \xB7 original language","\u5B8C\u6574\u6587\u7AE0 \xB7 \u539F\u6587\u8A9E\u8A00"))}</p><article>${t.html}</article><p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/${t.id.split("/").map(encodeURIComponent).join("/")}">${l(s("View source","\u67E5\u770B\u4F86\u6E90"))} \u2197</a></p>`,e&&setTimeout(()=>document.getElementById(e)?.scrollIntoView(),0)}function Hn(){u("#main").innerHTML=`<h1>${l(s("Reading settings","\u95B1\u8B80\u8A2D\u5B9A"))}</h1><p>${l(s("Changes apply only to this documentation on this device.","\u8A2D\u5B9A\u53EA\u5957\u7528\u81F3\u6B64\u88DD\u7F6E\u4E0A\u7684\u6587\u4EF6\u3002"))}</p><div id="settings-search"></div><div id="settings-fields"></div>`;let n=[{id:"language",title:s("Language","\u8A9E\u8A00"),text:"Language English Cantonese bilingual \u8A9E\u8A00",html:`<div class="actions">${[["en","English"],["zh","\u5EE3\u6771\u8A71"],["both","English \xB7 \u5EE3\u6771\u8A71"]].map(([t,r])=>R(r,"lang-"+t,T.language!==t)).join("")}</div><p>${l(s("Navigation and walkthroughs are translated. Source articles retain their original language. Default: English.","\u5C0E\u89BD\u53CA\u6307\u5357\u63D0\u4F9B\u7FFB\u8B6F\u3002\u6587\u7AE0\u4FDD\u7559\u539F\u6587\u3002\u9810\u8A2D\uFF1A\u82F1\u8A9E\u3002"))}</p>`},{id:"theme",title:s("Appearance","\u5916\u89C0"),text:"Appearance theme light dark font size motion \u5916\u89C0",html:`<label class="check"><md-switch id="dark" aria-label="${l(s("Dark theme","\u6DF1\u8272\u4E3B\u984C"))}" ${T.theme==="dark"?"selected":""}></md-switch>${l(s("Dark theme","\u6DF1\u8272\u4E3B\u984C"))}</label><label>${l(s("Text size","\u6587\u5B57\u5927\u5C0F"))}<input type="range" id="size" min="80" max="150" step="10" value="${T.size}"></label><label class="check"><md-switch id="motion" aria-label="${l(s("Reduce motion","\u6E1B\u5C11\u52D5\u614B\u6548\u679C"))}" ${T.motion?"selected":""}></md-switch>${l(s("Reduce motion","\u6E1B\u5C11\u52D5\u614B\u6548\u679C"))}</label><p>${l(s("Defaults: light theme, 100% text, operating-system motion preference.","\u9810\u8A2D\uFF1A\u6DFA\u8272\u4E3B\u984C\u3001100% \u6587\u5B57\u5927\u5C0F\u3001\u8DDF\u96A8\u4F5C\u696D\u7CFB\u7D71\u52D5\u614B\u504F\u597D\u3002"))}</p>`},{id:"wording",title:s("Personal wording","\u500B\u4EBA\u7528\u8A9E"),text:"Personal wording upload replace clear local JSON \u500B\u4EBA\u7528\u8A9E",html:`<label>${l(s("Upload or replace local JSON","\u4E0A\u8F09\u6216\u66F4\u63DB\u672C\u6A5F JSON"))}<input type="file" id="wording-file" accept=".json,application/json"></label><p id="wording-state">${l(Object.keys(ce).length?s("Local wording loaded.","\u5DF2\u8F09\u5165\u672C\u6A5F\u7528\u8A9E\u3002"):s("No local wording loaded.","\u5C1A\u672A\u8F09\u5165\u672C\u6A5F\u7528\u8A9E\u3002"))}</p>${R(s("Clear personal wording","\u6E05\u9664\u500B\u4EBA\u7528\u8A9E"),"wording-clear",!0)}<p>${l(s("Validated locally, maximum 256 KiB. Never uploaded, logged or exported. Default: original wording.","\u53EA\u5728\u672C\u6A5F\u9A57\u8B49\uFF0C\u4E0A\u9650 256 KiB\u3002\u4E0D\u6703\u4E0A\u50B3\u3001\u8A18\u9304\u6216\u532F\u51FA\u3002\u9810\u8A2D\uFF1A\u539F\u6709\u7528\u8A9E\u3002"))}</p>`}];function e(t){u("#settings-fields").innerHTML=t.map(r=>`<section class="setting"><h2>${l(r.title)}</h2>${r.html}</section>`).join("");for(let r of["en","zh","both"])u("#lang-"+r)&&(u("#lang-"+r).onclick=()=>{T.language=r,D("settings",T),we()});u("#dark")&&(u("#dark").onchange=r=>{T.theme=r.target.selected?"dark":"light",D("settings",T),Be()}),u("#size")&&(u("#size").oninput=r=>{T.size=Number(r.target.value),D("settings",T),Be()}),u("#motion")&&(u("#motion").onchange=r=>{T.motion=r.target.selected,D("settings",T),Be()}),u("#wording-file")&&(u("#wording-file").onchange=async r=>{let a=r.target.files?.[0];if(a)try{if(a.size>262144)throw Error();let i=await a.text(),o=kt(i);try{localStorage.setItem("mb-docs-wording",i)}catch{xe=!1}ce=o.entries,we(),H(s(xe?"Local wording applied.":"Storage unavailable. Wording applies for this session only.","\u5DF2\u5957\u7528\u672C\u6A5F\u7528\u8A9E\u3002"))}catch{H(s("Invalid wording file. Nothing changed.","\u7528\u8A9E\u6A94\u6848\u7121\u6548\uFF0C\u672A\u6709\u8B8A\u66F4\u3002"))}finally{r.target.value=""}}),u("#wording-clear")&&(u("#wording-clear").onclick=()=>{try{localStorage.removeItem("mb-docs-wording")}catch{H(s("Storage unavailable. Clear could not be persisted.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u7121\u6CD5\u4FDD\u5B58\u6E05\u9664\u7D50\u679C\u3002"));return}ce={},we(),H(s("Original wording restored.","\u5DF2\u6062\u5FA9\u539F\u6709\u7528\u8A9E\u3002"))})}en(u("#settings-search"),n,e)}function we(){Qt(),$n();let n=location.hash.slice(2)||"home",[e,...t]=n.split("/");if(e==="home")Tt();else if(e==="guide")qn(t[0]);else if(e==="reference")zn();else if(e==="settings")Hn();else if(e==="article"){let[r,a]=t.join("/").split("?"),i;try{i=decodeURIComponent(r)}catch{i=""}Un(i,new URLSearchParams(a).get("anchor"))}else Tt();u("#main").focus({preventScroll:!0}),xe||H(s("Storage unavailable. Changes last for this session only.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u8B8A\u66F4\u53EA\u4FDD\u7559\u81F3\u672C\u6B21\u700F\u89BD\u7D50\u675F\u3002"))}window.addEventListener("hashchange",we);we();})();
/*! Bundled license information:

@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/reactive-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
lit-html/directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@material/web/elevation/internal/elevation.js:
@material/web/elevation/elevation.js:
@material/web/ripple/internal/ripple.js:
@material/web/ripple/ripple.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

@material/web/elevation/internal/elevation-styles.cssresult.js:
@material/web/focus/internal/focus-ring-styles.cssresult.js:
@material/web/ripple/internal/ripple-styles.cssresult.js:
@material/web/button/internal/filled-styles.cssresult.js:
@material/web/button/internal/shared-elevation-styles.cssresult.js:
@material/web/button/internal/shared-styles.cssresult.js:
@material/web/button/internal/outlined-styles.cssresult.js:
@material/web/switch/internal/switch-styles.cssresult.js:
@material/web/checkbox/internal/checkbox-styles.cssresult.js:
  (**
   * @license
   * Copyright 2026 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

@material/web/internal/controller/attachable-controller.js:
@material/web/internal/aria/aria.js:
@material/web/internal/aria/delegate.js:
@material/web/labs/behaviors/element-internals.js:
@material/web/labs/behaviors/form-associated.js:
@material/web/internal/events/dispatch-hooks.js:
@material/web/labs/behaviors/form-submitter.js:
@material/web/labs/behaviors/constraint-validation.js:
@material/web/labs/behaviors/validators/validator.js:
@material/web/labs/behaviors/validators/checkbox-validator.js:
  (**
   * @license
   * Copyright 2023 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

@material/web/focus/internal/focus-ring.js:
@material/web/focus/md-focus-ring.js:
@material/web/internal/motion/animation.js:
@material/web/internal/events/form-label-activation.js:
@material/web/button/internal/filled-button.js:
@material/web/button/filled-button.js:
@material/web/button/internal/outlined-button.js:
@material/web/button/outlined-button.js:
@material/web/internal/events/redispatch-event.js:
@material/web/switch/internal/switch.js:
@material/web/switch/switch.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

lit-html/directives/class-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@material/web/button/internal/button.js:
@material/web/checkbox/internal/checkbox.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)

@material/web/checkbox/checkbox.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   *)
*/
