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
