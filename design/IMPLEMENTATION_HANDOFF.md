# Material Browser GUI remake: design handoff

Source design for the full desktop renderer remake of `Ding-Ding-Projects/material-browser` (`apps/desktop`). Frontend design only; no renderer behaviour was changed.

## Location

In the repository these files live directly in `design/` (artboards, `canvas.json`, `audit.md`, `current-screens/`). The same canvas is also hosted as a private design project.

## Artboards

Each `.dc.html` artboard opens in a browser for a rough view and has a `dark` toggle in its script props. Layouts are fluid for desktop windows.

- `Main.dc.html`: Profiles home.
  - Frameless title bar with version and updated-at provenance, Ctrl+Shift+F search, vault state, notifications, accessibility tools and window controls.
  - Navigation rail: Profiles, Super Profiles, Sync, Settings, Setup, Lock vault.
  - Left-docked tab strip with pinned tabs and a running group.
  - Profile cards with engine, automation and run state, plus a profile inspector with Details, Identity and History tabs.
- `Launch.dc.html`: launch flow with engine choice (Chromium or Firefox), automation choice (Off, Selenium or Puppeteer), a consent review, what-happens steps and the running list.
- `SuperProfiles.dc.html`: template cards (WSL 2, Windows Sandbox), an open session with a save-back preview of exactly what changes, and revision history with non-destructive restore.
- `Sync.dc.html`: self-hosted storage status, this computer, joining another computer, and conflict resolution (keep local, keep server, keep both).
- `Settings.dc.html`: tabbed settings with search and regex.
  - Language mode, two funny-level sliders, dialog emoji switch, application name, narrator and action sounds.
  - KeePassXC source, database, extension and passkeys.
  - Theme, density, accent colour, logo and the element appearance editor.
  - The five focus modes, School mode, history, protected history, export and locks.
- `Vault.dc.html`: vault unlock with passphrase, join and locked-out routes; the four-step first-run setup with Back, Skip and Next and saved progress.
- `Palette.dc.html`: command palette with filter chips, rich rows and locked-item behaviour; profile context menu with filter, regex builder, shortcuts, Edit appearance and Lock this element; notification centre; dim sum surprise toast; undo snackbar.
- `Safety.dc.html`: two-key super confirmation with slider and Emergency exit for profile deletion; lock wizard with all six credential mixes; unlock ladder (sums rung shown); Support Tickets desk with the plain disclosure line.

## Design tokens

Material Design 3 roles with a deep teal seed and amber tertiary.

- Light: primary `#006A6A`, primary container `#9CF1F0`, secondary container `#CCE8E7`, tertiary `#7A5900` / container `#FFDEA6`.
- Light surfaces: `#F4FBFA` with containers `#FFFFFF #EFF5F4 #E9EFEE #E3E9E8 #DDE4E3`.
- Light text and lines: on surface `#161D1D`, on surface variant `#3F4948`, outline `#6F7979` / variant `#BEC9C8`, error `#BA1A1A`.
- Dark values are in each artboard's `.mb.dark` rule.
- Type: Roboto Flex with Noto Sans HK. Icons: Material Symbols Rounded in the mockups; the app keeps its local icon set, with no CDN.
- Targets are at least 44 px.

## Implementation notes

- Build with the app's registered `@material/web` components and React, not the raw HTML used in the mockups.
- Placeholders in brackets (`[UPDATED-AT]`, `[DATE]`, `[DEVICE NAME]`, `[YOUR SERVER ADDRESS]`, `[PHOTO]`) must come from real data.
- Sample profile names, revisions and counts are illustrative only; never ship invented records.
- `audit.md` maps every required feature to the current renderer and is the wiring backlog.
- `current-screens/` holds before screenshots. They were taken with a stub native bridge (vault unlocked, three sample profiles, settings service unavailable), so the Settings capture shows the storage-unavailable banner.
