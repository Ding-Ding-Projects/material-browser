# Server management native service

- [World-generation readiness and version boundaries](world-generation-readiness.md)
- [World-generation cache validation and explicit recovery](worldgen-cache-recovery.md)

The privileged desktop service owns managed Java vanilla installations under application data. It retrieves the full official Mojang catalogue, verifies selected metadata and server SHA-1 and size, and distinguishes historical client-only entries from dedicated server distributions. Discovery does not establish runtime support for every version. Installation requires explicit EULA consent.

## Request interface

Use `createGameServerService({dataDir}).request({action, params})`. Actions: capabilities, list, discoverVersions, resolveVersion, create, readConfiguration, configure, start, stop, restart, logs, cancel, backup, listBackups, restore, listContent, installContent and removeContent. Actions return native data or reject with a stable error code and a message. The GUI must honor the capability flags and target-specific restrictions.

Creation accepts name, version, edition (`java`), flavour (`vanilla`), target, memoryMb, port, eulaAccepted and an optional operationId for cancellation. The four targets are `local-process`, `local-docker`, `ssh-process` and `ssh-docker`. Container targets additionally require an immutable `eclipse-temurin@sha256:` image identity. SSH targets require an ssh object with host, username, port, remoteRoot, javaPath and optional absolute identityFile/knownHostsFile paths. SSH credentials are never accepted in request text or persisted in records. Existing native SSH authentication and strict preverified host-key trust are required. Remote targets currently support Linux paths.

Local process start requires an absolute javaPath. Each adapter probes the exact Java major declared by official metadata. Historical entries without that declaration remain unresolved. Native commands use argument arrays without a local shell. The SSH protocol uses fixed, quoted remote commands whose host/path/runtime fields are validated. Remote provisioning refuses to adopt an existing destination and transfers installation/configuration files without overwriting remote worlds. Containers use an explicit Java entrypoint, bounded memory and a loopback-only published port. Native Java installations default to loopback binding.

## Lifecycle and recovery

Only processes created by the service are controlled. A spawned process is `starting`, not server-ready evidence. Players, performance and listener readiness remain unavailable. Stop writes the native server stop command and waits 15 seconds. Timeout stays pending without force termination. The application must await dispose before quitting and preserve its owner process if graceful shutdown remains pending.

A surviving process receipt after interrupted application ownership is unknown and blocks mutation. SSH/container connection loss remains disconnected or unknown rather than stopped. Previous process identifiers are never blindly adopted or terminated. Recovery currently requires independent identity reconciliation before reuse.

## Configuration and data

Rich descriptors currently cover server port and ASCII message of the day. Unknown properties are preserved, and every duplicate occurrence of a changed key is updated consistently. SSH configuration changes are transferred only after local validation and persistence.

Stopped local targets support backups bounded to 10000 files and 10 GiB. SHA-256 inventories verify every file, linked/shared/special files are rejected, and same-version restore creates a rollback backup before replacement. This does not prove safe world downgrade, migration or cross-machine restoration. Remote-world backup/restore transfer is explicitly unavailable.

Local vanilla data packs accept explicitly selected ZIP bytes (at most 32 MiB), supplied SHA-256 and acknowledgement that compatibility is unknown. Files remain archived and are never extracted by the manager. The current destination is the default world data-pack directory. Plugin/mod loaders, catalogue licensing and compatibility automation remain incomplete. Removing unchanged digest-named managed content creates a backup first. Remote content transfer remains unavailable.

## Verification and remaining work

Run `node --test apps/desktop/electron/services/game-servers/index.test.cjs`. Sixteen focused tests cover consent, persistence, official integrity checks, historical entries, invalid targets/paths, configuration preservation/duplicates, backup/restore/tampering, interrupted ownership, pinned images, content rejection, strict SSH arguments and injected owned lifecycle start/stop, restart and disposal admission/in-flight races.

Read-only official discovery on 2026-11-01 returned 921 versions, from 26.4-snapshot-6 to rd-132211. The current host reports Java 26.0.2.1 and provides OpenSSH executables. The local Docker daemon is unavailable because its expected named pipe does not exist. No real server was launched, no real EULA acceptance was invented, and no SSH host/runtime operation was verified. These source and test results are separate from runtime, GUI and deployment acceptance.

Bedrock distribution installation, third-party flavours, runtime provisioning, server readiness, typed administration, players/permissions/metrics, schedules, remote data transfers, complete version-bound configuration and world migration remain incomplete.


## Consolidated typed configuration

The single game-servers service reuses the typed properties inventory in `electron/minecraft/properties.cjs`; no second registry or lifecycle owner is introduced. Its parser retains unchanged byte formatting, comments, unknown keys, escaped key identities, Unicode and continuation lines. Every duplicate occurrence of an edited key receives the same effective value. Malformed stored numeric/switch values remain visible with validation detail instead of acquiring guessed fallback values.

Numeric release identifiers retain declared version boundaries. Snapshot, prerelease and historical identifiers without a schema expose unresolved applicability and no invented defaults; only the common message and port controls remain available. All descriptors remain implemented but runtime-unverified. The service currently persists configuration while stopped, so it exposes restart behavior even for descriptors that describe a possible live command in a future consumer.

Verification: `node --test apps/desktop/electron/minecraft/properties.test.cjs apps/desktop/electron/services/game-servers/index.test.cjs` passed 24 tests. This includes preservation, Unicode, duplicate escaped keys, version uncertainty, invalid stored values and prototype-safe property names. It is separate from actual server-version runtime acceptance.

## Flavour catalogues and distribution integrity

The sole service supports vanilla, Paper and Fabric resolution. `discoverVersions({flavour})` retains each provider-listed version, including explicit unavailable rows where provider identifiers have no matching current Java metadata. `resolveVersion({version,flavour,buildId?,loaderVersion?,installerVersion?})` binds the exact distribution before creation.

Paper selects an explicitly chosen build or a stable build, never an experimental fallback. It requires bounded published SHA-256 metadata and verifies downloaded bytes. Fabric resolves the loader against the selected game version and binds an exact installer. Its bootstrap endpoint has no published catalogue checksum, so the response discloses that limit and creation requires `unverifiedDistributionAccepted: true`. The recorded local SHA-256 binds later launches to those installed bytes and does not become publisher verification. The standard Fabric bootstrap may download additional components on first launch; those are not falsely included in the manager's own integrity verdict.

Provider references: [Paper downloads service](https://docs.papermc.io/misc/downloads-service/), [Fabric server launcher](https://fabricmc.net/use/?page=server) and [Fabric metadata API](https://meta.fabricmc.net/). The provider user-agent identifies Material Browser and its public source/contact URL.

Read-only live provider checks at 2026-11-01T07:28Z returned 68 Paper version identifiers and 533 Fabric identifiers. Of the Fabric identifiers, 26 had no matching current Mojang catalogue entry and remain unavailable with an explicit reason. No server or bootstrap was launched. Thirty focused tests pass across the typed-properties, flavour and native service suites; runtime installation acceptance remains separate.
