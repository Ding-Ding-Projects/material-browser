# Required-feature acceptance

The current catalogue contains **112 identities across seven surface families: 784 rows, with 420 applicable rows unfinished**. The added world-generator identity is missing on every applicable parent-server surface; no completion state was upgraded.

This inventory originally recorded a conservative source-review baseline at `60e65ef`. It is not a certification, implementation report, or release approval. The original inventory contained 111 neutral requirement identities across seven surface families, including the productive workspace, Settings, hosted documentation, offline handbook, storage dashboard, hosting wizard and repository delivery records. Nested dialogs, menus, pickers, tool panels and article routes inherit the owning family's obligations; they still need explicit child-surface inventories before completion.

The independent `required-identities.json` list prevents deleting a feature row to make the inventory appear complete. Names are product-facing descriptions, not an embedded private dictionary. This baseline deliberately does not copy private instruction prose, mappings or local paths.

## Reading evidence states

`not-audited` means no behavior verdict has been established. `partial` means relevant source was found, not that all required behavior works. `implemented` requires a completed source review. `verified` additionally requires documentation, localization, persistence evidence or a specific non-persistence explanation, focused tests, built interaction and genuine current screenshots. Every unverified applicable row retains an explicit gap. `not-applicable` requires an individual reason and cannot silently stand in for an unimplemented feature.

The baseline has no `verified` rows. Existing evidence in `docs/evidence/` belongs to its original source versions. It has not been revalidated for this candidate and is not attached as current runtime evidence. Test success is a separate dimension from installed, GUI, deployment and release verification.

## Validation and intentional failure

Run `node scripts/check-feature-acceptance.mjs` to validate identity, surface and row integrity. Run `node --test scripts/check-feature-acceptance.test.mjs` for the removal and false-claim regressions. Structural success means the ledger is internally consistent, not that the product is complete.

Run `node scripts/check-feature-acceptance.mjs --require-complete` for a fail-closed delivery decision. It currently returns nonzero because applicable acceptance remains unfinished. Do not remove this flag from a delivery decision to turn a planning inventory into a passing product claim. The checker is a local tool; this change does not add tests or lint to release workflows.

The negative tests independently remove an identity and a surface row, duplicate a row, remove an exclusion reason, fabricate verified state, fabricate completion, break a source reference, and attach stale evidence. Each altered case must fail, and the restored baseline must pass.

## Implementation priorities and limits

1. Review Settings consumers and scope each control to actual rendered behavior. The existing Settings inventory is narrower than the complete product inventory. Source presence alone does not verify persistence or localization.
2. Inventory every nested search and context-menu surface, then review independent query state, anchored builder access, bounded execution and the full RegexBuddy topic set. A pattern tester is not parity proof.
3. Review the initial-screen provenance in `apps/desktop/src/app/Shell.tsx`. Date-only formatting is not the required date/time-with-seconds-and-timezone evidence; source and current built behavior need reconciliation.
4. Complete workflow-specific implementation and acceptance for server management, local model management and conversion. Concurrent implementation must be reviewed against its own resulting source commit, not this baseline.
5. Expand guidance and information-button coverage to individual controls, including worked examples, isolated playgrounds and negative omissions. Review workspace tab catalog behavior and destructive/locked input paths independently.
6. Verify hosted documentation and each companion independently. Shared source does not prove hosted routes, offline navigation, settings persistence, responsive layouts or installed behavior.
7. Produce current source/hash-bound layout, interaction and release receipts. Retain historical evidence unchanged and keep unavailable proof unfinished.

This is a family-level discovery ledger. It does not yet claim exhaustive per-control decomposition or full behavioral auditing of the original 414 applicable rows. Most source links and all current runtime-evidence fields remain deliberately empty until reviewed. Applicability exclusions cover non-rendered repository records, documentation-only deliverables on productive screens, job-document workflows, repository publishing, extension download interception, private-source build routing, shared-status-service internals, suspended display reporting and instruction-distribution/Roblox-only deliverables. Revisit an exclusion if product scope changes.

## Local verification baseline

