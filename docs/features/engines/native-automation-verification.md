# Native automation verification

## Candidate and method

The 2026-10-18 verification used source `7031adb`, the native host built through
`build.bat -Component Host`, and the exact normal adapter helper. The executable SHA-256 was
`4478b78b84d1ccf3554b2df92657e0359c07683783e4f33d6130835437f98906` and the helper SHA-256 was
`4ba93ccd80d74add40abf168e00d80a6f0461da247fa2d45eb11b98e2dc60833`.

The real Chromium 155.0.8059.84 and Firefox 158.0 bundles ran with synthetic, application-owned
profiles on named hidden Windows desktops through the direct Lowlevel launcher. Local and
paired encrypted LAN calls exercised actual browser processes. Private receipts retain launch
and process ancestry observations, source and file hashes, results, and desktop absence checks.
Diagnostic helper variants with browser output forwarding were excluded from acceptance.

## Verified behavior

| Combination | Result |
| --- | --- |
| Chromium local Off, Selenium, Puppeteer | Passed launch, stop and snapshot for each mode |
| Firefox local Off, Selenium, Puppeteer | Passed launch, stop and snapshot for each mode |
| Chromium paired LAN Off, Selenium, Puppeteer | Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips |
| Firefox paired LAN Off, Selenium, Puppeteer | Passed launch, stop and snapshot, WebDriver title and Puppeteer title roundtrips |
| Firefox with an attached external BiDi client | Stop reported incomplete; native ownership, snapshot exclusion and vault-lock exclusion remained active; disconnect and retry completed stop and vault locking |
| Firefox closed by an external BiDi client before host stop | Host stop settled the remaining helper, reported no active profiles and permitted vault locking |

New profiles defaulted to Off. Off rejected automation endpoint access. Changing a running
profile's preference to Off immediately rejected endpoint access. Snapshots in this fixture
occurred after verified stop and are not consistent live snapshots. The two local hosts exited
normally. LAN fixtures explicitly terminated their owned server during finalization; their
server exit code is not graceful server-shutdown proof.

The four normal matrix fixture launchers exited successfully. Exact hidden-desktop not-found
responses independently proved absence after each run. The targeted Firefox fixtures also
exited successfully; they do not turn an intentionally incomplete attached-client stop into a
successful stop. Their final host teardown is separate from the explicitly checked transitions.

## Ownership correction

Earlier fixture results that checked only the launch-root or adapter exit are superseded for
graceful-shutdown interpretation. Firefox can exit its launcher while another process in the
same private job owns the browser window. Dropping a kill-on-close job at that point could
terminate surviving browsers. Historical receipt states remain preserved; they are not current
graceful-stop evidence.

The corrected Off close path pins each candidate process handle and verifies exact private job
membership, native liveness, creation ordering, the pinned executable and the current window
owner before posting WM_CLOSE. Stop and reap retain the profile until the native identity is
gone and the complete private job reports zero active members. Native exit timestamps and
eventual job accounting distinguish exited objects from live processes. Observing missing
ancestry alone never authorizes release or termination.

Firefox's single-session BiDi launch client disconnects before exposing its endpoint. A failed
shutdown reconnect keeps the helper alive. After a successful protocol close reply, the helper
still waits for the supervisor's private settlement command. That command requires the exact
browser identity to be gone, the exact retained helper child to remain live, and the complete
job list to contain only that helper. The proof is rechecked within the original stop deadline
because client close can finish after stop begins. This prevents a helper exit hook from
forcing browser closure before native completion.

The paired WebSocket forwarder buffers a bounded upgrade request for the exact owned route,
rejects duplicate Host headers and oversized requests, translates Host to the authenticated
browser endpoint authority, then preserves subsequent frame bytes. Firefox otherwise rejects
the local forwarder's different port with HTTP 400. Paired RPC reads allow 40 seconds for the
native 30-second shutdown result.

## Focused checks and limitations

The candidate passed 16 host tests, 16 engine tests and two adapter option tests. Native tests
cover a helper exiting while its browser survives, retained profile locking, native exit while
the exact child handle stays open, a contained child after its launcher handle is dropped, and
rejection of foreign job members, incorrect executables and invalid creation ordering. Adapter tests
exercise the actual launch options, including an explicit ephemeral loopback debugging port.

The normal matrix disconnects its external Puppeteer client before stop. The separate attached
client case verifies an explicit incomplete stop and retained exclusions, followed by a successful
retry. Neither proves every possible prompt or hung browser, or other engine and driver versions.
The targeted attached-client case does not snapshot after retry; an earlier diagnostic reached a
separate profile-size limit, which remains outside this lifecycle result. No result enables portable
encryption, stable identity, authenticated native snapshot
barriers, cross-machine restoration or live snapshot consistency. Browser resource integrity
beyond the executable pin and native source compilation remain separate acceptance work.
