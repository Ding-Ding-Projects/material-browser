# Desktop settings implementation handoff

Source baseline: `193861b`. This is a design and implementation specification, not runtime evidence.

## Problem and outcome

The desktop currently exposes only language, theme, density, accent and personal wording. Replace that narrow surface with a working settings workspace organized around tasks, with complete requirement accounting and truthful unavailable capabilities. Keep the profile workspace intact. Existing vault and profile APIs retain their semantics.

## Destinations

Settings contains persistent section tabs: Language and voice; Appearance; Accessibility; Focus and time; Notifications; Schedules; History and transfer; Privacy and access; Tools and integrations; About and coverage. The section strip uses the existing Material tab primitive, scrollable overflow, named panels and keyboard navigation. A persisted selected section returns on reopening. Normal navigation never creates a new top-level workspace tab.

Every section has its own plain-text-first search with adjacent independent regex access. A global settings finder searches labels, explanations and current values across categories and identifies the destination before focusing the exact control. The existing regex engine is bounded ECMAScript; full multi-engine construction/debugging parity is an explicit unfinished requirement, not implied by access to the current builder.

## Control anatomy

Every editable control is described by a stable neutral ID, label, unique purpose, options, actual default, bounds, persistence, live consumer, privacy category and documentation concept. Directly above it is a local Material info icon with a 44-pixel target. The optional non-modal explanation shows the actual default and whether the current value comes from the local saved record. Guidance examples have separate synthetic state and never apply themselves to production. Reset uses the same mutation path as direct editing. Invalid edits retain the last valid value and a localized inline reason.

Use Material switches for booleans, sliders with exact numeric alternatives for bounded numbers, searchable selectors for enumerations, text fields with clear actions for actual text, and dedicated forms for schedules and exports. Do not render an apparently editable control without a live consumer.

## First functional implementation slice

1. Versioned local preference store with strict validation, migration from the existing appearance record, atomic single-record writes, provenance and explicit storage-error feedback. Public exports include only allowlisted preferences. No personal wording, imported logo bytes, credentials, account paths or vault contents enter exports or history.
2. Independent English/Cantonese style levels 1–5 and dialog-emoji choice. Both style levels default to 5 and change rendered status/help copy while preserving factual payloads. Original labels and exact technical values remain literal.
3. Narrator opt-in, language choice, separate real platform voice lists, stable voice identities, rate/pitch, queued narration, stop/pause/resume and user-initiated sample. Missing/late/network-backed voices have explicit status. Screen-reader cooperation is explicit, and no secret input is spoken.
4. Appearance theme/density/accent, font family/scale/weight, motion choice and presets, applied immediately. A full per-element layered editor remains incomplete until its separate capability matrix and renderer consumers exist.
5. Accessibility text scale, contrast, stronger focus, target size, reduced motion and persistent visible entry. Hide requires explicit confirmation with Cancel initially focused; restoration remains reachable in Settings. Read-aloud only covers explicit non-sensitive application messages.
6. Five independent focus accommodations: dim inactive navigation, reduced stimulation, elapsed session time, one persisted user-written next action, and dismissible idle reminder with a persisted snooze interval. They start off and never make clinical claims.
7. Non-blocking messages and a searchable notification centre with unread/dismiss state, selection, bulk dismissal and export. Warning/error retention stays explicit. Quiet-hours preferences affect noncritical narration and notifications only.
8. Real local schedules over supported preferences with dates, time window and weekdays. Local timezone and DST semantics are stated. Equal endpoints mean all day; overnight rules belong to the starting day; higher priority then later order wins. Base settings stay separate. External API and Home Assistant sources cannot pretend to work without a validated privileged network/credential adapter.
9. Append-only local settings revisions, undo/redo as new events, action/date/text filters and restore preview. This browser-storage history is an interim scope, not a claim of the required protected native Git history. Sensitive naming/credential mutations remain unavailable until that native history contract exists.
10. Validated JSON preference import, JSON/JSONL/CSV/TSV/Markdown exports with schema, UTF-8/LF and explicit omission statements. Unknown/unsupported fields are rejected before mutation. Full archive and other format coverage remains inventoried.

## Privileged capability boundaries

Do not implement a fake universal shared mode with localStorage or substitute browser storage for OS credential storage. Shared mode, six-policy element locks, authenticator/QR secret handling, protected Git history, external schedule authentication, server management, model installation, file conversion adapters and update feeds need real privileged services and independently verified behavior. Their Settings destinations name the exact missing service and next action. A missing backend row is unfinished, not implemented by displaying its explanation.

## Module ownership

- `src/settings/model.mjs`: neutral definitions, defaults, validation, migration, schedule resolution and export projection.
- `src/settings/store.ts`: React state and persistence transaction boundary, history and notifications.
- `src/settings/SettingsWorkspace.tsx`: category navigation and shared settings finder.
- `src/settings/SettingControl.tsx`: genuine controls, provenance, reset and contextual guidance.
- `src/settings/sections/`: schedule, narration, history/transfer and capability workflows.
- `src/settings/effects.ts`: bounded live appearance, narration and attention consumers.
- `src/settings/messages.ts`: localized factual messages and style variants.
- `main.tsx`: product orchestration only; extract the old settings block and shared preference effects, retaining vault/profile behavior.

