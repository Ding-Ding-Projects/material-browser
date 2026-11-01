# November 2026 defect verification

The owner assigned incoming design and feature implementation to the design contributor.
This pass owns integration, independent defect and layout checks, focused repairs and
actionable issue handoffs. It does not certify every required feature.

## Source and executed checks

Source `b086d867b5a5441784c92395c8dacae14e319bca` passed all 334 desktop tests, with no
failures or skips, and the exact root `build.bat -Component Desktop` entrypoint. Earlier
Rust workspace evidence contains 103 passing tests and remains bound to its original run.
The documentation build at `f0dcd29` assembled 60 complete articles. None of these results
establish an installer, a new release, an installed update or whole-product acceptance.

## Repairs with independent runtime evidence

| Finding | Evidence | Limit |
| --- | --- | --- |
| Cached server runtime integrity, issue 7 | Official 1.21.4 bytes and identity were verified; corruption started zero new JVMs and made zero downloads; an explicit retry downloaded the verified runtime once and completed a report-only JVM | No server or EULA operation |
| ZIP temporary path and placement, issue 8 | Exclusive temporary output, verification before placement, non-overwriting final destination, independent Python ZIP CRC/inventory/content checks including a Unicode filename | Report copies, not a generated world's completeness |
| Cold appearance, persistence feedback, contrast and hue, issues 11 through 14 | Four inspected images from exact source `47e8ae1`, validated provenance and negative receipt checks | Four bounded runtime cases, not full accessibility/layout acceptance |
| Owned report-process shutdown, issue 6 | Real pending catalogue request, identified direct-child JVM, normal Close and absence of the process tree/listener/hidden desktop | Report-only IPC integration; real generation cancellation remains open |

The shutdown request occurred at `2026-11-01T09:49:25.332Z`; absence was observed at
`2026-11-01T09:49:45.4847913Z`. The 20.152-second value is an observation upper bound,
not exact exit latency. No forced termination was used. Source and built inputs remained
unchanged throughout. Build-receipt SHA-256:
`82b01aa12ee01d01fc627ae440173390375c0063a7e61ae69212bc1c42489608`.

See [the four public repair images](../../evidence/desktop/repair-20261101/README.md).
Historical README presentation remains archived with its original source and provenance.

## Open design and behavioral handoffs

- [Issue 5](https://github.com/Ding-Ding-Projects/material-browser/issues/5): navigation rail bounds in bilingual mode.
- [Issue 6](https://github.com/Ding-Ding-Projects/material-browser/issues/6): real generation cancellation/quit acceptance after the implemented lifecycle repair.
- [Issue 9](https://github.com/Ding-Ding-Projects/material-browser/issues/9): real custom-dimension generation after the valid-height probe repair.
- [Issue 10](https://github.com/Ding-Ding-Projects/material-browser/issues/10): Personalize minimum-width layout.
- [Issue 15](https://github.com/Ding-Ding-Projects/material-browser/issues/15): the live handbook's bilingual reset control extends beyond a 320-pixel viewport.
- [Issue 16](https://github.com/Ding-Ding-Projects/material-browser/issues/16): the preset picker silently omits a discovered preset.
- [Issue 17](https://github.com/Ding-Ding-Projects/material-browser/issues/17): readiness capability is not admitted from the selected version's actual command report.
- [Issue 18](https://github.com/Ding-Ding-Projects/material-browser/issues/18): completion accepts four corners for an area and accepts diagnostic marker echoes.

Issues 17 and 18 have exact-source and official-reference evidence. Fake-process simulations
prove missing completion evidence and false-positive parsing under those injected conditions.
They do not prove that a real world contains missing chunks or that a particular older server
emits the synthetic diagnostic. Repair and real runtime verdicts remain separate.

## Remaining delivery boundaries

No real server EULA has been accepted during this pass. Full server lifecycle across four
targets, Bedrock, complete version/flavour/plugin/player workflows, real generation, broad
keyboard/language/theme/scale acceptance, companion delivery and all 420 unfinished inventory
rows remain incomplete. No new release or installed update was performed. Preserve active
implementation branches and evidence; do not replace another contributor's in-progress work.
