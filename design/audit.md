# Material Browser desktop renderer: feature audit

Read-only audit of the Material Browser repository against the 111-entry feature catalogue. Paths are relative to the Material Browser repository root. Renderer source is `apps/desktop/src`; the Electron main process is `apps/desktop/electron`.

Stack: Electron 44 main process (`apps/desktop/electron/main.cjs`), React 19 + TypeScript renderer bundled by Vite, Google Material Web 2.5 web components (`@material/web`), MDI icons (`@mdi/js`), Roboto and Roboto Mono from Fontsource. The renderer talks to a Rust native host (`crates/host`, `crates/core`, `crates/engine`) through one IPC bridge (`window.materialBrowser.request(method, params)`) with an allow-list of methods in `main.cjs`.

---

## 1. Current shell map

### Window chrome and title bar

- `BrowserWindow` in `apps/desktop/electron/main.cjs`: 1280x800, minimum 760x580, background `#0b0e11`, icon `assets/material-browser.ico`, sandboxed and context-isolated, navigation and new windows blocked. **No `frame: false` and no `titleBarStyle`**, so the operating system's default title bar and window controls are still in use. The document title is fixed to "Material Browser" in `apps/desktop/index.html`.
- The in-app header is `WorkspaceHeader` in `apps/desktop/src/workspace/Shell.tsx`. It sits under the OS title bar and shows:
  - a brand mark (letter "M", a profiles icon, or a compass icon, depending on the `logoPreset` setting)
  - the display name (user-renamable, falling back to "Material Browser")
  - "Version {APP_VERSION} · Updated: Unavailable" (the updated-at value is never filled in)
  - a connection pill: Connected, Locked, or Backend unavailable
  - a "New tab" button with a `Ctrl Shift F` hint, which opens the command catalogue

### Navigation

`WorkspaceNavigation` in `Shell.tsx` is an 80 px icon rail with a pill-shaped highlight on the active item and a label under each icon. Below 900 px wide or 480 px tall it collapses into a "Workspace" disclosure button.

- Primary destinations: Profiles, Super Profiles, Sync (accessible name "Synchronization"), Settings.
- Utilities at the bottom: Setup (reopens onboarding) and Lock vault (calls `vault.lock`).

### How destinations map to components

There is no router. `main.tsx` holds a `page` state value plus a `showSetup` flag, and every destination stays mounted, hidden with the `hidden` attribute when inactive.

| Destination / state | Component | File |
| --- | --- | --- |
| `showSetup = true` (first run until `setupComplete`) | `Onboarding` | `apps/desktop/src/workspace/Onboarding.tsx` |
| `profiles` (default) | `ProfilesWorkspace`, which contains `ProfileTable` and `ProfileInspector` | `workspace/ProfilesWorkspace.tsx`, `workspace/ProfileTable.tsx`, `workspace/ProfileInspector.tsx` |
| `super-profiles` | `SuperProfiles`, which contains `SuperProfilesWizard` | `apps/desktop/src/SuperProfiles.tsx`, `SuperProfilesWizard.tsx` |
| `sync` | `Synchronization` | `workspace/Synchronization.tsx` |
| `settings` | `SettingsWorkspace`, which contains `SettingsTabs`, `SettingControl` and the section panels | `settings/SettingsWorkspace.tsx`, `settings/SettingsTabs.tsx`, `settings/SettingControl.tsx`, `settings/sections/*.tsx` |
| Backend missing | inline "Backend unavailable" banner with "Retry connection" | `main.tsx` |

### Tabs

1. **Workspace tab strip** (in `main.tsx`, `.workspace-tab-strip`): a horizontal list of tabs, each with a close button and arrow, Home and End key handling. A tab is added only when the user picks an entry from the command catalogue. The strip is **not persisted**, cannot be docked, pinned or grouped, and has no context menu.
2. **Settings section tabs** (`settings/SettingsTabs.tsx`, `settings/tab-model.mjs`, `settings/docked-tabs.mjs`): `DockedSettingsTabs` subclasses Material `md-tabs`. It docks to the left, right, top or bottom edge, and supports:
   - pin and unpin
   - groups with a name, colour and collapsed state, plus a "Move into group" picker
   - a "New tab" catalogue of closed sections
   - "Close tabs by text" and "not matching", with a preview and a pinned-tab exclusion
   - "Find tabs and groups" searches
   - a right-click / Shift+F10 action menu with its own filter

   The state persists in `localStorage` under `settings.tabs.v1`.
