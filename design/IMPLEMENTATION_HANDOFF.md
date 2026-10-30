# Material Browser GUI remake: design handoff

Source design for the full desktop renderer remake of `Ding-Ding-Projects/material-browser` (`apps/desktop`). Frontend design only; no renderer behaviour was changed.

## Location

In the repository these files live directly in `design/`: the artboards, `canvas.json`, the shared `m3.css` and `theme.css`, `audit.md` and `current-screens/`. The same canvas is also hosted as a private design project.

## Pure Material 3 Expressive

Every surface uses Material 3 component anatomy only. There are no native selects, range inputs, checkboxes, tables or disclosure widgets, and no custom widgets outside the Material catalogue. Implement each with the matching registered `@material/web` component where one exists, and follow the Material 3 Expressive specification where the library has not caught up yet.

| Surface need | Material 3 component used |
| --- | --- |
| Window chrome | Custom title bar with a search bar, icon buttons and window controls |
| Destinations | Navigation rail (Expressive, collapsed 96 dp) with menu button, FAB, active indicator and badges |
| Layout | Canonical list-detail and supporting-pane layouts: rounded panes on a surface-container window |
| Tabs (left-docked) | Navigation drawer items as a vertical tab list, with group headers |
| Records | Expressive segmented lists, one- to three-line items with leading icons or shaped avatars |
| Choices of two to four | Connected button groups (replacing segmented buttons) |
| Choice lists | Radio list items |
| On/off | Switches with handle icon |
| Ranges | Expressive slider: 16 dp track, bar handle, gaps and stop indicators |
| Pickers | Outlined exposed dropdown text fields |
| Text entry | Outlined and filled text fields with supporting text |
| Filters | Filter chips, plus assist chips for quick actions |
| Primary actions | Filled, tonal, outlined and text buttons (Expressive sizes with shape morph on press), split buttons, FAB |
| Bulk actions | Floating toolbar (vibrant) |
| Progress | Wavy linear progress, linear progress with stop indicator, loading indicator |
| Section switching | Primary tabs |
| Context actions | Expressive vertical menu with segmented groups, a filter field and shortcuts |
| Confirmations and wizards | Dialogs with hero icon |
| Transient feedback | Snackbar, badges, elevated card for the dim sum surprise |

## Artboards

Each `.dc.html` artboard links `theme.css` and `m3.css` and has a `dark` toggle in its script props. Layouts adapt to the expanded, medium and compact window size classes. In the compact class the rail becomes a navigation bar and secondary panes hide.

- `Main.dc.html`: Profiles home.
  - Title bar with version and updated-at provenance, Ctrl+Shift+F search with regex builder, vault assist chip, notifications badge, accessibility tools and window controls.
  - Navigation rail with FAB, plus a left-docked vertical tab list with pinned tab, groups and lock state.
  - Profile list with checkboxes, shaped avatars, run state and a split Launch button, plus a vibrant floating toolbar for the selection.
  - Inspector pane with primary tabs and a detail list.
- `Launch.dc.html`: engine radio list, automation button group, review card with checkboxes, what-happens list and running list.
- `SuperProfiles.dc.html`: template list, session card with loading indicator and save-back change list, split save button and revision history.
- `Sync.dc.html`: storage card with wavy progress, this-computer card with switch, server detail list and conflict radio list.
- `Settings.dc.html`: navigation drawer sections with search and regex, and segmented setting lists.
  - Language mode button group, funny-level Expressive sliders, emoji switch, application name.
  - Narrator, voice dropdowns and action sounds.
  - KeePassXC, database, extension and passkeys.
  - The five focus modes.
- `Vault.dc.html`: unlock pane with passphrase field; four-step first run with linear progress, Back, Skip and Next.
- `Palette.dc.html`: command palette search view with regex builder chips, filter chips and live rows; segmented context menu with filter and shortcuts; notification list; dim sum surprise card; snackbar.
- `Safety.dc.html`: dialogs for the two-key super confirmation with Emergency exit, the lock wizard with all six credential mixes, the unlock ladder (sums rung), and Support Tickets with the plain disclosure line.

## Design tokens

`theme.css` holds the full Material 3 colour role set generated from a teal seed, for light and dark: primary `#006A6A`, secondary `#4A6363`, tertiary `#4B607C`, error `#BA1A1A`, and the five surface-container tones. `m3.css` holds the following:

- **Type scale:** the full Material 3 scale with emphasized weights, in Roboto Flex with Noto Sans HK for Cantonese.
- **Shapes:** corner radii 4, 8, 12, 16, 20, 28 and full, plus the Expressive cookie and sunny shapes for avatars.
- **Elevation:** levels 1 to 3.
- **State layers:** an 8% hover and 10% press overlay.
- **Motion:** shape morph on press, with a reduced-motion path.

Icons are Material Symbols Rounded. The app must vendor them locally; it uses no icon CDN.

## Implementation notes

- Placeholders in brackets (`[UPDATED-AT]`, `[DATE]`, `[DEVICE NAME]`, `[YOUR SERVER ADDRESS]`, `[PHOTO]`) must come from real data.
- Sample profile names, revisions and counts are illustrative only; never ship invented records.
- `audit.md` maps every required feature to the current renderer and is the wiring backlog.
- `current-screens/` holds before screenshots, taken with a stub native bridge.
