# WorldLens design system adapter

The vendor directory contains unchanged `colors.ts`, `tokens.css` and the MIT license from WorldLens commit `aaf1063e1ad7826591fa4dd6f504d086451e645b`. Exact source paths and SHA-256 digests are in `provenance.json`. No Vue or Vuetify dependency is imported.

Import `worldlens.css` before application rules. It imports bundled Roboto and Roboto Mono from the installed Fontsource packages, declares an exact dark initial paint, and adapts shape/elevation/component tokens for Material Web. `settings/effects.ts` applies the complete theme role set through `theme.mjs`; high contrast overrides a custom accent, while saved preferences remain unchanged. Pass the settings record alongside effective preferences so compiled defaults can be distinguished from saved accents and scheduled overrides. System theme follows the operating-system media query.

From the repository root, run `node scripts/sync-worldlens-design-system.mjs` to verify vendored hashes. To verify against a checkout, append `--source <WorldLens checkout>`. To restore the pinned bytes, append `--write`; both the checkout commit and all source hashes are checked before any destination changes. Updating the upstream pin requires an explicit manifest and integration review, not an automatic latest-version fetch.

Roboto and Roboto Mono are supplied by their pinned Fontsource dependencies under the SIL Open Font License included in those packages. WorldLens MIT attribution is retained in `vendor/LICENSE`. Source provenance establishes origin, not runtime conformance. See `design/desktop/` for the design review and required built-layout evidence.
