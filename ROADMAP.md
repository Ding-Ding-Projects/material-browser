# Roadmap

Current preservation state: component source and focused checks exist, but the complete
product remains unfinished. Integrated native lifecycle work passed the exact Host build,
45 Rust workspace tests and two adapter tests. Six real hidden-desktop runs covered local
and paired automation, contention and already-closed handling. Earlier launcher-only stop
results remain superseded. These results do not establish whole-profile live snapshots.
All five component branches are integrated into main; native engine source candidates remain inactive;
no end-to-end completion, release, deployment or two-computer acceptance is claimed.

## Super Profiles
- [x] Verify encrypted template CRUD, immutable revision history and chunked archive storage with 19 focused core tests
- [x] Compile the Super Profiles desktop through the root Desktop build entrypoint
- [x] Compile native guest orchestration through the root Windows Host build entrypoint
- [ ] Verify actual WSL terminal, browser and full desktop launch, save-back and discard
- [ ] Verify actual Windows Sandbox provisioning, guest save action and recovery
- [x] Verify background provisioning, durable phase events and cancellation with focused host checks
- [x] Verify background save finalization and bounded observation protocol with focused host checks
- [x] Verify headless Chromium and Firefox encrypted browser/workspace save and restoration
- [x] Verify default uncached pinned WSL base acquisition and owned teardown
- [x] Verify real GUI stopped workspace save and native WSL browser readiness, closure recovery and non-wake status through guest-local virtual X
- [ ] Verify terminal, graphical WSLg, desktop and Sandbox session health on the supported host
- [x] Verify pinned WSL Chromium and Firefox managed policy recognition, plus Firefox import removal with encrypted editable-bookmark restoration
- [x] Verify portable bookmark file input and encrypted setup-progress controls in the built wizard at source 50ddbbc (English/light/normal size; broader matrix remains pending)
- [ ] Complete guest installer recipes and native runtime acceptance for every supported engine
- [ ] Verify built interface accessibility, localization, layout and current screenshots
- [ ] Verify packaging, documentation publication and supported installed update

## Foundation
- [ ] Complete applicable settings and preferences with real behavior, persistence and evidence
  - [ ] Integrate the independently reviewed nine-repair Settings slice after current built proof
  - [ ] Complete the 109-row inventory, including all 65 desktop-applicable rows
  - [ ] Connect protected native history after safety and interruption recovery verification
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
- [x] Verify combined-source preference/history restart behavior with three inspected README images and complete GUI teardown
- [x] Preserve and integrate all five component branch tips into main with remote ancestry proof
- [ ] Verify backup archive and safely retire the five integrated component worktrees and branches
- [ ] Build and verify Squirrel shortcut maintenance and matching Windows shell identity (14 focused tests passed)
- [x] Verify hosted Windows build/release run and downloadable installer assets (run 39195138374)
  - [x] Configure branch-push/manual automation using the supported build entrypoints
- [x] Verify explicit standard-identity launch consent and localized capability explanations in the built desktop
- [ ] Verify the combined installer with both bundled engines, offline launch/stop and current README screenshots
- [ ] Immutable encrypted revisions and conflict preservation
- [ ] Optional containerized storage and full administration dashboard
- [ ] Hosting entrypoints and portable setup wizard
- [ ] Required per-surface feature inventory and evidence
- [ ] Windows installer, public documentation, wiki and verified release
  - [ ] Rebuild and verify the portable handbook against current integrated source
  - [ ] Publish the documentation website and verify its exact repository homepage
  - [ ] Deliver the dedicated portable build interface and verify real entrypoint actions


### Bundled runtime verification, source9011b28

- [x] Launch and normally stop Chromium and Firefox in Off, Selenium and Puppeteer modes
- [x] Verify consent Cancel focus in English, Cantonese and bilingual modes
- [x] Verify wrapped consent action bounds at the760x580 minimum logical viewport
- [ ] Verify the newer versioned installer and safe update of the existing active installation
- [x] Retain current inspected source-bound README screenshots and archived originals
- [ ] Verify the final hosted release and safe installed-update outcome
