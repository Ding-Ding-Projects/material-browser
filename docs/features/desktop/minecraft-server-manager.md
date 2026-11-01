# Minecraft server manager

The active Servers workspace uses `apps/desktop/src/app/servers/` and the trusted
`material:game-servers` bridge. Its single lifecycle and registry authority is
`apps/desktop/electron/services/game-servers/`. See the [implementation and acceptance
record](../servers/README.md) for the current operation contract.

Incoming catalogue, typed configuration and content modules under `electron/minecraft/`
are retained for reviewed consolidation. Their independent service is not registered.
The incoming GUI source is also preserved but is not a second active server destination.

## Available implementation

The workspace provides catalogue search, target filtering, guided creation with explicit
EULA consent, provider selection, configuration, logs, start/stop/restart, and local
backup/data-pack workflows. Provider selections bind exact resolved versions. Fabric
installation separately requires acknowledgement that its launcher lacks a published
checksum; a locally computed hash is not publisher verification.

Four target adapters exist: a local Java process, local Docker, SSH process, and Docker
over SSH. Remote targets require existing trusted host keys and configured authentication.
Managed process receipts retain unknown/disconnected state after interrupted ownership.
A spawned process remains starting until readiness is proven. Container runtime references
are immutable digests. Only owned processes may receive lifecycle actions.

Configuration uses version-bound typed descriptors, preserves unknown keys without showing
protected unknown values, and applies supported edits while stopped. Duplicate property
entries and Unicode-escaped keys are handled consistently. Unknown historical/snapshot
schemas do not inherit invented modern defaults.

Local backups verify file hashes and retain rollback data. Restoration rejects invalid
manifest roots, stages replacements and rolls back partial promotions. Remote-world
transfer is not enabled by the local backup implementation.

## Acceptance status

Source and fixture tests are distinct from live operation. Real server startup, EULA
acceptance, all four target lifecycles, exhaustive version compatibility, keyboard/layout
acceptance and final installed delivery remain unverified. Bedrock, broad player/plugin
workflows, readiness/metrics, schedules, remote-world transfer and offline catalogue cache
consolidation remain unfinished. The [acceptance ledger](../acceptance/README.md) retains
these gaps. No second backend, historical screenshot or passing unit test proves them.

## World generator

Generate a world opens from the Servers page through its own trusted `material:worldgen` channel (`apps/desktop/electron/worldgen-ipc.cjs`) and follows the `WorldGenerator` artboard. For the
chosen Java release it downloads and verifies that version's server jar once, runs Mojang's data
generator (`--reports`, which does not start a server) and reads the jar's own `data/minecraft`
folders, so every picker (world presets, biomes, structure sets, superflat presets, blocks and
typed game rules) comes from that exact version. Versions without data-driven world presets say so
and offer nothing they cannot honour.

- **Size:** defaults to 100 x 100 chunks centred on spawn. A drawing canvas on a chunk grid lets
  the user draw, move and resize the area with a pointer or the keyboard (arrows move, Shift with
  arrows resizes), kept in sync with width and depth steppers. The readout shows blocks, chunks and
  the number of 16 x 16 chunk batches. The world border can follow the area.
- **Customization:** seed, world type, superflat layer editor with block pickers, heights,
  reordering and the version's presets, biome, features and lakes, structure sets, single-biome
  picker, sea level, aquifers, ore veins, first-generation animals, main block and sea fluid,
  world height, lowest Y and logical height (validated in steps of 16), every game rule with a
  switch or stepper by its declared type, difficulty and hardcore.
- **Generation:** a private data pack holds the world preset, noise settings and dimension type.
  The version's server runs once in a private folder on a loopback port after the user switches on
  EULA acceptance, applies the game rules and world border, then loads the area batch by batch
  with `forceload` (never more than 256 chunks at a time), checking every corner of each batch
  before moving on, and saves and stops.
- **Output:** Folder or ZIP file, chosen with a native Browse dialog. Existing files are never
  replaced. A folder copy is compared file by file with a SHA-256 digest; a ZIP is reopened and
  every entry's size and CRC is checked.

Verified for the generator: 8 focused tests (archive round trip and corruption, pickers read from
the jar, unsupported versions, the 100 x 100 default, batch limits and coverage, validation, the
data pack, and a full generation run with a stand-in server for both ZIP and folder output);
extraction against the real 1.21.4 jar (65 biomes, 20 structure sets, 5 presets, 1095 blocks,
53 game rules); a written ZIP passes `unzip -t`. Not verified: a real generation run, because that
needs the user's EULA acceptance, and whether every custom setting combination loads in every
version.
