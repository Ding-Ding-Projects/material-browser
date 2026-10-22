# Material Browser

An encrypted browser-profile workspace for Windows x64, with optional self-hosted storage.

Super Profiles add encrypted reusable guest templates, revision history and explicit
browser/workspace save-back. Native WSL2 and Windows Sandbox source is under acceptance;
template storage and successful compilation do not prove every guest experience works.
See [the workflow and current limits](docs/features/desktop/super-profiles.md).

**Development status:** unsigned development installers and the portable offline handbook are available through [normal automated releases](https://github.com/Ding-Ding-Projects/material-browser/releases). The product remains incomplete. Native installation/update acceptance, portable browser credentials, stable advanced identity, consistent live snapshots and two-computer restoration remain unverified or unsupported.

- [Interactive handbook and complete documentation](https://ding-ding-projects.github.io/material-browser/)
- [Reviewed interface screenshot gallery](https://ding-ding-projects.github.io/material-browser-evidence/) with per-image hashes and capture provenance
- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md) and [current handoff](HANDOFF.md)
- [Windows build and release automation](docs/features/delivery/windows-automation.md)
- [Browsers and automation runtimes bundled in the installer](docs/features/delivery/bundled-engines.md)

## Bundled engines and launch behavior

The installer includes complete Chromium 158.0.8111.0 (official development snapshot 1721569), Firefox 158.0, matching drivers, Node 26.4.0 and locked automation dependencies. These runtime files live outside the application archive, with pinned vendor archives, complete extracted inventories and retained licenses. Browser startup does not require a separate browser download.

Both bundled engines passed Off, Selenium and Puppeteer launch/normal-stop checks in the combined packaged native host at source `04e003fb37fcdc5fecb8ef45806aaae74a69b603`. All four automation clients completed real title roundtrips. The native host exited successfully. After an initial ancestry rejection resolved, a fresh full ownership proof permitted normal wrapper exit; its recorded processes were proven absent and the exact hidden desktop closed. [Runtime summary and limits](docs/evidence/desktop/bundled-runtime-04e003f.json). Standard-identity launch requires an explicit per-launch choice because advanced stable identity is unavailable; saved identity metadata is not enforced by these stock engines.

Builds enter through build.bat; installer production enters through build-installer.bat. Hosted builds run on every branch push and manual dispatch, use increasing package versions and publish normal development releases. Tests and lint run locally, not in the hosted workflow. Each release asset is transferred separately and checked against its published byte count and SHA-256.

## Current desktop screenshots

These eight original images show the rewritten local package at source `baa9512ecbc2727929547059f3b5d95f7cde989f`, package version 0.1.1. They were produced on an isolated hidden desktop with actual synthetic backend records, inspected for publication, and promoted without changing their bytes. Exact screen, viewport, theme, source and hash bindings are in the [current evidence inventory](docs/evidence/desktop/gui-rewrite/inventory.json). The same eight images are published in the [reviewed interface screenshot gallery](https://ding-ding-projects.github.io/material-browser-evidence/), where each live image hash was verified against this inventory.

![Profile table and selected profile overview with synthetic records](docs/evidence/desktop/gui-rewrite/profiles-workspace.png)

![Compact settings rows in the packaged desktop application](docs/evidence/desktop/gui-rewrite/settings-normal.png)

![Compact settings navigation at the minimum supported viewport](docs/evidence/desktop/gui-rewrite/settings-minimum.png)

![Super Profile template inventory with synthetic records](docs/evidence/desktop/gui-rewrite/super-profiles.png)

![Synchronization workspace before a shared folder is configured](docs/evidence/desktop/gui-rewrite/synchronization.png)

![Setup wizard with an existing unlocked synthetic vault](docs/evidence/desktop/gui-rewrite/setup.png)

![Explicit standard browser identity consent before profile launch](docs/evidence/desktop/gui-rewrite/launch-consent.png)

![Profile revision history after a real snapshot and restore](docs/evidence/desktop/gui-rewrite/revisions.png)

The representative matrix stopped at the owner-requested preservation boundary: 138 completed cells (48 at 100%, 48 at 125%, 42 at 150%). The 200% run and broader state inventory remain unfinished. Runtime-forced scales and CDP viewport overrides do not establish physical host display-scale or native keyboard proof. Ordinary Firefox launch/stop, bulk duplicate, failure retention, lock redaction and snapshot/restore were exercised separately from the pictures.

[Current evidence and limitations](docs/evidence/desktop/gui-rewrite/README.md) · [Coverage](docs/evidence/desktop/gui-rewrite/coverage.json) · [Historical image archive](docs/evidence/archive.md)

## Documentation and remaining work

The hosted handbook retains complete documentation/wiki articles and interactive task guides. Automated releases also include a single-file offline handbook. Earlier source-bound handbook interaction and restart observations remain in the archive; current-source companion runtime acceptance is not inferred from packaging success.

The encrypted core, native control transports, settings/history integration, storage service and hosting wizard have source implementations. Their broad required-feature inventories remain incomplete. See the roadmap and categorized documentation for exact limitations. The existing installed 0.1.0 desktop may remain active while a newer installer is prepared; it must reach a safe normal lifecycle boundary before an update is applied.
