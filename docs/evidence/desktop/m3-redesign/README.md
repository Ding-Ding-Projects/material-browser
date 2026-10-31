# Redesigned desktop: runtime captures

These images come from the running desktop application, not from the design
artboards. Each was taken from the real Electron shell talking to the real
native host (`target/release/material-browser`, built from this source) with a
disposable data folder created for the capture. Profiles, the template, the
lock and the sync folder shown were created through the interface during the
run; nothing is mocked.

- Source: commit `264d81d` on `main` (renderer built with `vite build`).
- Platform: Linux x64 under Xvfb, Electron 44.9.0, 1440 x 960 logical pixels
  (the compact capture is 420 x 860), default dark theme.
- Data: a fresh temporary folder per run, removed afterwards.

## What the captures show

| File | Surface |
| --- | --- |
| 01-create-vault.png | First start: create the vault beside the four-step first run |
| 02-first-run.png | Vault created; step 2 of the first run |
| 03-profiles.png | Profiles list-detail with a selection and the floating toolbar |
| 04-launch.png | Launch page with the engine list, automation group and review card |
| 05-super-profiles.png | Super Profiles template, overview and revision history |
| 06-sync.png | Synchronization with a configured storage folder |
| 07-settings.png | Settings, Language and voice |
| 08-command-palette.png | Command palette with the regex builder |
| 09-super-confirmation.png | Two-key super confirmation before deleting a profile |
| 10-unlock-ladder.png | Unlock ladder after five wrong PIN entries on a locked profile |
| 11-compact.png | Compact window: one pane and a bottom navigation bar |

## Limits of this evidence

- Linux only. Native preference storage uses a Windows-only lock, so on Linux
  the Settings screen reports that preference storage needs attention and
  notifications are not persisted. Windows behaviour is not shown here.
- No browser engine was bundled in the capture environment, so no browser
  window was launched; the launch page is shown before launch.
- WSL 2 and Windows Sandbox are unavailable on Linux, so no Super Profile
  session was opened.
- Visual parity was compared against the dark variants of the design
  artboards; layout at 200% scale and Windows font rendering are not covered.

## Hashes (SHA-256)

| File | SHA-256 |
| --- | --- |
| [01-create-vault.png](01-create-vault.png) | `a6cc76dac6066179002bb9c71bf7e0ea16a333741dc61f088a138d1e0550319e` |
| [02-first-run.png](02-first-run.png) | `f03a0c9060e554a62b24d897cba4ea432ef89ada9b667f71e1c4ee136791092d` |
| [03-profiles.png](03-profiles.png) | `551ededab9633a83793374e052b37eac859bc50402bc293cc178ff6158b5fd45` |
| [04-launch.png](04-launch.png) | `bd1b7116a1c2bd776a570f8bc41e070d4c0509f91fd861d032ec91d0304f3f33` |
| [05-super-profiles.png](05-super-profiles.png) | `81c65d69a28a78eb2cc493a10cf53718ca6743941edd3bd08b2d0e4bb4c84b29` |
| [06-sync.png](06-sync.png) | `f4f07a56600513f21df5ffb991d6f269f05449d7159f2300bacf429b8810b925` |
| [07-settings.png](07-settings.png) | `7e3c93b0ea002af21fa2bffd00a985fe65e4a75bb827e98ed893ed7ef91df327` |
| [08-command-palette.png](08-command-palette.png) | `a965341537d9f6d7bd6692e2c59c4f5f627bdb136bcafd6b761d6fd61e57062a` |
| [09-super-confirmation.png](09-super-confirmation.png) | `7678125fb307a3d9d5e96d8c0929d3dde9095676bed75ed327089ad34619f85b` |
| [10-unlock-ladder.png](10-unlock-ladder.png) | `da1c7b7d93bc811ff3b9cf46ea43f7ccbee7eb07c55764eae9a3872084b8707f` |
| [11-compact.png](11-compact.png) | `5bbf6f4bbda0fe013fbb9a05e4c88e2ac41b637a652b43b9529e06d8a02cab9c` |
