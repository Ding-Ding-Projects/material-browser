# Super Profiles

Super Profiles are encrypted reusable templates for disposable guest environments. See the
[complete workflow and verification boundaries](../docs/features/desktop/super-profiles.md).

Start in the desktop's Super Profiles workspace after unlocking the vault. Configure a
template, inspect actual host capabilities, then make an explicit launch choice. Template
storage does not mean guest provisioning or visual readiness has been verified. Explicit
save-back produces a new revision; browser credentials are not promised to be portable.

Ordinary browser profiles remain separate. Super Profile archives are local-only and do not
participate in browser folder synchronization.

Save-back queues collection before encrypted finalization. If the vault locks or the host
restarts meanwhile, review and confirm that exact collected operation after unlocking.
Stop and discard are available through the native API while locked; their responses omit
template identifiers, revision identifiers and staging paths. A successful encrypted save
and incomplete cleanup are separate results, so retrying cleanup must not create a second
revision.
