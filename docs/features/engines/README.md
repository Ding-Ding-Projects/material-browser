# Browser engine integration

The Rust engine crate manages only explicitly registered, hash-pinned engine bundles. It never
searches for or imports an installed personal browser. The native host chooses the bundle and
manifest, and passes the persisted profile automation preference into `LaunchRequest`.

## Current delivery

- SHA-256 verification before registration and again immediately before process launch.
- Canonical bundle containment, strict UUID profile paths, application-owned profile root and
  exclusive supervisor lifetime lock. Browser-native profile locks remain necessary after a host crash.
- Chromium and Firefox Off-mode launch arguments contain no driver, debugging port, debugging
  pipe or automation flag. No extension or injected script is used to pretend native identity support.
- Process status reports the actual child PID, effective mode and pinned engine version.
- Windows stop posts WM_CLOSE only to windows with the owned child PID, then waits at most
  30 seconds. A close prompt, hung process or unavailable window returns an explicit error and
  retains ownership. It does not force-kill. Other platforms report graceful stop unavailable.

## Deliberate unavailable capabilities

Portable encryption, stable identity and consistent live snapshots are
unavailable. A manifest setting any of these true is rejected. A version label or upstream
compatibility table alone cannot enable them. Opt-in automation implementation is described below; there are no bundled engines or driver binaries.
Engine installation must supply trusted native-host configuration, not untrusted renderer paths.
The manifest hashes the executable, not every resource in its bundle. Full bundle integrity and
protection against executable replacement between verification and spawn remain pending.

The restricted snapshot message schema has request/profile/executable binding and all required
barrier acknowledgements. It has no evaluation, arbitrary filesystem or debugging command.
Schema validation alone does not establish authenticated transport or real quiescence. The
launcher therefore never copies a live directory and always rejects live snapshot requests.
Missing implementation: inherited authenticated pipe, child peer verification, browser-wide
network/renderer/service-worker/storage barriers, database flush hooks, rollback and recovery,
concurrent mutation tests and cross-engine runtime evidence.

## Pinned source research

