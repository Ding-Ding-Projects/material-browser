# Roadmap

Current preservation state: component source and focused checks exist, but the complete
product remains unfinished. Core 12, host 14, desktop 5, documentation 6 and storage 6 focused
checks were reported at their recorded candidates. A fresh native run verifies Off-mode
graceful stop and stopped-profile snapshot in both engines, plus Chromium Selenium locally
and over the paired LAN path. Firefox Selenium shutdown and Chromium Puppeteer remain failing.
The Off-mode repair is integrated; native-engine production work remains on the recovery branch;
no end-to-end completion, release, deployment or two-computer acceptance is claimed.

## Foundation
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

