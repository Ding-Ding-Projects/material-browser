(()=>{var p={source:"2fe219cd63a8185686e7f6e50f33ebf4db3af0d2",version:"0.1.1",updatedAt:"2026-11-01T14:56:43.599Z",articles:[{id:"docs/architecture.md",title:"Architecture and integration contract",category:"architecture.md",html:`<h1 id="architecture-and-integration-contract">Architecture and integration contract</h1>
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
<h2 id="worldlens-presentation-retained-during-the-repository-design-migration">WorldLens presentation retained during the repository-design migration</h2>
<p>The former current README images remain unchanged in the
<a href="#/article/docs%2Fevidence%2Fdesktop%2Fworldlens%2FREADME.md">WorldLens evidence collection</a>, together with its
<a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/inventory.json">inventory</a>, <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/provenance.json">provenance</a>
and original source binding <code>284fc88f94487a7716099469daadeec258d97b07</code>. This includes the
profile overview, notification settings, minimum bilingual layout and launch-review images.
Their recorded capture dates and verification limits remain those of the original receipts.
They are historical references and do not prove the new repository-owned design at <code>0ab6165</code>.</p>
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
<h2 id="readme-presentation-at-source-5922074">README presentation at source 5922074</h2>
<p>Retained verbatim before the combined preferences/history evidence refresh. The image sources and dates remain unchanged.</p>
<pre><code class="language-markdown"># Material Browser

An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.

**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.

- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)
- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)

## Bundled engines and launch behavior

The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.

Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the packaged native host at source \`5922074548f3a79f56b69c25b67826c0be3e209e\`. All four automation clients also completed real title roundtrips. [Runtime summary](docs/evidence/desktop/bundled-runtime-0.1.1.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.

Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.

## Current desktop screenshots

These original images show the packaged version 0.1.1 desktop from source \`5922074548f3a79f56b69c25b67826c0be3e209e\`. They were taken on an isolated hidden desktop with a synthetic vault/profile, inspected, and promoted without changing their bytes. Viewports are 1280 by 1000 at emulated scale 1. This is not physical display-scale or complete accessibility proof.

![Initial encrypted vault setup in Material Browser 0.1.1](docs/evidence/desktop/onboarding-0.1.1.png)

![Explicit standard-identity launch consent in Material Browser 0.1.1](docs/evidence/desktop/launch-consent-0.1.1.png)

![Bilingual dark appearance settings in Material Browser 0.1.1](docs/evidence/desktop/settings-dark-bilingual-0.1.1.png)

The real interface created a vault/profile, skipped optional synchronization, opened and cancelled consent, launched/stopped bundled Chromium, and applied bilingual/dark preferences. Cancel returned focus to the opening control. Separate minimum-viewport observations kept consent actions inside 760 by 580 in Cantonese and bilingual modes. Complete workspace layout, physical scales, keyboard-only use, restart persistence, full localization and native installation/update remain separate acceptance gaps.

[Current evidence inventory](docs/evidence/desktop/inventory.json) \xB7 [Public source/hash summary](docs/evidence/desktop/receipts-0.1.1.json) \xB7 [Earlier desktop and handbook presentation archive](docs/evidence/archive.md)

## Documentation and remaining work

The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.

The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.

</code></pre>
<p><a href="#/article/docs%2Fevidence%2Fdesktop%2Farchive-5922074.md">Previous desktop evidence article</a></p>
<h2 id="earlier-settings-and-history-presentation">Earlier settings and history presentation</h2>
<p>These original version 0.1.1 images show the combined packaged desktop at source <code>04e003fb37fcdc5fecb8ef45806aaae74a69b603</code>. The exact local desktop installer entrypoint completed with exit 0. Images were taken through an isolated hidden desktop, inspected for private data and promoted without changing their bytes. Viewports are 1920 by 1500 at logical scale 1, in English and dark theme.</p>
<p><img src="assets/1cfd296dae406f2272bccf7a09ce546966053446cd0e2fd8f7c1d86ad75235cb.png" alt="Persisted dark theme and compact density after restart" loading="lazy" /></p>
<p><img src="assets/87df3237b05afdd74391c74303ed5072fbf142781e9a040601db756f164a53bb.png" alt="Protected history unlocked after restart with independent access" loading="lazy" /></p>
<p><img src="assets/a80fd03c2b1a2331684ff7ddfa247b628616a2f41e98bb67c92f6117ab45de91.png" alt="Persisted workspace display name and recorded settings change" loading="lazy" /></p>
<p>The visible controls saved dark theme, compact density and a synthetic workspace name. A stale native preference write was rejected. Protected history recorded the settings change, reopened locked after a real process restart and retained its records after unlocking. Both GUI launches saved six complete process identities before closing; all were proven absent and both exact hidden desktops closed.</p>
<p>These observations do not prove physical display-scale coverage, native keyboard behavior, complete localization, history restore/export/recovery or installation/update. Earlier onboarding, consent and bilingual images keep their original provenance in the archive.</p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/inventory.json">Current evidence inventory</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/receipts-04e003f.json">Source/hash summary</a> \xB7 <a href="#/article/docs%2Fevidence%2Farchive.md">Earlier presentation archive</a></p>
<p>Archived during the desktop rewrite preservation pass. Original PNG bytes and source provenance are unchanged; links above were adjusted for this archive location.</p>
<h2 id="desktop-presentation-before-the-worldlens-adaptation">Desktop presentation before the WorldLens adaptation</h2>
<p>The following images predate the WorldLens adaptation and retain their original evidence identity.</p>
<p>These eight original images show the rewritten local package at source <code>baa9512ecbc2727929547059f3b5d95f7cde989f</code>, package version 0.1.1. They were produced on an isolated hidden desktop with actual synthetic backend records, inspected for publication, and promoted without changing their bytes. Exact screen, viewport, theme, source and hash bindings are in the <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/inventory.json">current evidence inventory</a>. The same eight images are published in the <a href="https://ding-ding-projects.github.io/material-browser-evidence/">reviewed interface screenshot gallery</a>, where each live image hash was verified against this inventory.</p>
<p><img src="assets/5a02aa577a49989ef631d8c58a2e3e06ab8a1be8c4571001d008579bcf3e35b9.png" alt="Profile table and selected profile overview with synthetic records" loading="lazy" /></p>
<p><img src="assets/8bbc51770204293b5ab1c9f157956babd726c295022ad6a5ed510630dc1cf1b9.png" alt="Compact settings rows in the packaged desktop application" loading="lazy" /></p>
<p><img src="assets/48e825f489d2c4511e48c5fafca58273be552956c16b88fa256cbb9024b67b34.png" alt="Compact settings navigation at the minimum supported viewport" loading="lazy" /></p>
<p><img src="assets/260b5064d24679b775f524722af74f9e3cc89304077963ecc4d6f52d6eff227f.png" alt="Super Profile template inventory with synthetic records" loading="lazy" /></p>
<p><img src="assets/38dd10e90938a517c6a39496bc848c588f82fc2c020d0906bc34ce10d5f731c9.png" alt="Synchronization workspace before a shared folder is configured" loading="lazy" /></p>
<p><img src="assets/56bd348b441df5e9746be71c82c8be0a37996d3b351d6a5f05a0dcc10a859635.png" alt="Setup wizard with an existing unlocked synthetic vault" loading="lazy" /></p>
<p><img src="assets/ac807b25eb7fd56da6cb5b620cac6db6d3cae13c9ca57fa99173adb0d1d98daa.png" alt="Explicit standard browser identity consent before profile launch" loading="lazy" /></p>
<p><img src="assets/2e03cb0cc8d9d22520fc447037ca34b68458613355c0e2554b71c42a197aa00e.png" alt="Profile revision history after a real snapshot and restore" loading="lazy" /></p>
<p>The representative matrix stopped at the owner-requested preservation boundary: 138 completed cells (48 at 100%, 48 at 125%, 42 at 150%). The 200% run and broader state inventory remain unfinished. Runtime-forced scales and CDP viewport overrides do not establish physical host display-scale or native keyboard proof. Ordinary Firefox launch/stop, bulk duplicate, failure retention, lock redaction and snapshot/restore were exercised separately from the pictures.</p>
<p><a href="#/article/docs%2Fevidence%2Fdesktop%2Fgui-rewrite%2FREADME.md">Current evidence and limitations</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/coverage.json">Coverage</a> \xB7 <a href="#/article/docs%2Fevidence%2Farchive.md">Historical image archive</a></p>
`,text:`# Earlier presentation archive\r
\r
## WorldLens presentation retained during the repository-design migration\r
\r
The former current README images remain unchanged in the\r
[WorldLens evidence collection](desktop/worldlens/README.md), together with its\r
[inventory](desktop/worldlens/inventory.json), [provenance](desktop/worldlens/provenance.json)\r
and original source binding \`284fc88f94487a7716099469daadeec258d97b07\`. This includes the\r
profile overview, notification settings, minimum bilingual layout and launch-review images.\r
Their recorded capture dates and verification limits remain those of the original receipts.\r
They are historical references and do not prove the new repository-owned design at \`0ab6165\`.\r
\r
The earlier desktop and offline-handbook presentation is preserved below as source text. Its original claims and dates are historical, not relabelled as current verification.\r
\r
[Historical desktop images and provenance](desktop/archive.md) \xB7 [Historical portable handbook images and provenance](handbook/README.md)\r
\r
\`\`\`markdown\r
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
[public build/capture summary](docs/evidence/handbook/receipts.json).\r
\`\`\`\r
\r
\r
## README presentation at source 5922074\r
\r
Retained verbatim before the combined preferences/history evidence refresh. The image sources and dates remain unchanged.\r
\r
\`\`\`\`markdown\r
# Material Browser\r
\r
An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.\r
\r
**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.\r
\r
- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)\r
- [Architecture](docs/architecture.md)\r
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)\r
- [Windows build and release automation](docs/features/delivery/windows-automation.md)\r
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)\r
\r
## Bundled engines and launch behavior\r
\r
The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.\r
\r
Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the packaged native host at source \`5922074548f3a79f56b69c25b67826c0be3e209e\`. All four automation clients also completed real title roundtrips. [Runtime summary](docs/evidence/desktop/bundled-runtime-0.1.1.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.\r
\r
Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.\r
\r
## Current desktop screenshots\r
\r
These original images show the packaged version 0.1.1 desktop from source \`5922074548f3a79f56b69c25b67826c0be3e209e\`. They were taken on an isolated hidden desktop with a synthetic vault/profile, inspected, and promoted without changing their bytes. Viewports are 1280 by 1000 at emulated scale 1. This is not physical display-scale or complete accessibility proof.\r
\r
![Initial encrypted vault setup in Material Browser 0.1.1](docs/evidence/desktop/onboarding-0.1.1.png)\r
\r
![Explicit standard-identity launch consent in Material Browser 0.1.1](docs/evidence/desktop/launch-consent-0.1.1.png)\r
\r
![Bilingual dark appearance settings in Material Browser 0.1.1](docs/evidence/desktop/settings-dark-bilingual-0.1.1.png)\r
\r
The real interface created a vault/profile, skipped optional synchronization, opened and cancelled consent, launched/stopped bundled Chromium, and applied bilingual/dark preferences. Cancel returned focus to the opening control. Separate minimum-viewport observations kept consent actions inside 760 by 580 in Cantonese and bilingual modes. Complete workspace layout, physical scales, keyboard-only use, restart persistence, full localization and native installation/update remain separate acceptance gaps.\r
\r
[Current evidence inventory](docs/evidence/desktop/inventory.json) \xB7 [Public source/hash summary](docs/evidence/desktop/receipts-0.1.1.json) \xB7 [Earlier desktop and handbook presentation archive](docs/evidence/archive.md)\r
\r
## Documentation and remaining work\r
\r
The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.\r
\r
The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.\r
\r
\`\`\`\`\r
\r
[Previous desktop evidence article](desktop/archive-5922074.md)\r
\r
\r
## Earlier settings and history presentation\r
\r
These original version 0.1.1 images show the combined packaged desktop at source \`04e003fb37fcdc5fecb8ef45806aaae74a69b603\`. The exact local desktop installer entrypoint completed with exit 0. Images were taken through an isolated hidden desktop, inspected for private data and promoted without changing their bytes. Viewports are 1920 by 1500 at logical scale 1, in English and dark theme.\r
\r
![Persisted dark theme and compact density after restart](desktop/persisted-preferences-04e003f.png)\r
\r
![Protected history unlocked after restart with independent access](desktop/protected-history-04e003f.png)\r
\r
![Persisted workspace display name and recorded settings change](desktop/display-name-history-04e003f.png)\r
\r
The visible controls saved dark theme, compact density and a synthetic workspace name. A stale native preference write was rejected. Protected history recorded the settings change, reopened locked after a real process restart and retained its records after unlocking. Both GUI launches saved six complete process identities before closing; all were proven absent and both exact hidden desktops closed.\r
\r
These observations do not prove physical display-scale coverage, native keyboard behavior, complete localization, history restore/export/recovery or installation/update. Earlier onboarding, consent and bilingual images keep their original provenance in the archive.\r
\r
[Current evidence inventory](desktop/inventory.json) \xB7 [Source/hash summary](desktop/receipts-04e003f.json) \xB7 [Earlier presentation archive](archive.md)\r
\r
\r
Archived during the desktop rewrite preservation pass. Original PNG bytes and source provenance are unchanged; links above were adjusted for this archive location.\r
\r
\r
## Desktop presentation before the WorldLens adaptation\r
\r
The following images predate the WorldLens adaptation and retain their original evidence identity.\r
\r
These eight original images show the rewritten local package at source \`baa9512ecbc2727929547059f3b5d95f7cde989f\`, package version 0.1.1. They were produced on an isolated hidden desktop with actual synthetic backend records, inspected for publication, and promoted without changing their bytes. Exact screen, viewport, theme, source and hash bindings are in the [current evidence inventory](desktop/gui-rewrite/inventory.json). The same eight images are published in the [reviewed interface screenshot gallery](https://ding-ding-projects.github.io/material-browser-evidence/), where each live image hash was verified against this inventory.\r
\r
![Profile table and selected profile overview with synthetic records](desktop/gui-rewrite/profiles-workspace.png)\r
\r
![Compact settings rows in the packaged desktop application](desktop/gui-rewrite/settings-normal.png)\r
\r
![Compact settings navigation at the minimum supported viewport](desktop/gui-rewrite/settings-minimum.png)\r
\r
![Super Profile template inventory with synthetic records](desktop/gui-rewrite/super-profiles.png)\r
\r
![Synchronization workspace before a shared folder is configured](desktop/gui-rewrite/synchronization.png)\r
\r
![Setup wizard with an existing unlocked synthetic vault](desktop/gui-rewrite/setup.png)\r
\r
![Explicit standard browser identity consent before profile launch](desktop/gui-rewrite/launch-consent.png)\r
\r
![Profile revision history after a real snapshot and restore](desktop/gui-rewrite/revisions.png)\r
\r
The representative matrix stopped at the owner-requested preservation boundary: 138 completed cells (48 at 100%, 48 at 125%, 42 at 150%). The 200% run and broader state inventory remain unfinished. Runtime-forced scales and CDP viewport overrides do not establish physical host display-scale or native keyboard proof. Ordinary Firefox launch/stop, bulk duplicate, failure retention, lock redaction and snapshot/restore were exercised separately from the pictures.\r
\r
[Current evidence and limitations](desktop/gui-rewrite/README.md) \xB7 [Coverage](desktop/gui-rewrite/coverage.json) \xB7 [Historical image archive](archive.md)\r
`},{id:"docs/evidence/desktop/README.md",title:"Desktop evidence and current acceptance gap",category:"evidence",html:`<h1 id="desktop-evidence-and-current-acceptance-gap">Desktop evidence and current acceptance gap</h1>
<p>The repository-owned design remake currently has no accepted runtime screenshots. Automatic approval review rejected its task-owned hidden-runtime service launch before execution. Actual rebuilt-application captures, inspection, layout parity and README delivery remain pending. The captures below are historical WorldLens evidence for their stated source.</p>
<p>The historical WorldLens desktop captures come from source <code>284fc88f94487a7716099469daadeec258d97b07</code>. See the <a href="#/article/docs%2Fevidence%2Fdesktop%2Fworldlens%2FREADME.md">complete inspected set and verification limits</a>, <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/inventory.json">exact image inventory</a> and <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/coverage.json">coverage record</a>.</p>
<p><img src="assets/f0cd418acd9bf02ecb07703ef8caa39d90983d72823b1d8f243394c4438c1110.png" alt="Selected profile and inspector in the WorldLens desktop design" loading="lazy" /></p>
<p><img src="assets/e71ba5bf9995272bbc704414a2d8d1685700604a0932c0cbf751892b099c0f05.png" alt="Current action sound switch and volume controls" loading="lazy" /></p>
<p>These are genuine Linux Electron captures with a native Linux host and synthetic records. Startup theme and language variants do not prove Windows native preference saving. Windows packaging, physical input and audible output require separate evidence.</p>
<p><a href="#/article/docs%2Fevidence%2Fdesktop%2Farchive-baa9512.md">Previous desktop evidence article</a> \xB7 <a href="#/article/docs%2Fevidence%2Farchive.md">Earlier image archive</a></p>
`,text:`# Desktop evidence and current acceptance gap\r
\r
The repository-owned design remake currently has no accepted runtime screenshots. Automatic approval review rejected its task-owned hidden-runtime service launch before execution. Actual rebuilt-application captures, inspection, layout parity and README delivery remain pending. The captures below are historical WorldLens evidence for their stated source.\r
\r
The historical WorldLens desktop captures come from source \`284fc88f94487a7716099469daadeec258d97b07\`. See the [complete inspected set and verification limits](worldlens/README.md), [exact image inventory](worldlens/inventory.json) and [coverage record](worldlens/coverage.json).\r
\r
![Selected profile and inspector in the WorldLens desktop design](worldlens/profile-overview.png)\r
\r
![Current action sound switch and volume controls](worldlens/settings-notifications.png)\r
\r
These are genuine Linux Electron captures with a native Linux host and synthetic records. Startup theme and language variants do not prove Windows native preference saving. Windows packaging, physical input and audible output require separate evidence.\r
\r
[Previous desktop evidence article](archive-baa9512.md) \xB7 [Earlier image archive](../archive.md)\r
`},{id:"docs/evidence/desktop/archive-5922074.md",title:"Desktop evidence archive at source 5922074",category:"evidence",html:`<h1 id="desktop-evidence-archive-at-source-5922074">Desktop evidence archive at source 5922074</h1>
<p>The following is the unchanged previous current-evidence article. Its dates, images and source binding remain historical.</p>
<h1 id="current-desktop-evidence">Current desktop evidence</h1>
<p>Source: <code>5922074548f3a79f56b69c25b67826c0be3e209e</code>. Local package version: 0.1.1. The exact root build-installer.bat -Component Desktop completed with exit 0. The native executable is byte-identical to the <code>9011b28</code> host that passed all six bundled engine/mode launch-stop cases.</p>
<p>The images use synthetic data on a named hidden desktop through the Lowlevel route and one exact debugging target. Original PNG bytes were inspected, staged without transformation, hashed and read back. All three prospective observation intervals completed with zero console errors, page errors and unhandled exceptions. The six recorded owned processes were proven absent and the exact desktop closed afterward.</p>
<p><img src="assets/146d6457f95e6fd76ffe3ffb86df42989e77eb03b994138a0ab779ee26e3e761.png" alt="Initial encrypted vault setup in Material Browser 0.1.1" loading="lazy" /></p>
<p><img src="assets/2f4b30ea92cf7235f1c545630d21e431d54ffd70c350fd53400a2a3808b02e61.png" alt="Explicit standard-identity launch consent in Material Browser 0.1.1" loading="lazy" /></p>
<p><img src="assets/4e21d977863937507d4e8ecebbde9e5f9d986fb96a9f85c63ed76b99bffa0c4a.png" alt="Bilingual dark appearance settings in Material Browser 0.1.1" loading="lazy" /></p>
<p>The 1280 by 1000 viewport uses logical emulated scale 1. Capture dates and UTC timezone come from the producing observation receipts, not filenames or file timestamps. The build timestamp records observed package readiness before launch, with the separate installer completion receipt retained privately. No private vocabulary was imported and no real user data, credential or unrelated window is visible.</p>
<p>These images do not prove native installation/update, complete physical scale coverage, keyboard-only access, full localization, all feature contracts or current offline-handbook runtime acceptance. Minimum-viewport dialog observations are separate from full workspace layout acceptance.</p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/inventory.json">Inventory</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/receipts-0.1.1.json">Public receipt summary</a> \xB7 <a href="#/article/docs%2Fevidence%2Fdesktop%2Farchive.md">Historical desktop article and original images</a></p>
`,text:`# Desktop evidence archive at source 5922074

The following is the unchanged previous current-evidence article. Its dates, images and source binding remain historical.

# Current desktop evidence

Source: \`5922074548f3a79f56b69c25b67826c0be3e209e\`. Local package version: 0.1.1. The exact root build-installer.bat -Component Desktop completed with exit 0. The native executable is byte-identical to the \`9011b28\` host that passed all six bundled engine/mode launch-stop cases.

The images use synthetic data on a named hidden desktop through the Lowlevel route and one exact debugging target. Original PNG bytes were inspected, staged without transformation, hashed and read back. All three prospective observation intervals completed with zero console errors, page errors and unhandled exceptions. The six recorded owned processes were proven absent and the exact desktop closed afterward.

![Initial encrypted vault setup in Material Browser 0.1.1](onboarding-0.1.1.png)

![Explicit standard-identity launch consent in Material Browser 0.1.1](launch-consent-0.1.1.png)

![Bilingual dark appearance settings in Material Browser 0.1.1](settings-dark-bilingual-0.1.1.png)

The 1280 by 1000 viewport uses logical emulated scale 1. Capture dates and UTC timezone come from the producing observation receipts, not filenames or file timestamps. The build timestamp records observed package readiness before launch, with the separate installer completion receipt retained privately. No private vocabulary was imported and no real user data, credential or unrelated window is visible.

These images do not prove native installation/update, complete physical scale coverage, keyboard-only access, full localization, all feature contracts or current offline-handbook runtime acceptance. Minimum-viewport dialog observations are separate from full workspace layout acceptance.

[Inventory](inventory.json) \xB7 [Public receipt summary](receipts-0.1.1.json) \xB7 [Historical desktop article and original images](archive.md)
`},{id:"docs/evidence/desktop/archive-baa9512.md",title:"Historical desktop evidence at source baa9512",category:"evidence",html:`<h1 id="historical-desktop-evidence-at-source-baa9512">Historical desktop evidence at source baa9512</h1>
<p>The previous current-evidence article follows unchanged. Its source, images and original verification claims are historical after the WorldLens adaptation.</p>
<h1 id="current-desktop-evidence">Current desktop evidence</h1>
<p>The current desktop rewrite images and receipts are in the <a href="#/article/docs%2Fevidence%2Fdesktop%2Fgui-rewrite%2FREADME.md">source-bound GUI inventory</a>, at source <code>baa9512ecbc2727929547059f3b5d95f7cde989f</code>.</p>
<p><img src="assets/5a02aa577a49989ef631d8c58a2e3e06ab8a1be8c4571001d008579bcf3e35b9.png" alt="Profile table and selected profile overview with synthetic records" loading="lazy" /></p>
<p><img src="assets/8bbc51770204293b5ab1c9f157956babd726c295022ad6a5ed510630dc1cf1b9.png" alt="Compact settings rows in the packaged desktop application" loading="lazy" /></p>
<p><img src="assets/48e825f489d2c4511e48c5fafca58273be552956c16b88fa256cbb9024b67b34.png" alt="Compact settings navigation at the minimum supported viewport" loading="lazy" /></p>
<p><img src="assets/260b5064d24679b775f524722af74f9e3cc89304077963ecc4d6f52d6eff227f.png" alt="Super Profile template inventory with synthetic records" loading="lazy" /></p>
<p><img src="assets/38dd10e90938a517c6a39496bc848c588f82fc2c020d0906bc34ce10d5f731c9.png" alt="Synchronization workspace before a shared folder is configured" loading="lazy" /></p>
<p><img src="assets/56bd348b441df5e9746be71c82c8be0a37996d3b351d6a5f05a0dcc10a859635.png" alt="Setup wizard with an existing unlocked synthetic vault" loading="lazy" /></p>
<p><img src="assets/ac807b25eb7fd56da6cb5b620cac6db6d3cae13c9ca57fa99173adb0d1d98daa.png" alt="Explicit standard browser identity consent before profile launch" loading="lazy" /></p>
<p><img src="assets/2e03cb0cc8d9d22520fc447037ca34b68458613355c0e2554b71c42a197aa00e.png" alt="Profile revision history after a real snapshot and restore" loading="lazy" /></p>
<p>The GUI source and focused interactions are preserved; full product acceptance is incomplete. The representative matrix contains 138 completed cells, with the remainder and broader states explicitly listed in <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/coverage.json">coverage</a>. Scale emulation, native input, guest lifecycle, conflict resolution, installation/update and deployed documentation have separate verdicts.</p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/inventory.json">Current inventory</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/receipts.json">Receipt summary</a> \xB7 <a href="#/article/docs%2Fevidence%2Farchive.md">Earlier presentation archive</a></p>
`,text:`# Historical desktop evidence at source baa9512\r
\r
The previous current-evidence article follows unchanged. Its source, images and original verification claims are historical after the WorldLens adaptation.\r
\r
# Current desktop evidence\r
\r
The current desktop rewrite images and receipts are in the [source-bound GUI inventory](gui-rewrite/README.md), at source \`baa9512ecbc2727929547059f3b5d95f7cde989f\`.\r
\r
![Profile table and selected profile overview with synthetic records](gui-rewrite/profiles-workspace.png)\r
\r
![Compact settings rows in the packaged desktop application](gui-rewrite/settings-normal.png)\r
\r
![Compact settings navigation at the minimum supported viewport](gui-rewrite/settings-minimum.png)\r
\r
![Super Profile template inventory with synthetic records](gui-rewrite/super-profiles.png)\r
\r
![Synchronization workspace before a shared folder is configured](gui-rewrite/synchronization.png)\r
\r
![Setup wizard with an existing unlocked synthetic vault](gui-rewrite/setup.png)\r
\r
![Explicit standard browser identity consent before profile launch](gui-rewrite/launch-consent.png)\r
\r
![Profile revision history after a real snapshot and restore](gui-rewrite/revisions.png)\r
\r
The GUI source and focused interactions are preserved; full product acceptance is incomplete. The representative matrix contains 138 completed cells, with the remainder and broader states explicitly listed in [coverage](gui-rewrite/coverage.json). Scale emulation, native input, guest lifecycle, conflict resolution, installation/update and deployed documentation have separate verdicts.\r
\r
[Current inventory](gui-rewrite/inventory.json) \xB7 [Receipt summary](gui-rewrite/receipts.json) \xB7 [Earlier presentation archive](../archive.md)\r
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
`},{id:"docs/evidence/desktop/current-20261101/README.md",title:"Current desktop evidence, 1 November 2026",category:"evidence",html:`<h1 id="current-desktop-evidence-1-november-2026">Current desktop evidence, 1 November 2026</h1>
<p>These three unedited screenshots come from source
<code>62563ae1626f966bd063ce0e38c53353de84ba22</code>, produced by the exact
<code>build.bat -Component Desktop</code> entrypoint. The renderer SHA-256 is
<code>e396adfbbc514edd48dc16a3c2dee8a83b7bf513bed991cf2eeec7ec23fbc820</code>.
The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/current-20261101/inventory.json">inventory</a> records exact image hashes, UTC capture intervals,
screen states and measured viewports. Earlier README presentation is preserved in the
<a href="#/article/docs%2Fevidence%2Fdesktop%2Fcurrent-20261101%2Freadme-image-archive.md">source-bound image archive</a>; its original images and metadata
have not been deleted, changed or relabelled.</p>
<p>All three supported promotion receipts passed before the evidence commit at the captured
source. The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/current-20261101/validation.json">validation summary</a> records their exact results. Removing a
required inventory ID caused rejection; restoring the original bytes passed again. The
promoted PNGs were reopened for visual inspection after byte-identical staging.</p>
<h2 id="supported-preset-inventory">Supported preset inventory</h2>
<p><img src="assets/ad909a04e9d9e592510a0e636b7bda5b639de3d601133e5c95803bdc0cd94397.png" alt="Current Minecraft 1.21.4 inventory with five selectable presets and the unavailable debug preset" loading="lazy" /></p>
<p>Minecraft 1.21.4 exposes five selectable presets and retains the discovered debug preset
with an explicit unavailable reason. All twelve requested English, Cantonese and bilingual,
light/dark, normal/minimum viewport cases preserved that inventory. Scoped measurements
found no horizontal overflow across nested panes, preset groups, the reason, Random seed
or chips. Renderer ArrowRight input visited all five choices with matching focus and
selection. No EULA was accepted and no world generation was started.</p>
<h2 id="explicit-unsupported-version-state">Explicit unsupported-version state</h2>
<p><img src="assets/04004458358acf92b4c90bcb1d35de643dea2b82981c1eb8492871188531f14d.png" alt="Current Minecraft 26.3 unavailable customization state retaining all seven presets" loading="lazy" /></p>
<p>Minecraft 26.3 retains all seven discovered presets as noninteractive entries because its
customization schema is unsupported. Its readiness capability does not make generation
available. The older 1.19.3 readiness-unavailable case was also checked independently with
six retained presets. The verified archives and report caches were reused unchanged.</p>
<h2 id="current-minimum-personalize-state">Current minimum Personalize state</h2>
<p><img src="assets/fd8c5b6ed5ab7cd247544808d0f9bf2fa886f95667c922c091a0f8a651159873.png" alt="Current bilingual Personalize controls at the minimum 760 by 580 viewport" loading="lazy" /></p>
<p>This representative bilingual dark view shows the upper Appearance controls after vertical
scrolling at 760 \xD7 580. Lower controls remain below the fold. A real teal swatch was selected
in the isolated fixture; this image is not a new exhaustive Personalize matrix.</p>
<h2 id="font-delivery-and-observation-scope">Font delivery and observation scope</h2>
<p>The built font checker passed with 267 declarations, 303 references, 188 unique assets and
all six required fonts matching their source bytes. The policy remains exactly
<code>font-src 'self'</code>. Cached initial/post-matrix diagnostics and renderer reloads observed from
before reload until document, language and fonts were ready reported zero font CSP blocks,
uncaught exceptions, console errors or resource failures. The English and bilingual reloads
observed respectively two and fourteen successful local font responses.</p>
<p>The route was a named off-screen desktop launched through the installed direct CLI, with
exact process/window ownership and single-target CDP checks. Images are page-only captures
at requested scale 1 and observed DPR <code>1.0000000298023224</code>: the two inventory images are
1280 \xD7 1400, and Personalize is 760 \xD7 580. This is page emulation and renderer input, not
physical display-scaling, physical keyboard, full native-process startup, screen-reader,
installer or release proof. Complete visual parity and world generation are not claimed.</p>
<p>All originals were decoded and visually inspected. No pixels were cropped, annotated,
resized or recompressed. Native identities, machine paths and full interaction receipts
remain outside tracked documentation. The owned application closed normally and its
recorded process tree and named desktop were verified absent.</p>
`,text:`# Current desktop evidence, 1 November 2026

These three unedited screenshots come from source
\`62563ae1626f966bd063ce0e38c53353de84ba22\`, produced by the exact
\`build.bat -Component Desktop\` entrypoint. The renderer SHA-256 is
\`e396adfbbc514edd48dc16a3c2dee8a83b7bf513bed991cf2eeec7ec23fbc820\`.
The [inventory](inventory.json) records exact image hashes, UTC capture intervals,
screen states and measured viewports. Earlier README presentation is preserved in the
[source-bound image archive](readme-image-archive.md); its original images and metadata
have not been deleted, changed or relabelled.

All three supported promotion receipts passed before the evidence commit at the captured
source. The [validation summary](validation.json) records their exact results. Removing a
required inventory ID caused rejection; restoring the original bytes passed again. The
promoted PNGs were reopened for visual inspection after byte-identical staging.

## Supported preset inventory

![Current Minecraft 1.21.4 inventory with five selectable presets and the unavailable debug preset](world-1.21.4-inventory.png)

Minecraft 1.21.4 exposes five selectable presets and retains the discovered debug preset
with an explicit unavailable reason. All twelve requested English, Cantonese and bilingual,
light/dark, normal/minimum viewport cases preserved that inventory. Scoped measurements
found no horizontal overflow across nested panes, preset groups, the reason, Random seed
or chips. Renderer ArrowRight input visited all five choices with matching focus and
selection. No EULA was accepted and no world generation was started.

## Explicit unsupported-version state

![Current Minecraft 26.3 unavailable customization state retaining all seven presets](world-26.3-unavailable.png)

Minecraft 26.3 retains all seven discovered presets as noninteractive entries because its
customization schema is unsupported. Its readiness capability does not make generation
available. The older 1.19.3 readiness-unavailable case was also checked independently with
six retained presets. The verified archives and report caches were reused unchanged.

## Current minimum Personalize state

![Current bilingual Personalize controls at the minimum 760 by 580 viewport](personalize-minimum.png)

This representative bilingual dark view shows the upper Appearance controls after vertical
scrolling at 760 \xD7 580. Lower controls remain below the fold. A real teal swatch was selected
in the isolated fixture; this image is not a new exhaustive Personalize matrix.

## Font delivery and observation scope

The built font checker passed with 267 declarations, 303 references, 188 unique assets and
all six required fonts matching their source bytes. The policy remains exactly
\`font-src 'self'\`. Cached initial/post-matrix diagnostics and renderer reloads observed from
before reload until document, language and fonts were ready reported zero font CSP blocks,
uncaught exceptions, console errors or resource failures. The English and bilingual reloads
observed respectively two and fourteen successful local font responses.

The route was a named off-screen desktop launched through the installed direct CLI, with
exact process/window ownership and single-target CDP checks. Images are page-only captures
at requested scale 1 and observed DPR \`1.0000000298023224\`: the two inventory images are
1280 \xD7 1400, and Personalize is 760 \xD7 580. This is page emulation and renderer input, not
physical display-scaling, physical keyboard, full native-process startup, screen-reader,
installer or release proof. Complete visual parity and world generation are not claimed.

All originals were decoded and visually inspected. No pixels were cropped, annotated,
resized or recompressed. Native identities, machine paths and full interaction receipts
remain outside tracked documentation. The owned application closed normally and its
recorded process tree and named desktop were verified absent.
`},{id:"docs/evidence/desktop/current-20261101/readme-image-archive.md",title:"Earlier README image presentation",category:"evidence",html:`<h1 id="earlier-readme-image-presentation">Earlier README image presentation</h1>
<p>Archived on 2026-11-01 (UTC) from README at source <code>62563ae1626f966bd063ce0e38c53353de84ba22</code>, before the current-image update. This archive date is not a capture date. The original image bytes, inventories, validation records and earlier archives are retained unchanged. The two historical sets keep their original <code>47e8ae1</code> and <code>5c66624</code> source bindings.</p>
<h2 id="verified-repair-screenshots">Verified repair screenshots</h2>
<p>These genuine Windows desktop images are bound to source <code>47e8ae104755d38e9d115fbb08636143bc6278cb</code>.
They show four bounded repair checks, not complete feature, layout, accessibility or installer acceptance.
<a href="#/article/docs%2Fevidence%2Fdesktop%2Frepair-20261101%2FREADME.md">Evidence and limitations</a>.
<a href="#/article/docs%2Fevidence%2Fdesktop%2Fm3-redesign%2Freadme-image-archive.md">Earlier screenshots and original provenance</a>.</p>
<h3 id="saved-appearance-at-cold-startup">Saved appearance at cold startup</h3>
<p>The saved red primary-button appearance is applied before the vault is unlocked.</p>
<p><img src="assets/c621130b35f14b69ba78634b10485db711c26b04dedb6e56eb32ee744838ac29.png" alt="Saved appearance restored before vault unlock" loading="lazy" /></p>
<h3 id="truthful-storage-feedback">Truthful storage feedback</h3>
<p>This is an explicitly injected, fixture-only storage failure. Session-only warnings and retry controls remain visible.</p>
<p><img src="assets/13cd574c8ee76196ff05980f6cbebdfa763f98c70cb52ef7592505962219d076.png" alt="Injected storage failure with session-only warnings and retry controls" loading="lazy" /></p>
<h3 id="unresolved-rendered-contrast">Unresolved rendered contrast</h3>
<p>The real focus-mode opacity state reports contrast as unavailable rather than inventing a passing value.</p>
<p><img src="assets/b4df22867b820609572e112f286287b6c40be20e21667912da69009fa97621ac.png" alt="Dimmed pane with contrast explicitly unavailable" loading="lazy" /></p>
<h3 id="hue-accessibility-boundary">Hue accessibility boundary</h3>
<p>The pointer endpoint remains within the declared hue range. This does not claim physical keyboard or screen-reader acceptance.</p>
<p><img src="assets/6c9e85c556b373356e7945c3c9ffb224fc30a83a1c478e6e6240b8fc8d271782.png" alt="Hue pointer endpoint with the handle at the right edge" loading="lazy" /></p>
<h2 id="measured-minimum-layout-repairs">Measured minimum-layout repairs</h2>
<p>These later captures are bound to source <code>5c6662455bd968edfe4a4ebcad30b1e902d03b20</code>.
The four repair images above retain their original <code>47e8ae1</code> source and independent scope.
The two images below show bilingual light mode at 760 \xD7 580 with an expanded navigation rail
and requested CDP scale 1. They provide bounded layout and renderer-keyboard evidence, not
physical display-scale or full accessibility certification.
<a href="#/article/docs%2Fevidence%2Fdesktop%2Flayout-20261101%2FREADME.md">Exact inventory, capture times and verification limits</a>.</p>
<p><img src="assets/de47ea847d33a3331a0dd73fcedd705155519ca1e9ab094f133e0b3b56fcd0e2.png" alt="Minimum bilingual Focus view with Settings reachable and Lock focused" loading="lazy" /></p>
<p>Renderer Tab navigation reached Settings and then Lock, with visible focus. The destination
list scrolls independently while Lock remains visible.</p>
<p><img src="assets/62a864dbb6d6c1756cf23fff831367da2149ca1618920c7bd799add10ccf20ce.png" alt="Minimum bilingual Appearance controls inside their owning pane" loading="lazy" /></p>
<p>The upper Appearance controls are shown after vertical scrolling. Lower controls remain below
the fold; the measured horizontal containment does not claim complete visual parity.</p>
`,text:`# Earlier README image presentation

Archived on 2026-11-01 (UTC) from README at source \`62563ae1626f966bd063ce0e38c53353de84ba22\`, before the current-image update. This archive date is not a capture date. The original image bytes, inventories, validation records and earlier archives are retained unchanged. The two historical sets keep their original \`47e8ae1\` and \`5c66624\` source bindings.

## Verified repair screenshots\r
\r
These genuine Windows desktop images are bound to source \`47e8ae104755d38e9d115fbb08636143bc6278cb\`.\r
They show four bounded repair checks, not complete feature, layout, accessibility or installer acceptance.\r
[Evidence and limitations](../repair-20261101/README.md).\r
[Earlier screenshots and original provenance](../m3-redesign/readme-image-archive.md).\r
\r
### Saved appearance at cold startup\r
\r
The saved red primary-button appearance is applied before the vault is unlocked.\r
\r
![Saved appearance restored before vault unlock](../repair-20261101/issue-11.png)\r
\r
### Truthful storage feedback\r
\r
This is an explicitly injected, fixture-only storage failure. Session-only warnings and retry controls remain visible.\r
\r
![Injected storage failure with session-only warnings and retry controls](../repair-20261101/issue-12.png)\r
\r
### Unresolved rendered contrast\r
\r
The real focus-mode opacity state reports contrast as unavailable rather than inventing a passing value.\r
\r
![Dimmed pane with contrast explicitly unavailable](../repair-20261101/issue-13.png)\r
\r
### Hue accessibility boundary\r
\r
The pointer endpoint remains within the declared hue range. This does not claim physical keyboard or screen-reader acceptance.\r
\r
![Hue pointer endpoint with the handle at the right edge](../repair-20261101/issue-14.png)\r
\r
## Measured minimum-layout repairs\r
\r
These later captures are bound to source \`5c6662455bd968edfe4a4ebcad30b1e902d03b20\`.\r
The four repair images above retain their original \`47e8ae1\` source and independent scope.\r
The two images below show bilingual light mode at 760 \xD7 580 with an expanded navigation rail\r
and requested CDP scale 1. They provide bounded layout and renderer-keyboard evidence, not\r
physical display-scale or full accessibility certification.\r
[Exact inventory, capture times and verification limits](../layout-20261101/README.md).\r
\r
![Minimum bilingual Focus view with Settings reachable and Lock focused](../layout-20261101/minimum-bilingual-focus.png)\r
\r
Renderer Tab navigation reached Settings and then Lock, with visible focus. The destination\r
list scrolls independently while Lock remains visible.\r
\r
![Minimum bilingual Appearance controls inside their owning pane](../layout-20261101/minimum-bilingual-appearance.png)\r
\r
The upper Appearance controls are shown after vertical scrolling. Lower controls remain below\r
the fold; the measured horizontal containment does not claim complete visual parity.
`},{id:"docs/evidence/desktop/gui-rewrite/README.md",title:"Historical desktop rewrite evidence",category:"evidence",html:`<h1 id="historical-desktop-rewrite-evidence">Historical desktop rewrite evidence</h1>
<p>These images predate the WorldLens adaptation. <a href="#/article/docs%2Fevidence%2Fdesktop%2Fworldlens%2FREADME.md">Current desktop evidence</a> is kept separately.</p>
<p>These original images show the source-bound packaged application with isolated synthetic records. The complete raw matrix is retained privately.</p>
<p><img src="assets/5a02aa577a49989ef631d8c58a2e3e06ab8a1be8c4571001d008579bcf3e35b9.png" alt="Profile table and selected profile overview with synthetic records" loading="lazy" /></p>
<p><img src="assets/8bbc51770204293b5ab1c9f157956babd726c295022ad6a5ed510630dc1cf1b9.png" alt="Compact settings rows in the packaged desktop application" loading="lazy" /></p>
<p><img src="assets/48e825f489d2c4511e48c5fafca58273be552956c16b88fa256cbb9024b67b34.png" alt="Compact settings navigation at the minimum supported viewport" loading="lazy" /></p>
<p><img src="assets/260b5064d24679b775f524722af74f9e3cc89304077963ecc4d6f52d6eff227f.png" alt="Super Profile template inventory with synthetic records" loading="lazy" /></p>
<p><img src="assets/38dd10e90938a517c6a39496bc848c588f82fc2c020d0906bc34ce10d5f731c9.png" alt="Synchronization workspace before a shared folder is configured" loading="lazy" /></p>
<p><img src="assets/56bd348b441df5e9746be71c82c8be0a37996d3b351d6a5f05a0dcc10a859635.png" alt="Setup wizard with an existing unlocked synthetic vault" loading="lazy" /></p>
<p><img src="assets/ac807b25eb7fd56da6cb5b620cac6db6d3cae13c9ca57fa99173adb0d1d98daa.png" alt="Explicit standard browser identity consent before profile launch" loading="lazy" /></p>
<p><img src="assets/2e03cb0cc8d9d22520fc447037ca34b68458613355c0e2554b71c42a197aa00e.png" alt="Profile revision history after a real snapshot and restore" loading="lazy" /></p>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/inventory.json">Inventory</a> \xB7 <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/gui-rewrite/receipts.json">Receipt summary</a></p>
<ul>
<li>Verification stopped at the owner-requested preservation boundary. The product task remains incomplete.</li>
<li>The representative matrix contains 138 completed unobstructed cells: 48 at 100%, 48 at 125%, and 42 at 150%. The 200% run was not started.</li>
<li>The first 125% pass retains 48 notification-obscured variants separately; these are excluded from the default-state gallery.</li>
<li>Scales were forced in isolated application processes; CSS viewport overrides are separately recorded. Physical host display settings were not changed or verified.</li>
<li>The matrix covers four representative surfaces, not every state in the design inventory.</li>
<li>Native keyboard delivery, all ten settings category screenshots, additional create/filter/sort/setup workflows, sync conflict resolution and guest lifecycle states remain unverified.</li>
<li>Prospective console and page observation does not cover startup history or native stderr.</li>
</ul>
`,text:`# Historical desktop rewrite evidence\r
\r
These images predate the WorldLens adaptation. [Current desktop evidence](../worldlens/README.md) is kept separately.\r
\r
These original images show the source-bound packaged application with isolated synthetic records. The complete raw matrix is retained privately.\r
\r
![Profile table and selected profile overview with synthetic records](profiles-workspace.png)\r
\r
![Compact settings rows in the packaged desktop application](settings-normal.png)\r
\r
![Compact settings navigation at the minimum supported viewport](settings-minimum.png)\r
\r
![Super Profile template inventory with synthetic records](super-profiles.png)\r
\r
![Synchronization workspace before a shared folder is configured](synchronization.png)\r
\r
![Setup wizard with an existing unlocked synthetic vault](setup.png)\r
\r
![Explicit standard browser identity consent before profile launch](launch-consent.png)\r
\r
![Profile revision history after a real snapshot and restore](revisions.png)\r
\r
[Inventory](inventory.json) \xB7 [Receipt summary](receipts.json)\r
\r
- Verification stopped at the owner-requested preservation boundary. The product task remains incomplete.\r
- The representative matrix contains 138 completed unobstructed cells: 48 at 100%, 48 at 125%, and 42 at 150%. The 200% run was not started.\r
- The first 125% pass retains 48 notification-obscured variants separately; these are excluded from the default-state gallery.\r
- Scales were forced in isolated application processes; CSS viewport overrides are separately recorded. Physical host display settings were not changed or verified.\r
- The matrix covers four representative surfaces, not every state in the design inventory.\r
- Native keyboard delivery, all ten settings category screenshots, additional create/filter/sort/setup workflows, sync conflict resolution and guest lifecycle states remain unverified.\r
- Prospective console and page observation does not cover startup history or native stderr.\r
`},{id:"docs/evidence/desktop/layout-20261101/README.md",title:"Minimum-layout repair evidence",category:"evidence",html:`<h1 id="minimum-layout-repair-evidence">Minimum-layout repair evidence</h1>
<p>These two original Windows desktop screenshots were captured from source
<code>5c6662455bd968edfe4a4ebcad30b1e902d03b20</code>, after the navigation-rail and Personalize
horizontal-layout repairs. The earlier four repair images remain in
<a href="#/article/docs%2Fevidence%2Fdesktop%2Frepair-20261101%2FREADME.md">their original evidence article</a>, bound to source <code>47e8ae1</code>.
They have not been relabelled or replaced by this pair.</p>
<p>The exact <code>build.bat -Component Desktop</code> run completed successfully. Its renderer SHA-256 is
<code>81a0cda8592aa01635ea22b460b8ea897e16acfb281cdc53afc9a92f5c35f096</code>.
The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/layout-20261101/inventory.json">inventory</a> records the exact state, image hashes and capture intervals.
Both supported promotion receipts passed before the evidence commit, while the target checkout
was at the captured source. The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/layout-20261101/validation.json">validation summary</a> records those results.
A missing-ID negative check was rejected; restoring the exact original inventory bytes passed.</p>
<h2 id="focus-and-navigation">Focus and navigation</h2>
<p><img src="assets/de47ea847d33a3331a0dd73fcedd705155519ca1e9ab094f133e0b3b56fcd0e2.png" alt="Minimum bilingual Focus view with Settings reachable and Lock focused" loading="lazy" /></p>
<p>At 760 \xD7 580, bilingual light mode and an expanded rail, renderer Tab events reached Settings
and then Lock. Settings was inside the independently scrolling destination area; Lock remained
inside the rail and viewport. Both controls exposed a visible focus outline.</p>
<p>The actual capture interval was <strong>2026-11-01 10:34:11.068\u201310:34:11.111 UTC</strong>.</p>
<h2 id="scrolled-appearance-controls">Scrolled Appearance controls</h2>
<p><img src="assets/62a864dbb6d6c1756cf23fff831367da2149ca1618920c7bd799add10ccf20ce.png" alt="Minimum bilingual Appearance controls inside their owning pane" loading="lazy" /></p>
<p>The Appearance pane was scrolled into view through its real scroll container. Its upper
controls remained within the measured horizontal bounds. Lower controls remain below the fold,
so this image does not claim that every control is visible at once.</p>
<p>The actual capture interval was <strong>2026-11-01 10:34:11.123\u201310:34:11.162 UTC</strong>.</p>
<h2 id="route-and-limits">Route and limits</h2>
<p>Both images used the same isolated application session on a named off-screen desktop launched
through the installed direct CLI. CDP provided page-only screenshots and renderer keyboard
events, starting from an explicitly focused rail menu. The native window owner, exact page
target, stable source and build inputs were observed. The owned process tree closed normally
and was verified absent.</p>
<p>The requested CDP scale was 1; the observed device-pixel ratio was <code>1.0000000298023224</code>.
This is page-emulation evidence, not a physical display-scaling or physical keyboard test.
Each PNG is 760 \xD7 580 and is byte-identical to its inspected original. No pixels were cropped,
annotated, resized or recompressed. Private machine paths, process identities and detailed
interaction receipts remain outside tracked documentation.</p>
<p>The surrounding matrix measured 96 size, scale, language, theme and rail combinations, but
this article promotes only these two inspected representative images. It does not claim full
visual parity, complete accessibility, installer acceptance or release delivery.</p>
`,text:`# Minimum-layout repair evidence\r
\r
These two original Windows desktop screenshots were captured from source\r
\`5c6662455bd968edfe4a4ebcad30b1e902d03b20\`, after the navigation-rail and Personalize\r
horizontal-layout repairs. The earlier four repair images remain in\r
[their original evidence article](../repair-20261101/README.md), bound to source \`47e8ae1\`.\r
They have not been relabelled or replaced by this pair.\r
\r
The exact \`build.bat -Component Desktop\` run completed successfully. Its renderer SHA-256 is\r
\`81a0cda8592aa01635ea22b460b8ea897e16acfb281cdc53afc9a92f5c35f096\`.\r
The [inventory](inventory.json) records the exact state, image hashes and capture intervals.\r
Both supported promotion receipts passed before the evidence commit, while the target checkout\r
was at the captured source. The [validation summary](validation.json) records those results.\r
A missing-ID negative check was rejected; restoring the exact original inventory bytes passed.\r
\r
## Focus and navigation\r
\r
![Minimum bilingual Focus view with Settings reachable and Lock focused](minimum-bilingual-focus.png)\r
\r
At 760 \xD7 580, bilingual light mode and an expanded rail, renderer Tab events reached Settings\r
and then Lock. Settings was inside the independently scrolling destination area; Lock remained\r
inside the rail and viewport. Both controls exposed a visible focus outline.\r
\r
The actual capture interval was **2026-11-01 10:34:11.068\u201310:34:11.111 UTC**.\r
\r
## Scrolled Appearance controls\r
\r
![Minimum bilingual Appearance controls inside their owning pane](minimum-bilingual-appearance.png)\r
\r
The Appearance pane was scrolled into view through its real scroll container. Its upper\r
controls remained within the measured horizontal bounds. Lower controls remain below the fold,\r
so this image does not claim that every control is visible at once.\r
\r
The actual capture interval was **2026-11-01 10:34:11.123\u201310:34:11.162 UTC**.\r
\r
## Route and limits\r
\r
Both images used the same isolated application session on a named off-screen desktop launched\r
through the installed direct CLI. CDP provided page-only screenshots and renderer keyboard\r
events, starting from an explicitly focused rail menu. The native window owner, exact page\r
target, stable source and build inputs were observed. The owned process tree closed normally\r
and was verified absent.\r
\r
The requested CDP scale was 1; the observed device-pixel ratio was \`1.0000000298023224\`.\r
This is page-emulation evidence, not a physical display-scaling or physical keyboard test.\r
Each PNG is 760 \xD7 580 and is byte-identical to its inspected original. No pixels were cropped,\r
annotated, resized or recompressed. Private machine paths, process identities and detailed\r
interaction receipts remain outside tracked documentation.\r
\r
The surrounding matrix measured 96 size, scale, language, theme and rail combinations, but\r
this article promotes only these two inspected representative images. It does not claim full\r
visual parity, complete accessibility, installer acceptance or release delivery.\r
`},{id:"docs/evidence/desktop/m3-redesign/README.md",title:"Redesigned desktop: runtime captures",category:"evidence",html:`<h1 id="redesigned-desktop-runtime-captures">Redesigned desktop: runtime captures</h1>
<p>These images come from the running desktop application, not from the design
artboards. Each was taken from the real Electron shell talking to the real
native host (<code>target/release/material-browser</code>, built from this source) with a
disposable data folder created for the capture. Profiles, the template, the
lock and the sync folder shown were created through the interface during the
run; nothing is mocked.</p>
<ul>
<li>Source: commit <code>264d81d</code> on <code>main</code> (renderer built with <code>vite build</code>).</li>
<li>Platform: Linux x64 under Xvfb, Electron 44.9.0, 1440 x 960 logical pixels
(the compact capture is 420 x 860), default dark theme.</li>
<li>Data: a fresh temporary folder per run, removed afterwards.</li>
</ul>
<h2 id="what-the-captures-show">What the captures show</h2>
<table>
<thead>
<tr>
<th>File</th>
<th>Surface</th>
</tr>
</thead>
<tbody>
<tr>
<td>01-create-vault.png</td>
<td>First start: create the vault beside the four-step first run</td>
</tr>
<tr>
<td>02-first-run.png</td>
<td>Vault created; step 2 of the first run</td>
</tr>
<tr>
<td>03-profiles.png</td>
<td>Profiles list-detail with a selection and the floating toolbar</td>
</tr>
<tr>
<td>04-launch.png</td>
<td>Launch page with the engine list, automation group and review card</td>
</tr>
<tr>
<td>05-super-profiles.png</td>
<td>Super Profiles template, overview and revision history</td>
</tr>
<tr>
<td>06-sync.png</td>
<td>Synchronization with a configured storage folder</td>
</tr>
<tr>
<td>07-settings.png</td>
<td>Settings, Language and voice</td>
</tr>
<tr>
<td>08-command-palette.png</td>
<td>Command palette with the regex builder</td>
</tr>
<tr>
<td>09-super-confirmation.png</td>
<td>Two-key super confirmation before deleting a profile</td>
</tr>
<tr>
<td>10-unlock-ladder.png</td>
<td>Unlock ladder after five wrong PIN entries on a locked profile</td>
</tr>
<tr>
<td>11-compact.png</td>
<td>Compact window: one pane and a bottom navigation bar</td>
</tr>
</tbody>
</table>
<h2 id="limits-of-this-evidence">Limits of this evidence</h2>
<ul>
<li>Linux only. Native preference storage uses a Windows-only lock, so on Linux
the Settings screen reports that preference storage needs attention and
notifications are not persisted. Windows behaviour is not shown here.</li>
<li>No browser engine was bundled in the capture environment, so no browser
window was launched; the launch page is shown before launch.</li>
<li>WSL 2 and Windows Sandbox are unavailable on Linux, so no Super Profile
session was opened.</li>
<li>Visual parity was compared against the dark variants of the design
artboards; layout at 200% scale and Windows font rendering are not covered.</li>
</ul>
<h2 id="hashes-sha-256">Hashes (SHA-256)</h2>
<table>
<thead>
<tr>
<th>File</th>
<th>SHA-256</th>
</tr>
</thead>
<tbody>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/01-create-vault.png">01-create-vault.png</a></td>
<td><code>a6cc76dac6066179002bb9c71bf7e0ea16a333741dc61f088a138d1e0550319e</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/02-first-run.png">02-first-run.png</a></td>
<td><code>f03a0c9060e554a62b24d897cba4ea432ef89ada9b667f71e1c4ee136791092d</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/03-profiles.png">03-profiles.png</a></td>
<td><code>551ededab9633a83793374e052b37eac859bc50402bc293cc178ff6158b5fd45</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/04-launch.png">04-launch.png</a></td>
<td><code>bd1b7116a1c2bd776a570f8bc41e070d4c0509f91fd861d032ec91d0304f3f33</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/05-super-profiles.png">05-super-profiles.png</a></td>
<td><code>81c65d69a28a78eb2cc493a10cf53718ca6743941edd3bd08b2d0e4bb4c84b29</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/06-sync.png">06-sync.png</a></td>
<td><code>f4f07a56600513f21df5ffb991d6f269f05449d7159f2300bacf429b8810b925</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/07-settings.png">07-settings.png</a></td>
<td><code>7e3c93b0ea002af21fa2bffd00a985fe65e4a75bb827e98ed893ed7ef91df327</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/08-command-palette.png">08-command-palette.png</a></td>
<td><code>a965341537d9f6d7bd6692e2c59c4f5f627bdb136bcafd6b761d6fd61e57062a</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/09-super-confirmation.png">09-super-confirmation.png</a></td>
<td><code>7678125fb307a3d9d5e96d8c0929d3dde9095676bed75ed327089ad34619f85b</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/10-unlock-ladder.png">10-unlock-ladder.png</a></td>
<td><code>da1c7b7d93bc811ff3b9cf46ea43f7ccbee7eb07c55764eae9a3872084b8707f</code></td>
</tr>
<tr>
<td><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/m3-redesign/11-compact.png">11-compact.png</a></td>
<td><code>5bbf6f4bbda0fe013fbb9a05e4c88e2ac41b637a652b43b9529e06d8a02cab9c</code></td>
</tr>
</tbody>
</table>
`,text:`# Redesigned desktop: runtime captures\r
\r
These images come from the running desktop application, not from the design\r
artboards. Each was taken from the real Electron shell talking to the real\r
native host (\`target/release/material-browser\`, built from this source) with a\r
disposable data folder created for the capture. Profiles, the template, the\r
lock and the sync folder shown were created through the interface during the\r
run; nothing is mocked.\r
\r
- Source: commit \`264d81d\` on \`main\` (renderer built with \`vite build\`).\r
- Platform: Linux x64 under Xvfb, Electron 44.9.0, 1440 x 960 logical pixels\r
  (the compact capture is 420 x 860), default dark theme.\r
- Data: a fresh temporary folder per run, removed afterwards.\r
\r
## What the captures show\r
\r
| File | Surface |\r
| --- | --- |\r
| 01-create-vault.png | First start: create the vault beside the four-step first run |\r
| 02-first-run.png | Vault created; step 2 of the first run |\r
| 03-profiles.png | Profiles list-detail with a selection and the floating toolbar |\r
| 04-launch.png | Launch page with the engine list, automation group and review card |\r
| 05-super-profiles.png | Super Profiles template, overview and revision history |\r
| 06-sync.png | Synchronization with a configured storage folder |\r
| 07-settings.png | Settings, Language and voice |\r
| 08-command-palette.png | Command palette with the regex builder |\r
| 09-super-confirmation.png | Two-key super confirmation before deleting a profile |\r
| 10-unlock-ladder.png | Unlock ladder after five wrong PIN entries on a locked profile |\r
| 11-compact.png | Compact window: one pane and a bottom navigation bar |\r
\r
## Limits of this evidence\r
\r
- Linux only. Native preference storage uses a Windows-only lock, so on Linux\r
  the Settings screen reports that preference storage needs attention and\r
  notifications are not persisted. Windows behaviour is not shown here.\r
- No browser engine was bundled in the capture environment, so no browser\r
  window was launched; the launch page is shown before launch.\r
- WSL 2 and Windows Sandbox are unavailable on Linux, so no Super Profile\r
  session was opened.\r
- Visual parity was compared against the dark variants of the design\r
  artboards; layout at 200% scale and Windows font rendering are not covered.\r
\r
## Hashes (SHA-256)\r
\r
| File | SHA-256 |\r
| --- | --- |\r
| [01-create-vault.png](01-create-vault.png) | \`a6cc76dac6066179002bb9c71bf7e0ea16a333741dc61f088a138d1e0550319e\` |\r
| [02-first-run.png](02-first-run.png) | \`f03a0c9060e554a62b24d897cba4ea432ef89ada9b667f71e1c4ee136791092d\` |\r
| [03-profiles.png](03-profiles.png) | \`551ededab9633a83793374e052b37eac859bc50402bc293cc178ff6158b5fd45\` |\r
| [04-launch.png](04-launch.png) | \`bd1b7116a1c2bd776a570f8bc41e070d4c0509f91fd861d032ec91d0304f3f33\` |\r
| [05-super-profiles.png](05-super-profiles.png) | \`81c65d69a28a78eb2cc493a10cf53718ca6743941edd3bd08b2d0e4bb4c84b29\` |\r
| [06-sync.png](06-sync.png) | \`f4f07a56600513f21df5ffb991d6f269f05449d7159f2300bacf429b8810b925\` |\r
| [07-settings.png](07-settings.png) | \`7e3c93b0ea002af21fa2bffd00a985fe65e4a75bb827e98ed893ed7ef91df327\` |\r
| [08-command-palette.png](08-command-palette.png) | \`a965341537d9f6d7bd6692e2c59c4f5f627bdb136bcafd6b761d6fd61e57062a\` |\r
| [09-super-confirmation.png](09-super-confirmation.png) | \`7678125fb307a3d9d5e96d8c0929d3dde9095676bed75ed327089ad34619f85b\` |\r
| [10-unlock-ladder.png](10-unlock-ladder.png) | \`da1c7b7d93bc811ff3b9cf46ea43f7ccbee7eb07c55764eae9a3872084b8707f\` |\r
| [11-compact.png](11-compact.png) | \`5bbf6f4bbda0fe013fbb9a05e4c88e2ac41b637a652b43b9529e06d8a02cab9c\` |\r
`},{id:"docs/evidence/desktop/m3-redesign/readme-image-archive.md",title:"Historical README image presentation",category:"evidence",html:`<h1 id="historical-readme-image-presentation">Historical README image presentation</h1>
<p>These images retain their original source and provenance. They are historical observations, not current acceptance. No image bytes were altered.</p>
<h2 id="archived-desktop-screenshots-from-readme">Archived desktop screenshots from README</h2>
<p>Captured from the running application (real Electron shell and native host, disposable data) at source <code>264d81d</code> on Linux. <a href="#/article/docs%2Fevidence%2Fdesktop%2Fm3-redesign%2FREADME.md">Capture method, hashes and limits</a>.</p>
<table>
<thead>
<tr>
<th></th>
<th></th>
</tr>
</thead>
<tbody>
<tr>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
</tr>
<tr>
<td>Profiles: list-detail, split launch buttons, floating toolbar</td>
<td>Launch: engine, automation and the review card</td>
</tr>
<tr>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
</tr>
<tr>
<td>Super Profiles: template, overview and revision history</td>
<td>Synchronization: storage, this computer and conflicts</td>
</tr>
<tr>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
</tr>
<tr>
<td>Settings: navigation drawer and segmented lists</td>
<td>Command palette with the regex builder</td>
</tr>
<tr>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
</tr>
<tr>
<td>Two-key confirmation before a delete</td>
<td>Unlock ladder for an element lock</td>
</tr>
<tr>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
<td><span class="note">[Image awaiting local publication review. See source.]</span></td>
</tr>
<tr>
<td>First start: create the vault</td>
<td>Compact window</td>
</tr>
</tbody>
</table>
<p>Earlier native Windows captures from released version 0.1.58 remain described in <a href="#/article/docs%2Fevidence%2Fdesktop%2Fnative-preservation.md">the preservation record</a>; <a href="#/article/docs%2Fevidence%2Fdesktop%2Fworldlens%2FREADME.md">historical WorldLens captures</a> and the <a href="#/article/docs%2Fevidence%2Farchive.md">earlier image archive</a> are kept for their original sources.</p>
`,text:`# Historical README image presentation

These images retain their original source and provenance. They are historical observations, not current acceptance. No image bytes were altered.

## Archived desktop screenshots from README

Captured from the running application (real Electron shell and native host, disposable data) at source \`264d81d\` on Linux. [Capture method, hashes and limits](README.md).

| | |
| --- | --- |
| ![Profiles list and inspector](03-profiles.png) | ![Launch page with review](04-launch.png) |
| Profiles: list-detail, split launch buttons, floating toolbar | Launch: engine, automation and the review card |
| ![Super Profiles](05-super-profiles.png) | ![Synchronization](06-sync.png) |
| Super Profiles: template, overview and revision history | Synchronization: storage, this computer and conflicts |
| ![Settings](07-settings.png) | ![Command palette](08-command-palette.png) |
| Settings: navigation drawer and segmented lists | Command palette with the regex builder |
| ![Super confirmation](09-super-confirmation.png) | ![Unlock ladder](10-unlock-ladder.png) |
| Two-key confirmation before a delete | Unlock ladder for an element lock |
| ![Create the vault](01-create-vault.png) | ![Compact window](11-compact.png) |
| First start: create the vault | Compact window |

Earlier native Windows captures from released version 0.1.58 remain described in [the preservation record](../native-preservation.md); [historical WorldLens captures](../worldlens/README.md) and the [earlier image archive](../../archive.md) are kept for their original sources.

`},{id:"docs/evidence/desktop/native-preservation.md",title:"Native runtime observations, 2026-10-30",category:"evidence",html:`<h1 id="native-runtime-observations-2026-10-30">Native runtime observations, 2026-10-30</h1>
<p>The actual released Material Browser 0.1.58 ran on the current Windows host through the direct native CLI on a uniquely named hidden desktop and isolated application data directory. The released package is bound to source <code>555fa30f77056e0f81f2ff651ce6b7b624dbdd18</code>, tag <code>build-58-41089696066-1</code>. Its SHA-256 is <code>33197ac96623933574bfb67c9e02ad79a4de7f940cd9694340bb711f3b97dd27</code>; the executable is <code>7173166de72ba78319551232453f461fb20085bd3d2efb200d4f2d8d7a110437</code>.</p>
<p>Five original PNGs show setup with an empty passphrase field, language Settings, Appearance, empty Profiles and locked Super Profiles. Each is 1941 by 1213 physical image pixels at observed native DPI 144. Background native clicks established navigation. The first capture interval was <code>2026-10-30T18:43:50.3550845Z</code> through <code>2026-10-30T18:43:52.2148115Z</code>; dates come from producing operation receipts, not filenames or file timestamps. No credentials, personal wording or personal records were entered.</p>
<p>Normal exit through the product's close button was verified at <code>2026-10-30T18:47:38.3244695Z</code>: all seven recorded process identities and the exact named desktop were absent. An earlier background Alt+F4 attempt did not close the application and remains recorded as an intermediate result. The rejected HTTP service startup was not retried.</p>
<h2 id="acceptance-and-publication-remain-incomplete">Acceptance and publication remain incomplete</h2>
<p>These captures establish the observed native states and navigation. Their private producer receipts do not contain the complete browser-error observations or validated measured-layout sidecar required for formal promotion. No error count or native drawing coverage was invented. The originals and receipts are preserved privately; no new gallery images or README screenshot acceptance is claimed.</p>
<p>Complete a supported fresh capture workflow with exact source and artifact binding, real diagnostics, measured layout, keyboard and persistence checks, languages, themes and supported sizes/scales. Select a receipt arm appropriate for Chromium-rendered content rather than claiming native GDI text measurements. Then inspect and promote the unchanged originals, embed accepted current images in README and publish them through the existing documentation/gallery routes.</p>
`,text:"# Native runtime observations, 2026-10-30\r\n\r\nThe actual released Material Browser 0.1.58 ran on the current Windows host through the direct native CLI on a uniquely named hidden desktop and isolated application data directory. The released package is bound to source `555fa30f77056e0f81f2ff651ce6b7b624dbdd18`, tag `build-58-41089696066-1`. Its SHA-256 is `33197ac96623933574bfb67c9e02ad79a4de7f940cd9694340bb711f3b97dd27`; the executable is `7173166de72ba78319551232453f461fb20085bd3d2efb200d4f2d8d7a110437`.\r\n\r\nFive original PNGs show setup with an empty passphrase field, language Settings, Appearance, empty Profiles and locked Super Profiles. Each is 1941 by 1213 physical image pixels at observed native DPI 144. Background native clicks established navigation. The first capture interval was `2026-10-30T18:43:50.3550845Z` through `2026-10-30T18:43:52.2148115Z`; dates come from producing operation receipts, not filenames or file timestamps. No credentials, personal wording or personal records were entered.\r\n\r\nNormal exit through the product's close button was verified at `2026-10-30T18:47:38.3244695Z`: all seven recorded process identities and the exact named desktop were absent. An earlier background Alt+F4 attempt did not close the application and remains recorded as an intermediate result. The rejected HTTP service startup was not retried.\r\n\r\n## Acceptance and publication remain incomplete\r\n\r\nThese captures establish the observed native states and navigation. Their private producer receipts do not contain the complete browser-error observations or validated measured-layout sidecar required for formal promotion. No error count or native drawing coverage was invented. The originals and receipts are preserved privately; no new gallery images or README screenshot acceptance is claimed.\r\n\r\nComplete a supported fresh capture workflow with exact source and artifact binding, real diagnostics, measured layout, keyboard and persistence checks, languages, themes and supported sizes/scales. Select a receipt arm appropriate for Chromium-rendered content rather than claiming native GDI text measurements. Then inspect and promote the unchanged originals, embed accepted current images in README and publish them through the existing documentation/gallery routes.\r\n"},{id:"docs/evidence/desktop/repair-20261101/README.md",title:"Desktop repair evidence, 1 November 2026",category:"evidence",html:`<h1 id="desktop-repair-evidence-1-november-2026">Desktop repair evidence, 1 November 2026</h1>
<p>These four unedited page captures come from the Windows desktop build at source <code>47e8ae104755d38e9d115fbb08636143bc6278cb</code>, produced by <code>build.bat -Component Desktop</code>. The renderer SHA-256 is <code>0bba7e09f291f4ca7952023ba8a7dd1b34212b7cc11fdd153fd4a007b7c46dbf</code>. The build completed at <code>2026-11-01T09:06:46.8017290+00:00</code>.</p>
<p>Each capture used a fresh named off-screen desktop and isolated application data. A live native window owner and exact CDP target were checked, the page viewport was explicitly set to 1280 \xD7 1200, and the observed device-pixel ratio was <code>1.0000000298023224</code> (requested scale 1). This is page-only, emulated-viewport evidence, not a physical display-scale claim. Both owned process trees were closed normally and verified absent.</p>
<p>The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/repair-20261101/inventory.json">exact inventory</a> records capture times, hashes, source binding and limitations. Private machine paths, process identities and raw interaction receipts are intentionally retained outside tracked documentation.</p>
<h2 id="issue-11">Issue 11</h2>
<p>Saved red primary-button appearance restored before unlock. Cold-start visual and computed-colour proof only. The vault remains locked.</p>
<p><img src="assets/c621130b35f14b69ba78634b10485db711c26b04dedb6e56eb32ee744838ac29.png" alt="Saved appearance restored before vault unlock" loading="lazy" /></p>
<h2 id="issue-12">Issue 12</h2>
<p>Injected preference-storage write failure with session-only warnings and retry controls. Deliberately injected write/removal faults affect only two isolated preference keys. This is not a naturally occurring storage outage.</p>
<p><img src="assets/13cd574c8ee76196ff05980f6cbebdfa763f98c70cb52ef7592505962219d076.png" alt="Injected storage failure with session-only warnings and retry controls" loading="lazy" /></p>
<h2 id="issue-13">Issue 13</h2>
<p>Actual focus-mode pane opacity 0.38 with contrast explicitly unavailable. One real opacity-dependent sample. No blanket gradient, alpha-compositing or accessibility certification.</p>
<p><img src="assets/b4df22867b820609572e112f286287b6c40be20e21667912da69009fa97621ac.png" alt="Dimmed pane with contrast explicitly unavailable" loading="lazy" /></p>
<h2 id="issue-14">Issue 14</h2>
<p>Renderer pointer drag reached hue endpoint 359 within the advertised 0\u2013359 range. CDP renderer pointer input and ARIA readback. No physical keyboard or native pointer-input claim.</p>
<p><img src="assets/6c9e85c556b373356e7945c3c9ffb224fc30a83a1c478e6e6240b8fc8d271782.png" alt="Hue pointer endpoint with the handle at the right edge" loading="lazy" /></p>
<h2 id="verification-boundaries">Verification boundaries</h2>
<p>All four supported promotion receipts passed against the captured source before commit. The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/repair-20261101/validation.json">sanitized validation summary</a> records the image hashes and scope. A deliberate negative inventory check renamed an exact record ID and was rejected; the original record then passed unchanged. The promoted images were reopened and inspected after byte-identical staging. Both this article and the inventory passed the public-content vocabulary scan.</p>
<p>The storage warning image deliberately shows an injected failure, while the interface and image are real. The storage methods were restored and the retry controls were exercised successfully. The contrast image shows one unsupported compositing state; it is not proof of every contrast calculation. The hue endpoint has separate pointer-event and ARIA evidence, and the image shows the handle at the right edge.</p>
<p>These images do not establish minimum-window layout, full keyboard accessibility, installer behavior, release delivery, or server/model operations. Existing narrow-layout findings remain separate. No image was cropped, annotated, resized or recompressed.</p>
`,text:`# Desktop repair evidence, 1 November 2026

These four unedited page captures come from the Windows desktop build at source \`47e8ae104755d38e9d115fbb08636143bc6278cb\`, produced by \`build.bat -Component Desktop\`. The renderer SHA-256 is \`0bba7e09f291f4ca7952023ba8a7dd1b34212b7cc11fdd153fd4a007b7c46dbf\`. The build completed at \`2026-11-01T09:06:46.8017290+00:00\`.

Each capture used a fresh named off-screen desktop and isolated application data. A live native window owner and exact CDP target were checked, the page viewport was explicitly set to 1280 \xD7 1200, and the observed device-pixel ratio was \`1.0000000298023224\` (requested scale 1). This is page-only, emulated-viewport evidence, not a physical display-scale claim. Both owned process trees were closed normally and verified absent.

The [exact inventory](inventory.json) records capture times, hashes, source binding and limitations. Private machine paths, process identities and raw interaction receipts are intentionally retained outside tracked documentation.

## Issue 11

Saved red primary-button appearance restored before unlock. Cold-start visual and computed-colour proof only. The vault remains locked.

![Saved appearance restored before vault unlock](issue-11.png)

## Issue 12

Injected preference-storage write failure with session-only warnings and retry controls. Deliberately injected write/removal faults affect only two isolated preference keys. This is not a naturally occurring storage outage.

![Injected storage failure with session-only warnings and retry controls](issue-12.png)

## Issue 13

Actual focus-mode pane opacity 0.38 with contrast explicitly unavailable. One real opacity-dependent sample. No blanket gradient, alpha-compositing or accessibility certification.

![Dimmed pane with contrast explicitly unavailable](issue-13.png)

## Issue 14

Renderer pointer drag reached hue endpoint 359 within the advertised 0\u2013359 range. CDP renderer pointer input and ARIA readback. No physical keyboard or native pointer-input claim.

![Hue pointer endpoint with the handle at the right edge](issue-14.png)

## Verification boundaries

All four supported promotion receipts passed against the captured source before commit. The [sanitized validation summary](validation.json) records the image hashes and scope. A deliberate negative inventory check renamed an exact record ID and was rejected; the original record then passed unchanged. The promoted images were reopened and inspected after byte-identical staging. Both this article and the inventory passed the public-content vocabulary scan.

The storage warning image deliberately shows an injected failure, while the interface and image are real. The storage methods were restored and the retry controls were exercised successfully. The contrast image shows one unsupported compositing state; it is not proof of every contrast calculation. The hue endpoint has separate pointer-event and ARIA evidence, and the image shows the handle at the right edge.

These images do not establish minimum-window layout, full keyboard accessibility, installer behavior, release delivery, or server/model operations. Existing narrow-layout findings remain separate. No image was cropped, annotated, resized or recompressed.
`},{id:"docs/evidence/desktop/worldlens/README.md",title:"WorldLens desktop evidence",category:"evidence",html:`<h1 id="worldlens-desktop-evidence">WorldLens desktop evidence</h1>
<p>These original PNGs show the production desktop renderer at source <code>284fc88f94487a7716099469daadeec258d97b07</code>, with the real Electron main/preload and locally built Linux Rust host. A task-owned Xvfb display and isolated synthetic vault kept the visible desktop and existing user data untouched. The images were decoded, visually inspected and copied without changing their bytes.</p>
<p>The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/inventory.json">exact inventory</a> binds each image to its source, built artifact, raw receipt, dimensions, language, theme and actual Electron zoom factor. The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/coverage.json">coverage record</a> lists measured states and the remaining gaps. Full raw receipts remain private because they contain local process and profile paths.</p>
<h2 id="workspaces-and-review-dialogs">Workspaces and review dialogs</h2>
<p><img src="assets/f0cd418acd9bf02ecb07703ef8caa39d90983d72823b1d8f243394c4438c1110.png" alt="Selected synthetic profile with the table and inspector side by side" loading="lazy" /></p>
<p><img src="assets/3e3259c39797fdcbca1ede72801d06fab8af0a4ce2d65c9c4537ad7c71a86a77.png" alt="Saved synthetic Super Profile template with its selected overview" loading="lazy" /></p>
<p><img src="assets/1c31485d7f29058d2eca76232053b8fc7ad601f286c918a5d5a4af830773b4df.png" alt="Synchronization with no folder configured and no conflicts" loading="lazy" /></p>
<p><img src="assets/1322b836b52f53001248a5f3061e50d0c69a182eb68b52091570489c3ebf5658.png" alt="Initial setup before an encrypted vault is created" loading="lazy" /></p>
<p><img src="assets/cb43f4da41792f11fe7991ffdf6b5a7904a822bcae820d2f1cd97a5a16ff2109.png" alt="Standard browser identity consent before launch" loading="lazy" /></p>
<p>The native host created the synthetic profiles and saved template metadata. The launch review was opened and cancelled. These observations do not establish browser launch, guest provisioning, synchronization transfer or destructive confirmation behavior.</p>
<h2 id="sound-and-appearance">Sound and appearance</h2>
<p><img src="assets/e71ba5bf9995272bbc704414a2d8d1685700604a0932c0cbf751892b099c0f05.png" alt="Notification settings showing the action sound switch and volume" loading="lazy" /></p>
<p><img src="assets/7c763dbe0a7313d3fb7542312bc2592fd2ee461ae628cae36455b833a5a5d734.png" alt="Action sound preview with its quiet and accessibility explanation" loading="lazy" /></p>
<p><img src="assets/62e4a3889805f4bb00456739697a790b7ac0f2ba4c1f9ca5df12071513300e4d.png" alt="Light appearance controls with bundled Roboto available" loading="lazy" /></p>
<p><img src="assets/948c022baa9ca4af165686a49ef11a02627535c3796995df56e42a2952ae376a.png" alt="High-contrast appearance controls with clear outlines" loading="lazy" /></p>
<p><img src="assets/00437d253d62757b296212aed76f090673a0ef7b5dc4c463cd9f7993dc78e619.png" alt="Bilingual dark appearance at 760 by 580 and 200 percent interface zoom" loading="lazy" /></p>
<p>Language and theme variations use the application's legacy presentation reader with explicitly seeded startup preferences in the isolated profile. This is distinct from successful native saving. The existing Windows mutex implementation rejects native preference persistence on Linux, and the interface correctly shows its storage warning. No locking or persistence boundary was bypassed.</p>
<h2 id="scope-of-verification">Scope of verification</h2>
<p>The final runs produced 143 captures: 137 main captures and six focused supplemental captures. All 72 representative Appearance tuples completed; 61 of 241 inventory states have observations, with 180 exact gaps retained in the coverage record. Ten publication candidates received independent visual and privacy review. <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/desktop/worldlens/runtime-summary.json">Runtime summary</a>.</p>
<p>The representative Appearance matrix uses 1280 \xD7 800 and 760 \xD7 580 windows, English, Cantonese and bilingual text, light, dark and high contrast, and actual Electron zoom factors of 100%, 125%, 150% and 200%. Normal captures also cover the shell, all ten Settings categories, profiles, Super Profiles, synchronization, setup and review dialogs. Captured states and inspected images are recorded separately; the matrix does not cover every state in the design inventory.</p>
<p>Local source checks passed 126 desktop tests, with one Windows mutex test skipped on Linux, plus TypeScript and the production renderer build. The renderer used the bundled Roboto assets; installed-font discovery remains a separate Windows capability.</p>
<p>The floating Accessibility entry can overlap content at some scroll positions; the affected Reset control was reached by scrolling and then clicked. This is a retained presentation limitation.</p>
<p>This evidence does not establish Windows installation or update, native preference restart persistence, physical display scaling, native Windows keyboard delivery, screen-reader speech, audible speaker output, or guest lifecycle acceptance. Windows build and release results are recorded separately. <a href="#/article/docs%2Fevidence%2Farchive.md">Earlier images and original provenance</a> remain historical.</p>
<h2 id="\u5EE3\u6771\u8A71">\u5EE3\u6771\u8A71</h2>
<p>\u4EE5\u4E0A\u4FC2\u5BE6\u969B\u7DE8\u8B6F\u684C\u9762\u4ECB\u9762\u5605\u539F\u59CB\u756B\u9762\uFF0C\u914D\u5408\u771F\u6B63 Linux \u539F\u751F\u4E3B\u7A0B\u5F0F\u540C\u9694\u96E2\u5605\u6E2C\u8A66\u8CC7\u6599\uFF0C\u5187\u4FEE\u6539\u5716\u7247\u3002\u6E05\u55AE\u8A18\u9304\u4F86\u6E90\u3001\u7A0B\u5F0F\u96DC\u6E4A\u3001\u8A9E\u8A00\u3001\u4E3B\u984C\u3001\u8996\u7A97\u5927\u5C0F\u540C\u5BE6\u969B\u4ECB\u9762\u7E2E\u653E\u3002</p>
<p>\u5DF2\u6AA2\u67E5\u8A2D\u5B9A\u6A94\u3001Super Profile\u3001\u540C\u6B65\u3001\u8A2D\u5B9A\u3001\u521D\u6B21\u8A2D\u5B9A\u540C\u78BA\u8A8D\u5C0D\u8A71\u6846\u5605\u5916\u89C0\u3002\u8A9E\u8A00\u540C\u4E3B\u984C\u6E2C\u8A66\u7528\u9694\u96E2\u555F\u52D5\u8A2D\u5B9A\uFF0C\u5514\u4EE3\u8868\u539F\u751F\u8A2D\u5B9A\u5DF2\u6210\u529F\u5132\u5B58\u3002Linux \u672A\u80FD\u4F7F\u7528\u73FE\u6709 Windows \u9396\u5B9A\u6A5F\u5236\uFF0C\u6240\u4EE5\u756B\u9762\u4FDD\u7559\u6B63\u78BA\u5605\u5132\u5B58\u63D0\u793A\uFF1BWindows \u5B89\u88DD\u3001\u5132\u5B58\u5F8C\u91CD\u65B0\u555F\u52D5\u3001\u5BE6\u9AD4\u8072\u97F3\u540C\u5BA2\u9AD4\u751F\u547D\u9031\u671F\u4ECD\u9700\u7368\u7ACB\u9A57\u8B49\u3002</p>
`,text:`# WorldLens desktop evidence\r
\r
These original PNGs show the production desktop renderer at source \`284fc88f94487a7716099469daadeec258d97b07\`, with the real Electron main/preload and locally built Linux Rust host. A task-owned Xvfb display and isolated synthetic vault kept the visible desktop and existing user data untouched. The images were decoded, visually inspected and copied without changing their bytes.\r
\r
The [exact inventory](inventory.json) binds each image to its source, built artifact, raw receipt, dimensions, language, theme and actual Electron zoom factor. The [coverage record](coverage.json) lists measured states and the remaining gaps. Full raw receipts remain private because they contain local process and profile paths.\r
\r
## Workspaces and review dialogs\r
\r
![Selected synthetic profile with the table and inspector side by side](profile-overview.png)\r
\r
![Saved synthetic Super Profile template with its selected overview](super-metadata-result.png)\r
\r
![Synchronization with no folder configured and no conflicts](synchronization.png)\r
\r
![Initial setup before an encrypted vault is created](setup-fresh.png)\r
\r
![Standard browser identity consent before launch](launch-review.png)\r
\r
The native host created the synthetic profiles and saved template metadata. The launch review was opened and cancelled. These observations do not establish browser launch, guest provisioning, synchronization transfer or destructive confirmation behavior.\r
\r
## Sound and appearance\r
\r
![Notification settings showing the action sound switch and volume](settings-notifications.png)\r
\r
![Action sound preview with its quiet and accessibility explanation](settings-notifications-lower.png)\r
\r
![Light appearance controls with bundled Roboto available](appearance-light.png)\r
\r
![High-contrast appearance controls with clear outlines](appearance-contrast.png)\r
\r
![Bilingual dark appearance at 760 by 580 and 200 percent interface zoom](minimum-bilingual-dark.png)\r
\r
Language and theme variations use the application's legacy presentation reader with explicitly seeded startup preferences in the isolated profile. This is distinct from successful native saving. The existing Windows mutex implementation rejects native preference persistence on Linux, and the interface correctly shows its storage warning. No locking or persistence boundary was bypassed.\r
\r
## Scope of verification\r
\r
The final runs produced 143 captures: 137 main captures and six focused supplemental captures. All 72 representative Appearance tuples completed; 61 of 241 inventory states have observations, with 180 exact gaps retained in the coverage record. Ten publication candidates received independent visual and privacy review. [Runtime summary](runtime-summary.json).\r
\r
The representative Appearance matrix uses 1280 \xD7 800 and 760 \xD7 580 windows, English, Cantonese and bilingual text, light, dark and high contrast, and actual Electron zoom factors of 100%, 125%, 150% and 200%. Normal captures also cover the shell, all ten Settings categories, profiles, Super Profiles, synchronization, setup and review dialogs. Captured states and inspected images are recorded separately; the matrix does not cover every state in the design inventory.\r
\r
Local source checks passed 126 desktop tests, with one Windows mutex test skipped on Linux, plus TypeScript and the production renderer build. The renderer used the bundled Roboto assets; installed-font discovery remains a separate Windows capability.\r
\r
The floating Accessibility entry can overlap content at some scroll positions; the affected Reset control was reached by scrolling and then clicked. This is a retained presentation limitation.\r
\r
This evidence does not establish Windows installation or update, native preference restart persistence, physical display scaling, native Windows keyboard delivery, screen-reader speech, audible speaker output, or guest lifecycle acceptance. Windows build and release results are recorded separately. [Earlier images and original provenance](../../archive.md) remain historical.\r
\r
## \u5EE3\u6771\u8A71\r
\r
\u4EE5\u4E0A\u4FC2\u5BE6\u969B\u7DE8\u8B6F\u684C\u9762\u4ECB\u9762\u5605\u539F\u59CB\u756B\u9762\uFF0C\u914D\u5408\u771F\u6B63 Linux \u539F\u751F\u4E3B\u7A0B\u5F0F\u540C\u9694\u96E2\u5605\u6E2C\u8A66\u8CC7\u6599\uFF0C\u5187\u4FEE\u6539\u5716\u7247\u3002\u6E05\u55AE\u8A18\u9304\u4F86\u6E90\u3001\u7A0B\u5F0F\u96DC\u6E4A\u3001\u8A9E\u8A00\u3001\u4E3B\u984C\u3001\u8996\u7A97\u5927\u5C0F\u540C\u5BE6\u969B\u4ECB\u9762\u7E2E\u653E\u3002\r
\r
\u5DF2\u6AA2\u67E5\u8A2D\u5B9A\u6A94\u3001Super Profile\u3001\u540C\u6B65\u3001\u8A2D\u5B9A\u3001\u521D\u6B21\u8A2D\u5B9A\u540C\u78BA\u8A8D\u5C0D\u8A71\u6846\u5605\u5916\u89C0\u3002\u8A9E\u8A00\u540C\u4E3B\u984C\u6E2C\u8A66\u7528\u9694\u96E2\u555F\u52D5\u8A2D\u5B9A\uFF0C\u5514\u4EE3\u8868\u539F\u751F\u8A2D\u5B9A\u5DF2\u6210\u529F\u5132\u5B58\u3002Linux \u672A\u80FD\u4F7F\u7528\u73FE\u6709 Windows \u9396\u5B9A\u6A5F\u5236\uFF0C\u6240\u4EE5\u756B\u9762\u4FDD\u7559\u6B63\u78BA\u5605\u5132\u5B58\u63D0\u793A\uFF1BWindows \u5B89\u88DD\u3001\u5132\u5B58\u5F8C\u91CD\u65B0\u555F\u52D5\u3001\u5BE6\u9AD4\u8072\u97F3\u540C\u5BA2\u9AD4\u751F\u547D\u9031\u671F\u4ECD\u9700\u7368\u7ACB\u9A57\u8B49\u3002\r
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
`},{id:"docs/features/acceptance/2026-11-01-defect-verification.md",title:"November 2026 defect verification",category:"features",html:`<h1 id="november-2026-defect-verification">November 2026 defect verification</h1>
<p>The design contributor owns incoming design and feature implementation. This pass owns
integration, independent defect/layout checks, focused repairs and actionable issue handoffs.
It does not certify every required feature.</p>
<h2 id="current-executed-source">Current executed source</h2>
<p>Runtime source <code>62563ae1626f966bd063ce0e38c53353de84ba22</code> passed the exact root
<code>build.bat -Component Desktop</code> entrypoint and all <strong>361 desktop tests</strong>, with no failures
or skips. Build-receipt SHA-256:
<code>a4e4fe0b2b76a0384d5982943df36a52493ecaaf0f774698c93c4df24d8a8907</code>.
Renderer SHA-256:
<code>e396adfbbc514edd48dc16a3c2dee8a83b7bf513bed991cf2eeec7ec23fbc820</code>.
Source and build inputs remained unchanged throughout verification.</p>
<p>Three <a href="#/article/docs%2Fevidence%2Fdesktop%2Fcurrent-20261101%2FREADME.md">current original screenshots</a>
retain that source binding. Every promotion receipt passed, including rejection of a missing
inventory identity and successful exact-byte restoration. The earlier six-image README
presentation is archived beside them without changing historical image bytes or metadata.</p>
<h2 id="verified-repairs-and-limits">Verified repairs and limits</h2>
<table>
<thead>
<tr>
<th>Area</th>
<th>Executed evidence</th>
<th>Boundary</th>
</tr>
</thead>
<tbody>
<tr>
<td>Preset discovery</td>
<td>Actual 1.21.4 inventory retains six presets: five selectable, debug explicitly unavailable; renderer ArrowRight visits all five with visible focus</td>
<td>No EULA or generation</td>
</tr>
<tr>
<td>Version schema</td>
<td>Actual 26.3 retains seven unavailable presets and 1.19.3 retains six; both keep the renderer alive with zero interactive presets or EULA controls</td>
<td>Modern customization is unavailable, not implemented</td>
</tr>
<tr>
<td>Generator layout</td>
<td>All 12 tuples passed: 1280x802/760x580, English/Cantonese/bilingual, light/dark; every layout receipt validated</td>
<td>Page emulation at scale 1, not physical display scaling</td>
</tr>
<tr>
<td>Bundled fonts</td>
<td>267 declarations, 303 references, 188 local font assets and six required identities passed source-byte checks; 13 CLI regressions passed</td>
<td>Static CSS checks do not prove all glyphs or arbitrary runtime styles</td>
</tr>
<tr>
<td>Font startup</td>
<td>Cached diagnostics and fully observed English/bilingual renderer reloads had zero font-policy blocks, uncaught exceptions or resource failures</td>
<td>Every native process-start event was not observed</td>
</tr>
<tr>
<td>Converter preservation</td>
<td>24 focused checks cover duplicate/literal headers, special keys, exact-byte verification, replacement preservation and post-placement cleanup</td>
<td>Path checks and removal are not atomic against arbitrary external writers</td>
</tr>
<tr>
<td>Converter directory recovery</td>
<td>Actual native dialogs rejected a replaced destination, reselected safely and produced exact two-row CSV conversion; localized recovery passed</td>
<td>Integrity-failure GUI outcome remains unobserved despite service/component evidence</td>
</tr>
</tbody>
</table>
<p>Nineteen images were inspected in the current run. Normal Close was followed by observed
absence of the owned process tree at <code>2026-11-01T14:35:22.2004282Z</code> and absence of the named
hidden desktop. Isolated profiles remain retained. No forced termination, EULA acceptance,
world generation, installer, release or installed update occurred.</p>
<h2 id="earlier-source-bound-evidence">Earlier source-bound evidence</h2>
<ul>
<li>Source <code>5c6662455bd968edfe4a4ebcad30b1e902d03b20</code>: 348 desktop tests and exact build;
rail/Personalize repairs passed 96 emulated tuples and 96 validated receipts. Twenty
representative images were inspected and two unchanged originals were published.</li>
<li>Source <code>47e8ae1</code>: four inspected Personalize cases cover cold appearance, persistence
feedback, rendered contrast and hue bounds. Images retain their original provenance.</li>
<li>Source <code>b086d867b5a5441784c92395c8dacae14e319bca</code>: 334 tests; corrupted official runtime
bytes started zero JVMs/downloads, explicit retry recovered verified bytes, and ZIP placement
passed independent CRC/inventory/content checks including Unicode.</li>
<li>A real pending report-only JVM closed normally. Absence was observed within 20.152 seconds,
an observation upper bound. Actual generation cancellation remains unproven.</li>
<li>Handbook deployment <code>af1020fb6a486b5fb73e97fc818a3c1e1f01816c</code>, source <code>65eb448</code>:
all 43 delivered files matched recorded bytes; six 320-pixel language/theme cases and a
desktop case passed with actual renderer Tab/Enter reset. Issue 15 was closed. A newer
publication must carry its own source and live verdict.</li>
<li>Earlier Rust workspace evidence contains 103 passing tests, bound to its original run.</li>
</ul>
<h2 id="remaining-acceptance">Remaining acceptance</h2>
<p><a href="https://github.com/Ding-Ding-Projects/material-browser/issues/6">Issue 6</a> retains actual
generation cancellation/quit acceptance, <a href="https://github.com/Ding-Ding-Projects/material-browser/issues/9">issue 9</a>
retains custom-dimension generation, and <a href="https://github.com/Ding-Ding-Projects/material-browser/issues/18">issue 18</a>
retains actual generated-area completeness. Their source repairs and simulated negative
checks do not prove a real generated world.
<a href="https://github.com/Ding-Ding-Projects/material-browser/issues/20">Issue 20</a> retains direct
observation of the integrity-failure GUI result. The broader task remains in
<a href="https://github.com/Ding-Ding-Projects/material-browser/issues/1">issue 1</a>.</p>
<p>The inventory still has <strong>112 identities, 784 rows and 420 applicable unfinished rows</strong>.
Four-target lifecycle, Bedrock, complete version/flavour/plugin/player workflows, real
generation, broad keyboard/accessibility/physical-scale acceptance and companion delivery
remain incomplete. Preserve incoming contributor work and inactive alternatives.</p>
`,text:`# November 2026 defect verification

The design contributor owns incoming design and feature implementation. This pass owns
integration, independent defect/layout checks, focused repairs and actionable issue handoffs.
It does not certify every required feature.

## Current executed source

Runtime source \`62563ae1626f966bd063ce0e38c53353de84ba22\` passed the exact root
\`build.bat -Component Desktop\` entrypoint and all **361 desktop tests**, with no failures
or skips. Build-receipt SHA-256:
\`a4e4fe0b2b76a0384d5982943df36a52493ecaaf0f774698c93c4df24d8a8907\`.
Renderer SHA-256:
\`e396adfbbc514edd48dc16a3c2dee8a83b7bf513bed991cf2eeec7ec23fbc820\`.
Source and build inputs remained unchanged throughout verification.

Three [current original screenshots](../../evidence/desktop/current-20261101/README.md)
retain that source binding. Every promotion receipt passed, including rejection of a missing
inventory identity and successful exact-byte restoration. The earlier six-image README
presentation is archived beside them without changing historical image bytes or metadata.

## Verified repairs and limits

| Area | Executed evidence | Boundary |
| --- | --- | --- |
| Preset discovery | Actual 1.21.4 inventory retains six presets: five selectable, debug explicitly unavailable; renderer ArrowRight visits all five with visible focus | No EULA or generation |
| Version schema | Actual 26.3 retains seven unavailable presets and 1.19.3 retains six; both keep the renderer alive with zero interactive presets or EULA controls | Modern customization is unavailable, not implemented |
| Generator layout | All 12 tuples passed: 1280x802/760x580, English/Cantonese/bilingual, light/dark; every layout receipt validated | Page emulation at scale 1, not physical display scaling |
| Bundled fonts | 267 declarations, 303 references, 188 local font assets and six required identities passed source-byte checks; 13 CLI regressions passed | Static CSS checks do not prove all glyphs or arbitrary runtime styles |
| Font startup | Cached diagnostics and fully observed English/bilingual renderer reloads had zero font-policy blocks, uncaught exceptions or resource failures | Every native process-start event was not observed |
| Converter preservation | 24 focused checks cover duplicate/literal headers, special keys, exact-byte verification, replacement preservation and post-placement cleanup | Path checks and removal are not atomic against arbitrary external writers |
| Converter directory recovery | Actual native dialogs rejected a replaced destination, reselected safely and produced exact two-row CSV conversion; localized recovery passed | Integrity-failure GUI outcome remains unobserved despite service/component evidence |

Nineteen images were inspected in the current run. Normal Close was followed by observed
absence of the owned process tree at \`2026-11-01T14:35:22.2004282Z\` and absence of the named
hidden desktop. Isolated profiles remain retained. No forced termination, EULA acceptance,
world generation, installer, release or installed update occurred.

## Earlier source-bound evidence

- Source \`5c6662455bd968edfe4a4ebcad30b1e902d03b20\`: 348 desktop tests and exact build;
  rail/Personalize repairs passed 96 emulated tuples and 96 validated receipts. Twenty
  representative images were inspected and two unchanged originals were published.
- Source \`47e8ae1\`: four inspected Personalize cases cover cold appearance, persistence
  feedback, rendered contrast and hue bounds. Images retain their original provenance.
- Source \`b086d867b5a5441784c92395c8dacae14e319bca\`: 334 tests; corrupted official runtime
  bytes started zero JVMs/downloads, explicit retry recovered verified bytes, and ZIP placement
  passed independent CRC/inventory/content checks including Unicode.
- A real pending report-only JVM closed normally. Absence was observed within 20.152 seconds,
  an observation upper bound. Actual generation cancellation remains unproven.
- Handbook deployment \`af1020fb6a486b5fb73e97fc818a3c1e1f01816c\`, source \`65eb448\`:
  all 43 delivered files matched recorded bytes; six 320-pixel language/theme cases and a
  desktop case passed with actual renderer Tab/Enter reset. Issue 15 was closed. A newer
  publication must carry its own source and live verdict.
- Earlier Rust workspace evidence contains 103 passing tests, bound to its original run.

## Remaining acceptance

[Issue 6](https://github.com/Ding-Ding-Projects/material-browser/issues/6) retains actual
generation cancellation/quit acceptance, [issue 9](https://github.com/Ding-Ding-Projects/material-browser/issues/9)
retains custom-dimension generation, and [issue 18](https://github.com/Ding-Ding-Projects/material-browser/issues/18)
retains actual generated-area completeness. Their source repairs and simulated negative
checks do not prove a real generated world.
[Issue 20](https://github.com/Ding-Ding-Projects/material-browser/issues/20) retains direct
observation of the integrity-failure GUI result. The broader task remains in
[issue 1](https://github.com/Ding-Ding-Projects/material-browser/issues/1).

The inventory still has **112 identities, 784 rows and 420 applicable unfinished rows**.
Four-target lifecycle, Bedrock, complete version/flavour/plugin/player workflows, real
generation, broad keyboard/accessibility/physical-scale acceptance and companion delivery
remain incomplete. Preserve incoming contributor work and inactive alternatives.\r
`},{id:"docs/features/acceptance/README.md",title:"Required-feature acceptance",category:"features",html:`<h1 id="required-feature-acceptance">Required-feature acceptance</h1>
<p>The current catalogue contains <strong>112 identities across seven surface families: 784 rows, with 420 applicable rows unfinished</strong>. The generator's desktop workspace row now records partial source implementation and focused checks; its whole-workflow acceptance remains unfinished. The other applicable surface rows remain missing.</p>
<p>The inventory is a historical discovery baseline, not a claim that later implementation is
absent. The <a href="#/article/docs%2Ffeatures%2Facceptance%2F2026-11-01-defect-verification.md">November defect-verification record</a> records
the later integrated generator, source-bound tests, report-only runtime checks and scoped
GUI evidence without upgrading unfinished whole-feature rows.</p>
<p>This inventory originally recorded a conservative source-review baseline at <code>60e65ef</code>. It is not a certification, implementation report, or release approval. The original inventory contained 111 neutral requirement identities across seven surface families, including the productive workspace, Settings, hosted documentation, offline handbook, storage dashboard, hosting wizard and repository delivery records. Nested dialogs, menus, pickers, tool panels and article routes inherit the owning family's obligations; they still need explicit child-surface inventories before completion.</p>
<p>The independent <code>required-identities.json</code> list prevents deleting a feature row to make the inventory appear complete. Names are product-facing descriptions, not an embedded private dictionary. This baseline deliberately does not copy private instruction prose, mappings or local paths.</p>
<h2 id="reading-evidence-states">Reading evidence states</h2>
<p><code>not-audited</code> means no behavior verdict has been established. <code>partial</code> means relevant source was found, not that all required behavior works. <code>implemented</code> requires a completed source review. <code>verified</code> additionally requires documentation, localization, persistence evidence or a specific non-persistence explanation, focused tests, built interaction and genuine current screenshots. Every unverified applicable row retains an explicit gap. <code>not-applicable</code> requires an individual reason and cannot silently stand in for an unimplemented feature.</p>
<p>The baseline has no <code>verified</code> rows. Existing evidence in <code>docs/evidence/</code> belongs to its original source versions. It has not been revalidated for this candidate and is not attached as current runtime evidence. Test success is a separate dimension from installed, GUI, deployment and release verification.</p>
<h2 id="validation-and-intentional-failure">Validation and intentional failure</h2>
<p>Run <code>node scripts/check-feature-acceptance.mjs</code> to validate identity, surface and row integrity. Run <code>node --test scripts/check-feature-acceptance.test.mjs</code> for the removal and false-claim regressions. Structural success means the ledger is internally consistent, not that the product is complete.</p>
<p>Run <code>node scripts/check-feature-acceptance.mjs --require-complete</code> for a fail-closed delivery decision. It currently returns nonzero because applicable acceptance remains unfinished. Do not remove this flag from a delivery decision to turn a planning inventory into a passing product claim. The checker is a local tool; this change does not add tests or lint to release workflows.</p>
<p>The negative tests independently remove an identity and a surface row, duplicate a row, remove an exclusion reason, fabricate verified state, fabricate completion, break a source reference, and attach stale evidence. Each altered case must fail, and the restored baseline must pass.</p>
<h2 id="implementation-priorities-and-limits">Implementation priorities and limits</h2>
<ol>
<li>Review Settings consumers and scope each control to actual rendered behavior. The existing Settings inventory is narrower than the complete product inventory. Source presence alone does not verify persistence or localization.</li>
<li>Inventory every nested search and context-menu surface, then review independent query state, anchored builder access, bounded execution and the full RegexBuddy topic set. A pattern tester is not parity proof.</li>
<li>Review the initial-screen provenance in <code>apps/desktop/src/app/Shell.tsx</code>. Date-only formatting is not the required date/time-with-seconds-and-timezone evidence; source and current built behavior need reconciliation.</li>
<li>Complete workflow-specific implementation and acceptance for server management, local model management and conversion. Concurrent implementation must be reviewed against its own resulting source commit, not this baseline.</li>
<li>Expand guidance and information-button coverage to individual controls, including worked examples, isolated playgrounds and negative omissions. Review workspace tab catalog behavior and destructive/locked input paths independently.</li>
<li>Verify hosted documentation and each companion independently. Shared source does not prove hosted routes, offline navigation, settings persistence, responsive layouts or installed behavior.</li>
<li>Produce current source/hash-bound layout, interaction and release receipts. Retain historical evidence unchanged and keep unavailable proof unfinished.</li>
</ol>
<p>This is a family-level discovery ledger. It does not yet claim exhaustive per-control decomposition or full behavioral auditing of the original 414 applicable rows. Most source links and all current runtime-evidence fields remain deliberately empty until reviewed. Applicability exclusions cover non-rendered repository records, documentation-only deliverables on productive screens, job-document workflows, repository publishing, extension download interception, private-source build routing, shared-status-service internals, suspended display reporting and instruction-distribution/Roblox-only deliverables. Revisit an exclusion if product scope changes.</p>
<h2 id="local-verification-baseline">Local verification baseline</h2>
<ul>
<li>Ledger negative regressions: 15 passed, 0 failed.</li>
<li>Documentation: 6 passed, 0 failed after <code>npm ci --ignore-scripts</code>; the first isolated run lacked <code>markdown-it</code> and did not establish a product failure. Package installation reported three advisory findings (one low, one moderate, one high); no dependency upgrades were performed in this documentation-only scope.</li>
<li>Offline handbook: 3 passed, 0 failed.</li>
<li>Desktop initial full run: 162 tests, 161 passed and one test-file import failed because the isolated checkout lacked <code>typescript</code>. After resolving the existing pinned dependency, the affected suite passed all 10 tests. The full native-history suite was not repeated because its results were unaffected. Its existing test command already includes <code>src/app/*.test.mjs</code> and <code>electron/services/*.test.cjs</code>, so no discovery repair was necessary.</li>
<li>Storage service: 6 passed, 0 failed.</li>
<li>Native build, Rust suites, installed applications, GUI interaction, deployment and release acceptance are not established by this ledger change.</li>
</ul>
<h2 id="child-surface-source-review">Child-surface source review</h2>
<p><code>child-surfaces.json</code> names 26 reviewed desktop child surfaces, their actual state consumers and source files. Every child inherits all applicable obligations from its parent; highlighted identities only record review priorities. The list deliberately remains <code>complete: false</code>. Its source baseline is <code>60e65ef</code>, not a claim that later concurrent implementation was audited. Current built interaction remains unverified for every child. The local checker validates declared parent and feature identities, source references and consumer descriptions; its negative cases reject false runtime claims. The independent test list prevents removal of a reviewed child from passing silently.</p>
<p>The main ledger now links source and focused test locations for language, narration, appearance, notifications, attention controls, palette, guidance, progress and protected history. A linked test file is a discovery reference; terminal execution results above remain separate. Local avatar shape/tone persistence does not prove a complete per-element appearance editor. Presentation datasets do not establish current pixels or all customization controls.</p>
<p>Desktop service discovery now uses <code>electron/services/**/*.test.cjs</code>, preserving the existing top-level and application test patterns while including nested native server suites. The server sources were supplied by separate implementation commits, not authored by this acceptance change. Recursive-suite terminal results are recorded below when available.</p>
<p>The presentation-mode source audit specifically found an application-local <code>school-mode.v1</code> record and an explicit no-shared-record disclosure. Its transaction updates message-style values and dialog decoration, which does not establish the required shared renameable mode, live propagation, forced English, complete capability omission or shared unlock credential. This row remains partial. The source audit also names the personal-wording import and celebration state without treating source presence as proof of outcome sounds or accessible built interaction.</p>
<p>The completed clean baseline run passed <strong>171 of 171</strong> desktop tests. After recursive service discovery and the two separately authored native server inputs, the full desktop run passed <strong>182 of 182</strong>, including all 11 nested native server tests. <code>local-tests.json</code> records exact counts, observed durations, source inputs and the package-script digest. The two runs overlapped, so their durations are not performance benchmarks. Native fixture tests do not prove a real distribution download, server process lifecycle, container launch or GUI workflow. No full-suite failure remains in these desktop results.</p>
<h2 id="world-generator-requirement-update">World-generator requirement update</h2>
<p>The current catalogue adds <code>minecraft-world-generator</code> beside <code>minecraft-server-manager</code>. Its seven rows inherit exactly the parent manager's applicability: the six rendered surface families remain applicable and unfinished, while non-rendered repository delivery records retain the parent's explicit exclusion. The requirement has no implementation, localization, persistence, test, runtime or screenshot evidence attached.</p>
<p>A bounded review of product source at <code>37ff81f</code> found <code>design/remaining-features/WorldGenerator.dc.html</code> and no active generator handlers in the desktop renderer, native services or server feature documentation. The artboard is design-only; its displayed progress and controls do not establish executable generation. The new child-surface record identifies the existing server-service boundary and explicitly states that no generator state consumer was found. There are now 27 discovery child records, all runtime-unverified; the original 26-record review remains historical context.</p>
<p>Acceptance must separately establish per-selected-version extraction, typed registry-backed controls, pack writing, user EULA consent, server execution, bounded pre-generation (at most 256 chunks per batch), a default 100 by 100 chunk canvas synchronized with fields, native Browse, verified non-overwriting Folder and atomic ZIP outputs, and same-version server reopening. Edition/version limitations must state their real scope. No raw JSON textbox or hardcoded registry picker substitutes for those workflows.</p>
<p>The original <strong>111-identity / 777-row / 414-unfinished</strong> baseline, 15-test ledger receipt and 171/182-test desktop receipts are historical results for their stated inputs. They are not silently relabelled as verification of the new 112-identity catalogue or generator implementation. Current catalogue regression results are reported separately by this update.</p>
<p>The current 112-identity inventory validation passed with <strong>784 rows, 420 unfinished and zero validation errors</strong>. The updated local inventory suite passed <strong>17 tests, zero failed</strong>. These are structural and omission checks only, and do not upgrade generator completion or rerun the historical desktop acceptance suites.</p>
<p>The later desktop generator discovery at <code>5c666245</code> supersedes the old absence statement
for that child only. The child record names the real renderer and preload consumer while
keeping runtime state unverified. The ledger test accepts that documented partial state
without allowing runtime, persistence, localization or screenshot completion to be inferred.</p>
`,text:`# Required-feature acceptance\r
\r
The current catalogue contains **112 identities across seven surface families: 784 rows, with 420 applicable rows unfinished**. The generator's desktop workspace row now records partial source implementation and focused checks; its whole-workflow acceptance remains unfinished. The other applicable surface rows remain missing.\r
\r
The inventory is a historical discovery baseline, not a claim that later implementation is\r
absent. The [November defect-verification record](2026-11-01-defect-verification.md) records\r
the later integrated generator, source-bound tests, report-only runtime checks and scoped\r
GUI evidence without upgrading unfinished whole-feature rows.\r
\r
This inventory originally recorded a conservative source-review baseline at \`60e65ef\`. It is not a certification, implementation report, or release approval. The original inventory contained 111 neutral requirement identities across seven surface families, including the productive workspace, Settings, hosted documentation, offline handbook, storage dashboard, hosting wizard and repository delivery records. Nested dialogs, menus, pickers, tool panels and article routes inherit the owning family's obligations; they still need explicit child-surface inventories before completion.\r
\r
The independent \`required-identities.json\` list prevents deleting a feature row to make the inventory appear complete. Names are product-facing descriptions, not an embedded private dictionary. This baseline deliberately does not copy private instruction prose, mappings or local paths.\r
\r
## Reading evidence states\r
\r
\`not-audited\` means no behavior verdict has been established. \`partial\` means relevant source was found, not that all required behavior works. \`implemented\` requires a completed source review. \`verified\` additionally requires documentation, localization, persistence evidence or a specific non-persistence explanation, focused tests, built interaction and genuine current screenshots. Every unverified applicable row retains an explicit gap. \`not-applicable\` requires an individual reason and cannot silently stand in for an unimplemented feature.\r
\r
The baseline has no \`verified\` rows. Existing evidence in \`docs/evidence/\` belongs to its original source versions. It has not been revalidated for this candidate and is not attached as current runtime evidence. Test success is a separate dimension from installed, GUI, deployment and release verification.\r
\r
## Validation and intentional failure\r
\r
Run \`node scripts/check-feature-acceptance.mjs\` to validate identity, surface and row integrity. Run \`node --test scripts/check-feature-acceptance.test.mjs\` for the removal and false-claim regressions. Structural success means the ledger is internally consistent, not that the product is complete.\r
\r
Run \`node scripts/check-feature-acceptance.mjs --require-complete\` for a fail-closed delivery decision. It currently returns nonzero because applicable acceptance remains unfinished. Do not remove this flag from a delivery decision to turn a planning inventory into a passing product claim. The checker is a local tool; this change does not add tests or lint to release workflows.\r
\r
The negative tests independently remove an identity and a surface row, duplicate a row, remove an exclusion reason, fabricate verified state, fabricate completion, break a source reference, and attach stale evidence. Each altered case must fail, and the restored baseline must pass.\r
\r
## Implementation priorities and limits\r
\r
1. Review Settings consumers and scope each control to actual rendered behavior. The existing Settings inventory is narrower than the complete product inventory. Source presence alone does not verify persistence or localization.\r
2. Inventory every nested search and context-menu surface, then review independent query state, anchored builder access, bounded execution and the full RegexBuddy topic set. A pattern tester is not parity proof.\r
3. Review the initial-screen provenance in \`apps/desktop/src/app/Shell.tsx\`. Date-only formatting is not the required date/time-with-seconds-and-timezone evidence; source and current built behavior need reconciliation.\r
4. Complete workflow-specific implementation and acceptance for server management, local model management and conversion. Concurrent implementation must be reviewed against its own resulting source commit, not this baseline.\r
5. Expand guidance and information-button coverage to individual controls, including worked examples, isolated playgrounds and negative omissions. Review workspace tab catalog behavior and destructive/locked input paths independently.\r
6. Verify hosted documentation and each companion independently. Shared source does not prove hosted routes, offline navigation, settings persistence, responsive layouts or installed behavior.\r
7. Produce current source/hash-bound layout, interaction and release receipts. Retain historical evidence unchanged and keep unavailable proof unfinished.\r
\r
This is a family-level discovery ledger. It does not yet claim exhaustive per-control decomposition or full behavioral auditing of the original 414 applicable rows. Most source links and all current runtime-evidence fields remain deliberately empty until reviewed. Applicability exclusions cover non-rendered repository records, documentation-only deliverables on productive screens, job-document workflows, repository publishing, extension download interception, private-source build routing, shared-status-service internals, suspended display reporting and instruction-distribution/Roblox-only deliverables. Revisit an exclusion if product scope changes.\r
\r
## Local verification baseline\r
\r
- Ledger negative regressions: 15 passed, 0 failed.\r
- Documentation: 6 passed, 0 failed after \`npm ci --ignore-scripts\`; the first isolated run lacked \`markdown-it\` and did not establish a product failure. Package installation reported three advisory findings (one low, one moderate, one high); no dependency upgrades were performed in this documentation-only scope.\r
- Offline handbook: 3 passed, 0 failed.\r
- Desktop initial full run: 162 tests, 161 passed and one test-file import failed because the isolated checkout lacked \`typescript\`. After resolving the existing pinned dependency, the affected suite passed all 10 tests. The full native-history suite was not repeated because its results were unaffected. Its existing test command already includes \`src/app/*.test.mjs\` and \`electron/services/*.test.cjs\`, so no discovery repair was necessary.\r
- Storage service: 6 passed, 0 failed.\r
- Native build, Rust suites, installed applications, GUI interaction, deployment and release acceptance are not established by this ledger change.\r
\r
\r
## Child-surface source review\r
\r
\`child-surfaces.json\` names 26 reviewed desktop child surfaces, their actual state consumers and source files. Every child inherits all applicable obligations from its parent; highlighted identities only record review priorities. The list deliberately remains \`complete: false\`. Its source baseline is \`60e65ef\`, not a claim that later concurrent implementation was audited. Current built interaction remains unverified for every child. The local checker validates declared parent and feature identities, source references and consumer descriptions; its negative cases reject false runtime claims. The independent test list prevents removal of a reviewed child from passing silently.\r
\r
The main ledger now links source and focused test locations for language, narration, appearance, notifications, attention controls, palette, guidance, progress and protected history. A linked test file is a discovery reference; terminal execution results above remain separate. Local avatar shape/tone persistence does not prove a complete per-element appearance editor. Presentation datasets do not establish current pixels or all customization controls.\r
\r
Desktop service discovery now uses \`electron/services/**/*.test.cjs\`, preserving the existing top-level and application test patterns while including nested native server suites. The server sources were supplied by separate implementation commits, not authored by this acceptance change. Recursive-suite terminal results are recorded below when available.\r
\r
\r
The presentation-mode source audit specifically found an application-local \`school-mode.v1\` record and an explicit no-shared-record disclosure. Its transaction updates message-style values and dialog decoration, which does not establish the required shared renameable mode, live propagation, forced English, complete capability omission or shared unlock credential. This row remains partial. The source audit also names the personal-wording import and celebration state without treating source presence as proof of outcome sounds or accessible built interaction.\r
\r
\r
The completed clean baseline run passed **171 of 171** desktop tests. After recursive service discovery and the two separately authored native server inputs, the full desktop run passed **182 of 182**, including all 11 nested native server tests. \`local-tests.json\` records exact counts, observed durations, source inputs and the package-script digest. The two runs overlapped, so their durations are not performance benchmarks. Native fixture tests do not prove a real distribution download, server process lifecycle, container launch or GUI workflow. No full-suite failure remains in these desktop results.\r
\r
\r
## World-generator requirement update\r
\r
The current catalogue adds \`minecraft-world-generator\` beside \`minecraft-server-manager\`. Its seven rows inherit exactly the parent manager's applicability: the six rendered surface families remain applicable and unfinished, while non-rendered repository delivery records retain the parent's explicit exclusion. The requirement has no implementation, localization, persistence, test, runtime or screenshot evidence attached.\r
\r
A bounded review of product source at \`37ff81f\` found \`design/remaining-features/WorldGenerator.dc.html\` and no active generator handlers in the desktop renderer, native services or server feature documentation. The artboard is design-only; its displayed progress and controls do not establish executable generation. The new child-surface record identifies the existing server-service boundary and explicitly states that no generator state consumer was found. There are now 27 discovery child records, all runtime-unverified; the original 26-record review remains historical context.\r
\r
Acceptance must separately establish per-selected-version extraction, typed registry-backed controls, pack writing, user EULA consent, server execution, bounded pre-generation (at most 256 chunks per batch), a default 100 by 100 chunk canvas synchronized with fields, native Browse, verified non-overwriting Folder and atomic ZIP outputs, and same-version server reopening. Edition/version limitations must state their real scope. No raw JSON textbox or hardcoded registry picker substitutes for those workflows.\r
\r
The original **111-identity / 777-row / 414-unfinished** baseline, 15-test ledger receipt and 171/182-test desktop receipts are historical results for their stated inputs. They are not silently relabelled as verification of the new 112-identity catalogue or generator implementation. Current catalogue regression results are reported separately by this update.\r
\r
The current 112-identity inventory validation passed with **784 rows, 420 unfinished and zero validation errors**. The updated local inventory suite passed **17 tests, zero failed**. These are structural and omission checks only, and do not upgrade generator completion or rerun the historical desktop acceptance suites.\r
\r
The later desktop generator discovery at \`5c666245\` supersedes the old absence statement\r
for that child only. The child record names the real renderer and preload consumer while\r
keeping runtime state unverified. The ledger test accepts that documented partial state\r
without allowing runtime, persistence, localization or screenshot completion to be inferred.\r
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
<h2 id="disposable-environment-templates">Disposable environment templates</h2>
<p><code>superProfiles.list/create/update/duplicate/remove</code> manage encrypted templates.
<code>superProfiles.revisions.list/restore</code> expose immutable history. Updates, removal and restore
use <code>expectedRevisionId</code>; restore also supplies the historical <code>revisionId</code>.
<code>superProfiles.capabilities</code> reports detected host availability separately from guest readiness.</p>
<p><code>superProfiles.sessions.launch</code> accepts <code>profileId</code> and explicit <code>requireStableIdentity: false</code>.
It returns session and operation identifiers before provisioning completes. Poll
<code>superProfiles.sessions.status</code> for bounded phase events, readiness and recovery state.
<code>superProfiles.sessions.stop</code> cancels an active worker or stops the exact owned session.
<code>superProfiles.sessions.discard</code> removes only that identified disposable guest and its staging.</p>
<p>Use <code>superProfiles.sessions.preview</code> with <code>sessionId</code> to review output categories. Save accepts
<code>sessionId</code>, the launched <code>expectedRevisionId</code>, selected <code>categories</code> (<code>browser</code>, <code>workspace</code>),
and <code>closeAfterSave</code>. Its queued response is not proof of an encrypted revision. Collection
finishes before host-side finalization. After a vault lock or host restart,
<code>superProfiles.sessions.finalizeSave</code> requires <code>sessionId</code>, the exact <code>operationId</code>, the
original <code>expectedRevisionId</code> and <code>confirmAfterUnlock: true</code>. Repeated successful finalization
returns the saved revision instead of creating another. <code>saved</code> and <code>cleanupPending</code> are
separate results. A conflict or interrupted save retains recoverable data.</p>
<p>While locked, only session status, stop and discard are available. Their responses omit private
template, revision, staging and progress details. Launch, preview and finalization require unlock.
These methods preserve ordinary browser-profile API behavior.</p>
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
`,text:'# Native command and control API\r\n\r\nThe native executable owns one `Manager`, one engine registry and one process supervisor. Use\r\nan absolute application data directory. It does not inspect personal browser profiles.\r\n\r\n## Desktop and standard input\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData serve --stdio\r\n```\r\n\r\nKeep this process alive. Send one JSON object per line and read one reply per line:\r\n\r\n```json\r\n{"id":"list-1","method":"profiles.list","params":{}}\r\n```\r\n\r\nSuccess is `{"id":"list-1","result":...}`. Failure is\r\n`{"id":"list-1","error":{"code":"...","message":"..."}}`.\r\nThe maximum input line is 1 MiB. Malformed envelopes do not execute commands. Oversized input\r\ncloses the stream. There are no password arguments, secret environment variables or request logs.\r\nNative standard input is a privileged channel, so do not expose it to an untrusted renderer.\r\n\r\n## Disposable environment templates\r\n\r\n`superProfiles.list/create/update/duplicate/remove` manage encrypted templates.\r\n`superProfiles.revisions.list/restore` expose immutable history. Updates, removal and restore\r\nuse `expectedRevisionId`; restore also supplies the historical `revisionId`.\r\n`superProfiles.capabilities` reports detected host availability separately from guest readiness.\r\n\r\n`superProfiles.sessions.launch` accepts `profileId` and explicit `requireStableIdentity: false`.\r\nIt returns session and operation identifiers before provisioning completes. Poll\r\n`superProfiles.sessions.status` for bounded phase events, readiness and recovery state.\r\n`superProfiles.sessions.stop` cancels an active worker or stops the exact owned session.\r\n`superProfiles.sessions.discard` removes only that identified disposable guest and its staging.\r\n\r\nUse `superProfiles.sessions.preview` with `sessionId` to review output categories. Save accepts\r\n`sessionId`, the launched `expectedRevisionId`, selected `categories` (`browser`, `workspace`),\r\nand `closeAfterSave`. Its queued response is not proof of an encrypted revision. Collection\r\nfinishes before host-side finalization. After a vault lock or host restart,\r\n`superProfiles.sessions.finalizeSave` requires `sessionId`, the exact `operationId`, the\r\noriginal `expectedRevisionId` and `confirmAfterUnlock: true`. Repeated successful finalization\r\nreturns the saved revision instead of creating another. `saved` and `cleanupPending` are\r\nseparate results. A conflict or interrupted save retains recoverable data.\r\n\r\nWhile locked, only session status, stop and discard are available. Their responses omit private\r\ntemplate, revision, staging and progress details. Launch, preview and finalization require unlock.\r\nThese methods preserve ordinary browser-profile API behavior.\r\n\r\n## CLI and local daemon\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData daemon\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData status\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData profiles list\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData profiles create "Work" chromium\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData profiles launch PROFILE_UUID\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData profiles stop PROFILE_UUID\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData vault create\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData vault unlock\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData vault lock\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData call\r\n```\r\n\r\nVault create/unlock/join commands read a JSON object with a `password` string from protected\r\nstandard input. Use a parent process with a private pipe and hidden password input. `call` reads a complete envelope from standard input,\r\nincluding vault, sync and revision methods. Never place passwords in command arguments or pipes\r\nsaved to shell history. A running daemon retains the unlocked key between commands. Without a\r\ndaemon, a CLI invocation opens a short-lived host, so create/unlock state ends with that command.\r\nFor several operations without the daemon, use the persistent stdio process instead.\r\n\r\nThe daemon binds only `127.0.0.1` on an operating-system-selected port. It creates `api.json` in the\r\nprotected data directory containing the process id, URL and fresh bearer credential. The directory\r\nhas user-only access. Treat this descriptor as sensitive and never attach it to a support report.\r\nCLI clients read it locally and never transmit its credential to a non-loopback address. A stale\r\ndescriptor produces a connection error. Confirm the recorded process has ended before removing it.\r\n\r\nHTTP accepts only `POST /v1/call`, an exact `Host` authority, a bearer credential and a bounded\r\n`Content-Length`. It rejects browser `Origin` headers, duplicate headers and transfer encoding.\r\nIt sets no CORS allowance. This is a native local API, not an API for websites. Requests are\r\nserialized; a long vault operation can delay other operations. Parsing is isolated across at most\r\n16 workers with an absolute five-second header/body deadline, so an incomplete connection does\r\nnot monopolize the accept loop. HTTP is not used on the LAN.\r\nThe OpenAPI document and Postman collection in this directory describe only this implemented route.\r\n\r\n## Methods and lifecycle safety\r\n\r\nTrusted local engine bundles live under the data directory\'s `engines/chromium` and\r\n`engines/firefox` directories. Each contains its verified `manifest.json`; optional `adapters.json`\r\nmaps `selenium` and/or `puppeteer` to the engine\'s `AdapterRuntime` configuration. It pins absolute\r\n`node` and `helper` paths plus `nodeSha256`, `helperSha256` and `browserVersion`; Selenium also\r\npins `driver`, `driverSha256` and `driverVersion`. The host bounds this file to 64 KiB and the\r\nengine verifies every hash and driver version. Never obtain this configuration from a renderer or\r\npaired peer. Stock baseline bundles must declare advanced capabilities false and be launched\r\nwith the explicit `requireStableIdentity:false` choice; baseline automation proves no native\r\nencryption, live snapshot or stable-identity integration.\r\n\r\nThe core methods in [the architecture contract](../../architecture.md) are available through all\r\nnative transports. The host adds `engines.list`, `profiles.status`, `profiles.launch` and\r\n`profiles.stop`. A profile\'s stored automation preference supplies the launch mode. Automation\r\nremains off unless explicitly configured. `requireStableIdentity` defaults to `true`; an explicitly\r\nchosen basic launch may send `false`. An unverified native integration returns its capability\r\nerror. `profiles.focus` and `devices.list` currently return `CAPABILITY_UNAVAILABLE`.\r\n`automation.endpoint` returns only a running, engine-owned endpoint whose effective mode matches\r\nthe stored preference. Turning automation off revokes this lookup immediately, including before\r\na pending restart. `automation.webdriver` accepts `id`, `verb` (`GET`, `POST`, `DELETE`), an optional\r\nsession-relative `path` and JSON `body`; the host supplies the owned WebDriver session id itself.\r\nIt cannot create another session or select another profile directory. Paths reject traversal,\r\nencoding and query characters. Requests and replies have explicit size and time bounds.\r\n\r\nPaired LAN sessions additionally support `tunnel.open`, `tunnel.exchange` and `tunnel.close` for\r\nengine-owned CDP/BiDi endpoints. All require `id` and explicit method/profile grants. Open returns\r\n`tunnelId`; exchange takes that id plus base64 `data` (at most 32 KiB decoded) and returns base64\r\ndata plus `eof`. Empty exchanges poll a response. Each peer connection owns at most four streams;\r\nclosing it drops every stream. Every chunk rechecks preference, effective endpoint and current\r\ngrants. WebDriver raw TCP tunnels are rejected, use the session-confined command instead. No\r\nclient-supplied host, port or URL is accepted.\r\n\r\nThe native forwarding client connects a standard Puppeteer client through that framed transport:\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\ClientIdentity lan-forward 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID\r\n```\r\n\r\nCreate the client identity with `pair-key`, pair both public keys out of band, and grant the\r\nclient exact `tunnel.open`, `tunnel.exchange`, `tunnel.close` methods plus the profile id on the\r\nserver. The private key stays in the client\'s protected data directory. The command prints one\r\nJSON line containing a local `ws://127.0.0.1:PORT/...` URL for `puppeteer.connect`\'s\r\n`browserWSEndpoint`. Keep it alive while connected. It binds only loopback, opens at most four\r\nlocal streams and uses the paired encrypted transport for the LAN hop. Other local processes\r\nunder the same account can use that loopback endpoint, so run it only while needed. Browser\r\ninteroperability remains unverified until exercised with a matched engine bundle.\r\n\r\nFor an existing Selenium session, use the session-confined relay instead:\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\ClientIdentity lan-webdriver 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID\r\n```\r\n\r\nGrant `automation.endpoint` and `automation.webdriver` for that profile. This prints a loopback\r\nHTTP URL and the owned `sessionId`. The example [paired-selenium.py](../../../examples/paired-selenium.py)\r\nattaches an ordinary Selenium client to that existing session. Creating a new session through the\r\nrelay is rejected. The relay accepts only the owned session path, exact loopback Host and bounded\r\nJSON requests, with no browser-origin or transfer-encoding fallback. Host lifecycle operations\r\nretain ownership, so examples do not quit the managed session behind the host\'s back.\r\n\r\n`operations.list` returns the latest 128 snapshot, restore, synchronization and password-change\r\nattempts in this host process. Each has a random operation id, method, actual terminal state and\r\nstart/terminal events with Unix millisecond times. Successful object results include `operationId`.\r\nThese calls remain synchronous and serialized, so this is completion history rather than live\r\nparallel progress. Records contain no request parameters, results or exception messages and do\r\nnot persist after host exit. LAN access to this global history requires an explicit method grant\r\nand the all-profiles scope.\r\n\r\nSnapshot, restore and removal check supervisor state and the engine\'s exclusive profile lock.\r\nCaller-supplied `running` is overwritten with host-attested state. Locking the vault requires all\r\nowned browser processes to stop and all active-directory locks to be available. A host failure can\r\nleave browser processes alive; recovery must independently establish that they are stopped before\r\nany destructive or snapshot operation. A source-only lock check does not prove crash recovery.\r\n\r\n## Explicitly paired LAN control\r\n\r\nGenerate a native static key once:\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData pair-key\r\n```\r\n\r\nThe private key is written using create-new semantics to protected `lan-key`; only the base64\r\npublic key is printed. Exchange public keys through a trusted out-of-band channel. Never accept\r\na key copied from an untrusted WebSocket connection as authorization.\r\n\r\nOn Windows the host derives the current user\'s SID from the process identity, replaces the data\r\ndirectory DACL with a protected user-only rule, and verifies the resulting rules. It separately\r\nprotects the local API descriptor and LAN identity file, including pre-existing explicit rules.\r\nCreate protected `lan-peers.json` locally with exact method and profile grants:\r\n\r\n```json\r\n{"peers":[{"publicKey":"BASE64_32_BYTE_PEER_PUBLIC_KEY","methods":["profiles.list","profiles.status","profiles.stop"],"profileIds":["PROFILE_UUID"],"revoked":false}]}\r\n```\r\n\r\nStart with an explicit private IPv4 interface and nonzero port:\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData lan 192.168.1.20:8788\r\n```\r\n\r\nThis is native WebSocket transport protected by `Noise_KK_25519_ChaChaPoly_SHA256`, without TLS.\r\nA client sends its paired public key as the first text frame, then the binary Noise KK handshake\r\nmessage. The server sends the second handshake message. Both handshake application payloads are\r\nempty. Only after the handshake completes may binary encrypted JSON envelopes execute. Each\r\nrequest and reply occupies one Noise transport message, with a 65,535-byte ciphertext bound.\r\nPlaintext commands, wrong keys, tampered records and replayed records are rejected. Noise provides\r\nauthentication and encryption; it does not conceal IP addresses, transport timing or traffic size.\r\n\r\nEach method must appear verbatim in the peer grant. Profile methods and revision operations require\r\nan explicitly granted profile id. `profiles.list` is filtered to those ids. Grants are reread before\r\nexecution and while connections idle. Setting `revoked` to `true` closes the peer\'s connection on\r\nthe next bounded check. Existing operations that have already begun are not rolled back.\r\nThe listener caps concurrent connections at 16 and applies handshake/read/write timeouts. Unknown\r\npeers never reach the core. A native client must pin the server\'s out-of-band public key as well.\r\nThere is no unauthenticated LAN control or plaintext HTTP fallback.\r\n\r\n`lan-call PRIVATE_ADDRESS SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY` reads the same complete JSON\r\nrequest envelope from standard input and prints one structured reply. Run it with the client\r\nidentity data directory to create/unlock the remote vault or manage remote profile lifecycle\r\nthrough explicit grants. Passwords remain in the protected pipe, never arguments or environment.\r\nThe listener owns its own `Host`; do not start another stdio host for the same data directory.\r\nProfile creation and duplication require both explicit method permission and the global `*`\r\nprofile scope because they mint new ids. An existing-profile grant cannot authorize either.\r\n\r\n## Verification and limitations\r\n\r\nHost unit tests cover message bounds, credential comparison, Noise tampering/replay/wrong-key\r\nrejection, exact grants and private-address selection. Loopback HTTP and persistent stdio smoke\r\nchecks must be run against the exact built executable. Native/browser integration and LAN\r\nreachability require separate runtime evidence. Unsupported engine capabilities remain unavailable.\r\nThe examples use the same stdio envelope, retain one process and place no password in argv.\r\n\r\nCLI synchronization and revisions also have dedicated aliases:\r\n\r\n```text\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData vault join C:\\SharedCiphertext\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData sync configure C:\\SharedCiphertext\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData sync push\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData sync pull\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData sync conflicts\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData sync resolve PROFILE_UUID REVISION_UUID\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData revisions list PROFILE_UUID\r\nmaterial-browser.exe --data-dir C:\\MaterialBrowserData revisions restore PROFILE_UUID REVISION_UUID\r\n```\r\n\r\nA LAN grant may explicitly name `"*"` in `profileIds` to authorize all profiles. This is required\r\nfor profile creation and vault, settings and synchronization methods, because those methods affect\r\nthe entire vault. It does not grant any method implicitly. `profiles.status` is filtered like\r\n`profiles.list`. Use specific profile ids for a restricted operator and leave global methods out.\r\n'},{id:"docs/features/delivery/README.md",title:"Build and release delivery",category:"features",html:`<h1 id="build-and-release-delivery">Build and release delivery</h1>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fwindows-automation.md">Windows automation</a>: triggers, toolchain inventory, installer delivery and evidence limits.</li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fbundled-engines.md">Bundled browser engines</a>: pinned offline browser, driver and automation payloads.</li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Finstalled-shortcuts.md">Installed shortcuts</a>: installer maintenance, shell identity and verification limits.</li>
</ul>
<p>This category does not expose an HTTP API, so no Postman collection applies.</p>
`,text:`# Build and release delivery

- [Windows automation](windows-automation.md): triggers, toolchain inventory, installer delivery and evidence limits.
- [Bundled browser engines](bundled-engines.md): pinned offline browser, driver and automation payloads.
- [Installed shortcuts](installed-shortcuts.md): installer maintenance, shell identity and verification limits.

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
`},{id:"docs/features/delivery/installed-shortcuts.md",title:"Installed shortcuts",category:"features",html:`<h1 id="installed-shortcuts">Installed shortcuts</h1>
<p>The Squirrel installer invokes the application with maintenance flags while installing,
updating or uninstalling. The main process handles these events before opening a workspace,
parsing workspace arguments or starting the native host.</p>
<p>Install and update events ask the adjacent installed <code>Update.exe</code> to create shortcuts for
<code>MaterialBrowser.exe</code>. Uninstall asks that updater to remove them. The obsolete-version
event exits without opening a workspace. Normal launches and <code>--squirrel-firstrun</code> retain
the productive startup path. Windows shell identity is
<code>com.squirrel.MaterialBrowser.MaterialBrowser</code>, matching the package and executable names.</p>
<p>The updater path is derived from the running executable in an <code>app-&lt;version&gt;</code> directory,
never from renderer input or a maintenance argument. It is invoked without a shell. A
missing updater, invalid installation layout, spawn error, nonzero exit or signal reports
an incomplete maintenance result. After ten seconds the application requests termination
of its own updater child and exits unsuccessfully; this does not prove descendant teardown.
The diagnostic contains only an approved code, without private installation paths.</p>
<p>Fourteen focused startup/security tests passed, including a regression that first failed
when maintenance opened a workspace and the shell identity was absent. Unit tests cover
shortcut arguments, missing updater, timeout ordering and late completion. The normal
desktop test entrypoint includes the maintenance tests.</p>
<p>Source verification does not establish installed shortcuts. Acceptance still requires a
new built installer, supported installation/update at a safe lifecycle boundary, Desktop
and Programs shortcut readback, and launch through the actual shortcut. Preserve existing
work, settings and authentication. Never force-close an active installation for this check.</p>
`,text:`# Installed shortcuts

The Squirrel installer invokes the application with maintenance flags while installing,
updating or uninstalling. The main process handles these events before opening a workspace,
parsing workspace arguments or starting the native host.

Install and update events ask the adjacent installed \`Update.exe\` to create shortcuts for
\`MaterialBrowser.exe\`. Uninstall asks that updater to remove them. The obsolete-version
event exits without opening a workspace. Normal launches and \`--squirrel-firstrun\` retain
the productive startup path. Windows shell identity is
\`com.squirrel.MaterialBrowser.MaterialBrowser\`, matching the package and executable names.

The updater path is derived from the running executable in an \`app-<version>\` directory,
never from renderer input or a maintenance argument. It is invoked without a shell. A
missing updater, invalid installation layout, spawn error, nonzero exit or signal reports
an incomplete maintenance result. After ten seconds the application requests termination
of its own updater child and exits unsuccessfully; this does not prove descendant teardown.
The diagnostic contains only an approved code, without private installation paths.

Fourteen focused startup/security tests passed, including a regression that first failed
when maintenance opened a workspace and the shell identity was absent. Unit tests cover
shortcut arguments, missing updater, timeout ordering and late completion. The normal
desktop test entrypoint includes the maintenance tests.

Source verification does not establish installed shortcuts. Acceptance still requires a
new built installer, supported installation/update at a safe lifecycle boundary, Desktop
and Programs shortcut readback, and launch through the actual shortcut. Preserve existing
work, settings and authentication. Never force-close an active installation for this check.
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
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fsuper-profiles.md">Super Profiles</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Faction-sounds.md">Action sounds and quiet controls</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fzip-gui-remake.md">Material 3 Expressive desktop design</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Felement-locks.md">Element locks, unlock ladder and Support Tickets</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Follama-suite.md">Local Ollama suite</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Ffocus-modes-and-appearance.md">Focus modes and the appearance editor</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fconverter-integrity.md">Converter data preservation and output integrity</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Ffont-delivery.md">Bundled font delivery and verification</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fworldlens-design.md">Historical WorldLens visual design and accessibility</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fpassword-manager.md">Optional KeePassXC pairing for new profiles</a></li>
</ul>
<p>The desktop shell provides an isolated React interface backed by the native host. It never seeds demonstration profiles. A standalone web preview cannot operate the vault and explicitly reports that the native host is unavailable.</p>
<h2 id="security-and-process-boundary">Security and process boundary</h2>
<p>The <a href="#/article/docs%2Ffeatures%2Fdesktop%2Fsettings-file-boundary.md">settings file boundary</a> documents export and editor-choice path validation, durable replacement, failure handling, and focused negative tests.</p>
<p>The <a href="#/article/docs%2Ffeatures%2Fdesktop%2Fprotected-history-workspace.md">protected history workspace</a> records the main-process history integration, independent access flow, display-name behavior and remaining runtime acceptance. Its source implementation is not a complete Settings verdict.</p>
<p>The renderer has no Node access and uses an allowlisted preload bridge. The main process checks sender and frame identity, bounds requests, rejects permission requests and new windows, and launches the native host with an application-owned data directory. Passwords travel through stdin JSON requests, not arguments or logs. Backend errors are reduced to stable error codes at the renderer boundary. Browser profiles are launched only by the native host. The bundled renderer has a restrictive content security policy.</p>
<h2 id="personal-wording">Personal wording</h2>
<p>Settings upload and window-wide file drop use the same full validator. Schema: <code>{ "schemaVersion": 1, "entries": { "Original label": "Replacement label" } }</code>. UTF-8 limit is 256 KiB, nesting limit 8, key length at most 160 Unicode code points and value length at most 1000. Duplicate keys, unknown fields/versions, unsafe keys and non-string values are rejected before state changes. Only exact product-authored labels are replaced. External records, profile names, paths, identifiers and backend responses are not transformed. The validated cache remains local and is omitted from synchronized settings, exports and history. Clearing removes it. No private mappings or filenames ship in the product.</p>
<h2 id="verification-status">Verification status</h2>
<p>The renderer follows the eight artboards of <code>design/IMPLEMENTATION_HANDOFF.md</code> using the vendored design stylesheet. <a href="#/article/docs%2Fevidence%2Fdesktop%2Fm3-redesign%2FREADME.md">Runtime captures</a> from the real Electron shell and native host on Linux are recorded with their method and limits. Windows installation, native preference persistence on Windows and browser launches with bundled engines need their own evidence.</p>
<h2 id="capability-inventory-and-outstanding-acceptance">Capability inventory and outstanding acceptance</h2>
<p>Implemented source paths: isolated preload RPC, native folder picker, real vault creation/unlock, resumable setup progress, real profile list/create/duplicate/launch/stop/snapshot requests, immutable revision listing/restore requests, synchronization configuration/push/pull/conflict requests, saved automation preferences, local language/theme/density/accent, command navigation, strict local personal-wording upload/drop/clear and celebration. Host capability errors remain visible.</p>
<p>Incomplete: the regex workbench currently provides raw/guided constructs, actual worker matching/captures/replacement, timing and timeout but lacks saved snippets/import-export, structured syntax tree, test-case suites and full independent surface coverage. Settings localization has English fallback for explanatory paragraphs. Complete acceptance for scheduled settings, narration, shared school mode, per-element appearance/locks, advanced tab docking/groups, authenticator, support recovery, exports/history, bulk operations, conversion, local models and server management remains unfinished. Several of these now have partial implementations and focused evidence in their linked articles; source presence does not establish the complete required workflow. These are acceptance gaps, not nonapplicability claims.</p>
<p>Built runtime, accessibility, narrow/high-scale matrix, all-language copy, installer/update, restart persistence and backend integration acceptance remain unverified until actual evidence is recorded. The package source does not prove any of these.</p>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fprofile-workspace.md">Desktop profile workspace and daily workflows</a></li>
</ul>
`,text:`# Desktop workspace\r
\r
- [Profile launch and identity capabilities](profile-launch.md)\r
- [Super Profiles](super-profiles.md)\r
- [Action sounds and quiet controls](action-sounds.md)\r
- [Material 3 Expressive desktop design](zip-gui-remake.md)\r
- [Element locks, unlock ladder and Support Tickets](element-locks.md)\r
- [Local Ollama suite](ollama-suite.md)\r
- [Focus modes and the appearance editor](focus-modes-and-appearance.md)\r
- [Converter data preservation and output integrity](converter-integrity.md)\r
- [Bundled font delivery and verification](font-delivery.md)\r
- [Historical WorldLens visual design and accessibility](worldlens-design.md)\r
- [Optional KeePassXC pairing for new profiles](password-manager.md)\r
\r
The desktop shell provides an isolated React interface backed by the native host. It never seeds demonstration profiles. A standalone web preview cannot operate the vault and explicitly reports that the native host is unavailable.\r
\r
## Security and process boundary\r
\r
The [settings file boundary](settings-file-boundary.md) documents export and editor-choice path validation, durable replacement, failure handling, and focused negative tests.\r
\r
The [protected history workspace](protected-history-workspace.md) records the main-process history integration, independent access flow, display-name behavior and remaining runtime acceptance. Its source implementation is not a complete Settings verdict.\r
\r
The renderer has no Node access and uses an allowlisted preload bridge. The main process checks sender and frame identity, bounds requests, rejects permission requests and new windows, and launches the native host with an application-owned data directory. Passwords travel through stdin JSON requests, not arguments or logs. Backend errors are reduced to stable error codes at the renderer boundary. Browser profiles are launched only by the native host. The bundled renderer has a restrictive content security policy.\r
\r
## Personal wording\r
\r
Settings upload and window-wide file drop use the same full validator. Schema: \`{ "schemaVersion": 1, "entries": { "Original label": "Replacement label" } }\`. UTF-8 limit is 256 KiB, nesting limit 8, key length at most 160 Unicode code points and value length at most 1000. Duplicate keys, unknown fields/versions, unsafe keys and non-string values are rejected before state changes. Only exact product-authored labels are replaced. External records, profile names, paths, identifiers and backend responses are not transformed. The validated cache remains local and is omitted from synchronized settings, exports and history. Clearing removes it. No private mappings or filenames ship in the product.\r
\r
## Verification status\r
\r
The renderer follows the eight artboards of \`design/IMPLEMENTATION_HANDOFF.md\` using the vendored design stylesheet. [Runtime captures](../../evidence/desktop/m3-redesign/README.md) from the real Electron shell and native host on Linux are recorded with their method and limits. Windows installation, native preference persistence on Windows and browser launches with bundled engines need their own evidence.\r
\r
## Capability inventory and outstanding acceptance\r
\r
Implemented source paths: isolated preload RPC, native folder picker, real vault creation/unlock, resumable setup progress, real profile list/create/duplicate/launch/stop/snapshot requests, immutable revision listing/restore requests, synchronization configuration/push/pull/conflict requests, saved automation preferences, local language/theme/density/accent, command navigation, strict local personal-wording upload/drop/clear and celebration. Host capability errors remain visible.\r
\r
Incomplete: the regex workbench currently provides raw/guided constructs, actual worker matching/captures/replacement, timing and timeout but lacks saved snippets/import-export, structured syntax tree, test-case suites and full independent surface coverage. Settings localization has English fallback for explanatory paragraphs. Complete acceptance for scheduled settings, narration, shared school mode, per-element appearance/locks, advanced tab docking/groups, authenticator, support recovery, exports/history, bulk operations, conversion, local models and server management remains unfinished. Several of these now have partial implementations and focused evidence in their linked articles; source presence does not establish the complete required workflow. These are acceptance gaps, not nonapplicability claims.\r
\r
Built runtime, accessibility, narrow/high-scale matrix, all-language copy, installer/update, restart persistence and backend integration acceptance remain unverified until actual evidence is recorded. The package source does not prove any of these.\r
\r
- [Desktop profile workspace and daily workflows](profile-workspace.md)\r
`},{id:"docs/features/desktop/action-sounds.md",title:"Action sounds and quiet controls",category:"features",html:`<h1 id="action-sounds-and-quiet-controls">Action sounds and quiet controls</h1>
<p>Short, original musical tones complement visible desktop results. A soft ascending chord acknowledges a completed operation; a lower two-note cue marks a failed operation. These cues use local Web Audio synthesis with no downloaded recordings, external services or network requests.</p>
<h2 id="choose-your-sound-preferences">Choose your sound preferences</h2>
<p>Open <strong>Settings \u2192 Notifications</strong> and search for <strong>Action sounds</strong>. Turn the switch off to silence action feedback. <strong>Action sound volume</strong> adjusts the level from 0 to 100 percent in steps of 5; the initial level is 35 percent. Zero is silent. Use <strong>Preview action sound</strong> to hear the completion cue under the current preferences.</p>
<p>The switch and volume use the validated native preference store, with the same reset, history, schedule and transfer mechanisms as other presentation preferences. A failed preference save remains visible. Disabling sounds stops any active or scheduled notes immediately.</p>
<h2 id="when-tones-play">When tones play</h2>
<p>Success and failure notifications from completed desktop operations request a cue only after their notification record has been saved. For example, a completed profile action can produce a success tone; a failed native operation can produce a failure tone. Informational notices, page navigation, initial data loading and restored notification history are silent. Rapid results do not stack audio or create a playback queue.</p>
<p>Audio initializes after a pointer or keyboard gesture. If audio is unsupported, blocked or unavailable, the operation and its visible result continue normally. Quiet hours, low stimulation, application narration and explicit screen-reader mode suppress every cue, including preview and failure tones. Preview never bypasses these choices. Sounds always supplement the visible result.</p>
<h2 id="\u5EE3\u6771\u8A71\u64CD\u4F5C\u6307\u5357">\u5EE3\u6771\u8A71\u64CD\u4F5C\u6307\u5357</h2>
<p>\u958B\u555F <strong>\u8A2D\u5B9A \u2192 \u901A\u77E5</strong>\uFF0C\u641C\u5C0B <strong>\u64CD\u4F5C\u97F3\u6548</strong>\u3002\u95DC\u9589\u958B\u95DC\u5C31\u6703\u505C\u6B62\u97F3\u6548\uFF1B<strong>\u64CD\u4F5C\u97F3\u6548\u97F3\u91CF</strong> \u53EF\u8A2D\u5B9A\u70BA\u767E\u5206\u4E4B\u96F6\u81F3\u4E00\u767E\uFF0C\u9810\u8A2D\u70BA\u767E\u5206\u4E4B\u4E09\u5341\u4E94\u3002\u96F6\u5373\u975C\u97F3\u3002\u6309 <strong>\u8A66\u807D\u64CD\u4F5C\u97F3\u6548</strong> \u53EF\u8A66\u807D\u5B8C\u6210\u63D0\u793A\u3002</p>
<p>\u64CD\u4F5C\u5B8C\u6210\u6216\u5931\u6557\u4E26\u5132\u5B58\u901A\u77E5\u5F8C\uFF0C\u7A0B\u5F0F\u5148\u6703\u64AD\u653E\u97F3\u6548\u3002\u8F09\u5165\u8CC7\u6599\u3001\u5207\u63DB\u9801\u9762\u53CA\u8B80\u53D6\u820A\u901A\u77E5\u90FD\u5514\u6703\u767C\u8072\u3002\u5B89\u975C\u6642\u6BB5\u3001\u6E1B\u5C11\u523A\u6FC0\u3001\u7A0B\u5F0F\u6717\u8B80\u53CA\u87A2\u5E55\u95B1\u8B80\u5668\u6A21\u5F0F\u6703\u5C07\u6240\u6709\u97F3\u6548\u975C\u97F3\uFF0C\u8A66\u807D\u4EA6\u6703\u9075\u5F9E\u8A2D\u5B9A\u3002\u95DC\u9589\u97F3\u6548\u6703\u5373\u6642\u505C\u6B62\u64AD\u653E\u3002\u5373\u4F7F\u97F3\u8A0A\u7121\u6CD5\u4F7F\u7528\uFF0C\u64CD\u4F5C\u7D50\u679C\u4ECD\u7136\u6703\u4EE5\u6587\u5B57\u986F\u793A\u3002</p>
<h2 id="verification-boundary">Verification boundary</h2>
<p>Automated tests cover gesture initialization, silent hydration, overlap suppression, current preference gates, cancellation during preview initialization, unavailable audio, schema validation and settings transfer. These tests use an audio test double; they do not establish subjective listening quality, physical speaker output or native restart acceptance.</p>
`,text:`# Action sounds and quiet controls\r
\r
Short, original musical tones complement visible desktop results. A soft ascending chord acknowledges a completed operation; a lower two-note cue marks a failed operation. These cues use local Web Audio synthesis with no downloaded recordings, external services or network requests.\r
\r
## Choose your sound preferences\r
\r
Open **Settings \u2192 Notifications** and search for **Action sounds**. Turn the switch off to silence action feedback. **Action sound volume** adjusts the level from 0 to 100 percent in steps of 5; the initial level is 35 percent. Zero is silent. Use **Preview action sound** to hear the completion cue under the current preferences.\r
\r
The switch and volume use the validated native preference store, with the same reset, history, schedule and transfer mechanisms as other presentation preferences. A failed preference save remains visible. Disabling sounds stops any active or scheduled notes immediately.\r
\r
## When tones play\r
\r
Success and failure notifications from completed desktop operations request a cue only after their notification record has been saved. For example, a completed profile action can produce a success tone; a failed native operation can produce a failure tone. Informational notices, page navigation, initial data loading and restored notification history are silent. Rapid results do not stack audio or create a playback queue.\r
\r
Audio initializes after a pointer or keyboard gesture. If audio is unsupported, blocked or unavailable, the operation and its visible result continue normally. Quiet hours, low stimulation, application narration and explicit screen-reader mode suppress every cue, including preview and failure tones. Preview never bypasses these choices. Sounds always supplement the visible result.\r
\r
## \u5EE3\u6771\u8A71\u64CD\u4F5C\u6307\u5357\r
\r
\u958B\u555F **\u8A2D\u5B9A \u2192 \u901A\u77E5**\uFF0C\u641C\u5C0B **\u64CD\u4F5C\u97F3\u6548**\u3002\u95DC\u9589\u958B\u95DC\u5C31\u6703\u505C\u6B62\u97F3\u6548\uFF1B**\u64CD\u4F5C\u97F3\u6548\u97F3\u91CF** \u53EF\u8A2D\u5B9A\u70BA\u767E\u5206\u4E4B\u96F6\u81F3\u4E00\u767E\uFF0C\u9810\u8A2D\u70BA\u767E\u5206\u4E4B\u4E09\u5341\u4E94\u3002\u96F6\u5373\u975C\u97F3\u3002\u6309 **\u8A66\u807D\u64CD\u4F5C\u97F3\u6548** \u53EF\u8A66\u807D\u5B8C\u6210\u63D0\u793A\u3002\r
\r
\u64CD\u4F5C\u5B8C\u6210\u6216\u5931\u6557\u4E26\u5132\u5B58\u901A\u77E5\u5F8C\uFF0C\u7A0B\u5F0F\u5148\u6703\u64AD\u653E\u97F3\u6548\u3002\u8F09\u5165\u8CC7\u6599\u3001\u5207\u63DB\u9801\u9762\u53CA\u8B80\u53D6\u820A\u901A\u77E5\u90FD\u5514\u6703\u767C\u8072\u3002\u5B89\u975C\u6642\u6BB5\u3001\u6E1B\u5C11\u523A\u6FC0\u3001\u7A0B\u5F0F\u6717\u8B80\u53CA\u87A2\u5E55\u95B1\u8B80\u5668\u6A21\u5F0F\u6703\u5C07\u6240\u6709\u97F3\u6548\u975C\u97F3\uFF0C\u8A66\u807D\u4EA6\u6703\u9075\u5F9E\u8A2D\u5B9A\u3002\u95DC\u9589\u97F3\u6548\u6703\u5373\u6642\u505C\u6B62\u64AD\u653E\u3002\u5373\u4F7F\u97F3\u8A0A\u7121\u6CD5\u4F7F\u7528\uFF0C\u64CD\u4F5C\u7D50\u679C\u4ECD\u7136\u6703\u4EE5\u6587\u5B57\u986F\u793A\u3002\r
\r
## Verification boundary\r
\r
Automated tests cover gesture initialization, silent hydration, overlap suppression, current preference gates, cancellation during preview initialization, unavailable audio, schema validation and settings transfer. These tests use an audio test double; they do not establish subjective listening quality, physical speaker output or native restart acceptance.\r
`},{id:"docs/features/desktop/converter-integrity.md",title:"Converter data preservation",category:"features",html:`<h1 id="converter-data-preservation">Converter data preservation</h1>
<p>The converter preserves every supported CSV field even when a repeated header's generated
suffix matches another literal header. It reserves the complete normalized header namespace
before allocating unique names. Special names such as <code>__proto__</code> and <code>constructor</code> are
ordinary enumerable own data fields and survive JSON serialization without changing the
record's prototype.</p>
<p>Every conversion records the expected output byte length and SHA-256 before writing. The
read-back checks both before the existing format-specific checks. Matching row counts or
image dimensions alone do not establish matching content.</p>
<h2 id="cancellation-and-file-placement">Cancellation and file placement</h2>
<p>The queue retains the created output's file identity. On cancellation or verification failure,
it compares path/open-file identity, timestamps, size and expected content, and rechecks the
path before removal. Observed replaced or modified files are retained. An unchanged owned
output is removed by the tested cancellation path.</p>
<p>These Node filesystem checks and the final unlink are not atomic against arbitrary concurrent
external writers. This is bounded preservation checking, not an absolute replacement-protection
guarantee or a native handle-based deletion protocol.</p>
<p>Successful hard-link or exclusive-copy placement leaves the retry scope before bookkeeping
and temporary-file cleanup. A temporary unlink failure cannot generate another final output.
It may retain the owned temporary file while the valid final output is successfully returned.
No claim is made that every filesystem cleanup fault removes every temporary file.</p>
<p>The selected output directory is bound by resolved path and filesystem identity. The queue
rechecks that binding at enqueue, immediately before writing and before final verification.
A renamed, replaced or remapped selection stops with <code>OUTPUT_FOLDER_CHANGED</code> and asks the
user to select the output folder again. Jobs retain their own binding if a later job chooses
another folder. An initially selected junction remains supported while its resolved target
is unchanged; placement uses that resolved directory. These checks retain the same non-atomic
filesystem limitation described above.</p>
<h2 id="verification-and-limits">Verification and limits</h2>
<p>Five causal regressions failed against the prior source, then passed with the repair. The
existing converter suite plus the new integrity suite passed 21 tests; an independent reviewer
reran the same 21 tests successfully. Cases cover duplicate/generated headers, special fields,
same-row output changes, cancellation with a replacement destination, unchanged-owned
cancellation, and an injected post-placement temporary-unlink fault.</p>
<p>These are executed native-module checks using synthetic files, not complete built-interface
or image-codec acceptance. No actual user-file loss or hostile activity was observed. See
issues <a href="https://github.com/Ding-Ding-Projects/material-browser/issues/19">19</a>,
<a href="https://github.com/Ding-Ding-Projects/material-browser/issues/20">20</a>,
<a href="https://github.com/Ding-Ding-Projects/material-browser/issues/21">21</a> and
<a href="https://github.com/Ding-Ding-Projects/material-browser/issues/22">22</a>.</p>
<p>The directory-identity follow-up adds three cases: replacement before enqueue, a junction
remap during the writing-stage yield, and an unchanged initially selected junction. The first
two reproduced the old behavior before repair; all three pass afterwards. Existing and new
converter suites now contain 24 passing tests. The injected native-dialog reproduction did
not use a physical picker or user directories. See <a href="https://github.com/Ding-Ding-Projects/material-browser/issues/23">issue 23</a>.</p>
`,text:`# Converter data preservation\r
\r
The converter preserves every supported CSV field even when a repeated header's generated\r
suffix matches another literal header. It reserves the complete normalized header namespace\r
before allocating unique names. Special names such as \`__proto__\` and \`constructor\` are\r
ordinary enumerable own data fields and survive JSON serialization without changing the\r
record's prototype.\r
\r
Every conversion records the expected output byte length and SHA-256 before writing. The\r
read-back checks both before the existing format-specific checks. Matching row counts or\r
image dimensions alone do not establish matching content.\r
\r
## Cancellation and file placement\r
\r
The queue retains the created output's file identity. On cancellation or verification failure,\r
it compares path/open-file identity, timestamps, size and expected content, and rechecks the\r
path before removal. Observed replaced or modified files are retained. An unchanged owned\r
output is removed by the tested cancellation path.\r
\r
These Node filesystem checks and the final unlink are not atomic against arbitrary concurrent\r
external writers. This is bounded preservation checking, not an absolute replacement-protection\r
guarantee or a native handle-based deletion protocol.\r
\r
Successful hard-link or exclusive-copy placement leaves the retry scope before bookkeeping\r
and temporary-file cleanup. A temporary unlink failure cannot generate another final output.\r
It may retain the owned temporary file while the valid final output is successfully returned.\r
No claim is made that every filesystem cleanup fault removes every temporary file.\r
\r
The selected output directory is bound by resolved path and filesystem identity. The queue\r
rechecks that binding at enqueue, immediately before writing and before final verification.\r
A renamed, replaced or remapped selection stops with \`OUTPUT_FOLDER_CHANGED\` and asks the\r
user to select the output folder again. Jobs retain their own binding if a later job chooses\r
another folder. An initially selected junction remains supported while its resolved target\r
is unchanged; placement uses that resolved directory. These checks retain the same non-atomic\r
filesystem limitation described above.\r
\r
## Verification and limits\r
\r
Five causal regressions failed against the prior source, then passed with the repair. The\r
existing converter suite plus the new integrity suite passed 21 tests; an independent reviewer\r
reran the same 21 tests successfully. Cases cover duplicate/generated headers, special fields,\r
same-row output changes, cancellation with a replacement destination, unchanged-owned\r
cancellation, and an injected post-placement temporary-unlink fault.\r
\r
These are executed native-module checks using synthetic files, not complete built-interface\r
or image-codec acceptance. No actual user-file loss or hostile activity was observed. See\r
issues [19](https://github.com/Ding-Ding-Projects/material-browser/issues/19),\r
[20](https://github.com/Ding-Ding-Projects/material-browser/issues/20),\r
[21](https://github.com/Ding-Ding-Projects/material-browser/issues/21) and\r
[22](https://github.com/Ding-Ding-Projects/material-browser/issues/22).\r
\r
The directory-identity follow-up adds three cases: replacement before enqueue, a junction\r
remap during the writing-stage yield, and an unchanged initially selected junction. The first\r
two reproduced the old behavior before repair; all three pass afterwards. Existing and new\r
converter suites now contain 24 passing tests. The injected native-dialog reproduction did\r
not use a physical picker or user directories. See [issue 23](https://github.com/Ding-Ding-Projects/material-browser/issues/23).\r
`},{id:"docs/features/desktop/element-locks.md",title:"Element locks, unlock ladder and Support Tickets",category:"features",html:`<h1 id="element-locks-unlock-ladder-and-support-tickets">Element locks, unlock ladder and Support Tickets</h1>
<p>Element locks put a second, playful key on a profile or a Settings section. They are deliberately not a security boundary: the encrypted vault is. The interface says so wherever a lock is created.</p>
<h2 id="creating-a-lock">Creating a lock</h2>
<p>Open a profile's menu and choose <strong>Lock this element\u2026</strong>, or go to <strong>Settings \u2192 Locks and authenticator</strong> and pick a profile or Settings section. Choose exactly one of six ways to unlock it:</p>
<ol>
<li>PIN (4 to 12 digits)</li>
<li>Password (at least 6 characters)</li>
<li>PIN and password</li>
<li>Password and authenticator code</li>
<li>PIN and authenticator code</li>
<li>Password, PIN and code</li>
</ol>
<p>For authenticator codes the dialog shows a new secret and a copyable <code>otpauth://</code> setup link. The lock is saved only after a current six-digit code from the authenticator app is entered, so the time on both devices is checked up front. Codes follow RFC 6238 (SHA-1, 30-second steps, six digits) and accept one step of clock drift either way.</p>
<p>PINs and passwords are stored only as salted PBKDF2-SHA-256 digests. The plain values never leave the dialog.</p>
<h2 id="opening-a-locked-element">Opening a locked element</h2>
<p>Launching, renaming, stopping or deleting a locked profile, or opening a locked Settings section, first asks for its unlock. A successful unlock lasts for the session and ends when the vault locks.</p>
<h2 id="the-unlock-ladder">The unlock ladder</h2>
<p>Five wrong attempts start a four-minute wait. During the wait the <strong>Play your way out</strong> dialog offers four rungs: Dim sum (name the dish), Sums (ten additions), Moles (tap eight moles) and Clock (read an analogue clock). Finishing any rung clears the waiting time, never the lock itself. At most three rungs can be finished per hour; after that the wait ends on its own.</p>
<h2 id="support-tickets">Support Tickets</h2>
<p><strong>Locked out?</strong> opens Support Tickets, a local desk of one. Submitting a ticket records it on this computer and answers it straight away with the location of the lock folder and a button to open it. Removing that folder resets every lock. The vault is not in it, so no profile data is affected. Nothing is sent anywhere.</p>
<h2 id="storage">Storage</h2>
<p>Locks and tickets are written by the Electron main process to <code>element-locks/</code> inside the application data folder, separate from the <code>vault/</code> folder. The IPC channel accepts only <code>read</code>, <code>write</code>, <code>folder</code> and <code>open</code> from the trusted renderer frame, only the <code>locks</code> and <code>tickets</code> stores, objects only, and at most 256 KB per store.</p>
`,text:`# Element locks, unlock ladder and Support Tickets\r
\r
Element locks put a second, playful key on a profile or a Settings section. They are deliberately not a security boundary: the encrypted vault is. The interface says so wherever a lock is created.\r
\r
## Creating a lock\r
\r
Open a profile's menu and choose **Lock this element\u2026**, or go to **Settings \u2192 Locks and authenticator** and pick a profile or Settings section. Choose exactly one of six ways to unlock it:\r
\r
1. PIN (4 to 12 digits)\r
2. Password (at least 6 characters)\r
3. PIN and password\r
4. Password and authenticator code\r
5. PIN and authenticator code\r
6. Password, PIN and code\r
\r
For authenticator codes the dialog shows a new secret and a copyable \`otpauth://\` setup link. The lock is saved only after a current six-digit code from the authenticator app is entered, so the time on both devices is checked up front. Codes follow RFC 6238 (SHA-1, 30-second steps, six digits) and accept one step of clock drift either way.\r
\r
PINs and passwords are stored only as salted PBKDF2-SHA-256 digests. The plain values never leave the dialog.\r
\r
## Opening a locked element\r
\r
Launching, renaming, stopping or deleting a locked profile, or opening a locked Settings section, first asks for its unlock. A successful unlock lasts for the session and ends when the vault locks.\r
\r
## The unlock ladder\r
\r
Five wrong attempts start a four-minute wait. During the wait the **Play your way out** dialog offers four rungs: Dim sum (name the dish), Sums (ten additions), Moles (tap eight moles) and Clock (read an analogue clock). Finishing any rung clears the waiting time, never the lock itself. At most three rungs can be finished per hour; after that the wait ends on its own.\r
\r
## Support Tickets\r
\r
**Locked out?** opens Support Tickets, a local desk of one. Submitting a ticket records it on this computer and answers it straight away with the location of the lock folder and a button to open it. Removing that folder resets every lock. The vault is not in it, so no profile data is affected. Nothing is sent anywhere.\r
\r
## Storage\r
\r
Locks and tickets are written by the Electron main process to \`element-locks/\` inside the application data folder, separate from the \`vault/\` folder. The IPC channel accepts only \`read\`, \`write\`, \`folder\` and \`open\` from the trusted renderer frame, only the \`locks\` and \`tickets\` stores, objects only, and at most 256 KB per store.\r
`},{id:"docs/features/desktop/file-converter-and-changelog.md",title:"File converter and offline changelog",category:"features",html:`<h1 id="file-converter-and-offline-changelog">File converter and offline changelog</h1>
<p>The Toolbox page puts a local file converter and the release changelog side by side. The layout, components and copy follow the approved artboard <code>design/remaining-features/Toolbox.dc.html</code>.</p>
<h2 id="file-converter">File converter</h2>
<p>Conversions run inside the Electron main process using only what ships with the application. No file is uploaded and no external program is started; the service does not use <code>child_process</code> and never looks for tools on <code>PATH</code>.</p>
<table>
<thead>
<tr>
<th>Category</th>
<th>Inputs</th>
<th>Outputs</th>
<th>How</th>
</tr>
</thead>
<tbody>
<tr>
<td>Images</td>
<td>PNG, JPEG</td>
<td>PNG, JPEG, optional resize by width (aspect ratio kept)</td>
<td>Electron <code>nativeImage</code></td>
</tr>
<tr>
<td>Data</td>
<td>CSV</td>
<td>JSON (pretty or minified)</td>
<td>RFC 4180 parser in plain JavaScript</td>
</tr>
<tr>
<td>Data</td>
<td>JSON</td>
<td>CSV, pretty JSON, minified JSON</td>
<td>Plain JavaScript</td>
</tr>
<tr>
<td>Data</td>
<td>Netscape bookmark HTML (<code>.html</code>, <code>.htm</code>)</td>
<td>JSON folder tree</td>
<td>Plain JavaScript</td>
</tr>
<tr>
<td>Documents</td>
<td>PDF, Word, OpenDocument, text and others</td>
<td>None</td>
<td>Shown as "Unavailable: no bundled converter in this build"</td>
</tr>
<tr>
<td>Audio and video</td>
<td>MP3, WAV, MP4, MOV and others</td>
<td>None</td>
<td>Shown as unavailable in the same way</td>
</tr>
</tbody>
</table>
<p>WebP output is not offered, because <code>nativeImage</code> cannot encode it. The artboard's sample row "photo.png \u2192 WebP" is therefore shown in the build as a PNG or JPEG target instead.</p>
<h3 id="choosing-files-and-the-output-folder">Choosing files and the output folder</h3>
<p>Files are chosen with the native open dialog or dropped onto the drop area. Only absolute paths cross the IPC bridge; the renderer never sends file contents. Dropped files are resolved to paths through <code>webUtils.getPathForFile</code>, which the preload must expose as <code>pathForFile</code> (see Integration). The first conversion asks for an output folder with the native folder dialog; it can be changed at any time.</p>
<h3 id="queue">Queue</h3>
<ul>
<li>One file is converted at a time. Queued jobs hold only a path and options, so memory use does not grow with the queue length.</li>
<li>Each file is checked against a size cap before it is read: 50 MB for images, 25 MB for data files. Larger files fail with "The file is larger than the limit for its category".</li>
<li>A queued job can be canceled at once. A running job stops at the next stage boundary (reading, converting, writing, checking) and anything it had written is removed.</li>
<li>Output is written to a temporary file in the chosen folder, then moved into place with a hard link that fails if the name is taken, so an existing file is never replaced. Names are taken as <code>name.ext</code>, then <code>name (1).ext</code>, <code>name (2).ext</code> and so on. On file systems without hard links, the service checks the name and then renames.</li>
<li>After writing, the output is read back from disk and checked before the job is marked done: images must decode to the expected dimensions, JSON must parse and have the expected row count (or match the input exactly for reformatting), CSV must parse to the expected number of records, and bookmark JSON must contain every bookmark. A file that fails the check is removed and the job is marked failed.</li>
</ul>
<h3 id="csv-rules">CSV rules</h3>
<ul>
<li>Fields are separated by commas; records by CRLF, LF or CR. A final line break does not add a record. A leading byte order mark is ignored.</li>
<li>Quoted fields may contain commas, doubled quotes and line breaks.</li>
<li>An unclosed quote, or text after a closing quote, is an error.</li>
<li>The first record is the header. Empty header names become <code>columnN</code>; repeated names get <code>_2</code>, <code>_3</code> suffixes. A record with a different number of fields from the header is an error rather than being padded or cut. Blank lines between records are skipped.</li>
<li>CSV output uses CRLF line breaks and quotes fields that contain commas, quotes, line breaks or leading or trailing spaces. JSON to CSV accepts an array of objects (columns in first-seen key order) or an array of arrays.</li>
<li>Data files must be UTF-8.</li>
</ul>
<h2 id="changelog">Changelog</h2>
<p>The changelog is read from <code>apps/desktop/assets/changelog.json</code>, which is bundled into the renderer at build time, so the page works offline. Releases are listed newest first. The release matching the running version is highlighted with the "This version" overline and a filled icon. The search bar is the shared <code>SearchBar</code> with the regex builder, and matches version, date, summary and notes.</p>
<p><code>scripts/build-changelog.mjs</code> regenerates <code>changelog.json</code> from <code>CHANGELOG.md</code> at the repository root (Keep a Changelog headings such as <code>## [1.2.0] - 2026-11-01</code>). The repository has no such file yet, so the script currently keeps the shipped <code>changelog.json</code> and only checks that it has an entry for the current <code>apps/desktop/package.json</code> version. It does not read git history or the network.</p>
<p>The shipped file has a single entry for version 0.1.1 with no date, because no earlier release notes are recorded in this repository.</p>
<h2 id="integration">Integration</h2>
<p>The page component is <code>ToolboxPage</code> in <code>apps/desktop/src/app/Toolbox.tsx</code>. Cantonese strings are in <code>toolboxZh</code> in <code>apps/desktop/src/app/Toolbox.locale.ts</code> and still need to be merged in <code>src/i18n.ts</code>. The renderer bridge is <code>apps/desktop/src/converter-api.ts</code>.</p>
<p>Main process:</p>
<pre><code class="language-js">const { registerConverterIpc } = require("./services/converter.cjs");
registerConverterIpc({ ipcMain, app, dialog, trusted, getWindow: () =&gt; window });
</code></pre>
<p>Preload (inside the frozen <code>materialBrowser</code> object; <code>webUtils</code> comes from <code>require("electron")</code>):</p>
<pre><code class="language-js">converter: (operation, params = {}) =&gt; ipcRenderer.invoke("material:converter", operation, params),
pathForFile: (file) =&gt; webUtils.getPathForFile(file),
</code></pre>
<p>The IPC channel <code>material:converter</code> accepts <code>capabilities</code>, <code>status</code>, <code>choose-files</code>, <code>inspect</code>, <code>choose-folder</code>, <code>enqueue</code>, <code>cancel</code>, <code>clear</code> and <code>reveal</code> from the trusted renderer frame only.</p>
<h2 id="not-verified">Not verified</h2>
<ul>
<li>Image conversion has not been run: the automated tests run under plain Node.js without Electron, so <code>nativeImage</code> decoding, encoding, resizing and the image check are untested.</li>
<li>The page has not been rendered in the running application, and no screenshot has been taken; it is not yet reachable from the navigation.</li>
<li>Drag and drop depends on the <code>pathForFile</code> preload entry, which is not yet added.</li>
<li>Hard-link placement has been exercised on Linux only; behaviour on NTFS and on network or removable drives on Windows has not been checked.</li>
<li>Very large CSV files are held in memory as one string while converted; the 25 MB cap bounds this but peak memory has not been measured.</li>
<li>Bookmark parsing has been checked against a hand-written sample, not against exports from each browser.</li>
</ul>
`,text:'# File converter and offline changelog\r\n\r\nThe Toolbox page puts a local file converter and the release changelog side by side. The layout, components and copy follow the approved artboard `design/remaining-features/Toolbox.dc.html`.\r\n\r\n## File converter\r\n\r\nConversions run inside the Electron main process using only what ships with the application. No file is uploaded and no external program is started; the service does not use `child_process` and never looks for tools on `PATH`.\r\n\r\n| Category | Inputs | Outputs | How |\r\n| --- | --- | --- | --- |\r\n| Images | PNG, JPEG | PNG, JPEG, optional resize by width (aspect ratio kept) | Electron `nativeImage` |\r\n| Data | CSV | JSON (pretty or minified) | RFC 4180 parser in plain JavaScript |\r\n| Data | JSON | CSV, pretty JSON, minified JSON | Plain JavaScript |\r\n| Data | Netscape bookmark HTML (`.html`, `.htm`) | JSON folder tree | Plain JavaScript |\r\n| Documents | PDF, Word, OpenDocument, text and others | None | Shown as "Unavailable: no bundled converter in this build" |\r\n| Audio and video | MP3, WAV, MP4, MOV and others | None | Shown as unavailable in the same way |\r\n\r\nWebP output is not offered, because `nativeImage` cannot encode it. The artboard\'s sample row "photo.png \u2192 WebP" is therefore shown in the build as a PNG or JPEG target instead.\r\n\r\n### Choosing files and the output folder\r\n\r\nFiles are chosen with the native open dialog or dropped onto the drop area. Only absolute paths cross the IPC bridge; the renderer never sends file contents. Dropped files are resolved to paths through `webUtils.getPathForFile`, which the preload must expose as `pathForFile` (see Integration). The first conversion asks for an output folder with the native folder dialog; it can be changed at any time.\r\n\r\n### Queue\r\n\r\n- One file is converted at a time. Queued jobs hold only a path and options, so memory use does not grow with the queue length.\r\n- Each file is checked against a size cap before it is read: 50 MB for images, 25 MB for data files. Larger files fail with "The file is larger than the limit for its category".\r\n- A queued job can be canceled at once. A running job stops at the next stage boundary (reading, converting, writing, checking) and anything it had written is removed.\r\n- Output is written to a temporary file in the chosen folder, then moved into place with a hard link that fails if the name is taken, so an existing file is never replaced. Names are taken as `name.ext`, then `name (1).ext`, `name (2).ext` and so on. On file systems without hard links, the service checks the name and then renames.\r\n- After writing, the output is read back from disk and checked before the job is marked done: images must decode to the expected dimensions, JSON must parse and have the expected row count (or match the input exactly for reformatting), CSV must parse to the expected number of records, and bookmark JSON must contain every bookmark. A file that fails the check is removed and the job is marked failed.\r\n\r\n### CSV rules\r\n\r\n- Fields are separated by commas; records by CRLF, LF or CR. A final line break does not add a record. A leading byte order mark is ignored.\r\n- Quoted fields may contain commas, doubled quotes and line breaks.\r\n- An unclosed quote, or text after a closing quote, is an error.\r\n- The first record is the header. Empty header names become `columnN`; repeated names get `_2`, `_3` suffixes. A record with a different number of fields from the header is an error rather than being padded or cut. Blank lines between records are skipped.\r\n- CSV output uses CRLF line breaks and quotes fields that contain commas, quotes, line breaks or leading or trailing spaces. JSON to CSV accepts an array of objects (columns in first-seen key order) or an array of arrays.\r\n- Data files must be UTF-8.\r\n\r\n## Changelog\r\n\r\nThe changelog is read from `apps/desktop/assets/changelog.json`, which is bundled into the renderer at build time, so the page works offline. Releases are listed newest first. The release matching the running version is highlighted with the "This version" overline and a filled icon. The search bar is the shared `SearchBar` with the regex builder, and matches version, date, summary and notes.\r\n\r\n`scripts/build-changelog.mjs` regenerates `changelog.json` from `CHANGELOG.md` at the repository root (Keep a Changelog headings such as `## [1.2.0] - 2026-11-01`). The repository has no such file yet, so the script currently keeps the shipped `changelog.json` and only checks that it has an entry for the current `apps/desktop/package.json` version. It does not read git history or the network.\r\n\r\nThe shipped file has a single entry for version 0.1.1 with no date, because no earlier release notes are recorded in this repository.\r\n\r\n## Integration\r\n\r\nThe page component is `ToolboxPage` in `apps/desktop/src/app/Toolbox.tsx`. Cantonese strings are in `toolboxZh` in `apps/desktop/src/app/Toolbox.locale.ts` and still need to be merged in `src/i18n.ts`. The renderer bridge is `apps/desktop/src/converter-api.ts`.\r\n\r\nMain process:\r\n\r\n```js\r\nconst { registerConverterIpc } = require("./services/converter.cjs");\r\nregisterConverterIpc({ ipcMain, app, dialog, trusted, getWindow: () => window });\r\n```\r\n\r\nPreload (inside the frozen `materialBrowser` object; `webUtils` comes from `require("electron")`):\r\n\r\n```js\r\nconverter: (operation, params = {}) => ipcRenderer.invoke("material:converter", operation, params),\r\npathForFile: (file) => webUtils.getPathForFile(file),\r\n```\r\n\r\nThe IPC channel `material:converter` accepts `capabilities`, `status`, `choose-files`, `inspect`, `choose-folder`, `enqueue`, `cancel`, `clear` and `reveal` from the trusted renderer frame only.\r\n\r\n## Not verified\r\n\r\n- Image conversion has not been run: the automated tests run under plain Node.js without Electron, so `nativeImage` decoding, encoding, resizing and the image check are untested.\r\n- The page has not been rendered in the running application, and no screenshot has been taken; it is not yet reachable from the navigation.\r\n- Drag and drop depends on the `pathForFile` preload entry, which is not yet added.\r\n- Hard-link placement has been exercised on Linux only; behaviour on NTFS and on network or removable drives on Windows has not been checked.\r\n- Very large CSV files are held in memory as one string while converted; the 25 MB cap bounds this but peak memory has not been measured.\r\n- Bookmark parsing has been checked against a hand-written sample, not against exports from each browser.\r\n'},{id:"docs/features/desktop/focus-modes-and-appearance.md",title:"Focus modes and the appearance editor",category:"features",html:`<h1 id="focus-modes-and-the-appearance-editor">Focus modes and the appearance editor</h1>
<p>Design source: <code>design/remaining-features/Personalize.dc.html</code> (see <code>design/remaining-features/HANDOFF.md</code>).
Code lives in <code>apps/desktop/src/app/</code>.</p>
<h2 id="focus-modes">Focus modes</h2>
<p><code>FocusModesProvider</code> (<code>focus-modes.tsx</code>) holds four independent modes, saves them in
<code>localStorage</code> under <code>focus-modes.v1</code> and applies them as attributes on <code>&lt;html&gt;</code>. Styles are in
<code>focus-modes.css</code>. Reading or writing storage is wrapped in <code>try</code>/<code>catch</code>; if storage is
unavailable the modes still work for the session. The pure helpers (normalisation, bounds,
timer state) are in <code>focus-modes-model.mjs</code>.</p>
<table>
<thead>
<tr>
<th>Mode</th>
<th>Attribute</th>
<th>Behaviour</th>
</tr>
</thead>
<tbody>
<tr>
<td>Calm screen</td>
<td><code>data-focus-calm</code></td>
<td>Hides <code>.badge</code> elements and notification toasts with <code>role="status"</code>; error toasts (<code>role="alert"</code>) and the action snackbar stay. Turns off all animation and transition. Hidden notifications remain in the notification list.</td>
</tr>
<tr>
<td>One thing at a time</td>
<td><code>data-focus-one-thing</code></td>
<td>The last pane (<code>.pane</code>) that received focus or a pointer press gets <code>data-focus-current</code>; other panes are dimmed until hovered or focused.</td>
</tr>
<tr>
<td>Break it into steps</td>
<td><code>data-focus-steps</code></td>
<td>Exposes a flag only. Forms read it with <code>useBreakIntoSteps()</code> (React) or <code>breakIntoStepsEnabled()</code> (plain code). No form adopts it yet.</td>
</tr>
<tr>
<td>Gentle timer</td>
<td><code>data-focus-timer</code></td>
<td><code>FocusTimerStatus</code> shows a silent work and break countdown with pause and reset buttons. Work length is 5 to 90 minutes in steps of 5 (default 25); break length is 1 to 30 minutes in steps of 1 (default 5). Both are bounded steppers. Timer progress is not persisted across restarts.</td>
</tr>
</tbody>
</table>
<h2 id="appearance-editor">Appearance editor</h2>
<p>Any element can opt in with <code>data-appearance-id="some-id"</code> (letters, digits, <code>_ . : -</code>, up to
64 characters) and an optional <code>data-appearance-label</code>. Seven built-in groups need no
attribute: primary buttons, tonal buttons, panes, list rows, text fields, the navigation rail and
the status bar.</p>
<p>Each element can override background colour, text colour, corner radius (0 to 28 px stepper) and
size (80 to 150 percent slider, applied with CSS <code>zoom</code>). Overrides are saved in <code>localStorage</code>
under <code>appearance.elements.v1</code> and applied through one generated <code>&lt;style id="appearance-elements"&gt;</code>
element. "Reset this element" removes one override; "Reset all elements" asks for confirmation and
removes every override. Pure rules are in <code>appearance-elements-model.mjs</code>.</p>
<p><code>AppearanceContextMenu</code> listens for <code>contextmenu</code> on the document and for Shift+F10 or the
ContextMenu key on the focused element. When the target or an ancestor has
<code>data-appearance-id</code> (or matches a built-in group) it offers "Customize appearance", which
opens the editor in a dialog. Text fields, open dialogs and menus, selected text, and handlers
that already called <code>preventDefault()</code> (such as the profile list menu) are left alone.</p>
<h2 id="colour-picker-and-translations">Colour picker and translations</h2>
<p><code>ColourPicker</code> (<code>personalize-controls.tsx</code>) has a saturation and brightness area and a hue bar.
Both are focusable sliders: arrow keys move by 1, Shift with an arrow by 10, Home and End (and
Page Up and Page Down on the area) jump to the edges. The hex field accepts 3 or 6 digits and
shows an error for anything else; on blur an invalid entry reverts. The colour is shown as rgb,
hsl and oklch, and the contrast ratio against the element's other colour is shown with pass or
fail at 4.5 to 1. All maths is in <code>colour.mjs</code>.</p>
<h2 id="info-icons">Info icons</h2>
<p><code>InfoIcon</code> is an icon button named "About &lt;control&gt;" that opens a short dialog. Each control on
the page has its own explanation.</p>
<h2 id="wiring">Wiring</h2>
<p><code>Personalize.tsx</code> exports <code>PersonalizePage</code>, <code>FocusModesProvider</code>, <code>FocusTimerStatus</code>,
<code>AppearanceContextMenu</code>, <code>InfoIcon</code>, <code>useBreakIntoSteps</code> and <code>breakIntoStepsEnabled</code>. Cantonese
strings are in <code>Personalize.locale.ts</code> (<code>personalizeZh</code>) and must be merged in <code>src/i18n.ts</code>.</p>
<h2 id="tests">Tests</h2>
<p><code>colour.test.mjs</code>, <code>focus-modes.test.mjs</code> and <code>appearance-elements-model.test.mjs</code> cover the pure
modules. Run <code>node --test src/app/colour.test.mjs src/app/focus-modes.test.mjs</code> from
<code>apps/desktop</code>.</p>
<h2 id="verified-repairs-and-remaining-acceptance">Verified repairs and remaining acceptance</h2>
<p>The components are connected to the shell and localization. At source
<code>47e8ae104755d38e9d115fbb08636143bc6278cb</code>, the exact Desktop build was exercised on a
hidden Windows desktop with isolated application data. Four inspected, unchanged images
and their publication inventory are in <a href="#/article/docs%2Fevidence%2Fdesktop%2Frepair-20261101%2FREADME.md">the repair evidence</a>.</p>
<ul>
<li>A saved red primary-button override applied after a cold process start, including the locked screen.</li>
<li>Injected write/removal failures produced visible session-only feedback and retry controls.
A failed initial storage read prevents overwriting the unread durable record.</li>
<li>The contrast display reported unavailable for a pane whose actual computed opacity was 0.38.
Partial-alpha colors are preserved and composited only when the solid backdrop is known.</li>
<li>A real CDP pointer interaction reached hue 359 with an accessible maximum and value of 359.</li>
</ul>
<p>These images use a 1280 by 1200 page viewport at an observed device-pixel ratio close to 1.
They do not establish physical display-scale coverage or screen-reader output. Source tests
also cover normalization, failed writes/removals and cold storage-read protection. Malformed
stored JSON normalization is an existing behavior outside the storage-exception repair.</p>
<p>Still unverified:</p>
<ul>
<li>Complete minimum-layout, theme, language and physical display-scale matrices. The known
minimum-width defect remains tracked in <a href="https://github.com/Ding-Ding-Projects/material-browser/issues/10">issue 10</a>.</li>
<li>Every context-menu target, keyboard-only workflow and appearance size combination.</li>
<li>Calm screen hides notification toasts by matching their current markup in <code>Live.tsx</code>
(a <code>.snack</code> whose first child is an icon). A change to that markup would need the selector updated.</li>
<li>Overrides use <code>!important</code> and can lose to inline styles set by components.</li>
<li>Screen reader output for the two-dimensional colour area was not tested.</li>
</ul>
`,text:'# Focus modes and the appearance editor\r\n\r\nDesign source: `design/remaining-features/Personalize.dc.html` (see `design/remaining-features/HANDOFF.md`).\r\nCode lives in `apps/desktop/src/app/`.\r\n\r\n## Focus modes\r\n\r\n`FocusModesProvider` (`focus-modes.tsx`) holds four independent modes, saves them in\r\n`localStorage` under `focus-modes.v1` and applies them as attributes on `<html>`. Styles are in\r\n`focus-modes.css`. Reading or writing storage is wrapped in `try`/`catch`; if storage is\r\nunavailable the modes still work for the session. The pure helpers (normalisation, bounds,\r\ntimer state) are in `focus-modes-model.mjs`.\r\n\r\n| Mode | Attribute | Behaviour |\r\n| --- | --- | --- |\r\n| Calm screen | `data-focus-calm` | Hides `.badge` elements and notification toasts with `role="status"`; error toasts (`role="alert"`) and the action snackbar stay. Turns off all animation and transition. Hidden notifications remain in the notification list. |\r\n| One thing at a time | `data-focus-one-thing` | The last pane (`.pane`) that received focus or a pointer press gets `data-focus-current`; other panes are dimmed until hovered or focused. |\r\n| Break it into steps | `data-focus-steps` | Exposes a flag only. Forms read it with `useBreakIntoSteps()` (React) or `breakIntoStepsEnabled()` (plain code). No form adopts it yet. |\r\n| Gentle timer | `data-focus-timer` | `FocusTimerStatus` shows a silent work and break countdown with pause and reset buttons. Work length is 5 to 90 minutes in steps of 5 (default 25); break length is 1 to 30 minutes in steps of 1 (default 5). Both are bounded steppers. Timer progress is not persisted across restarts. |\r\n\r\n## Appearance editor\r\n\r\nAny element can opt in with `data-appearance-id="some-id"` (letters, digits, `_ . : -`, up to\r\n64 characters) and an optional `data-appearance-label`. Seven built-in groups need no\r\nattribute: primary buttons, tonal buttons, panes, list rows, text fields, the navigation rail and\r\nthe status bar.\r\n\r\nEach element can override background colour, text colour, corner radius (0 to 28 px stepper) and\r\nsize (80 to 150 percent slider, applied with CSS `zoom`). Overrides are saved in `localStorage`\r\nunder `appearance.elements.v1` and applied through one generated `<style id="appearance-elements">`\r\nelement. "Reset this element" removes one override; "Reset all elements" asks for confirmation and\r\nremoves every override. Pure rules are in `appearance-elements-model.mjs`.\r\n\r\n`AppearanceContextMenu` listens for `contextmenu` on the document and for Shift+F10 or the\r\nContextMenu key on the focused element. When the target or an ancestor has\r\n`data-appearance-id` (or matches a built-in group) it offers "Customize appearance", which\r\nopens the editor in a dialog. Text fields, open dialogs and menus, selected text, and handlers\r\nthat already called `preventDefault()` (such as the profile list menu) are left alone.\r\n\r\n## Colour picker and translations\r\n\r\n`ColourPicker` (`personalize-controls.tsx`) has a saturation and brightness area and a hue bar.\r\nBoth are focusable sliders: arrow keys move by 1, Shift with an arrow by 10, Home and End (and\r\nPage Up and Page Down on the area) jump to the edges. The hex field accepts 3 or 6 digits and\r\nshows an error for anything else; on blur an invalid entry reverts. The colour is shown as rgb,\r\nhsl and oklch, and the contrast ratio against the element\'s other colour is shown with pass or\r\nfail at 4.5 to 1. All maths is in `colour.mjs`.\r\n\r\n## Info icons\r\n\r\n`InfoIcon` is an icon button named "About <control>" that opens a short dialog. Each control on\r\nthe page has its own explanation.\r\n\r\n## Wiring\r\n\r\n`Personalize.tsx` exports `PersonalizePage`, `FocusModesProvider`, `FocusTimerStatus`,\r\n`AppearanceContextMenu`, `InfoIcon`, `useBreakIntoSteps` and `breakIntoStepsEnabled`. Cantonese\r\nstrings are in `Personalize.locale.ts` (`personalizeZh`) and must be merged in `src/i18n.ts`.\r\n\r\n## Tests\r\n\r\n`colour.test.mjs`, `focus-modes.test.mjs` and `appearance-elements-model.test.mjs` cover the pure\r\nmodules. Run `node --test src/app/colour.test.mjs src/app/focus-modes.test.mjs` from\r\n`apps/desktop`.\r\n\r\n## Verified repairs and remaining acceptance\r\n\r\nThe components are connected to the shell and localization. At source\r\n`47e8ae104755d38e9d115fbb08636143bc6278cb`, the exact Desktop build was exercised on a\r\nhidden Windows desktop with isolated application data. Four inspected, unchanged images\r\nand their publication inventory are in [the repair evidence](../../evidence/desktop/repair-20261101/README.md).\r\n\r\n- A saved red primary-button override applied after a cold process start, including the locked screen.\r\n- Injected write/removal failures produced visible session-only feedback and retry controls.\r\n  A failed initial storage read prevents overwriting the unread durable record.\r\n- The contrast display reported unavailable for a pane whose actual computed opacity was 0.38.\r\n  Partial-alpha colors are preserved and composited only when the solid backdrop is known.\r\n- A real CDP pointer interaction reached hue 359 with an accessible maximum and value of 359.\r\n\r\nThese images use a 1280 by 1200 page viewport at an observed device-pixel ratio close to 1.\r\nThey do not establish physical display-scale coverage or screen-reader output. Source tests\r\nalso cover normalization, failed writes/removals and cold storage-read protection. Malformed\r\nstored JSON normalization is an existing behavior outside the storage-exception repair.\r\n\r\nStill unverified:\r\n\r\n- Complete minimum-layout, theme, language and physical display-scale matrices. The known\r\n  minimum-width defect remains tracked in [issue 10](https://github.com/Ding-Ding-Projects/material-browser/issues/10).\r\n- Every context-menu target, keyboard-only workflow and appearance size combination.\r\n- Calm screen hides notification toasts by matching their current markup in `Live.tsx`\r\n  (a `.snack` whose first child is an icon). A change to that markup would need the selector updated.\r\n- Overrides use `!important` and can lose to inline styles set by components.\r\n- Screen reader output for the two-dimensional colour area was not tested.\r\n'},{id:"docs/features/desktop/font-delivery.md",title:"Bundled desktop font delivery",category:"features",html:`<h1 id="bundled-desktop-font-delivery">Bundled desktop font delivery</h1>
<p>The desktop keeps its existing <code>font-src 'self'</code> policy. Production builds emit bundled
fonts as local asset files instead of embedding small fonts as data URLs. This lets the
browser load the same pinned font bytes without relaxing the content security policy or
requiring an external font service.</p>
<p>The original defect affected eight generated CSS references to six small bundled font files.
Their inline representation conflicted with the policy. That does not establish that every
displayed font failed or that visible glyph changes occurred.</p>
<h2 id="verify-a-development-build">Verify a development build</h2>
<ol>
<li>Run the exact root <code>build.bat -Component Desktop</code> entrypoint.</li>
<li>Run <code>node scripts/check-desktop-font-assets.mjs</code> against that completed output.</li>
<li>Inspect actual application startup and the relevant language states for font resource or
CSP failures. Source output checks do not establish browser loading or visual fidelity.</li>
</ol>
<p>Run the local positive/negative regression suite with
<code>node --test scripts/check-desktop-font-assets.test.mjs</code> after the declared development
dependencies are installed by the build entrypoint.</p>
<p>The local checker inspects emitted CSS stylesheets, rejects font data URLs and external references, requires contained emitted
files, and matches their SHA-256 values to the declared installed font packages. It also checks
that the built HTML retains the expected self-only policy. <code>--dist &lt;directory&gt;</code> supports an
isolated copy of the built output for negative verification; it does not change product files.
The six affected font identities have an independent reviewed inventory, so deleting their
CSS declarations cannot turn the delivery check green. HTML and CSS structure are parsed;
meta-looking text in scripts/templates/comments and uppercase font rules are tested separately.
Unsupported escaped source syntax is rejected explicitly. This is static-output verification,
not analysis of arbitrary runtime-generated styles.</p>
<p>The check was first run against the affected output and rejected its inline font reference.
Post-repair build, startup, layout and negative-byte results are recorded separately. No tests
or lint were added to hosted build workflows by this repair.</p>
<h2 id="executed-current-result">Executed current result</h2>
<p>Source <code>62563ae1626f966bd063ce0e38c53353de84ba22</code> passed the exact Desktop build and the
checker: 267 declarations, 303 references, 188 emitted font files and all six required
identities matched their source bytes. All 13 checked-in positive/negative CLI cases passed.
Cached diagnostics and fully observed English/bilingual renderer reloads recorded zero
font-policy blocks, exceptions or resource failures; observed font responses were local
files with successful status. This does not claim observation of every native process-start
event, all glyphs, physical display scaling or complete visual parity. See the
<a href="#/article/docs%2Ffeatures%2Facceptance%2F2026-11-01-defect-verification.md">verification report</a> and its source-bound images.</p>
`,text:`# Bundled desktop font delivery

The desktop keeps its existing \`font-src 'self'\` policy. Production builds emit bundled
fonts as local asset files instead of embedding small fonts as data URLs. This lets the
browser load the same pinned font bytes without relaxing the content security policy or
requiring an external font service.

The original defect affected eight generated CSS references to six small bundled font files.
Their inline representation conflicted with the policy. That does not establish that every
displayed font failed or that visible glyph changes occurred.

## Verify a development build

1. Run the exact root \`build.bat -Component Desktop\` entrypoint.
2. Run \`node scripts/check-desktop-font-assets.mjs\` against that completed output.
3. Inspect actual application startup and the relevant language states for font resource or
   CSP failures. Source output checks do not establish browser loading or visual fidelity.

Run the local positive/negative regression suite with
\`node --test scripts/check-desktop-font-assets.test.mjs\` after the declared development
dependencies are installed by the build entrypoint.

The local checker inspects emitted CSS stylesheets, rejects font data URLs and external references, requires contained emitted
files, and matches their SHA-256 values to the declared installed font packages. It also checks
that the built HTML retains the expected self-only policy. \`--dist <directory>\` supports an
isolated copy of the built output for negative verification; it does not change product files.
The six affected font identities have an independent reviewed inventory, so deleting their
CSS declarations cannot turn the delivery check green. HTML and CSS structure are parsed;
meta-looking text in scripts/templates/comments and uppercase font rules are tested separately.
Unsupported escaped source syntax is rejected explicitly. This is static-output verification,
not analysis of arbitrary runtime-generated styles.

The check was first run against the affected output and rejected its inline font reference.
Post-repair build, startup, layout and negative-byte results are recorded separately. No tests
or lint were added to hosted build workflows by this repair.

## Executed current result

Source \`62563ae1626f966bd063ce0e38c53353de84ba22\` passed the exact Desktop build and the
checker: 267 declarations, 303 references, 188 emitted font files and all six required
identities matched their source bytes. All 13 checked-in positive/negative CLI cases passed.
Cached diagnostics and fully observed English/bilingual renderer reloads recorded zero
font-policy blocks, exceptions or resource failures; observed font responses were local
files with successful status. This does not claim observation of every native process-start
event, all glyphs, physical display scaling or complete visual parity. See the
[verification report](../acceptance/2026-11-01-defect-verification.md) and its source-bound images.
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
`},{id:"docs/features/desktop/minecraft-server-manager.md",title:"Minecraft server manager",category:"features",html:`<h1 id="minecraft-server-manager">Minecraft server manager</h1>
<p>The active Servers workspace uses <code>apps/desktop/src/app/servers/</code> and the trusted
<code>material:game-servers</code> bridge. Its single lifecycle and registry authority is
<code>apps/desktop/electron/services/game-servers/</code>. See the <a href="#/article/docs%2Ffeatures%2Fservers%2FREADME.md">implementation and acceptance
record</a> for the current operation contract.</p>
<p>Incoming catalogue, typed configuration and content modules under <code>electron/minecraft/</code>
are retained for reviewed consolidation. Their independent service is not registered.
The incoming GUI source is also preserved but is not a second active server destination.</p>
<h2 id="available-implementation">Available implementation</h2>
<p>The workspace provides catalogue search, target filtering, guided creation with explicit
EULA consent, provider selection, configuration, logs, start/stop/restart, and local
backup/data-pack workflows. Provider selections bind exact resolved versions. Fabric
installation separately requires acknowledgement that its launcher lacks a published
checksum; a locally computed hash is not publisher verification.</p>
<p>Four target adapters exist: a local Java process, local Docker, SSH process, and Docker
over SSH. Remote targets require existing trusted host keys and configured authentication.
Managed process receipts retain unknown/disconnected state after interrupted ownership.
A spawned process remains starting until readiness is proven. Container runtime references
are immutable digests. Only owned processes may receive lifecycle actions.</p>
<p>Configuration uses version-bound typed descriptors, preserves unknown keys without showing
protected unknown values, and applies supported edits while stopped. Duplicate property
entries and Unicode-escaped keys are handled consistently. Unknown historical/snapshot
schemas do not inherit invented modern defaults.</p>
<p>Local backups verify file hashes and retain rollback data. Restoration rejects invalid
manifest roots, stages replacements and rolls back partial promotions. Remote-world
transfer is not enabled by the local backup implementation.</p>
<h2 id="acceptance-status">Acceptance status</h2>
<p>Source and fixture tests are distinct from live operation. Real server startup, EULA
acceptance, all four target lifecycles, exhaustive version compatibility, keyboard/layout
acceptance and final installed delivery remain unverified. Bedrock, broad player/plugin
workflows, readiness/metrics, schedules, remote-world transfer and offline catalogue cache
consolidation remain unfinished. The <a href="#/article/docs%2Ffeatures%2Facceptance%2FREADME.md">acceptance ledger</a> retains
these gaps. No second backend, historical screenshot or passing unit test proves them.</p>
<h2 id="world-generator">World generator</h2>
<p>Generate a world opens from the Servers page through its own trusted <code>material:worldgen</code> channel (<code>apps/desktop/electron/worldgen-ipc.cjs</code>) and follows the <code>WorldGenerator</code> artboard. For the
chosen Java release it downloads and verifies that version's server jar once, runs Mojang's data
generator (<code>--reports</code>, which does not start a server) and reads the jar's own <code>data/minecraft</code>
folders, so every picker (world presets, biomes, structure sets, superflat presets, blocks and
typed game rules) comes from that exact version. Versions without data-driven world presets say so
and offer nothing they cannot honour.</p>
<ul>
<li><strong>Size:</strong> defaults to 100 x 100 chunks centred on spawn. A drawing canvas on a chunk grid lets
the user draw, move and resize the area with a pointer or the keyboard (arrows move, Shift with
arrows resizes), kept in sync with width and depth steppers. The readout shows blocks, chunks and
the number of 16 x 16 chunk batches. The world border can follow the area.</li>
<li><strong>Customization:</strong> seed, world type, superflat layer editor with block pickers, heights,
reordering and the version's presets, biome, features and lakes, structure sets, single-biome
picker, sea level, aquifers, ore veins, first-generation animals, main block and sea fluid,
world height, lowest Y and logical height (validated in steps of 16), every game rule with a
switch or stepper by its declared type, difficulty and hardcore.</li>
<li><strong>Generation:</strong> a private data pack holds the world preset, noise settings and dimension type.
The version's server runs once in a private folder on a loopback port after the user switches on
EULA acceptance, applies the game rules and world border, then loads the area batch by batch
with <code>forceload</code> (never more than 256 chunks at a time), checking every corner of each batch
before moving on, and saves and stops.</li>
<li><strong>Output:</strong> Folder or ZIP file, chosen with a native Browse dialog. Existing files are never
replaced. A folder copy is compared file by file with a SHA-256 digest; a ZIP is reopened and
every entry's size and CRC is checked.</li>
</ul>
<p>Verified for the generator: 8 focused tests (archive round trip and corruption, pickers read from
the jar, unsupported versions, the 100 x 100 default, batch limits and coverage, validation, the
data pack, and a full generation run with a stand-in server for both ZIP and folder output);
extraction against the real 1.21.4 jar (65 biomes, 20 structure sets, 5 presets, 1095 blocks,
53 game rules); a written ZIP passes <code>unzip -t</code>. Not verified: a real generation run, because that
needs the user's EULA acceptance, and whether every custom setting combination loads in every
version.</p>
`,text:`# Minecraft server manager\r
\r
The active Servers workspace uses \`apps/desktop/src/app/servers/\` and the trusted\r
\`material:game-servers\` bridge. Its single lifecycle and registry authority is\r
\`apps/desktop/electron/services/game-servers/\`. See the [implementation and acceptance\r
record](../servers/README.md) for the current operation contract.\r
\r
Incoming catalogue, typed configuration and content modules under \`electron/minecraft/\`\r
are retained for reviewed consolidation. Their independent service is not registered.\r
The incoming GUI source is also preserved but is not a second active server destination.\r
\r
## Available implementation\r
\r
The workspace provides catalogue search, target filtering, guided creation with explicit\r
EULA consent, provider selection, configuration, logs, start/stop/restart, and local\r
backup/data-pack workflows. Provider selections bind exact resolved versions. Fabric\r
installation separately requires acknowledgement that its launcher lacks a published\r
checksum; a locally computed hash is not publisher verification.\r
\r
Four target adapters exist: a local Java process, local Docker, SSH process, and Docker\r
over SSH. Remote targets require existing trusted host keys and configured authentication.\r
Managed process receipts retain unknown/disconnected state after interrupted ownership.\r
A spawned process remains starting until readiness is proven. Container runtime references\r
are immutable digests. Only owned processes may receive lifecycle actions.\r
\r
Configuration uses version-bound typed descriptors, preserves unknown keys without showing\r
protected unknown values, and applies supported edits while stopped. Duplicate property\r
entries and Unicode-escaped keys are handled consistently. Unknown historical/snapshot\r
schemas do not inherit invented modern defaults.\r
\r
Local backups verify file hashes and retain rollback data. Restoration rejects invalid\r
manifest roots, stages replacements and rolls back partial promotions. Remote-world\r
transfer is not enabled by the local backup implementation.\r
\r
## Acceptance status\r
\r
Source and fixture tests are distinct from live operation. Real server startup, EULA\r
acceptance, all four target lifecycles, exhaustive version compatibility, keyboard/layout\r
acceptance and final installed delivery remain unverified. Bedrock, broad player/plugin\r
workflows, readiness/metrics, schedules, remote-world transfer and offline catalogue cache\r
consolidation remain unfinished. The [acceptance ledger](../acceptance/README.md) retains\r
these gaps. No second backend, historical screenshot or passing unit test proves them.\r
\r
## World generator\r
\r
Generate a world opens from the Servers page through its own trusted \`material:worldgen\` channel (\`apps/desktop/electron/worldgen-ipc.cjs\`) and follows the \`WorldGenerator\` artboard. For the\r
chosen Java release it downloads and verifies that version's server jar once, runs Mojang's data\r
generator (\`--reports\`, which does not start a server) and reads the jar's own \`data/minecraft\`\r
folders, so every picker (world presets, biomes, structure sets, superflat presets, blocks and\r
typed game rules) comes from that exact version. Versions without data-driven world presets say so\r
and offer nothing they cannot honour.\r
\r
- **Size:** defaults to 100 x 100 chunks centred on spawn. A drawing canvas on a chunk grid lets\r
  the user draw, move and resize the area with a pointer or the keyboard (arrows move, Shift with\r
  arrows resizes), kept in sync with width and depth steppers. The readout shows blocks, chunks and\r
  the number of 16 x 16 chunk batches. The world border can follow the area.\r
- **Customization:** seed, world type, superflat layer editor with block pickers, heights,\r
  reordering and the version's presets, biome, features and lakes, structure sets, single-biome\r
  picker, sea level, aquifers, ore veins, first-generation animals, main block and sea fluid,\r
  world height, lowest Y and logical height (validated in steps of 16), every game rule with a\r
  switch or stepper by its declared type, difficulty and hardcore.\r
- **Generation:** a private data pack holds the world preset, noise settings and dimension type.\r
  The version's server runs once in a private folder on a loopback port after the user switches on\r
  EULA acceptance, applies the game rules and world border, then loads the area batch by batch\r
  with \`forceload\` (never more than 256 chunks at a time), checking every corner of each batch\r
  before moving on, and saves and stops.\r
- **Output:** Folder or ZIP file, chosen with a native Browse dialog. Existing files are never\r
  replaced. A folder copy is compared file by file with a SHA-256 digest; a ZIP is reopened and\r
  every entry's size and CRC is checked.\r
\r
Verified for the generator: 8 focused tests (archive round trip and corruption, pickers read from\r
the jar, unsupported versions, the 100 x 100 default, batch limits and coverage, validation, the\r
data pack, and a full generation run with a stand-in server for both ZIP and folder output);\r
extraction against the real 1.21.4 jar (65 biomes, 20 structure sets, 5 presets, 1095 blocks,\r
53 game rules); a written ZIP passes \`unzip -t\`. Not verified: a real generation run, because that\r
needs the user's EULA acceptance, and whether every custom setting combination loads in every\r
version.\r
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
`},{id:"docs/features/desktop/ollama-suite.md",title:"Local Ollama suite",category:"features",html:`<h1 id="local-ollama-suite">Local Ollama suite</h1>
<p>The Local models page manages a local <a href="https://ollama.com">Ollama</a> installation: install it, start it, browse the public model library with a hardware fit verdict for each tag, pull models through a free queue and chat with installed models. The layout follows <code>design/remaining-features/Ollama.dc.html</code>.</p>
<p>The renderer page is <code>apps/desktop/src/app/Ollama.tsx</code> (<code>OllamaPage</code>), the typed bridge is <code>apps/desktop/src/ollama-api.ts</code> and the main-process service is <code>apps/desktop/electron/services/ollama.cjs</code>, registered on the IPC channel <code>material:ollama</code>. Streaming progress arrives on <code>material:event</code> with types <code>ollama.queue</code>, <code>ollama.chat</code>, <code>ollama.installer</code> and <code>ollama.catalogue</code>.</p>
<h2 id="network-access">Network access</h2>
<p>The service talks to three places only:</p>
<ul>
<li>Ollama's documented local HTTP API at <code>http://127.0.0.1:11434</code>: <code>GET /api/version</code>, <code>/api/tags</code>, <code>/api/ps</code>; <code>POST /api/show</code>, <code>/api/pull</code> (streaming), <code>/api/chat</code> (streaming); <code>DELETE /api/delete</code>.</li>
<li>The GitHub releases API for <code>ollama/ollama</code> (<code>/repos/ollama/ollama/releases/latest</code>) and that release's own download URLs.</li>
<li>The public library pages at <code>https://ollama.com/library</code> and <code>https://ollama.com/library/&lt;model&gt;/tags</code>.</li>
</ul>
<p>Every IPC payload is limited to 512 KB, every JSON answer from Ollama to 4 MB, every streamed line to 256 KB and every library page to 8 MB. Model names must match a strict pattern (lowercase name, optional single namespace, optional tag of letters, digits, <code>.</code>, <code>_</code> and <code>-</code>) before they are sent anywhere.</p>
<h2 id="states">States</h2>
<p>The status chip and the page keep four states apart:</p>
<table>
<thead>
<tr>
<th>State</th>
<th>Meaning</th>
<th>What the page offers</th>
</tr>
</thead>
<tbody>
<tr>
<td>Running</td>
<td><code>/api/version</code> answers with a version</td>
<td>Store, Installed, Chat and the pull queue</td>
</tr>
<tr>
<td>Installed, not running</td>
<td>Connection refused and <code>ollama.exe</code> exists in the default install folder</td>
<td><strong>Start Ollama</strong></td>
</tr>
<tr>
<td>Not installed</td>
<td>Connection refused and no executable found</td>
<td><strong>Install Ollama</strong></td>
</tr>
<tr>
<td>Not responding</td>
<td>Something answers on port 11434 but not as Ollama does, or the request times out</td>
<td><strong>Check again</strong> with the reason</td>
</tr>
</tbody>
</table>
<p>Ollama is never started by itself. <strong>Start Ollama</strong> runs <code>ollama serve</code> detached and waits up to 15 seconds for <code>/api/version</code>.</p>
<h2 id="installer-windows">Installer (Windows)</h2>
<p><strong>Install Ollama</strong> reads the latest release from the GitHub API and only accepts an asset named exactly <code>OllamaSetup.exe</code> whose download URL starts with <code>https://github.com/ollama/ollama/releases/download/</code>. It then:</p>
<ol>
<li>Takes the expected SHA-256 from the asset's published <code>digest</code> field, or failing that from a <code>sha256sum.txt</code> asset in the same release. If neither exists the hash is recorded as unpublished.</li>
<li>Downloads to <code>&lt;userData&gt;/ollama/installer/OllamaSetup.exe.part</code>, refusing any byte past the published size and requiring the final size to match exactly.</li>
<li>Compares the SHA-256. A mismatch deletes the file. With no published hash the result is shown as <strong>Integrity unverified</strong>.</li>
<li>Shows a confirmation dialog with version, size and hash. The installer runs only after <strong>Run installer</strong> is pressed, and the file is checked again just before it runs. No silent switches are passed, so the official installer shows its own window.</li>
</ol>
<p>Material Browser never changes <code>PATH</code> or any other environment variable.</p>
<h2 id="store">Store</h2>
<p>The Ollama website has no stable JSON catalogue, so the catalogue adapter scrapes the HTML library index for model names, descriptions and capability badges, then each model's tags page for tag names, digests, download sizes and context length. Parsing is isolated in <code>parseLibraryIndex</code> and <code>parseTagsPage</code>; if the index yields no models the catalogue is reported as unavailable rather than guessed. Each catalogue records <code>retrievedAt</code>, the number of pages read, model and tag counts and a complete or incomplete verdict (incomplete when any tags page failed, with the failed models listed). It is cached at <code>&lt;userData&gt;/ollama/catalogue.json</code>. When a refresh fails, the last verified copy is shown with its age and an "offline" note. Installed models from <code>/api/tags</code> are always merged in, so they appear even with no catalogue.</p>
<p>The page shows the cached copy first, then refreshes in the background. About 270 pages are read on a full refresh, four at a time.</p>
<h2 id="hardware-fit">Hardware fit</h2>
<p>Evidence collected: total memory (<code>os.totalmem</code>), free space on the drive that holds the models folder (<code>OLLAMA_MODELS</code> or <code>~/.ollama/models</code>, via <code>fs.statfsSync</code>), and on Windows the graphics adapters from <code>Get-CimInstance Win32_VideoController</code> with <code>wmic path win32_VideoController get AdapterRAM,Name</code> as fallback. <code>AdapterRAM</code> is a 32-bit value, so a reading near 4 GB is shown as "at least".</p>
<p>The verdict uses the download size and those measurements only, never the model name:</p>
<ul>
<li><strong>Unknown</strong> when the size, memory, graphics memory or (for models not yet installed) free disk is missing.</li>
<li><strong>Unlikely</strong> when the download does not fit on the disk, or the estimate does not fit in graphics memory plus half of system memory.</li>
<li><strong>Runs well</strong> when the estimate fits in graphics memory.</li>
<li><strong>Runs with limits</strong> otherwise.</li>
</ul>
<p>The estimate is the download size times 1.2 plus 1 GB. The evidence line under the list shows the measured memory, adapters, graphics memory, free disk and the detection method.</p>
<h2 id="pull-queue">Pull queue</h2>
<p>The queue holds up to 50 items. Pulls run one at a time by default (up to three can be chosen). Each item is Waiting, Pulling, Done, Failed or Stopped. Waiting items can be cancelled; a pull in progress is aborted. A pull that ends without Ollama reporting <code>success</code> is marked Failed. The summary says how many finished, failed and stopped, and that unfinished pulls installed nothing although partly downloaded layers may stay on disk. The queue never shows prices or payment wording.</p>
<h2 id="chat">Chat</h2>
<p>The chat tab picks from installed models, streams tokens from <code>/api/chat</code> and has a <strong>Stop</strong> button that aborts the request. History is kept in memory for the session only and is never written to disk. Messages are limited to 200 per request, 32 000 characters each and 256 KB in total.</p>
<h2 id="not-verified">Not verified</h2>
<ul>
<li>No Windows runtime test was possible. The installer flow, graphics detection through PowerShell and <code>wmic</code>, the default install path <code>%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe</code> and starting <code>ollama serve</code> were tested only with stubs.</li>
<li>The GitHub API was not reachable from the build environment, so whether current releases publish a <code>digest</code> for <code>OllamaSetup.exe</code> was not confirmed. Without one the installer reports integrity as unverified.</li>
<li>The library parser was checked against the live <code>ollama.com/library</code> and one tags page on 2026-11-01. The site can change at any time; the parser then reports the catalogue as unavailable.</li>
<li>No test ran against a real Ollama server; the local API calls were tested with stubbed responses that follow the documented formats.</li>
<li>The fit thresholds are a conservative estimate, not a measurement of actual inference speed.</li>
</ul>
`,text:"# Local Ollama suite\r\n\r\nThe Local models page manages a local [Ollama](https://ollama.com) installation: install it, start it, browse the public model library with a hardware fit verdict for each tag, pull models through a free queue and chat with installed models. The layout follows `design/remaining-features/Ollama.dc.html`.\r\n\r\nThe renderer page is `apps/desktop/src/app/Ollama.tsx` (`OllamaPage`), the typed bridge is `apps/desktop/src/ollama-api.ts` and the main-process service is `apps/desktop/electron/services/ollama.cjs`, registered on the IPC channel `material:ollama`. Streaming progress arrives on `material:event` with types `ollama.queue`, `ollama.chat`, `ollama.installer` and `ollama.catalogue`.\r\n\r\n## Network access\r\n\r\nThe service talks to three places only:\r\n\r\n- Ollama's documented local HTTP API at `http://127.0.0.1:11434`: `GET /api/version`, `/api/tags`, `/api/ps`; `POST /api/show`, `/api/pull` (streaming), `/api/chat` (streaming); `DELETE /api/delete`.\r\n- The GitHub releases API for `ollama/ollama` (`/repos/ollama/ollama/releases/latest`) and that release's own download URLs.\r\n- The public library pages at `https://ollama.com/library` and `https://ollama.com/library/<model>/tags`.\r\n\r\nEvery IPC payload is limited to 512 KB, every JSON answer from Ollama to 4 MB, every streamed line to 256 KB and every library page to 8 MB. Model names must match a strict pattern (lowercase name, optional single namespace, optional tag of letters, digits, `.`, `_` and `-`) before they are sent anywhere.\r\n\r\n## States\r\n\r\nThe status chip and the page keep four states apart:\r\n\r\n| State | Meaning | What the page offers |\r\n| --- | --- | --- |\r\n| Running | `/api/version` answers with a version | Store, Installed, Chat and the pull queue |\r\n| Installed, not running | Connection refused and `ollama.exe` exists in the default install folder | **Start Ollama** |\r\n| Not installed | Connection refused and no executable found | **Install Ollama** |\r\n| Not responding | Something answers on port 11434 but not as Ollama does, or the request times out | **Check again** with the reason |\r\n\r\nOllama is never started by itself. **Start Ollama** runs `ollama serve` detached and waits up to 15 seconds for `/api/version`.\r\n\r\n## Installer (Windows)\r\n\r\n**Install Ollama** reads the latest release from the GitHub API and only accepts an asset named exactly `OllamaSetup.exe` whose download URL starts with `https://github.com/ollama/ollama/releases/download/`. It then:\r\n\r\n1. Takes the expected SHA-256 from the asset's published `digest` field, or failing that from a `sha256sum.txt` asset in the same release. If neither exists the hash is recorded as unpublished.\r\n2. Downloads to `<userData>/ollama/installer/OllamaSetup.exe.part`, refusing any byte past the published size and requiring the final size to match exactly.\r\n3. Compares the SHA-256. A mismatch deletes the file. With no published hash the result is shown as **Integrity unverified**.\r\n4. Shows a confirmation dialog with version, size and hash. The installer runs only after **Run installer** is pressed, and the file is checked again just before it runs. No silent switches are passed, so the official installer shows its own window.\r\n\r\nMaterial Browser never changes `PATH` or any other environment variable.\r\n\r\n## Store\r\n\r\nThe Ollama website has no stable JSON catalogue, so the catalogue adapter scrapes the HTML library index for model names, descriptions and capability badges, then each model's tags page for tag names, digests, download sizes and context length. Parsing is isolated in `parseLibraryIndex` and `parseTagsPage`; if the index yields no models the catalogue is reported as unavailable rather than guessed. Each catalogue records `retrievedAt`, the number of pages read, model and tag counts and a complete or incomplete verdict (incomplete when any tags page failed, with the failed models listed). It is cached at `<userData>/ollama/catalogue.json`. When a refresh fails, the last verified copy is shown with its age and an \"offline\" note. Installed models from `/api/tags` are always merged in, so they appear even with no catalogue.\r\n\r\nThe page shows the cached copy first, then refreshes in the background. About 270 pages are read on a full refresh, four at a time.\r\n\r\n## Hardware fit\r\n\r\nEvidence collected: total memory (`os.totalmem`), free space on the drive that holds the models folder (`OLLAMA_MODELS` or `~/.ollama/models`, via `fs.statfsSync`), and on Windows the graphics adapters from `Get-CimInstance Win32_VideoController` with `wmic path win32_VideoController get AdapterRAM,Name` as fallback. `AdapterRAM` is a 32-bit value, so a reading near 4 GB is shown as \"at least\".\r\n\r\nThe verdict uses the download size and those measurements only, never the model name:\r\n\r\n- **Unknown** when the size, memory, graphics memory or (for models not yet installed) free disk is missing.\r\n- **Unlikely** when the download does not fit on the disk, or the estimate does not fit in graphics memory plus half of system memory.\r\n- **Runs well** when the estimate fits in graphics memory.\r\n- **Runs with limits** otherwise.\r\n\r\nThe estimate is the download size times 1.2 plus 1 GB. The evidence line under the list shows the measured memory, adapters, graphics memory, free disk and the detection method.\r\n\r\n## Pull queue\r\n\r\nThe queue holds up to 50 items. Pulls run one at a time by default (up to three can be chosen). Each item is Waiting, Pulling, Done, Failed or Stopped. Waiting items can be cancelled; a pull in progress is aborted. A pull that ends without Ollama reporting `success` is marked Failed. The summary says how many finished, failed and stopped, and that unfinished pulls installed nothing although partly downloaded layers may stay on disk. The queue never shows prices or payment wording.\r\n\r\n## Chat\r\n\r\nThe chat tab picks from installed models, streams tokens from `/api/chat` and has a **Stop** button that aborts the request. History is kept in memory for the session only and is never written to disk. Messages are limited to 200 per request, 32 000 characters each and 256 KB in total.\r\n\r\n## Not verified\r\n\r\n- No Windows runtime test was possible. The installer flow, graphics detection through PowerShell and `wmic`, the default install path `%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe` and starting `ollama serve` were tested only with stubs.\r\n- The GitHub API was not reachable from the build environment, so whether current releases publish a `digest` for `OllamaSetup.exe` was not confirmed. Without one the installer reports integrity as unverified.\r\n- The library parser was checked against the live `ollama.com/library` and one tags page on 2026-11-01. The site can change at any time; the parser then reports the catalogue as unavailable.\r\n- No test ran against a real Ollama server; the local API calls were tested with stubbed responses that follow the documented formats.\r\n- The fit thresholds are a conservative estimate, not a measurement of actual inference speed.\r\n"},{id:"docs/features/desktop/password-manager.md",title:"Optional KeePassXC pairing for new profiles",category:"features",html:`<h1 id="optional-keepassxc-pairing-for-new-profiles">Optional KeePassXC pairing for new profiles</h1>
<p>Profile creation offers an optional password manager section. When it is enabled, the profile
records a KeePassXC pairing: the source (an installed KeePassXC or one inside the WSL guest), a
database path with an existing or create mode, whether the KeePassXC browser extension should be
registered, and whether passkeys are enabled. Both switches default to on. The database
password, key file and credentials are never stored, requested or logged by this application.</p>
<p>The maintained source lineage is <a href="https://github.com/Ding-Ding-Projects/keepassxc">Ding-Ding-Projects/keepassxc</a>.
Detection looks only at its supported installer roots (<code>KeePassXC.Material</code> and <code>KeePassXC</code>
under the local application data folder, including Squirrel <code>app-&lt;version&gt;</code> layouts) and
returns the newest usable <code>KeePassXC.exe</code> and <code>keepassxc-proxy.exe</code> pair. When nothing is
installed, the form shows the release page rather than installing anything.</p>
<h2 id="what-the-native-host-writes">What the native host writes</h2>
<p>Registrations are written only into application-owned locations immediately before launch,
and only for profiles whose pairing has the extension switch on. Each file carries a
<code>managedBy</code> marker; a file the application did not write is never overwritten, and removal
touches only marked files.</p>
<table>
<thead>
<tr>
<th>Engine</th>
<th>Location</th>
<th>Content</th>
</tr>
</thead>
<tbody>
<tr>
<td>Chromium</td>
<td><code>&lt;profile user data dir&gt;/NativeMessagingHosts/org.keepassxc.keepassxc_browser.json</code></td>
<td>Native messaging manifest pointing at the detected <code>keepassxc-proxy.exe</code></td>
</tr>
<tr>
<td>Chromium</td>
<td><code>&lt;profile user data dir&gt;/External Extensions/oboonakemofpalcgghocfoadofidjkkk.json</code></td>
<td>External extension registration with the Web Store update URL</td>
</tr>
<tr>
<td>Firefox</td>
<td><code>&lt;bundled Firefox&gt;/distribution/policies.json</code></td>
<td><code>ExtensionSettings</code> entry for <code>keepassxc-browser@keepassxc.org</code>, merged with existing policies</td>
</tr>
<tr>
<td>Firefox</td>
<td><code>&lt;data root&gt;/password-manager/native-messaging-hosts/org.keepassxc.keepassxc_browser.json</code></td>
<td>Native messaging manifest, registered through the per-user <code>HKCU\\Software\\Mozilla\\NativeMessagingHosts</code> value on Windows</td>
</tr>
</tbody>
</table>
<p>Chromium and Firefox both ask the person to enable the extension on first launch. There is no
supported way to enable an extension completely silently, and this application does not try.</p>
<h2 id="passkeys">Passkeys</h2>
<p>Passkey support is provided by KeePassXC and its browser extension. The profile stores
<code>passkeys: true</code> by default so the pairing records the intended behavior, but this application
never edits KeePassXC's own configuration file. Verifying passkey registration and sign-in in a
built profile remains pending.</p>
<h2 id="wsl-sources">WSL sources</h2>
<p>The maintained lineage publishes Windows packages only, so a WSL route expects KeePassXC to be
built or installed inside the distribution first (for example a <code>.deb</code> produced from the pinned
source tree). This application verifies <code>/usr/bin/keepassxc-proxy</code> and never installs it.</p>
<ul>
<li><strong>Ordinary profile, source <code>wsl</code>.</strong> The pairing names an existing distribution
(<code>wslDistribution</code>, listed from <code>wsl -l -q</code> by <code>passwordManager.detect</code>). Before launch the host
runs <code>test -x /usr/bin/keepassxc-proxy</code> inside that distribution, then writes an app-owned
wrapper <code>&lt;data root&gt;/password-manager/keepassxc-proxy-&lt;distribution&gt;.cmd</code> that bridges the
browser's native messaging stdio into <code>wsl.exe -d &lt;distribution&gt; --exec /usr/bin/keepassxc-proxy</code>.
The same Chromium and Firefox registrations as above point at that wrapper. A missing proxy
fails launch with <code>PASSWORD_MANAGER_WSL_UNAVAILABLE</code>.</li>
<li><strong>Super Profile template, guest pairing.</strong> Template settings accept <code>passwordManager</code> with
<code>source: "wsl"</code> and <code>wslDistribution: "guest"</code>. During provisioning the host stages the guest
registrations (<code>input/password-manager/</code>), verifies the guest proxy, and installs them into the
guest browser profile: Chromium under <code>~/.material-browser/browser/NativeMessagingHosts</code> and
<code>External Extensions</code>; Firefox under <code>~/.mozilla/native-messaging-hosts</code> plus
<code>/opt/material-browser/firefox/distribution/policies.json</code>, merged with any managed bookmarks
policy. KeePassXC enters the guest through the template's selected Linux installers.</li>
</ul>
<h2 id="limits-and-pending-verification">Limits and pending verification</h2>
<ul>
<li>Both WSL routes are source-implemented and unit-tested on Linux fixtures; no WSL runtime,
wrapper launch, guest provisioning or extension connection has been exercised yet.</li>
<li>Launch with the installed source fails with <code>PASSWORD_MANAGER_UNAVAILABLE</code> when no supported
installation is detected, rather than launching without the promised registration.</li>
<li>Core validation rejects relative paths, traversal segments, control characters, non-<code>.kdbx</code>
suffixes and unknown fields with <code>INVALID_PASSWORD_MANAGER</code>. Existing vaults without the field
load with no pairing.</li>
<li>Verified so far: core and host unit tests for validation, registration shapes, idempotent
create-if-absent writes, foreign-file refusal, scoped removal, Firefox policy merging,
installation detection, the WSL wrapper, distribution-list parsing and guest staging; renderer
form-model tests for defaults, validation, distribution requirements and path redaction.</li>
<li>Not verified: built interface capture, real extension connectivity, passkey behavior in a
running browser, the Windows registry write and the installer. These remain acceptance gaps.</li>
</ul>
`,text:`# Optional KeePassXC pairing for new profiles\r
\r
Profile creation offers an optional password manager section. When it is enabled, the profile\r
records a KeePassXC pairing: the source (an installed KeePassXC or one inside the WSL guest), a\r
database path with an existing or create mode, whether the KeePassXC browser extension should be\r
registered, and whether passkeys are enabled. Both switches default to on. The database\r
password, key file and credentials are never stored, requested or logged by this application.\r
\r
The maintained source lineage is [Ding-Ding-Projects/keepassxc](https://github.com/Ding-Ding-Projects/keepassxc).\r
Detection looks only at its supported installer roots (\`KeePassXC.Material\` and \`KeePassXC\`\r
under the local application data folder, including Squirrel \`app-<version>\` layouts) and\r
returns the newest usable \`KeePassXC.exe\` and \`keepassxc-proxy.exe\` pair. When nothing is\r
installed, the form shows the release page rather than installing anything.\r
\r
## What the native host writes\r
\r
Registrations are written only into application-owned locations immediately before launch,\r
and only for profiles whose pairing has the extension switch on. Each file carries a\r
\`managedBy\` marker; a file the application did not write is never overwritten, and removal\r
touches only marked files.\r
\r
| Engine | Location | Content |\r
| --- | --- | --- |\r
| Chromium | \`<profile user data dir>/NativeMessagingHosts/org.keepassxc.keepassxc_browser.json\` | Native messaging manifest pointing at the detected \`keepassxc-proxy.exe\` |\r
| Chromium | \`<profile user data dir>/External Extensions/oboonakemofpalcgghocfoadofidjkkk.json\` | External extension registration with the Web Store update URL |\r
| Firefox | \`<bundled Firefox>/distribution/policies.json\` | \`ExtensionSettings\` entry for \`keepassxc-browser@keepassxc.org\`, merged with existing policies |\r
| Firefox | \`<data root>/password-manager/native-messaging-hosts/org.keepassxc.keepassxc_browser.json\` | Native messaging manifest, registered through the per-user \`HKCU\\Software\\Mozilla\\NativeMessagingHosts\` value on Windows |\r
\r
Chromium and Firefox both ask the person to enable the extension on first launch. There is no\r
supported way to enable an extension completely silently, and this application does not try.\r
\r
## Passkeys\r
\r
Passkey support is provided by KeePassXC and its browser extension. The profile stores\r
\`passkeys: true\` by default so the pairing records the intended behavior, but this application\r
never edits KeePassXC's own configuration file. Verifying passkey registration and sign-in in a\r
built profile remains pending.\r
\r
## WSL sources\r
\r
The maintained lineage publishes Windows packages only, so a WSL route expects KeePassXC to be\r
built or installed inside the distribution first (for example a \`.deb\` produced from the pinned\r
source tree). This application verifies \`/usr/bin/keepassxc-proxy\` and never installs it.\r
\r
- **Ordinary profile, source \`wsl\`.** The pairing names an existing distribution\r
  (\`wslDistribution\`, listed from \`wsl -l -q\` by \`passwordManager.detect\`). Before launch the host\r
  runs \`test -x /usr/bin/keepassxc-proxy\` inside that distribution, then writes an app-owned\r
  wrapper \`<data root>/password-manager/keepassxc-proxy-<distribution>.cmd\` that bridges the\r
  browser's native messaging stdio into \`wsl.exe -d <distribution> --exec /usr/bin/keepassxc-proxy\`.\r
  The same Chromium and Firefox registrations as above point at that wrapper. A missing proxy\r
  fails launch with \`PASSWORD_MANAGER_WSL_UNAVAILABLE\`.\r
- **Super Profile template, guest pairing.** Template settings accept \`passwordManager\` with\r
  \`source: "wsl"\` and \`wslDistribution: "guest"\`. During provisioning the host stages the guest\r
  registrations (\`input/password-manager/\`), verifies the guest proxy, and installs them into the\r
  guest browser profile: Chromium under \`~/.material-browser/browser/NativeMessagingHosts\` and\r
  \`External Extensions\`; Firefox under \`~/.mozilla/native-messaging-hosts\` plus\r
  \`/opt/material-browser/firefox/distribution/policies.json\`, merged with any managed bookmarks\r
  policy. KeePassXC enters the guest through the template's selected Linux installers.\r
\r
## Limits and pending verification\r
\r
- Both WSL routes are source-implemented and unit-tested on Linux fixtures; no WSL runtime,\r
  wrapper launch, guest provisioning or extension connection has been exercised yet.\r
- Launch with the installed source fails with \`PASSWORD_MANAGER_UNAVAILABLE\` when no supported\r
  installation is detected, rather than launching without the promised registration.\r
- Core validation rejects relative paths, traversal segments, control characters, non-\`.kdbx\`\r
  suffixes and unknown fields with \`INVALID_PASSWORD_MANAGER\`. Existing vaults without the field\r
  load with no pairing.\r
- Verified so far: core and host unit tests for validation, registration shapes, idempotent\r
  create-if-absent writes, foreign-file refusal, scoped removal, Firefox policy merging,\r
  installation detection, the WSL wrapper, distribution-list parsing and guest staging; renderer\r
  form-model tests for defaults, validation, distribution requirements and path redaction.\r
- Not verified: built interface capture, real extension connectivity, passkey behavior in a\r
  running browser, the Windows registry write and the installer. These remain acceptance gaps.\r
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
`},{id:"docs/features/desktop/profile-workspace.md",title:"Desktop profile workspace",category:"features",html:`<h1 id="desktop-profile-workspace">Desktop profile workspace</h1>
<p>Material Browser opens a working profile inventory after vault access and first-run setup.
The desktop uses a compact navigation rail, contextual toolbars and a profile inspector.
Documentation and download presentation remain in the separate handbook.</p>
<h2 id="find-and-operate-a-profile">Find and operate a profile</h2>
<ol>
<li>Open <strong>Profiles</strong>. Search the actual inventory, choose filters and sort the table.</li>
<li>Select a profile name to inspect its configuration. On narrow windows, the detail view
replaces the table; <strong>Back to profiles</strong> returns to the same search and selection.</li>
<li>Use <strong>Launch</strong> to review the standard-identity disclosure before starting that profile.
A saved identity record is not evidence that the engine enforces that identity.</li>
<li>Use the available contextual actions to focus, stop, duplicate, rename, snapshot or remove
a profile. Unsupported host actions report their actual limitation.</li>
<li>Select multiple profiles only when a bulk operation is offered. Review destructive targets
first and inspect each result. A rejected target remains available for correction or retry.</li>
</ol>
<p>Runtime state is shown only when returned by the host for the corresponding profile.
Missing dates or status remain unavailable; table rows never infer that an unobserved process
is running or stopped. Profile names and technical values remain unmodified user data.</p>
<h2 id="inspect-revisions-and-automation">Inspect revisions and automation</h2>
<p>The inspector separates <strong>Overview</strong>, <strong>Revisions</strong> and <strong>Automation</strong>. Revisions retain
their real identifiers. Restoration is an explicit operation on the selected revision.
Saved automation preference, effective runtime mode and restart-required state are separate
facts. Saving a preference does not start a listener or change a running browser immediately.</p>
<h2 id="synchronize-and-resolve-conflicts">Synchronize and resolve conflicts</h2>
<p>Choose a synchronization folder through the native picker. Upload and download act on the
configured encrypted storage. A canceled picker changes nothing. Conflicts list the actual
profile and candidate revision IDs. Inspect a candidate and explicitly resolve the conflict.
Candidates are not called local or remote without recorded provenance. Browser databases
are never merged and concurrent immutable revisions are preserved.</p>
<h2 id="super-profiles-and-settings">Super Profiles and settings</h2>
<p><strong>Super Profiles</strong> remains a separate desktop destination with template configuration,
sessions, revision history and the four-step template wizard. Existing environment choices,
capability disclosures, save previews and retained-session recovery remain authoritative.
A process-ready observation does not prove that a guest desktop was visibly verified.</p>
<p><strong>Settings</strong> retains its category tabs, docking, grouping, pinning, independent searches,
protected history, import/export, schedules and accessibility tools. Compact setting rows
keep the actual control, contextual explanation, value provenance and reset route together.
Only the visible presentation changes; stored preferences continue through the existing
validation and persistence service. Unsupported privileged capabilities remain unfinished.</p>
<h2 id="first-run-navigation-and-accessibility">First run, navigation and accessibility</h2>
<p>Setup performs real vault creation, unlock or join, first-profile creation and optional
synchronization. Back and Next retain safe progress; passwords are not resume data.
Completion opens Profiles. Ordinary navigation preserves the existing workspace instead
of creating duplicate destinations. The explicit catalog and command palette expose
supported destinations and actions.</p>
<p>The supported minimum client area is 760 by 580 logical pixels; the normal reference is
1280 by 800. Narrow layouts use a dedicated detail view and wrapping toolbars. Controls
retain keyboard access, visible focus, localized accessible names and usable targets.
English, Cantonese and bilingual modes, light/dark themes, reduced motion and existing
personal wording controls remain part of the desktop behavior.</p>
<h2 id="security-and-verification">Security and verification</h2>
<p>The renderer remains sandboxed and communicates through the typed allowlisted preload
bridge. It gains no direct filesystem, browser-process or credential access. Existing vault
formats, profile IDs and native method semantics are preserved. Personal wording remains
local and is excluded from exports, history and public evidence.</p>
<p>Source, local checks, package construction, runtime interaction, installer acceptance and
release publication have distinct verdicts. See the current evidence inventory and handoff
for exact source bindings and remaining acceptance gaps. Historical images retain their
original provenance and never become proof of the rewritten interface.</p>
<h2 id="\u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981">\u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981</h2>
<p>\u958B\u555F\u4FDD\u96AA\u5EAB\u540C\u5B8C\u6210\u521D\u6B21\u8A2D\u5B9A\u5F8C\uFF0C\u684C\u9762\u76F4\u63A5\u9032\u5165\u8A2D\u5B9A\u6A94\u5DE5\u4F5C\u5340\u3002\u5148\u641C\u5C0B\u3001\u7BE9\u9078\u540C\u6392\u5E8F\uFF0C\u518D\u63C0\u8A2D\u5B9A\u6A94
\u7747\u8A73\u7D30\u8CC7\u6599\uFF1B\u7A84\u8996\u7A97\u6703\u8F49\u5165\u8A73\u7D30\u756B\u9762\uFF0C\u7528\u8FD4\u56DE\u64CD\u4F5C\u4FDD\u7559\u539F\u672C\u641C\u5C0B\u3002\u555F\u52D5\u524D\u4ECD\u7136\u8981\u78BA\u8A8D\u6A19\u6E96\u8EAB\u5206
\u9650\u5236\uFF0C\u5132\u5B58\u5497\u5605\u8EAB\u5206\u8CC7\u6599\u5514\u4EE3\u8868\u700F\u89BD\u5668\u5DF2\u7D93\u5957\u7528\u3002\u5FEB\u7167\u3001\u9084\u539F\u540C\u522A\u9664\u90FD\u4FC2\u5BE6\u969B\u64CD\u4F5C\uFF0C\u5514\u6703\u7528\u6210\u529F
\u63D0\u793A\u4EE3\u66FF\u771F\u6B63\u7D50\u679C\u3002</p>
<p>\u81EA\u52D5\u5316\u504F\u597D\u3001\u76EE\u524D\u6709\u6548\u6A21\u5F0F\u540C\u9700\u8981\u91CD\u65B0\u555F\u52D5\u5206\u958B\u986F\u793A\u3002\u540C\u6B65\u885D\u7A81\u4FDD\u7559\u771F\u6B63\u7248\u672C\u8B58\u5225\u78BC\uFF0C\u5187\u4F86\u6E90
\u8B49\u64DA\u5C31\u5514\u4E82\u53EB\u672C\u6A5F\u7248\u6216\u8005\u9060\u7AEF\u7248\u3002Super Profiles\u3001\u8A2D\u5B9A\u5206\u9801\u3001\u53D7\u4FDD\u8B77\u6B77\u53F2\u3001\u6392\u7A0B\u540C\u7121\u969C\u7919\u5DE5\u5177
\u4FDD\u7559\u539F\u6709\u6D41\u7A0B\u3002\u65B0\u756B\u9762\u5605\u64CD\u4F5C\u3001\u5B89\u88DD\u540C\u767C\u884C\u8B49\u64DA\u8981\u5206\u958B\u6838\u5BE6\uFF0C\u820A\u5716\u5514\u6703\u7A7F\u4EF6\u65B0\u886B\u5C31\u7576\u65B0\u7248\u672C\u3002</p>
`,text:`# Desktop profile workspace

Material Browser opens a working profile inventory after vault access and first-run setup.
The desktop uses a compact navigation rail, contextual toolbars and a profile inspector.
Documentation and download presentation remain in the separate handbook.

## Find and operate a profile

1. Open **Profiles**. Search the actual inventory, choose filters and sort the table.
2. Select a profile name to inspect its configuration. On narrow windows, the detail view
   replaces the table; **Back to profiles** returns to the same search and selection.
3. Use **Launch** to review the standard-identity disclosure before starting that profile.
   A saved identity record is not evidence that the engine enforces that identity.
4. Use the available contextual actions to focus, stop, duplicate, rename, snapshot or remove
   a profile. Unsupported host actions report their actual limitation.
5. Select multiple profiles only when a bulk operation is offered. Review destructive targets
   first and inspect each result. A rejected target remains available for correction or retry.

Runtime state is shown only when returned by the host for the corresponding profile.
Missing dates or status remain unavailable; table rows never infer that an unobserved process
is running or stopped. Profile names and technical values remain unmodified user data.

## Inspect revisions and automation

The inspector separates **Overview**, **Revisions** and **Automation**. Revisions retain
their real identifiers. Restoration is an explicit operation on the selected revision.
Saved automation preference, effective runtime mode and restart-required state are separate
facts. Saving a preference does not start a listener or change a running browser immediately.

## Synchronize and resolve conflicts

Choose a synchronization folder through the native picker. Upload and download act on the
configured encrypted storage. A canceled picker changes nothing. Conflicts list the actual
profile and candidate revision IDs. Inspect a candidate and explicitly resolve the conflict.
Candidates are not called local or remote without recorded provenance. Browser databases
are never merged and concurrent immutable revisions are preserved.

## Super Profiles and settings

**Super Profiles** remains a separate desktop destination with template configuration,
sessions, revision history and the four-step template wizard. Existing environment choices,
capability disclosures, save previews and retained-session recovery remain authoritative.
A process-ready observation does not prove that a guest desktop was visibly verified.

**Settings** retains its category tabs, docking, grouping, pinning, independent searches,
protected history, import/export, schedules and accessibility tools. Compact setting rows
keep the actual control, contextual explanation, value provenance and reset route together.
Only the visible presentation changes; stored preferences continue through the existing
validation and persistence service. Unsupported privileged capabilities remain unfinished.

## First run, navigation and accessibility

Setup performs real vault creation, unlock or join, first-profile creation and optional
synchronization. Back and Next retain safe progress; passwords are not resume data.
Completion opens Profiles. Ordinary navigation preserves the existing workspace instead
of creating duplicate destinations. The explicit catalog and command palette expose
supported destinations and actions.

The supported minimum client area is 760 by 580 logical pixels; the normal reference is
1280 by 800. Narrow layouts use a dedicated detail view and wrapping toolbars. Controls
retain keyboard access, visible focus, localized accessible names and usable targets.
English, Cantonese and bilingual modes, light/dark themes, reduced motion and existing
personal wording controls remain part of the desktop behavior.

## Security and verification

The renderer remains sandboxed and communicates through the typed allowlisted preload
bridge. It gains no direct filesystem, browser-process or credential access. Existing vault
formats, profile IDs and native method semantics are preserved. Personal wording remains
local and is excluded from exports, history and public evidence.

Source, local checks, package construction, runtime interaction, installer acceptance and
release publication have distinct verdicts. See the current evidence inventory and handoff
for exact source bindings and remaining acceptance gaps. Historical images retain their
original provenance and never become proof of the rewritten interface.

## \u5EE3\u6771\u8A71\u64CD\u4F5C\u6458\u8981

\u958B\u555F\u4FDD\u96AA\u5EAB\u540C\u5B8C\u6210\u521D\u6B21\u8A2D\u5B9A\u5F8C\uFF0C\u684C\u9762\u76F4\u63A5\u9032\u5165\u8A2D\u5B9A\u6A94\u5DE5\u4F5C\u5340\u3002\u5148\u641C\u5C0B\u3001\u7BE9\u9078\u540C\u6392\u5E8F\uFF0C\u518D\u63C0\u8A2D\u5B9A\u6A94
\u7747\u8A73\u7D30\u8CC7\u6599\uFF1B\u7A84\u8996\u7A97\u6703\u8F49\u5165\u8A73\u7D30\u756B\u9762\uFF0C\u7528\u8FD4\u56DE\u64CD\u4F5C\u4FDD\u7559\u539F\u672C\u641C\u5C0B\u3002\u555F\u52D5\u524D\u4ECD\u7136\u8981\u78BA\u8A8D\u6A19\u6E96\u8EAB\u5206
\u9650\u5236\uFF0C\u5132\u5B58\u5497\u5605\u8EAB\u5206\u8CC7\u6599\u5514\u4EE3\u8868\u700F\u89BD\u5668\u5DF2\u7D93\u5957\u7528\u3002\u5FEB\u7167\u3001\u9084\u539F\u540C\u522A\u9664\u90FD\u4FC2\u5BE6\u969B\u64CD\u4F5C\uFF0C\u5514\u6703\u7528\u6210\u529F
\u63D0\u793A\u4EE3\u66FF\u771F\u6B63\u7D50\u679C\u3002

\u81EA\u52D5\u5316\u504F\u597D\u3001\u76EE\u524D\u6709\u6548\u6A21\u5F0F\u540C\u9700\u8981\u91CD\u65B0\u555F\u52D5\u5206\u958B\u986F\u793A\u3002\u540C\u6B65\u885D\u7A81\u4FDD\u7559\u771F\u6B63\u7248\u672C\u8B58\u5225\u78BC\uFF0C\u5187\u4F86\u6E90
\u8B49\u64DA\u5C31\u5514\u4E82\u53EB\u672C\u6A5F\u7248\u6216\u8005\u9060\u7AEF\u7248\u3002Super Profiles\u3001\u8A2D\u5B9A\u5206\u9801\u3001\u53D7\u4FDD\u8B77\u6B77\u53F2\u3001\u6392\u7A0B\u540C\u7121\u969C\u7919\u5DE5\u5177
\u4FDD\u7559\u539F\u6709\u6D41\u7A0B\u3002\u65B0\u756B\u9762\u5605\u64CD\u4F5C\u3001\u5B89\u88DD\u540C\u767C\u884C\u8B49\u64DA\u8981\u5206\u958B\u6838\u5BE6\uFF0C\u820A\u5716\u5514\u6703\u7A7F\u4EF6\u65B0\u886B\u5C31\u7576\u65B0\u7248\u672C\u3002
`},{id:"docs/features/desktop/protected-history-workspace.md",title:"Protected history workspace",category:"features",html:`<h1 id="protected-history-workspace">Protected history workspace</h1>
<p>The History and transfer destination contains independent history setup and unlock, password change, explicit locking, filtered revision discovery, labels, change review, restore confirmation, recovery, redacted JSON export and retention visibility. The password or PIN is entered only into protected fields and is cleared after the operation. It is independent of the browser vault and operating-system sign-in. Changing it revokes older sessions through the native service.</p>
<p>The workspace uses the main-process history adapter. The renderer cannot supply an executable, file path, credential namespace, key, trusted callback or expected native revision. The main process verifies the complete bundled runtime inventory before using its executable. Missing or modified runtime bytes produce an unavailable state. The privileged bridge requires the owning main frame and the exact bundled document URL.</p>
<p>Preference saves finish their native transaction before recording history. A history-recording failure cannot turn a durable preference save into a failed-save result; it is reported separately. Protected restore and recovery use a typed expected snapshot plus a numeric native revision under the preference mutex. Display-name changes use the same protected transaction pattern with their own typed record and revision. A custom display name changes the workspace header only. Installed identity, paths and update identity are unaffected.</p>
<p>Date, action and text filters compose over at most 500 returned revisions. Each history search has its adjacent regex builder. Selection and redacted export use stable revision identities and the currently visible selection. Redacted JSON omits free-text labels and snapshot values. Retention changes only the visibility horizon, from 1 to 36500 days; physical deletion is not claimed. The existing browser revision cache remains on the device for preservation but is no longer displayed as the protected history service. Current-value Undo and Redo continue to append changes when native history is configured.</p>
<p>An unfinished transaction remains visible with explicit retry and discard choices. Retry requires the recorded expected state; an older journal without that context cannot be guessed or silently applied. Discard ends the pending operation while retaining earlier history. Restore, display-name reset and recovery require the two confirmation choices and final authorization slider. A rejected asynchronous action retains its confirmation and contextual message.</p>
<h2 id="verification-and-remaining-work">Verification and remaining work</h2>
<p>The source adapter tests cover trusted expectation construction, rejected renderer context, stale display-name state, per-operation runtime verification, unavailable runtime handling, bounded credential requests, successful setup with failed baseline recording, and save-before-history ordering. Separate native store and runtime-verifier tests cover compare-and-swap, idempotence, full inventory hashes and linked paths. These checks are not a built-interface or coupled two-process verdict.</p>
<p>The current workspace implementation awaits integration of the strict restore/recovery service contract and packaged official runtime, followed by real setup/unlock/password-change/display-name/history/restore workflows and two-process overlap verification. Advanced history pagination, physical pruning, additional export formats, archive formats, complete contextual playgrounds and full regex parity remain unfinished. No source or interface catalogue is treated as complete Settings acceptance.</p>
`,text:`# Protected history workspace\r
\r
The History and transfer destination contains independent history setup and unlock, password change, explicit locking, filtered revision discovery, labels, change review, restore confirmation, recovery, redacted JSON export and retention visibility. The password or PIN is entered only into protected fields and is cleared after the operation. It is independent of the browser vault and operating-system sign-in. Changing it revokes older sessions through the native service.\r
\r
The workspace uses the main-process history adapter. The renderer cannot supply an executable, file path, credential namespace, key, trusted callback or expected native revision. The main process verifies the complete bundled runtime inventory before using its executable. Missing or modified runtime bytes produce an unavailable state. The privileged bridge requires the owning main frame and the exact bundled document URL.\r
\r
Preference saves finish their native transaction before recording history. A history-recording failure cannot turn a durable preference save into a failed-save result; it is reported separately. Protected restore and recovery use a typed expected snapshot plus a numeric native revision under the preference mutex. Display-name changes use the same protected transaction pattern with their own typed record and revision. A custom display name changes the workspace header only. Installed identity, paths and update identity are unaffected.\r
\r
Date, action and text filters compose over at most 500 returned revisions. Each history search has its adjacent regex builder. Selection and redacted export use stable revision identities and the currently visible selection. Redacted JSON omits free-text labels and snapshot values. Retention changes only the visibility horizon, from 1 to 36500 days; physical deletion is not claimed. The existing browser revision cache remains on the device for preservation but is no longer displayed as the protected history service. Current-value Undo and Redo continue to append changes when native history is configured.\r
\r
An unfinished transaction remains visible with explicit retry and discard choices. Retry requires the recorded expected state; an older journal without that context cannot be guessed or silently applied. Discard ends the pending operation while retaining earlier history. Restore, display-name reset and recovery require the two confirmation choices and final authorization slider. A rejected asynchronous action retains its confirmation and contextual message.\r
\r
## Verification and remaining work\r
\r
The source adapter tests cover trusted expectation construction, rejected renderer context, stale display-name state, per-operation runtime verification, unavailable runtime handling, bounded credential requests, successful setup with failed baseline recording, and save-before-history ordering. Separate native store and runtime-verifier tests cover compare-and-swap, idempotence, full inventory hashes and linked paths. These checks are not a built-interface or coupled two-process verdict.\r
\r
The current workspace implementation awaits integration of the strict restore/recovery service contract and packaged official runtime, followed by real setup/unlock/password-change/display-name/history/restore workflows and two-process overlap verification. Advanced history pagination, physical pruning, additional export formats, archive formats, complete contextual playgrounds and full regex parity remain unfinished. No source or interface catalogue is treated as complete Settings acceptance.\r
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
<p><code>exportRedacted({revisions})</code> exports an explicit selection of up to 500 unique
revision IDs. It checks the independent session again and resolves IDs against
the full eligible history, not a pre-truncated newest-500 list. Logical retention
and prepared-record exclusions still apply. Every requested ID must be accounted
for or the request fails with <code>HISTORY_EXPORT_SELECTION_INCOMPLETE</code>, without a
partial export. Duplicate, malformed and oversized selections are rejected.
An explicit empty selection returns an empty redacted result. Omitting the
selection retains the newest-500 default. Only revision identity, date, action
and stable record identity are projected; labels and freeform values never enter
the payload. The pure in-memory selector is separate from access: only the service
loads protected history after authentication under its mutex.</p>
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
\`exportRedacted({revisions})\` exports an explicit selection of up to 500 unique\r
revision IDs. It checks the independent session again and resolves IDs against\r
the full eligible history, not a pre-truncated newest-500 list. Logical retention\r
and prepared-record exclusions still apply. Every requested ID must be accounted\r
for or the request fails with \`HISTORY_EXPORT_SELECTION_INCOMPLETE\`, without a\r
partial export. Duplicate, malformed and oversized selections are rejected.\r
An explicit empty selection returns an empty redacted result. Omitting the\r
selection retains the newest-500 default. Only revision identity, date, action\r
and stable record identity are projected; labels and freeform values never enter\r
the payload. The pure in-memory selector is separate from access: only the service\r
loads protected history after authentication under its mutex.\r
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
`},{id:"docs/features/desktop/settings-file-boundary.md",title:"Main-process settings file boundary",category:"features",html:`<h1 id="main-process-settings-file-boundary">Main-process settings file boundary</h1>
<p>Settings exports and the optional editor choice use application-owned destinations. Renderer requests cannot supply a directory, filename, executable path, or command. The native picker supplies an editor candidate, which becomes the effective selection only after its record has been saved successfully.</p>
<p>Before creating a directory, reading a record, or replacing a record, the desktop bridge checks the destination and every existing ancestor. Symbolic links and directory junctions are rejected. Existing records must be ordinary files with one hard link and bounded size. Reads verify the opened file identity and use a bounded buffer. New files use exclusive creation. Atomic replacement writes and flushes a unique temporary file before renaming it over a validated destination. A rejected replacement preserves the previous record and does not switch the selected editor.</p>
<p>These checks reject pre-existing redirected paths and reduce replacement races. They do not claim protection against an adversarial process with the same filesystem permissions repeatedly replacing ancestors between native filesystem calls. An interrupted write can leave an application-owned temporary file; it is not treated as a completed save.</p>
<p>The focused native bridge tests cover a linked export root with an unchanged victim sentinel, a linked ancestor, a hard-linked destination, exclusive-write collisions, rejected atomic replacement, and a rejected editor save followed by discovery of the original choice. These checks establish the file boundary, not complete protected-history integration or installed-package acceptance.</p>
<h2 id="native-preference-snapshot-model">Native preference snapshot model</h2>
<p>The main-owned preference store validates the packaged shared preference schema, schedule collection, explicit field provenance and monotonically increasing revision. It serializes operations under an application-scoped platform mutex. Writes require the expected revision; stale migrations and conflicting edits fail without replacing the current record. A missing record is distinguishable from a corrupt record. Only an absent record permits initial migration, and corrupt bytes remain available for recovery.</p>
<p>The trusted history apply callback requires a numeric native revision and compares it with the complete expected preference/schedule snapshot under the same mutex. An already-applied target is idempotent; a different live snapshot or intervening revision produces a conflict, including a change away from and back to the same values. Ordinary saves must release this mutex before recording protected history. History restore may hold its own mutex while invoking the preference callback, which never calls history recursively.</p>
<p>Seven model tests cover one-time initialization, provenance, stale revision rejection, reopening persisted values, corrupt-record preservation, expected-state restoration, idempotent recovery, intervening revisions, rejected writes, excluded payload fields and contention between independent store instances using the actual platform mutex.</p>
<p>The renderer now loads the main-owned record through allowlisted operations. It migrates a valid legacy browser record only when no native record exists, using revision compare-and-swap; a competing migration is read back. Existing native preferences take precedence without parsing obsolete legacy bytes. Personal wording remains in its separate local renderer cache and never enters these requests. Invalid legacy content produces a generic recovery message without echoing its contents.</p>
<p>Saving indicators reflect pending operations. Preference controls retain their last durable value when native writes fail. A visible reload action reads the current authoritative record or retries a valid first migration. The local workspace cache still holds navigation, notifications and the explicitly interim local revision list; failure to update that cache after a native save is reported separately from failure to save preferences. Native protected-history controls and coupled two-process history/write overlap remain unfinished. The packaged candidate <code>bef71f766f3b96fe027b72309a082580a200b0fd</code> passed fresh-profile initialization, actual schedule/import/reset rejection and retry, and native-value readback after process restart. Existing populated legacy-cache migration remains covered by source-level transition tests, not yet by a packaged legacy fixture.</p>
<h2 id="protected-display-name-and-bundled-history-runtime">Protected display name and bundled history runtime</h2>
<p>The display-name store uses a typed semantic record and a separate numeric revision. Its only mutation API is the trusted expected-state callback used by protected history. Missing expectations, stale revisions, changed current values and extra fields are rejected; retrying an already-applied desired value is idempotent.</p>
<p>The runtime verifier reads the product-owned history runtime manifest and checks its complete file inventory, declared sizes and SHA-256 values, including auxiliary runtime files. Missing, extra, modified, linked and hard-linked files are rejected before returning an executable path. No PATH lookup is used. The explicit diagnostic data-directory route derives an isolated credential namespace in the main process; ordinary launches keep their original namespace. Namespace values and their derivation inputs are never returned to the renderer or included in exports. This is diagnostic isolation, not cross-computer history portability.</p>
<p>These modules have focused tests but are not yet wired to the protected-history screen. Synthetic runtime fixtures are never executed and do not prove the installed official runtime package.</p>
`,text:`# Main-process settings file boundary\r
\r
Settings exports and the optional editor choice use application-owned destinations. Renderer requests cannot supply a directory, filename, executable path, or command. The native picker supplies an editor candidate, which becomes the effective selection only after its record has been saved successfully.\r
\r
Before creating a directory, reading a record, or replacing a record, the desktop bridge checks the destination and every existing ancestor. Symbolic links and directory junctions are rejected. Existing records must be ordinary files with one hard link and bounded size. Reads verify the opened file identity and use a bounded buffer. New files use exclusive creation. Atomic replacement writes and flushes a unique temporary file before renaming it over a validated destination. A rejected replacement preserves the previous record and does not switch the selected editor.\r
\r
These checks reject pre-existing redirected paths and reduce replacement races. They do not claim protection against an adversarial process with the same filesystem permissions repeatedly replacing ancestors between native filesystem calls. An interrupted write can leave an application-owned temporary file; it is not treated as a completed save.\r
\r
The focused native bridge tests cover a linked export root with an unchanged victim sentinel, a linked ancestor, a hard-linked destination, exclusive-write collisions, rejected atomic replacement, and a rejected editor save followed by discovery of the original choice. These checks establish the file boundary, not complete protected-history integration or installed-package acceptance.\r
\r
## Native preference snapshot model\r
\r
The main-owned preference store validates the packaged shared preference schema, schedule collection, explicit field provenance and monotonically increasing revision. It serializes operations under an application-scoped platform mutex. Writes require the expected revision; stale migrations and conflicting edits fail without replacing the current record. A missing record is distinguishable from a corrupt record. Only an absent record permits initial migration, and corrupt bytes remain available for recovery.\r
\r
The trusted history apply callback requires a numeric native revision and compares it with the complete expected preference/schedule snapshot under the same mutex. An already-applied target is idempotent; a different live snapshot or intervening revision produces a conflict, including a change away from and back to the same values. Ordinary saves must release this mutex before recording protected history. History restore may hold its own mutex while invoking the preference callback, which never calls history recursively.\r
\r
Seven model tests cover one-time initialization, provenance, stale revision rejection, reopening persisted values, corrupt-record preservation, expected-state restoration, idempotent recovery, intervening revisions, rejected writes, excluded payload fields and contention between independent store instances using the actual platform mutex.\r
\r
The renderer now loads the main-owned record through allowlisted operations. It migrates a valid legacy browser record only when no native record exists, using revision compare-and-swap; a competing migration is read back. Existing native preferences take precedence without parsing obsolete legacy bytes. Personal wording remains in its separate local renderer cache and never enters these requests. Invalid legacy content produces a generic recovery message without echoing its contents.\r
\r
Saving indicators reflect pending operations. Preference controls retain their last durable value when native writes fail. A visible reload action reads the current authoritative record or retries a valid first migration. The local workspace cache still holds navigation, notifications and the explicitly interim local revision list; failure to update that cache after a native save is reported separately from failure to save preferences. Native protected-history controls and coupled two-process history/write overlap remain unfinished. The packaged candidate \`bef71f766f3b96fe027b72309a082580a200b0fd\` passed fresh-profile initialization, actual schedule/import/reset rejection and retry, and native-value readback after process restart. Existing populated legacy-cache migration remains covered by source-level transition tests, not yet by a packaged legacy fixture.\r
\r
## Protected display name and bundled history runtime\r
\r
The display-name store uses a typed semantic record and a separate numeric revision. Its only mutation API is the trusted expected-state callback used by protected history. Missing expectations, stale revisions, changed current values and extra fields are rejected; retrying an already-applied desired value is idempotent.\r
\r
The runtime verifier reads the product-owned history runtime manifest and checks its complete file inventory, declared sizes and SHA-256 values, including auxiliary runtime files. Missing, extra, modified, linked and hard-linked files are rejected before returning an executable path. No PATH lookup is used. The explicit diagnostic data-directory route derives an isolated credential namespace in the main process; ordinary launches keep their original namespace. Namespace values and their derivation inputs are never returned to the renderer or included in exports. This is diagnostic isolation, not cross-computer history portability.\r
\r
These modules have focused tests but are not yet wired to the protected-history screen. Synthetic runtime fixtures are never executed and do not prove the installed official runtime package.\r
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
<h2 id="asynchronous-native-save-rejection">Asynchronous native save rejection</h2>
<p>The native-storage transition exposed a caller defect: schedule and import handlers closed their drafts before awaiting persistence, while the persistence layer swallowed a rejected write. The repaired flow returns an explicit result through persistence and settings actions. Schedule labels and edit identities, import previews and confirmation choices remain present until a successful durable result. Rejection focuses the contextual message and leaves a localized retry action. Confirmation submission is guarded while pending. Notification dismissal selections also clear only after successful persistence.</p>
<p>Seven tests execute the production TypeScript component and hook handlers with deterministic hook state. They cover schedule and import rejection/success, reset confirmation, duplicate confirmation submission, rejected persistence retaining the current values, promise propagation from settings actions, and a rejected single-notification dismissal retaining the previous Undo target. Three deliberate source regressions, missing promise propagation and premature schedule/import completion, each fail an assertion. These checks alone do not claim DOM focus or built-interface proof. The single-notification follow-up is source-tested and awaits the next packaged candidate; it is not included in the earlier capture claim below.</p>
<p>The packaged candidate <code>bef71f766f3b96fe027b72309a082580a200b0fd</code> also passed actual filesystem-rejection workflows on an isolated profile. The exact native preference file was preserved, temporarily replaced by an empty application-owned fixture directory, then restored byte-for-byte. The schedule label and edit state remained present with no new saved row; the import review remained open with the previous value; the reset dialog retained both authorization choices and its slider position. Every rejected workflow focused its contextual alert. Each retry succeeded after the original record was restored. A fresh process subsequently rendered the saved message-style value from native revision 5. Both owned processes closed normally and their named desktops were absent afterward.</p>
<p>The three inspected rejection captures are 1899 \xD7 1107 native captures. The inspected restart capture is 1280 \xD7 800 with a measured device-pixel ratio approximately 1. Each capture retains its original source and runtime receipt. One earlier retry plan stopped on a control-readiness exception; that interrupted record remains retained, and the subsequent explicit readiness check completed the workflow. These results cover the named transitions, not the full layout/language/scale matrix or protected-history integration.</p>
`,text:`# Settings state-transition regressions\r
\r
The first categorized Settings candidate exposed nine defects during independent review. This ledger records the concrete transitions and separates pure-model proof from built-interface acceptance. None of these results establishes complete Settings feature coverage.\r
\r
| ID | Required transition | Shared implementation and focused test | Current evidence |\r
| --- | --- | --- | --- |\r
| R1 | Delete the last schedule, narrow a history filter, or dismiss the last unread notification without stale search indices selecting a different record or crashing | \`interaction-model.mjs\`, stable key snapshots in \`Search.tsx\`, \`settings-regressions.test.mjs\` | Model cases pass; deliberately regressed identity resolver fails; new built transitions pending |\r
| R2 | A \u2192 B \u2192 C; Undo \u2192 B \u2192 A; Redo \u2192 B \u2192 C; a new edit after Undo clears Redo while retaining the audit | \`history-model.mjs\`, \`store.ts\` | Model sequence passes; old second-to-last toggle fails; new built sequence pending |\r
| R3 | Rename an imported disabled rule with multiple values without enabling it or losing untouched values | \`preserveScheduleEdit\`, schedule editor | Model case passes; enabled/single-value regression fails; new built import/edit pending |\r
| R4 | Load a valid current preferences record despite malformed unused legacy appearance JSON | \`readStoredPresentation\`, store initialization | Model case passes; eager legacy parse fails; new built reload pending |\r
| R5 | Reveal a setting excluded by the current section filter without discarding that filter | \`revealSettingKeys\`, Settings workspace | Model case passes; hidden-target regression fails; new built focus proof pending |\r
| R6 | Give two automatic voice selectors distinct names identifying their owning fields and current values | \`choiceAccessibleName\`, shared picker | Name model passes; value-only regression fails; rendered accessibility-name proof pending |\r
| R7 | Clear a numeric field and retain a partial color draft while preserving the last valid saved value | \`parseNumericDraft\`, draft field controls | Validation cases pass; old ignored-blank behavior fails; rendered draft/focus proof pending |\r
| R8 | Mount workspace and accessibility-dialog copies of the same setting without duplicate target/help IDs | \`settingInstanceId\`, shared control | Instance model passes; fixed-ID regression fails; simultaneous DOM proof pending |\r
| R9 | Keep an active bilingual continuation and queued critical messages when routine messages arrive | \`speech-queue.mjs\`, narrator consumer | Queue-order case passes; replace-whole-queue regression fails; actual audio delivery remains unverified |\r
\r
The local negative runner exercised one deliberate regression for each ID and observed all nine fail their intended assertion. Restored source passed all nine cases. The combined focused desktop, native bridge and font/editor checks passed 39 tests. Runtime records from the earlier candidate remain bound to that earlier source and are not relabeled as proof for these repairs.\r
\r
Settings controls, pure validation, persistence, history transitions, speech queue and privileged IPC are separate modules. The current browser-storage history remains an interim local feature until the independently protected native history service is connected and verified.\r
\r
## Asynchronous native save rejection\r
\r
The native-storage transition exposed a caller defect: schedule and import handlers closed their drafts before awaiting persistence, while the persistence layer swallowed a rejected write. The repaired flow returns an explicit result through persistence and settings actions. Schedule labels and edit identities, import previews and confirmation choices remain present until a successful durable result. Rejection focuses the contextual message and leaves a localized retry action. Confirmation submission is guarded while pending. Notification dismissal selections also clear only after successful persistence.\r
\r
Seven tests execute the production TypeScript component and hook handlers with deterministic hook state. They cover schedule and import rejection/success, reset confirmation, duplicate confirmation submission, rejected persistence retaining the current values, promise propagation from settings actions, and a rejected single-notification dismissal retaining the previous Undo target. Three deliberate source regressions, missing promise propagation and premature schedule/import completion, each fail an assertion. These checks alone do not claim DOM focus or built-interface proof. The single-notification follow-up is source-tested and awaits the next packaged candidate; it is not included in the earlier capture claim below.\r
\r
The packaged candidate \`bef71f766f3b96fe027b72309a082580a200b0fd\` also passed actual filesystem-rejection workflows on an isolated profile. The exact native preference file was preserved, temporarily replaced by an empty application-owned fixture directory, then restored byte-for-byte. The schedule label and edit state remained present with no new saved row; the import review remained open with the previous value; the reset dialog retained both authorization choices and its slider position. Every rejected workflow focused its contextual alert. Each retry succeeded after the original record was restored. A fresh process subsequently rendered the saved message-style value from native revision 5. Both owned processes closed normally and their named desktops were absent afterward.\r
\r
The three inspected rejection captures are 1899 \xD7 1107 native captures. The inspected restart capture is 1280 \xD7 800 with a measured device-pixel ratio approximately 1. Each capture retains its original source and runtime receipt. One earlier retry plan stopped on a control-readiness exception; that interrupted record remains retained, and the subsequent explicit readiness check completed the workflow. These results cover the named transitions, not the full layout/language/scale matrix or protected-history integration.\r
`},{id:"docs/features/desktop/super-profiles.md",title:"Super Profiles",category:"features",html:`<h1 id="super-profiles">Super Profiles</h1>
<p>Super Profiles store reusable environment templates in the encrypted vault. They are separate
from ordinary browser profiles. Template changes and explicit save-back create immutable
revisions; stale writes are rejected rather than overwriting a newer revision.</p>
<h2 id="create-a-template">Create a template</h2>
<p>Unlock the vault, open <strong>Super Profiles</strong>, and choose <strong>Create Super Profile</strong>. Give the
template a name, choose a browser engine and environment, then review its configuration.
Saving a template does not prove that the host can launch that environment. Read the actual
capability result before launching.</p>
<p>WSL templates offer terminal, Linux browser and desktop modes. A locally supplied root
filesystem archive requires a matching SHA-256 digest. Browser and desktop modes also need
the corresponding guest packages and display support. Windows browser binaries cannot run
as Linux browser binaries.</p>
<h2 id="launch-and-save-deliberately">Launch and save deliberately</h2>
<p>Review the standard-identity explanation before launching. These environments do not promise
anonymity, stable identity, portable credentials or recognition by websites. Browser state is
kept separate when the backend, engine or base environment changes.</p>
<p>Use the session's actual returned state. Provisioning, a spawned process and a visually ready
desktop are different observations. A failed launch retains owned staging for recovery.
Never remove an unrelated WSL distribution to resolve a launch failure.</p>
<p>Session health is shown separately from lifecycle state. WSL observations use a bounded
stream created during the authorized launch; polling status does not execute a new guest
command. Readiness records require the owned session, launch nonce, increasing sequence and
fresh host receipt time. Terminal readiness requires the normal user's interactive PTY.
Desktop readiness requires its authenticated Xfce session and matching-display window manager.
These observations verify processes, not visible desktop pixels. Stale or missing observations
remain unknown, and restarting the host requires explicit recovery rather than reattachment.
Stop an active session before saving when its current readiness is unknown.</p>
<p>Full desktop mode provides browser and workspace entries. The browser entry uses the selected
engine with the same managed profile directory as browser mode. It does not silently import
the host's everyday browser profile.</p>
<p>Explicit save-back requires a stopped browser and validated output. It creates a new encrypted
revision and preserves previous revisions. Restore selects an earlier revision and creates a
new current revision, so history remains available. Discard must destroy only the positively
identified owned session. Closing a Sandbox window directly can lose unexported changes.</p>
<p><strong>Save back and close</strong> first queues browser shutdown and collection of the selected workspace
and browser categories. Collection reports progress without holding the vault open. A collected
archive is not yet a saved revision. If the vault locks or the host restarts during collection,
unlock it and explicitly confirm that operation before encrypted finalization. A changed template
revision rejects finalization and retains the collected data for recovery. Stop and discard remain
available while locked, with private template metadata omitted from their responses.</p>
<p>The Sandbox guest includes explicit save-and-close and discard-and-close controls. Save-and-close
exports stopped-browser state and a complete manifest before asking the host to finalize it.
Closing the Sandbox window itself cannot export state that has already been destroyed.</p>
<h2 id="guest-password-manager">Guest password manager</h2>
<p>A WSL template can pair its guest browser with KeePassXC running inside the same guest. Set
<code>passwordManager</code> on the template with <code>source: "wsl"</code>, <code>wslDistribution: "guest"</code>, a guest
database path and the extension and passkeys switches (both default on). Provisioning stages and
installs the browser registrations only after the guest provides <code>/usr/bin/keepassxc-proxy</code>;
supply KeePassXC from the maintained lineage through the selected installers. Details and limits
are in the <a href="#/article/docs%2Ffeatures%2Fdesktop%2Fpassword-manager.md">password manager article</a>.</p>
<h2 id="portable-bookmark-documents">Portable bookmark documents</h2>
<p>A template can store a user-selected neutral JSON bookmark document in its encrypted backend
configuration. The native API accepts <code>portableBookmarks</code> with this shape:</p>
<pre><code class="language-json">{"version":1,"folderName":"Imported bookmarks","bookmarks":[{"name":"Example","url":"https://example.com/"}]}
</code></pre>
<p>Folders use <code>{"name":"Reference","children":[...]}</code> instead of <code>url</code>. Documents are limited
to64 KiB,500 entries, eight levels,256-character names and4096-character URLs. Unknown fields,
control characters, credentials, mixed folder/link entries and schemes other than HTTP(S) are
rejected. Validation makes no network requests and never discovers host browser directories.</p>
<p>The guest receives a generated <code>ManagedBookmarks</code> policy containing a separate read-only folder.
Existing editable bookmark files and restored browser state are not overwritten. Each backend
retains its own import, and immutable template revisions retain the associated document.
Removing an import affects the next fresh guest. Credentials and authenticated sessions are
outside this import format. Wizard input and exact pinned-browser recognition remain pending
until their separate built-interface and native runtime checks pass.</p>
<h2 id="storage-and-compatibility">Storage and compatibility</h2>
<p>Template metadata and saved archives use the existing vault encryption. Archive objects are
streamed in authenticated chunks rather than passing large payloads through renderer IPC.
Super Profiles are currently local-only and excluded from ordinary browser folder sync.
An interrupted import may leave unreachable encrypted objects, but must not publish an
incomplete revision. Existing browser profiles retain their original API and launch behavior.</p>
<p>WSL export omits only the transient root <code>browser/lock</code> marker. Literal anchored matching
preserves nested lock files and similarly named workspace files. Arbitrary links remain
invalid archive members. A forged or linked output cannot replace an encrypted revision.</p>
<h2 id="verification-status">Verification status</h2>
<p>The core has focused checks for locked-vault access, older metadata, validation, revision
conflicts, immutable restore, backend/engine isolation, multi-chunk encryption, tampered
objects and restart persistence. Source implementation is separate from native runtime proof.
Whole-template provisioning, all guest experiences, save-back, disposal, built-interface
accessibility and installer verification require their own source-bound acceptance evidence.
The roadmap and handoff retain outstanding work; this article is not a runtime receipt.</p>
<p>A <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/super-profiles/wsl-roundtrip-e92b352.json">native WSL workspace roundtrip receipt</a>
records two owned guest cycles against source <code>e92b352</code>. It proves synthetic workspace restoration,
encrypted save-back and exact owned-distro removal, with the unrelated distro inventory unchanged.
It used a separately verified base cache and canceled before graphical launch. It does not prove
the default download route, browser state, terminal UI, WSLg, desktop connection or Sandbox runtime.</p>
<p>The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/super-profiles/chromium-roundtrip-0719755.json">Chromium roundtrip</a>
and <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/super-profiles/firefox-roundtrip-f1816d6.json">Firefox roundtrip</a>
separately verify synthetic browser local storage and workspace restoration across two fresh
owned guests. Both run as the normal guest user with browser sandboxing enabled. The Firefox
result also verifies successful export with its transient root lock marker present. These
headless browser runs do not establish graphical WSLg, terminal or full desktop readiness.</p>
<p>The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/super-profiles/default-acquisition-f1816d6.json">default base acquisition</a>
started without a cached base or custom override, downloaded the pinned archive, verified its
checksum, completed setup and removed the exact owned guest. The <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/docs/evidence/super-profiles/build-f1816d6.json">installer build receipt</a>
records successful root entrypoint production and package hashes. Package production does not
prove installation, accepted-channel update or every guest experience.</p>
`,text:`# Super Profiles\r
\r
Super Profiles store reusable environment templates in the encrypted vault. They are separate\r
from ordinary browser profiles. Template changes and explicit save-back create immutable\r
revisions; stale writes are rejected rather than overwriting a newer revision.\r
\r
## Create a template\r
\r
Unlock the vault, open **Super Profiles**, and choose **Create Super Profile**. Give the\r
template a name, choose a browser engine and environment, then review its configuration.\r
Saving a template does not prove that the host can launch that environment. Read the actual\r
capability result before launching.\r
\r
WSL templates offer terminal, Linux browser and desktop modes. A locally supplied root\r
filesystem archive requires a matching SHA-256 digest. Browser and desktop modes also need\r
the corresponding guest packages and display support. Windows browser binaries cannot run\r
as Linux browser binaries.\r
\r
## Launch and save deliberately\r
\r
Review the standard-identity explanation before launching. These environments do not promise\r
anonymity, stable identity, portable credentials or recognition by websites. Browser state is\r
kept separate when the backend, engine or base environment changes.\r
\r
Use the session's actual returned state. Provisioning, a spawned process and a visually ready\r
desktop are different observations. A failed launch retains owned staging for recovery.\r
Never remove an unrelated WSL distribution to resolve a launch failure.\r
\r
Session health is shown separately from lifecycle state. WSL observations use a bounded\r
stream created during the authorized launch; polling status does not execute a new guest\r
command. Readiness records require the owned session, launch nonce, increasing sequence and\r
fresh host receipt time. Terminal readiness requires the normal user's interactive PTY.\r
Desktop readiness requires its authenticated Xfce session and matching-display window manager.\r
These observations verify processes, not visible desktop pixels. Stale or missing observations\r
remain unknown, and restarting the host requires explicit recovery rather than reattachment.\r
Stop an active session before saving when its current readiness is unknown.\r
\r
Full desktop mode provides browser and workspace entries. The browser entry uses the selected\r
engine with the same managed profile directory as browser mode. It does not silently import\r
the host's everyday browser profile.\r
\r
Explicit save-back requires a stopped browser and validated output. It creates a new encrypted\r
revision and preserves previous revisions. Restore selects an earlier revision and creates a\r
new current revision, so history remains available. Discard must destroy only the positively\r
identified owned session. Closing a Sandbox window directly can lose unexported changes.\r
\r
**Save back and close** first queues browser shutdown and collection of the selected workspace\r
and browser categories. Collection reports progress without holding the vault open. A collected\r
archive is not yet a saved revision. If the vault locks or the host restarts during collection,\r
unlock it and explicitly confirm that operation before encrypted finalization. A changed template\r
revision rejects finalization and retains the collected data for recovery. Stop and discard remain\r
available while locked, with private template metadata omitted from their responses.\r
\r
The Sandbox guest includes explicit save-and-close and discard-and-close controls. Save-and-close\r
exports stopped-browser state and a complete manifest before asking the host to finalize it.\r
Closing the Sandbox window itself cannot export state that has already been destroyed.\r
\r
## Guest password manager\r
\r
A WSL template can pair its guest browser with KeePassXC running inside the same guest. Set\r
\`passwordManager\` on the template with \`source: "wsl"\`, \`wslDistribution: "guest"\`, a guest\r
database path and the extension and passkeys switches (both default on). Provisioning stages and\r
installs the browser registrations only after the guest provides \`/usr/bin/keepassxc-proxy\`;\r
supply KeePassXC from the maintained lineage through the selected installers. Details and limits\r
are in the [password manager article](password-manager.md).\r
\r
## Portable bookmark documents\r
\r
A template can store a user-selected neutral JSON bookmark document in its encrypted backend\r
configuration. The native API accepts \`portableBookmarks\` with this shape:\r
\r
\`\`\`json\r
{"version":1,"folderName":"Imported bookmarks","bookmarks":[{"name":"Example","url":"https://example.com/"}]}\r
\`\`\`\r
\r
Folders use \`{"name":"Reference","children":[...]}\` instead of \`url\`. Documents are limited\r
to64 KiB,500 entries, eight levels,256-character names and4096-character URLs. Unknown fields,\r
control characters, credentials, mixed folder/link entries and schemes other than HTTP(S) are\r
rejected. Validation makes no network requests and never discovers host browser directories.\r
\r
The guest receives a generated \`ManagedBookmarks\` policy containing a separate read-only folder.\r
Existing editable bookmark files and restored browser state are not overwritten. Each backend\r
retains its own import, and immutable template revisions retain the associated document.\r
Removing an import affects the next fresh guest. Credentials and authenticated sessions are\r
outside this import format. Wizard input and exact pinned-browser recognition remain pending\r
until their separate built-interface and native runtime checks pass.\r
\r
## Storage and compatibility\r
\r
Template metadata and saved archives use the existing vault encryption. Archive objects are\r
streamed in authenticated chunks rather than passing large payloads through renderer IPC.\r
Super Profiles are currently local-only and excluded from ordinary browser folder sync.\r
An interrupted import may leave unreachable encrypted objects, but must not publish an\r
incomplete revision. Existing browser profiles retain their original API and launch behavior.\r
\r
WSL export omits only the transient root \`browser/lock\` marker. Literal anchored matching\r
preserves nested lock files and similarly named workspace files. Arbitrary links remain\r
invalid archive members. A forged or linked output cannot replace an encrypted revision.\r
\r
## Verification status\r
\r
The core has focused checks for locked-vault access, older metadata, validation, revision\r
conflicts, immutable restore, backend/engine isolation, multi-chunk encryption, tampered\r
objects and restart persistence. Source implementation is separate from native runtime proof.\r
Whole-template provisioning, all guest experiences, save-back, disposal, built-interface\r
accessibility and installer verification require their own source-bound acceptance evidence.\r
The roadmap and handoff retain outstanding work; this article is not a runtime receipt.\r
\r
A [native WSL workspace roundtrip receipt](../../evidence/super-profiles/wsl-roundtrip-e92b352.json)\r
records two owned guest cycles against source \`e92b352\`. It proves synthetic workspace restoration,\r
encrypted save-back and exact owned-distro removal, with the unrelated distro inventory unchanged.\r
It used a separately verified base cache and canceled before graphical launch. It does not prove\r
the default download route, browser state, terminal UI, WSLg, desktop connection or Sandbox runtime.\r
\r
The [Chromium roundtrip](../../evidence/super-profiles/chromium-roundtrip-0719755.json)\r
and [Firefox roundtrip](../../evidence/super-profiles/firefox-roundtrip-f1816d6.json)\r
separately verify synthetic browser local storage and workspace restoration across two fresh\r
owned guests. Both run as the normal guest user with browser sandboxing enabled. The Firefox\r
result also verifies successful export with its transient root lock marker present. These\r
headless browser runs do not establish graphical WSLg, terminal or full desktop readiness.\r
\r
The [default base acquisition](../../evidence/super-profiles/default-acquisition-f1816d6.json)\r
started without a cached base or custom override, downloaded the pinned archive, verified its\r
checksum, completed setup and removed the exact owned guest. The [installer build receipt](../../evidence/super-profiles/build-f1816d6.json)\r
records successful root entrypoint production and package hashes. Package production does not\r
prove installation, accepted-channel update or every guest experience.\r
`},{id:"docs/features/desktop/worldlens-design.md",title:"WorldLens desktop design",category:"features",html:`<h1 id="worldlens-desktop-design">WorldLens desktop design</h1>
<p>Material Browser uses WorldLens's Material Design 3 color roles, typography, shapes, elevation, state layers and motion in its existing React and Material Web desktop interface. The reference is pinned to WorldLens commit <code>aaf1063e1ad7826591fa4dd6f504d086451e645b</code>. The desktop keeps its own branding and profile-management workflows.</p>
<h2 id="appearance-and-navigation">Appearance and navigation</h2>
<p>A compact icon-and-label rail opens Profiles, Super Profiles, Synchronization and Settings. Setup and vault locking remain available. A labelled disclosure replaces the rail when space is limited. Open workspace tabs and the <code>Ctrl+Shift+F</code> catalog retain their existing destinations.</p>
<p>The interface uses locally bundled Roboto and Roboto Mono, blue selection colors, pill-shaped actions, 12 px fields, 16 px contained sections and 28 px dialogs. Profile tables and inspectors share the same surface hierarchy. Narrow layouts move the selected record into a full-width detail view with a Back action; wide tables scroll within their own region.</p>
<p>Fresh installations start in dark mode. Saved appearance choices remain authoritative. High contrast takes precedence over custom accents. Language, density, font, text scaling and reduced-motion preferences continue to apply through Settings.</p>
<h2 id="actions-and-sound">Actions and sound</h2>
<p>Visual changes preserve the native host boundary, per-profile operation reservations, explicit browser-identity consent, revision checks and protected settings persistence. Unsupported engine or guest capabilities remain visible as unavailable. The interface does not seed example profiles.</p>
<p><a href="#/article/docs%2Ffeatures%2Fdesktop%2Faction-sounds.md">Action sounds</a> provide short local completion and failure cues. Settings \u2192 Notifications includes an on/off switch, volume and preview. Quiet hours and accessibility preferences can suppress them; sounds never replace visible results.</p>
<h2 id="source-and-verification">Source and verification</h2>
<p>The target-owned <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/design/desktop/REFERENCE.md">design reference</a>, <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/design/desktop/STATES.md">state inventory</a> and <a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/design/desktop/worldlens-handoff.md">implementation handoff</a> document the adaptation. The checked-in design-system provenance records the upstream license and exact source hashes; the synchronization script checks the pinned source rather than silently following a moving branch.</p>
<p>Runtime evidence must identify its source, built bytes, viewport, language, theme and actual interface zoom. Linux Electron captures establish Linux rendered behavior only. They do not establish Windows installer, physical display scaling, guest-environment or speaker-output acceptance. Earlier desktop screenshots retain their original source identity and are historical after this remake.</p>
<p>The <a href="#/article/docs%2Fevidence%2Fdesktop%2Fworldlens%2FREADME.md">current desktop evidence</a> includes inspected profile, Settings, dialog and narrow-layout captures, with an exact inventory and coverage limits. Native preference writes require the existing Windows mutex implementation; Linux captures retain the resulting storage warning rather than bypassing that boundary. Theme and language variations use isolated startup preferences and do not prove native save/restart behavior.</p>
<h2 id="\u5EE3\u6771\u8A71">\u5EE3\u6771\u8A71</h2>
<p>\u684C\u9762\u4ECB\u9762\u6CBF\u7528 WorldLens \u5605 Material Design 3 \u85CD\u8272\u8272\u7CFB\u3001\u5B57\u6B3E\u3001\u5713\u89D2\u3001\u9670\u5F71\u540C\u52D5\u614B\u898F\u683C\uFF0C\u4FDD\u7559 Material Browser \u81EA\u5DF1\u5605\u540D\u7A31\u53CA\u8A2D\u5B9A\u6A94\u5DE5\u4F5C\u6D41\u7A0B\u3002\u5074\u908A\u5C0E\u89BD\u5217\u7528\u5716\u793A\u52A0\u6587\u5B57\uFF1B\u7A7A\u9593\u4E0D\u8DB3\u6642\u6539\u7528\u6709\u6A19\u7C64\u5605\u9078\u55AE\u3002\u8A2D\u5B9A\u6A94\u8868\u683C\u540C\u8A73\u7D30\u8CC7\u6599\u7528\u4E00\u81F4\u5C64\u6B21\uFF0C\u7A84\u8996\u7A97\u53EF\u958B\u555F\u5168\u5BEC\u8A73\u7D30\u8CC7\u6599\uFF0C\u518D\u6309\u8FD4\u56DE\u3002</p>
<p>\u5168\u65B0\u5B89\u88DD\u9810\u8A2D\u7528\u6DF1\u8272\u6A21\u5F0F\uFF0C\u5DF2\u5132\u5B58\u5605\u5916\u89C0\u9078\u64C7\u6703\u4FDD\u7559\uFF1B\u9AD8\u5C0D\u6BD4\u512A\u5148\u65BC\u81EA\u8A02\u91CD\u9EDE\u8272\u3002\u5B57\u6B3E\u96A8\u7A0B\u5F0F\u9644\u5E36\uFF0C\u5514\u9700\u8981\u7DB2\u7D61\u4E0B\u8F09\u3002\u8A9E\u8A00\u3001\u5B57\u9AD4\u5927\u5C0F\u3001\u5BC6\u5EA6\u540C\u6E1B\u5C11\u52D5\u614B\u8A2D\u5B9A\u7E7C\u7E8C\u751F\u6548\u3002</p>
<p>\u64CD\u4F5C\u540C\u610F\u3001\u539F\u751F\u4E3B\u7A0B\u5F0F\u9A57\u8B49\u3001\u7248\u672C\u6AA2\u67E5\u53CA\u8A2D\u5B9A\u5132\u5B58\u6A5F\u5236\u4FDD\u6301\u6709\u6548\u3002\u8A2D\u5B9A \u2192 \u901A\u77E5\u53EF\u95DC\u9589\u64CD\u4F5C\u97F3\u6548\u3001\u8ABF\u6574\u97F3\u91CF\u53CA\u8A66\u807D\uFF1B\u5B89\u975C\u6642\u6BB5\u540C\u7121\u969C\u7919\u8A2D\u5B9A\u6703\u6309\u9700\u8981\u975C\u97F3\u3002Linux \u756B\u9762\u9A57\u8B49\u5514\u4EE3\u8868\u5DF2\u5B8C\u6210 Windows \u5B89\u88DD\u7A0B\u5F0F\u3001\u8A2A\u5BA2\u74B0\u5883\u6216\u5BE6\u9AD4\u5587\u53ED\u9A57\u8B49\u3002</p>
`,text:`# WorldLens desktop design\r
\r
Material Browser uses WorldLens's Material Design 3 color roles, typography, shapes, elevation, state layers and motion in its existing React and Material Web desktop interface. The reference is pinned to WorldLens commit \`aaf1063e1ad7826591fa4dd6f504d086451e645b\`. The desktop keeps its own branding and profile-management workflows.\r
\r
## Appearance and navigation\r
\r
A compact icon-and-label rail opens Profiles, Super Profiles, Synchronization and Settings. Setup and vault locking remain available. A labelled disclosure replaces the rail when space is limited. Open workspace tabs and the \`Ctrl+Shift+F\` catalog retain their existing destinations.\r
\r
The interface uses locally bundled Roboto and Roboto Mono, blue selection colors, pill-shaped actions, 12 px fields, 16 px contained sections and 28 px dialogs. Profile tables and inspectors share the same surface hierarchy. Narrow layouts move the selected record into a full-width detail view with a Back action; wide tables scroll within their own region.\r
\r
Fresh installations start in dark mode. Saved appearance choices remain authoritative. High contrast takes precedence over custom accents. Language, density, font, text scaling and reduced-motion preferences continue to apply through Settings.\r
\r
## Actions and sound\r
\r
Visual changes preserve the native host boundary, per-profile operation reservations, explicit browser-identity consent, revision checks and protected settings persistence. Unsupported engine or guest capabilities remain visible as unavailable. The interface does not seed example profiles.\r
\r
[Action sounds](action-sounds.md) provide short local completion and failure cues. Settings \u2192 Notifications includes an on/off switch, volume and preview. Quiet hours and accessibility preferences can suppress them; sounds never replace visible results.\r
\r
## Source and verification\r
\r
The target-owned [design reference](../../../design/desktop/REFERENCE.md), [state inventory](../../../design/desktop/STATES.md) and [implementation handoff](../../../design/desktop/worldlens-handoff.md) document the adaptation. The checked-in design-system provenance records the upstream license and exact source hashes; the synchronization script checks the pinned source rather than silently following a moving branch.\r
\r
Runtime evidence must identify its source, built bytes, viewport, language, theme and actual interface zoom. Linux Electron captures establish Linux rendered behavior only. They do not establish Windows installer, physical display scaling, guest-environment or speaker-output acceptance. Earlier desktop screenshots retain their original source identity and are historical after this remake.\r
\r
The [current desktop evidence](../../evidence/desktop/worldlens/README.md) includes inspected profile, Settings, dialog and narrow-layout captures, with an exact inventory and coverage limits. Native preference writes require the existing Windows mutex implementation; Linux captures retain the resulting storage warning rather than bypassing that boundary. Theme and language variations use isolated startup preferences and do not prove native save/restart behavior.\r
\r
## \u5EE3\u6771\u8A71\r
\r
\u684C\u9762\u4ECB\u9762\u6CBF\u7528 WorldLens \u5605 Material Design 3 \u85CD\u8272\u8272\u7CFB\u3001\u5B57\u6B3E\u3001\u5713\u89D2\u3001\u9670\u5F71\u540C\u52D5\u614B\u898F\u683C\uFF0C\u4FDD\u7559 Material Browser \u81EA\u5DF1\u5605\u540D\u7A31\u53CA\u8A2D\u5B9A\u6A94\u5DE5\u4F5C\u6D41\u7A0B\u3002\u5074\u908A\u5C0E\u89BD\u5217\u7528\u5716\u793A\u52A0\u6587\u5B57\uFF1B\u7A7A\u9593\u4E0D\u8DB3\u6642\u6539\u7528\u6709\u6A19\u7C64\u5605\u9078\u55AE\u3002\u8A2D\u5B9A\u6A94\u8868\u683C\u540C\u8A73\u7D30\u8CC7\u6599\u7528\u4E00\u81F4\u5C64\u6B21\uFF0C\u7A84\u8996\u7A97\u53EF\u958B\u555F\u5168\u5BEC\u8A73\u7D30\u8CC7\u6599\uFF0C\u518D\u6309\u8FD4\u56DE\u3002\r
\r
\u5168\u65B0\u5B89\u88DD\u9810\u8A2D\u7528\u6DF1\u8272\u6A21\u5F0F\uFF0C\u5DF2\u5132\u5B58\u5605\u5916\u89C0\u9078\u64C7\u6703\u4FDD\u7559\uFF1B\u9AD8\u5C0D\u6BD4\u512A\u5148\u65BC\u81EA\u8A02\u91CD\u9EDE\u8272\u3002\u5B57\u6B3E\u96A8\u7A0B\u5F0F\u9644\u5E36\uFF0C\u5514\u9700\u8981\u7DB2\u7D61\u4E0B\u8F09\u3002\u8A9E\u8A00\u3001\u5B57\u9AD4\u5927\u5C0F\u3001\u5BC6\u5EA6\u540C\u6E1B\u5C11\u52D5\u614B\u8A2D\u5B9A\u7E7C\u7E8C\u751F\u6548\u3002\r
\r
\u64CD\u4F5C\u540C\u610F\u3001\u539F\u751F\u4E3B\u7A0B\u5F0F\u9A57\u8B49\u3001\u7248\u672C\u6AA2\u67E5\u53CA\u8A2D\u5B9A\u5132\u5B58\u6A5F\u5236\u4FDD\u6301\u6709\u6548\u3002\u8A2D\u5B9A \u2192 \u901A\u77E5\u53EF\u95DC\u9589\u64CD\u4F5C\u97F3\u6548\u3001\u8ABF\u6574\u97F3\u91CF\u53CA\u8A66\u807D\uFF1B\u5B89\u975C\u6642\u6BB5\u540C\u7121\u969C\u7919\u8A2D\u5B9A\u6703\u6309\u9700\u8981\u975C\u97F3\u3002Linux \u756B\u9762\u9A57\u8B49\u5514\u4EE3\u8868\u5DF2\u5B8C\u6210 Windows \u5B89\u88DD\u7A0B\u5F0F\u3001\u8A2A\u5BA2\u74B0\u5883\u6216\u5BE6\u9AD4\u5587\u53ED\u9A57\u8B49\u3002\r
`},{id:"docs/features/desktop/zip-gui-remake.md",title:"Material 3 Expressive desktop",category:"features",html:`<h1 id="material-3-expressive-desktop">Material 3 Expressive desktop</h1>
<p>The desktop renderer follows the eight artboards in the repository's <code>design/</code> folder (Main, Launch, SuperProfiles, Sync, Settings, Vault, Palette and Safety). The design's own stylesheet, <code>design/m3.css</code>, is vendored as <code>apps/desktop/src/design-system/m3.css</code>, so the running application uses the same component anatomy as the artboards: the custom title bar, the 96 dp navigation rail with a contextual FAB, rounded panes on a surface-container window, segmented lists, connected button groups, the expressive slider, switches with a handle icon, split buttons, the vibrant floating toolbar, segmented menus and dialogs with a hero icon.</p>
<p>Colour roles come from <code>design-system/m3-theme.css</code>, which maps every role used by the artboards onto the resolved presentation theme. Saved theme, accent and high-contrast choices therefore keep working. Fonts and Material Symbols Rounded are bundled locally; nothing is fetched from a CDN.</p>
<h2 id="destinations">Destinations</h2>
<table>
<thead>
<tr>
<th>Artboard</th>
<th>Renderer</th>
<th>Behaviour</th>
</tr>
</thead>
<tbody>
<tr>
<td>Main</td>
<td><code>app/Profiles.tsx</code>, <code>app/Shell.tsx</code></td>
<td>Vertical tab pane with pinned home, a Running group of live browsers and utility tabs; profile list with shaped avatars, run state, split Launch buttons, shift-click range selection, Ctrl+A and Escape; vibrant floating toolbar; context menu (right-click, Shift+F10 or the overflow button) with Enter, F2, Ctrl+D and Delete shortcuts; import and export of profile settings; inspector with Overview, Identity and Revisions</td>
</tr>
<tr>
<td>Launch</td>
<td><code>app/Launch.tsx</code></td>
<td>Engine radio list (the engine is fixed at creation, so the other engine is shown but not selectable), automation button group that is saved before launch, a review card whose items must all be confirmed, What happens and Running now with Stop</td>
</tr>
<tr>
<td>SuperProfiles</td>
<td><code>app/SuperProfiles.tsx</code>, <code>app/TemplateWizard.tsx</code></td>
<td>Template list, Overview, Session card with the loading indicator, save-back preview, split Save button with category choice, discard through the two-key confirmation, revision history with restore, host capabilities and a four-step template wizard</td>
</tr>
<tr>
<td>Sync</td>
<td><code>app/Sync.tsx</code></td>
<td>Storage card with wavy progress during push and pull, this computer with automatic sync every 10 minutes, the real sync folder from <code>sync.status</code>, join instructions and the conflict pane with a radio list of candidate revisions</td>
</tr>
<tr>
<td>Settings</td>
<td><code>app/Settings.tsx</code>, <code>settings/SettingControl.tsx</code></td>
<td>Navigation drawer with search and the regex builder, two-column grouped segmented lists, info and reset per row, section reset through the two-key confirmation</td>
</tr>
<tr>
<td>Vault</td>
<td><code>app/Vault.tsx</code></td>
<td>Create or unlock with a passphrase field that reports Caps Lock, join from another computer, and the four-step first run with linear progress</td>
</tr>
<tr>
<td>Palette</td>
<td><code>app/Palette.tsx</code>, <code>app/Live.tsx</code></td>
<td>Command palette with live rows (switches for on/off settings, Launch, Stop and Unlock actions), filter chips, regex builder, remembered card or full-window size; notification panel; snackbar with Undo; the dim sum surprise</td>
</tr>
<tr>
<td>Safety</td>
<td><code>settings/ConfirmAction.tsx</code>, <code>app/Safety.tsx</code></td>
<td>Two-key super confirmation with Emergency exit, the lock wizard with all six credential mixes, the unlock ladder and Support Tickets</td>
</tr>
</tbody>
</table>
<p>The window size classes from the design are honoured: below 1180 px the tab pane hides, below 860 px one pane shows at a time with a back button, and below 600 px the rail becomes a bottom navigation bar.</p>
<h2 id="new-features-carried-by-the-design">New features carried by the design</h2>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Felement-locks.md">Element locks, unlock ladder and Support Tickets</a></li>
<li>School mode: plain wording, no emoji and no dim sum surprises, kept per computer and optionally protected by a section lock.</li>
<li>Passwords and passkeys: defaults offered to new profiles for KeePassXC pairing.</li>
<li>Per-profile appearance: avatar shape and colour, saved on this computer.</li>
<li>Release code names: each version shows a dim sum code name in About.</li>
<li>Synchronization status: the core's <code>sync.status</code> reports whether a folder is configured, its path and the number of conflicts, so the screen shows real data instead of placeholders.</li>
</ul>
<h2 id="placeholders-from-the-artboards">Placeholders from the artboards</h2>
<p>The artboards use bracketed placeholders and sample records. In the application they come from real data: the version and source date in the title bar, the profile creation date, the sync folder and join date, and the device's running browsers. The dim sum surprise has no bundled photograph and says so.</p>
<h2 id="limits">Limits</h2>
<ul>
<li>Native preference storage depends on a Windows-only lock. On other platforms Settings reports that storage needs attention; section navigation still works but changes are not saved.</li>
<li>Stable browser identity, keep-both conflict resolution, a server-backed sync connection and QR pairing remain unavailable; the screens say so rather than imitating them.</li>
<li>Showing a running browser's window (<code>profiles.focus</code>) is not implemented by the native host; the button reports that plainly.</li>
</ul>
<p><a href="#/article/docs%2Fevidence%2Fdesktop%2Fm3-redesign%2FREADME.md">Runtime captures, method and hashes</a>.</p>
`,text:`# Material 3 Expressive desktop\r
\r
The desktop renderer follows the eight artboards in the repository's \`design/\` folder (Main, Launch, SuperProfiles, Sync, Settings, Vault, Palette and Safety). The design's own stylesheet, \`design/m3.css\`, is vendored as \`apps/desktop/src/design-system/m3.css\`, so the running application uses the same component anatomy as the artboards: the custom title bar, the 96 dp navigation rail with a contextual FAB, rounded panes on a surface-container window, segmented lists, connected button groups, the expressive slider, switches with a handle icon, split buttons, the vibrant floating toolbar, segmented menus and dialogs with a hero icon.\r
\r
Colour roles come from \`design-system/m3-theme.css\`, which maps every role used by the artboards onto the resolved presentation theme. Saved theme, accent and high-contrast choices therefore keep working. Fonts and Material Symbols Rounded are bundled locally; nothing is fetched from a CDN.\r
\r
## Destinations\r
\r
| Artboard | Renderer | Behaviour |\r
| --- | --- | --- |\r
| Main | \`app/Profiles.tsx\`, \`app/Shell.tsx\` | Vertical tab pane with pinned home, a Running group of live browsers and utility tabs; profile list with shaped avatars, run state, split Launch buttons, shift-click range selection, Ctrl+A and Escape; vibrant floating toolbar; context menu (right-click, Shift+F10 or the overflow button) with Enter, F2, Ctrl+D and Delete shortcuts; import and export of profile settings; inspector with Overview, Identity and Revisions |\r
| Launch | \`app/Launch.tsx\` | Engine radio list (the engine is fixed at creation, so the other engine is shown but not selectable), automation button group that is saved before launch, a review card whose items must all be confirmed, What happens and Running now with Stop |\r
| SuperProfiles | \`app/SuperProfiles.tsx\`, \`app/TemplateWizard.tsx\` | Template list, Overview, Session card with the loading indicator, save-back preview, split Save button with category choice, discard through the two-key confirmation, revision history with restore, host capabilities and a four-step template wizard |\r
| Sync | \`app/Sync.tsx\` | Storage card with wavy progress during push and pull, this computer with automatic sync every 10 minutes, the real sync folder from \`sync.status\`, join instructions and the conflict pane with a radio list of candidate revisions |\r
| Settings | \`app/Settings.tsx\`, \`settings/SettingControl.tsx\` | Navigation drawer with search and the regex builder, two-column grouped segmented lists, info and reset per row, section reset through the two-key confirmation |\r
| Vault | \`app/Vault.tsx\` | Create or unlock with a passphrase field that reports Caps Lock, join from another computer, and the four-step first run with linear progress |\r
| Palette | \`app/Palette.tsx\`, \`app/Live.tsx\` | Command palette with live rows (switches for on/off settings, Launch, Stop and Unlock actions), filter chips, regex builder, remembered card or full-window size; notification panel; snackbar with Undo; the dim sum surprise |\r
| Safety | \`settings/ConfirmAction.tsx\`, \`app/Safety.tsx\` | Two-key super confirmation with Emergency exit, the lock wizard with all six credential mixes, the unlock ladder and Support Tickets |\r
\r
The window size classes from the design are honoured: below 1180 px the tab pane hides, below 860 px one pane shows at a time with a back button, and below 600 px the rail becomes a bottom navigation bar.\r
\r
## New features carried by the design\r
\r
- [Element locks, unlock ladder and Support Tickets](element-locks.md)\r
- School mode: plain wording, no emoji and no dim sum surprises, kept per computer and optionally protected by a section lock.\r
- Passwords and passkeys: defaults offered to new profiles for KeePassXC pairing.\r
- Per-profile appearance: avatar shape and colour, saved on this computer.\r
- Release code names: each version shows a dim sum code name in About.\r
- Synchronization status: the core's \`sync.status\` reports whether a folder is configured, its path and the number of conflicts, so the screen shows real data instead of placeholders.\r
\r
## Placeholders from the artboards\r
\r
The artboards use bracketed placeholders and sample records. In the application they come from real data: the version and source date in the title bar, the profile creation date, the sync folder and join date, and the device's running browsers. The dim sum surprise has no bundled photograph and says so.\r
\r
## Limits\r
\r
- Native preference storage depends on a Windows-only lock. On other platforms Settings reports that storage needs attention; section navigation still works but changes are not saved.\r
- Stable browser identity, keep-both conflict resolution, a server-backed sync connection and QR pairing remain unavailable; the screens say so rather than imitating them.\r
- Showing a running browser's window (\`profiles.focus\`) is not implemented by the native host; the button reports that plainly.\r
\r
[Runtime captures, method and hashes](../../evidence/desktop/m3-redesign/README.md).\r
`},{id:"docs/features/documentation/README.md",title:"Documentation delivery",category:"features",html:`<h1 id="documentation-delivery">Documentation delivery</h1>
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
`},{id:"docs/features/engines/native-source-evidence.md",title:"Native source acquisition evidence",category:"features",html:`<h1 id="native-source-acquisition-evidence">Native source acquisition evidence</h1>
<p>Chromium source is pinned to <code>0e66b94549a8bd85f03fbdf189b752d6e7b63c32</code>
(155.0.8059.85). Firefox source is pinned to
<code>3c71aeacdb296402e41fb2084b13e797d1770642</code> (158.0).</p>
<p>The first Chromium dependency synchronization stopped with CIPD exit 1. Windows returned:</p>
<blockquote>
<p>Operation did not complete successfully because the file contains a virus or potentially unwanted software.</p>
</blockquote>
<p>The exact package was <code>chromium/third_party/updater/chrome_win_x86</code>, instance
<code>NuXBEfKu8082d55WUbs6_3P0puTPCI4A1Df4BnQ1Z40C</code>. This records the scanner's result,
not a determination of malware or a false-positive claim. No security setting or exclusion
was changed, and the blocked payload was not renamed, repackaged or retried separately.</p>
<p>The selected build target is unbranded <code>chrome</code> for x64. The pinned upstream
<a href="https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/third_party/updater/BUILD.gn"><code>third_party/updater/BUILD.gn</code></a>
lines 7-21 declares the consuming <code>old_updater</code> copy target <code>testonly = true</code>, with the
affected payload inside <code>is_chrome_branded</code>. The other reference in
<a href="https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/chrome/updater/BUILD.gn"><code>chrome/updater/BUILD.gn</code></a>
lines 1128-1134 belongs to updater test data under <code>target_cpu == "x86"</code>.
An attempted <code>.gclient</code> <code>custom_deps</code> override for exactly
<code>src/third_party/updater/chrome_win_x86/cipd</code> did not suppress the CIPD package in the pinned
depot-tools implementation. The changed-configuration retry ended with the same scanner
rejection. No further retry is authorized without first proving, offline, that a reviewed
source-level optional-fixture filter actually omits it. Updater integration tests needing this
fixture remain unavailable. No security protection was changed. Native Chromium dependency
synchronization and compilation remain incomplete.</p>
<p>Firefox acquisition completed at its exact revision. MozillaBuild 4.2.1 was verified with
a valid Mozilla publisher signature and installer SHA-256
<code>8ef5b3d2087e4867dc75bf19f5e62f12e917f518239415723cc70896b6f1e3d8</code>.
The installer used its supported default destination, which was independently read back.
The initial presence probe found no default shell; this is current-host evidence, not a
fresh-environment claim. Firefox bootstrap uses its supported <code>--no-system-changes</code> option;
the selected source's <code>Bootstrapper._add_microsoft_defender_antivirus_exclusions</code> returns
immediately under that option. No antivirus exclusions are authorized by this build route.</p>
<h2 id="preservation-state">Preservation state</h2>
<p>The native Rust engine's eleven focused tests passed after the bounded graceful-close repair.
An earlier revision completed the root release build. The latest graceful-close revision still
requires the real hidden-browser retry; do not infer that result from the unit tests.</p>
<p><code>chromium-155-profile-key.patch</code> adds a current provider, production startup registration and
GN source ownership. Patch application was checked against the pinned source. It is not applied
to the native build tree, compiled, or enabled. The authenticated host-side key channel, Firefox
key integration, stable identity across frames/workers and whole-profile live snapshot barrier
are unfinished. All advanced capabilities remain disabled.</p>
<p>Firefox's root-entrypoint operation was still bootstrapping its private Visual Studio toolchain
at the preservation boundary. It had not produced a native browser. Preserve its existing
operation and read the eventual exit result before deciding whether any retry is appropriate.
The managed stock browser bundles are baseline automation inputs only and remain immutable
while their independent runtime matrix is active.</p>
`,text:`# Native source acquisition evidence\r
\r
Chromium source is pinned to \`0e66b94549a8bd85f03fbdf189b752d6e7b63c32\`\r
(155.0.8059.85). Firefox source is pinned to\r
\`3c71aeacdb296402e41fb2084b13e797d1770642\` (158.0).\r
\r
The first Chromium dependency synchronization stopped with CIPD exit 1. Windows returned:\r
\r
> Operation did not complete successfully because the file contains a virus or potentially unwanted software.\r
\r
The exact package was \`chromium/third_party/updater/chrome_win_x86\`, instance\r
\`NuXBEfKu8082d55WUbs6_3P0puTPCI4A1Df4BnQ1Z40C\`. This records the scanner's result,\r
not a determination of malware or a false-positive claim. No security setting or exclusion\r
was changed, and the blocked payload was not renamed, repackaged or retried separately.\r
\r
The selected build target is unbranded \`chrome\` for x64. The pinned upstream\r
[\`third_party/updater/BUILD.gn\`](https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/third_party/updater/BUILD.gn)\r
lines 7-21 declares the consuming \`old_updater\` copy target \`testonly = true\`, with the\r
affected payload inside \`is_chrome_branded\`. The other reference in\r
[\`chrome/updater/BUILD.gn\`](https://chromium.googlesource.com/chromium/src/+/0e66b94549a8bd85f03fbdf189b752d6e7b63c32/chrome/updater/BUILD.gn)\r
lines 1128-1134 belongs to updater test data under \`target_cpu == "x86"\`.\r
An attempted \`.gclient\` \`custom_deps\` override for exactly\r
\`src/third_party/updater/chrome_win_x86/cipd\` did not suppress the CIPD package in the pinned\r
depot-tools implementation. The changed-configuration retry ended with the same scanner\r
rejection. No further retry is authorized without first proving, offline, that a reviewed\r
source-level optional-fixture filter actually omits it. Updater integration tests needing this\r
fixture remain unavailable. No security protection was changed. Native Chromium dependency\r
synchronization and compilation remain incomplete.\r
\r
Firefox acquisition completed at its exact revision. MozillaBuild 4.2.1 was verified with\r
a valid Mozilla publisher signature and installer SHA-256\r
\`8ef5b3d2087e4867dc75bf19f5e62f12e917f518239415723cc70896b6f1e3d8\`.\r
The installer used its supported default destination, which was independently read back.\r
The initial presence probe found no default shell; this is current-host evidence, not a\r
fresh-environment claim. Firefox bootstrap uses its supported \`--no-system-changes\` option;\r
the selected source's \`Bootstrapper._add_microsoft_defender_antivirus_exclusions\` returns\r
immediately under that option. No antivirus exclusions are authorized by this build route.\r
\r
## Preservation state\r
\r
The native Rust engine's eleven focused tests passed after the bounded graceful-close repair.\r
An earlier revision completed the root release build. The latest graceful-close revision still\r
requires the real hidden-browser retry; do not infer that result from the unit tests.\r
\r
\`chromium-155-profile-key.patch\` adds a current provider, production startup registration and\r
GN source ownership. Patch application was checked against the pinned source. It is not applied\r
to the native build tree, compiled, or enabled. The authenticated host-side key channel, Firefox\r
key integration, stable identity across frames/workers and whole-profile live snapshot barrier\r
are unfinished. All advanced capabilities remain disabled.\r
\r
Firefox's root-entrypoint operation was still bootstrapping its private Visual Studio toolchain\r
at the preservation boundary. It had not produced a native browser. Preserve its existing\r
operation and read the eventual exit result before deciding whether any retry is appropriate.\r
The managed stock browser bundles are baseline automation inputs only and remain immutable\r
while their independent runtime matrix is active.\r
`},{id:"docs/features/engines/native-source-recovery-archive.md",title:"Historical native-source recovery handoff",category:"features",html:`<h1 id="historical-native-source-recovery-handoff">Historical native-source recovery handoff</h1>
<p>This is the preserved source-candidate handoff from499a20f. Its observations and blockers are historical. It does not establish a compiled provider, advanced identity, portable credentials or current runtime acceptance. The working installer continues to use the separate stock-browser bundle.</p>
<h1 id="engine-lane-continuation">Engine lane continuation</h1>
<p>The engine lane is incomplete. Preserve the current branch and all native source caches.
The root coordinator owns remote publication, integration and runtime capture coordination.</p>
<p>Completed source units include durable launch intent and exact native PID/creation/executable/
profile checks, profile mutation leases outside the profile directory, Windows job containment,
loopback automation endpoint receipts and bounded graceful window-close polling. Eleven focused
engine tests passed. The earlier job-containment revision completed the root release build;
the latest stop repair still needs a real browser runtime verdict.</p>
<p>Current Chromium and Firefox source pins and exact scanner evidence are recorded in
<code>docs/features/engines/native-source-evidence.md</code> and <code>engines/recipes/native-pins.json</code>.
Chromium dependency synchronization is blocked by a rejected optional updater test payload.
The attempted custom dependency override was ineffective. Do not repeat retrieval or weaken
host protection. A future reviewed optional-fixture source filter must first prove exclusion
offline and preserve the required x64 browser build graph.</p>
<p>Firefox source acquisition and the supported baseline build succeeded at pinned upstream
revision <code>3c71aeacdb296402e41fb2084b13e797d1770642</code>. Source commit
<code>b7930673bf49d10571ed257cf987c7acef4a172d</code> then passed the exact root command
<code>build.bat -Component BrowserNative -NativeEngine firefox -NativeCookieSnapshotTests</code>
on a named hidden desktop: production compilation succeeded, and the native cookie queue
regression passed one test with zero unexpected results. The root exit was zero.
The packaged privileged-module smoke passed separately against the preceding baseline.
See <code>engines/native/firefox/native-verification.json</code> for hashes, timing and limitations.
The wrapper exited normally and its hidden desktop was absent afterward. No producer remains
active from that run. Preserve the source cache and reviewed patches. The native cookie queue
lease is concrete compiled code, but no storage providers or external snapshot endpoint are
registered. Authenticated key delivery, Firefox key integration, frame/worker identity and
consistent whole-profile live snapshots remain unfinished and disabled. The root coordinator
owns integration; this lane does not modify the default branch.</p>
<p>The Chromium 155 key-provider patch has production registration and build-source ownership,
but only patch application has been verified. It is not runtime proof. Preserve baseline browser
bundles without changing their bytes or adapter manifests while the runtime matrix is active.</p>
<p>No cleanup is authorized for active or incomplete work. Resume from the root coordinator's
exact live-operation handles and remote-ref readback; no release or completion is claimed.</p>
`,text:`# Historical native-source recovery handoff

This is the preserved source-candidate handoff from499a20f. Its observations and blockers are historical. It does not establish a compiled provider, advanced identity, portable credentials or current runtime acceptance. The working installer continues to use the separate stock-browser bundle.

# Engine lane continuation

The engine lane is incomplete. Preserve the current branch and all native source caches.
The root coordinator owns remote publication, integration and runtime capture coordination.

Completed source units include durable launch intent and exact native PID/creation/executable/
profile checks, profile mutation leases outside the profile directory, Windows job containment,
loopback automation endpoint receipts and bounded graceful window-close polling. Eleven focused
engine tests passed. The earlier job-containment revision completed the root release build;
the latest stop repair still needs a real browser runtime verdict.

Current Chromium and Firefox source pins and exact scanner evidence are recorded in
\`docs/features/engines/native-source-evidence.md\` and \`engines/recipes/native-pins.json\`.
Chromium dependency synchronization is blocked by a rejected optional updater test payload.
The attempted custom dependency override was ineffective. Do not repeat retrieval or weaken
host protection. A future reviewed optional-fixture source filter must first prove exclusion
offline and preserve the required x64 browser build graph.

Firefox source acquisition and the supported baseline build succeeded at pinned upstream
revision \`3c71aeacdb296402e41fb2084b13e797d1770642\`. Source commit
\`b7930673bf49d10571ed257cf987c7acef4a172d\` then passed the exact root command
\`build.bat -Component BrowserNative -NativeEngine firefox -NativeCookieSnapshotTests\`
on a named hidden desktop: production compilation succeeded, and the native cookie queue
regression passed one test with zero unexpected results. The root exit was zero.
The packaged privileged-module smoke passed separately against the preceding baseline.
See \`engines/native/firefox/native-verification.json\` for hashes, timing and limitations.
The wrapper exited normally and its hidden desktop was absent afterward. No producer remains
active from that run. Preserve the source cache and reviewed patches. The native cookie queue
lease is concrete compiled code, but no storage providers or external snapshot endpoint are
registered. Authenticated key delivery, Firefox key integration, frame/worker identity and
consistent whole-profile live snapshots remain unfinished and disabled. The root coordinator
owns integration; this lane does not modify the default branch.

The Chromium 155 key-provider patch has production registration and build-source ownership,
but only patch application has been verified. It is not runtime proof. Preserve baseline browser
bundles without changing their bytes or adapter manifests while the runtime matrix is active.

No cleanup is authorized for active or incomplete work. Resume from the root coordinator's
exact live-operation handles and remote-ref readback; no release or completion is claimed.
`},{id:"docs/features/servers/README.md",title:"Server management native service",category:"features",html:`<h1 id="server-management-native-service">Server management native service</h1>
<ul>
<li><a href="#/article/docs%2Ffeatures%2Fservers%2Fworld-generation-readiness.md">World-generation readiness and version boundaries</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fservers%2Fworldgen-cache-recovery.md">World-generation cache validation and explicit recovery</a></li>
</ul>
<p>The privileged desktop service owns managed Java vanilla installations under application data. It retrieves the full official Mojang catalogue, verifies selected metadata and server SHA-1 and size, and distinguishes historical client-only entries from dedicated server distributions. Discovery does not establish runtime support for every version. Installation requires explicit EULA consent.</p>
<h2 id="request-interface">Request interface</h2>
<p>Use <code>createGameServerService({dataDir}).request({action, params})</code>. Actions: capabilities, list, discoverVersions, resolveVersion, create, readConfiguration, configure, start, stop, restart, logs, cancel, backup, listBackups, restore, listContent, installContent and removeContent. Actions return native data or reject with a stable error code and a message. The GUI must honor the capability flags and target-specific restrictions.</p>
<p>Creation accepts name, version, edition (<code>java</code>), flavour (<code>vanilla</code>), target, memoryMb, port, eulaAccepted and an optional operationId for cancellation. The four targets are <code>local-process</code>, <code>local-docker</code>, <code>ssh-process</code> and <code>ssh-docker</code>. Container targets additionally require an immutable <code>eclipse-temurin@sha256:</code> image identity. SSH targets require an ssh object with host, username, port, remoteRoot, javaPath and optional absolute identityFile/knownHostsFile paths. SSH credentials are never accepted in request text or persisted in records. Existing native SSH authentication and strict preverified host-key trust are required. Remote targets currently support Linux paths.</p>
<p>Local process start requires an absolute javaPath. Each adapter probes the exact Java major declared by official metadata. Historical entries without that declaration remain unresolved. Native commands use argument arrays without a local shell. The SSH protocol uses fixed, quoted remote commands whose host/path/runtime fields are validated. Remote provisioning refuses to adopt an existing destination and transfers installation/configuration files without overwriting remote worlds. Containers use an explicit Java entrypoint, bounded memory and a loopback-only published port. Native Java installations default to loopback binding.</p>
<h2 id="lifecycle-and-recovery">Lifecycle and recovery</h2>
<p>Only processes created by the service are controlled. A spawned process is <code>starting</code>, not server-ready evidence. Players, performance and listener readiness remain unavailable. Stop writes the native server stop command and waits 15 seconds. Timeout stays pending without force termination. The application must await dispose before quitting and preserve its owner process if graceful shutdown remains pending.</p>
<p>A surviving process receipt after interrupted application ownership is unknown and blocks mutation. SSH/container connection loss remains disconnected or unknown rather than stopped. Previous process identifiers are never blindly adopted or terminated. Recovery currently requires independent identity reconciliation before reuse.</p>
<h2 id="configuration-and-data">Configuration and data</h2>
<p>Rich descriptors currently cover server port and ASCII message of the day. Unknown properties are preserved, and every duplicate occurrence of a changed key is updated consistently. SSH configuration changes are transferred only after local validation and persistence.</p>
<p>Stopped local targets support backups bounded to 10000 files and 10 GiB. SHA-256 inventories verify every file, linked/shared/special files are rejected, and same-version restore creates a rollback backup before replacement. This does not prove safe world downgrade, migration or cross-machine restoration. Remote-world backup/restore transfer is explicitly unavailable.</p>
<p>Local vanilla data packs accept explicitly selected ZIP bytes (at most 32 MiB), supplied SHA-256 and acknowledgement that compatibility is unknown. Files remain archived and are never extracted by the manager. The current destination is the default world data-pack directory. Plugin/mod loaders, catalogue licensing and compatibility automation remain incomplete. Removing unchanged digest-named managed content creates a backup first. Remote content transfer remains unavailable.</p>
<h2 id="verification-and-remaining-work">Verification and remaining work</h2>
<p>Run <code>node --test apps/desktop/electron/services/game-servers/index.test.cjs</code>. Sixteen focused tests cover consent, persistence, official integrity checks, historical entries, invalid targets/paths, configuration preservation/duplicates, backup/restore/tampering, interrupted ownership, pinned images, content rejection, strict SSH arguments and injected owned lifecycle start/stop, restart and disposal admission/in-flight races.</p>
<p>Read-only official discovery on 2026-11-01 returned 921 versions, from 26.4-snapshot-6 to rd-132211. The current host reports Java 26.0.2.1 and provides OpenSSH executables. The local Docker daemon is unavailable because its expected named pipe does not exist. No real server was launched, no real EULA acceptance was invented, and no SSH host/runtime operation was verified. These source and test results are separate from runtime, GUI and deployment acceptance.</p>
<p>Bedrock distribution installation, third-party flavours, runtime provisioning, server readiness, typed administration, players/permissions/metrics, schedules, remote data transfers, complete version-bound configuration and world migration remain incomplete.</p>
<h2 id="consolidated-typed-configuration">Consolidated typed configuration</h2>
<p>The single game-servers service reuses the typed properties inventory in <code>electron/minecraft/properties.cjs</code>; no second registry or lifecycle owner is introduced. Its parser retains unchanged byte formatting, comments, unknown keys, escaped key identities, Unicode and continuation lines. Every duplicate occurrence of an edited key receives the same effective value. Malformed stored numeric/switch values remain visible with validation detail instead of acquiring guessed fallback values.</p>
<p>Numeric release identifiers retain declared version boundaries. Snapshot, prerelease and historical identifiers without a schema expose unresolved applicability and no invented defaults; only the common message and port controls remain available. All descriptors remain implemented but runtime-unverified. The service currently persists configuration while stopped, so it exposes restart behavior even for descriptors that describe a possible live command in a future consumer.</p>
<p>Verification: <code>node --test apps/desktop/electron/minecraft/properties.test.cjs apps/desktop/electron/services/game-servers/index.test.cjs</code> passed 24 tests. This includes preservation, Unicode, duplicate escaped keys, version uncertainty, invalid stored values and prototype-safe property names. It is separate from actual server-version runtime acceptance.</p>
<h2 id="flavour-catalogues-and-distribution-integrity">Flavour catalogues and distribution integrity</h2>
<p>The sole service supports vanilla, Paper and Fabric resolution. <code>discoverVersions({flavour})</code> retains each provider-listed version, including explicit unavailable rows where provider identifiers have no matching current Java metadata. <code>resolveVersion({version,flavour,buildId?,loaderVersion?,installerVersion?})</code> binds the exact distribution before creation.</p>
<p>Paper selects an explicitly chosen build or a stable build, never an experimental fallback. It requires bounded published SHA-256 metadata and verifies downloaded bytes. Fabric resolves the loader against the selected game version and binds an exact installer. Its bootstrap endpoint has no published catalogue checksum, so the response discloses that limit and creation requires <code>unverifiedDistributionAccepted: true</code>. The recorded local SHA-256 binds later launches to those installed bytes and does not become publisher verification. The standard Fabric bootstrap may download additional components on first launch; those are not falsely included in the manager's own integrity verdict.</p>
<p>Provider references: <a href="https://docs.papermc.io/misc/downloads-service/">Paper downloads service</a>, <a href="https://fabricmc.net/use/?page=server">Fabric server launcher</a> and <a href="https://meta.fabricmc.net/">Fabric metadata API</a>. The provider user-agent identifies Material Browser and its public source/contact URL.</p>
<p>Read-only live provider checks at 2026-11-01T07:28Z returned 68 Paper version identifiers and 533 Fabric identifiers. Of the Fabric identifiers, 26 had no matching current Mojang catalogue entry and remain unavailable with an explicit reason. No server or bootstrap was launched. Thirty focused tests pass across the typed-properties, flavour and native service suites; runtime installation acceptance remains separate.</p>
`,text:`# Server management native service\r
\r
- [World-generation readiness and version boundaries](world-generation-readiness.md)\r
- [World-generation cache validation and explicit recovery](worldgen-cache-recovery.md)\r
\r
The privileged desktop service owns managed Java vanilla installations under application data. It retrieves the full official Mojang catalogue, verifies selected metadata and server SHA-1 and size, and distinguishes historical client-only entries from dedicated server distributions. Discovery does not establish runtime support for every version. Installation requires explicit EULA consent.\r
\r
## Request interface\r
\r
Use \`createGameServerService({dataDir}).request({action, params})\`. Actions: capabilities, list, discoverVersions, resolveVersion, create, readConfiguration, configure, start, stop, restart, logs, cancel, backup, listBackups, restore, listContent, installContent and removeContent. Actions return native data or reject with a stable error code and a message. The GUI must honor the capability flags and target-specific restrictions.\r
\r
Creation accepts name, version, edition (\`java\`), flavour (\`vanilla\`), target, memoryMb, port, eulaAccepted and an optional operationId for cancellation. The four targets are \`local-process\`, \`local-docker\`, \`ssh-process\` and \`ssh-docker\`. Container targets additionally require an immutable \`eclipse-temurin@sha256:\` image identity. SSH targets require an ssh object with host, username, port, remoteRoot, javaPath and optional absolute identityFile/knownHostsFile paths. SSH credentials are never accepted in request text or persisted in records. Existing native SSH authentication and strict preverified host-key trust are required. Remote targets currently support Linux paths.\r
\r
Local process start requires an absolute javaPath. Each adapter probes the exact Java major declared by official metadata. Historical entries without that declaration remain unresolved. Native commands use argument arrays without a local shell. The SSH protocol uses fixed, quoted remote commands whose host/path/runtime fields are validated. Remote provisioning refuses to adopt an existing destination and transfers installation/configuration files without overwriting remote worlds. Containers use an explicit Java entrypoint, bounded memory and a loopback-only published port. Native Java installations default to loopback binding.\r
\r
## Lifecycle and recovery\r
\r
Only processes created by the service are controlled. A spawned process is \`starting\`, not server-ready evidence. Players, performance and listener readiness remain unavailable. Stop writes the native server stop command and waits 15 seconds. Timeout stays pending without force termination. The application must await dispose before quitting and preserve its owner process if graceful shutdown remains pending.\r
\r
A surviving process receipt after interrupted application ownership is unknown and blocks mutation. SSH/container connection loss remains disconnected or unknown rather than stopped. Previous process identifiers are never blindly adopted or terminated. Recovery currently requires independent identity reconciliation before reuse.\r
\r
## Configuration and data\r
\r
Rich descriptors currently cover server port and ASCII message of the day. Unknown properties are preserved, and every duplicate occurrence of a changed key is updated consistently. SSH configuration changes are transferred only after local validation and persistence.\r
\r
Stopped local targets support backups bounded to 10000 files and 10 GiB. SHA-256 inventories verify every file, linked/shared/special files are rejected, and same-version restore creates a rollback backup before replacement. This does not prove safe world downgrade, migration or cross-machine restoration. Remote-world backup/restore transfer is explicitly unavailable.\r
\r
Local vanilla data packs accept explicitly selected ZIP bytes (at most 32 MiB), supplied SHA-256 and acknowledgement that compatibility is unknown. Files remain archived and are never extracted by the manager. The current destination is the default world data-pack directory. Plugin/mod loaders, catalogue licensing and compatibility automation remain incomplete. Removing unchanged digest-named managed content creates a backup first. Remote content transfer remains unavailable.\r
\r
## Verification and remaining work\r
\r
Run \`node --test apps/desktop/electron/services/game-servers/index.test.cjs\`. Sixteen focused tests cover consent, persistence, official integrity checks, historical entries, invalid targets/paths, configuration preservation/duplicates, backup/restore/tampering, interrupted ownership, pinned images, content rejection, strict SSH arguments and injected owned lifecycle start/stop, restart and disposal admission/in-flight races.\r
\r
Read-only official discovery on 2026-11-01 returned 921 versions, from 26.4-snapshot-6 to rd-132211. The current host reports Java 26.0.2.1 and provides OpenSSH executables. The local Docker daemon is unavailable because its expected named pipe does not exist. No real server was launched, no real EULA acceptance was invented, and no SSH host/runtime operation was verified. These source and test results are separate from runtime, GUI and deployment acceptance.\r
\r
Bedrock distribution installation, third-party flavours, runtime provisioning, server readiness, typed administration, players/permissions/metrics, schedules, remote data transfers, complete version-bound configuration and world migration remain incomplete.\r
\r
\r
## Consolidated typed configuration\r
\r
The single game-servers service reuses the typed properties inventory in \`electron/minecraft/properties.cjs\`; no second registry or lifecycle owner is introduced. Its parser retains unchanged byte formatting, comments, unknown keys, escaped key identities, Unicode and continuation lines. Every duplicate occurrence of an edited key receives the same effective value. Malformed stored numeric/switch values remain visible with validation detail instead of acquiring guessed fallback values.\r
\r
Numeric release identifiers retain declared version boundaries. Snapshot, prerelease and historical identifiers without a schema expose unresolved applicability and no invented defaults; only the common message and port controls remain available. All descriptors remain implemented but runtime-unverified. The service currently persists configuration while stopped, so it exposes restart behavior even for descriptors that describe a possible live command in a future consumer.\r
\r
Verification: \`node --test apps/desktop/electron/minecraft/properties.test.cjs apps/desktop/electron/services/game-servers/index.test.cjs\` passed 24 tests. This includes preservation, Unicode, duplicate escaped keys, version uncertainty, invalid stored values and prototype-safe property names. It is separate from actual server-version runtime acceptance.\r
\r
## Flavour catalogues and distribution integrity\r
\r
The sole service supports vanilla, Paper and Fabric resolution. \`discoverVersions({flavour})\` retains each provider-listed version, including explicit unavailable rows where provider identifiers have no matching current Java metadata. \`resolveVersion({version,flavour,buildId?,loaderVersion?,installerVersion?})\` binds the exact distribution before creation.\r
\r
Paper selects an explicitly chosen build or a stable build, never an experimental fallback. It requires bounded published SHA-256 metadata and verifies downloaded bytes. Fabric resolves the loader against the selected game version and binds an exact installer. Its bootstrap endpoint has no published catalogue checksum, so the response discloses that limit and creation requires \`unverifiedDistributionAccepted: true\`. The recorded local SHA-256 binds later launches to those installed bytes and does not become publisher verification. The standard Fabric bootstrap may download additional components on first launch; those are not falsely included in the manager's own integrity verdict.\r
\r
Provider references: [Paper downloads service](https://docs.papermc.io/misc/downloads-service/), [Fabric server launcher](https://fabricmc.net/use/?page=server) and [Fabric metadata API](https://meta.fabricmc.net/). The provider user-agent identifies Material Browser and its public source/contact URL.\r
\r
Read-only live provider checks at 2026-11-01T07:28Z returned 68 Paper version identifiers and 533 Fabric identifiers. Of the Fabric identifiers, 26 had no matching current Mojang catalogue entry and remain unavailable with an explicit reason. No server or bootstrap was launched. Thirty focused tests pass across the typed-properties, flavour and native service suites; runtime installation acceptance remains separate.\r
`},{id:"docs/features/servers/world-generation-readiness.md",title:"World-generation readiness and completion evidence",category:"features",html:`<h1 id="world-generation-readiness-and-completion-evidence">World-generation readiness and completion evidence</h1>
<h2 id="complete-preset-discovery">Complete preset discovery</h2>
<p>The selected JAR's complete preset identity list is retained in <code>presets</code>. Each identity also
has a <code>presetOptions</code> record with <code>id</code>, <code>supported</code> and a nullable <code>reason</code>. The support flag
describes the current customization builder; top-level <code>supported</code> separately requires the
selected version's readiness capability and at least one implemented preset.</p>
<p>Unsupported entries, including <code>minecraft:debug_all_block_states</code> and unfamiliar future IDs,
remain in the inventory with an explicit reason. Validation rejects a discovered but
unimplemented preset with <code>WORLD_PRESET_UNSUPPORTED</code>; it never sends that generator through
the existing pack builder. Defaults select an implemented discovered ID, preferring normal.
An all-unsupported inventory has an explicit unavailable result.</p>
<p>Completeness regressions compare every supplied registry ID with the returned inventory and
capability records, including an unfamiliar synthetic preset. The supported-plus-unsupported
set must equal the full discovered set. This is discovery and truthful availability evidence,
not proof that an unsupported preset can generate a world.</p>
<h2 id="version-admission">Version admission</h2>
<p>The current customization writer also requires its legacy typed noise, dimension, block-state
and flat-setting shapes and an integer data-pack format below 82. This is detected from actual
selected-version data, not a guessed release-name cutoff. Later graph settings or major/minor
pack metadata retain discovery but expose <code>capabilities.customization.available: false</code>,
explicit unsupported fields, a localized explanation and no editable defaults. The internal
defaults/validation helpers also reject the unavailable catalogue.</p>
<p>This boundary was exercised against official 26.3 data. Its string block states, graph aquifers,
removed ore Boolean and major/minor pack metadata do not fit the existing writer. Marking this
route unavailable fixes the blank-picker path without claiming modern-schema generation support.
The renderer separately handles malformed or missing setting values without inventing defaults.
Official references: <a href="https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3">26.3 generation changes</a>
and <a href="https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-9">1.21.9 pack metadata</a>.</p>
<p>The strict Boolean flat-field checks describe this builder's current admission boundary,
not universal protocol requiredness of optional fields. An integer format in 1 through 81
alone does not establish support for a version; its actual registry, shape and readiness
checks must also pass. Full generation remains subject to separate runtime acceptance.</p>
<p>World presets alone do not establish that a version can execute the generator's readiness probes. The selected server distribution's actual command report must expose <code>execute if loaded</code> with a <code>minecraft:block_pos</code> argument redirected to <code>execute</code>, the root <code>execute run</code> form (the vanilla exporter omits an empty root redirect), and an executable <code>say</code> message argument. The catalogue retains the selected version and extracted picker data but sets <code>supported: false</code> with an explicit readiness-route explanation when that schema is missing or incompatible. Validation rejects generation before spawning a Java server. No guessed version-number threshold substitutes for those reports.</p>
<p>The older preset-bearing route remains unavailable until a compatible implementation is independently verified. Discovery is retained. This change does not add older-version support or remove the user's EULA decision.</p>
<h2 id="whole-batch-readiness">Whole-batch readiness</h2>
<p>Each forceload batch still contains at most 256 chunks. The generator now probes one block position inside <strong>every requested chunk</strong>, rather than checking only four corners. The probe height remains within the selected dimension. Tickets remain in place and the batch remains incomplete until every requested chunk has acknowledged readiness.</p>
<p>Each run and each batch receives an independently random 128-bit identity. Every chunk has a distinct tag bound to both identities. A poll emits at most one short command per remaining chunk, with at most 256 such commands per batch. Acknowledged chunks are removed from the pending set and are not polled again.</p>
<p>The response parser accepts only the complete vanilla console announcement shape <code>[HH:mm:ss] [Server thread/INFO]: [Server] &lt;current-tag&gt;</code>. It rejects diagnostic echoes, ordinary player chat, unframed text, extra prefixes/suffixes, unknown tags, and stale tags from another batch or run. An accepted response discharges only that exact pending chunk. Ticket removal and completed-batch progress happen only after the pending set is empty.</p>
<p>Official Java 1.21.4 source assets support the expected console framing: the bundled logging configuration uses <code>[%d{HH:mm:ss}] [%t/%level]: %msg{nolookups}%n</code>, and the language asset's announcement template is <code>[%s] %s</code>. This is a bounded source observation, not runtime verification across every supported version or modified server logging configuration. Unexpected formats time out without advancing the batch.</p>
<h2 id="verification-and-remaining-limits">Verification and remaining limits</h2>
<p>The new semantic regressions invoke the actual <code>generate</code> function with injected process events and filesystem fixtures. Before the repair, the initial ten-case regression run produced nine failures, including admission of an old preset-bearing report, false completion with an interior chunk pending, and acceptance of diagnostic/chat/partial marker text. After the repair, all twelve readiness cases passed. They independently cover:</p>
<ul>
<li>Preset-bearing reports without the required command schema, with no server spawn.</li>
<li>Schema-derived admission independent of a guessed version threshold.</li>
<li>One pending interior chunk of a 16 by 16 batch, with no completed batch or ticket removal.</li>
<li>Diagnostic echoes, player chat, prefixes, suffixes and unframed responses.</li>
<li>All 256 requested chunk positions and bounded individual command lengths.</li>
<li>Stale previous-batch and previous-run replies, with distinct random run/batch identities.</li>
</ul>
<p><code>node --test apps/desktop/electron/minecraft/worldgen*.test.cjs</code> passed <strong>42 tests, zero failed</strong>, including existing cancellation at startup/batch/save/exit, graceful-stop ownership, retry, admitted-byte snapshots, cache integrity and output verification tests. The existing synthetic success fixtures were updated to supply the admitted command schema and the exact response envelope.</p>
<p>These are deterministic simulation and source results. No real server was started, no actual server EULA was accepted, and no generated world was reopened. Real selected-version execution, generated-area completeness, output reopening and current GUI interaction remain separate unverified acceptance work. This repair does not establish whole-product completion.</p>
<p>Independent review against retained official 1.21.4 reports found that <code>execute.children.run</code> is exactly <code>{ "type": "literal" }</code>: the exporter omits its empty root redirect. The initial repair incorrectly required an explicit empty array and would have marked this verified version unavailable. Admission now accepts the omitted root form or an explicit empty redirect, while rejecting non-root or malformed redirects. The fixture and dedicated regression use the actual omitted-field shape; independent real-report revalidation is recorded separately from synthetic tests.</p>
`,text:`# World-generation readiness and completion evidence\r
\r
## Complete preset discovery\r
\r
The selected JAR's complete preset identity list is retained in \`presets\`. Each identity also\r
has a \`presetOptions\` record with \`id\`, \`supported\` and a nullable \`reason\`. The support flag\r
describes the current customization builder; top-level \`supported\` separately requires the\r
selected version's readiness capability and at least one implemented preset.\r
\r
Unsupported entries, including \`minecraft:debug_all_block_states\` and unfamiliar future IDs,\r
remain in the inventory with an explicit reason. Validation rejects a discovered but\r
unimplemented preset with \`WORLD_PRESET_UNSUPPORTED\`; it never sends that generator through\r
the existing pack builder. Defaults select an implemented discovered ID, preferring normal.\r
An all-unsupported inventory has an explicit unavailable result.\r
\r
Completeness regressions compare every supplied registry ID with the returned inventory and\r
capability records, including an unfamiliar synthetic preset. The supported-plus-unsupported\r
set must equal the full discovered set. This is discovery and truthful availability evidence,\r
not proof that an unsupported preset can generate a world.\r
\r
## Version admission\r
\r
The current customization writer also requires its legacy typed noise, dimension, block-state\r
and flat-setting shapes and an integer data-pack format below 82. This is detected from actual\r
selected-version data, not a guessed release-name cutoff. Later graph settings or major/minor\r
pack metadata retain discovery but expose \`capabilities.customization.available: false\`,\r
explicit unsupported fields, a localized explanation and no editable defaults. The internal\r
defaults/validation helpers also reject the unavailable catalogue.\r
\r
This boundary was exercised against official 26.3 data. Its string block states, graph aquifers,\r
removed ore Boolean and major/minor pack metadata do not fit the existing writer. Marking this\r
route unavailable fixes the blank-picker path without claiming modern-schema generation support.\r
The renderer separately handles malformed or missing setting values without inventing defaults.\r
Official references: [26.3 generation changes](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3)\r
and [1.21.9 pack metadata](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-9).\r
\r
The strict Boolean flat-field checks describe this builder's current admission boundary,\r
not universal protocol requiredness of optional fields. An integer format in 1 through 81\r
alone does not establish support for a version; its actual registry, shape and readiness\r
checks must also pass. Full generation remains subject to separate runtime acceptance.\r
\r
World presets alone do not establish that a version can execute the generator's readiness probes. The selected server distribution's actual command report must expose \`execute if loaded\` with a \`minecraft:block_pos\` argument redirected to \`execute\`, the root \`execute run\` form (the vanilla exporter omits an empty root redirect), and an executable \`say\` message argument. The catalogue retains the selected version and extracted picker data but sets \`supported: false\` with an explicit readiness-route explanation when that schema is missing or incompatible. Validation rejects generation before spawning a Java server. No guessed version-number threshold substitutes for those reports.\r
\r
The older preset-bearing route remains unavailable until a compatible implementation is independently verified. Discovery is retained. This change does not add older-version support or remove the user's EULA decision.\r
\r
## Whole-batch readiness\r
\r
Each forceload batch still contains at most 256 chunks. The generator now probes one block position inside **every requested chunk**, rather than checking only four corners. The probe height remains within the selected dimension. Tickets remain in place and the batch remains incomplete until every requested chunk has acknowledged readiness.\r
\r
Each run and each batch receives an independently random 128-bit identity. Every chunk has a distinct tag bound to both identities. A poll emits at most one short command per remaining chunk, with at most 256 such commands per batch. Acknowledged chunks are removed from the pending set and are not polled again.\r
\r
The response parser accepts only the complete vanilla console announcement shape \`[HH:mm:ss] [Server thread/INFO]: [Server] <current-tag>\`. It rejects diagnostic echoes, ordinary player chat, unframed text, extra prefixes/suffixes, unknown tags, and stale tags from another batch or run. An accepted response discharges only that exact pending chunk. Ticket removal and completed-batch progress happen only after the pending set is empty.\r
\r
Official Java 1.21.4 source assets support the expected console framing: the bundled logging configuration uses \`[%d{HH:mm:ss}] [%t/%level]: %msg{nolookups}%n\`, and the language asset's announcement template is \`[%s] %s\`. This is a bounded source observation, not runtime verification across every supported version or modified server logging configuration. Unexpected formats time out without advancing the batch.\r
\r
## Verification and remaining limits\r
\r
The new semantic regressions invoke the actual \`generate\` function with injected process events and filesystem fixtures. Before the repair, the initial ten-case regression run produced nine failures, including admission of an old preset-bearing report, false completion with an interior chunk pending, and acceptance of diagnostic/chat/partial marker text. After the repair, all twelve readiness cases passed. They independently cover:\r
\r
- Preset-bearing reports without the required command schema, with no server spawn.\r
- Schema-derived admission independent of a guessed version threshold.\r
- One pending interior chunk of a 16 by 16 batch, with no completed batch or ticket removal.\r
- Diagnostic echoes, player chat, prefixes, suffixes and unframed responses.\r
- All 256 requested chunk positions and bounded individual command lengths.\r
- Stale previous-batch and previous-run replies, with distinct random run/batch identities.\r
\r
\`node --test apps/desktop/electron/minecraft/worldgen*.test.cjs\` passed **42 tests, zero failed**, including existing cancellation at startup/batch/save/exit, graceful-stop ownership, retry, admitted-byte snapshots, cache integrity and output verification tests. The existing synthetic success fixtures were updated to supply the admitted command schema and the exact response envelope.\r
\r
These are deterministic simulation and source results. No real server was started, no actual server EULA was accepted, and no generated world was reopened. Real selected-version execution, generated-area completeness, output reopening and current GUI interaction remain separate unverified acceptance work. This repair does not establish whole-product completion.\r
\r
\r
Independent review against retained official 1.21.4 reports found that \`execute.children.run\` is exactly \`{ "type": "literal" }\`: the exporter omits its empty root redirect. The initial repair incorrectly required an explicit empty array and would have marked this verified version unavailable. Admission now accepts the omitted root form or an explicit empty redirect, while rejecting non-root or malformed redirects. The fixture and dedicated regression use the actual omitted-field shape; independent real-report revalidation is recorded separately from synthetic tests.\r
`},{id:"docs/features/servers/worldgen-cache-recovery.md",title:"World generator cache recovery",category:"features",html:`<h1 id="world-generator-cache-recovery">World generator cache recovery</h1>
<p>A cached runtime must match the selected version, published size and SHA-1, and its own version identifier before report extraction or generation can use it.</p>
<p><code>JAR_INTEGRITY_FAILED</code> rejects the current request before starting Java. When the rejected entry is the same ordinary, unshared file in the managed cache, the application retains it under a new exclusive <code>rejected-jars/rejected-*/rejected.jar</code> directory. It does not download or execute a replacement within that rejected request. Retry the action explicitly to acquire fresh bytes and verify them normally. Retained rejected files are never executed or automatically deleted.</p>
<p><code>UNSAFE_JAR_PATH</code> leaves linked, shared, non-file or changed entries untouched. <code>JAR_QUARANTINE_FAILED</code> means the application could not retain the rejected entry safely; the request remains unsuccessful. Neither condition grants permission to replace an uncertain path. Metadata lookup or validation failures leave existing cache bytes untouched.</p>
<p>Retry downloads use an isolated acquisition directory and exclusive final placement. A file created by another writer during acquisition is preserved and the request fails. Native file-handle protection against a concurrent privileged writer is not claimed.</p>
`,text:`# World generator cache recovery\r
\r
A cached runtime must match the selected version, published size and SHA-1, and its own version identifier before report extraction or generation can use it.\r
\r
\`JAR_INTEGRITY_FAILED\` rejects the current request before starting Java. When the rejected entry is the same ordinary, unshared file in the managed cache, the application retains it under a new exclusive \`rejected-jars/rejected-*/rejected.jar\` directory. It does not download or execute a replacement within that rejected request. Retry the action explicitly to acquire fresh bytes and verify them normally. Retained rejected files are never executed or automatically deleted.\r
\r
\`UNSAFE_JAR_PATH\` leaves linked, shared, non-file or changed entries untouched. \`JAR_QUARANTINE_FAILED\` means the application could not retain the rejected entry safely; the request remains unsuccessful. Neither condition grants permission to replace an uncertain path. Metadata lookup or validation failures leave existing cache bytes untouched.\r
\r
Retry downloads use an isolated acquisition directory and exclusive final placement. A file created by another writer during acquisition is preserved and the request fails. Native file-handle protection against a concurrent privileged writer is not claimed.\r
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
`},{id:"wiki/Desktop-Workspace.md",title:"Desktop workspace",category:"Desktop-Workspace.md",html:`<h1 id="desktop-workspace">Desktop workspace</h1>
<p>The current renderer migration follows the latest reviewed eight artboards in <code>design/</code>,
currently design commit <code>0ab6165</code>. The original attachment is obsolete. Source candidate
<code>445b803</code> passed the exact Desktop build and all 131 desktop checks; actual running-interface
screenshots, layout parity and README image delivery remain pending because the hidden
runtime launch was rejected before execution. Historical screenshots retain their original
source and provenance. See the <a href="#/article/docs%2Ffeatures%2Fdesktop%2Fzip-gui-remake.md">current migration record</a>.</p>
<p>The desktop redesign centers daily work on the profile inventory, contextual inspector
and real actions. See the complete <a href="#/article/docs%2Ffeatures%2Fdesktop%2Fprofile-workspace.md">desktop workflow article</a>.</p>
<h2 id="working-destinations">Working destinations</h2>
<ul>
<li>Profiles: search, filter, sort, inspect, launch with consent, and manage existing records.</li>
<li>Super Profiles: preserve templates, sessions, revision history and recovery workflows.</li>
<li>Synchronization: configure storage, transfer encrypted changes and inspect conflict candidates.</li>
<li>Settings: adjust validated preferences through the existing category and tab workspace.</li>
<li>Setup: resume actual vault, first-profile and optional synchronization actions.</li>
<li>Password manager: profile creation can pair a profile with a KeePassXC database, register the
browser extension and keep passkeys on by default; see the
<a href="#/article/docs%2Ffeatures%2Fdesktop%2Fpassword-manager.md">pairing article</a> for exact file locations and
the pending built verification.</li>
</ul>
<p>The command palette and explicit catalog navigate supported destinations. Normal navigation
preserves working state. Unsupported backend capabilities remain explicitly unfinished.</p>
<h2 id="evidence-status">Evidence status</h2>
<p>Design, source implementation and runtime acceptance have separate verdicts. The current
handoff and desktop evidence inventory identify the built source, inspected images, actual
interaction results and remaining verification. Historical screenshots retain their original
provenance and do not establish the redesigned desktop's behavior.</p>
<h2 id="\u5EE3\u6771\u8A71">\u5EE3\u6771\u8A71</h2>
<p>\u684C\u9762\u4EE5\u8A2D\u5B9A\u6A94\u6E05\u55AE\u540C\u5BE6\u969B\u64CD\u4F5C\u505A\u4E2D\u5FC3\u3002\u63C0\u8A2D\u5B9A\u6A94\u7747\u8A73\u7D30\u8CC7\u6599\uFF0C\u518D\u555F\u52D5\u3001\u505C\u6B62\u3001\u8655\u7406\u7248\u672C\u540C\u540C\u6B65\u3002
Super Profiles \u540C\u8A2D\u5B9A\u5DE5\u5177\u4FDD\u7559\u539F\u6709\u6D41\u7A0B\uFF0C\u672A\u652F\u63F4\u5605\u529F\u80FD\u7E7C\u7E8C\u6E05\u695A\u4EA4\u4EE3\u3002\u5BE6\u4F5C\u540C\u5BE6\u969B\u9A57\u8B49\u5206\u958B\u8A18\u9304\uFF0C
\u820A\u5716\u5514\u6703\u7576\u6210\u65B0\u7248\u672C\u8B49\u64DA\u3002</p>
`,text:`# Desktop workspace\r
\r
The current renderer migration follows the latest reviewed eight artboards in \`design/\`,\r
currently design commit \`0ab6165\`. The original attachment is obsolete. Source candidate\r
\`445b803\` passed the exact Desktop build and all 131 desktop checks; actual running-interface\r
screenshots, layout parity and README image delivery remain pending because the hidden\r
runtime launch was rejected before execution. Historical screenshots retain their original\r
source and provenance. See the [current migration record](../docs/features/desktop/zip-gui-remake.md).\r
\r
The desktop redesign centers daily work on the profile inventory, contextual inspector\r
and real actions. See the complete [desktop workflow article](../docs/features/desktop/profile-workspace.md).\r
\r
## Working destinations\r
\r
- Profiles: search, filter, sort, inspect, launch with consent, and manage existing records.\r
- Super Profiles: preserve templates, sessions, revision history and recovery workflows.\r
- Synchronization: configure storage, transfer encrypted changes and inspect conflict candidates.\r
- Settings: adjust validated preferences through the existing category and tab workspace.\r
- Setup: resume actual vault, first-profile and optional synchronization actions.\r
- Password manager: profile creation can pair a profile with a KeePassXC database, register the\r
  browser extension and keep passkeys on by default; see the\r
  [pairing article](../docs/features/desktop/password-manager.md) for exact file locations and\r
  the pending built verification.\r
\r
The command palette and explicit catalog navigate supported destinations. Normal navigation\r
preserves working state. Unsupported backend capabilities remain explicitly unfinished.\r
\r
## Evidence status\r
\r
Design, source implementation and runtime acceptance have separate verdicts. The current\r
handoff and desktop evidence inventory identify the built source, inspected images, actual\r
interaction results and remaining verification. Historical screenshots retain their original\r
provenance and do not establish the redesigned desktop's behavior.\r
\r
## \u5EE3\u6771\u8A71\r
\r
\u684C\u9762\u4EE5\u8A2D\u5B9A\u6A94\u6E05\u55AE\u540C\u5BE6\u969B\u64CD\u4F5C\u505A\u4E2D\u5FC3\u3002\u63C0\u8A2D\u5B9A\u6A94\u7747\u8A73\u7D30\u8CC7\u6599\uFF0C\u518D\u555F\u52D5\u3001\u505C\u6B62\u3001\u8655\u7406\u7248\u672C\u540C\u540C\u6B65\u3002\r
Super Profiles \u540C\u8A2D\u5B9A\u5DE5\u5177\u4FDD\u7559\u539F\u6709\u6D41\u7A0B\uFF0C\u672A\u652F\u63F4\u5605\u529F\u80FD\u7E7C\u7E8C\u6E05\u695A\u4EA4\u4EE3\u3002\u5BE6\u4F5C\u540C\u5BE6\u969B\u9A57\u8B49\u5206\u958B\u8A18\u9304\uFF0C\r
\u820A\u5716\u5514\u6703\u7576\u6210\u65B0\u7248\u672C\u8B49\u64DA\u3002\r
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
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Fworldlens-design.md">WorldLens desktop design</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdesktop%2Faction-sounds.md">Action sounds and quiet controls</a></li>
<li><a href="#/article/docs%2Ffeatures%2Fdelivery%2Fbundled-engines.md">Bundled browser engines</a></li>
</ul>
<h2 id="evidence-boundaries">Evidence boundaries</h2>
<p>A documented interface is not proof that an installed engine implements it. Read the actual capability result and operation result. Cross-machine restoration, native browser launch, supported installers and deployed storage require separate runtime verification. Interactive examples in this handbook run only in the documentation page and never operate an installed browser or vault.</p>
<ul>
<li><a href="#/article/wiki%2FDesktop-Workspace.md">Desktop profile workspace</a></li>
</ul>
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
- [WorldLens desktop design](../docs/features/desktop/worldlens-design.md)\r
- [Action sounds and quiet controls](../docs/features/desktop/action-sounds.md)\r
- [Bundled browser engines](../docs/features/delivery/bundled-engines.md)\r
\r
## Evidence boundaries\r
\r
A documented interface is not proof that an installed engine implements it. Read the actual capability result and operation result. Cross-machine restoration, native browser launch, supported installers and deployed storage require separate runtime verification. Interactive examples in this handbook run only in the documentation page and never operate an installed browser or vault.\r
\r
- [Desktop profile workspace](Desktop-Workspace.md)\r
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
`},{id:"wiki/Super-Profiles.md",title:"Super Profiles",category:"Super-Profiles.md",html:`<h1 id="super-profiles">Super Profiles</h1>
<p>Super Profiles are encrypted reusable templates for disposable guest environments. See the
<a href="#/article/docs%2Ffeatures%2Fdesktop%2Fsuper-profiles.md">complete workflow and verification boundaries</a>.</p>
<p>Start in the desktop's Super Profiles workspace after unlocking the vault. Configure a
template, inspect actual host capabilities, then make an explicit launch choice. Template
storage does not mean guest provisioning or visual readiness has been verified. Explicit
save-back produces a new revision; browser credentials are not promised to be portable.</p>
<p>Ordinary browser profiles remain separate. Super Profile archives are local-only and do not
participate in browser folder synchronization.</p>
<p>Save-back queues collection before encrypted finalization. If the vault locks or the host
restarts meanwhile, review and confirm that exact collected operation after unlocking.
Stop and discard are available through the native API while locked; their responses omit
template identifiers, revision identifiers and staging paths. A successful encrypted save
and incomplete cleanup are separate results, so retrying cleanup must not create a second
revision.</p>
<p>Portable bookmark documents are stored encrypted with each backend's template settings.
The guest receives a separate managed read-only folder; saved editable browser bookmarks
remain in their existing profile files. Only bounded neutral JSON with HTTP(S) links is
accepted. Host browser directories, credentials and authenticated sessions are not imported.
Exact pinned-browser policy recognition and the wizard's import controls require separate
runtime proof; source implementation does not establish that acceptance.</p>
<p>Native headless Chromium and Firefox roundtrips now demonstrate browser/workspace restoration.
Default uncached base acquisition and stable-source installer production also have dedicated
receipts linked from the complete workflow article. Graphical terminal, WSLg, full desktop,
Sandbox, accepted installed update and final interface evidence remain separately tracked.</p>
`,text:`# Super Profiles\r
\r
Super Profiles are encrypted reusable templates for disposable guest environments. See the\r
[complete workflow and verification boundaries](../docs/features/desktop/super-profiles.md).\r
\r
Start in the desktop's Super Profiles workspace after unlocking the vault. Configure a\r
template, inspect actual host capabilities, then make an explicit launch choice. Template\r
storage does not mean guest provisioning or visual readiness has been verified. Explicit\r
save-back produces a new revision; browser credentials are not promised to be portable.\r
\r
Ordinary browser profiles remain separate. Super Profile archives are local-only and do not\r
participate in browser folder synchronization.\r
\r
Save-back queues collection before encrypted finalization. If the vault locks or the host\r
restarts meanwhile, review and confirm that exact collected operation after unlocking.\r
Stop and discard are available through the native API while locked; their responses omit\r
template identifiers, revision identifiers and staging paths. A successful encrypted save\r
and incomplete cleanup are separate results, so retrying cleanup must not create a second\r
revision.\r
\r
Portable bookmark documents are stored encrypted with each backend's template settings.\r
The guest receives a separate managed read-only folder; saved editable browser bookmarks\r
remain in their existing profile files. Only bounded neutral JSON with HTTP(S) links is\r
accepted. Host browser directories, credentials and authenticated sessions are not imported.\r
Exact pinned-browser policy recognition and the wizard's import controls require separate\r
runtime proof; source implementation does not establish that acceptance.\r
\r
Native headless Chromium and Firefox roundtrips now demonstrate browser/workspace restoration.\r
Default uncached base acquisition and stable-source installer production also have dedicated\r
receipts linked from the complete workflow article. Graphical terminal, WSLg, full desktop,\r
Sandbox, accepted installed update and final interface evidence remain separately tracked.\r
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
`}]};function h(n,e,t,r){var a=arguments.length,i=a<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,t):r,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(n,e,t,r);else for(var c=n.length-1;c>=0;c--)(o=n[c])&&(i=(a<3?o(i):a>3?o(e,t,i):o(e,t))||i);return a>3&&i&&Object.defineProperty(e,t,i),i}var I=n=>(e,t)=>{t!==void 0?t.addInitializer(()=>{customElements.define(n,e)}):customElements.define(n,e)};var Se=globalThis,Ae=Se.ShadowRoot&&(Se.ShadyCSS===void 0||Se.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ue=Symbol(),St=new WeakMap,he=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==Ue)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(Ae&&e===void 0){let r=t!==void 0&&t.length===1;r&&(e=St.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&St.set(t,e))}return e}toString(){return this.cssText}},At=n=>new he(typeof n=="string"?n:n+"",void 0,Ue),w=(n,...e)=>{let t=n.length===1?n[0]:e.reduce((r,a,i)=>r+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(a)+n[i+1],n[0]);return new he(t,n,Ue)},Ct=(n,e)=>{if(Ae)n.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let r=document.createElement("style"),a=Se.litNonce;a!==void 0&&r.setAttribute("nonce",a),r.textContent=t.cssText,n.appendChild(r)}},He=Ae?n=>n:n=>n instanceof CSSStyleSheet?(e=>{let t="";for(let r of e.cssRules)t+=r.cssText;return At(t)})(n):n;var{is:rn,defineProperty:an,getOwnPropertyDescriptor:on,getOwnPropertyNames:sn,getOwnPropertySymbols:dn,getPrototypeOf:cn}=Object,Ce=globalThis,Pt=Ce.trustedTypes,ln=Pt?Pt.emptyScript:"",pn=Ce.reactiveElementPolyfillSupport,ue=(n,e)=>n,me={toAttribute(n,e){switch(e){case Boolean:n=n?ln:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,e){let t=n;switch(e){case Boolean:t=n!==null;break;case Number:t=n===null?null:Number(n);break;case Object:case Array:try{t=JSON.parse(n)}catch{t=null}}return t}},Pe=(n,e)=>!rn(n,e),Et={attribute:!0,type:String,converter:me,reflect:!1,useDefault:!1,hasChanged:Pe};Symbol.metadata??=Symbol("metadata"),Ce.litPropertyMetadata??=new WeakMap;var L=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Et){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let r=Symbol(),a=this.getPropertyDescriptor(e,r,t);a!==void 0&&an(this.prototype,e,a)}}static getPropertyDescriptor(e,t,r){let{get:a,set:i}=on(this.prototype,e)??{get(){return this[t]},set(o){this[t]=o}};return{get:a,set(o){let c=a?.call(this);i?.call(this,o),this.requestUpdate(e,c,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Et}static _$Ei(){if(this.hasOwnProperty(ue("elementProperties")))return;let e=cn(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(ue("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ue("properties"))){let t=this.properties,r=[...sn(t),...dn(t)];for(let a of r)this.createProperty(a,t[a])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[r,a]of t)this.elementProperties.set(r,a)}this._$Eh=new Map;for(let[t,r]of this.elementProperties){let a=this._$Eu(t,r);a!==void 0&&this._$Eh.set(a,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let r=new Set(e.flat(1/0).reverse());for(let a of r)t.unshift(He(a))}else e!==void 0&&t.push(He(e));return t}static _$Eu(e,t){let r=t.attribute;return r===!1?void 0:typeof r=="string"?r:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ct(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){let r=this.constructor.elementProperties.get(e),a=this.constructor._$Eu(e,r);if(a!==void 0&&r.reflect===!0){let i=(r.converter?.toAttribute!==void 0?r.converter:me).toAttribute(t,r.type);this._$Em=e,i==null?this.removeAttribute(a):this.setAttribute(a,i),this._$Em=null}}_$AK(e,t){let r=this.constructor,a=r._$Eh.get(e);if(a!==void 0&&this._$Em!==a){let i=r.getPropertyOptions(a),o=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:me;this._$Em=a;let c=o.fromAttribute(t,i.type);this[a]=c??this._$Ej?.get(a)??c,this._$Em=null}}requestUpdate(e,t,r,a=!1,i){if(e!==void 0){let o=this.constructor;if(a===!1&&(i=this[e]),r??=o.getPropertyOptions(e),!((r.hasChanged??Pe)(i,t)||r.useDefault&&r.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,r))))return;this.C(e,t,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:a,wrapped:i},o){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),i!==!0||o!==void 0)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),a===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[a,i]of this._$Ep)this[a]=i;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[a,i]of r){let{wrapped:o}=i,c=this[a];o!==!0||this._$AL.has(a)||c===void 0||this.C(a,void 0,i,c)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(t)):this._$EM()}catch(r){throw e=!1,this._$EM(),r}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};L.elementStyles=[],L.shadowRootOptions={mode:"open"},L[ue("elementProperties")]=new Map,L[ue("finalized")]=new Map,pn?.({ReactiveElement:L}),(Ce.reactiveElementVersions??=[]).push("2.1.2");var hn={attribute:!0,type:String,converter:me,reflect:!1,hasChanged:Pe},un=(n=hn,e,t)=>{let{kind:r,metadata:a}=t,i=globalThis.litPropertyMetadata.get(a);if(i===void 0&&globalThis.litPropertyMetadata.set(a,i=new Map),r==="setter"&&((n=Object.create(n)).wrapped=!0),i.set(t.name,n),r==="accessor"){let{name:o}=t;return{set(c){let d=e.get.call(this);e.set.call(this,c),this.requestUpdate(o,d,n,!0,c)},init(c){return c!==void 0&&this.C(o,void 0,n,c),c}}}if(r==="setter"){let{name:o}=t;return function(c){let d=this[o];e.call(this,c),this.requestUpdate(o,d,n,!0,c)}}throw Error("Unsupported decorator location: "+r)};function b(n){return(e,t)=>typeof t=="object"?un(n,e,t):((r,a,i)=>{let o=a.hasOwnProperty(i);return a.constructor.createProperty(i,r),o?Object.getOwnPropertyDescriptor(a,i):void 0})(n,e,t)}function $(n){return b({...n,state:!0,attribute:!1})}var z=(n,e,t)=>(t.configurable=!0,t.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(n,e,t),t);function F(n,e){return(t,r,a)=>{let i=o=>o.renderRoot?.querySelector(n)??null;if(e){let{get:o,set:c}=typeof r=="object"?t:a??(()=>{let d=Symbol();return{get(){return this[d]},set(f){this[d]=f}}})();return z(t,r,{get(){let d=o.call(this);return d===void 0&&(d=i(this),(d!==null||this.hasUpdated)&&c.call(this,d)),d}})}return z(t,r,{get(){return i(this)}})}}function It(n){return(e,t)=>{let{slot:r,selector:a}=n??{},i="slot"+(r?`[name=${r}]`:":not([name])");return z(e,t,{get(){let o=this.renderRoot?.querySelector(i),c=o?.assignedElements(n)??[];return a===void 0?c:c.filter(d=>d.matches(a))}})}}var Ye=globalThis,Dt=n=>n,Ee=Ye.trustedTypes,Rt=Ee?Ee.createPolicy("lit-html",{createHTML:n=>n}):void 0,qt="$lit$",M=`lit$${Math.random().toFixed(9).slice(2)}$`,zt="?"+M,mn=`<${zt}>`,G=document,ge=()=>G.createComment(""),ve=n=>n===null||typeof n!="object"&&typeof n!="function",Xe=Array.isArray,fn=n=>Xe(n)||typeof n?.[Symbol.iterator]=="function",$e=`[ 	
\f\r]`,fe=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Nt=/-->/g,jt=/>/g,W=RegExp(`>|${$e}(?:([^\\s"'>=/]+)(${$e}*=${$e}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),_t=/'/g,Lt=/"/g,Ft=/^(?:script|style|textarea|title)$/i,Ze=n=>(e,...t)=>({_$litType$:n,strings:e,values:t}),y=Ze(1),qr=Ze(2),zr=Ze(3),O=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),Ot=new WeakMap,V=G.createTreeWalker(G,129);function Mt(n,e){if(!Xe(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return Rt!==void 0?Rt.createHTML(e):e}var gn=(n,e)=>{let t=n.length-1,r=[],a,i=e===2?"<svg>":e===3?"<math>":"",o=fe;for(let c=0;c<t;c++){let d=n[c],f,v,g=-1,S=0;for(;S<d.length&&(o.lastIndex=S,v=o.exec(d),v!==null);)S=o.lastIndex,o===fe?v[1]==="!--"?o=Nt:v[1]!==void 0?o=jt:v[2]!==void 0?(Ft.test(v[2])&&(a=RegExp("</"+v[2],"g")),o=W):v[3]!==void 0&&(o=W):o===W?v[0]===">"?(o=a??fe,g=-1):v[1]===void 0?g=-2:(g=o.lastIndex-v[2].length,f=v[1],o=v[3]===void 0?W:v[3]==='"'?Lt:_t):o===Lt||o===_t?o=W:o===Nt||o===jt?o=fe:(o=W,a=void 0);let C=o===W&&n[c+1].startsWith("/>")?" ":"";i+=o===fe?d+mn:g>=0?(r.push(f),d.slice(0,g)+qt+d.slice(g)+M+C):d+M+(g===-2?c:C)}return[Mt(n,i+(n[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),r]},be=class n{constructor({strings:e,_$litType$:t},r){let a;this.parts=[];let i=0,o=0,c=e.length-1,d=this.parts,[f,v]=gn(e,t);if(this.el=n.createElement(f,r),V.currentNode=this.el.content,t===2||t===3){let g=this.el.content.firstChild;g.replaceWith(...g.childNodes)}for(;(a=V.nextNode())!==null&&d.length<c;){if(a.nodeType===1){if(a.hasAttributes())for(let g of a.getAttributeNames())if(g.endsWith(qt)){let S=v[o++],C=a.getAttribute(g).split(M),A=/([.?@])?(.*)/.exec(S);d.push({type:1,index:i,name:A[2],strings:C,ctor:A[1]==="."?Ve:A[1]==="?"?Ge:A[1]==="@"?Ke:X}),a.removeAttribute(g)}else g.startsWith(M)&&(d.push({type:6,index:i}),a.removeAttribute(g));if(Ft.test(a.tagName)){let g=a.textContent.split(M),S=g.length-1;if(S>0){a.textContent=Ee?Ee.emptyScript:"";for(let C=0;C<S;C++)a.append(g[C],ge()),V.nextNode(),d.push({type:2,index:++i});a.append(g[S],ge())}}}else if(a.nodeType===8)if(a.data===zt)d.push({type:2,index:i});else{let g=-1;for(;(g=a.data.indexOf(M,g+1))!==-1;)d.push({type:7,index:i}),g+=M.length-1}i++}}static createElement(e,t){let r=G.createElement("template");return r.innerHTML=e,r}};function Y(n,e,t=n,r){if(e===O)return e;let a=r!==void 0?t._$Co?.[r]:t._$Cl,i=ve(e)?void 0:e._$litDirective$;return a?.constructor!==i&&(a?._$AO?.(!1),i===void 0?a=void 0:(a=new i(n),a._$AT(n,t,r)),r!==void 0?(t._$Co??=[])[r]=a:t._$Cl=a),a!==void 0&&(e=Y(n,a._$AS(n,e.values),a,r)),e}var We=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:r}=this._$AD,a=(e?.creationScope??G).importNode(t,!0);V.currentNode=a;let i=V.nextNode(),o=0,c=0,d=r[0];for(;d!==void 0;){if(o===d.index){let f;d.type===2?f=new ye(i,i.nextSibling,this,e):d.type===1?f=new d.ctor(i,d.name,d.strings,this,e):d.type===6&&(f=new Je(i,this,e)),this._$AV.push(f),d=r[++c]}o!==d?.index&&(i=V.nextNode(),o++)}return V.currentNode=G,a}p(e){let t=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}},ye=class n{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,a){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=a,this._$Cv=a?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=Y(this,e,t),ve(e)?e===m||e==null||e===""?(this._$AH!==m&&this._$AR(),this._$AH=m):e!==this._$AH&&e!==O&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):fn(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==m&&ve(this._$AH)?this._$AA.nextSibling.data=e:this.T(G.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:r}=e,a=typeof r=="number"?this._$AC(e):(r.el===void 0&&(r.el=be.createElement(Mt(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===a)this._$AH.p(t);else{let i=new We(a,this),o=i.u(this.options);i.p(t),this.T(o),this._$AH=i}}_$AC(e){let t=Ot.get(e.strings);return t===void 0&&Ot.set(e.strings,t=new be(e)),t}k(e){Xe(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,r,a=0;for(let i of e)a===t.length?t.push(r=new n(this.O(ge()),this.O(ge()),this,this.options)):r=t[a],r._$AI(i),a++;a<t.length&&(this._$AR(r&&r._$AB.nextSibling,a),t.length=a)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let r=Dt(e).nextSibling;Dt(e).remove(),e=r}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},X=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,a,i){this.type=1,this._$AH=m,this._$AN=void 0,this.element=e,this.name=t,this._$AM=a,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=m}_$AI(e,t=this,r,a){let i=this.strings,o=!1;if(i===void 0)e=Y(this,e,t,0),o=!ve(e)||e!==this._$AH&&e!==O,o&&(this._$AH=e);else{let c=e,d,f;for(e=i[0],d=0;d<i.length-1;d++)f=Y(this,c[r+d],t,d),f===O&&(f=this._$AH[d]),o||=!ve(f)||f!==this._$AH[d],f===m?e=m:e!==m&&(e+=(f??"")+i[d+1]),this._$AH[d]=f}o&&!a&&this.j(e)}j(e){e===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Ve=class extends X{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===m?void 0:e}},Ge=class extends X{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==m)}},Ke=class extends X{constructor(e,t,r,a,i){super(e,t,r,a,i),this.type=5}_$AI(e,t=this){if((e=Y(this,e,t,0)??m)===O)return;let r=this._$AH,a=e===m&&r!==m||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,i=e!==m&&(r===m||a);a&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Je=class{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){Y(this,e)}};var vn=Ye.litHtmlPolyfillSupport;vn?.(be,ye),(Ye.litHtmlVersions??=[]).push("3.3.3");var Bt=(n,e,t)=>{let r=t?.renderBefore??e,a=r._$litPart$;if(a===void 0){let i=t?.renderBefore??null;r._$litPart$=a=new ye(e.insertBefore(ge(),i),i,void 0,t??{})}return a._$AI(n),a};var Qe=globalThis,k=class extends L{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Bt(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return O}};k._$litElement$=!0,k.finalized=!0,Qe.litElementHydrateSupport?.({LitElement:k});var bn=Qe.litElementPolyfillSupport;bn?.({LitElement:k});(Qe.litElementVersions??=[]).push("4.2.2");var Ie=class extends k{connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}render(){return y`<span class="shadow"></span>`}};var et=w`:host,.shadow,.shadow::before,.shadow::after{border-radius:inherit;inset:0;position:absolute;transition-duration:inherit;transition-property:inherit;transition-timing-function:inherit}:host{display:flex;pointer-events:none;transition-property:box-shadow,opacity}.shadow::before,.shadow::after{content:"";transition-property:box-shadow,opacity;--_level: var(--md-elevation-level, 0);--_shadow-color: var(--md-elevation-shadow-color, var(--md-sys-color-shadow, #000))}.shadow::before{box-shadow:0px calc(1px*(clamp(0,var(--_level),1) + clamp(0,var(--_level) - 3,1) + 2*clamp(0,var(--_level) - 4,1))) calc(1px*(2*clamp(0,var(--_level),1) + clamp(0,var(--_level) - 2,1) + clamp(0,var(--_level) - 4,1))) 0px var(--_shadow-color);opacity:.3}.shadow::after{box-shadow:0px calc(1px*(clamp(0,var(--_level),1) + clamp(0,var(--_level) - 1,1) + 2*clamp(0,var(--_level) - 2,3))) calc(1px*(3*clamp(0,var(--_level),2) + 2*clamp(0,var(--_level) - 2,3))) calc(1px*(clamp(0,var(--_level),4) + 2*clamp(0,var(--_level) - 4,1))) var(--_shadow-color);opacity:.15}
`,ia=et.styleSheet;var tt=class extends Ie{};tt.styles=[et];tt=h([I("md-elevation")],tt);var Ut=Symbol("attachableController"),Ht;Ht=new MutationObserver(n=>{for(let e of n)e.target[Ut]?.hostConnected()});var Z=class{get htmlFor(){return this.host.getAttribute("for")}set htmlFor(e){e===null?this.host.removeAttribute("for"):this.host.setAttribute("for",e)}get control(){return this.host.hasAttribute("for")?!this.htmlFor||!this.host.isConnected?null:this.host.getRootNode().querySelector(`#${this.htmlFor}`):this.currentControl||this.host.parentElement}set control(e){e?this.attach(e):this.detach()}constructor(e,t){this.host=e,this.onControlChange=t,this.currentControl=null,e.addController(this),e[Ut]=this,Ht?.observe(e,{attributeFilter:["for"]})}attach(e){e!==this.currentControl&&(this.setCurrentControl(e),this.host.removeAttribute("for"))}detach(){this.setCurrentControl(null),this.host.setAttribute("for","")}hostConnected(){this.setCurrentControl(this.control)}hostDisconnected(){this.setCurrentControl(null)}setCurrentControl(e){this.onControlChange(this.currentControl,e),this.currentControl=e}};var yn=["focusin","focusout","pointerdown"],Q=class extends k{constructor(){super(...arguments),this.visible=!1,this.inward=!1,this.attachableController=new Z(this,this.onControlChange.bind(this))}get htmlFor(){return this.attachableController.htmlFor}set htmlFor(e){this.attachableController.htmlFor=e}get control(){return this.attachableController.control}set control(e){this.attachableController.control=e}attach(e){this.attachableController.attach(e)}detach(){this.attachableController.detach()}connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}handleEvent(e){if(!e[$t]){switch(e.type){default:return;case"focusin":this.visible=this.control?.matches(":focus-visible")??!1;break;case"focusout":case"pointerdown":this.visible=!1;break}e[$t]=!0}}onControlChange(e,t){if(!!1)for(let r of yn)e?.removeEventListener(r,this),t?.addEventListener(r,this)}update(e){e.has("visible")&&this.dispatchEvent(new Event("visibility-changed")),super.update(e)}};h([b({type:Boolean,reflect:!0})],Q.prototype,"visible",void 0);h([b({type:Boolean,reflect:!0})],Q.prototype,"inward",void 0);var $t=Symbol("handledByFocusRing");var nt=w`:host{animation-delay:0s,calc(var(--md-focus-ring-duration, 600ms)*.25);animation-duration:calc(var(--md-focus-ring-duration, 600ms)*.25),calc(var(--md-focus-ring-duration, 600ms)*.75);animation-timing-function:cubic-bezier(0.2, 0, 0, 1);box-sizing:border-box;color:var(--md-focus-ring-color, var(--md-sys-color-secondary, #625b71));display:none;pointer-events:none;position:absolute}:host([visible]){display:flex}:host(:not([inward])){animation-name:outward-grow,outward-shrink;border-end-end-radius:calc(var(--md-focus-ring-shape-end-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-end-start-radius:calc(var(--md-focus-ring-shape-end-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-start-end-radius:calc(var(--md-focus-ring-shape-start-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));border-start-start-radius:calc(var(--md-focus-ring-shape-start-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) + var(--md-focus-ring-outward-offset, 2px));inset:calc(-1*var(--md-focus-ring-outward-offset, 2px));outline:var(--md-focus-ring-width, 3px) solid currentColor}:host([inward]){animation-name:inward-grow,inward-shrink;border-end-end-radius:calc(var(--md-focus-ring-shape-end-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-end-start-radius:calc(var(--md-focus-ring-shape-end-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-start-end-radius:calc(var(--md-focus-ring-shape-start-end, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border-start-start-radius:calc(var(--md-focus-ring-shape-start-start, var(--md-focus-ring-shape, var(--md-sys-shape-corner-full, 9999px))) - var(--md-focus-ring-inward-offset, 0px));border:var(--md-focus-ring-width, 3px) solid currentColor;inset:var(--md-focus-ring-inward-offset, 0px)}@keyframes outward-grow{from{outline-width:0}to{outline-width:var(--md-focus-ring-active-width, 8px)}}@keyframes outward-shrink{from{outline-width:var(--md-focus-ring-active-width, 8px)}}@keyframes inward-grow{from{border-width:0}to{border-width:var(--md-focus-ring-active-width, 8px)}}@keyframes inward-shrink{from{border-width:var(--md-focus-ring-active-width, 8px)}}@media(prefers-reduced-motion){:host{animation:none}}
`,Aa=nt.styleSheet;var rt=class extends Q{};rt.styles=[nt];rt=h([I("md-focus-ring")],rt);var Wt={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Vt=n=>(...e)=>({_$litDirective$:n,values:e}),De=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};var K=Vt(class extends De{constructor(n){if(super(n),n.type!==Wt.ATTRIBUTE||n.name!=="class"||n.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(n){return" "+Object.keys(n).filter(e=>n[e]).join(" ")+" "}update(n,[e]){if(this.st===void 0){this.st=new Set,n.strings!==void 0&&(this.nt=new Set(n.strings.join(" ").split(/\s/).filter(r=>r!=="")));for(let r in e)e[r]&&!this.nt?.has(r)&&this.st.add(r);return this.render(e)}let t=n.element.classList;for(let r of this.st)r in e||(t.remove(r),this.st.delete(r));for(let r in e){let a=!!e[r];a===this.st.has(r)||this.nt?.has(r)||(a?(t.add(r),this.st.add(r)):(t.remove(r),this.st.delete(r)))}return O}});var Gt={STANDARD:"cubic-bezier(0.2, 0, 0, 1)",STANDARD_ACCELERATE:"cubic-bezier(.3,0,1,1)",STANDARD_DECELERATE:"cubic-bezier(0,0,0,1)",EMPHASIZED:"cubic-bezier(.3,0,0,1)",EMPHASIZED_ACCELERATE:"cubic-bezier(.3,0,.8,.15)",EMPHASIZED_DECELERATE:"cubic-bezier(.05,.7,.1,1)"};var wn=450,Kt=225,kn=.2,xn=10,Tn=75,Sn=.35,An="::after",Cn="forwards",P;(function(n){n[n.INACTIVE=0]="INACTIVE",n[n.TOUCH_DELAY=1]="TOUCH_DELAY",n[n.HOLDING=2]="HOLDING",n[n.WAITING_FOR_CLICK=3]="WAITING_FOR_CLICK"})(P||(P={}));var Pn=["click","contextmenu","pointercancel","pointerdown","pointerenter","pointerleave","pointerup"],En=150,In=window.matchMedia("(forced-colors: active)"),B=class extends k{constructor(){super(...arguments),this.disabled=!1,this.hovered=!1,this.pressed=!1,this.rippleSize="",this.rippleScale="",this.initialSize=0,this.state=P.INACTIVE,this.attachableController=new Z(this,this.onControlChange.bind(this))}get htmlFor(){return this.attachableController.htmlFor}set htmlFor(e){this.attachableController.htmlFor=e}get control(){return this.attachableController.control}set control(e){this.attachableController.control=e}attach(e){this.attachableController.attach(e)}detach(){this.attachableController.detach()}connectedCallback(){super.connectedCallback(),this.setAttribute("aria-hidden","true")}render(){let e={hovered:this.hovered,pressed:this.pressed};return y`<div class="surface ${K(e)}"></div>`}update(e){e.has("disabled")&&this.disabled&&(this.hovered=!1,this.pressed=!1),super.update(e)}handlePointerenter(e){this.shouldReactToEvent(e)&&(this.hovered=!0)}handlePointerleave(e){this.shouldReactToEvent(e)&&(this.hovered=!1,this.state!==P.INACTIVE&&this.endPressAnimation())}handlePointerup(e){if(this.shouldReactToEvent(e)){if(this.state===P.HOLDING){this.state=P.WAITING_FOR_CLICK;return}if(this.state===P.TOUCH_DELAY){this.state=P.WAITING_FOR_CLICK,this.startPressAnimation(this.rippleStartEvent);return}}}async handlePointerdown(e){if(this.shouldReactToEvent(e)){if(this.rippleStartEvent=e,!this.isTouch(e)){this.state=P.WAITING_FOR_CLICK,this.startPressAnimation(e);return}this.state=P.TOUCH_DELAY,await new Promise(t=>{setTimeout(t,En)}),this.state===P.TOUCH_DELAY&&(this.state=P.HOLDING,this.startPressAnimation(e))}}handleClick(){if(!this.disabled){if(this.state===P.WAITING_FOR_CLICK){this.endPressAnimation();return}this.state===P.INACTIVE&&(this.startPressAnimation(),this.endPressAnimation())}}handlePointercancel(e){this.shouldReactToEvent(e)&&this.endPressAnimation()}handleContextmenu(){this.disabled||this.endPressAnimation()}determineRippleSize(){let{height:e,width:t}=this.getBoundingClientRect(),r=Math.max(e,t),a=Math.max(Sn*r,Tn),i=this.currentCSSZoom??1,o=Math.floor(r*kn/i),d=Math.sqrt(t**2+e**2)+xn;this.initialSize=o;let f=(d+a)/o;this.rippleScale=`${f/i}`,this.rippleSize=`${o}px`}getNormalizedPointerEventCoords(e){let{scrollX:t,scrollY:r}=window,{left:a,top:i}=this.getBoundingClientRect(),o=t+a,c=r+i,{pageX:d,pageY:f}=e,v=this.currentCSSZoom??1;return{x:(d-o)/v,y:(f-c)/v}}getTranslationCoordinates(e){let{height:t,width:r}=this.getBoundingClientRect(),a=this.currentCSSZoom??1,i={x:(r/a-this.initialSize)/2,y:(t/a-this.initialSize)/2},o;return e instanceof PointerEvent?o=this.getNormalizedPointerEventCoords(e):o={x:r/a/2,y:t/a/2},o={x:o.x-this.initialSize/2,y:o.y-this.initialSize/2},{startPoint:o,endPoint:i}}startPressAnimation(e){if(!this.mdRoot)return;this.pressed=!0,this.growAnimation?.cancel(),this.determineRippleSize();let{startPoint:t,endPoint:r}=this.getTranslationCoordinates(e),a=`${t.x}px, ${t.y}px`,i=`${r.x}px, ${r.y}px`;this.growAnimation=this.mdRoot.animate({top:[0,0],left:[0,0],height:[this.rippleSize,this.rippleSize],width:[this.rippleSize,this.rippleSize],transform:[`translate(${a}) scale(1)`,`translate(${i}) scale(${this.rippleScale})`]},{pseudoElement:An,duration:wn,easing:Gt.STANDARD,fill:Cn})}async endPressAnimation(){this.rippleStartEvent=void 0,this.state=P.INACTIVE;let e=this.growAnimation,t=1/0;if(typeof e?.currentTime=="number"?t=e.currentTime:e?.currentTime&&(t=e.currentTime.to("ms").value),t>=Kt){this.pressed=!1;return}await new Promise(r=>{setTimeout(r,Kt-t)}),this.growAnimation===e&&(this.pressed=!1)}shouldReactToEvent(e){if(this.disabled||!e.isPrimary||this.rippleStartEvent&&this.rippleStartEvent.pointerId!==e.pointerId)return!1;if(e.type==="pointerenter"||e.type==="pointerleave")return!this.isTouch(e);let t=e.buttons===1;return this.isTouch(e)||t}isTouch({pointerType:e}){return e==="touch"}async handleEvent(e){if(!In?.matches)switch(e.type){case"click":this.handleClick();break;case"contextmenu":this.handleContextmenu();break;case"pointercancel":this.handlePointercancel(e);break;case"pointerdown":await this.handlePointerdown(e);break;case"pointerenter":this.handlePointerenter(e);break;case"pointerleave":this.handlePointerleave(e);break;case"pointerup":this.handlePointerup(e);break;default:break}}onControlChange(e,t){if(!!1)for(let r of Pn)e?.removeEventListener(r,this),t?.addEventListener(r,this)}};h([b({type:Boolean,reflect:!0})],B.prototype,"disabled",void 0);h([$()],B.prototype,"hovered",void 0);h([$()],B.prototype,"pressed",void 0);h([F(".surface")],B.prototype,"mdRoot",void 0);var at=w`:host{display:flex;margin:auto;pointer-events:none}:host([disabled]){display:none}@media(forced-colors: active){:host{display:none}}:host,.surface{border-radius:inherit;position:absolute;inset:0;overflow:hidden}.surface{-webkit-tap-highlight-color:rgba(0,0,0,0)}.surface::before,.surface::after{content:"";opacity:0;position:absolute}.surface::before{background-color:var(--md-ripple-hover-color, var(--md-sys-color-on-surface, #1d1b20));inset:0;transition:opacity 15ms linear,background-color 15ms linear}.surface::after{background:radial-gradient(closest-side, var(--md-ripple-pressed-color, var(--md-sys-color-on-surface, #1d1b20)) max(100% - 70px, 65%), transparent 100%);transform-origin:center center;transition:opacity 375ms linear}.hovered::before{background-color:var(--md-ripple-hover-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-ripple-hover-opacity, 0.08)}.pressed::after{opacity:var(--md-ripple-pressed-opacity, 0.12);transition-duration:105ms}
`,ni=at.styleSheet;var it=class extends B{};it.styles=[at];it=h([I("md-ripple")],it);var ot=["role","ariaAtomic","ariaAutoComplete","ariaBusy","ariaChecked","ariaColCount","ariaColIndex","ariaColSpan","ariaCurrent","ariaDisabled","ariaExpanded","ariaHasPopup","ariaHidden","ariaInvalid","ariaKeyShortcuts","ariaLabel","ariaLevel","ariaLive","ariaModal","ariaMultiLine","ariaMultiSelectable","ariaOrientation","ariaPlaceholder","ariaPosInSet","ariaPressed","ariaReadOnly","ariaRequired","ariaRoleDescription","ariaRowCount","ariaRowIndex","ariaRowSpan","ariaSelected","ariaSetSize","ariaSort","ariaValueMax","ariaValueMin","ariaValueNow","ariaValueText"],Dn=ot.map(st);function Re(n){return Dn.includes(n)}function st(n){return n.replace("aria","aria-").replace(/Elements?/g,"").toLowerCase()}var Ne=Symbol("privateIgnoreAttributeChangesFor");function ee(n){var e;if(!1)return n;class t extends n{constructor(){super(...arguments),this[e]=new Set}attributeChangedCallback(a,i,o){if(!Re(a)){super.attributeChangedCallback(a,i,o);return}if(this[Ne].has(a))return;this[Ne].add(a),this.removeAttribute(a),this[Ne].delete(a);let c=ct(a);o===null?delete this.dataset[c]:this.dataset[c]=o,this.requestUpdate(ct(a),i)}getAttribute(a){return Re(a)?super.getAttribute(dt(a)):super.getAttribute(a)}removeAttribute(a){super.removeAttribute(a),Re(a)&&(super.removeAttribute(dt(a)),this.requestUpdate())}}return e=Ne,Rn(t),t}function Rn(n){for(let e of ot){let t=st(e),r=dt(t),a=ct(t);n.createProperty(e,{attribute:t,noAccessor:!0}),n.createProperty(Symbol(r),{attribute:r,noAccessor:!0}),Object.defineProperty(n.prototype,e,{configurable:!0,enumerable:!0,get(){return this.dataset[a]??null},set(i){let o=this.dataset[a]??null;i!==o&&(i===null?delete this.dataset[a]:this.dataset[a]=i,this.requestUpdate(e,o))}})}}function dt(n){return`data-${n}`}function ct(n){return n.replace(/-\w/,e=>e[1].toUpperCase())}function te(n){let e=new MouseEvent("click",{bubbles:!0});return n.dispatchEvent(e),e}function ne(n){return n.currentTarget!==n.target||n.composedPath()[0]!==n.target||n.target.disabled?!1:!Nn(n)}function Nn(n){let e=lt;return e&&(n.preventDefault(),n.stopImmediatePropagation()),jn(),e}var lt=!1;async function jn(){lt=!0,await null,lt=!1}var D=Symbol("internals"),pt=Symbol("privateInternals");function re(n){class e extends n{get[D](){return this[pt]||(this[pt]=this.attachInternals()),this[pt]}}return e}var J=Symbol("getFormValue"),ae=Symbol("getFormState");function ie(n){class e extends n{get form(){return this[D].form}get labels(){return this[D].labels}get name(){return this.getAttribute("name")??""}set name(r){this.setAttribute("name",r)}get disabled(){return this.hasAttribute("disabled")}set disabled(r){this.toggleAttribute("disabled",!!r)}attributeChangedCallback(r,a,i){if(r==="name"||r==="disabled"){let o=r==="disabled"?a!==null:a;this.requestUpdate(r,o);return}super.attributeChangedCallback(r,a,i)}requestUpdate(r,a,i){super.requestUpdate(r,a,i),this[D].setFormValue(this[J](),this[ae]())}[J](){return this.getAttribute("value")}[ae](){return this[J]()}formDisabledCallback(r){this.disabled=r}}return e.formAssociated=!0,h([b({noAccessor:!0})],e.prototype,"name",null),h([b({type:Boolean,noAccessor:!0})],e.prototype,"disabled",null),e}var Yt=Symbol("dispatchHooks");function je(n,e){let t=n[Yt];if(!t)throw new Error(`'${n.type}' event needs setupDispatchHooks().`);t.addEventListener("after",e,{once:!0})}var Jt=new WeakMap;function _e(n,...e){let t=Jt.get(n);t||(t=new Set,Jt.set(n,t));for(let r of e)t.has(r)||(n.addEventListener(r,a=>{let i=new EventTarget;a[Yt]=i;let o=new AbortController,c=()=>{o.abort(),i.dispatchEvent(new Event("after"))},d=g=>function(){g.call(this),c()};a.stopPropagation=d(a.stopPropagation),a.stopImmediatePropagation=d(a.stopImmediatePropagation);let f=a.composedPath(),v;a.composed&&a.bubbles?v=f[f.length-1]:a.bubbles?v=f[0].getRootNode():v=f[0],v.addEventListener(r,()=>{c()},{once:!0,signal:o.signal})},{capture:!0}),t.add(r))}function Xt(n){class e extends n{get name(){return this.getAttribute("name")??""}set name(r){this.setAttribute("name",r)}constructor(...r){super(...r),this.type="submit",this.value="",!!1&&(_e(this,"click"),this.addEventListener("click",async a=>{let i=this.type==="reset",o=this.type==="submit",c=this[D],{form:d}=c;!d||!(o||i)||je(a,()=>{if(!a.defaultPrevented){if(i){d.reset();return}d.addEventListener("submit",f=>{Object.defineProperty(f,"submitter",{configurable:!0,enumerable:!0,get:()=>this})},{capture:!0,once:!0}),c.setFormValue(this.value),d.requestSubmit()}})}))}}return h([b()],e.prototype,"type",void 0),h([b({reflect:!0})],e.prototype,"value",void 0),e}var _n=ee(Xt(ie(re(k)))),E=class extends _n{constructor(){super(),this.softDisabled=!1,this.href="",this.download="",this.target="",this.trailingIcon=!1,this.hasIcon=!1,this.addEventListener("click",this.handleClick.bind(this))}focus(){this.buttonElement?.focus()}blur(){this.buttonElement?.blur()}render(){let e=this.disabled||this.softDisabled,t=this.href?this.renderLink():this.renderButton(),r=this.href?"link":"button";return y`
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
    `}handleClick(e){if(this.softDisabled||this.disabled&&this.href){e.stopImmediatePropagation(),e.preventDefault();return}!ne(e)||!this.buttonElement||(this.focus(),te(this.buttonElement))}handleSlotChange(){this.hasIcon=this.assignedIcons.length>0}};E.shadowRootOptions={mode:"open",delegatesFocus:!0};h([b({type:Boolean,attribute:"soft-disabled",reflect:!0})],E.prototype,"softDisabled",void 0);h([b()],E.prototype,"href",void 0);h([b()],E.prototype,"download",void 0);h([b()],E.prototype,"target",void 0);h([b({type:Boolean,attribute:"trailing-icon",reflect:!0})],E.prototype,"trailingIcon",void 0);h([b({type:Boolean,attribute:"has-icon",reflect:!0})],E.prototype,"hasIcon",void 0);h([F(".button")],E.prototype,"buttonElement",void 0);h([It({slot:"icon",flatten:!0})],E.prototype,"assignedIcons",void 0);var Le=class extends E{renderElevationOrOutline(){return y`<md-elevation part="elevation"></md-elevation>`}};var ht=w`:host{--_container-color: var(--md-filled-button-container-color, var(--md-sys-color-primary, #6750a4));--_container-elevation: var(--md-filled-button-container-elevation, 0);--_container-height: var(--md-filled-button-container-height, 40px);--_container-shadow-color: var(--md-filled-button-container-shadow-color, var(--md-sys-color-shadow, #000));--_disabled-container-color: var(--md-filled-button-disabled-container-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-container-elevation: var(--md-filled-button-disabled-container-elevation, 0);--_disabled-container-opacity: var(--md-filled-button-disabled-container-opacity, 0.12);--_disabled-label-text-color: var(--md-filled-button-disabled-label-text-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-label-text-opacity: var(--md-filled-button-disabled-label-text-opacity, 0.38);--_focus-container-elevation: var(--md-filled-button-focus-container-elevation, 0);--_focus-label-text-color: var(--md-filled-button-focus-label-text-color, var(--md-sys-color-on-primary, #fff));--_hover-container-elevation: var(--md-filled-button-hover-container-elevation, 1);--_hover-label-text-color: var(--md-filled-button-hover-label-text-color, var(--md-sys-color-on-primary, #fff));--_hover-state-layer-color: var(--md-filled-button-hover-state-layer-color, var(--md-sys-color-on-primary, #fff));--_hover-state-layer-opacity: var(--md-filled-button-hover-state-layer-opacity, 0.08);--_label-text-color: var(--md-filled-button-label-text-color, var(--md-sys-color-on-primary, #fff));--_label-text-font: var(--md-filled-button-label-text-font, var(--md-sys-typescale-label-large-font, var(--md-ref-typeface-plain, Roboto)));--_label-text-line-height: var(--md-filled-button-label-text-line-height, var(--md-sys-typescale-label-large-line-height, 1.25rem));--_label-text-size: var(--md-filled-button-label-text-size, var(--md-sys-typescale-label-large-size, 0.875rem));--_label-text-weight: var(--md-filled-button-label-text-weight, var(--md-sys-typescale-label-large-weight, var(--md-ref-typeface-weight-medium, 500)));--_pressed-container-elevation: var(--md-filled-button-pressed-container-elevation, 0);--_pressed-label-text-color: var(--md-filled-button-pressed-label-text-color, var(--md-sys-color-on-primary, #fff));--_pressed-state-layer-color: var(--md-filled-button-pressed-state-layer-color, var(--md-sys-color-on-primary, #fff));--_pressed-state-layer-opacity: var(--md-filled-button-pressed-state-layer-opacity, 0.12);--_disabled-icon-color: var(--md-filled-button-disabled-icon-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-icon-opacity: var(--md-filled-button-disabled-icon-opacity, 0.38);--_focus-icon-color: var(--md-filled-button-focus-icon-color, var(--md-sys-color-on-primary, #fff));--_hover-icon-color: var(--md-filled-button-hover-icon-color, var(--md-sys-color-on-primary, #fff));--_icon-color: var(--md-filled-button-icon-color, var(--md-sys-color-on-primary, #fff));--_icon-size: var(--md-filled-button-icon-size, 18px);--_pressed-icon-color: var(--md-filled-button-pressed-icon-color, var(--md-sys-color-on-primary, #fff));--_container-shape-start-start: var(--md-filled-button-container-shape-start-start, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-start-end: var(--md-filled-button-container-shape-start-end, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-end: var(--md-filled-button-container-shape-end-end, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-start: var(--md-filled-button-container-shape-end-start, var(--md-filled-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_leading-space: var(--md-filled-button-leading-space, 24px);--_trailing-space: var(--md-filled-button-trailing-space, 24px);--_with-leading-icon-leading-space: var(--md-filled-button-with-leading-icon-leading-space, 16px);--_with-leading-icon-trailing-space: var(--md-filled-button-with-leading-icon-trailing-space, 24px);--_with-trailing-icon-leading-space: var(--md-filled-button-with-trailing-icon-leading-space, 24px);--_with-trailing-icon-trailing-space: var(--md-filled-button-with-trailing-icon-trailing-space, 16px)}
`,eo=ht.styleSheet;var ut=w`md-elevation{transition-duration:280ms}:host(:is([disabled],[soft-disabled])) md-elevation{transition:none}md-elevation{--md-elevation-level: var(--_container-elevation);--md-elevation-shadow-color: var(--_container-shadow-color)}:host(:focus-within) md-elevation{--md-elevation-level: var(--_focus-container-elevation)}:host(:hover) md-elevation{--md-elevation-level: var(--_hover-container-elevation)}:host(:active) md-elevation{--md-elevation-level: var(--_pressed-container-elevation)}:host(:is([disabled],[soft-disabled])) md-elevation{--md-elevation-level: var(--_disabled-container-elevation)}
`,ao=ut.styleSheet;var we=w`:host{border-start-start-radius:var(--_container-shape-start-start);border-start-end-radius:var(--_container-shape-start-end);border-end-start-radius:var(--_container-shape-end-start);border-end-end-radius:var(--_container-shape-end-end);box-sizing:border-box;cursor:pointer;display:inline-flex;gap:8px;min-height:var(--_container-height);outline:none;padding-block:calc((var(--_container-height) - max(var(--_label-text-line-height),var(--_icon-size)))/2);padding-inline-start:var(--_leading-space);padding-inline-end:var(--_trailing-space);place-content:center;place-items:center;position:relative;font-family:var(--_label-text-font);font-size:var(--_label-text-size);line-height:var(--_label-text-line-height);font-weight:var(--_label-text-weight);text-overflow:ellipsis;text-wrap:nowrap;user-select:none;-webkit-tap-highlight-color:rgba(0,0,0,0);vertical-align:top;--md-ripple-hover-color: var(--_hover-state-layer-color);--md-ripple-pressed-color: var(--_pressed-state-layer-color);--md-ripple-hover-opacity: var(--_hover-state-layer-opacity);--md-ripple-pressed-opacity: var(--_pressed-state-layer-opacity)}md-focus-ring{--md-focus-ring-shape-start-start: var(--_container-shape-start-start);--md-focus-ring-shape-start-end: var(--_container-shape-start-end);--md-focus-ring-shape-end-end: var(--_container-shape-end-end);--md-focus-ring-shape-end-start: var(--_container-shape-end-start)}:host(:is([disabled],[soft-disabled])){cursor:default;pointer-events:none}.button{border-radius:inherit;cursor:inherit;display:inline-flex;align-items:center;justify-content:center;border:none;outline:none;-webkit-appearance:none;vertical-align:middle;background:rgba(0,0,0,0);text-decoration:none;min-width:calc(64px - var(--_leading-space) - var(--_trailing-space));width:100%;z-index:0;height:100%;font:inherit;color:var(--_label-text-color);padding:0;gap:inherit;text-transform:inherit}.button::-moz-focus-inner{padding:0;border:0}:host(:hover) .button{color:var(--_hover-label-text-color)}:host(:focus-within) .button{color:var(--_focus-label-text-color)}:host(:active) .button{color:var(--_pressed-label-text-color)}.background{background:var(--_container-color);border-radius:inherit;inset:0;position:absolute}.label{overflow:hidden}:is(.button,.label,.label slot),.label ::slotted(*){text-overflow:inherit}:host(:is([disabled],[soft-disabled])) .label{color:var(--_disabled-label-text-color);opacity:var(--_disabled-label-text-opacity)}:host(:is([disabled],[soft-disabled])) .background{background:var(--_disabled-container-color);opacity:var(--_disabled-container-opacity)}@media(forced-colors: active){.background{border:1px solid CanvasText}:host(:is([disabled],[soft-disabled])){--_disabled-icon-color: GrayText;--_disabled-icon-opacity: 1;--_disabled-container-opacity: 1;--_disabled-label-text-color: GrayText;--_disabled-label-text-opacity: 1}}:host([has-icon]:not([trailing-icon])){padding-inline-start:var(--_with-leading-icon-leading-space);padding-inline-end:var(--_with-leading-icon-trailing-space)}:host([has-icon][trailing-icon]){padding-inline-start:var(--_with-trailing-icon-leading-space);padding-inline-end:var(--_with-trailing-icon-trailing-space)}::slotted([slot=icon]){display:inline-flex;position:relative;writing-mode:horizontal-tb;fill:currentColor;flex-shrink:0;color:var(--_icon-color);font-size:var(--_icon-size);inline-size:var(--_icon-size);block-size:var(--_icon-size)}:host(:hover) ::slotted([slot=icon]){color:var(--_hover-icon-color)}:host(:focus-within) ::slotted([slot=icon]){color:var(--_focus-icon-color)}:host(:active) ::slotted([slot=icon]){color:var(--_pressed-icon-color)}:host(:is([disabled],[soft-disabled])) ::slotted([slot=icon]){color:var(--_disabled-icon-color);opacity:var(--_disabled-icon-opacity)}.touch{position:absolute;top:50%;height:max(48px,100%);left:0;right:0;transform:translateY(-50%)}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--_container-height))/2) 0}:host([touch-target=none]) .touch{display:none}
`,co=we.styleSheet;var mt=class extends Le{};mt.styles=[we,ut,ht];mt=h([I("md-filled-button")],mt);var Oe=class extends E{renderElevationOrOutline(){return y`<div class="outline"></div>`}};var ft=w`:host{--_container-height: var(--md-outlined-button-container-height, 40px);--_disabled-label-text-color: var(--md-outlined-button-disabled-label-text-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-label-text-opacity: var(--md-outlined-button-disabled-label-text-opacity, 0.38);--_disabled-outline-color: var(--md-outlined-button-disabled-outline-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-outline-opacity: var(--md-outlined-button-disabled-outline-opacity, 0.12);--_focus-label-text-color: var(--md-outlined-button-focus-label-text-color, var(--md-sys-color-primary, #6750a4));--_hover-label-text-color: var(--md-outlined-button-hover-label-text-color, var(--md-sys-color-primary, #6750a4));--_hover-state-layer-color: var(--md-outlined-button-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--_hover-state-layer-opacity: var(--md-outlined-button-hover-state-layer-opacity, 0.08);--_label-text-color: var(--md-outlined-button-label-text-color, var(--md-sys-color-primary, #6750a4));--_label-text-font: var(--md-outlined-button-label-text-font, var(--md-sys-typescale-label-large-font, var(--md-ref-typeface-plain, Roboto)));--_label-text-line-height: var(--md-outlined-button-label-text-line-height, var(--md-sys-typescale-label-large-line-height, 1.25rem));--_label-text-size: var(--md-outlined-button-label-text-size, var(--md-sys-typescale-label-large-size, 0.875rem));--_label-text-weight: var(--md-outlined-button-label-text-weight, var(--md-sys-typescale-label-large-weight, var(--md-ref-typeface-weight-medium, 500)));--_outline-color: var(--md-outlined-button-outline-color, var(--md-sys-color-outline, #79747e));--_outline-width: var(--md-outlined-button-outline-width, 1px);--_pressed-label-text-color: var(--md-outlined-button-pressed-label-text-color, var(--md-sys-color-primary, #6750a4));--_pressed-outline-color: var(--md-outlined-button-pressed-outline-color, var(--md-sys-color-outline, #79747e));--_pressed-state-layer-color: var(--md-outlined-button-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--_pressed-state-layer-opacity: var(--md-outlined-button-pressed-state-layer-opacity, 0.12);--_disabled-icon-color: var(--md-outlined-button-disabled-icon-color, var(--md-sys-color-on-surface, #1d1b20));--_disabled-icon-opacity: var(--md-outlined-button-disabled-icon-opacity, 0.38);--_focus-icon-color: var(--md-outlined-button-focus-icon-color, var(--md-sys-color-primary, #6750a4));--_hover-icon-color: var(--md-outlined-button-hover-icon-color, var(--md-sys-color-primary, #6750a4));--_icon-color: var(--md-outlined-button-icon-color, var(--md-sys-color-primary, #6750a4));--_icon-size: var(--md-outlined-button-icon-size, 18px);--_pressed-icon-color: var(--md-outlined-button-pressed-icon-color, var(--md-sys-color-primary, #6750a4));--_container-shape-start-start: var(--md-outlined-button-container-shape-start-start, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-start-end: var(--md-outlined-button-container-shape-start-end, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-end: var(--md-outlined-button-container-shape-end-end, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_container-shape-end-start: var(--md-outlined-button-container-shape-end-start, var(--md-outlined-button-container-shape, var(--md-sys-shape-corner-full, 9999px)));--_leading-space: var(--md-outlined-button-leading-space, 24px);--_trailing-space: var(--md-outlined-button-trailing-space, 24px);--_with-leading-icon-leading-space: var(--md-outlined-button-with-leading-icon-leading-space, 16px);--_with-leading-icon-trailing-space: var(--md-outlined-button-with-leading-icon-trailing-space, 24px);--_with-trailing-icon-leading-space: var(--md-outlined-button-with-trailing-icon-leading-space, 24px);--_with-trailing-icon-trailing-space: var(--md-outlined-button-with-trailing-icon-trailing-space, 16px);--_container-color: none;--_disabled-container-color: none;--_disabled-container-opacity: 0}.outline{inset:0;border-style:solid;position:absolute;box-sizing:border-box;border-color:var(--_outline-color);border-start-start-radius:var(--_container-shape-start-start);border-start-end-radius:var(--_container-shape-start-end);border-end-start-radius:var(--_container-shape-end-start);border-end-end-radius:var(--_container-shape-end-end)}:host(:active) .outline{border-color:var(--_pressed-outline-color)}:host(:is([disabled],[soft-disabled])) .outline{border-color:var(--_disabled-outline-color);opacity:var(--_disabled-outline-opacity)}@media(forced-colors: active){:host(:is([disabled],[soft-disabled])) .background{border-color:GrayText}:host(:is([disabled],[soft-disabled])) .outline{opacity:1}}.outline,md-ripple{border-width:var(--_outline-width)}md-ripple{inline-size:calc(100% - 2*var(--_outline-width));block-size:calc(100% - 2*var(--_outline-width));border-style:solid;border-color:rgba(0,0,0,0)}
`,Co=ft.styleSheet;var gt=class extends Oe{};gt.styles=[we,ft];gt=h([I("md-outlined-button")],gt);function qe(n,e){e.bubbles&&(!n.shadowRoot||e.composed)&&e.stopPropagation();let t=Reflect.construct(e.constructor,[e.type,e]),r=n.dispatchEvent(t);return r||e.preventDefault(),r}var oe=Symbol("createValidator"),se=Symbol("getValidityAnchor"),vt=Symbol("privateValidator"),q=Symbol("privateSyncValidity"),ze=Symbol("privateCustomValidationMessage");function Fe(n){var e;class t extends n{constructor(){super(...arguments),this[e]=""}get validity(){return this[q](),this[D].validity}get validationMessage(){return this[q](),this[D].validationMessage}get willValidate(){return this[q](),this[D].willValidate}checkValidity(){return this[q](),this[D].checkValidity()}reportValidity(){return this[q](),this[D].reportValidity()}setCustomValidity(a){this[ze]=a,this[q]()}requestUpdate(a,i,o){super.requestUpdate(a,i,o),this[q]()}firstUpdated(a){super.firstUpdated(a),this[q]()}[(e=ze,q)](){if(!1)return;this[vt]||(this[vt]=this[oe]());let{validity:a,validationMessage:i}=this[vt].getValidity(),o=!!this[ze],c=this[ze]||i;this[D].setValidity({...a,customError:o},c,this[se]()??void 0)}[oe](){throw new Error("Implement [createValidator]")}[se](){throw new Error("Implement [getValidityAnchor]")}}return t}var Me=class{constructor(e){this.getCurrentState=e,this.currentValidity={validity:{},validationMessage:""}}getValidity(){let e=this.getCurrentState();if(!(!this.prevState||!this.equals(this.prevState,e)))return this.currentValidity;let{validity:r,validationMessage:a}=this.computeValidity(e);return this.prevState=this.copy(e),this.currentValidity={validationMessage:a,validity:{badInput:r.badInput,customError:r.customError,patternMismatch:r.patternMismatch,rangeOverflow:r.rangeOverflow,rangeUnderflow:r.rangeUnderflow,stepMismatch:r.stepMismatch,tooLong:r.tooLong,tooShort:r.tooShort,typeMismatch:r.typeMismatch,valueMissing:r.valueMissing}},this.currentValidity}};var de=class extends Me{computeValidity(e){return this.checkboxControl||(this.checkboxControl=document.createElement("input"),this.checkboxControl.type="checkbox"),this.checkboxControl.checked=e.checked,this.checkboxControl.required=e.required,{validity:this.checkboxControl.validity,validationMessage:this.checkboxControl.validationMessage}}equals(e,t){return e.checked===t.checked&&e.required===t.required}copy({checked:e,required:t}){return{checked:e,required:t}}};var Ln=ee(Fe(ie(re(k)))),_=class extends Ln{constructor(){super(),this.selected=!1,this.icons=!1,this.showOnlySelectedIcon=!1,this.required=!1,this.value="on",!!1&&(this.addEventListener("click",e=>{!ne(e)||!this.input||(this.focus(),te(this.input))}),_e(this,"keydown"),this.addEventListener("keydown",e=>{je(e,()=>{e.defaultPrevented||e.key!=="Enter"||this.disabled||!this.input||this.input.click()})}))}render(){return y`
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
    `}renderTouchTarget(){return y`<span class="touch"></span>`}shouldShowIcons(){return this.icons||this.showOnlySelectedIcon}handleInput(e){let t=e.target;this.selected=t.checked}handleChange(e){qe(this,e)}[J](){return this.selected?this.value:null}[ae](){return String(this.selected)}formResetCallback(){this.selected=this.hasAttribute("selected")}formStateRestoreCallback(e){this.selected=e==="true"}[oe](){return new de(()=>({checked:this.selected,required:this.required}))}[se](){return this.input}};_.shadowRootOptions={mode:"open",delegatesFocus:!0};h([b({type:Boolean})],_.prototype,"selected",void 0);h([b({type:Boolean})],_.prototype,"icons",void 0);h([b({type:Boolean,attribute:"show-only-selected-icon"})],_.prototype,"showOnlySelectedIcon",void 0);h([b({type:Boolean})],_.prototype,"required",void 0);h([b()],_.prototype,"value",void 0);h([F("input")],_.prototype,"input",void 0);var bt=w`@layer styles, hcm;@layer styles{:host{display:inline-flex;outline:none;vertical-align:top;-webkit-tap-highlight-color:rgba(0,0,0,0);cursor:pointer}:host([disabled]){cursor:default}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--md-switch-track-height, 32px))/2) 0px}md-focus-ring{--md-focus-ring-shape-start-start: var(--md-switch-track-shape-start-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-start-end: var(--md-switch-track-shape-start-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-end-end: var(--md-switch-track-shape-end-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));--md-focus-ring-shape-end-start: var(--md-switch-track-shape-end-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)))}.switch{align-items:center;display:inline-flex;flex-shrink:0;position:relative;width:var(--md-switch-track-width, 52px);height:var(--md-switch-track-height, 32px);border-start-start-radius:var(--md-switch-track-shape-start-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-start-end-radius:var(--md-switch-track-shape-start-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-end-radius:var(--md-switch-track-shape-end-end, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-start-radius:var(--md-switch-track-shape-end-start, var(--md-switch-track-shape, var(--md-sys-shape-corner-full, 9999px)))}input{appearance:none;background:none;height:max(100%,var(--md-switch-touch-target-size, 48px));outline:none;margin:0;position:absolute;width:max(100%,var(--md-switch-touch-target-size, 48px));z-index:1;cursor:inherit;top:50%;left:50%;transform:translate(-50%, -50%)}:host([touch-target=none]) input{display:none}}@layer styles{.track{position:absolute;width:100%;height:100%;box-sizing:border-box;border-radius:inherit;display:flex;justify-content:center;align-items:center}.track::before{content:"";display:flex;position:absolute;height:100%;width:100%;border-radius:inherit;box-sizing:border-box;transition-property:opacity,background-color;transition-timing-function:linear;transition-duration:67ms}.disabled .track{background-color:rgba(0,0,0,0);border-color:rgba(0,0,0,0)}.disabled .track::before,.disabled .track::after{transition:none;opacity:var(--md-switch-disabled-track-opacity, 0.12)}.disabled .track::before{background-clip:content-box}.selected .track::before{background-color:var(--md-switch-selected-track-color, var(--md-sys-color-primary, #6750a4))}.selected:hover .track::before{background-color:var(--md-switch-selected-hover-track-color, var(--md-sys-color-primary, #6750a4))}.selected:focus-within .track::before{background-color:var(--md-switch-selected-focus-track-color, var(--md-sys-color-primary, #6750a4))}.selected:active .track::before{background-color:var(--md-switch-selected-pressed-track-color, var(--md-sys-color-primary, #6750a4))}.selected.disabled .track{background-clip:border-box}.selected.disabled .track::before{background-color:var(--md-switch-disabled-selected-track-color, var(--md-sys-color-on-surface, #1d1b20))}.unselected .track::before{background-color:var(--md-switch-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-track-outline-color, var(--md-sys-color-outline, #79747e));border-style:solid;border-width:var(--md-switch-track-outline-width, 2px)}.unselected:hover .track::before{background-color:var(--md-switch-hover-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-hover-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected:focus-visible .track::before{background-color:var(--md-switch-focus-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-focus-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected:active .track::before{background-color:var(--md-switch-pressed-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-pressed-track-outline-color, var(--md-sys-color-outline, #79747e))}.unselected.disabled .track::before{background-color:var(--md-switch-disabled-track-color, var(--md-sys-color-surface-container-highest, #e6e0e9));border-color:var(--md-switch-disabled-track-outline-color, var(--md-sys-color-on-surface, #1d1b20))}}@layer hcm{@media(forced-colors: active){.selected .track::before{background:ButtonText;border-color:ButtonText}.disabled .track::before{border-color:GrayText;opacity:1}.disabled.selected .track::before{background:GrayText}}}@layer styles{.handle-container{display:flex;place-content:center;place-items:center;position:relative;transition:margin 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)}.selected .handle-container{margin-inline-start:calc(var(--md-switch-track-width, 52px) - var(--md-switch-track-height, 32px))}.unselected .handle-container{margin-inline-end:calc(var(--md-switch-track-width, 52px) - var(--md-switch-track-height, 32px))}.disabled .handle-container{transition:none}.handle{border-start-start-radius:var(--md-switch-handle-shape-start-start, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-start-end-radius:var(--md-switch-handle-shape-start-end, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-end-radius:var(--md-switch-handle-shape-end-end, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));border-end-start-radius:var(--md-switch-handle-shape-end-start, var(--md-switch-handle-shape, var(--md-sys-shape-corner-full, 9999px)));height:var(--md-switch-handle-height, 16px);width:var(--md-switch-handle-width, 16px);transform-origin:center;transition-property:height,width;transition-duration:250ms,250ms;transition-timing-function:cubic-bezier(0.2, 0, 0, 1),cubic-bezier(0.2, 0, 0, 1);z-index:0}.handle::before{content:"";display:flex;inset:0;position:absolute;border-radius:inherit;box-sizing:border-box;transition:background-color 67ms linear}.disabled .handle,.disabled .handle::before{transition:none}.selected .handle{height:var(--md-switch-selected-handle-height, 24px);width:var(--md-switch-selected-handle-width, 24px)}.handle.with-icon{height:var(--md-switch-with-icon-handle-height, 24px);width:var(--md-switch-with-icon-handle-width, 24px)}.selected:not(.disabled):active .handle,.unselected:not(.disabled):active .handle{height:var(--md-switch-pressed-handle-height, 28px);width:var(--md-switch-pressed-handle-width, 28px);transition-timing-function:linear;transition-duration:100ms}.selected .handle::before{background-color:var(--md-switch-selected-handle-color, var(--md-sys-color-on-primary, #fff))}.selected:hover .handle::before{background-color:var(--md-switch-selected-hover-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected:focus-within .handle::before{background-color:var(--md-switch-selected-focus-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected:active .handle::before{background-color:var(--md-switch-selected-pressed-handle-color, var(--md-sys-color-primary-container, #eaddff))}.selected.disabled .handle::before{background-color:var(--md-switch-disabled-selected-handle-color, var(--md-sys-color-surface, #fef7ff));opacity:var(--md-switch-disabled-selected-handle-opacity, 1)}.unselected .handle::before{background-color:var(--md-switch-handle-color, var(--md-sys-color-outline, #79747e))}.unselected:hover .handle::before{background-color:var(--md-switch-hover-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected:focus-within .handle::before{background-color:var(--md-switch-focus-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected:active .handle::before{background-color:var(--md-switch-pressed-handle-color, var(--md-sys-color-on-surface-variant, #49454f))}.unselected.disabled .handle::before{background-color:var(--md-switch-disabled-handle-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-switch-disabled-handle-opacity, 0.38)}md-ripple{border-radius:var(--md-switch-state-layer-shape, var(--md-sys-shape-corner-full, 9999px));height:var(--md-switch-state-layer-size, 40px);inset:unset;width:var(--md-switch-state-layer-size, 40px)}.selected md-ripple{--md-ripple-hover-color: var(--md-switch-selected-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-pressed-color: var(--md-switch-selected-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-hover-opacity: var(--md-switch-selected-hover-state-layer-opacity, 0.08);--md-ripple-pressed-opacity: var(--md-switch-selected-pressed-state-layer-opacity, 0.12)}.unselected md-ripple{--md-ripple-hover-color: var(--md-switch-hover-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-pressed-color: var(--md-switch-pressed-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-hover-opacity: var(--md-switch-hover-state-layer-opacity, 0.08);--md-ripple-pressed-opacity: var(--md-switch-pressed-state-layer-opacity, 0.12)}}@layer hcm{@media(forced-colors: active){.unselected .handle::before{background:ButtonText}.disabled .handle::before{opacity:1}.disabled.unselected .handle::before{background:GrayText}}}@layer styles{.icons{position:relative;height:100%;width:100%}.icon{position:absolute;inset:0;margin:auto;display:flex;align-items:center;justify-content:center;fill:currentColor;transition:fill 67ms linear,opacity 33ms linear,transform 167ms cubic-bezier(0.2, 0, 0, 1);opacity:0}.disabled .icon{transition:none}.selected .icon--on,.unselected .icon--off{opacity:1}.unselected .handle:not(.with-icon) .icon--on{transform:rotate(-45deg)}.icon--off{width:var(--md-switch-icon-size, 16px);height:var(--md-switch-icon-size, 16px);color:var(--md-switch-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:hover .icon--off{color:var(--md-switch-hover-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:focus-within .icon--off{color:var(--md-switch-focus-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected:active .icon--off{color:var(--md-switch-pressed-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9))}.unselected.disabled .icon--off{color:var(--md-switch-disabled-icon-color, var(--md-sys-color-surface-container-highest, #e6e0e9));opacity:var(--md-switch-disabled-icon-opacity, 0.38)}.icon--on{width:var(--md-switch-selected-icon-size, 16px);height:var(--md-switch-selected-icon-size, 16px);color:var(--md-switch-selected-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:hover .icon--on{color:var(--md-switch-selected-hover-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:focus-within .icon--on{color:var(--md-switch-selected-focus-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected:active .icon--on{color:var(--md-switch-selected-pressed-icon-color, var(--md-sys-color-on-primary-container, #21005d))}.selected.disabled .icon--on{color:var(--md-switch-disabled-selected-icon-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-switch-disabled-selected-icon-opacity, 0.38)}}@layer hcm{@media(forced-colors: active){.icon--off{fill:Canvas}.icon--on{fill:ButtonText}.disabled.unselected .icon--off,.disabled.selected .icon--on{opacity:1}.disabled .icon--on{fill:GrayText}}}
`,ps=bt.styleSheet;var yt=class extends _{};yt.styles=[bt];yt=h([I("md-switch")],yt);var On=ee(Fe(ie(re(k)))),N=class extends On{constructor(){super(),this.checked=!1,this.indeterminate=!1,this.required=!1,this.value="on",this.prevChecked=!1,this.prevDisabled=!1,this.prevIndeterminate=!1,this.addEventListener("click",e=>{!ne(e)||!this.input||(this.focus(),te(this.input))})}update(e){(e.has("checked")||e.has("disabled")||e.has("indeterminate"))&&(this.prevChecked=e.get("checked")??this.checked,this.prevDisabled=e.get("disabled")??this.disabled,this.prevIndeterminate=e.get("indeterminate")??this.indeterminate),super.update(e)}render(){let e=!this.prevChecked&&!this.prevIndeterminate,t=this.prevChecked&&!this.prevIndeterminate,r=this.prevIndeterminate,a=this.checked&&!this.indeterminate,i=this.indeterminate,o=K({disabled:this.disabled,selected:a||i,unselected:!a&&!i,checked:a,indeterminate:i,"prev-unselected":e,"prev-checked":t,"prev-indeterminate":r,"prev-disabled":this.prevDisabled}),{ariaLabel:c,ariaInvalid:d}=this;return y`
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
    `}handleInput(e){let t=e.target;this.checked=t.checked,this.indeterminate=t.indeterminate}handleChange(e){qe(this,e)}[J](){return!this.checked||this.indeterminate?null:this.value}[ae](){return String(this.checked)}formResetCallback(){this.checked=this.hasAttribute("checked")}formStateRestoreCallback(e){this.checked=e==="true"}[oe](){return new de(()=>this)}[se](){return this.input}};N.shadowRootOptions={...k.shadowRootOptions,delegatesFocus:!0};h([b({type:Boolean})],N.prototype,"checked",void 0);h([b({type:Boolean})],N.prototype,"indeterminate",void 0);h([b({type:Boolean})],N.prototype,"required",void 0);h([b()],N.prototype,"value",void 0);h([$()],N.prototype,"prevChecked",void 0);h([$()],N.prototype,"prevDisabled",void 0);h([$()],N.prototype,"prevIndeterminate",void 0);h([F("input")],N.prototype,"input",void 0);var wt=w`:host{border-start-start-radius:var(--md-checkbox-container-shape-start-start, var(--md-checkbox-container-shape, 2px));border-start-end-radius:var(--md-checkbox-container-shape-start-end, var(--md-checkbox-container-shape, 2px));border-end-end-radius:var(--md-checkbox-container-shape-end-end, var(--md-checkbox-container-shape, 2px));border-end-start-radius:var(--md-checkbox-container-shape-end-start, var(--md-checkbox-container-shape, 2px));display:inline-flex;height:var(--md-checkbox-container-size, 18px);position:relative;vertical-align:top;width:var(--md-checkbox-container-size, 18px);-webkit-tap-highlight-color:rgba(0,0,0,0);cursor:pointer}:host([disabled]){cursor:default}:host([touch-target=wrapper]){margin:max(0px,(48px - var(--md-checkbox-container-size, 18px))/2)}md-focus-ring{height:44px;inset:unset;width:44px}input{appearance:none;height:48px;margin:0;opacity:0;outline:none;position:absolute;width:48px;z-index:1;cursor:inherit}:host([touch-target=none]) input{height:100%;width:100%}.container{border-radius:inherit;display:flex;height:100%;place-content:center;place-items:center;position:relative;width:100%}.outline,.background,.icon{inset:0;position:absolute}.outline,.background{border-radius:inherit}.outline{border-color:var(--md-checkbox-outline-color, var(--md-sys-color-on-surface-variant, #49454f));border-style:solid;border-width:var(--md-checkbox-outline-width, 2px);box-sizing:border-box}.background{background-color:var(--md-checkbox-selected-container-color, var(--md-sys-color-primary, #6750a4))}.background,.icon{opacity:0;transition-duration:150ms,50ms;transition-property:transform,opacity;transition-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15),linear;transform:scale(0.6)}:where(.selected) :is(.background,.icon){opacity:1;transition-duration:350ms,50ms;transition-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1),linear;transform:scale(1)}md-ripple{border-radius:var(--md-checkbox-state-layer-shape, var(--md-sys-shape-corner-full, 9999px));height:var(--md-checkbox-state-layer-size, 40px);inset:unset;width:var(--md-checkbox-state-layer-size, 40px);--md-ripple-hover-color: var(--md-checkbox-hover-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-hover-opacity: var(--md-checkbox-hover-state-layer-opacity, 0.08);--md-ripple-pressed-color: var(--md-checkbox-pressed-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-pressed-opacity: var(--md-checkbox-pressed-state-layer-opacity, 0.12)}.selected md-ripple{--md-ripple-hover-color: var(--md-checkbox-selected-hover-state-layer-color, var(--md-sys-color-primary, #6750a4));--md-ripple-hover-opacity: var(--md-checkbox-selected-hover-state-layer-opacity, 0.08);--md-ripple-pressed-color: var(--md-checkbox-selected-pressed-state-layer-color, var(--md-sys-color-on-surface, #1d1b20));--md-ripple-pressed-opacity: var(--md-checkbox-selected-pressed-state-layer-opacity, 0.12)}.icon{fill:var(--md-checkbox-selected-icon-color, var(--md-sys-color-on-primary, #fff));height:var(--md-checkbox-icon-size, 18px);width:var(--md-checkbox-icon-size, 18px)}.mark.short{height:2px;transition-property:transform,height;width:2px}.mark.long{height:2px;transition-property:transform,width;width:10px}.mark{animation-duration:150ms;animation-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15);transition-duration:150ms;transition-timing-function:cubic-bezier(0.3, 0, 0.8, 0.15)}.selected .mark{animation-duration:350ms;animation-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1);transition-duration:350ms;transition-timing-function:cubic-bezier(0.05, 0.7, 0.1, 1)}.checked .mark,.prev-checked.unselected .mark{transform:scaleY(-1) translate(7px, -14px) rotate(45deg)}.checked .mark.short,.prev-checked.unselected .mark.short{height:5.6568542495px}.checked .mark.long,.prev-checked.unselected .mark.long{width:11.313708499px}.indeterminate .mark,.prev-indeterminate.unselected .mark{transform:scaleY(-1) translate(4px, -10px) rotate(0deg)}.prev-unselected .mark{transition-property:none}.prev-unselected.checked .mark.long{animation-name:prev-unselected-to-checked}@keyframes prev-unselected-to-checked{from{width:0}}:where(:hover) .outline{border-color:var(--md-checkbox-hover-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-hover-outline-width, 2px)}:where(:hover) .background{background:var(--md-checkbox-selected-hover-container-color, var(--md-sys-color-primary, #6750a4))}:where(:hover) .icon{fill:var(--md-checkbox-selected-hover-icon-color, var(--md-sys-color-on-primary, #fff))}:where(:focus-within) .outline{border-color:var(--md-checkbox-focus-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-focus-outline-width, 2px)}:where(:focus-within) .background{background:var(--md-checkbox-selected-focus-container-color, var(--md-sys-color-primary, #6750a4))}:where(:focus-within) .icon{fill:var(--md-checkbox-selected-focus-icon-color, var(--md-sys-color-on-primary, #fff))}:where(:active) .outline{border-color:var(--md-checkbox-pressed-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-pressed-outline-width, 2px)}:where(:active) .background{background:var(--md-checkbox-selected-pressed-container-color, var(--md-sys-color-primary, #6750a4))}:where(:active) .icon{fill:var(--md-checkbox-selected-pressed-icon-color, var(--md-sys-color-on-primary, #fff))}:where(.disabled,.prev-disabled) :is(.background,.icon,.mark){animation-duration:0s;transition-duration:0s}:where(.disabled) .outline{border-color:var(--md-checkbox-disabled-outline-color, var(--md-sys-color-on-surface, #1d1b20));border-width:var(--md-checkbox-disabled-outline-width, 2px);opacity:var(--md-checkbox-disabled-container-opacity, 0.38)}:where(.selected.disabled) .outline{visibility:hidden}:where(.selected.disabled) .background{background:var(--md-checkbox-selected-disabled-container-color, var(--md-sys-color-on-surface, #1d1b20));opacity:var(--md-checkbox-selected-disabled-container-opacity, 0.38)}:where(.disabled) .icon{fill:var(--md-checkbox-selected-disabled-icon-color, var(--md-sys-color-surface, #fef7ff))}@media(forced-colors: active){.background{background-color:CanvasText}.selected.disabled .background{background-color:GrayText;opacity:1}.outline{border-color:CanvasText}.disabled .outline{border-color:GrayText;opacity:1}.icon{fill:Canvas}}
`,qs=wt.styleSheet;var kt=class extends N{};kt.styles=[wt];kt=h([I("md-checkbox")],kt);function xt(n){if(new TextEncoder().encode(n).length>262144)throw new Error("WORDING_TOO_LARGE");let e=0;function t(){for(;/\s/.test(n[e]||"")&&e<n.length;)e++}function r(){let o=e++;for(;e<n.length;){if(n[e]==="\\"){e+=2;continue}if(n[e++]==='"')return JSON.parse(n.slice(o,e))}throw new Error("INVALID_WORDING")}function a(o){if(o>8)throw new Error("WORDING_DEPTH");if(t(),n[e]==='"')return r();if(n[e]==="{"){e++;let d=Object.create(null),f=new Set;if(t(),n[e]==="}")return e++,d;for(;;){if(t(),n[e]!=='"')throw new Error("INVALID_WORDING");let v=r();if(f.has(v)||["__proto__","constructor","prototype"].includes(v))throw new Error("INVALID_WORDING");if(f.add(v),t(),n[e++]!==":")throw new Error("INVALID_WORDING");d[v]=a(o+1),t();let g=n[e++];if(g==="}")return d;if(g!==",")throw new Error("INVALID_WORDING")}}let c=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(n.slice(e));if(!c)throw new Error("INVALID_WORDING");return e+=c[0].length,JSON.parse(c[0])}let i=a(0);if(t(),e!==n.length||!i||typeof i!="object"||Object.keys(i).sort().join(",")!=="entries,schemaVersion"||i.schemaVersion!==1||!i.entries||typeof i.entries!="object"||Array.isArray(i.entries))throw new Error("INVALID_WORDING");for(let[o,c]of Object.entries(i.entries))if(!o.length||[...o].length>160||typeof c!="string"||[...c].length>1e3)throw new Error("INVALID_WORDING");return i}function Zt(n,e){return Object.prototype.hasOwnProperty.call(e,n)?e[n]:n}var ce=p,Qt=()=>{},u=(n,e=document)=>e.querySelector(n),l=n=>String(n).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),Te=!0;function pe(n,e){try{let t=localStorage.getItem("mb-docs-"+n);return t?JSON.parse(t):e}catch{return Te=!1,e}}var T=pe("settings",{language:"en",theme:"light",size:100,motion:!1}),U=pe("progress",[]),le={};try{let n=localStorage.getItem("mb-docs-wording");n&&(le=xt(n).entries)}catch{le={}}function j(n,e){try{localStorage.setItem("mb-docs-"+n,JSON.stringify(e))}catch{Te=!1,H(s("Storage unavailable. Changes last for this session only.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u8B8A\u66F4\u53EA\u4FDD\u7559\u81F3\u672C\u6B21\u700F\u89BD\u7D50\u675F\u3002"))}}function s(n,e=n){let t=T.language==="zh"?e:T.language==="both"&&n!==e?n+" \xB7 "+e:n;return Zt(t,le)}function H(n){u("#notice").textContent=n}var ke=[{id:"super-profiles",title:["Launch a disposable workspace","\u555F\u52D5\u5373\u68C4\u5DE5\u4F5C\u5340"],article:"Super-Profiles.md",steps:[["Configure a template","\u8A2D\u5B9A\u7BC4\u672C","Unlock the vault and open Super Profiles. Choose the environment and review its actual capabilities. Saving a template does not launch it.","\u89E3\u9396\u4FDD\u7BA1\u5EAB\u4E26\u958B\u555F Super Profiles\u3002\u9078\u64C7\u74B0\u5883\u4E26\u6AA2\u67E5\u5BE6\u969B\u80FD\u529B\u3002\u5132\u5B58\u7BC4\u672C\u4E0D\u6703\u555F\u52D5\u74B0\u5883\u3002"],["Launch with explicit consent","\u660E\u78BA\u540C\u610F\u5F8C\u555F\u52D5","Review standard identity and credential portability limits. Wait for actual guest readiness rather than assuming a launch request succeeded.","\u95B1\u8B80\u6A19\u6E96\u8EAB\u5206\u53CA\u6191\u8B49\u53EF\u651C\u9650\u5236\u3002\u7B49\u5019\u5BE6\u969B\u5C31\u7DD2\u7D50\u679C\uFF0C\u4E0D\u8981\u5047\u8A2D\u555F\u52D5\u8981\u6C42\u5DF2\u6210\u529F\u3002"],["Save back or discard","\u5132\u5B58\u8B8A\u66F4\u6216\u6368\u68C4","Save only after the managed browser stops. Keep prior revisions. Closing a Sandbox window directly may lose unexported changes.","\u53D7\u7BA1\u7406\u700F\u89BD\u5668\u505C\u6B62\u5F8C\u624D\u5132\u5B58\uFF0C\u4FDD\u7559\u820A\u7248\u672C\u3002\u76F4\u63A5\u95DC\u9589 Sandbox \u8996\u7A97\u53EF\u80FD\u907A\u5931\u672A\u532F\u51FA\u7684\u8B8A\u66F4\u3002"]]},{id:"vault",title:["Create a vault","\u5EFA\u7ACB\u4FDD\u7BA1\u5EAB"],article:"Vault-and-computers.md",steps:[["Choose a dedicated directory","\u9078\u64C7\u5C08\u7528\u8CC7\u6599\u593E","Use the application\u2019s native folder picker. Keep your ordinary browser data separate.","\u4F7F\u7528\u61C9\u7528\u7A0B\u5F0F\u7684\u8CC7\u6599\u593E\u9078\u64C7\u5668\uFF0C\u8207\u65E5\u5E38\u700F\u89BD\u5668\u8CC7\u6599\u5206\u958B\u3002"],["Create and unlock","\u5EFA\u7ACB\u4E26\u89E3\u9396","Enter a strong password in the protected application field. Wait for the actual successful result. Never enter it here.","\u5728\u61C9\u7528\u7A0B\u5F0F\u7684\u53D7\u4FDD\u8B77\u6B04\u4F4D\u8F38\u5165\u5BC6\u78BC\uFF0C\u7B49\u5019\u771F\u6B63\u6210\u529F\u7D50\u679C\u3002\u5207\u52FF\u5728\u6B64\u8F38\u5165\u3002"],["Create your first profile","\u5EFA\u7ACB\u7B2C\u4E00\u500B\u8A2D\u5B9A\u6A94","Choose a supported engine and keep automation off unless needed. A capability report decides what is available.","\u9078\u64C7\u652F\u63F4\u7684\u5F15\u64CE\u3002\u9664\u975E\u6709\u9700\u8981\uFF0C\u5426\u5247\u95DC\u9589\u81EA\u52D5\u5316\u3002\u4EE5\u80FD\u529B\u5831\u544A\u70BA\u6E96\u3002"]]},{id:"join",title:["Join another computer","\u52A0\u5165\u53E6\u4E00\u90E8\u96FB\u8166"],article:"Vault-and-computers.md",steps:[["Keep the original safe","\u4FDD\u7559\u539F\u6709\u8CC7\u6599","Preserve an independent encrypted backup before joining another device.","\u52A0\u5165\u53E6\u4E00\u88DD\u7F6E\u4E4B\u524D\uFF0C\u4FDD\u7559\u7368\u7ACB\u52A0\u5BC6\u5099\u4EFD\u3002"],["Pull encrypted data","\u4E0B\u8F09\u52A0\u5BC6\u8CC7\u6599","Configure the supported synchronization folder and pull through the application. Do not copy a live browser directory.","\u8A2D\u5B9A\u652F\u63F4\u7684\u540C\u6B65\u8CC7\u6599\u593E\uFF0C\u900F\u904E\u61C9\u7528\u7A0B\u5F0F\u4E0B\u8F09\u3002\u4E0D\u8981\u8907\u88FD\u57F7\u884C\u4E2D\u7684\u700F\u89BD\u5668\u8CC7\u6599\u593E\u3002"],["Verify destination capabilities","\u78BA\u8A8D\u76EE\u7684\u5730\u80FD\u529B","Unlock on the destination and check engine support. Cross-machine restoration remains unverified without evidence for that exact combination.","\u5728\u76EE\u7684\u5730\u89E3\u9396\u4E26\u6AA2\u67E5\u5F15\u64CE\u652F\u63F4\u3002\u8DE8\u96FB\u8166\u9084\u539F\u9700\u8981\u8A72\u7D44\u5408\u7684\u5BE6\u969B\u9A57\u8B49\u3002"]]},{id:"automation",title:["Understand automation","\u4E86\u89E3\u81EA\u52D5\u5316"],article:"Automation.md",steps:[["Start with off","\u5148\u4FDD\u6301\u95DC\u9589","Automation is opt-in per profile. Off requests no driver or debugging listener.","\u6BCF\u500B\u8A2D\u5B9A\u6A94\u5747\u9808\u4E3B\u52D5\u958B\u555F\u81EA\u52D5\u5316\u3002\u95DC\u9589\u6642\u4E0D\u8981\u6C42\u9A45\u52D5\u7A0B\u5F0F\u6216\u5075\u932F\u63A5\u807D\u3002"],["Choose a supported mode","\u9078\u64C7\u652F\u63F4\u6A21\u5F0F","Selenium or Puppeteer requires explicit engine support. A saved preference alone does not create an endpoint.","Selenium \u6216 Puppeteer \u9808\u6709\u5F15\u64CE\u652F\u63F4\u3002\u5132\u5B58\u504F\u597D\u4E0D\u4EE3\u8868\u7AEF\u9EDE\u5DF2\u5EFA\u7ACB\u3002"],["Restart when required","\u9700\u8981\u6642\u91CD\u65B0\u555F\u52D5","A running profile retains its effective mode until stopped and relaunched. Try the local example below.","\u57F7\u884C\u4E2D\u7684\u8A2D\u5B9A\u6A94\u6703\u4FDD\u7559\u76EE\u524D\u6A21\u5F0F\uFF0C\u505C\u6B62\u4E26\u91CD\u65B0\u555F\u52D5\u5F8C\u624D\u5957\u7528\u3002\u8A66\u7528\u4E0B\u65B9\u672C\u6A5F\u793A\u7BC4\u3002"]]},{id:"snapshot",title:["Snapshot and restore","\u5FEB\u7167\u8207\u9084\u539F"],article:"Snapshots-and-conflicts.md",steps:[["Reach a safe state","\u9032\u5165\u5B89\u5168\u72C0\u614B","Stop the browser unless the engine proves support for the restricted live snapshot protocol.","\u9664\u975E\u5F15\u64CE\u5DF2\u8B49\u5BE6\u652F\u63F4\u53D7\u9650\u5373\u6642\u5FEB\u7167\u5354\u5B9A\uFF0C\u5426\u5247\u5148\u505C\u6B62\u700F\u89BD\u5668\u3002"],["Preserve the revision","\u4FDD\u7559\u7248\u672C","Create a snapshot and inspect its returned revision identity. Keep the current revision before restore.","\u5EFA\u7ACB\u5FEB\u7167\u4E26\u6AA2\u67E5\u56DE\u50B3\u7684\u7248\u672C\u8B58\u5225\u3002\u9084\u539F\u524D\u5148\u4FDD\u7559\u76EE\u524D\u7248\u672C\u3002"],["Restore deliberately","\u614E\u91CD\u9084\u539F","Select the exact revision. Require a real success result and inspect the profile before discarding any backup.","\u9078\u64C7\u78BA\u5207\u7248\u672C\u3002\u78BA\u8A8D\u5BE6\u969B\u6210\u529F\u7D50\u679C\u4E26\u6AA2\u67E5\u8A2D\u5B9A\u6A94\uFF0C\u518D\u6C7A\u5B9A\u662F\u5426\u522A\u9664\u5099\u4EFD\u3002"]]},{id:"conflict",title:["Resolve a conflict","\u8655\u7406\u885D\u7A81"],article:"Snapshots-and-conflicts.md",steps:[["Preserve both branches","\u4FDD\u7559\u5169\u500B\u5206\u652F","Concurrent revisions are both valuable. Never overwrite one based only on its timestamp.","\u540C\u6642\u7522\u751F\u7684\u7248\u672C\u90FD\u6709\u50F9\u503C\u3002\u5207\u52FF\u53EA\u6191\u6642\u9593\u8986\u5BEB\u5176\u4E2D\u4E00\u500B\u3002"],["Compare the revisions","\u6BD4\u8F03\u7248\u672C","Read revision identities and parent relationships. Do not merge browser databases.","\u95B1\u8B80\u7248\u672C\u8B58\u5225\u53CA\u7236\u7248\u672C\u95DC\u4FC2\u3002\u4E0D\u8981\u5408\u4F75\u700F\u89BD\u5668\u8CC7\u6599\u5EAB\u3002"],["Choose explicitly","\u660E\u78BA\u9078\u64C7","Use the application\u2019s resolution workflow. Keep the other revision where supported.","\u4F7F\u7528\u61C9\u7528\u7A0B\u5F0F\u7684\u89E3\u6C7A\u6D41\u7A0B\uFF0C\u4E26\u5728\u652F\u63F4\u6642\u4FDD\u7559\u53E6\u4E00\u7248\u672C\u3002"]]},{id:"hosting",title:["Explore optional storage","\u63A2\u7D22\u9078\u7528\u5132\u5B58\u670D\u52D9"],article:"Storage.md",steps:[["Review the boundary","\u4E86\u89E3\u754C\u7DDA","Storage receives ciphertext, never the vault password or decrypted profile data.","\u5132\u5B58\u670D\u52D9\u53EA\u63A5\u6536\u5BC6\u6587\uFF0C\u4E0D\u61C9\u63A5\u6536\u4FDD\u7BA1\u5EAB\u5BC6\u78BC\u6216\u89E3\u5BC6\u8CC7\u6599\u3002"],["Configure the intended host","\u8A2D\u5B9A\u6307\u5B9A\u4E3B\u6A5F","Review ports, storage and authenticated administration. A configuration file is not deployment proof.","\u6AA2\u67E5\u9023\u63A5\u57E0\u3001\u5132\u5B58\u53CA\u9A57\u8B49\u7BA1\u7406\u3002\u8A2D\u5B9A\u6A94\u4E26\u975E\u90E8\u7F72\u8B49\u660E\u3002"],["Verify actual health","\u9A57\u8B49\u5BE6\u969B\u5065\u5EB7\u72C0\u614B","Verify the real service and intended LAN URL. This documentation cannot start or verify it for you.","\u9A57\u8B49\u5BE6\u969B\u670D\u52D9\u53CA\u6307\u5B9A\u5340\u57DF\u7DB2\u7D61\u7DB2\u5740\u3002\u672C\u6587\u4EF6\u7121\u6CD5\u4EE3\u4F60\u555F\u52D5\u6216\u9A57\u8B49\u3002"]]}];function R(n,e,t=!1){return`<md-${t?"outlined":"filled"}-button id="${e}">${l(n)}</md-${t?"outlined":"filled"}-button>`}function Be(){document.documentElement.dataset.theme=T.theme,document.documentElement.lang=T.language==="zh"?"yue-Hant":"en",document.documentElement.style.fontSize=T.size+"%",document.documentElement.dataset.motion=T.motion?"reduce":"normal"}function qn(){Be(),u("#app").innerHTML=`<header><a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">M</span><span>Material Browser<small>${l(s("FIELD GUIDE","\u5BE6\u7528\u624B\u518A"))}</small></span></a>${R(s("Navigation","\u5C0E\u89BD"),"navigation",!0)}</header><div class="layout"><nav id="nav" aria-label="${l(s("Documentation","\u6587\u4EF6"))}">${[["home","Overview","\u7E3D\u89BD"],["guide/vault","Guided tasks","\u4EFB\u52D9\u6307\u5357"],["reference","All articles","\u5168\u90E8\u6587\u7AE0"],["settings","Reading settings","\u95B1\u8B80\u8A2D\u5B9A"]].map(([n,e,t])=>`<a href="#/${n}" ${location.hash==="#/"+n?'aria-current="page"':""}>${l(s(e,t))}</a>`).join("")}<div class="rail-note">${l(s("Your progress stays on this device. Examples never operate the installed application.","\u9032\u5EA6\u53EA\u4FDD\u7559\u65BC\u6B64\u88DD\u7F6E\u3002\u793A\u7BC4\u4E0D\u6703\u64CD\u4F5C\u5DF2\u5B89\u88DD\u61C9\u7528\u7A0B\u5F0F\u3002"))}</div><a href="https://github.com/Ding-Ding-Projects/material-browser">${l(s("Source repository","\u539F\u59CB\u78BC\u5132\u5B58\u5EAB"))} \u2197</a></nav><main id="main" tabindex="-1"></main></div><footer>Material Browser \xB7 v${l(ce.version)} \xB7 ${l(s("Documentation build","\u6587\u4EF6\u5EFA\u7F6E"))} ${l(ce.updatedAt)} \xB7 <code>${ce.source.slice(0,12)}</code></footer>`,u("#navigation").onclick=()=>{let n=u("#nav");n.classList.toggle("open"),u("#navigation").setAttribute("aria-expanded",String(n.classList.contains("open")))}}function Tt(){let n=U.length;u("#main").innerHTML=`<section class="hero"><p class="eyebrow">${l(s("A practical handbook","\u5BE6\u7528\u6307\u5357"))}</p><h1>${l(s("Your profiles. Your next step.","\u4F60\u7684\u8A2D\u5B9A\u6A94\uFF0C\u4F60\u7684\u4E0B\u4E00\u6B65\u3002"))}</h1><p class="lead">${l(s("Learn how to set up an encrypted workspace, understand browser capabilities and keep every revision recoverable.","\u5B78\u7FD2\u5EFA\u7ACB\u52A0\u5BC6\u5DE5\u4F5C\u5340\u3001\u4E86\u89E3\u700F\u89BD\u5668\u80FD\u529B\uFF0C\u4E26\u4FDD\u7559\u53EF\u9084\u539F\u7248\u672C\u3002"))}</p><a class="primary-link" href="#/guide/vault">${l(s("Start guided setup","\u958B\u59CB\u5F15\u5C0E\u8A2D\u5B9A"))} \u2192</a></section><section class="progress-panel"><div><h2>${l(s("Pick up where you left off","\u7E7C\u7E8C\u4E0A\u6B21\u9032\u5EA6"))}</h2><p>${n} / ${ke.length*3} ${l(s("reading steps confirmed","\u500B\u95B1\u8B80\u6B65\u9A5F\u5DF2\u78BA\u8A8D"))}</p></div><progress max="${ke.length*3}" value="${n}" aria-label="${l(s("Reading progress","\u95B1\u8B80\u9032\u5EA6"))}"></progress>${R(s("Reset reading progress","\u91CD\u8A2D\u95B1\u8B80\u9032\u5EA6"),"reset-progress",!0)}</section><section><h2>${l(s("What do you want to do?","\u4F60\u60F3\u505A\u751A\u9EBC\uFF1F"))}</h2><div class="task-grid">${ke.map((e,t)=>`<a class="task-card" href="#/guide/${e.id}"><span class="task-number">0${t+1}</span><h3>${l(s(...e.title))}</h3><p>${l(s(e.steps[0][2],e.steps[0][3]))}</p><span aria-hidden="true">\u2192</span></a>`).join("")}</div></section><aside class="notice"><strong>${l(s("Know what is verified","\u4E86\u89E3\u9A57\u8B49\u7BC4\u570D"))}</strong><p>${l(s("These walkthroughs explain the workflow. Native launch, engine automation, live snapshots, cross-machine restoration and deployed storage require their own runtime evidence. Always read the actual capability and operation result.","\u9019\u4E9B\u6307\u5357\u89E3\u91CB\u6D41\u7A0B\u3002\u539F\u751F\u555F\u52D5\u3001\u81EA\u52D5\u5316\u3001\u5373\u6642\u5FEB\u7167\u3001\u8DE8\u6A5F\u9084\u539F\u53CA\u5132\u5B58\u90E8\u7F72\u5747\u9808\u7368\u7ACB\u5BE6\u969B\u9A57\u8B49\u3002\u8ACB\u4EE5\u80FD\u529B\u53CA\u64CD\u4F5C\u7D50\u679C\u70BA\u6E96\u3002"))}</p><a href="#/article/wiki%2FHome.md">${l(s("Read the handbook","\u95B1\u8B80\u624B\u518A"))}</a></aside>`,u("#reset-progress").onclick=()=>{U=[],j("progress",U),Tt(),H(s("Reading progress reset.","\u5DF2\u91CD\u8A2D\u95B1\u8B80\u9032\u5EA6\u3002"))}}function zn(n){let e=ke.find(a=>a.id===n)||ke[0],t=Math.max(0,Math.min(2,Number(pe("step-"+e.id,0))||0));function r(){let a=e.steps[t];u("#main").innerHTML=`<p class="eyebrow">${l(s("Guided task","\u4EFB\u52D9\u6307\u5357"))} \xB7 ${t+1} / 3</p><h1>${l(s(...e.title))}</h1><p class="note">${l(s("Documentation only. No vault, browser or service operation runs here.","\u50C5\u4F9B\u6587\u4EF6\u8AAA\u660E\uFF0C\u6B64\u8655\u4E0D\u6703\u57F7\u884C\u4FDD\u7BA1\u5EAB\u3001\u700F\u89BD\u5668\u6216\u670D\u52D9\u64CD\u4F5C\u3002"))}</p><div class="steps" aria-label="${l(s("Steps","\u6B65\u9A5F"))}">${e.steps.map((i,o)=>`<button class="step ${o===t?"active":""}" data-step="${o}" aria-current="${o===t?"step":"false"}">${o+1}. ${l(s(i[0],i[1]))}</button>`).join("")}</div><section class="lesson"><h2>${l(s(a[0],a[1]))}</h2><p class="lead">${l(s(a[2],a[3]))}</p><label class="check"><md-checkbox id="confirm" aria-label="${l(s("I have reviewed this step","\u6211\u5DF2\u95B1\u8B80\u9019\u4E00\u6B65"))}" ${U.includes(e.id+t)?"checked":""}></md-checkbox>${l(s("I have reviewed this step","\u6211\u5DF2\u95B1\u8B80\u9019\u4E00\u6B65"))}</label><div class="actions">${R(s("Back","\u4E0A\u4E00\u6B65"),"back",!0)}${R(t===2?s("Finish reading","\u5B8C\u6210\u95B1\u8B80"):s("Next","\u4E0B\u4E00\u6B65"),"next")}</div></section><section id="example"></section><p><a href="#/article/${encodeURIComponent("wiki/"+e.article)}">${l(s("Read the complete article","\u95B1\u8B80\u5B8C\u6574\u6587\u7AE0"))} \u2192</a></p>`,document.querySelectorAll("[data-step]").forEach(i=>i.onclick=()=>{t=Number(i.dataset.step),j("step-"+e.id,t),r()}),u("#confirm").onchange=i=>{let o=e.id+t;U=U.filter(c=>c!==o),i.target.checked&&U.push(o),j("progress",U),H(s("Reading progress saved.","\u5DF2\u5132\u5B58\u95B1\u8B80\u9032\u5EA6\u3002"))},u("#back").disabled=t===0,u("#back").onclick=()=>{t--,j("step-"+e.id,t),r()},u("#next").onclick=()=>{t<2?(t++,j("step-"+e.id,t),r()):location.hash="#/home"},n==="automation"&&Fn(),n==="conflict"&&Mn()}r()}function Fn(){let n=pe("example",{requested:"off",effective:"off",running:!0}),e=u("#example");function t(){e.innerHTML=`<h2>${l(s("Try the automation example","\u8A66\u7528\u81EA\u52D5\u5316\u793A\u7BC4"))}</h2><p>${l(s("Simulation only. Change the requested mode, then simulate a restart to see the boundary.","\u7D14\u7CB9\u793A\u7BC4\u3002\u66F4\u6539\u8981\u6C42\u6A21\u5F0F\uFF0C\u518D\u6A21\u64EC\u91CD\u65B0\u555F\u52D5\u4EE5\u4E86\u89E3\u754C\u7DDA\u3002"))}</p><div class="actions">${["off","selenium","puppeteer"].map(r=>R(r,"mode-"+r,n.requested!==r)).join("")}</div><div class="diagram"><div><small>${l(s("Requested","\u8981\u6C42"))}</small><strong>${n.requested}</strong></div><span aria-hidden="true">\u2192</span><div><small>${l(s("Effective","\u751F\u6548"))}</small><strong>${n.effective}</strong></div></div><p role="status">${l(n.requested!==n.effective?s("Pending restart in this example.","\u6B64\u793A\u7BC4\u4E2D\u6B63\u7B49\u5019\u91CD\u65B0\u555F\u52D5\u3002"):s("Requested and effective modes agree in this example.","\u6B64\u793A\u7BC4\u7684\u8981\u6C42\u8207\u751F\u6548\u6A21\u5F0F\u76F8\u540C\u3002"))}</p>${R(s("Simulate restart","\u6A21\u64EC\u91CD\u65B0\u555F\u52D5"),"simulate",!0)}`;for(let r of["off","selenium","puppeteer"])u("#mode-"+r).onclick=()=>{n.requested=r,j("example",n),t()};u("#simulate").onclick=()=>{n.effective=n.requested,j("example",n),t()}}t()}function Mn(){let n=pe("conflict-choice","both"),e=u("#example");function t(){e.innerHTML=`<h2>${l(s("Explore a revision fork","\u63A2\u7D22\u7248\u672C\u5206\u652F"))}</h2><div class="diagram"><div><small>${l(s("Shared parent","\u5171\u540C\u7236\u7248\u672C"))}</small><strong>R1</strong></div><span aria-hidden="true">\u2192</span><div><strong>A \xB7 R2</strong><strong>B \xB7 R3</strong></div></div><p>${l(s("Select a revision to inspect the explanation. Both remain preserved in this demonstration.","\u9078\u64C7\u7248\u672C\u67E5\u770B\u89E3\u91CB\u3002\u6B64\u793A\u7BC4\u6703\u4FDD\u7559\u5169\u500B\u7248\u672C\u3002"))}</p><div class="actions">${R(s("Inspect A","\u67E5\u770B A"),"inspect-a",!0)}${R(s("Inspect B","\u67E5\u770B B"),"inspect-b",!0)}</div><p role="status">${l(n==="both"?s("Two children of R1: compare before choosing.","R1 \u7684\u5169\u500B\u5B50\u7248\u672C\uFF1A\u5148\u6BD4\u8F03\uFF0C\u518D\u9078\u64C7\u3002"):s("Inspecting "+n+". The other revision remains available; timestamps do not decide the winner.","\u6B63\u5728\u67E5\u770B "+n+"\u3002\u53E6\u4E00\u7248\u672C\u4ECD\u4FDD\u7559\uFF0C\u6642\u9593\u4E26\u4E0D\u6C7A\u5B9A\u52DD\u8CA0\u3002"))}</p>`;for(let r of["a","b"])u("#inspect-"+r).onclick=()=>{n=r.toUpperCase(),j("conflict-choice",n),t()}}t()}function en(n,e,t){n.innerHTML=`<label>${l(s("Search this collection","\u641C\u5C0B\u6B64\u96C6\u5408"))}<input type="search" id="query" maxlength="512"></label><div class="actions">${R(s("Clear search","\u6E05\u9664\u641C\u5C0B"),"clear",!0)}${R(s("Regex builder","\u6B63\u898F\u8868\u793A\u5F0F\u5DE5\u5177"),"builder",!0)}</div><section class="regex" hidden><label><input type="checkbox" id="regex-mode">${l(s("Use regex","\u4F7F\u7528\u6B63\u898F\u8868\u793A\u5F0F"))}</label><label>${l(s("Flags (i m s u)","\u65D7\u6A19 (i m s u)"))}<input id="flags" value="i" maxlength="4"></label>${R(s("Clear flags","\u6E05\u9664\u65D7\u6A19"),"clear-flags",!0)}<div class="actions">${[["literal","Escape literal"],["start","Start anchor"],["end","End anchor"],["group","Capture group"],["any","Any characters"]].map(([C,A])=>R(A,"insert-"+C,!0)).join("")}</div><p>${l(s("ECMAScript regex. Isolated worker, 200 ms limit. Atomic groups, conditionals, subroutines and engine tracing are unsupported. Results show matched article indices and captures.","ECMAScript \u6B63\u898F\u8868\u793A\u5F0F\u3002\u7368\u7ACB\u5DE5\u4F5C\u7A0B\u5E8F\uFF0C\u9650\u6642 200 \u6BEB\u79D2\u3002\u4E0D\u652F\u63F4\u539F\u5B50\u7FA4\u7D44\u3001\u689D\u4EF6\u5F0F\u3001\u5B50\u7A0B\u5E8F\u53CA\u5F15\u64CE\u8FFD\u8E64\u3002\u7D50\u679C\u986F\u793A\u6587\u7AE0\u7D22\u5F15\u53CA\u64F7\u53D6\u3002"))}</p><pre id="captures"></pre></section><p id="search-status" role="status"></p>`;let r,a,i=0;Qt=()=>{i++,r&&r.terminate(),clearTimeout(a)};let o=u("#query",n),c=u("#regex-mode",n),d=u("#flags",n);function f(){let C=++i;if(r&&r.terminate(),clearTimeout(a),!c.checked){t(e.filter(A=>A.text.toLowerCase().includes(o.value.toLowerCase()))),u("#search-status",n).textContent="";return}r=new Worker("./regex.worker.js"),a=setTimeout(()=>{r.terminate(),u("#search-status",n).textContent=s("Pattern exceeded the time limit. Shorten it.","\u6A21\u5F0F\u8D85\u904E\u9650\u6642\uFF0C\u8ACB\u7E2E\u77ED\u3002"),t([])},200),r.onmessage=({data:A})=>{C===i&&(clearTimeout(a),r.terminate(),u("#search-status",n).textContent=A.error||"",u("#captures",n).textContent=A.captures?JSON.stringify(A.captures,null,2):"",t(A.indices?A.indices.map(tn=>e[tn]):[]))},r.postMessage({pattern:o.value,flags:d.value,items:e.map(A=>A.text)})}let v="search-"+n.id,g=pe(v,{query:"",mode:!1,flags:"i"});o.value=typeof g.query=="string"?g.query:"",c.checked=g.mode===!0,d.value=typeof g.flags=="string"?g.flags:"i";let S=()=>{j(v,{query:o.value,mode:c.checked,flags:d.value}),f()};o.oninput=S,c.onchange=S,d.oninput=S,u("#clear-flags",n).onclick=()=>{d.value="",S(),d.focus()},u("#clear",n).onclick=()=>{o.value="",S(),o.focus()},u("#builder",n).onclick=()=>{u(".regex",n).hidden=!u(".regex",n).hidden};for(let C of["literal","start","end","group","any"])u("#insert-"+C,n).onclick=()=>{o.value={literal:()=>o.value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),start:()=>"^"+o.value,end:()=>o.value+"$",group:()=>"("+o.value+")",any:()=>o.value+".*"}[C](),c.checked=!0,S()};f()}function Bn(){u("#main").innerHTML=`<p class="eyebrow">${l(s("Complete reference","\u5B8C\u6574\u53C3\u8003"))}</p><h1>${l(s("Every article, in one place","\u6240\u6709\u6587\u7AE0\uFF0C\u96C6\u4E2D\u95B1\u8B80"))}</h1><p>${ce.articles.length} ${l(s("complete source articles bundled locally. Source language is retained.","\u7BC7\u5B8C\u6574\u539F\u6587\u5DF2\u5305\u542B\u65BC\u672C\u6A5F\uFF0C\u4FDD\u7559\u539F\u6587\u8A9E\u8A00\u3002"))}</p><div id="search"></div><div id="results" class="article-list"></div>`,en(u("#search"),ce.articles,n=>{u("#results").innerHTML=n.length?n.map(e=>`<a href="#/article/${encodeURIComponent(e.id)}"><strong>${l(e.title)}</strong><small>${l(e.id)}</small></a>`).join(""):`<p>${l(s("No matching articles.","\u6C92\u6709\u7B26\u5408\u7684\u6587\u7AE0\u3002"))}</p>`})}function Un(n,e){let t=ce.articles.find(r=>r.id===n);if(!t){u("#main").innerHTML=`<h1>${l(s("Article unavailable","\u6587\u7AE0\u4E0D\u53EF\u7528"))}</h1><a href="#/reference">${l(s("Open all articles","\u958B\u555F\u5168\u90E8\u6587\u7AE0"))}</a>`;return}u("#main").innerHTML=`<p class="eyebrow">${l(s("Complete article \xB7 original language","\u5B8C\u6574\u6587\u7AE0 \xB7 \u539F\u6587\u8A9E\u8A00"))}</p><article>${t.html}</article><p><a href="https://github.com/Ding-Ding-Projects/material-browser/blob/main/${t.id.split("/").map(encodeURIComponent).join("/")}">${l(s("View source","\u67E5\u770B\u4F86\u6E90"))} \u2197</a></p>`,e&&setTimeout(()=>document.getElementById(e)?.scrollIntoView(),0)}function Hn(){u("#main").innerHTML=`<h1>${l(s("Reading settings","\u95B1\u8B80\u8A2D\u5B9A"))}</h1><p>${l(s("Changes apply only to this documentation on this device.","\u8A2D\u5B9A\u53EA\u5957\u7528\u81F3\u6B64\u88DD\u7F6E\u4E0A\u7684\u6587\u4EF6\u3002"))}</p><div id="settings-search"></div><div id="settings-fields"></div>`;let n=[{id:"language",title:s("Language","\u8A9E\u8A00"),text:"Language English Cantonese bilingual \u8A9E\u8A00",html:`<div class="actions">${[["en","English"],["zh","\u5EE3\u6771\u8A71"],["both","English \xB7 \u5EE3\u6771\u8A71"]].map(([t,r])=>R(r,"lang-"+t,T.language!==t)).join("")}</div><p>${l(s("Navigation and walkthroughs are translated. Source articles retain their original language. Default: English.","\u5C0E\u89BD\u53CA\u6307\u5357\u63D0\u4F9B\u7FFB\u8B6F\u3002\u6587\u7AE0\u4FDD\u7559\u539F\u6587\u3002\u9810\u8A2D\uFF1A\u82F1\u8A9E\u3002"))}</p>`},{id:"theme",title:s("Appearance","\u5916\u89C0"),text:"Appearance theme light dark font size motion \u5916\u89C0",html:`<label class="check"><md-switch id="dark" aria-label="${l(s("Dark theme","\u6DF1\u8272\u4E3B\u984C"))}" ${T.theme==="dark"?"selected":""}></md-switch>${l(s("Dark theme","\u6DF1\u8272\u4E3B\u984C"))}</label><label>${l(s("Text size","\u6587\u5B57\u5927\u5C0F"))}<input type="range" id="size" min="80" max="150" step="10" value="${T.size}"></label><label class="check"><md-switch id="motion" aria-label="${l(s("Reduce motion","\u6E1B\u5C11\u52D5\u614B\u6548\u679C"))}" ${T.motion?"selected":""}></md-switch>${l(s("Reduce motion","\u6E1B\u5C11\u52D5\u614B\u6548\u679C"))}</label><p>${l(s("Defaults: light theme, 100% text, operating-system motion preference.","\u9810\u8A2D\uFF1A\u6DFA\u8272\u4E3B\u984C\u3001100% \u6587\u5B57\u5927\u5C0F\u3001\u8DDF\u96A8\u4F5C\u696D\u7CFB\u7D71\u52D5\u614B\u504F\u597D\u3002"))}</p>`},{id:"wording",title:s("Personal wording","\u500B\u4EBA\u7528\u8A9E"),text:"Personal wording upload replace clear local JSON \u500B\u4EBA\u7528\u8A9E",html:`<label>${l(s("Upload or replace local JSON","\u4E0A\u8F09\u6216\u66F4\u63DB\u672C\u6A5F JSON"))}<input type="file" id="wording-file" accept=".json,application/json"></label><p id="wording-state">${l(Object.keys(le).length?s("Local wording loaded.","\u5DF2\u8F09\u5165\u672C\u6A5F\u7528\u8A9E\u3002"):s("No local wording loaded.","\u5C1A\u672A\u8F09\u5165\u672C\u6A5F\u7528\u8A9E\u3002"))}</p>${R(s("Clear personal wording","\u6E05\u9664\u500B\u4EBA\u7528\u8A9E"),"wording-clear",!0)}<p>${l(s("Validated locally, maximum 256 KiB. Never uploaded, logged or exported. Default: original wording.","\u53EA\u5728\u672C\u6A5F\u9A57\u8B49\uFF0C\u4E0A\u9650 256 KiB\u3002\u4E0D\u6703\u4E0A\u50B3\u3001\u8A18\u9304\u6216\u532F\u51FA\u3002\u9810\u8A2D\uFF1A\u539F\u6709\u7528\u8A9E\u3002"))}</p>`}];function e(t){u("#settings-fields").innerHTML=t.map(r=>`<section class="setting"><h2>${l(r.title)}</h2>${r.html}</section>`).join("");for(let r of["en","zh","both"])u("#lang-"+r)&&(u("#lang-"+r).onclick=()=>{T.language=r,j("settings",T),xe()});u("#dark")&&(u("#dark").onchange=r=>{T.theme=r.target.selected?"dark":"light",j("settings",T),Be()}),u("#size")&&(u("#size").oninput=r=>{T.size=Number(r.target.value),j("settings",T),Be()}),u("#motion")&&(u("#motion").onchange=r=>{T.motion=r.target.selected,j("settings",T),Be()}),u("#wording-file")&&(u("#wording-file").onchange=async r=>{let a=r.target.files?.[0];if(a)try{if(a.size>262144)throw Error();let i=await a.text(),o=xt(i);try{localStorage.setItem("mb-docs-wording",i)}catch{Te=!1}le=o.entries,xe(),H(s(Te?"Local wording applied.":"Storage unavailable. Wording applies for this session only.","\u5DF2\u5957\u7528\u672C\u6A5F\u7528\u8A9E\u3002"))}catch{H(s("Invalid wording file. Nothing changed.","\u7528\u8A9E\u6A94\u6848\u7121\u6548\uFF0C\u672A\u6709\u8B8A\u66F4\u3002"))}finally{r.target.value=""}}),u("#wording-clear")&&(u("#wording-clear").onclick=()=>{try{localStorage.removeItem("mb-docs-wording")}catch{H(s("Storage unavailable. Clear could not be persisted.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u7121\u6CD5\u4FDD\u5B58\u6E05\u9664\u7D50\u679C\u3002"));return}le={},xe(),H(s("Original wording restored.","\u5DF2\u6062\u5FA9\u539F\u6709\u7528\u8A9E\u3002"))})}en(u("#settings-search"),n,e)}function xe(){Qt(),qn();let n=location.hash.slice(2)||"home",[e,...t]=n.split("/");if(e==="home")Tt();else if(e==="guide")zn(t[0]);else if(e==="reference")Bn();else if(e==="settings")Hn();else if(e==="article"){let[r,a]=t.join("/").split("?"),i;try{i=decodeURIComponent(r)}catch{i=""}Un(i,new URLSearchParams(a).get("anchor"))}else Tt();u("#main").focus({preventScroll:!0}),Te||H(s("Storage unavailable. Changes last for this session only.","\u5132\u5B58\u4E0D\u53EF\u7528\uFF0C\u8B8A\u66F4\u53EA\u4FDD\u7559\u81F3\u672C\u6B21\u700F\u89BD\u7D50\u675F\u3002"))}window.addEventListener("hashchange",xe);xe();})();
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
