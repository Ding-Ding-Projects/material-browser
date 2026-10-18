# Roadmap

Current preservation state: component source and focused checks exist, but the complete
product remains unfinished. Core 12, host 14, desktop 5, documentation 6 and storage 6 focused
checks were reported at their recorded candidates. Earlier browser stop results are superseded
by stronger owned-job checks: Firefox's launcher can exit while its browser survives.
Graceful shutdown and safe snapshot timing require corrected native runtime proof.
The source repairs are partly integrated; further engine work remains on the recovery branches;
no end-to-end completion, release, deployment or two-computer acceptance is claimed.

## Foundation
- [ ] Complete applicable settings and preferences with real behavior, persistence and evidence
- [ ] Encrypted vault and isolated profile records
- [ ] Persistent per-profile automation preferences
- [ ] Desktop workspace connected to the Rust core
- [ ] CLI and versioned API

## Engine integration
- [ ] Portable Chromium credential provider, verified across two computers
- [ ] Consistent live snapshots in Chromium and Firefox without restarting
- [ ] Stable advanced profile identity in frame and worker contexts
- [ ] Selenium and Puppeteer, local and through authenticated LAN transport

## Storage and delivery
- [ ] Immutable encrypted revisions and conflict preservation
- [ ] Optional containerized storage and full administration dashboard
- [ ] Hosting entrypoints and portable setup wizard
- [ ] Required per-surface feature inventory and evidence
- [ ] Windows installer, public documentation, wiki and verified release

