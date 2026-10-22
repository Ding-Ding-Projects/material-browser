# Optional KeePassXC pairing for new profiles

Profile creation offers an optional password manager section. When it is enabled, the profile
records a KeePassXC pairing: the source (an installed KeePassXC or one inside the WSL guest), a
database path with an existing or create mode, whether the KeePassXC browser extension should be
registered, and whether passkeys are enabled. Both switches default to on. The database
password, key file and credentials are never stored, requested or logged by this application.

The maintained source lineage is [Ding-Ding-Projects/keepassxc](https://github.com/Ding-Ding-Projects/keepassxc).
Detection looks only at its supported installer roots (`KeePassXC.Material` and `KeePassXC`
under the local application data folder, including Squirrel `app-<version>` layouts) and
returns the newest usable `KeePassXC.exe` and `keepassxc-proxy.exe` pair. When nothing is
installed, the form shows the release page rather than installing anything.

## What the native host writes

Registrations are written only into application-owned locations immediately before launch,
and only for profiles whose pairing has the extension switch on. Each file carries a
`managedBy` marker; a file the application did not write is never overwritten, and removal
touches only marked files.

| Engine | Location | Content |
| --- | --- | --- |
| Chromium | `<profile user data dir>/NativeMessagingHosts/org.keepassxc.keepassxc_browser.json` | Native messaging manifest pointing at the detected `keepassxc-proxy.exe` |
| Chromium | `<profile user data dir>/External Extensions/oboonakemofpalcgghocfoadofidjkkk.json` | External extension registration with the Web Store update URL |
| Firefox | `<bundled Firefox>/distribution/policies.json` | `ExtensionSettings` entry for `keepassxc-browser@keepassxc.org`, merged with existing policies |
| Firefox | `<data root>/password-manager/native-messaging-hosts/org.keepassxc.keepassxc_browser.json` | Native messaging manifest, registered through the per-user `HKCU\Software\Mozilla\NativeMessagingHosts` value on Windows |

Chromium and Firefox both ask the person to enable the extension on first launch. There is no
supported way to enable an extension completely silently, and this application does not try.

## Passkeys

Passkey support is provided by KeePassXC and its browser extension. The profile stores
`passkeys: true` by default so the pairing records the intended behavior, but this application
never edits KeePassXC's own configuration file. Verifying passkey registration and sign-in in a
built profile remains pending.

## Limits and pending verification

- The WSL source records the choice but launch reports `PASSWORD_MANAGER_WSL_UNAVAILABLE`
  until guest provisioning from the maintained lineage exists. The lineage publishes Windows
  packages only, so the guest route needs a verified source build inside the guest.
- Launch with the installed source fails with `PASSWORD_MANAGER_UNAVAILABLE` when no supported
  installation is detected, rather than launching without the promised registration.
- Core validation rejects relative paths, traversal segments, control characters, non-`.kdbx`
  suffixes and unknown fields with `INVALID_PASSWORD_MANAGER`. Existing vaults without the field
  load with no pairing.
- Verified so far: core and host unit tests for validation, registration shapes, idempotent
  create-if-absent writes, foreign-file refusal, scoped removal, Firefox policy merging and
  installation detection; renderer form-model tests for defaults, validation and path redaction.
- Not verified: built interface capture, real extension connectivity, passkey behavior in a
  running browser, the Windows registry write and the installer. These remain acceptance gaps.
