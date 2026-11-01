# Minimum-layout repair evidence

These two original Windows desktop screenshots were captured from source
`5c6662455bd968edfe4a4ebcad30b1e902d03b20`, after the navigation-rail and Personalize
horizontal-layout repairs. The earlier four repair images remain in
[their original evidence article](../repair-20261101/README.md), bound to source `47e8ae1`.
They have not been relabelled or replaced by this pair.

The exact `build.bat -Component Desktop` run completed successfully. Its renderer SHA-256 is
`81a0cda8592aa01635ea22b460b8ea897e16acfb281cdc53afc9a92f5c35f096`.
The [inventory](inventory.json) records the exact state, image hashes and capture intervals.
Both supported promotion receipts passed before the evidence commit, while the target checkout
was at the captured source. The [validation summary](validation.json) records those results.
A missing-ID negative check was rejected; restoring the exact original inventory bytes passed.

## Focus and navigation

![Minimum bilingual Focus view with Settings reachable and Lock focused](minimum-bilingual-focus.png)

At 760 × 580, bilingual light mode and an expanded rail, renderer Tab events reached Settings
and then Lock. Settings was inside the independently scrolling destination area; Lock remained
inside the rail and viewport. Both controls exposed a visible focus outline.

The actual capture interval was **2026-11-01 10:34:11.068–10:34:11.111 UTC**.

## Scrolled Appearance controls

![Minimum bilingual Appearance controls inside their owning pane](minimum-bilingual-appearance.png)

The Appearance pane was scrolled into view through its real scroll container. Its upper
controls remained within the measured horizontal bounds. Lower controls remain below the fold,
so this image does not claim that every control is visible at once.

The actual capture interval was **2026-11-01 10:34:11.123–10:34:11.162 UTC**.

## Route and limits

Both images used the same isolated application session on a named off-screen desktop launched
through the installed direct CLI. CDP provided page-only screenshots and renderer keyboard
events, starting from an explicitly focused rail menu. The native window owner, exact page
target, stable source and build inputs were observed. The owned process tree closed normally
and was verified absent.

The requested CDP scale was 1; the observed device-pixel ratio was `1.0000000298023224`.
This is page-emulation evidence, not a physical display-scaling or physical keyboard test.
Each PNG is 760 × 580 and is byte-identical to its inspected original. No pixels were cropped,
annotated, resized or recompressed. Private machine paths, process identities and detailed
interaction receipts remain outside tracked documentation.

The surrounding matrix measured 96 size, scale, language, theme and rail combinations, but
this article promotes only these two inspected representative images. It does not claim full
visual parity, complete accessibility, installer acceptance or release delivery.
