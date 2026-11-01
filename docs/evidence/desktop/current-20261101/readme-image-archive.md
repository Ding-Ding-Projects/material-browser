# Earlier README image presentation

Archived on 2026-11-01 (UTC) from README at source `62563ae1626f966bd063ce0e38c53353de84ba22`, before the current-image update. This archive date is not a capture date. The original image bytes, inventories, validation records and earlier archives are retained unchanged. The two historical sets keep their original `47e8ae1` and `5c66624` source bindings.

## Verified repair screenshots

These genuine Windows desktop images are bound to source `47e8ae104755d38e9d115fbb08636143bc6278cb`.
They show four bounded repair checks, not complete feature, layout, accessibility or installer acceptance.
[Evidence and limitations](../repair-20261101/README.md).
[Earlier screenshots and original provenance](../m3-redesign/readme-image-archive.md).

### Saved appearance at cold startup

The saved red primary-button appearance is applied before the vault is unlocked.

![Saved appearance restored before vault unlock](../repair-20261101/issue-11.png)

### Truthful storage feedback

This is an explicitly injected, fixture-only storage failure. Session-only warnings and retry controls remain visible.

![Injected storage failure with session-only warnings and retry controls](../repair-20261101/issue-12.png)

### Unresolved rendered contrast

The real focus-mode opacity state reports contrast as unavailable rather than inventing a passing value.

![Dimmed pane with contrast explicitly unavailable](../repair-20261101/issue-13.png)

### Hue accessibility boundary

The pointer endpoint remains within the declared hue range. This does not claim physical keyboard or screen-reader acceptance.

![Hue pointer endpoint with the handle at the right edge](../repair-20261101/issue-14.png)

## Measured minimum-layout repairs

These later captures are bound to source `5c6662455bd968edfe4a4ebcad30b1e902d03b20`.
The four repair images above retain their original `47e8ae1` source and independent scope.
The two images below show bilingual light mode at 760 × 580 with an expanded navigation rail
and requested CDP scale 1. They provide bounded layout and renderer-keyboard evidence, not
physical display-scale or full accessibility certification.
[Exact inventory, capture times and verification limits](../layout-20261101/README.md).

![Minimum bilingual Focus view with Settings reachable and Lock focused](../layout-20261101/minimum-bilingual-focus.png)

Renderer Tab navigation reached Settings and then Lock, with visible focus. The destination
list scrolls independently while Lock remains visible.

![Minimum bilingual Appearance controls inside their owning pane](../layout-20261101/minimum-bilingual-appearance.png)

The upper Appearance controls are shown after vertical scrolling. Lower controls remain below
the fold; the measured horizontal containment does not claim complete visual parity.