## Screens and verification tuples

Addressable state IDs: `settings-language`, `settings-appearance`, `settings-accessibility`, `settings-focus`, `settings-notifications`, `settings-schedules-empty`, `settings-schedules-active`, `settings-history`, `settings-import-invalid`, `settings-capabilities`, `settings-help`.

Normal client viewport: 1280×1000. Minimum supported client viewport: 760×580. Verify English, Cantonese and bilingual; light/dark; 100/125/150/200% scale. Use the genuine rebuilt package, fresh isolated data, exact source/build hashes and retained original captures. Do not upgrade one representative state into the full matrix verdict. Navigation, control editing, reload persistence, reset, undo, import refusal and schedule boundaries need actual interactions.

## Independent review

Pending independent review before broad UI implementation. The neutral acceptance ledger records current baseline gaps and will be updated only with actual implementation and evidence. No baseline row is complete merely because a control appears in this design.

## Revision 2: complete Settings navigation contract

The first local-behavior slice is not comprehensive Settings completion. Every unfinished requirement below retains its own acceptance row and implementation owner. No category heading, explanation or disabled control closes a missing implementation.

The Settings section strip must support all four dock edges, left by default, axis-correct roving focus and overflow. It persists order, pinned order, groups, group order, member order and collapsed state. Context actions include activate, pin/unpin, move earlier/later, create/rename/collapse a group, Move into group through a searchable picker, close others, and text/inverse-text close with a preview that excludes pinned and locked tabs by default. Closing a Settings utility tab does not delete its settings. An explicit New tab catalogue reopens destinations; merely navigating a menu does not create a workspace tab. Group appearance and every tab's per-element appearance/lock actions remain part of the complete editor/lock contracts, not waived by the local tab implementation.

Four independent discovery scopes are mandatory: current Settings strip, members of one selected group, group names, and all owned open tabs. Each has its own local search state and adjacent full regex builder. Results identify the strip, group, pinned state and destination. Reveal inside a collapsed group does not rewrite its saved collapsed preference. Move-into-group uses a picker, never a dynamic submenu list. Directional keyboard actions follow the actual edge, without rotating labels.

## Revision 2: per-control and per-search ledgers

`docs/features/desktop/settings-controls.json` is the explicit baseline of concrete preference controls. Each entry records its ID, unique purpose, default, type, bounds/options, local persistence key, migration, validation, planned or actual consumer, guide/example/playground bindings, clear/reset routes, localization, tests and evidence. A descriptor with no consumer remains planned, never implemented. Additional workflow controls are inventoried separately in the same document, including schedule creation/edit/delete, notification selection/dismissal/export, history date/action/text filters/restore, preference import/export/reset, voice playback and accessibility hide/restore.

`docs/features/desktop/settings-search-surfaces.json` explicitly lists the root finder, each section, each selectable-setting picker, notification list, schedule list and setting picker, history list/action picker, format picker, help content, capability lists, New tab catalogue, tab/group searches and tab context menus. Every entry names its exact data scope, isolated state owner and adjacent builder binding. The existing bounded ECMAScript builder is an unfinished baseline: construction, flavor/version conversion, tracing, benchmarking, code templates, collections, safe file GREP and complete integration still require their exact engines/adapters and acceptance. A shared shortcut to one global builder never satisfies per-field isolation.

Per-control help is target-bound, with one info icon directly above the control, exact default/source, effect, valid values, recovery and a separate sample value. Opening or resetting a playground never writes production preferences or history. Each help session destroys sample drafts on close. Helper controls do not recursively spawn further playgrounds. Every editable text field, including filters, gets a labeled clear action using its normal mutation/validation path.

## Revision 2: remaining implementation ownership

Desktop implementation owns local preferences, effects, categories, tab management, independent search bindings, help/playgrounds, notifications, local schedules, portable preferences and bounded non-sensitive history. Desktop privileged modules must own OS credential integration, protected Git history and shared presentation mode before those flows can be accepted; they must not be implemented as ordinary browser storage. The complete appearance editor and full regex parity are separate substantial desktop subsystems, with concrete capability matrices and executable acceptance. Universal server/model/conversion managers need real process, network, package and adapter services; the current native host does not expose those services. Their exact incomplete obligations remain visible in acceptance and are not closed by the Tools category.

The owning coordinator must explicitly assign privileged services and deep-editor subsystem lanes or retain them as unfinished. This handoff does not authorize edits to another lane's core, host or build routing files. No requirement is silently dropped because it is larger than the first local slice.

## Revision 3: source provenance, capability interfaces and acceptance states

Preference storage keeps `writtenKeys` independently from its merged default values. A newly added key remains compiled-default provenance until an explicit user mutation writes it. Migration marks only validated legacy keys as written. Every scheduled control shows both its saved base value and temporary effective value, with the responsible stable rule ID and source. Import preview lists changed keys and omissions before application. Corrupt/unsupported records are preserved unchanged, defaults are explicit, and write rejection leaves a visible unsaved state. Cross-window writes require native serialization for complete acceptance; browser-storage interim behavior never claims conflict-safe shared persistence.

