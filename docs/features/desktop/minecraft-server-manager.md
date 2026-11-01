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
