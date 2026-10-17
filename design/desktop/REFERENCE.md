# Desktop workspace design reference

Status: proposed reference, not runtime evidence. Framework: React, TypeScript and Material Web inside the isolated desktop shell.

## Productive layout

A compact top bar contains the product identity, version, backend connection state and command search. A left rail opens Profiles, Synchronization and Settings. Profiles use a searchable master list and an adjacent detail workspace. Empty state offers creation, never example accounts. The detail workspace has Overview, Revisions and Automation tabs. A persistent bottom status region reports actual operation results.

Surfaces use Material 3 tonal surfaces, outlined fields, filled primary actions, 24 px container spacing, 16 px inner spacing, 12-24 px corner radii and visible keyboard focus. Typography uses installed system fonts, without remote downloads. All controls have at least 44 px interaction targets. Minimum viewport is 760 x 580; normal reference is 1280 x 800. Below 960 px the master/detail layout stacks without losing content. No fixed-height content clipping.

## States and actions

| ID | State | Real action / result |
| --- | --- | --- |
| setup.connection | Backend missing | Explain unavailable host, retry status, never synthesize data |
| setup.vault | Vault absent/locked | Create or unlock using password through protected IPC |
| setup.profile | First profile | Create actual named Chromium/Firefox profile, automation off |
| setup.sync | Optional folder | Native directory selection and sync.configure, or explicit skip |
| profiles.empty | No profiles | Profile creation form |
| profiles.list | Profile inventory | Plain-text search with adjacent regex builder, select actual profile |
| profile.overview | Selected profile | Launch, stop, duplicate, snapshot; backend errors stay explicit |
| profile.revisions | Immutable revisions | List actual history and restore a selected revision |
| profile.automation | Automation preference | Off/Selenium/Puppeteer preference, pending restart from actual state |
| sync.overview | Folder and conflicts | Configure, upload, download and preserve conflicts |
| settings.appearance | Local preferences | Language, theme, density and accent persisted locally |
| settings.wording | Personal wording | Bounded JSON upload/drop, replace, clear, local cache |
| commands | Search overlay | Explicit navigation and supported actions, Escape closes |

## Accessibility and privacy

Native labels and semantic headings, predictable tab order, keyboard dismissal and live status announcements. Bilingual labels wrap and show both languages. Password fields are never cached. Personal wording only transforms product-authored labels, never backend text, paths, profile names or identifiers. Upload celebration cannot intercept input, announces politely, and respects reduced motion.

## Required evidence

Each state needs built-source capture at normal/minimum viewport, light/dark, English/Cantonese/bilingual, 100/125/150/200 percent scale. None is verified by this design record. Full universal-feature completion is tracked separately and cannot be inferred from shell implementation.

## Reviewed interaction details

Onboarding is a resumable four-step flow: connection/vault, first profile, optional sync folder, and finish. Persist only step and non-sensitive choices. Back/Next validate the current step; required operations must succeed before advancing. Show an indeterminate in-place progress state while awaiting actual host results. Passwords are never persisted. Completion returns to the profile workspace. Reopening setup retains already-completed backend facts.

Automation distinguishes saved preference, effective mode and restart needed. Unavailable engine modes show the actual capability reason. Saving a preference does not launch a listener or assert that the effective mode changed. Conflict list and detail retain both revision identifiers and provide explicit keep-local/keep-remote resolution through sync.resolve, preserving immutable inputs. Never merge browser databases.

Personal wording is all-or-nothing from upload or anywhere-drop, validated before replacing the prior cache. A successful import displays an input-transparent full-window celebration for three seconds, with its headline read only from the imported ordinary-phrase mapping, otherwise a localized neutral fallback. Use a polite live region, no focus movement, and static/fade reduced-motion rendering. Clear restores original wording immediately.

Material Web filled and outlined buttons form primary and secondary actions; outlined text fields provide typed input, native selects provide accessible bounded choices, CSS tonal containers organize sections, and native dialog supplies focus containment and Escape dismissal. Tab lists expose aria-selected, keyboard navigation and explicit panel associations. Language resources separate EN/YUE strings. Bilingual mode wraps secondary labels below the primary. All long content lives in bounded scrolling regions with minimum dimensions and no hidden overflow.

Revisions, automation, synchronization conflicts, settings and command palette each have independent plain-text search and adjacent regex editing. Regex mode exposes synchronized pattern, flags, validation and reset. Settings use persisted Appearance and Personal wording tabs; filters never delete state. Product version and updated-at remain visible, with local seconds and timezone if supplied by build metadata, otherwise explicitly unavailable. Capture states include long EN/YUE/bilingual strings, focused fields and scrolled panels.

## Component provenance and search handoff

Externally rendered controls use registered `@material/web` primitives: `md-filled-button`, `md-outlined-button`, `md-outlined-text-field`, `md-outlined-select` with `md-select-option`, `md-dialog`, `md-tabs` with `md-primary-tab`, and `md-elevation` on tonal layout containers. Layout containers carry no replacement control semantics. Package lock records exact upstream package provenance. Native HTML is retained only for semantic headings, lists, file input and structural content.

Every adjacent regex editor must expose the complete shared workbench: guided construct insertion, engine capability disclosures, pattern/flags, structured explanation, samples and capture/replacement previews, zero-width-safe matching, bounded isolated evaluation, saved snippets and import/export, expected-result cases and timing. Unsupported ECMAScript constructs remain explicitly unavailable. A shallow mode toggle is incomplete and must stay listed as a gap until the complete workbench is wired to each search field.
