# Focus modes and the appearance editor

Design source: `design/remaining-features/Personalize.dc.html` (see `design/remaining-features/HANDOFF.md`).
Code lives in `apps/desktop/src/app/`.

## Focus modes

`FocusModesProvider` (`focus-modes.tsx`) holds four independent modes, saves them in
`localStorage` under `focus-modes.v1` and applies them as attributes on `<html>`. Styles are in
`focus-modes.css`. Reading or writing storage is wrapped in `try`/`catch`; if storage is
unavailable the modes still work for the session. The pure helpers (normalisation, bounds,
timer state) are in `focus-modes-model.mjs`.

| Mode | Attribute | Behaviour |
| --- | --- | --- |
| Calm screen | `data-focus-calm` | Hides `.badge` elements and notification toasts with `role="status"`; error toasts (`role="alert"`) and the action snackbar stay. Turns off all animation and transition. Hidden notifications remain in the notification list. |
| One thing at a time | `data-focus-one-thing` | The last pane (`.pane`) that received focus or a pointer press gets `data-focus-current`; other panes are dimmed until hovered or focused. |
| Break it into steps | `data-focus-steps` | Exposes a flag only. Forms read it with `useBreakIntoSteps()` (React) or `breakIntoStepsEnabled()` (plain code). No form adopts it yet. |
| Gentle timer | `data-focus-timer` | `FocusTimerStatus` shows a silent work and break countdown with pause and reset buttons. Work length is 5 to 90 minutes in steps of 5 (default 25); break length is 1 to 30 minutes in steps of 1 (default 5). Both are bounded steppers. Timer progress is not persisted across restarts. |

## Appearance editor

Any element can opt in with `data-appearance-id="some-id"` (letters, digits, `_ . : -`, up to
64 characters) and an optional `data-appearance-label`. Seven built-in groups need no
attribute: primary buttons, tonal buttons, panes, list rows, text fields, the navigation rail and
the status bar.

Each element can override background colour, text colour, corner radius (0 to 28 px stepper) and
size (80 to 150 percent slider, applied with CSS `zoom`). Overrides are saved in `localStorage`
under `appearance.elements.v1` and applied through one generated `<style id="appearance-elements">`
element. "Reset this element" removes one override; "Reset all elements" asks for confirmation and
removes every override. Pure rules are in `appearance-elements-model.mjs`.

`AppearanceContextMenu` listens for `contextmenu` on the document and for Shift+F10 or the
ContextMenu key on the focused element. When the target or an ancestor has
`data-appearance-id` (or matches a built-in group) it offers "Customize appearance", which
opens the editor in a dialog. Text fields, open dialogs and menus, selected text, and handlers
that already called `preventDefault()` (such as the profile list menu) are left alone.

## Colour picker and translations

`ColourPicker` (`personalize-controls.tsx`) has a saturation and brightness area and a hue bar.
Both are focusable sliders: arrow keys move by 1, Shift with an arrow by 10, Home and End (and
Page Up and Page Down on the area) jump to the edges. The hex field accepts 3 or 6 digits and
shows an error for anything else; on blur an invalid entry reverts. The colour is shown as rgb,
hsl and oklch, and the contrast ratio against the element's other colour is shown with pass or
fail at 4.5 to 1. All maths is in `colour.mjs`.

## Info icons

`InfoIcon` is an icon button named "About <control>" that opens a short dialog. Each control on
the page has its own explanation.

## Wiring

`Personalize.tsx` exports `PersonalizePage`, `FocusModesProvider`, `FocusTimerStatus`,
`AppearanceContextMenu`, `InfoIcon`, `useBreakIntoSteps` and `breakIntoStepsEnabled`. Cantonese
strings are in `Personalize.locale.ts` (`personalizeZh`) and must be merged in `src/i18n.ts`.

## Tests

`colour.test.mjs`, `focus-modes.test.mjs` and `appearance-elements-model.test.mjs` cover the pure
modules. Run `node --test src/app/colour.test.mjs src/app/focus-modes.test.mjs` from
`apps/desktop`.

## Verified repairs and remaining acceptance

The components are connected to the shell and localization. At source
`47e8ae104755d38e9d115fbb08636143bc6278cb`, the exact Desktop build was exercised on a
hidden Windows desktop with isolated application data. Four inspected, unchanged images
and their publication inventory are in [the repair evidence](../../evidence/desktop/repair-20261101/README.md).

- A saved red primary-button override applied after a cold process start, including the locked screen.
- Injected write/removal failures produced visible session-only feedback and retry controls.
  A failed initial storage read prevents overwriting the unread durable record.
- The contrast display reported unavailable for a pane whose actual computed opacity was 0.38.
  Partial-alpha colors are preserved and composited only when the solid backdrop is known.
- A real CDP pointer interaction reached hue 359 with an accessible maximum and value of 359.

These images use a 1280 by 1200 page viewport at an observed device-pixel ratio close to 1.
They do not establish physical display-scale coverage or screen-reader output. Source tests
also cover normalization, failed writes/removals and cold storage-read protection. Malformed
stored JSON normalization is an existing behavior outside the storage-exception repair.

Still unverified:

- Complete minimum-layout, theme, language and physical display-scale matrices. The known
  minimum-width defect remains tracked in [issue 10](https://github.com/Ding-Ding-Projects/material-browser/issues/10).
- Every context-menu target, keyboard-only workflow and appearance size combination.
- Calm screen hides notification toasts by matching their current markup in `Live.tsx`
  (a `.snack` whose first child is an icon). A change to that markup would need the selector updated.
- Overrides use `!important` and can lose to inline styles set by components.
- Screen reader output for the two-dimensional colour area was not tested.
