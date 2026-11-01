# Server management native service

The desktop service owns managed Java vanilla installations under the application data directory. It retrieves the full official Mojang version catalogue, verifies metadata and server SHA-1 and size, and distinguishes client-only historical entries from available server distributions. Installation requires explicit EULA consent. Distribution discovery does not establish runtime compatibility for every version.

The request API is `createGameServerService({dataDir}).request({action, params})`. Supported actions are capabilities, list, discoverVersions, resolveVersion, create, readConfiguration, configure, start, stop, restart, logs and cancel. Local lifecycle requires an absolute Java executable and the exact major version declared by official metadata. Only processes created by this service are controlled. Stop writes the server stop command and waits 15 seconds; timeout remains pending and does not silently kill a process. The owner must await dispose before quitting and retain the running application if graceful shutdown remains pending.

Configuration currently supports the server port and ASCII message of the day while preserving unknown generated properties. Runtime readiness, players and performance metrics are not inferred from a spawned process. Running means the owned operating-system process exists, not that its network listener is ready.

Docker, SSH, Bedrock, third-party flavours, typed administration, backups and content operations remain incomplete in this first native milestone. Capability responses disclose these limits instead of simulating successful operations. Java provisioning remains an explicit application integration task.

Focused verification: `node --test apps/desktop/electron/services/game-servers/index.test.cjs`. Real official discovery on 2026-11-01 returned 921 version entries. No production server or world was launched for that read-only check.

## Backups and content

Stopped managed servers support bounded backups (10000 files, 10 GiB), SHA-256 inventory verification and same-version restore. Restore creates a rollback backup first. Linked, shared and special files are rejected. Restore is local storage restoration, not proof of safe world downgrade or cross-machine portability.

Java vanilla data packs can be imported from explicitly selected ZIP bytes with caller-provided SHA-256 and an acknowledgement that compatibility is unknown. Imports remain ZIP files and are never extracted by the manager. Their target is the default world data-pack directory. Plugin and mod loaders remain unavailable. Removing unchanged managed content creates a backup first; unrecognized files are never silently adopted or removed.

Local Docker lifecycle uses an explicitly supplied immutable `eclipse-temurin@sha256:` image reference, the Java version probe, a fixed Java entrypoint, bounded memory, a managed bind mount and a loopback-only port publication. Docker daemon/image availability and live container operation remain unverified on the current host. SSH targets remain disabled.

A persisted process receipt after an interrupted application session is reported as unknown and blocks file mutation. A process spawn is starting, never server-ready proof. No previous PID is blindly adopted or terminated. This conservative recovery currently requires external identity reconciliation before reuse.
