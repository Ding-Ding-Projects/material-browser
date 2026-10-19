# Browser engines bundled in the installer

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
