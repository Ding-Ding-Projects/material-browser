# Storage setup verification record

Source: `815045eb1394addce3e96c5c8c857f82078c388d`.

Build entrypoint: `build-installer.bat -Component HostingWizard`, exit 0.

Output: `Material-Browser-Storage-Setup-0.1.0-x64.exe`, 100,321,184 bytes.
SHA-256: `6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5`.
Authenticode status: `NotSigned`.

## Observed behavior

- The actual portable executable launched on a named hidden desktop with an isolated profile.
- The installed direct low-level tool performed the launch; a strict process-ancestry and single-page CDP helper drove renderer controls.
- Next before a successful runtime check stayed on the first step and displayed a corrective message.
- The actual Docker/Compose check reported unavailable runtime. No installation or successful setup was claimed.
- Language and theme changes worked. A separate fresh process restored bilingual/light preferences from the same isolated profile and required a fresh runtime check.
- The 720 × 600 CSS viewport with scale 1.5 had no horizontal document overflow. It remained vertically scrollable.
- Prospective console, exception and page-log observations reported zero errors during the bounded interaction intervals only. Startup and native stderr are not covered by those counts.
- Both launch processes and their exact hidden desktops were absent after the owned renderer close action. Background Alt+F4 did not close the first launch; no PID termination was used.

## Remaining evidence

The local Docker daemon was unavailable. Successful readiness, configuration validation, later Back/Next actions, pull/start, cancellation, native folder browsing, actual LAN delivery and the full theme/language/scale matrix remain unverified.

Raw captures and private lifecycle receipts were retained outside the published inventory. Pixels were inspected and contained only setup UI. They are not promoted here because the run lacks a contemporaneous build-timing receipt required by the evidence promotion contract. No image was reconstructed or relabelled as accepted runtime evidence. Capture timing was measured by the CDP producer, but missing build timing remains missing.

The portable executable and generated runtime files remain excluded from source control. Release publication, remote image deployment and repository integration are separate verdicts.
