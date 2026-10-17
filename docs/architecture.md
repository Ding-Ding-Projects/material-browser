# Architecture and integration contract

## Components

- `crates/core`: encrypted vault, profile metadata, immutable snapshots, folder synchronization,
  conflict preservation, and the shared command dispatcher.
- `crates/engine`: browser process ownership, explicit capabilities, launch modes and the
  restricted snapshot protocol. Source acquisition and patch recipes live in `engines/`.
- `apps/desktop`: Electron main/preload and React/TypeScript renderer. The renderer talks only
  to the typed preload bridge, never directly to browser processes or the filesystem.
- `apps/storage`: optional ciphertext-only container service and its browser dashboard.
- `crates/host`: Rust executable exposing the shared core through protected local IPC, CLI and
  explicitly enabled paired LAN transport.

## Core integration

The Rust library package is `material-browser-core` (import `material_browser_core`). It exports
`Manager::new(root: PathBuf) -> Result<Manager, CoreError>` and
`Manager::execute(&mut self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, CoreError>`.
`CoreError` has public `code: String` and `message: String`, implements `Display` and `Error`,
and is serializable. Sensitive arguments must never be included in an error.

The local wire envelope is `{ "id": "request-id", "method": "profiles.list", "params": {} }`.
Replies are `{ "id": "request-id", "result": ... }` or
`{ "id": "request-id", "error": { "code": "...", "message": "..." } }`.
No passwords in argv, environment variables or logs. Native clients may supply secrets through
protected standard input or local IPC. The host owns long-running operation serialization.

Methods: `system.status`, `vault.create`, `vault.join`, `vault.unlock`, `vault.lock`, `vault.changePassword`,
`profiles.list`, `profiles.create`, `profiles.update`, `profiles.duplicate`, `profiles.remove`,
`profiles.snapshot`, `revisions.list`, `revisions.restore`, `sync.configure`, `sync.push`,
`sync.pull`, `sync.conflicts`, `sync.resolve`, `settings.get`, `settings.update`.
Profile ids are UUIDs. Profile fields use camelCase: `id`, `name`, `engine` (`chromium`/`firefox`),
`automation` (`off`/`selenium`/`puppeteer`), `identity`, `createdAt`, `updatedAt`, `sync`.
The host adds lifecycle methods `profiles.launch`, `profiles.stop`, `profiles.focus`,
`profiles.status` and automation/device/operation methods after capability verification.

## Desktop bridge

`window.materialBrowser.request(method, params)` resolves the result or throws a structured
error. `window.materialBrowser.chooseDirectory()` invokes a native folder picker.
`window.materialBrowser.onEvent(listener)` returns an unsubscribe function.
Use actual returned state. No seeded fake profiles, invented metrics or success toasts before
the underlying operation succeeds. Unsupported managed engine features have explicit reasons.

## Data and safety

The vault uses Argon2id and authenticated XChaCha20-Poly1305 encryption. Runtime keys remain in
the native process. Manifests and filenames are encrypted. A running browser uses an exclusive
local active directory. Snapshots and synchronization never read a personal/default browser
directory. Never copy a live browser directory and call it a consistent snapshot.

Automation defaults off, with no driver or debugging listener. Changing a running profile's
preference records a pending restart and never claims its effective mode changed immediately.
An engine without the required integration must return an explicit capability error.

Concurrent revisions preserve their parent relationships and both versions. Never merge browser
databases or use timestamps to overwrite a conflicting revision. Network storage sees only
ciphertext. HTTP administration has an explicit network-path tampering limitation.

