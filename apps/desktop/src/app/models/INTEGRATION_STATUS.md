# Local model workspace alternative

This directory is an **inactive implementation alternative**, retained for selective reuse.
The incoming designer implementation owns the product integration. Do not activate a second
local-model route or replace that implementation merely because this directory exists.

The alternative contains catalogue and installed-model views, exact-tag reconciliation,
pull selections and job presentation, model operation confirmations, and runtime recovery
presentation. Its intended bridge is `localModels(action, params)`.

## Verification boundary

- TypeScript no-emit checking passed for the preserved implementation.
- Four focused model-state tests passed with
  `node --test apps/desktop/src/app/models/model-state.test.mjs`.
- No built GUI interaction, accessibility, layout, installation, model pull, or runtime
  verification was performed for this alternative.
- Source review and passing model-state tests do not establish product delivery or complete
  feature coverage. Unsupported capabilities remain explicitly unfinished.

## Selective reuse

Review individual components and state helpers against the active native service and the
incoming implementation before reuse. Preserve existing behavior and current user work,
avoid duplicate authorities and routes, and verify the actual integrated build afterward.
The presence of these files is preservation evidence only, not an integration instruction.

Preserved implementation commits: `5ad31ed7c97ad44dac40c592d32021222b6bf7cc` and
`ce4010a23e78afca686272d6de16f9d077f1f8e4`.
