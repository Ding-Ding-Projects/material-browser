# Acceptance integration and preservation status

## Integrated contributions

The primary `main` checkout contains the acceptance baseline (`a3d0abc`), child-surface and recursive-test-discovery refinement (`aa2b23e`), and world-generator requirement update (`a83c3c1`). The reviewed restore-root and staged-world rollback repair is integrated as `1fa5e4e`; converter output and local-model activation boundary repairs are integrated as `7baf1fc`.

This acceptance checkout retains historical copies and staging inputs used for isolated tests and review. Their presence is recovery history, not a second active implementation or a request to merge the entire historical branch. Preserve them intact. Only explicitly selected new preservation patches should be considered for integration.

## Current ownership and verification boundary

The primary checkout was observed at `77df02e` while writing this note. Incoming design and implementation are owned by the design contributor; the integration owner leads verification, defect/layout review, focused repairs and issue handoff. The incoming world-generator and personalization implementations are recorded in primary history. This note does not revise the earlier ledger's source-scoped missing implementation finding into current completion proof.

The acceptance inventory currently lists 112 identities, 784 rows and 420 applicable unfinished rows. Its historical source and test receipts retain their original inputs. Neither the inventory, artboards, integrated source, fixture tests nor this preservation note proves whole-product delivery. Current built interaction, per-surface completeness and any remaining installer, deployment or release claims need their own evidence. No new implementation lane, release publication or installed update is initiated by this record.

## This preservation patch

The old native server test file changes only the local catalogue identifier to its descriptive form at its two catalogue-test sites, preserving expressions and behavior. The focused command `node --test apps/desktop/electron/services/game-servers/index.test.cjs` passed all 11 tests with zero failures. No runtime algorithm changed. No full desktop, Rust, GUI, installer or deployed verification was rerun for this identifier-only edit.

Keep this checkout, its history and its private ignored announcement images intact. No deletion, branch retirement or network push was performed by this preservation patch.

