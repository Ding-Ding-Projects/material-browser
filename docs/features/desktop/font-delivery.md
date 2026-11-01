# Bundled desktop font delivery

The desktop keeps its existing `font-src 'self'` policy. Production builds emit bundled
fonts as local asset files instead of embedding small fonts as data URLs. This lets the
browser load the same pinned font bytes without relaxing the content security policy or
requiring an external font service.

The original defect affected eight generated CSS references to six small bundled font files.
Their inline representation conflicted with the policy. That does not establish that every
displayed font failed or that visible glyph changes occurred.

## Verify a development build

1. Run the exact root `build.bat -Component Desktop` entrypoint.
2. Run `node scripts/check-desktop-font-assets.mjs` against that completed output.
3. Inspect actual application startup and the relevant language states for font resource or
   CSP failures. Source output checks do not establish browser loading or visual fidelity.

Run the local positive/negative regression suite with
`node --test scripts/check-desktop-font-assets.test.mjs` after the declared development
dependencies are installed by the build entrypoint.

The local checker inspects emitted CSS stylesheets, rejects font data URLs and external references, requires contained emitted
files, and matches their SHA-256 values to the declared installed font packages. It also checks
that the built HTML retains the expected self-only policy. `--dist <directory>` supports an
isolated copy of the built output for negative verification; it does not change product files.
The six affected font identities have an independent reviewed inventory, so deleting their
CSS declarations cannot turn the delivery check green. HTML and CSS structure are parsed;
meta-looking text in scripts/templates/comments and uppercase font rules are tested separately.
Unsupported escaped source syntax is rejected explicitly. This is static-output verification,
not analysis of arbitrary runtime-generated styles.

The check was first run against the affected output and rejected its inline font reference.
Post-repair build, startup, layout and negative-byte results are recorded separately. No tests
or lint were added to hosted build workflows by this repair.
