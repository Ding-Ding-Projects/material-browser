# Snapshots and conflict recovery

## Create and restore a revision

Use the application's snapshot action and inspect the returned immutable revision. Never manually copy a live browser profile and label it consistent. A running browser needs the supported restricted snapshot protocol; otherwise stop the browser before snapshotting.

Before restoring, preserve the current revision and stop the active browser. Choose the exact revision, review its identity and confirm through the supported restore workflow. Cross-machine restoration and live consistency remain unverified unless the target engine and source combination have actual runtime evidence.

## Synchronization conflicts

Concurrent revisions preserve both parent relationships and both versions. Compare the two named revisions. Keep the version you intend through the explicit resolution workflow, retaining the other as history where supported. Never merge browser databases, infer a winner from modification time or silently overwrite a conflicting revision.

When an operation fails, keep both copies and retry only after resolving the stated cause. The documentation's conflict diagram explains these choices; it performs no synchronization.
