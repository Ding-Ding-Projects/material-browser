# Material Browser

An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.

Super Profiles add encrypted reusable guest templates, revision history and explicit
browser/workspace save-back. Native WSL2 and Windows Sandbox source is under acceptance;
template storage and successful compilation do not prove every guest experience works.
See [the workflow and current limits](docs/features/desktop/super-profiles.md).

**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.

- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)
- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)

## Bundled engines and launch behavior

The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.

Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the combined packaged native host at source `04e003fb37fcdc5fecb8ef45806aaae74a69b603`. All four automation clients completed real title roundtrips. The native host exited successfully. After an initial ancestry rejection resolved, a fresh full ownership proof permitted normal wrapper exit; its recorded processes were proven absent and the exact hidden desktop closed. [Runtime summary and limits](docs/evidence/desktop/bundled-runtime-04e003f.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.

Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.

## Current desktop screenshots

These original version 0.1.1 images show the combined packaged desktop at source `04e003fb37fcdc5fecb8ef45806aaae74a69b603`. The exact local desktop installer entrypoint completed with exit 0. Images were taken through an isolated hidden desktop, inspected for private data and promoted without changing their bytes. Viewports are 1920 by 1500 at logical scale 1, in English and dark theme.

![Persisted dark theme and compact density after restart](docs/evidence/desktop/persisted-preferences-04e003f.png)

![Protected history unlocked after restart with independent access](docs/evidence/desktop/protected-history-04e003f.png)

![Persisted workspace display name and recorded settings change](docs/evidence/desktop/display-name-history-04e003f.png)

The visible controls saved dark theme, compact density and a synthetic workspace name. A stale native preference write was rejected. Protected history recorded the settings change, reopened locked after a real process restart and retained its records after unlocking. Both GUI launches saved six complete process identities before closing; all were proven absent and both exact hidden desktops closed.

These observations do not prove physical display-scale coverage, native keyboard behavior, complete localization, history restore/export/recovery or installation/update. Earlier onboarding, consent and bilingual images keep their original provenance in the archive.

[Current evidence inventory](docs/evidence/desktop/inventory.json) · [Source/hash summary](docs/evidence/desktop/receipts-04e003f.json) · [Earlier presentation archive](docs/evidence/archive.md)

## Documentation and remaining work

The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.

The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.
