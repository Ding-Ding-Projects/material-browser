# Storage administration design reference

Status: design handoff, not runtime evidence. Source baseline: `8f479fd`.

## Structure and visual direction

The storage service is a working administration console. A compact left navigation rail carries Overview, Sessions, Guide and Preferences. A persistent top bar carries product identity, live service status, refresh and sign out. At narrow widths the rail becomes a wrapping row above the workspace. Content uses warm neutral surfaces, indigo primary controls, 24 px rounded sections, 16 px gaps, clear outlined fields and at least 44 px interactive targets. Light, dark and system modes share semantic CSS color roles. System fonts avoid remote assets.

Overview shows actual used bytes/quota in a labelled progress meter, stored chunk and revision counts, maximum chunk size, connection address, last successful refresh and the storage trust boundary. No sample records or inferred decrypted filenames appear. Sessions shows actual session identifiers, creation and expiry times, current-session marker and deliberate revoke actions. An inline confirmation names the session and offers Cancel. Revoking the current session returns to pairing.

## Pairing onboarding

1. Explain ciphertext storage and the HTTP risk, require explicit acknowledgement. Never request a vault password.
2. Enter the one-use administration code in a password field with dedicated clear action. Submit to the same-origin pairing API. Retain no code in local storage, URL, logs or history. Show a generic localized failure, not raw server text.
3. Read the authenticated session and statistics, then open Overview. Back preserves non-secret progress only. An existing valid cookie restores the session without asking for a code again.

HTTP does not authenticate the server or protect administration traffic. A network attacker can intercept administration sessions or modify the page. Ciphertext storage does not remove that risk. Use only a trusted isolated LAN. The console does not decrypt or accept vault passwords.

## Hosting companion

A dedicated desktop wizard has Check, Configure, Review and Start steps with Back/Next. Check reads actual Docker daemon and Compose readiness. Configure provides validated host port and native storage-folder browsing, plus a protected one-use administration code field. Review shows only non-secret choices and the HTTP boundary. Start sends protected input over stdin to the supported host script, reports real process progress and health results, and offers cancellation without deleting existing data. Completion opens the verified endpoint only through an explicit button. The companion bundles host resources and uses a portable executable target. No privileged action occurs automatically.

## State and accessibility inventory

| ID | Surface/state | Action and proof |
| --- | --- | --- |
| pairing-risk | Initial trust explanation | Acknowledge and Next; keyboard focus moves to heading |
| pairing-code | Protected code input | Clear, Back, submit; no persistence of code |
| pairing-error | Rejected/expired code or network unavailable | Localized live status; input cleared; retry available |
| overview-empty | Zero stored objects | Genuine zero counts, no fabricated activity |
| overview-loaded | Nonzero storage | API values and accessible quota meter |
| overview-offline | Fetch failure after prior success | Stale values explicitly labelled; retry |
| sessions-loaded | Sessions and current session | Revoke confirmation, cancellation and refresh |
| guide-task | Pair/connect/recover walkthrough | Visitor-owned progress retained locally, clearly not execution proof |
| preferences | Language, theme, density, motion | Persisted local state; reset restores defaults |
| hosting-check | Missing or ready runtime | Actual command results; no invented installation |
| hosting-configure | Valid/invalid port, folder and code | Native browse, clear, validation, Back/Next |
| hosting-progress | Pull/start, failure or cancelled | Bounded actual child operation, truthful retained-container state |

English, Cantonese and bilingual labels are required. Bilingual secondary copy wraps naturally. Normal reference tuples: 1440×900 dashboard and 1100×760 wizard; minimum dashboard 320 CSS px and wizard 720×600. Verify light/dark, three languages and 100/125/150/200% scales. Respect reduced motion; all status changes use polite live regions. Tab controls use roving keyboard navigation. Every input has a visible label and clear action; errors identify recovery. This document does not claim the full universal feature inventory or capture matrix is complete.

## Verification handoff

Independent review accepted the direction with these required corrections. The implementation uses the official `@material/web` registered `md-filled-button`, `md-outlined-button`, `md-text-button`, `md-outlined-text-field`, `md-checkbox`, `md-tabs`, `md-primary-tab` and `md-linear-progress` primitives, bundled locally with their transitive modules. Navigation rails, supporting containers and status text use the documented Material semantic color, spacing, shape and typography roles around those primitives. Native dialog provides modal focus management; confirmation actions use registered buttons. No remote fonts or scripts are loaded. Preferences has independent tabs, with local search and an adjacent bounded regex workbench. Version comes from the actual health endpoint; updated-at is explicitly unavailable until source-bound build metadata exists.

Hosting progress consumes only bounded structured NDJSON records; raw child output never reaches the renderer. Cancellation retains containers and data. Non-secret setup choices and step progress persist locally, while launch readiness is always rechecked against actual Docker and Compose state on resume. Pairing codes are never persisted. Host launcher resources are copied to the companion's durable private application-data directory before execution so extracted portable resources do not own the persistent configuration.

Independent design review precedes implementation. Runtime capture belongs to the integrating owner and must bind actual service/build identity, viewport, theme, language, scale and source. Public screenshots must exclude pairing codes, cookies and private local paths. The API's static allowlist is index.html, app.js and styles.css, so browser code and styles remain in those files without CDN dependencies.
