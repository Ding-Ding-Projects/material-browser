# Material Browser development

## Agent conversation vocabulary

Agents working in this repository use the shared private conversation vocabulary defined in
the maintainer's canonical agent instructions for every reply, including chat prose, visible
reasoning, status lines, and task or session titles. Read those instructions and apply them
in full. They are deliberately not restated here, because this file is part of this
repository's public record.

That vocabulary never appears in anything published. Keep it out of commit messages, branch
names, code, code comments, test names, documentation, this file, issues, pull requests,
discussions, release notes, published sites, logs, and every other file in this repository.
Published writing uses ordinary professional English, and exact technical identifiers always
keep their literal spelling. The single documented public-safe exception is named in those
canonical instructions; do not infer any other.

Scan any text bound for a public surface against that vocabulary before publishing it. A
reviewer cannot tell a correct release note from a leaking one by reading it, so the scan is
a step, not a habit.

## Product facts

Material Browser is a Windows x64 profile manager with an Electron shell, React/TypeScript
interface, Rust core, managed Chromium/Firefox adapters and optional containerized encrypted
storage. Automation is opt-in per profile and persisted. Never claim unsupported engine
features, cross-machine restoration, live snapshot consistency or deployment verification.

The public architecture contract is in docs/architecture.md. Builds enter through build.bat;
installer production enters through build-installer.bat. Tests run locally, not in CI.

