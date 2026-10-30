# Remote design desktop remake

The sole active visual authority is the current remote `design/` folder, reconciled at design commit `0ab6165fd3c5f59f23ce7e586f0979bd0f501fc8`. The original ZIP and its earlier layout are obsolete historical material, never the implementation authority. These references describe intended appearance, not runtime evidence. Subsequent design updates must be reconciled before visual acceptance.

## Working surfaces

| Reference | Renderer implementation | Behavior retained |
| --- | --- | --- |
| Main | Compact header, 96-pixel navigation rail, left workspace dock, profile segmented lists, inspector | Actual profile IDs, search, selection, bulk actions, launch review, runtime detail, revisions and automation preferences |
| Launch | Engine and automation summary, prominent consent review, next-step explanation | Standard-identity consent, explicit launch only, operation reservation and vault checks |
| SuperProfiles | Template segmented lists, session and revision inspector | Existing environment discovery, expected revision checks, save-back preview, session stop and recovery |
| Sync | Storage and computer cards, revision candidate cards | Separate upload/download, actual folder selection, conflict revision confirmation |
| Settings | Persistent section tabs, visible global search, grouped setting rows | Every existing definition, native persistence, schedules, local history, wording, reset and accessibility controls |
| Vault | Four-step progress indicators, vault panel and setup actions | Empty password handling, creation/unlock/join, saved setup progress, Back/Next and optional sync skipping |
| Palette | Persistent header search, explicit destination catalogue, notification dialog | Existing destinations and settings reveal, independent search, notification history and supported undo |
| Safety | Two-key and slider confirmation on profile removal | Explicit affected profile names, operation registry, genuine result handling and emergency exit |

Workspace destinations are restored by matching stored identifiers to the current catalogue. Stored labels or arbitrary page metadata are never executed. Pinning and grouping remain local. Opening rail destinations does not create new tabs.

## Theme and platform integration

`src/design-system/reference-colors.mjs` owns the current teal and blue-tertiary light/dark roles. `material-browser.css` provides initial dark paint and local component typography. Existing explicit saved accents and theme choices retain priority; contrast remains a distinct accessible scheme. Historical vendored reference files are retained and are no longer the tonal appearance authority. Fonts and icons remain locally bundled; no remote font or design support script is loaded.

The frameless native shell exposes only minimize, maximize, restore and close. Each request is checked against the existing trusted main-frame sender and exact action allowlist. Native lifecycle and security preferences remain intact. The renderer receives actual maximized-state events and shows a truthful message if an action is unavailable.

## Explicit limits

The artboards contain illustrative records and unavailable capabilities. No sample profile, device, revision, connection, timestamp or running state is shipped as live data. Profile list items show unavailable runtime until the current inspector has actually fetched that profile. The engine is chosen at profile creation, not silently changed at launch. Automation remains editable through the real inspector preference controller.

Server enrollment, unified sync, keep-both conflict resolution, stable identity, element locks, unlock ladder, support tickets, complete advanced appearance and full regex parity remain incomplete. Existing unavailable explanations remain visible. The palette has real destination and settings navigation; it does not claim every rich inline setting editor from the reference.

## Verification state

Source compilation and focused regression results are recorded by the task handoff. Genuine built interaction, native control drive, restart persistence and the full language/theme/scale layout matrix remain unverified until captured from the built application. Historical `design/current-screens` images used a stub bridge and do not prove this implementation.

Registered Material Web checkboxes, radio controls, sliders, progress indicators and filter chips replace visible native form widgets. File and color selection use a Material button opening the platform picker; its native input is hidden. Expandable secondary content uses an accessible Material-button composition rather than native disclosure widgets.
