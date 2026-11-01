# Material Browser

An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.

Super Profiles add encrypted reusable guest templates, revision history and explicit
browser/workspace save-back. Native WSL2 and Windows Sandbox source is under acceptance;
template storage and successful compilation do not prove every guest experience works.
See [the workflow and current limits](docs/features/desktop/super-profiles.md).

**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.

- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)
- [Reviewed interface screenshot gallery](https://ding-ding-projects.github.io/material-browser-evidence/) with its original per-image hashes and capture provenance
- [Architecture](docs/architecture.md)
- [Required-feature acceptance and remaining gaps](docs/features/acceptance/README.md)
- [Server management implementation and verification limits](docs/features/servers/README.md)
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)

## Desktop workflow

```mermaid
flowchart TD
    A[Open the desktop] --> B[Create or unlock the encrypted vault]
    B --> C[Select a profile or reusable template]
    C --> D[Choose an action and review any required consent]
    D --> E[Native host checks capabilities and operation ownership]
    E --> F{Action available and authorized?}
    F -- No --> G[Show the reason and available recovery]
    F -- Yes --> H[Run the operation and preserve its result]
    H --> I[Show feedback and an optional action sound]
    G --> C
    I --> C
```

## Bundled engines and launch behavior

The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.

Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the combined packaged native host at source `04e003fb37fcdc5fecb8ef45806aaae74a69b603`. All four automation clients completed real title roundtrips. The native host exited successfully. After an initial ancestry rejection resolved, a fresh full ownership proof permitted normal wrapper exit; its recorded processes were proven absent and the exact hidden desktop closed. [Runtime summary and limits](docs/evidence/desktop/bundled-runtime-04e003f.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.

Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.

## Desktop design

The desktop interface follows the eight Material 3 Expressive artboards in [the design folder](design/IMPLEMENTATION_HANDOFF.md): a custom title bar with search, a 96 dp navigation rail, rounded panes, segmented lists, connected button groups and the two-key confirmation. The vendored `design/m3.css` anatomy drives the renderer directly, with colour roles bridged to the saved theme, accent and contrast choices.

Short completion and failure tones are configurable in **Settings → Notifications**, with a persisted switch, volume and preview. Quiet hours and accessibility settings take precedence. [Sound behavior](docs/features/desktop/action-sounds.md).

## Verified repair screenshots

These genuine Windows desktop images are bound to source `47e8ae104755d38e9d115fbb08636143bc6278cb`.
They show four bounded repair checks, not complete feature, layout, accessibility or installer acceptance.
[Evidence and limitations](docs/evidence/desktop/repair-20261101/README.md).
[Earlier screenshots and original provenance](docs/evidence/desktop/m3-redesign/readme-image-archive.md).

### Saved appearance at cold startup

The saved red primary-button appearance is applied before the vault is unlocked.

![Saved appearance restored before vault unlock](docs/evidence/desktop/repair-20261101/issue-11.png)

### Truthful storage feedback

This is an explicitly injected, fixture-only storage failure. Session-only warnings and retry controls remain visible.

![Injected storage failure with session-only warnings and retry controls](docs/evidence/desktop/repair-20261101/issue-12.png)

### Unresolved rendered contrast

The real focus-mode opacity state reports contrast as unavailable rather than inventing a passing value.

![Dimmed pane with contrast explicitly unavailable](docs/evidence/desktop/repair-20261101/issue-13.png)

### Hue accessibility boundary

The pointer endpoint remains within the declared hue range. This does not claim physical keyboard or screen-reader acceptance.

![Hue pointer endpoint with the handle at the right edge](docs/evidence/desktop/repair-20261101/issue-14.png)

## Measured minimum-layout repairs

These later captures are bound to source `5c6662455bd968edfe4a4ebcad30b1e902d03b20`.
The four repair images above retain their original `47e8ae1` source and independent scope.
The two images below show bilingual light mode at 760 × 580 with an expanded navigation rail
and requested CDP scale 1. They provide bounded layout and renderer-keyboard evidence, not
physical display-scale or full accessibility certification.
[Exact inventory, capture times and verification limits](docs/evidence/desktop/layout-20261101/README.md).

![Minimum bilingual Focus view with Settings reachable and Lock focused](docs/evidence/desktop/layout-20261101/minimum-bilingual-focus.png)

Renderer Tab navigation reached Settings and then Lock, with visible focus. The destination
list scrolls independently while Lock remains visible.

![Minimum bilingual Appearance controls inside their owning pane](docs/evidence/desktop/layout-20261101/minimum-bilingual-appearance.png)

The upper Appearance controls are shown after vertical scrolling. Lower controls remain below
the fold; the measured horizontal containment does not claim complete visual parity.

## Documentation and remaining work

The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.

The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.
