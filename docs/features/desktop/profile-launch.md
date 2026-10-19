# Profile launch and identity capabilities

Launch first opens an explanation for the selected profile. Stable browser identity is not
implemented by the current native engine integration, so the saved profile identity cannot
be enforced. Websites may recognize a different browser identity. Standard launch does not
promise anonymity, identity spoofing, stable cross-device identity or portable credentials.

Choose **Launch with standard identity** only when this behavior suits the profile. That
affirmative choice sends one request with the captured profile ID and explicit
`requireStableIdentity: false`. Consent applies only to that launch. Cancel, Close, Escape
or changing the selected profile does not launch. Locking the vault or removing the profile
invalidates pending consent. Repeated activation during submission cannot duplicate it.

The native host keeps its strict default: omitted or true `requireStableIdentity` requests
still fail with `IDENTITY_UNAVAILABLE`. The interface never automatically retries a failed
strict request with weaker requirements. Managed engine registration, hashes, ownership and
automation checks still apply after standard-identity consent. No verified engine means no
launch, with a separate explanation of the missing installation requirement.

Known direct or wrapped IPC codes map to approved English and Cantonese messages before
footer, toast and narration delivery. Unknown exception text becomes a generic localized
message, so native paths and arbitrary exception content are not reflected. The existing
language and message-style settings apply. Focused message tests pass; built consent and
keyboard evidence are pending the source-bound verification run.
