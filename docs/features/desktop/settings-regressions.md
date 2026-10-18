# Settings state-transition regressions

The first categorized Settings candidate exposed nine defects during independent review. This ledger records the concrete transitions and separates pure-model proof from built-interface acceptance. None of these results establishes complete Settings feature coverage.

| ID | Required transition | Shared implementation and focused test | Current evidence |
| --- | --- | --- | --- |
| R1 | Delete the last schedule, narrow a history filter, or dismiss the last unread notification without stale search indices selecting a different record or crashing | `interaction-model.mjs`, stable key snapshots in `Search.tsx`, `settings-regressions.test.mjs` | Model cases pass; deliberately regressed identity resolver fails; new built transitions pending |
| R2 | A → B → C; Undo → B → A; Redo → B → C; a new edit after Undo clears Redo while retaining the audit | `history-model.mjs`, `store.ts` | Model sequence passes; old second-to-last toggle fails; new built sequence pending |
| R3 | Rename an imported disabled rule with multiple values without enabling it or losing untouched values | `preserveScheduleEdit`, schedule editor | Model case passes; enabled/single-value regression fails; new built import/edit pending |
| R4 | Load a valid current preferences record despite malformed unused legacy appearance JSON | `readStoredPresentation`, store initialization | Model case passes; eager legacy parse fails; new built reload pending |
| R5 | Reveal a setting excluded by the current section filter without discarding that filter | `revealSettingKeys`, Settings workspace | Model case passes; hidden-target regression fails; new built focus proof pending |
| R6 | Give two automatic voice selectors distinct names identifying their owning fields and current values | `choiceAccessibleName`, shared picker | Name model passes; value-only regression fails; rendered accessibility-name proof pending |
| R7 | Clear a numeric field and retain a partial color draft while preserving the last valid saved value | `parseNumericDraft`, draft field controls | Validation cases pass; old ignored-blank behavior fails; rendered draft/focus proof pending |
| R8 | Mount workspace and accessibility-dialog copies of the same setting without duplicate target/help IDs | `settingInstanceId`, shared control | Instance model passes; fixed-ID regression fails; simultaneous DOM proof pending |
| R9 | Keep an active bilingual continuation and queued critical messages when routine messages arrive | `speech-queue.mjs`, narrator consumer | Queue-order case passes; replace-whole-queue regression fails; actual audio delivery remains unverified |

The local negative runner exercised one deliberate regression for each ID and observed all nine fail their intended assertion. Restored source passed all nine cases. The combined focused desktop, native bridge and font/editor checks passed 39 tests. Runtime records from the earlier candidate remain bound to that earlier source and are not relabeled as proof for these repairs.

Settings controls, pure validation, persistence, history transitions, speech queue and privileged IPC are separate modules. The current browser-storage history remains an interim local feature until the independently protected native history service is connected and verified.
