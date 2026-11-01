# Desktop workspace

- [Profile launch and identity capabilities](profile-launch.md)
- [Super Profiles](super-profiles.md)
- [Action sounds and quiet controls](action-sounds.md)
- [Material 3 Expressive desktop design](zip-gui-remake.md)
- [Element locks, unlock ladder and Support Tickets](element-locks.md)
- [Local Ollama suite](ollama-suite.md)
- [Focus modes and the appearance editor](focus-modes-and-appearance.md)
- [Historical WorldLens visual design and accessibility](worldlens-design.md)
- [Optional KeePassXC pairing for new profiles](password-manager.md)

The desktop shell provides an isolated React interface backed by the native host. It never seeds demonstration profiles. A standalone web preview cannot operate the vault and explicitly reports that the native host is unavailable.

## Security and process boundary

The [settings file boundary](settings-file-boundary.md) documents export and editor-choice path validation, durable replacement, failure handling, and focused negative tests.

The [protected history workspace](protected-history-workspace.md) records the main-process history integration, independent access flow, display-name behavior and remaining runtime acceptance. Its source implementation is not a complete Settings verdict.

The renderer has no Node access and uses an allowlisted preload bridge. The main process checks sender and frame identity, bounds requests, rejects permission requests and new windows, and launches the native host with an application-owned data directory. Passwords travel through stdin JSON requests, not arguments or logs. Backend errors are reduced to stable error codes at the renderer boundary. Browser profiles are launched only by the native host. The bundled renderer has a restrictive content security policy.

## Personal wording

Settings upload and window-wide file drop use the same full validator. Schema: `{ "schemaVersion": 1, "entries": { "Original label": "Replacement label" } }`. UTF-8 limit is 256 KiB, nesting limit 8, key length at most 160 Unicode code points and value length at most 1000. Duplicate keys, unknown fields/versions, unsafe keys and non-string values are rejected before state changes. Only exact product-authored labels are replaced. External records, profile names, paths, identifiers and backend responses are not transformed. The validated cache remains local and is omitted from synchronized settings, exports and history. Clearing removes it. No private mappings or filenames ship in the product.

## Verification status

The renderer follows the eight artboards of `design/IMPLEMENTATION_HANDOFF.md` using the vendored design stylesheet. [Runtime captures](../../evidence/desktop/m3-redesign/README.md) from the real Electron shell and native host on Linux are recorded with their method and limits. Windows installation, native preference persistence on Windows and browser launches with bundled engines need their own evidence.

## Capability inventory and outstanding acceptance

Implemented source paths: isolated preload RPC, native folder picker, real vault creation/unlock, resumable setup progress, real profile list/create/duplicate/launch/stop/snapshot requests, immutable revision listing/restore requests, synchronization configuration/push/pull/conflict requests, saved automation preferences, local language/theme/density/accent, command navigation, strict local personal-wording upload/drop/clear and celebration. Host capability errors remain visible.

Incomplete: the regex workbench currently provides raw/guided constructs, actual worker matching/captures/replacement, timing and timeout but lacks saved snippets/import-export, structured syntax tree, test-case suites and full independent surface coverage. Settings localization has English fallback for explanatory paragraphs. Full universal features such as scheduled settings, narration, shared school mode, per-element appearance/locks, advanced tab docking/groups, authenticator, support recovery, exports/history, bulk operations, converter, local model manager and game-server manager are not implemented here. These are acceptance gaps, not nonapplicability claims. No decorative switches claim these capabilities.

Built runtime, accessibility, narrow/high-scale matrix, all-language copy, installer/update, restart persistence and backend integration acceptance remain unverified until actual evidence is recorded. The package source does not prove any of these.

- [Desktop profile workspace and daily workflows](profile-workspace.md)
