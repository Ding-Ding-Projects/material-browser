# Desktop capture evidence

## Verified candidate

The images below were captured from the packaged desktop at source `7257d2238a6c6a495c84321a98bffc283450af9c` after the exact root `build-installer.bat -Component Desktop` completed successfully. The build ran from `2026-10-18T06:27:02.4686499Z` through `2026-10-18T06:28:26.6975690Z`.

The executable SHA-256 is `4fb75974bc9ff0d7e200c5bb4d4b06715a8cf987e12e350963c74cda8a6826a0`; the application archive is `54a7b6c27490140620bad37754f7282c78a2ce921eee226079c5e0d4aab252fe`; the bundled native host is `c0847da83f8f6cfce08f934520387790e2df399495d160af654351f76ef7264d`.

The captures use a newly created synthetic vault and profile, a named off-screen desktop, an exact single-page debugging target, and complete process ancestry validation. Page dimensions are 1280 by 1000 at explicitly emulated scale 1, not physical display-scale proof. Original PNG bytes were inspected, staged without transformation, independently hashed, read back and validated against the inventory and root README links.

## Setup and productive workspace

![Initial encrypted vault setup](onboarding.png)

The real interface created the encrypted vault and one profile. Optional synchronization was skipped and completion opened the profile workspace. No host response was mocked.

![Profile workspace with saved automation preference](automation-saved.png)

The profile initially had automation Off. Selecting Selenium and saving updated the native host's stored profile, as observed after refresh. Effective mode remained unavailable because this run did not launch a managed browser. The image deliberately preserves that distinction.

## Appearance

![Bilingual settings in dark theme](settings-dark-bilingual.png)

Language and theme were changed through their rendered controls. The measured dark field-label foreground was `rgb(196, 198, 208)` on `rgb(25, 28, 35)`, a contrast ratio of approximately 10.02:1. This measurement applies to that label and background, not the whole interface. Controls use the installed sans-serif stack rather than an unavailable font.

## Verification and limits

Seven focused desktop security and vocabulary tests passed. The shutdown regression was also run against a private intentionally regressed fixture and failed on the original destroyed-window exception. The repaired packaged window closed normally; its root process and named desktop were subsequently absent. A closing debugging connection is not itself process-exit proof.

All three retained capture intervals reported zero observed console errors, unhandled exceptions and page errors. The layout receipt validated the profile grid, detail panel and automation panel against the actual package and capture hashes. These observations cover only their measured intervals, not startup history or native stderr.

The updated-at value remains unavailable. Complete display-scale/language coverage, native installation/update behavior, keyboard-only input, full localization, restart persistence and overall accessibility acceptance remain unverified. Earlier captures are retained privately as superseded observations; a native diagnostic containing a local path is excluded from publication. No release, engine automation execution or two-computer synchronization claim is made.

See [the machine-readable inventory](inventory.json) for exact image hashes and state tuples.
