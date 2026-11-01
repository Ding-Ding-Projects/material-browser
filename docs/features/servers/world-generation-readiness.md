# World-generation readiness and completion evidence

## Complete preset discovery

The selected JAR's complete preset identity list is retained in `presets`. Each identity also
has a `presetOptions` record with `id`, `supported` and a nullable `reason`. The support flag
describes the current customization builder; top-level `supported` separately requires the
selected version's readiness capability and at least one implemented preset.

Unsupported entries, including `minecraft:debug_all_block_states` and unfamiliar future IDs,
remain in the inventory with an explicit reason. Validation rejects a discovered but
unimplemented preset with `WORLD_PRESET_UNSUPPORTED`; it never sends that generator through
the existing pack builder. Defaults select an implemented discovered ID, preferring normal.
An all-unsupported inventory has an explicit unavailable result.

Completeness regressions compare every supplied registry ID with the returned inventory and
capability records, including an unfamiliar synthetic preset. The supported-plus-unsupported
set must equal the full discovered set. This is discovery and truthful availability evidence,
not proof that an unsupported preset can generate a world.

## Version admission

The current customization writer also requires its legacy typed noise, dimension, block-state
and flat-setting shapes and an integer data-pack format below 82. This is detected from actual
selected-version data, not a guessed release-name cutoff. Later graph settings or major/minor
pack metadata retain discovery but expose `capabilities.customization.available: false`,
explicit unsupported fields, a localized explanation and no editable defaults. The internal
defaults/validation helpers also reject the unavailable catalogue.

This boundary was exercised against official 26.3 data. Its string block states, graph aquifers,
removed ore Boolean and major/minor pack metadata do not fit the existing writer. Marking this
route unavailable fixes the blank-picker path without claiming modern-schema generation support.
The renderer separately handles malformed or missing setting values without inventing defaults.
Official references: [26.3 generation changes](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3)
and [1.21.9 pack metadata](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-9).

The strict Boolean flat-field checks describe this builder's current admission boundary,
not universal protocol requiredness of optional fields. An integer format in 1 through 81
alone does not establish support for a version; its actual registry, shape and readiness
checks must also pass. Full generation remains subject to separate runtime acceptance.

World presets alone do not establish that a version can execute the generator's readiness probes. The selected server distribution's actual command report must expose `execute if loaded` with a `minecraft:block_pos` argument redirected to `execute`, the root `execute run` form (the vanilla exporter omits an empty root redirect), and an executable `say` message argument. The catalogue retains the selected version and extracted picker data but sets `supported: false` with an explicit readiness-route explanation when that schema is missing or incompatible. Validation rejects generation before spawning a Java server. No guessed version-number threshold substitutes for those reports.

The older preset-bearing route remains unavailable until a compatible implementation is independently verified. Discovery is retained. This change does not add older-version support or remove the user's EULA decision.

## Whole-batch readiness

Each forceload batch still contains at most 256 chunks. The generator now probes one block position inside **every requested chunk**, rather than checking only four corners. The probe height remains within the selected dimension. Tickets remain in place and the batch remains incomplete until every requested chunk has acknowledged readiness.

Each run and each batch receives an independently random 128-bit identity. Every chunk has a distinct tag bound to both identities. A poll emits at most one short command per remaining chunk, with at most 256 such commands per batch. Acknowledged chunks are removed from the pending set and are not polled again.

The response parser accepts only the complete vanilla console announcement shape `[HH:mm:ss] [Server thread/INFO]: [Server] <current-tag>`. It rejects diagnostic echoes, ordinary player chat, unframed text, extra prefixes/suffixes, unknown tags, and stale tags from another batch or run. An accepted response discharges only that exact pending chunk. Ticket removal and completed-batch progress happen only after the pending set is empty.

Official Java 1.21.4 source assets support the expected console framing: the bundled logging configuration uses `[%d{HH:mm:ss}] [%t/%level]: %msg{nolookups}%n`, and the language asset's announcement template is `[%s] %s`. This is a bounded source observation, not runtime verification across every supported version or modified server logging configuration. Unexpected formats time out without advancing the batch.

## Verification and remaining limits

The new semantic regressions invoke the actual `generate` function with injected process events and filesystem fixtures. Before the repair, the initial ten-case regression run produced nine failures, including admission of an old preset-bearing report, false completion with an interior chunk pending, and acceptance of diagnostic/chat/partial marker text. After the repair, all twelve readiness cases passed. They independently cover:

- Preset-bearing reports without the required command schema, with no server spawn.
- Schema-derived admission independent of a guessed version threshold.
- One pending interior chunk of a 16 by 16 batch, with no completed batch or ticket removal.
- Diagnostic echoes, player chat, prefixes, suffixes and unframed responses.
- All 256 requested chunk positions and bounded individual command lengths.
- Stale previous-batch and previous-run replies, with distinct random run/batch identities.

`node --test apps/desktop/electron/minecraft/worldgen*.test.cjs` passed **42 tests, zero failed**, including existing cancellation at startup/batch/save/exit, graceful-stop ownership, retry, admitted-byte snapshots, cache integrity and output verification tests. The existing synthetic success fixtures were updated to supply the admitted command schema and the exact response envelope.

These are deterministic simulation and source results. No real server was started, no actual server EULA was accepted, and no generated world was reopened. Real selected-version execution, generated-area completeness, output reopening and current GUI interaction remain separate unverified acceptance work. This repair does not establish whole-product completion.


Independent review against retained official 1.21.4 reports found that `execute.children.run` is exactly `{ "type": "literal" }`: the exporter omits its empty root redirect. The initial repair incorrectly required an explicit empty array and would have marked this verified version unavailable. Admission now accepts the omitted root form or an explicit empty redirect, while rejecting non-root or malformed redirects. The fixture and dedicated regression use the actual omitted-field shape; independent real-report revalidation is recorded separately from synthetic tests.
