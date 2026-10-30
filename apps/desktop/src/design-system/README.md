# Material Browser reference design adapter

The active visual authority is the current remote `design/` folder. The renderer was reconciled with design commit `0ab6165fd3c5f59f23ce7e586f0979bd0f501fc8`, including its `theme.css` and `m3.css`. Earlier archive references are historical only.

Import `material-browser.css` before application rules. `reference-colors.mjs` owns the current teal and blue-tertiary light/dark roles. `settings/effects.ts` applies every role through `theme.mjs`; explicit saved accents, font choices and scheduled overrides remain effective, and high contrast remains independent.

## Offline assets

Pinned Fontsource packages provide Roboto Flex 5.3.0, Noto Sans HK 5.3.1 and Material Symbols Rounded 5.3.9. All are OFL-1.1 and their package integrity values are recorded in `package-lock.json`. CSS imports bundle local font files into the renderer; there are no font CDN requests. Existing Roboto and Roboto Mono remain available for saved preferences and technical text. `icons.ts` preserves renderer identifiers while mapping to the locally bundled rounded symbols.

## Historical provenance

The unchanged vendor directory retains `colors.ts`, `tokens.css` and the WorldLens MIT license from commit `aaf1063e1ad7826591fa4dd6f504d086451e645b`. The vendor provenance manifest remains accurate. Its contrast scheme and foundational shape/type tokens are reused; its tonal palette and historical `worldlens.css` are not the active product styling authority. The existing synchronization script verifies the retained historical files only.

Source provenance establishes origin, not runtime conformance. Built interaction and visual evidence remain required for design acceptance.
