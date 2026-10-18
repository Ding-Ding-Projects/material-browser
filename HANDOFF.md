# Implementation handoff

## Current state

The full approved design remains incomplete. Source foundations have been integrated, but
the combined tree has not completed release verification. Existing personal browser profiles
remain outside scope. The server never receives vault passwords or profile keys.

## Verified component evidence

- Core: 12 focused tests and component build, including transactional restore recovery,
  encrypted join and in-process domain-separated browser key derivation.
- Native host: 14 focused tests, component build and persistent CLI/HTTP/Noise fixtures.
- Desktop: component build, TypeScript and five focused tests; native desktop acceptance pending.
- Documentation: component build and six tests on its branch; rebuild the integrated inventory.
- Storage: six server tests. Portable wizard built and launched on an isolated hidden desktop;
  missing-runtime handling and preferences across a fresh process were observed.

The frozen native binary from a972859d2ea049f1246661e46788e6c912fae782 failed
Chromium local, Firefox local and Chromium LAN at profiles.stop:GRACEFUL_STOP_UNAVAILABLE.
Only new-profile-default-off was recorded complete. Automation title, snapshot and forwarding
checks were not reached. All owned verification processes/desktops were subsequently absent.
The replacement runtime at 4434a652f44724369345c4cea635c41e7c9f89c8 verified
Off launch, graceful stop and stopped-profile snapshot in Chromium and Firefox. Chromium
also passed local Selenium and the paired LAN Selenium title/stop/snapshot path. The complete
matrix remains failed: Firefox Selenium stop timed out, Chromium local Puppeteer returned
ADAPTER_START_FAILED, and Chromium LAN Puppeteer returned TUNNEL_CLOSED. The bounded Off-mode
shutdown repair is integrated in main as d369e75. Advanced native capabilities remain unverified.
The tested executable SHA-256 is fa09c58628d6172706a14c299a390e5230fe12661215db62946bda4a7a738819.

## Incomplete engine work

The engine recovery branch preserves source acquisition, current source pins, process ownership,
an uncompiled Chromium provider integration and the stop repair. Portable key delivery,
whole-profile native snapshot barriers and advanced identity remain unfinished. A blocked
optional Chromium updater test package prevented source synchronization. Existing protection
was not changed, and the same blocked payload must not simply be retried.

## Next steps

1. Revalidate retained producer handles and current branch state before changing inputs.
2. Repair adapter startup/shutdown and rerun the affected hidden fixtures after relevant changes.
3. Complete and compile native key-channel/provider, snapshot and identity integrations.
4. Rebuild the assembled desktop/docs/storage, run focused integration checks and genuine UI proof.
5. Verify restoration on a second physical Windows computer; access details are still needed.
6. Complete required-feature inventories, bootstrap, offline companion and storage transport integration.
7. Build/publish the container, verify LAN deployment, publish complete documentation/wiki,
   verify homepage and ship verified normal releases.

Five raw wizard images remain private and ineligible for publication because contemporaneous
build-timing receipts are missing. No public evidence gallery was created. No task-owned
worktree, branch or recovery reference was deleted. See CLOSEOUT_PROMPT.md for continuation.

