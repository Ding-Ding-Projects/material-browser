# Personal wording import outcomes

Settings upload and window drop use the same validated local JSON import handler. Invalid
input preserves the previous stored wording; clearing restores original labels. Imported
text stays local and must not enter notification history, logs, exports or public records.

## Repeated imports and timer ownership

Each successful import cancels its previous celebration timer and owns a new three-second
interval. Unmount disposes the timer; a late file read cannot schedule another celebration
after unmount. Invalid input or failed persistence does not replace an earlier successful
timer. This repair does not change audio behavior.

The original defect was reproduced with the actual production handler and controlled time:
imports at 0 ms and 2000 ms left an old timeout that dismissed the second celebration at
3000 ms, after only 1000 ms. The built baseline also reproduced early dismissal through
synthetic DragEvent input into the real handler. The applied mapping remained correct.

## Verification and unfinished audio

Three executable production-handler checks passed after the repair, with two red cases
before it. They cover latest-import duration, invalid input/persistence failure, unmount and
late reads. TypeScript passed. Post-repair build/runtime acceptance remains pending under
[issue 28](https://github.com/Ding-Ding-Projects/material-browser/issues/28).

The baseline passed valid neutral upload, invalid-input preservation, renderer-reload
persistence and clear/reset through synthetic File/change/DragEvent input. Native picker/drop,
full-process restart and reduced-motion acceptance remain unverified.

Successful imports still omit the required native outcome-cue request. Correct Windows tada
delivery, invalid-input feedback, mute/volume/quiet preferences, unavailable-audio behavior
and actual playback verification remain open in
[issue 27](https://github.com/Ding-Ding-Projects/material-browser/issues/27). A generic saved
notification or synthesized chord does not establish that outcome. Imported wording must
never be copied into a notification merely to obtain an audio cue.
