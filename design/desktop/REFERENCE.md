# Desktop workspace design reference

Design revision: WorldLens adaptation, 2026-10-24. This supersedes the previous wide text rail and surface geometry in this file. Behavioral requirements in `settings-handoff.md` remain authoritative. This is a design contract, not runtime evidence. Independent design review completed using gpt-6-astra: APPROVED for implementation, with no blocking findings. This approval does not verify production behavior.

## Provenance and precedence

Target source: Material Browser `0b68532159e3e821f44cbc1549ffa170806d8b94`. Reference source: WorldLens `aaf1063e1ad7826591fa4dd6f504d086451e645b`. `reference-manifest.json` binds individual files with SHA-256. Paths in that manifest are repository-relative, never runtime deployment paths. WorldLens source is read-only. Its framework-neutral colors and CSS tokens are the visual authority; its Vue components illustrate anatomy only. The target stays Electron, React 19, TypeScript and Material Web.

## Reference identification

| ID | WorldLens path | Use and limits |
| --- | --- | --- |
| REF-COLOR | design/packages/design-system/src/colors.ts | Exact dark, light and contrast color roles; do not regenerate from a seed |
| REF-TOKENS | design/packages/design-system/src/tokens.css | Shape, typography, state opacity, motion and elevation |
| REF-THEME | design/packages/design-system/src/theme.ts | Component defaults; do not import its Vue/Vuetify factory into React |
| REF-DOC | docs/design-system.md | Token semantics and override hierarchy |
| REF-RAIL | design/packages/ui/src/components/shell/AppRail.vue | 80 px rail, icon pill with label below, footer utilities; 192 px short-height grid reference |
| REF-WORK | design/packages/ui/src/components/shell/WorkPane.vue | Existing controllers hosted in a tabbed work plane |
| REF-DARK | docs/screenshots/theme-dark.png and .caption.txt | Visually inspected historical reference: dark flat rail, blue selected pill and compact upper chrome. Map and rendering counts are WorldLens-only content |
| REF-NARROW | docs/screenshots/shell-800x600-narrow.png and .caption.txt | Identified historical narrow reference, not independently inspected during this design pass |
| REF-SCALE | docs/screenshots/settings-1280-scale200.png and .caption.txt | Identified historical settings reference. Caption describes deviceScaleFactor 2, which is pixel density, not proof of 200% interface zoom |

Reference screenshots are not Material Browser evidence and their original capture provenance is not replaced by the reference checkout revision. No new production screenshot is claimed. Prefer the current source when historical images disagree with it. Do not copy map imagery, WorldLens branding or synthetic content into this product.

## Visual decision

Use a quiet, dense desktop workspace: compact header, narrow rail, continuous work plane, real table and an optional inspector. No welcome dashboard, metric tiles, invented profiles or placeholder counts. Hierarchy comes from type, tonal surfaces and dividers, with a filled primary action for the active workflow. Use 16 px outer spacing, 12 px section gaps and 8 px control gaps. Flat major planes have no floating-card shadow; use 16 px corners only for actual contained sections. Dialogs and menus use 28 px; fields 12 px; buttons and status chips use pills.

Dark baseline: background #0B0E11, surface #101418, container #1D2024, elevated container #272A2E, primary #8FCDFF, primary container #004B73, text #E1E2E8, secondary text #C2C7CF, outline variant #42474E. Light primary #00639B, background #F7F9FF and surface #F1F4FA. Import or transcribe every color role from REF-COLOR, including contrast; these abbreviated examples are not a complete palette. Preserve user accents and saved appearance overrides through the existing precedence model. High contrast always overrides custom accent colors while retaining the saved accent for other themes. Fresh installations select dark only when there is no valid saved theme; explicit light, system or contrast choices survive migration.

Bundle Roboto for interface text and Roboto Mono for IDs, hashes, paths and commands, with local CJK/system fallbacks. Use the source type ramps: heading 22/28, section title 16/24, body 14/20, supporting label 12/16 CSS px at 100%, expressed in rem. Do not reset the root size to defeat user scaling. Prose measure is at most 68ch; table cells and literal values are exempt.

## Composition and intentional deviations

Normal client area is 1280×800, minimum is 760×580. Header minimum height is 56 px and grows for wrapping. Retain the real name, version, connection state and catalog action. The icon rail is 80 px wide with a 56×32 px selected icon pill, 44 px minimum action targets, wrapping labels and accessible full names. Destinations are Profiles, Super Profiles, Synchronization and Settings. Use localized short visible labels for long names, including “Sync”, with the full destination in accessible names and tooltips. Setup and Lock vault stay discoverable utilities. Settings remains a real destination, unlike WorldLens's overlay. No inaccessible icon-only shortcuts are introduced.

The existing open-work tab strip remains above the workspace and uses the same destination activation/close callbacks. This is the WorkPane analogy; it does not authorize inventing a replacement tab persistence model. Existing settings docking, groups, pins and searches remain intact.

At effective content width below 1080 px, selecting a profile or template shows a full-width inspector with an explicit Back action instead of squeezed columns. At effective viewport width below 900 px, or effective height below 480 px, collapse the primary rail to a labelled Workspace disclosure with the same destinations and utility actions. A short window wide enough for the rail may instead scroll the rail independently, retaining reachable utilities. This deliberately avoids WorldLens's 192 px short-height grid: a profile table needs its horizontal space. The disclosure is a desktop zoom/reflow adaptation, not a new mobile product. At 200% zoom on the minimum window, every action remains reachable through wrapping and scrolling, without insisting on the unzoomed two-column layout.

Inspector normal width is 336 px, adjustable within existing supported bounds and ignored in narrow mode. Table rows have a 48 px minimum height and grow for bilingual text. Keep semantic table headers, visible selection checkboxes and a dedicated local horizontal scroll area when columns cannot fit. Never make the entire window horizontally scroll merely to preserve the table. Do not hide engine, runtime or automation facts without an equivalent inspector field.

## Accessibility and interaction

Use registered Material Web components, semantic native tables and labelled native inputs. Selected navigation has aria-current; tabs preserve tablist/tab/tabpanel relations and actual keyboard axis. Scope shell selectors so settings tabs and modal actions cannot inherit rail styling. Maintain unique inspector IDs because inactive workspaces remain mounted. Focus returns to the invoking control after a modal or disclosure closes; narrow Back returns to the selected row. Move focus to the inspector heading on explicit detail activation. Escape closes only the topmost dismissible surface and never cancels a running host operation implicitly.

Text meets WCAG AA, controls and focus indicators meet non-text contrast. Contrast mode uses explicit outlines and meaningful text, not only blue fill or low-opacity state layers. Respect forced colors. Keep 44 px minimum targets, visible keyboard focus, narration opt-in, non-sensitive live status and reduced-motion overrides. Transitions use token durations, normally 100–200 ms, and become effectively immediate for reduced motion. Bilingual labels may wrap; never split English words into individual letters. Paths may wrap anywhere in detail views but remain copyable and exact.

Every async action shows its actual pending/result state. No success before host acknowledgment. Native idle leases, operation reservations, identity consent, capability disclosure, save-back preview, protected settings and access epochs are unchanged. See `worldlens-handoff.md` for implementation destinations and `STATES.md` for coverage.
