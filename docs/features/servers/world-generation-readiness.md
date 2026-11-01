# World-generation readiness and completion evidence

## Version admission

World presets alone do not establish that a version can execute the generator's readiness probes. The selected server distribution's actual command report must expose `execute if loaded` with a `minecraft:block_pos` argument redirected to `execute`, the root `execute run` redirect, and an executable `say` message argument. The catalogue retains the selected version and extracted picker data but sets `supported: false` with an explicit readiness-route explanation when that schema is missing or incompatible. Validation rejects generation before spawning a Java server. No guessed version-number threshold substitutes for those reports.

The older preset-bearing route remains unavailable until a compatible implementation is independently verified. Discovery is retained. This change does not add older-version support or remove the user's EULA decision.

## Whole-batch readiness

Each forceload batch still contains at most 256 chunks. The generator now probes one block position inside **every requested chunk**, rather than checking only four corners. The probe height remains within the selected dimension. Tickets remain in place and the batch remains incomplete until every requested chunk has acknowledged readiness.

Each run and each batch receives an independently random 128-bit identity. Every chunk has a distinct tag bound to both identities. A poll emits at most one short command per remaining chunk, with at most 256 such commands per batch. Acknowledged chunks are removed from the pending set and are not polled again.

The response parser accepts only the complete vanilla console announcement shape `[HH:mm:ss] [Server thread/INFO]: [Server] <current-tag>`. It rejects diagnostic echoes, ordinary player chat, unframed text, extra prefixes/suffixes, unknown tags, and stale tags from another batch or run. An accepted response discharges only that exact pending chunk. Ticket removal and completed-batch progress happen only after the pending set is empty.

Official Java 1.21.4 source assets support the expected console framing: the bundled logging configuration uses `[%d{HH:mm:ss}] [%t/%level]: %msg{nolookups}%n`, and the language asset's announcement template is `[%s] %s`. This is a bounded source observation, not runtime verification across every supported version or modified server logging configuration. Unexpected formats time out without advancing the batch.

## Verification and remaining limits

The new semantic regressions invoke the actual `generate` function with injected process events and filesystem fixtures. Before the repair, the initial ten-case regression run produced nine failures, including admission of an old preset-bearing report, false completion with an interior chunk pending, and acceptance of diagnostic/chat/partial marker text. After the repair, all eleven readiness cases passed. They independently cover:

- Preset-bearing reports without the required command schema, with no server spawn.
- Schema-derived admission independent of a guessed version threshold.
- One pending interior chunk of a 16 by 16 batch, with no completed batch or ticket removal.
- Diagnostic echoes, player chat, prefixes, suffixes and unframed responses.
- All 256 requested chunk positions and bounded individual command lengths.
- Stale previous-batch and previous-run replies, with distinct random run/batch identities.

`node --test apps/desktop/electron/minecraft/worldgen*.test.cjs` passed **41 tests, zero failed**, including existing cancellation at startup/batch/save/exit, graceful-stop ownership, retry, admitted-byte snapshots, cache integrity and output verification tests. The existing synthetic success fixtures were updated to supply the admitted command schema and the exact response envelope.

These are deterministic simulation and source results. No real server was started, no actual server EULA was accepted, and no generated world was reopened. Real selected-version execution, generated-area completeness, output reopening and current GUI interaction remain separate unverified acceptance work. This repair does not establish whole-product completion.