- Ledger negative regressions: 15 passed, 0 failed.
- Documentation: 6 passed, 0 failed after `npm ci --ignore-scripts`; the first isolated run lacked `markdown-it` and did not establish a product failure. Package installation reported three advisory findings (one low, one moderate, one high); no dependency upgrades were performed in this documentation-only scope.
- Offline handbook: 3 passed, 0 failed.
- Desktop initial full run: 162 tests, 161 passed and one test-file import failed because the isolated checkout lacked `typescript`. After resolving the existing pinned dependency, the affected suite passed all 10 tests. The full native-history suite was not repeated because its results were unaffected. Its existing test command already includes `src/app/*.test.mjs` and `electron/services/*.test.cjs`, so no discovery repair was necessary.
- Storage service: 6 passed, 0 failed.
- Native build, Rust suites, installed applications, GUI interaction, deployment and release acceptance are not established by this ledger change.


## Child-surface source review

`child-surfaces.json` names 26 reviewed desktop child surfaces, their actual state consumers and source files. Every child inherits all applicable obligations from its parent; highlighted identities only record review priorities. The list deliberately remains `complete: false`. Its source baseline is `60e65ef`, not a claim that later concurrent implementation was audited. Current built interaction remains unverified for every child. The local checker validates declared parent and feature identities, source references and consumer descriptions; its negative cases reject false runtime claims. The independent test list prevents removal of a reviewed child from passing silently.

The main ledger now links source and focused test locations for language, narration, appearance, notifications, attention controls, palette, guidance, progress and protected history. A linked test file is a discovery reference; terminal execution results above remain separate. Local avatar shape/tone persistence does not prove a complete per-element appearance editor. Presentation datasets do not establish current pixels or all customization controls.

Desktop service discovery now uses `electron/services/**/*.test.cjs`, preserving the existing top-level and application test patterns while including nested native server suites. The server sources were supplied by separate implementation commits, not authored by this acceptance change. Recursive-suite terminal results are recorded below when available.


The presentation-mode source audit specifically found an application-local `school-mode.v1` record and an explicit no-shared-record disclosure. Its transaction updates message-style values and dialog decoration, which does not establish the required shared renameable mode, live propagation, forced English, complete capability omission or shared unlock credential. This row remains partial. The source audit also names the personal-wording import and celebration state without treating source presence as proof of outcome sounds or accessible built interaction.


The completed clean baseline run passed **171 of 171** desktop tests. After recursive service discovery and the two separately authored native server inputs, the full desktop run passed **182 of 182**, including all 11 nested native server tests. `local-tests.json` records exact counts, observed durations, source inputs and the package-script digest. The two runs overlapped, so their durations are not performance benchmarks. Native fixture tests do not prove a real distribution download, server process lifecycle, container launch or GUI workflow. No full-suite failure remains in these desktop results.


## World-generator requirement update

The current catalogue adds `minecraft-world-generator` beside `minecraft-server-manager`. Its seven rows inherit exactly the parent manager's applicability: the six rendered surface families remain applicable and unfinished, while non-rendered repository delivery records retain the parent's explicit exclusion. The requirement has no implementation, localization, persistence, test, runtime or screenshot evidence attached.

A bounded review of product source at `37ff81f` found `design/remaining-features/WorldGenerator.dc.html` and no active generator handlers in the desktop renderer, native services or server feature documentation. The artboard is design-only; its displayed progress and controls do not establish executable generation. The new child-surface record identifies the existing server-service boundary and explicitly states that no generator state consumer was found. There are now 27 discovery child records, all runtime-unverified; the original 26-record review remains historical context.

Acceptance must separately establish per-selected-version extraction, typed registry-backed controls, pack writing, user EULA consent, server execution, bounded pre-generation (at most 256 chunks per batch), a default 100 by 100 chunk canvas synchronized with fields, native Browse, verified non-overwriting Folder and atomic ZIP outputs, and same-version server reopening. Edition/version limitations must state their real scope. No raw JSON textbox or hardcoded registry picker substitutes for those workflows.

The original **111-identity / 777-row / 414-unfinished** baseline, 15-test ledger receipt and 171/182-test desktop receipts are historical results for their stated inputs. They are not silently relabelled as verification of the new 112-identity catalogue or generator implementation. Current catalogue regression results are reported separately by this update.

The current 112-identity inventory validation passed with **784 rows, 420 unfinished and zero validation errors**. The updated local inventory suite passed **17 tests, zero failed**. These are structural and omission checks only, and do not upgrade generator completion or rerun the historical desktop acceptance suites.
