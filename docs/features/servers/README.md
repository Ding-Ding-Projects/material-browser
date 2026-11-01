# Server management native service

The desktop service owns managed Java vanilla installations under the application data directory. It retrieves the full official Mojang version catalogue, verifies metadata and server SHA-1 and size, and distinguishes client-only historical entries from available server distributions. Installation requires explicit EULA consent. Distribution discovery does not establish runtime compatibility for every version.

The request API is `createGameServerService({dataDir}).request({action, params})`. Supported actions are capabilities, list, discoverVersions, resolveVersion, create, readConfiguration, configure, start, stop, restart, logs and cancel. Local lifecycle requires an absolute Java executable and the exact major version declared by official metadata. Only processes created by this service are controlled. Stop writes the server stop command and waits 15 seconds; timeout remains pending and does not silently kill a process. The owner must await dispose before quitting and retain the running application if graceful shutdown remains pending.

Configuration currently supports the server port and ASCII message of the day while preserving unknown generated properties. Runtime readiness, players and performance metrics are not inferred from a spawned process. Running means the owned operating-system process exists, not that its network listener is ready.

Docker, SSH, Bedrock, third-party flavours, typed administration, backups and content operations remain incomplete in this first native milestone. Capability responses disclose these limits instead of simulating successful operations. Java provisioning remains an explicit application integration task.

Focused verification: `node --test apps/desktop/electron/services/game-servers/index.test.cjs`. Real official discovery on 2026-11-01 returned 921 version entries. No production server or world was launched for that read-only check.
