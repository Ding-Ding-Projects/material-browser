# Material Browser

An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.

**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.

- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)
- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)

## Bundled engines and launch behavior

The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.

Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the packaged native host at source `5922074548f3a79f56b69c25b67826c0be3e209e`. All four automation clients also completed real title roundtrips. [Runtime summary](docs/evidence/desktop/bundled-runtime-0.1.1.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.

Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.

## Current desktop screenshots

These original images show the packaged version 0.1.1 desktop from source `5922074548f3a79f56b69c25b67826c0be3e209e`. They were taken on an isolated hidden desktop with a synthetic vault/profile, inspected, and promoted without changing their bytes. Viewports are 1280 by 1000 at emulated scale 1. This is not physical display-scale or complete accessibility proof.

![Initial encrypted vault setup in Material Browser 0.1.1](docs/evidence/desktop/onboarding-0.1.1.png)

![Explicit standard-identity launch consent in Material Browser 0.1.1](docs/evidence/desktop/launch-consent-0.1.1.png)

![Bilingual dark appearance settings in Material Browser 0.1.1](docs/evidence/desktop/settings-dark-bilingual-0.1.1.png)

The real interface created a vault/profile, skipped optional synchronization, opened and cancelled consent, launched/stopped bundled Chromium, and applied bilingual/dark preferences. Cancel returned focus to the opening control. Separate minimum-viewport observations kept consent actions inside 760 by 580 in Cantonese and bilingual modes. Complete workspace layout, physical scales, keyboard-only use, restart persistence, full localization and native installation/update remain separate acceptance gaps.

[Current evidence inventory](docs/evidence/desktop/inventory.json) · [Public source/hash summary](docs/evidence/desktop/receipts-0.1.1.json) · [Earlier desktop and handbook presentation archive](docs/evidence/archive.md)

## Documentation and remaining work

The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.

The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.
