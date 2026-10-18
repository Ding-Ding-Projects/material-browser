# Managed Chromium profile key prototype

This source candidate targets upstream revision
`0e66b94549a8bd85f03fbdf189b752d6e7b63c32` (155.0.8059.85).
The reviewed patch registers a required asynchronous encryption provider with no
platform-key fallback. It is not a credential importer. Only newly created,
application-owned synthetic profiles may be used while verification is pending.
Portable encryption and live snapshots remain disabled.

## Protected local channel, version 2

The browser requires explicit `material-profile-key-mode=managed-v2`,
`material-profile-key-pipe`, `material-host-pid`, `material-host-created`,
`material-profile-id` and `user-data-dir` routing arguments. None contains a key.
The provider compares the pipe's OS-observed server PID and process creation
FILETIME with the expected host identity. It admits only local pipe names and
explicit local drive paths. A fresh 32-byte cryptographic nonce binds each reply.

All integers are little-endian, with no structure padding. A request contains:

| Field | Bytes |
| --- | --- |
| Magic `MBKREQ`, zero, version 2 | 8 |
| Fresh nonce | 32 |
| Client PID | 4 |
| Client creation FILETIME | 8 |
| Profile path UTF-16 code-unit count | 2 |
| Lowercase UUID profile identity | 36 |
| Profile path, UTF-16LE, no terminator | count times 2 |

The reply is exactly 72 bytes: `MBKREP`, zero, version 2 (8 bytes), echoed nonce
(32 bytes), then AES-256 key (32 bytes). Truncation, excess bytes, wrong version
or wrong nonce fails closed and wipes the output. The provider consumes the key
once, constructs the upstream encryption key, then wipes the transport buffer.
It does not log the key, write it to disk, or accept it through arguments or the
environment. The previous synchronous unbounded read is replaced by explicit
nonblocking message mode under one deadline, at most 30 seconds, including
connection retries. Byte pipes and partial writes are rejected. See Microsoft's
[named-pipe wait-mode semantics](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-type-read-and-wait-modes).

## Broker obligations and incomplete integration

Request headers are not authorization. Before releasing a key, the production
broker must independently observe the client PID and creation identity, prove
the complete managed process/job association, verify the executable hash and
resolve the exact authorized profile filesystem identity. It must own the
profile from its first creation, retain its key in the product's protected
storage, enforce one request/reply per launch and reject duplicates/replays.
The pipe must use an owner-specific protected ACL, reject remote clients and
reserve its first instance. These production broker and lifecycle operations
are not implemented by this transport header. The synthetic fixture demonstrates
only its own owner-specific ACL and OS-observed peer checks.

No browser credential persistence, restart or transfer proof exists yet. A full
proof must create synthetic credentials in a new managed profile, stop all
writers, retain the same protected key through supported storage, restore to
another owned synthetic location and verify the native browser can use the
synthetic credentials. Copying a profile folder alone is not portability proof.

## Native transport fixture

`build.bat -Component BrowserNative -NativeEngine chromium -NativeChromiumChannelTests`
builds and runs the standalone Win32 fixture through the installed MSVC/SDK.
It does not acquire Chromium dependencies or build Chromium. Run it on the
supported named hidden desktop. Tests cover real local message exchange,
OS-observed identities, wrong scope, stale challenge, timeout, malformed frames
and output wiping. A passing fixture does not prove Chromium provider compilation.

## Optional updater test source exclusion

Upstream DEPS references `chromium/third_party/updater/chrome_win_x86` through both
`chrome_win_x86/cipd` and `chrome_win_x86_sans_iid/cipd`. The managed acquisition
configuration excludes both with supported `custom_deps: None` entries. The
first path is data in `chrome/updater:updater_test_sources`, a test-only target,
and only in its x86 branch. Neither payload is required by the requested
unbranded x64 browser target. Preserve the host scanner verdict and do not
retrieve either excluded payload or weaken protection. Complete acquisition,
GN graph validation and Chromium compilation remain unverified until their
actual root build receipts exist.