3. **Inspector tabs** use the Material `Tabs` wrapper in `components.tsx`:
   - Profile inspector: Overview, Revisions, Automation.
   - Super Profile detail: Overview, Sessions, Revisions.

### Dialogs and overlays

- `Modal` in `components.tsx` wraps `md-dialog`. Its action row always includes an "Accessibility" button (unless that button has been hidden) and a Close/Cancel button. It adds an optional emoji to the headline when the emoji setting is on.
- **Command palette** (`main.tsx`, `palette` state): opened with `Ctrl+Shift+F` or the header button. It is a `Modal` titled "New tab" containing the shared `Search` component (plain text plus regex builder) and a list of outlined buttons. Entries come from `catalogDestinations` in `workspace/model.mjs`:
  - the four destinations
  - the ten settings categories
  - Setup, Create profile and Lock vault actions
  - every setting definition

  Picking a setting switches to Settings, selects the section, scrolls to the setting and highlights it via a `settings-reveal` event. Picking a page adds a workspace tab. The palette size (bounded card or full window) is a persisted setting. Rows are plain buttons, not live controls.
- **Create profile** dialog: name, engine (Chromium or Firefox), an automation note, and an optional KeePassXC password-manager section (source: installed or WSL, database mode existing or create, `.kdbx` path with a file picker, browser-extension switch, passkeys switch).
- **Launch profile** (`ProfileLaunch.tsx`): a consent dialog explaining that a stable browser identity is unavailable, with the button "Launch with standard identity".
- **Review dialogs**:
  - In `ProfilesWorkspace`: Stop, Remove and Restore revision, each with a plain Confirm.
  - In `SuperProfiles`: Launch, Delete template, Restore revision, Review save-back (with save-category checkboxes), Stop session, Discard and close, Confirm collected save.
  - In `Synchronization`: conflict resolution.
- **`ConfirmAction`** (`settings/ConfirmAction.tsx`): the two-switch plus slider-to-100% confirmation with an "Emergency exit" button. It is used only by settings reset, schedule removal and the protected history actions.
- **Toasts** (`settings/LiveTools.tsx` `Toasts`): fixed to the bottom-right corner, auto-dismissing after `toastSeconds`.
- **Notification centre**: a panel inside Settings > Notifications (`settings/sections/NotificationCenter.tsx`). It offers search, an undismissed-only filter, select all matches, inverse selection, shift-click range selection, dismiss selected, undo dismissal and export selected.
- **Accessibility tools** (`LiveTools.tsx` `AccessibilityTools`): a floating "Accessibility" button opening a panel with text scale, contrast, motion, stronger focus, larger targets, read keyboard help, and pause, resume or stop speech. Hiding the button needs a confirmation where Cancel has focus first.
- **Attention status** (`LiveTools.tsx` `AttentionStatus`): elapsed session time, the one-next-action reminder, and an idle reminder with "Not now".
- **Footer status bar** (`main.tsx`): a busy dot plus the last notice ("Working", "Completed", or an error).
- **Celebration overlay**: a full-window headline for 3 seconds after a personal wording file is dropped or uploaded.

### Settings organization

`SettingsWorkspace` contains:

- a heading with a save-state line ("Settings are saved on this device." / "Saving preferences" / a storage error banner with "Reload saved preferences")
- a collapsible "Search all settings" finder across every definition
- the docked section tabs

Each section has its own "Search this section" field, a grid of `SettingControl` cards, any extra panels, and an "Incomplete capability" list. Each `SettingControl` card shows:

- the label
- where the value came from ("Saved locally" or "Compiled default"), the default value, and any scheduled override
- an info icon button that opens the explanation plus a practice area ("Try example" / "Reset example")
- "Reset this setting"
- the live control

Settings definitions live in `apps/desktop/shared/settings-model.mjs` (39 definitions, 10 categories):