Message styling reaches every rendered message category: success, progress, validation, warning, operation failure, destructive confirmation, security, accessibility, informational help and empty states. The message record separates stable factual fields from style framing. Each category is verified at levels 1–5 in English/Cantonese/bilingual, retaining identical actions, targets, counts, limits and recovery. Accessible control names remain plain and do not inherit decorative emoji. Any still-unlocalized or unstyled legacy message remains an explicit gap.

Service interfaces are assignable and allowlisted. Proposed renderer requests use opaque IDs and bounded typed payloads; privileged objects never accept shell text, caller-supplied trust flags or arbitrary renderer file paths:

| Capability | Owner and interface | Required result and unfinished boundary |
| --- | --- | --- |
| Fonts | Desktop `electron/services/fonts.cjs`, `listInstalledFonts()` | Actual stable IDs/family/style from installed fonts; fallback and unavailable result are explicit. Renderer retains its own search, previews and CJK fallback. |
| External editors | Desktop `electron/services/editors.cjs`, discover/open | Discovery returns approved editor IDs. Main supplies trusted export-root/file-ID mapping and selected executable. No executable path enters exports, history or captures. |
| Protected history | Dedicated desktop native service, append/list/diff/restore/label/export | Isolated app-data Git repository, per-mutation commit, protected access and encrypted/redacted snapshots. Missing runtime/key/protection is unfinished. |
| Shared restricted mode | Dedicated desktop native service, read/watch/update/verify | Shared local record, live subscription, stable independent credential reference and explicit unreadable state. No renderer-only replacement. |
| Element locks and authenticator | Dedicated desktop credential service, create/verify/remove/generate | Six exact independent policies, OS-protected keys, bounded attempts, TOTP vectors, QR confirmation and protected mutation history. Plain settings storage is forbidden. |
| External schedules | Dedicated desktop request service, resolve/cancel | Known setting schema, bounded HTTPS/DNS/redirect/size/time checks, generation identity, credential references only, Home Assistant on/off and local-base fallback. |
| Updates | Dedicated desktop updater service, inspect/check/stage/apply | Accepted channel, verified metadata/hash and current installation ownership; apply only through user-approved safe lifecycle. |
| Converter, models and servers | Product-owned native adapter services | Typed capability/configuration descriptors, real lifecycle/actions and evidence. Settings must configure and open those actual destinations, never emulate their operation. |

The owning coordinator assigns service implementations; the UI lane binds only an actually implemented contract. Every capability row has a visible exact unfinished state until its native acceptance exists. Describing a route does not implement it.

The appearance child matrix must enumerate typography (family/axes/size/weight/style/decoration/case/baseline/alignment/spacing), layers/groups/selections/channels/masks/adjustments/effects/transforms/geometry and every normal/hover/focus/pressed/selected/disabled/dragged/validation/loading/success/warning/error state. Animation/Transition rows separately enumerate tracks/properties/keyframes, timing/easing, timeline/playback, transitions/triggers and reversibility. Each row requires its real renderer consumer, persistence, undo and timed evidence. No global font or theme control closes these rows. Full color translation includes named, HEX/HEX8, RGB, HSL, HSV, HWB, CIELAB/LCH, OKLab/OKLCH and CMYK, with alpha, gamut/loss warnings and contrast. The local native color picker is only one input path.

Schedule controls include stable ID, label, enabled state, priority, order, start/end dates, every-day/weekday selection, local start/end times, setting/value and all three source choices. Show active rule, base/effective value, next known transition and source freshness. Unsupported external sources retain their configuration specification and exact missing service, and cannot be selected as if functional. A completed local schedule route never closes external-source acceptance.

History requires actual action counts, composable text/date/action filters, labels/diffs/restore preview, undo and redo as appended events, protected access, explicit retention and selected/filtered bulk export. The export format matrix covers structured, tabular and prose representations plus full ZIP/7z options with exact loss disclosures; five implemented text formats are partial coverage. Settings history and personal content must not leak credential or private wording metadata.

## Revision 3: state and route ledger

Use normal client tuple **1280×800** to match `REFERENCE.md`; 1280×1000 is an additional tall evidence tuple, not a replacement baseline. Minimum remains 760×580. Every screen has light/dark, en/yue/both and 1/1.25/1.5/2 scale variants. The built renderer route is normal Settings navigation followed by its stable section/control ID; no injected product state or mocked host counts as proof. The reference route must select the same declared tuple from tracked reference assets. Design-reference runtime/diffs remain unfinished until produced.

Each destination additionally inventories: default, changed, reset, invalid, empty/no-match, saving, save-rejected, unavailable, scheduled base/effective, restored, locked where applicable, hidden-accessibility/restoration, keyboard-only focus and longest bilingual labels. The control-help route adds open/closed, example-edited, invalid-example, Reset, Back/Cancel, reopen-isolation and concurrent-instance isolation. Exact reference/runtime routes, captures and measured layout receipts belong to each row, never a family-level screenshot claim.
