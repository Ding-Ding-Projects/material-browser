# November 2026 defect verification

The design contributor owns incoming design and feature implementation. This pass owns
integration, independent defect/layout checks, focused repairs and actionable issue handoffs.
It does not certify every required feature.

## Current executed source

Runtime source `62563ae1626f966bd063ce0e38c53353de84ba22` passed the exact root
`build.bat -Component Desktop` entrypoint and all **361 desktop tests**, with no failures
or skips. Build-receipt SHA-256:
`a4e4fe0b2b76a0384d5982943df36a52493ecaaf0f774698c93c4df24d8a8907`.
Renderer SHA-256:
`e396adfbbc514edd48dc16a3c2dee8a83b7bf513bed991cf2eeec7ec23fbc820`.
Source and build inputs remained unchanged throughout verification.

Three [current original screenshots](../../evidence/desktop/current-20261101/README.md)
retain that source binding. Every promotion receipt passed, including rejection of a missing
inventory identity and successful exact-byte restoration. The earlier six-image README
presentation is archived beside them without changing historical image bytes or metadata.

## Verified repairs and limits

| Area | Executed evidence | Boundary |
| --- | --- | --- |
| Preset discovery | Actual 1.21.4 inventory retains six presets: five selectable, debug explicitly unavailable; renderer ArrowRight visits all five with visible focus | No EULA or generation |
| Version schema | Actual 26.3 retains seven unavailable presets and 1.19.3 retains six; both keep the renderer alive with zero interactive presets or EULA controls | Modern customization is unavailable, not implemented |
| Generator layout | All 12 tuples passed: 1280x802/760x580, English/Cantonese/bilingual, light/dark; every layout receipt validated | Page emulation at scale 1, not physical display scaling |
| Bundled fonts | 267 declarations, 303 references, 188 local font assets and six required identities passed source-byte checks; 13 CLI regressions passed | Static CSS checks do not prove all glyphs or arbitrary runtime styles |
| Font startup | Cached diagnostics and fully observed English/bilingual renderer reloads had zero font-policy blocks, uncaught exceptions or resource failures | Every native process-start event was not observed |
| Converter preservation | 24 focused checks cover duplicate/literal headers, special keys, exact-byte verification, replacement preservation and post-placement cleanup | Path checks and removal are not atomic against arbitrary external writers |
| Converter directory recovery | Actual native dialogs rejected a replaced destination, reselected safely and produced exact two-row CSV conversion; localized recovery passed | Integrity-failure GUI outcome remains unobserved despite service/component evidence |

Nineteen images were inspected in the current run. Normal Close was followed by observed
absence of the owned process tree at `2026-11-01T14:35:22.2004282Z` and absence of the named
hidden desktop. Isolated profiles remain retained. No forced termination, EULA acceptance,
world generation, installer, release or installed update occurred.

## Earlier source-bound evidence

- Source `5c6662455bd968edfe4a4ebcad30b1e902d03b20`: 348 desktop tests and exact build;
  rail/Personalize repairs passed 96 emulated tuples and 96 validated receipts. Twenty
  representative images were inspected and two unchanged originals were published.
- Source `47e8ae1`: four inspected Personalize cases cover cold appearance, persistence
  feedback, rendered contrast and hue bounds. Images retain their original provenance.
- Source `b086d867b5a5441784c92395c8dacae14e319bca`: 334 tests; corrupted official runtime
  bytes started zero JVMs/downloads, explicit retry recovered verified bytes, and ZIP placement
  passed independent CRC/inventory/content checks including Unicode.
- A real pending report-only JVM closed normally. Absence was observed within 20.152 seconds,
  an observation upper bound. Actual generation cancellation remains unproven.
- Handbook deployment `af1020fb6a486b5fb73e97fc818a3c1e1f01816c`, source `65eb448`:
  all 43 delivered files matched recorded bytes; six 320-pixel language/theme cases and a
  desktop case passed with actual renderer Tab/Enter reset. Issue 15 was closed. A newer
  publication must carry its own source and live verdict.
- Earlier Rust workspace evidence contains 103 passing tests, bound to its original run.

## Remaining acceptance

[Issue 6](https://github.com/Ding-Ding-Projects/material-browser/issues/6) retains actual
generation cancellation/quit acceptance, [issue 9](https://github.com/Ding-Ding-Projects/material-browser/issues/9)
retains custom-dimension generation, and [issue 18](https://github.com/Ding-Ding-Projects/material-browser/issues/18)
retains actual generated-area completeness. Their source repairs and simulated negative
checks do not prove a real generated world.
[Issue 20](https://github.com/Ding-Ding-Projects/material-browser/issues/20) retains direct
observation of the integrity-failure GUI result. The broader task remains in
[issue 1](https://github.com/Ding-Ding-Projects/material-browser/issues/1).

The inventory still has **112 identities, 784 rows and 420 applicable unfinished rows**.
Four-target lifecycle, Bedrock, complete version/flavour/plugin/player workflows, real
generation, broad keyboard/accessibility/physical-scale acceptance and companion delivery
remain incomplete. Preserve incoming contributor work and inactive alternatives.
