# Material 3 Expressive desktop

The desktop renderer follows the eight artboards in the repository's `design/` folder (Main, Launch, SuperProfiles, Sync, Settings, Vault, Palette and Safety). The design's own stylesheet, `design/m3.css`, is vendored as `apps/desktop/src/design-system/m3.css`, so the running application uses the same component anatomy as the artboards: the custom title bar, the 96 dp navigation rail with a contextual FAB, rounded panes on a surface-container window, segmented lists, connected button groups, the expressive slider, switches with a handle icon, split buttons, the vibrant floating toolbar, segmented menus and dialogs with a hero icon.

Colour roles come from `design-system/m3-theme.css`, which maps every role used by the artboards onto the resolved presentation theme. Saved theme, accent and high-contrast choices therefore keep working. Fonts and Material Symbols Rounded are bundled locally; nothing is fetched from a CDN.

## Destinations

| Artboard | Renderer | Behaviour |
| --- | --- | --- |
| Main | `app/Profiles.tsx`, `app/Shell.tsx` | Vertical tab pane with pinned home, a Running group of live browsers and utility tabs; profile list with shaped avatars, run state, split Launch buttons, shift-click range selection, Ctrl+A and Escape; vibrant floating toolbar; context menu (right-click, Shift+F10 or the overflow button) with Enter, F2, Ctrl+D and Delete shortcuts; import and export of profile settings; inspector with Overview, Identity and Revisions |
| Launch | `app/Launch.tsx` | Engine radio list (the engine is fixed at creation, so the other engine is shown but not selectable), automation button group that is saved before launch, a review card whose items must all be confirmed, What happens and Running now with Stop |
| SuperProfiles | `app/SuperProfiles.tsx`, `app/TemplateWizard.tsx` | Template list, Overview, Session card with the loading indicator, save-back preview, split Save button with category choice, discard through the two-key confirmation, revision history with restore, host capabilities and a four-step template wizard |
| Sync | `app/Sync.tsx` | Storage card with wavy progress during push and pull, this computer with automatic sync every 10 minutes, the real sync folder from `sync.status`, join instructions and the conflict pane with a radio list of candidate revisions |
| Settings | `app/Settings.tsx`, `settings/SettingControl.tsx` | Navigation drawer with search and the regex builder, two-column grouped segmented lists, info and reset per row, section reset through the two-key confirmation |
| Vault | `app/Vault.tsx` | Create or unlock with a passphrase field that reports Caps Lock, join from another computer, and the four-step first run with linear progress |
| Palette | `app/Palette.tsx`, `app/Live.tsx` | Command palette with live rows (switches for on/off settings, Launch, Stop and Unlock actions), filter chips, regex builder, remembered card or full-window size; notification panel; snackbar with Undo; the dim sum surprise |
| Safety | `settings/ConfirmAction.tsx`, `app/Safety.tsx` | Two-key super confirmation with Emergency exit, the lock wizard with all six credential mixes, the unlock ladder and Support Tickets |

The window size classes from the design are honoured: below 1180 px the tab pane hides, below 860 px one pane shows at a time with a back button, and below 600 px the rail becomes a bottom navigation bar.

## New features carried by the design

- [Element locks, unlock ladder and Support Tickets](element-locks.md)
- School mode: plain wording, no emoji and no dim sum surprises, kept per computer and optionally protected by a section lock.
- Passwords and passkeys: defaults offered to new profiles for KeePassXC pairing.
- Per-profile appearance: avatar shape and colour, saved on this computer.
- Release code names: each version shows a dim sum code name in About.
- Synchronization status: the core's `sync.status` reports whether a folder is configured, its path and the number of conflicts, so the screen shows real data instead of placeholders.

## Placeholders from the artboards

The artboards use bracketed placeholders and sample records. In the application they come from real data: the version and source date in the title bar, the profile creation date, the sync folder and join date, and the device's running browsers. The dim sum surprise has no bundled photograph and says so.

## Limits

- Native preference storage depends on a Windows-only lock. On other platforms Settings reports that storage needs attention; section navigation still works but changes are not saved.
- Stable browser identity, keep-both conflict resolution, a server-backed sync connection and QR pairing remain unavailable; the screens say so rather than imitating them.
- Showing a running browser's window (`profiles.focus`) is not implemented by the native host; the button reports that plainly.

[Runtime captures, method and hashes](../../evidence/desktop/m3-redesign/README.md).
