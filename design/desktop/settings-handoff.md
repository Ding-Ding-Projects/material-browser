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
