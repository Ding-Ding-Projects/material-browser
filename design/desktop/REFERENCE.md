# Desktop workspace design reference

This reference records the independently reviewed direction before implementation. It is a design contract, not runtime evidence.

## Productive shell

Use a compact 56–64 px header, a 160 px navigation rail (124–144 px at the minimum width), 16 px outer spacing, 12 px gaps, flat tonal panels, 14 px body text and 20–22 px headings. Interactive targets remain at least 44 px. Scope shell selectors so nested settings navigation and dialog actions are unaffected. Preserve actual version, connection state, accessibility, narration, local wording and keyboard catalog access.

## Profiles

Use a semantic sortable table with selection checkboxes, name, engine, observed runtime, saved automation and updated date. Never infer runtime from a saved preference or missing observation. Keep search, engine filtering and selection separate. Bulk actions use actual existing bridge methods with per-target results and synchronous duplicate prevention. Launch keeps the existing per-launch standard-identity consent. Destructive actions show named targets and consequences before dispatch.

At normal width the inspector occupies 320–360 px, with Overview, Revisions and Automation. Below 1080 px selecting a record replaces the table with detail and an explicit Back action; do not compress two unusable columns. Persist only a still-valid selected ID. Keep saved, effective and restart-required states separate. Profile dates are strings; Super Profile dates are Unix seconds.

## Settings and setup

Keep the existing settings controller, all ten categories, four docking edges, groups, pins, search, history and value provenance/reset. Present compact setting rows with help directly above the relevant control. Keep setup resumable under the existing setup/setupComplete keys, real create/unlock/join actions, cancellation semantics and optional synchronization skip.

## Synchronization and Super Profiles

Show a folder strip, actions and structured conflict candidates. Candidate identity is factual; do not invent local/remote provenance. Preserve every Super Profile lifecycle helper, optimistic revision check, save category and exact finalize-after-unlock operation. Use a semantic template table and Overview, Sessions and Revisions inspector, with the existing four-step wizard.

## Verification boundary

Normal tuple: 1280×800. Minimum tuple: 760×580. Required built checks cover English, Cantonese, bilingual, light/dark and 100/125/150/200% scales. Source and behavior-model checks do not establish rendered conformance. The coordinator owns root build entrypoints and real runtime evidence.

## Preserved accessibility, data and search boundaries

Use registered Material Web buttons, fields, selects, dialogs and tabs. Semantic tables, native checkbox and range inputs carry their actual accessible roles. Use per-inspector panel IDs because inactive workspaces remain mounted to retain independent forms and searches. A bounded keyboard-operable inspector width control persists locally; narrow layouts ignore that width.

The profile list, revisions, automation, synchronization, settings and destination catalog retain independent plain-text search and the existing adjacent regex editor. The complete shared regex workbench remains an existing acceptance gap; retaining its editor does not claim complete parity. Keep unsupported capability disclosures, all settings categories and local data protections intact.

Profile and revision dates from the native core are Unix seconds. Normalize those values explicitly, with ISO-string compatibility. A matching positive process ID is an observed running state; missing observations remain unavailable. Snapshot, restore and remove rely on the native idle lease, never an invented renderer safety claim. Duplicate supplies the required explicit name and retains the native engine behavior.

Shared synchronous reservations cover every target in a batch before dispatch and exclude vault-wide actions while targets are active. Per-target outcomes survive selection changes, clear on vault lock, and reject stale access epochs. Revision reads use one sequence across manual refresh and mutation refresh. Launch identity consent, protected settings and Super Profile lifecycle decisions remain unchanged.