| Category | Settings | Extra panels |
| --- | --- | --- |
| Language and voice | language (English / Cantonese / both), English and Cantonese message-style levels 1-5, dialog decorations, narration on/off, narration language, English voice, Cantonese voice, speech rate, speech pitch, yield to screen reader | Narration card (current voice, sample, pause/resume/stop); Personal wording card (Upload/Replace/Clear) |
| Appearance | theme (light/dark/system/high contrast), density, accent colour, interface font (installed fonts enumerated natively), text scale, font weight, motion (system/reduced), workspace mark (3 presets), command palette size | font inventory status; incomplete: advanced element appearance |
| Accessibility | show accessibility button, text scale, higher contrast, stronger focus, larger targets | Keyboard help card |
| Focus and time | focus, low stimulation, show elapsed time, one next action and its text, idle reminder, idle minutes, snooze minutes | none |
| Notifications | action sounds, sound volume, toast duration, quiet hours on/start/end | Action sound preview; Notification centre |
| Schedules | none | `Schedules.tsx`: rule list with search, create/edit (setting, value, every day or chosen weekdays, start/end date and time, local timezone, priority), duplicate, move earlier, remove; local source only |
| History and transfer | none | `HistoryTransfer.tsx`: export preferences (JSON, JSON Lines, CSV), import with review, undo/redo, reset all; `ProtectedHistory.tsx`: protected native history (search, start/end date, action filter, select all/inverse, review diff, restore revision, edit label, retention days, export selected as redacted JSON, recover unfinished operation, display name save/reset); `HistoryAccess.tsx`: independent history password or PIN (set, change, lock) |
| Privacy and access | none | incomplete: shared restricted-presentation mode, element locks, authenticator |
| Tools and integrations | none | `EditorIntegration.tsx`: detected editors (Notepad, VS Code user and system installs, Notepad++), choose editor, open exported preferences; incomplete: file converter, local model manager, game server manager, automatic updates, status service |
| About and coverage | none | Version (hard-coded "0.1.0"), "Updated: Unavailable", coverage disclaimers |

Preferences go through `settings/store.ts`, `useSettingsPersistence.ts` and the native IPC (`electron/settings-preferences*.cjs`). Settings history runs through `electron/settings-history.cjs` and `electron/services/history*.cjs`, and secrets through `electron/services/credential-store.cjs`.

### Styling system and tokens

- `src/design-system/worldlens.css` imports Roboto (300 to 700) and Roboto Mono, plus `vendor/tokens.css`, a pinned copy of another design system with SHA-256 provenance in `provenance.json`. It declares the full `--md-sys-color-*` dark role set as the initial paint. The baseline palette is:
  - background `#0B0E11`
  - surface `#101418`
  - container `#1D2024`
  - primary `#8FCDFF`
  - primary container `#004B73`
  - text `#E1E2E8`
  - outline variant `#42474E`

  It also defines `--interface-font`, `--literal-font`, `--panel`, `--border` and `--muted`.
- `src/design-system/theme.mjs` and `vendor/colors.ts` hold the exact dark, light and contrast role sets. `settings/effects.ts` applies the theme, accent, density, text scale, font, weight, motion and high contrast to `:root` data attributes and custom properties.
- `src/style.css` holds global rules: type ramp (h1 title-large, h2 title-medium), `.surface` cards (16 px radius, 1 px outline), `.actions`, `dl` fact grids, the palette sizes and the celebration animation.
- `src/workspace/workspace.css` (928 lines) holds the shell: header, rail, disclosure, tab strip, table, inspector, responsive breakpoints at 1080, 900 and 480 px. `workspace/surfaces.css`, `settings/settings.css` and `SuperProfiles.css` hold the per-area rules.
- Material Web components in use: `md-filled-button`, `md-outlined-button`, `md-outlined-text-field`, `md-outlined-select` and `md-select-option`, `md-dialog`, `md-tabs` and `md-primary-tab`, `md-icon-button`, `md-switch`, `md-slider`, `md-elevation`.
- These are still plain HTML: the profile and Super Profile tables (`<table>`), row checkboxes, the rail and tab-strip buttons, `<details>`/`<summary>` disclosures, `<progress>`, the native `<input type="color">` and `<input type="range">` (inspector width), and the file input.
- Design contract: `design/desktop/REFERENCE.md`, `STATES.md`, `settings-handoff.md`, `worldlens-handoff.md`, `reference-manifest.json`.

