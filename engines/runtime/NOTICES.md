# Bundled browser runtime notices

Material Browser distributes unmodified Windows x64 browser payloads separately from its
application code. Browser startup uses the locally installed payload, not a download service.

- Chromium 158.0.8111.0 is an official Chromium snapshot, revision 1721569, source
  `8b90bd52655dcdf5456cda56ae4d53b184c4dbd3`. It is a development snapshot, not a stable
  Chrome release or a product-patched browser. Its BSD-style notice accompanies this bundle
  in `licenses/chromium-LICENSE.txt`. The browser's offline `chrome://credits` page carries
  its component credits. Source: https://chromium.googlesource.com/chromium/src/+/8b90bd52655dcdf5456cda56ae4d53b184c4dbd3/
- Firefox 158.0 comes from Mozilla's unmodified official en-US Windows x64 release archive.
  Its offline `about:license` page carries its component licensing information. Release and
  source archives: https://archive.mozilla.org/pub/firefox/releases/158.0/
- ChromeDriver 158.0.8111.0 comes from the same official Chromium snapshot and retains
  `LICENSE.chromedriver` in its driver directory.
- geckodriver 0.37.1 retains its Mozilla Public License 2.0 notice in
  `licenses/geckodriver-LICENSE.txt`. Source: https://github.com/mozilla/geckodriver/tree/v0.37.1
- Node.js 26.4.0 retains `NODE-LICENSE.txt` in each automation directory. Installed npm
  dependencies retain their own notices alongside their unmodified locked package files.

Archive sources, byte counts, SHA-256 values and complete browser/driver/Node file inventories
are recorded in the source repository's `engines/runtime/browser-binaries.lock.json`.
Package integrity checks are not a signature, public-trust assertion or promise of advanced
browser capabilities. Stable identity, portable credential encryption and whole-profile live
snapshots remain unsupported by these standard browser distributions.
