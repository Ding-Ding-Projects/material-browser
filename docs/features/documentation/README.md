# Documentation delivery

The static documentation component imports every Markdown article under `docs/` and `wiki/` at build time and emits a complete local bundle in `dist/site`. Internal article links and headings remain inside the bundle. Optional source links point to GitHub. Images in imported Markdown are omitted with a labelled source reference until a reviewed offline image inventory is available; no external image requests are made.

The website leads with task walkthroughs, local progress and explanatory examples. It is not an interface to native product operations. The offline companion consumes the same generated output. Root `build.bat -Component Docs` is the intended production entrypoint after root integration.

## Security and privacy

Markdown raw HTML is disabled and rendered output is sanitized. Executable link schemes are removed. No remote fonts, CDN scripts or analytics are included. Personal wording is loaded only from a validated user-selected file into local browser storage; its payload is not exported or transmitted. Source articles remain in their authored language and preserve technical identifiers.

## Verification and limitations

Build checks validate complete source inventory, safe Markdown and internal links. Browser interaction, local persistence, narrow layouts, live publication, companion packaging and native launch need separate evidence. The design reference lists the required state and scale matrix. Broader universal settings, narrator, element locking/appearance, shared School mode and full regex tracing are incomplete acceptance items, not shipped claims.
