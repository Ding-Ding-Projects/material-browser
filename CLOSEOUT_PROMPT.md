# Continuation handoff

Objective: configure Windows build and release automation for Material Browser.

The new `.github/workflows/release.yml` builds on every branch push and manual dispatch
using `windows-2025`, Node 26.4.0 and Rust 1.96.1. It calls the existing root installer
entrypoints for Desktop and DocsCompanion, publishes uniquely tagged normal development
releases without changing the accepted latest channel, and retains safe output evidence.
Tests and lint do not run in Actions. Local builds retain TypeScript checking, while the
workflow selects Vite bundling directly through `MATERIAL_BROWSER_BUNDLE_ONLY`.

`scripts/publish-release.ps1` requires real Squirrel outputs and the portable handbook,
records SHA-256/size metadata, verifies the published tag and assets, and records workflow
timing. PowerShell syntax parsing and whitespace validation passed. The first hosted build
is pending; installer production, publication and fresh-image bootstrap are not yet proven.
No application runtime or installed update verification is claimed.

Documentation: `docs/features/delivery/windows-automation.md`, README, ROADMAP, HANDOFF and
the bundled wiki index. The existing public documentation deployment remains unchanged.

Next: inspect the first Actions run, repair any build/package/publication failure within
this scope, read back its normal release and expected assets, and update verification state.
Existing recovery branches and linked working trees belong to other work and remain intact.
No task-owned branch, linked working tree or stash was created, so no deletion is needed.

Latest correction: first hosted run 39193430232 built the desktop installer but failed handbook
packaging when automatic publication was inferred from credentials. Handbook publication is
now disabled inside the packager. User steering adds the installed application/installer icon:
reviewed vector source, PNG and seven-size ICO are wired into executable/window/setup/handbook.
Syntax and ICO inventory checks passed. Rebuild and release readback remain pending.

Latest state: the second run built both installers and published normal release
build-2-39194115797-1, but source a6b4a78's publisher readback failed on GitHub's space-to-dot
asset renaming. Safe upload staging and collision detection now repair that behavior.
All four focused publisher fixture paths pass, including a filename containing a space.
The exact local Desktop installer build passed and embedded icons were inspected in both
application and setup executables. A new hosted run must confirm final publication success.

Latest user steering: repair the desktop Launch IDENTITY_UNAVAILABLE notification shown in
the user's screenshot. The UI omitted a required capability decision and exposed raw IPC
text. Source now provides deliberate per-launch standard-identity consent, leaves the native
strict default intact, binds consent to the selected profile, invalidates stale consent,
prevents duplicate submissions and localizes approved error messages. Three focused tests
pass; exact candidate build and real interaction verification remain pending. Automation is
now independently verified by successful run 39195138374 and release build-3-39195138374-1.
