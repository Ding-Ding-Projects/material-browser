# Minecraft server manager

The Servers destination creates and manages Minecraft Java Edition servers. The interface
follows the design in `design/remaining-features/` (`Main`, `ServerCreate`, `ServerConfig` and
`ServerContent` artboards). The main-process service lives in `apps/desktop/electron/minecraft/`
and is reached only through the trusted `material:minecraft` channel.

## Execution targets

| Target | How it runs | Ownership check |
| --- | --- | --- |
| This PC | A Java process started by Material Browser, console through its standard input | Only the process this app spawned |
| Docker on this PC | An `eclipse-temurin` JRE container with the server folder mounted at `/data` | Container label `material-browser.server=<id>` |
| Process on an SSH host | `mb-run.sh` started with `nohup`; console lines are appended to `console.in` | `run.pid` written at start |
| Docker on an SSH host | The same container setup, driven over SSH | Container label |

SSH uses the system OpenSSH client with `BatchMode=yes` and `StrictHostKeyChecking=yes`, so a
host must already be in your known hosts and authentication comes from your keys or SSH agent.
No password is stored. When SSH cannot reach a host the server shows as Disconnected, never as
Stopped. Containers without this app's label are reported as not managed and are never touched.

Stopping sends the server's own `stop` command and waits up to 90 seconds. A server that does
not stop in time is reported as still running; nothing is forced.

## Versions and server software

- **Catalogue:** every entry of the official `version_manifest_v2.json` (releases, snapshots,
  old beta, old alpha), with release-channel filters, search with the regex builder, retrieval
  time and an offline copy marked as possibly out of date.
- **Per version:** the version's own metadata is fetched and must match the SHA-1 the catalogue
  lists. It provides the server download (or an explicit "no server download" reason) and the
  required Java major version. When the metadata names no Java version the runtime stays
  unresolved and Docker targets refuse to guess one.
- **Vanilla** downloads are verified by SHA-1 and size, **Paper** builds by SHA-256 from the
  Paper download service, **Fabric** server launchers have no published checksum and are
  labelled as unverified.
- **Bedrock** is unavailable: Mojang publishes no machine-readable Bedrock server catalogue, and
  the interface says so.

Downloads are limited to an allowlist of official hosts, written to a temporary file and only
moved into place after the size and digest match.

## Configuration

`server.properties` is parsed losslessly: comments, order and keys without a descriptor survive
every save. Known keys each have a typed descriptor with a control (switch, choice, number with
slider or steppers plus a numeric field, or validated text), its default, bounds, unit, whether it
applies live or needs a restart, and help text. Descriptors are version-bound: for example `pvp`,
`spawn-monsters` and `allow-nether` are hidden from 1.21.9, when they became game rules, and the
`white-list` default changes to on from 26.3. A key without a descriptor is listed as a gap and
cannot be changed through a free text box.

## Players, plugins and backups

- Allowlist, operator and ban switches in one permission matrix. Names are looked up with the
  official profile service first. Running servers change through their own commands; stopped
  servers have their JSON lists edited with other entries kept. Operator and ban changes ask for
  confirmation.
- Paper plugins and Fabric mods come from Modrinth, filtered by loader and game version, and are
  verified by the SHA-512 Modrinth publishes. A world backup is made before each install. Files
  added outside the catalogue are shown as not fully managed.
- Backups copy the world folders, record a SHA-256 digest of every file, and restoring checks that
  digest, needs the server stopped and backs up the current world first.

## EULA

The server cannot start until the user accepts the Minecraft EULA for that server. `eula=true` is
written only after the user switches it on.

## Verification

Verified: 22 focused service tests (catalogue integrity, version-bound descriptors, typed-control
regression, four targets present, input validation, download integrity, owned local lifecycle with
a fake process, disconnected SSH state, unlabelled containers, players, backup tampering, plugin
hash requirement), the security test for the IPC channel, the full desktop suite, TypeScript and
the production renderer build. A live catalogue check returned 921 Java versions and resolved
server downloads and Java versions for current and historical releases. A real local creation of
Java 1.21.4 downloaded and verified `server.jar`, wrote configuration and refused to start without
EULA acceptance.

Not verified: a real server start and stop (no EULA acceptance was given), Docker and SSH targets
against real daemons and hosts, Windows behaviour, plugin installation against a running Paper
server, and screenshots of every state.