---

## 2. Domain objects and screens (for redesign)

Native API surface (allow-list in `electron/main.cjs`):

- `system.status`
- `vault.create`, `vault.unlock`, `vault.join`, `vault.lock`, `vault.changePassword`
- `profiles.list`, `profiles.create`, `profiles.update`, `profiles.duplicate`, `profiles.remove`, `profiles.snapshot`, `profiles.launch`, `profiles.stop`, `profiles.focus`, `profiles.status`
- `revisions.list`, `revisions.restore`
- `superProfiles.*` (list, create, update, duplicate, remove, revisions list and restore, capabilities, and sessions launch, status, stop, save, finalizeSave, preview, discard)
- `passwordManager.detect`, `engines.list`
- `sync.configure`, `sync.push`, `sync.pull`, `sync.conflicts`, `sync.resolve`
- `settings.get`, `settings.update`

Two of these have **no GUI**: `vault.changePassword` and `engines.list`.

### Vault (encrypted store)

- Data: `system.status` returns `vaultExists` and `locked`. The renderer turns these into `exists` and `unlocked`.
- Screens:
  - Onboarding step 1: password field; "Create vault" or "Unlock vault"; "Join existing shared vault" (folder picker plus password).
  - The rail's "Lock vault" utility and the palette's "Lock vault" action.
  - The header connection pill (Connected / Locked / Backend unavailable).
- Every other destination shows "Unlock the vault before using this action" or disabled buttons while the vault is locked. There is no dedicated vault screen and no change-password UI.

### Onboarding (setup wizard)

- `workspace/Onboarding.tsx` has four steps, shown with "Setup progress n/4" and a progress bar:
  1. Create vault
  2. Create profile (embeds the create-profile form)
  3. Optional synchronization (choose folder, with Skip)
  4. Workspace ready
- Back, Next and Finish are provided. The current step resumes from `localStorage` (`setup`), and completion is stored in `setupComplete`.

### Profiles (managed browser profiles)

- Object `Profile`:
  - `id`, `name`
  - `engine` (chromium or firefox)
  - `automation` (off, selenium or puppeteer)
  - `identity` (key/value record), `createdAt`, `updatedAt`, `sync`
  - `passwordManager`: KeePassXC provider; source installed or WSL; database mode and path; extension; passkeys; WSL distribution
- **List** (`ProfileTable`):
  - Header: "Profiles" with count, "Saved locally in the encrypted vault", and a "Create profile" button.
  - Controls: search with regex builder, engine filter (All / Chromium / Firefox), Refresh.
  - Table columns: checkbox, Name (sortable), Engine (sortable), Runtime (badge; only known for the selected row, otherwise "Unavailable"), Saved preference (automation), Updated.
  - Bulk toolbar when rows are checked: Duplicate, Snapshot, Stop, Remove, Clear selection.
  - Empty states: "No profiles yet" and "No results".
- **Inspector** (`ProfileInspector`), which becomes a full-width view with "Back to profiles" below 1080 px. The heading shows an avatar letter, the name, the engine and the runtime state, plus a width slider (320 to 360 px). It has three tabs:
  - Overview:
    - fact list: ID, Engine, Updated, Created, Saved preference, Runtime, Effective mode, password-manager facts
    - "Remove password manager pairing"
    - action buttons: Launch, Focus, Stop, Duplicate, Snapshot, Edit name, Remove
    - collapsible "Profile identity" raw key/value list
  - Revisions: search, Refresh, a list of revision id and date with Restore (confirm dialog).
  - Automation: saved vs effective mode, "Restart required" notice, an automation select and "Save preference".
- An "Operation results" list appears after batch operations.
- Launch goes through the `ProfileLaunch` consent dialog, then `profiles.launch`.

### Super Profiles (reusable isolated environments)

- Object `SuperProfile`: `id`, `name`, `engine`, `revisionId`, `createdAt`, `updatedAt`, and `settings`. The settings hold:
  - backend: WSL 2 or Windows Sandbox
  - launch mode: terminal, browser or desktop
  - root filesystem path and SHA-256, workspace path
  - setup commands, startup commands, installers
  - guest password manager
  - networking, clipboard, memory in MB
  - per-backend configurations
