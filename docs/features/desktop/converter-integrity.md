# Converter data preservation

The converter preserves every supported CSV field even when a repeated header's generated
suffix matches another literal header. It reserves the complete normalized header namespace
before allocating unique names. Special names such as `__proto__` and `constructor` are
ordinary enumerable own data fields and survive JSON serialization without changing the
record's prototype.

Every conversion records the expected output byte length and SHA-256 before writing. The
read-back checks both before the existing format-specific checks. Matching row counts or
image dimensions alone do not establish matching content.

## Cancellation and file placement

The queue retains the created output's file identity. On cancellation or verification failure,
it compares path/open-file identity, timestamps, size and expected content, and rechecks the
path before removal. Observed replaced or modified files are retained. An unchanged owned
output is removed by the tested cancellation path.

These Node filesystem checks and the final unlink are not atomic against arbitrary concurrent
external writers. This is bounded preservation checking, not an absolute replacement-protection
guarantee or a native handle-based deletion protocol.

Successful hard-link or exclusive-copy placement leaves the retry scope before bookkeeping
and temporary-file cleanup. A temporary unlink failure cannot generate another final output.
It may retain the owned temporary file while the valid final output is successfully returned.
No claim is made that every filesystem cleanup fault removes every temporary file.

## Verification and limits

Five causal regressions failed against the prior source, then passed with the repair. The
existing converter suite plus the new integrity suite passed 21 tests; an independent reviewer
reran the same 21 tests successfully. Cases cover duplicate/generated headers, special fields,
same-row output changes, cancellation with a replacement destination, unchanged-owned
cancellation, and an injected post-placement temporary-unlink fault.

These are executed native-module checks using synthetic files, not complete built-interface
or image-codec acceptance. No actual user-file loss or hostile activity was observed. See
issues [19](https://github.com/Ding-Ding-Projects/material-browser/issues/19),
[20](https://github.com/Ding-Ding-Projects/material-browser/issues/20),
[21](https://github.com/Ding-Ding-Projects/material-browser/issues/21) and
[22](https://github.com/Ding-Ding-Projects/material-browser/issues/22).
