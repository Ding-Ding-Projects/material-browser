# Documentation delivery

The static documentation component imports every Markdown article under `docs/` and `wiki/` at build time and emits a complete local bundle in `dist/site`. Internal article links and headings remain inside the bundle. Optional source links point to GitHub. Images in imported Markdown are omitted with a labelled source reference until a reviewed offline image inventory is available; no external image requests are made.

The website leads with task walkthroughs, local progress and explanatory examples. It is not an interface to native product operations. Root `build.bat -Component Docs` assembles the static output.

## Portable offline handbook

`build.bat -Component DocsCompanion` rebuilds the complete documentation and stages the same reviewed output for the offline handbook. `build-installer.bat -Component DocsCompanion` invokes that build and produces `apps/docs-companion/release/Material-Browser-Handbook-0.1.0-x64.exe`. This documentation-only portable companion is separate from the application's Squirrel installer. Its single executable contains its runtime and complete documentation; no adjacent runtime folder, installer or network download is needed to launch it. Temporary runtime extraction is managed by the portable launcher.

The sandboxed renderer has no Node integration or preload bridge. A restricted local protocol serves only hashed bundled assets. Permissions, new windows, downloads, external navigation and network requests are blocked. Optional online source links therefore do not open in the offline companion. All internal article/wiki routes, guides, examples, search and reading preferences use the bundled content. Preferences are stored under the companion's own user-data directory, separately from browser profiles and the main application.

For isolated verification, pass `--verification-data-dir=<absolute-directory>` using a new empty directory or a directory already marked by this companion. Root, home, normal-profile, linked and unowned nonempty directories are rejected. Debugging switches are disabled for normal reading; an explicitly isolated verification profile may use a loopback debugging port. This mode never reads or replaces the normal profile.

The companion bootstrap reuses a separately trusted compatible installed Node.js when available. Its managed portable cache is different: every executable, script and npm module must exactly match the pinned, hash-verified ZIP before any cached tool runs. Missing, modified, extra or linked cache entries stop the build and remain untouched for inspection. A cached version string alone is not integrity proof. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/docs-companion/test/bootstrap.test.ps1` for the focused cache-integrity regression, including modified npm content with an unchanged ZIP.

## Security and privacy

Markdown raw HTML is disabled and rendered output is sanitized. Executable link schemes are removed. No remote fonts, CDN scripts or analytics are included. Personal wording is loaded only from a validated user-selected file into local browser storage; its payload is not exported or transmitted. Source articles remain in their authored language and preserve technical identifiers.

## Verification and limitations

Build checks validate complete source inventory, safe Markdown and internal links. Browser interaction, local persistence, narrow layouts, live publication, companion packaging and native launch need separate evidence. The design reference lists the required state and scale matrix. Broader universal settings, narrator, element locking/appearance, shared School mode and full regex tracing are incomplete acceptance items, not shipped claims.

Reviewed local images are supported through `apps/docs/approved-assets.json`: each entry requires a `docs/evidence/` image path, exact SHA-256, and `reviewedForPublication: true`. Builds reject traversal, unsupported files and changed hashes, then copy approved bytes into the offline bundle. The inventory includes the reviewed desktop captures. External images never load.