- Related objects:
  - `SuperRevision`: id, parent, created, name, engine, settings, archive bytes.
  - `SuperSession`: id, backend, mode, state, phase, message, saved revision, save-confirmation flag, events timeline, and health (status, observed time, source, detail).
  - `SuperCapabilities`: WSL 2 and Windows Sandbox availability, modes and reason; stable identity is always false.
- **Screen** (`SuperProfiles.tsx`):
  - Header: "Reusable environments with explicit save-back revisions", with Refresh and "Create Super Profile".
  - A notice line.
  - A table with search: Name, Environment, Sessions, Updated.
  - Detail with tabs:
    - Overview: ID, Environment, Engine, Current revision; Launch, Edit template, Duplicate, Delete template.
    - Sessions: per-session state and mode, health, saved revision, phase, a collapsible "Session progress" event log, and "Save back and close", "Discard and close", "Review collected save".
    - Revisions: id, date, archive bytes, Restore.
  - A collapsible "Host capabilities" panel.
- **Wizard** (`SuperProfilesWizard.tsx`) has four steps:
  1. Template: name, environment, engine.
  2. Environment: launch mode, root filesystem archive and SHA-256, memory, network and clipboard switches.
  3. Startup and files: workspace folder, setup and startup commands, installers, guest KeePassXC pairing.
  4. Review.

  It can save progress, and a draft resumes after restart (paths and commands are excluded from the saved draft).

### Synchronization

- Data: the chosen sync folder path, and `conflicts[]` (each with a `profileId` and candidate `revisionIds[]`).
- Screen (`workspace/Synchronization.tsx`):
  - A folder strip: path, "Choose folder", "Upload changes" (`sync.push`), "Download changes" (`sync.pull`).
  - A conflicts section: Refresh, search, and a card per profile listing revision candidates, each with "Restore" (review dialog, then `sync.resolve`).
  - Empty states: "No conflicts" and "No results".

### Launch

- Profile launch: `ProfileLaunch` consent dialog, then `profiles.launch` with `requireStableIdentity: false`. The runtime state is read back via `profiles.status` (pid or state, effective automation mode).
- Super Profile launch: confirm dialog with "Use standard identity for this launch only", then `superProfiles.sessions.launch`.

### Storage (separate applications, not in the desktop renderer)

- `apps/storage`: a small Node service (`server/service.mjs`: `/api/pair`, `/api/session`, `/api/sessions`, `/api/stats`, `/api/logout`) with a web dashboard (`web/src/app.js`). The dashboard has these sections:
  - Overview: capacity at a glance, encrypted objects stored, encrypted revision objects, maximum chunk, service version, last successful refresh.
  - Connect and recover: endpoint, pair this browser.
  - Administration sessions: list and revoke.
  - Preferences: density, reduced motion, search with regex builder.
- `apps/hosting-wizard`: an Electron setup companion that runs these steps:
  1. Prepare your storage host (check Docker and Compose).
  2. Choose storage settings (host port, storage directory, pairing code, trusted LAN only).
  3. Review before starting.
  4. Pull the published image and start the container.
  5. Verify LAN health.
  6. "Open storage dashboard".
- The desktop renderer has **no storage destination**: there are no storage pairing, capacity or encrypted-storage screens inside the main application.

### Settings and history records

- Preferences record: `schemaVersion`, `preferences`, `schedules[]`, selected `section`, and undo/redo stacks.
- Notifications: `{id, kind, message, at, dismissed}`.
- Protected history revisions: action, label, date, changed settings, display name changes. These are protected by their own password or PIN.
- Personal wording: a JSON vocabulary in `localStorage` (`wording`).

---

## 3. Feature table

Status values for gui rows: wired, unwired, partial, missing, n/a. Non-gui rows are repository, build, release or site obligations and are not graded against the renderer. Feature ids that contain private shorthand are written as plain-English descriptions.

