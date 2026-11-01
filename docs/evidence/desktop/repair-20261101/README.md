# Desktop repair evidence, 1 November 2026

These four unedited page captures come from the Windows desktop build at source `47e8ae104755d38e9d115fbb08636143bc6278cb`, produced by `build.bat -Component Desktop`. The renderer SHA-256 is `0bba7e09f291f4ca7952023ba8a7dd1b34212b7cc11fdd153fd4a007b7c46dbf`. The build completed at `2026-11-01T09:06:46.8017290+00:00`.

Each capture used a fresh named off-screen desktop and isolated application data. A live native window owner and exact CDP target were checked, the page viewport was explicitly set to 1280 × 1200, and the observed device-pixel ratio was `1.0000000298023224` (requested scale 1). This is page-only, emulated-viewport evidence, not a physical display-scale claim. Both owned process trees were closed normally and verified absent.

The [exact inventory](inventory.json) records capture times, hashes, source binding and limitations. Private machine paths, process identities and raw interaction receipts are intentionally retained outside tracked documentation.

## Issue 11

Saved red primary-button appearance restored before unlock. Cold-start visual and computed-colour proof only. The vault remains locked.

![Saved appearance restored before vault unlock](issue-11.png)

## Issue 12

Injected preference-storage write failure with session-only warnings and retry controls. Deliberately injected write/removal faults affect only two isolated preference keys. This is not a naturally occurring storage outage.

![Injected storage failure with session-only warnings and retry controls](issue-12.png)

## Issue 13

Actual focus-mode pane opacity 0.38 with contrast explicitly unavailable. One real opacity-dependent sample. No blanket gradient, alpha-compositing or accessibility certification.

![Dimmed pane with contrast explicitly unavailable](issue-13.png)

## Issue 14

Renderer pointer drag reached hue endpoint 359 within the advertised 0–359 range. CDP renderer pointer input and ARIA readback. No physical keyboard or native pointer-input claim.

![Hue pointer endpoint with the handle at the right edge](issue-14.png)

## Verification boundaries

All four supported promotion receipts passed against the captured source before commit. The [sanitized validation summary](validation.json) records the image hashes and scope. A deliberate negative inventory check renamed an exact record ID and was rejected; the original record then passed unchanged. The promoted images were reopened and inspected after byte-identical staging. Both this article and the inventory passed the public-content vocabulary scan.

The storage warning image deliberately shows an injected failure, while the interface and image are real. The storage methods were restored and the retry controls were exercised successfully. The contrast image shows one unsupported compositing state; it is not proof of every contrast calculation. The hue endpoint has separate pointer-event and ARIA evidence, and the image shows the handle at the right edge.

These images do not establish minimum-window layout, full keyboard accessibility, installer behavior, release delivery, or server/model operations. Existing narrow-layout findings remain separate. No image was cropped, annotated, resized or recompressed.
