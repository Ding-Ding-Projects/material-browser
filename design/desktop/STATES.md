# Desktop screen and state inventory

Inventory baseline: `0b68532159e3e821f44cbc1549ffa170806d8b94`. Each comma-separated state suffix below denotes a separate coverage case, prefixed by the row ID. No state is marked verified. Variants dependent on actual host capabilities must be recorded as blocked when unavailable, not simulated as production evidence. Existing behavior and explicit unavailable disclosures remain in scope.

| ID | Surface / concrete states | Action entry and owning source |
| --- | --- | --- |
| SH | connected, locked, backend-unavailable, empty-tabs, open-tabs, active-tab, narrow-navigation-open, narrow-navigation-closed | Shell.tsx; main.tsx: navigation, setup, lock, catalog, activate/close tab |
| PR-L | empty, populated, loading-or-refresh-pending, filtered, no-match, sorted, one-selected, multiple-selected, action-pending, partial-success, failed | ProfilesWorkspace.tsx; ProfileTable.tsx: refresh, search/regex, engine filter, sort, selection and supported batch actions |
| PR-O | overview, observed-running, observed-stopped-or-unavailable, narrow-detail, width-control | ProfileInspector.tsx: select row, Back, inspect real fields, resize |
| PR-R | revisions-loading, revisions-empty, revisions-populated, revisions-filtered, revisions-failure, snapshot-pending | ProfileInspector.tsx: revisions tab, search/regex, refresh, snapshot, restore review |
| PR-A | saved-on, saved-off, effective-known, effective-unknown, restart-required, pending, failure | ProfileInspector.tsx: automation tab and existing update callback |
| PR-F | create, create-invalid, create-password-manager, create-pending, create-failed, rename, duplicate | main.tsx; ProfilesWorkspace.tsx: actual profile/manager fields and named actions |
| PR-D | launch-consent, stop-review, remove-review, restore-review, cancellation, failed-confirmation | ProfileLaunch.tsx; ProfilesWorkspace.tsx: named targets and actual consequences |
| SP-L | empty, populated, filtered, no-match, selected, refresh-pending, failed | SuperProfiles.tsx: template list/search, refresh, create, select |
| SP-O | overview, capabilities-available, capabilities-unavailable, active-session-restrictions, narrow-detail | SuperProfiles.tsx: inspector, edit/delete/launch eligibility |
| SP-S | sessions-empty, provisioning, running, readiness-unknown, stopped, retained-output, collecting, saved, cleanup-pending, locked-finalization | SuperProfiles.tsx: Sessions tab and existing lifecycle observations |
| SP-R | revisions-empty, revisions-populated, current-revision, restore-eligible, restore-blocked | SuperProfiles.tsx: Revisions tab and actual revision checks |
| SP-W | template, environment, startup-files, review, edit, resume-valid, resume-invalid, metadata-save, capability-checking, capability-failed, save-pending, save-failed | SuperProfilesWizard.tsx: four steps, WSL/Sandbox variants and preserved backend-specific drafts |
| SP-D | launch-consent, save-preview-loading, save-preview-ready, save-preview-failed, save-categories-selected, stop, discard, delete, restore, finalize-exact-operation, cancel | SuperProfiles.tsx: review dialogs and preview/revision identity |
| SY | folder-missing, folder-configured, chooser-canceled, upload-pending, download-pending, success, failure, conflicts-empty, conflicts-populated, filtered, no-match, candidate-review, resolve-pending, resolve-failed | Synchronization.tsx: actual chooser/upload/download/refresh/resolve |
| SU | vault-create, vault-unlock, vault-join, backend-unavailable, invalid-password, pending, failed, chooser-canceled, profile-create, synchronization, synchronization-skip, ready, resume | Onboarding.tsx: four steps and setup persistence |
| ST-L | language, voice-unavailable, voice-loaded, narration-sample, narration-queue, wording-empty, wording-loaded, wording-invalid | SettingsWorkspace.tsx; effects.ts; speech-queue.mjs: Language and voice |
| ST-A | theme-dark, theme-light, theme-system, theme-contrast, fresh-default, saved-choice, font-density-scale, motion, appearance-overrides | SettingControl.tsx; effects.ts: Appearance |
| ST-X | accessibility, target-size, focus, reduced-motion, hide-entry-review, restore-entry | SettingsWorkspace.tsx; SettingControl.tsx: Accessibility |
| ST-F | focus-default-off, dim-navigation, reduced-stimulation, elapsed-time, next-action, idle-reminder, snoozed | LiveTools.tsx; SettingControl.tsx: Focus and time |
| ST-N | notification-empty, notification-populated, unread, selected, filter, dismiss, bulk-dismiss, export, quiet-hours, sound-on, sound-off, sound-preview, audio-unavailable | NotificationCenter.tsx; settings effects: Notifications; sound states are requested additions |
| ST-S | schedule-empty, schedule-edit, valid, invalid, overnight, precedence-active, unavailable-external-source | Schedules.tsx: Schedules |
| ST-H | history-empty, history-populated, filtered, undo-redo, restore-preview, import-valid, import-invalid, export, protected-locked, protected-unlocked, native-unavailable | HistoryTransfer.tsx; ProtectedHistory.tsx; HistoryAccess.tsx: History and transfer |
| ST-P | privacy-access, protected-confirmation, unavailable-capability | SettingsWorkspace.tsx; ConfirmAction.tsx: Privacy and access |
| ST-T | integration-configured, integration-unconfigured, integration-unavailable, integration-test-pending, integration-test-failed | EditorIntegration.tsx: Tools and integrations |
| ST-B | about, coverage-available, coverage-unavailable | SettingsWorkspace.tsx: About and coverage, real version and capability facts |
| ST-NAV | dock-top, dock-right, dock-bottom, dock-left, grouped, pinned, closed-restorable, reordered, overflow, narrow-disclosure, global-find, local-find, no-match | SettingsTabs.tsx; tab-model.mjs; docked-tabs.mjs: retain axis-aware keyboard navigation |
| ST-ROW | inherited-value, base-value, scheduled-override, changed-value, reset, explanation-open, practice-unsaved, practice-invalid, practice-reset, practice-close, practice-reopen-isolated, save-failed | SettingControl.tsx; useSettingsPersistence.ts: preserve value provenance and practice separation |
| CAT | open-empty-query, results, no-match, regex-open, regex-invalid, destination-activation, escape-close | main.tsx; Search.tsx: catalog and independent search workbenches |
| OV | modal-open, modal-long-content, confirm-disabled, pending, error, canceled, focus-restored, notification-toast, keyboard-help, narration-controls | components.tsx; main.tsx; settings tools: cross-cutting overlays |

All screen/state IDs inherit the theme/language/viewport/scale matrix in `worldlens-handoff.md`. Include long real localized labels, long safe IDs/paths, forced colors and reduced motion in relevant cases. Fixtures must be identified as fixtures; no invented profile rows, dates, runtime observations or counts may appear as genuine product output. Native host ownership, access epochs and safety checks are not replaced by renderer layouts.

The retained adjacent regex editor does not establish completion of the separate full shared regex-workbench contract. Likewise, unavailable protected history or integration capabilities remain coverage gaps, not newly claimed implementations.