Chromium `134.0.6998.35` source interfaces were acquired directly from
[Chromium source](https://chromium.googlesource.com/chromium/src/+/refs/tags/134.0.6998.35/).
This historical revision is a source prototype pin, not a recommendation to run an old browser.
See `engines/recipes/chromium-provider.json` for exact paths and SHA-256 values.
`KeyProvider` accepts asynchronous key delivery, encryption eligibility and sync-compatibility
reporting. `BrowserProcessImpl` assembles providers before constructing `OSCryptAsync`.
No portable-key provider is integrated or compiled here. A production provider must accept only
new application-owned profiles, receive key material through protected native IPC, prevent
legacy provider fallback, and prove restored new-profile data across supported machines.
It must never import existing browser credentials or alter operating-system protections.

[Mozilla's driver table](https://firefox-source-docs.mozilla.org/testing/geckodriver/Support.html)
provides compatibility constraints, not a verified adapter. Exact Firefox, geckodriver, Selenium,
Puppeteer and Chromium pins plus runtime handshakes remain required before enabling automation.

## Opt-in automation adapters

`EngineRegistry::register_adapter(kind, mode, AdapterRuntime)` accepts a trusted native-host
runtime configuration. The configuration pins Node and helper SHA-256, exact browser version,
and, for Selenium, the driver's SHA-256 and exact reported driver version. Install adapter
packages with `npm ci --ignore-scripts --prefix engines/adapters`; the lockfile pins package
integrity. It does not download browsers or drivers, and never invokes Selenium Manager.

The bundled helper pins `selenium-webdriver` 4.51.0 and `puppeteer-core` 25.14.0. Selenium uses
explicit ChromeDriver or geckodriver service builders and the application profile path.
Puppeteer uses Chromium CDP through an inherited pipe, or Firefox WebDriver BiDi. The helper
checks the exact browser version and a positive native PID before returning a launch receipt.
Version mismatch fails initialization and requests browser close. Configuration and shutdown
travel over inherited stdin. No arbitrary user script, navigation or page evaluation command
is exposed by this helper. Automation is enabled only by the persisted requested mode.

`EngineRegistry::list()` reports configured adapters separately from runtime verification.
A configured adapter is not runtime proof. A successful `ProcessStatus` effective mode follows
the helper's exact browser receipt. No browser/driver version combination was launched in this
session; the adapters remain runtime-unverified. Native-host trusted installation configuration
must supply a compatible exact browser and driver pair. Chromium driver compatibility and
Firefox BiDi compatibility still need real browser acceptance tests.

Graceful adapter shutdown calls Puppeteer close or WebDriver quit. A timeout retains process
ownership instead of claiming it stopped. Initialization failure closes the helper input first
and then terminates the owned process job if it cannot settle. Each helper enters a private
Windows job before receiving launch configuration; Off-mode browsers start suspended and enter
that job before being resumed. Loss of the supervisor terminates its owned process family.
Registered manifests cannot enable custom encryption, identity or
snapshot features. Their automation booleans are informational and do not configure adapters.

## Source patch prototype

`engines/recipes/chromium-new-profile-provider.patch` adds a concrete `KeyProvider` implementation
against the acquired pinned interface. It accepts an in-memory `Encryptor::Key` only through
a new application-owned-profile factory, provides the `mb1` tag, declines sync compatibility
and returns no key on reuse. Patch application was checked. It is not wired into GN or
`BrowserProcessImpl`, not compiled, and not enabled. An inherited protected key channel,
fail-closed startup without legacy-provider fallback, key lifecycle review and cross-machine
new-profile runtime evidence remain absent. The boolean factory input itself is not proof
of ownership; the future native host must establish it. No snapshot implementation patch is
claimed: a message schema cannot freeze browser subsystems.

## Durable lifetime and mutation leases

Before a native process can start, the supervisor durably writes a launch-intent journal outside
the browser profile. After launch it records the verified PID, native 100 ns creation timestamp,
canonical executable and exact profile argument. Interrupted, malformed and unreadable journals
fail closed. Recreated supervisors inspect the current process identity and independently scan
profile arguments; PID reuse never grants permission to control another process.

`Supervisor::acquire_profile_idle(id)` returns a `ProfileLease` held through snapshot, restore or
removal. Its lock is outside the profile directory, so replacing the directory does not replace
the lock. `assert_profile_inactive` is an observation only and cannot replace that lease.
Ambiguous launch intents require explicit recovery; the supervisor never silently deletes them.
Native identity and job containment currently support Windows only. Job containment is a safety
boundary, not a claim that forced host termination preserves the browser's last unwritten data.

`automation_endpoint(id)` returns a validated literal IPv4 loopback endpoint only for a running
opt-in profile. Chromium Puppeteer uses CDP, Firefox Puppeteer uses BiDi, and Selenium returns
the pinned driver's WebDriver URL plus the established session ID. Off returns
`AUTOMATION_DISABLED`. Paired forwarding must constrain WebDriver access to that exact session;
a raw driver endpoint alone allows a client to create unrelated sessions and is not profile
authorization. Native snapshot IPC remains separate and unavailable until engine-side barriers
are implemented.

Focused verification includes torn launch intent, exact profile argument matching, loopback and
mode rejection, independent-supervisor lease exclusion, a real hidden process surviving a
supervisor recreation, PID-reuse rejection, and native job-close termination. These fixtures are
process-control evidence, not browser encryption, identity or snapshot acceptance.

## Current native source acquisition

`engines/recipes/native-pins.json` records Chromium 155.0.8059.85 at
`0e66b94549a8bd85f03fbdf189b752d6e7b63c32` and Firefox 158.0 at
`3c71aeacdb296402e41fb2084b13e797d1770642`. The root entrypoint accepts
`build.bat -Component BrowserNative -NativeEngine chromium -AcquireOnly` (or `firefox`).
It acquires exact upstream revisions into a short, user-scoped native source cache outside
the repository, preserves changes, and verifies the revision. Chromium dependency acquisition
uses a pinned depot-tools revision and the installed Visual Studio toolchain. Source acquisition
does not register a runtime or enable advanced capabilities. Product build and acceptance remain
incomplete until native encryption, identity and whole-profile snapshot integration are real.