| id | category | status | where | gaps |
| --- | --- | --- | --- | --- |
| job document label (resume wording) | gui | n/a | none | Not a job-related application |
| language | gui | partial | `i18n.ts`, `settings/locale.mjs`, `workspace/locale.ts`, `SuperProfiles.locale.ts`; Settings > Language | Regex builder help text and some labels (Reset, replacement template, About heading) are hard-coded English; the bilingual compact-label treatment is not evident |
| funny-emoji | gui | partial | `settings/messages.mjs` `styledMessage`; settings `funnyEnglish`, `funnyCantonese`, `dialogEmoji`; `components.tsx` Modal | Levels style only status/toast messages, not all copy; no first-run disclosure |
| personal-vocabulary | gui | wired | `vocabulary.mjs`; Settings > Language "Personal wording" card | No distinct invalid-file state in the card (only a footer notice); no command-palette entry for the control |
| vocabulary-drop-apply | gui | partial | `main.tsx` window drop handler, `.celebration` in `style.css` | No success or invalid-drop sound; no reduced-motion variant specific to the celebration |
| school-mode | gui | missing | Listed as incomplete ("Shared restricted-presentation mode") in `SettingsWorkspace.tsx` | Entire feature |
| narration | gui | wired | `settings/effects.ts` `useNarrator`, `speech-queue.mjs`; Settings > Language | none notable |
| action-sound-effects | gui | wired | `settings/action-sounds.mjs`, `store.ts`; Settings > Notifications | Cues only on success/error outcomes |
| scheduled-settings | gui | partial | `settings/sections/Schedules.tsx` | Local source only; no HTTPS API or Home Assistant sources |
| display-name | gui | partial | `settings/useDisplayName.ts`, `ProtectedHistory.tsx` (save/reset), header in `Shell.tsx` | OS window title and About card still fixed to "Material Browser" |
| adhd-modes | gui | wired | Settings > Focus and time; `LiveTools.tsx` `AttentionStatus` | none notable |
| dim-sum | gui | missing | none | Entire feature |
| dim-sum-photo-source | gui | missing | none | No catalogue use or unavailable-image state |
| material-design | gui | partial | `components.tsx` (Material Web), `design-system/` | Native table, checkboxes, color and range inputs, details/summary and raw rail/tab buttons are not Material components; no per-surface component inventory |
| workflow-navigation | gui | partial | `workspace/Shell.tsx`, `electron/main.cjs` | OS default frame, no custom title bar or window controls |
| motion | gui | partial | `motion` setting, `effects.ts` | Only system/reduced choice; motion is not a schedulable or customizable value beyond reduce |
| appearance-editor | gui | missing | Listed as incomplete in Settings > Appearance | No per-element "Edit appearance" editor |
| color-picker | gui | partial | `SettingControl.tsx` color type (native `input type=color` plus text) | No continuous picker, colour-space translator, gamut or contrast display, or rainbow option |
| logo-customization | gui | partial | `logoPreset` setting, `Shell.tsx` brand mark | Presets only; no custom image upload, crop or conversion |
| overlay-panels | gui | partial | `ProfileInspector` width slider; `md-dialog` | Panels not resizable by edge or corner, not draggable; size persistence only for inspector width |
| collapse-filters | gui | partial | Settings "Search all settings" and tab finders in `<details>` | Profile, Super Profile and sync search/filter rows are not collapsible |
| accessibility-sizing | gui | wired | `LiveTools.tsx` `AccessibilityTools`, Settings > Accessibility, responsive CSS in `workspace.css` | Scale and layout matrix not proven |
| functional-ui | gui | partial | Honest empty states and "Incomplete capability" lists | Runtime column shows "Unavailable" for every unselected row; no recorded discard-unsaved-work history |
| onboarding-wizard | gui | wired | `workspace/Onboarding.tsx`, Setup rail utility | Profile step requires a profile (not skippable); resume via `localStorage` only |
| tabs | gui | partial | `main.tsx` workspace strip; `settings/SettingsTabs.tsx` (dock, pin, groups, bulk close) | Main workspace strip not persisted, not dockable, no pin or group; no single top-level tab model |
| regex-search | gui | partial | `Search.tsx`, `regex.worker.ts` (bounded ECMAScript builder on most search fields) | Far from full parity (no flavours, compare, benchmark, file search, history); dropdowns and selects have no builder; no parity ledger |
| command-palette | gui | partial | `main.tsx` palette modal, `workspace/model.mjs` `catalogDestinations` | Rows are plain buttons, not live controls; no articles; destinations open new tabs; teleport only for settings |
| context-menus | gui | partial | Only settings tabs (`SettingsTabs.tsx` `onContextMenu`, Shift+F10) | No context menu on table rows, cards, controls or the workspace tabs |
| menu-shortcuts | gui | missing | none | No shortcut display in menus |
| rich-controls | gui | partial | Settings cards use live controls | Palette rows, settings search results and table cells are plain text |
| guided-forms | gui | partial | Per-setting explanation plus practice in `SettingControl.tsx`; Super Profile wizard | Create-profile, sync, schedule and vault forms lack per-control guidance; no clear button on most text fields |
| info-icon-guidance | gui | partial | `md-icon-button` info on every `SettingControl` | No info buttons on controls outside settings cards |
| settings-explanations | gui | wired | `SettingControl.tsx` provenance line, default and help | Extra panels (schedules, history, editor) have no explanations |
| blank-editors | gui | missing | none | No presets for Super Profile templates or schedules |
| super-confirmation | gui | partial | `settings/ConfirmAction.tsx` (two switches, slider, Emergency exit) | Profile remove, stop and restore, Super Profile delete and discard, and sync resolve use a plain Confirm dialog |
| element-locks | gui | missing | Listed as incomplete in Privacy | Entire feature |
| support-tickets | gui | missing | none | Entire feature |
| unlock-ladder | gui | missing | none (the vault password is the only gate) | Entire feature |
| authenticator | gui | missing | Listed as incomplete in Privacy | Entire feature |
| qr-pairing | gui | missing | none | Entire feature |
| honest-monetization | gui | wired | No payment or promotional prompts anywhere | none |
| local-history | gui | partial | `ProtectedHistory.tsx`, `HistoryAccess.tsx`, `electron/services/history*.cjs`; profile revisions | Covers settings and display name only, not profiles or vault records; no pruning UI evident |
| exports | gui | partial | `HistoryTransfer.tsx` (JSON, JSON Lines, CSV), notification export, redacted history JSON | No export of profiles, Super Profiles or conflicts; no ZIP or 7z |
| bulk-actions | gui | partial | `ProfileTable` bulk toolbar; notification centre; protected history | No shift-click range selection in the profile table; no bulk on Super Profiles, revisions or conflicts; select-all scope wording missing |
| changelog | gui | missing | none | Entire feature |
| offline-docs | gui | missing | none (docs live in the separate `apps/docs` application) | No in-app documentation browser |
| rendered-provider-text | gui | missing | none | No shared Markdown renderer |
| notifications | gui | wired | `LiveTools.tsx` `Toasts`; `NotificationCenter.tsx` | Notification centre lives inside Settings only |
| file-converter | gui | missing | Listed as incomplete in Tools | Entire feature |
| minecraft-server-manager | gui | missing | Listed as incomplete ("Game server manager") | Entire feature |
| ollama-suite | gui | missing | Listed as incomplete ("Local model manager") | Entire feature |
| external-editor | gui | partial | `settings/sections/EditorIntegration.tsx`, `electron/services/editors.cjs` | Only opens exported preferences; no Insiders, portable or PATH detection; no custom editor or download offer |
| download-handoff | gui | n/a | none | No download capture in this product |
| forge-publishing | gui | n/a | none | Product does not publish repositories |
| progress-recovery | gui | partial | `operations` registry, footer busy dot, Super Profile session events | No in-dialog progress for vault, sync or launch; no on-the-spot recovery |
| completeness-parity | non-gui | n/a | `docs/evidence/desktop/inventory.json` | Repository record |
| front-provenance | gui | partial | `Shell.tsx` header version | Updated-at always "Unavailable"; About card hard-codes 0.1.0 while the package is 0.1.1 |
| product-evidence | non-gui | n/a | `docs/evidence/desktop/*` | none |
| screen-recording | non-gui | n/a | none | none |
| design-reference-parity | non-gui | n/a | `design/desktop/REFERENCE.md` | none |
| design-folder | non-gui | n/a | `design/` | none |
| clipping matrix for every built surface | non-gui | n/a | none | none |
| public screenshot gallery | non-gui | n/a | linked from `README.md` | none |
| landing-site | non-gui | n/a | `apps/docs` | none |
| mobile-friendly site | non-gui | n/a | `apps/docs` | none |
| installer-download-button | non-gui | n/a | none | none |
| feature-articles | non-gui | n/a | `docs/features/*` | none |
| vendored-fonts | non-gui | n/a | Fontsource packages in `apps/desktop/package.json` | none |
| shared-link-embed | non-gui | n/a | none | none |
| homepage-link | non-gui | n/a | none | none |
| vocabulary-unlock-boundary | gui | wired | Shipped copy is plain; private wording only from a local file | none |
| private site delivered as a packaged desktop application | non-gui | n/a | `apps/docs`, `apps/docs-companion` | none |
| status-hub | gui | missing | Listed as incomplete ("Status service") | No status surface |
| discord-status-bridge | non-gui | n/a | Status Hub only | none |
| panic-webhooks | non-gui | n/a | Status Hub only | none |
| tidbyt-displays | non-gui | n/a | Status Hub only | none |
| build-entrypoints | non-gui | n/a | `build.bat`, `build-installer.bat` | none |
| fresh-build-run-command | non-gui | n/a | `host.bat` | none |
| dependency-fetcher | non-gui | n/a | none | none |
| bundled-dependencies | non-gui | n/a | packaging | none |
| squirrel-installer | non-gui | n/a | `forge.config.cjs` (maker-squirrel), `electron/squirrel-events.cjs` | none |
| self-signing | non-gui | n/a | none | none |
| auto-updates | gui | missing | Listed as incomplete in Tools | No update check, banner or "Check for updates" |
| app-icon | non-gui | n/a | `apps/desktop/assets/material-browser.ico/.png/.svg` | none |
| release-workflow | non-gui | n/a | none | none |
| release-timing | non-gui | n/a | none | none |
| release-line-counts | non-gui | n/a | none | none |
| release-dim-sum-photo | non-gui | n/a | none | none |
| dim-sum-code-names | gui | missing | none | No code name next to the version in the header or About |
| ci-bootstrap | non-gui | n/a | none | none |
| runner-selection | non-gui | n/a | none | none |
| encrypted-public-builder | non-gui | n/a | none | none |
| tabbed-readme | non-gui | n/a | `README.md` | none |
| human-time-estimate | non-gui | n/a | none | none |
| sanitized-instruction-copy | non-gui | n/a | none | none |
| agents-md-vocabulary-block | non-gui | n/a | `AGENTS.md` | none |
| vocabulary-hash-lock | non-gui | n/a | none | none |
| roadmap-checklist | non-gui | n/a | `ROADMAP.md` | none |
| feature-docs | non-gui | n/a | `docs/features/` | none |
| postman-collections | non-gui | n/a | none | none |
| wiki and site sync | non-gui | n/a | `wiki/` | none |
| handoff-record | non-gui | n/a | `HANDOFF.md` | none |
| closeout-prompt | non-gui | n/a | `CLOSEOUT_PROMPT.md` | none |
| discussion-records | non-gui | n/a | none | none |
| project-board | non-gui | n/a | none | none |
| operational-skill | non-gui | n/a | none | none |
| readme-prompt-banner | non-gui | n/a | canonical instructions repository only | none |
| single-file editions of the canonical instructions | non-gui | n/a | canonical instructions repository only | none |
| project-profile | non-gui | n/a | canonical instructions repository only | none |
| roblox-model-catalogue | non-gui | n/a | games only | none |
| roblox-visual-realism | non-gui | n/a | games only | none |

### Counts

- 111 ids in total: 60 gui and 51 non-gui.
- Gui by status: 10 wired, 0 unwired, 27 partial, 20 missing, 3 n/a.
- No feature-level code was found that exists but cannot be reached. Two smaller gaps of that kind: the native `vault.changePassword` and `engines.list` methods are allowed by IPC but have no GUI, and the workspace tab strip only appears after a command-catalogue pick.
