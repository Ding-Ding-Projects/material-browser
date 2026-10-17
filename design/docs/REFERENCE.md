# Task-oriented documentation design reference

Status: implementation reference, not runtime evidence.

## Composition

An ink-blue navigation rail and pale blue reading canvas frame a spacious task workspace. The home screen starts with “Your profiles. Your next step.” followed by a single guided checklist. Six concise task links lead into an interactive walkthrough; a separate complete reference index retains every documentation article and wiki page. The primary action is Start guided setup. Documentation never pretends to execute a native operation.

At 1280×800 the rail is 256 pixels and the reading measure is capped at 920 pixels. At 320 pixels and at increased display scale, navigation folds into an explicit details control and the content becomes a single column. No fixed content height; code scrolls within its own container. Native Material Web buttons, switches and checkboxes use locally bundled version 2.5.0. No external fonts or images.

## States and behavior

- home: task cards, saved visitor progress and explicit documentation-only status.
- guide: create vault, join computer, automation, snapshots, conflict resolution and hosting steps. Back/Next preserve selected step; completion is visitor confirmation, never a product-operation result.
- example: a local-only automation preference simulator explains requested versus effective state and restart boundaries. No network, native bridge or credential input.
- article: complete rendered Markdown, document title, contents links and relative internal article routes. Raw HTML disabled and unsafe URLs removed.
- reference: complete docs and wiki inventory, searchable by title/body. Plain text default, adjacent regex builder uses isolated timed worker evaluation, escaped literals, groups, anchors, flags, match/capture table and capability explanation.
- settings: theme, English/Cantonese/bilingual navigation, text sizing, reduced motion, local personal wording upload/replace/clear. Source articles retain their authored language and are labelled accordingly.

## Accessibility and privacy

All actions are semantic keyboard controls with visible focus and 44-pixel targets. Main route changes focus the page heading. Current navigation uses aria-current; progress updates use a polite live region. No simulated profile data is exported as real data. Visitor progress, settings and valid wording cache are browser-local. Code, paths and URLs never receive wording substitution. Failed storage writes produce a visible session-only state.

## Verification inventory

The build and publication owners must verify home, every guide step, example on/off/running/restart, reference search plain/regex/invalid/timed-out, complete article navigation, settings persistence, invalid wording/clear, 320/1280 widths, English/Cantonese/bilingual, light/dark and 100/125/150/200% scales. Every capture must bind source and bundle hash. Until then these are planned checks, not passing evidence.

## Scope limitations

This documentation component does not implement native setup, browser launch, cross-machine restoration, live snapshot consistency or service deployment. It describes the product's capability reports and limitations. Full universal settings, narrator, element appearance/locking, School mode and advanced regex engine tracing remain outside this initial documentation implementation and must remain listed as incomplete acceptance, never claimed supported.
