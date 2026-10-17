# Native command and control API

The native executable owns one `Manager`, one engine registry and one process supervisor. Use
an absolute application data directory. It does not inspect personal browser profiles.

## Desktop and standard input

```text
material-browser.exe --data-dir C:\MaterialBrowserData serve --stdio
```

Keep this process alive. Send one JSON object per line and read one reply per line:

```json
{"id":"list-1","method":"profiles.list","params":{}}
```

Success is `{"id":"list-1","result":...}`. Failure is
`{"id":"list-1","error":{"code":"...","message":"..."}}`.
The maximum input line is 1 MiB. Malformed envelopes do not execute commands. Oversized input
closes the stream. There are no password arguments, secret environment variables or request logs.
Native standard input is a privileged channel, so do not expose it to an untrusted renderer.

## CLI and local daemon

```text
material-browser.exe --data-dir C:\MaterialBrowserData daemon
material-browser.exe --data-dir C:\MaterialBrowserData status
material-browser.exe --data-dir C:\MaterialBrowserData profiles list
material-browser.exe --data-dir C:\MaterialBrowserData profiles create "Work" chromium
material-browser.exe --data-dir C:\MaterialBrowserData profiles launch PROFILE_UUID
material-browser.exe --data-dir C:\MaterialBrowserData profiles stop PROFILE_UUID
material-browser.exe --data-dir C:\MaterialBrowserData vault create
material-browser.exe --data-dir C:\MaterialBrowserData vault unlock
material-browser.exe --data-dir C:\MaterialBrowserData vault lock
material-browser.exe --data-dir C:\MaterialBrowserData call
```

Vault create/unlock/join commands read a JSON object with a `password` string from protected
standard input. Use a parent process with a private pipe and hidden password input. `call` reads a complete envelope from standard input,
including vault, sync and revision methods. Never place passwords in command arguments or pipes
saved to shell history. A running daemon retains the unlocked key between commands. Without a
daemon, a CLI invocation opens a short-lived host, so create/unlock state ends with that command.
For several operations without the daemon, use the persistent stdio process instead.

The daemon binds only `127.0.0.1` on an operating-system-selected port. It creates `api.json` in the
protected data directory containing the process id, URL and fresh bearer credential. The directory
has user-only access. Treat this descriptor as sensitive and never attach it to a support report.
CLI clients read it locally and never transmit its credential to a non-loopback address. A stale
descriptor produces a connection error. Confirm the recorded process has ended before removing it.

HTTP accepts only `POST /v1/call`, an exact `Host` authority, a bearer credential and a bounded
`Content-Length`. It rejects browser `Origin` headers, duplicate headers and transfer encoding.
It sets no CORS allowance. This is a native local API, not an API for websites. Requests are
serialized; a long vault operation can delay other operations. Parsing is isolated across at most
16 workers with an absolute five-second header/body deadline, so an incomplete connection does
not monopolize the accept loop. HTTP is not used on the LAN.
The OpenAPI document and Postman collection in this directory describe only this implemented route.

## Methods and lifecycle safety

Trusted local engine bundles live under the data directory's `engines/chromium` and
`engines/firefox` directories. Each contains its verified `manifest.json`; optional `adapters.json`
maps `selenium` and/or `puppeteer` to the engine's `AdapterRuntime` configuration. It pins absolute
`node` and `helper` paths plus `nodeSha256`, `helperSha256` and `browserVersion`; Selenium also
pins `driver`, `driverSha256` and `driverVersion`. The host bounds this file to 64 KiB and the
engine verifies every hash and driver version. Never obtain this configuration from a renderer or
paired peer. Stock baseline bundles must declare advanced capabilities false and be launched
with the explicit `requireStableIdentity:false` choice; baseline automation proves no native
encryption, live snapshot or stable-identity integration.

The core methods in [the architecture contract](../../architecture.md) are available through all
native transports. The host adds `engines.list`, `profiles.status`, `profiles.launch` and
`profiles.stop`. A profile's stored automation preference supplies the launch mode. Automation
remains off unless explicitly configured. `requireStableIdentity` defaults to `true`; an explicitly
chosen basic launch may send `false`. An unverified native integration returns its capability
error. `profiles.focus` and `devices.list` currently return `CAPABILITY_UNAVAILABLE`.
`automation.endpoint` returns only a running, engine-owned endpoint whose effective mode matches
the stored preference. Turning automation off revokes this lookup immediately, including before
a pending restart. `automation.webdriver` accepts `id`, `verb` (`GET`, `POST`, `DELETE`), an optional
session-relative `path` and JSON `body`; the host supplies the owned WebDriver session id itself.
It cannot create another session or select another profile directory. Paths reject traversal,
encoding and query characters. Requests and replies have explicit size and time bounds.

Paired LAN sessions additionally support `tunnel.open`, `tunnel.exchange` and `tunnel.close` for
engine-owned CDP/BiDi endpoints. All require `id` and explicit method/profile grants. Open returns
`tunnelId`; exchange takes that id plus base64 `data` (at most 32 KiB decoded) and returns base64
data plus `eof`. Empty exchanges poll a response. Each peer connection owns at most four streams;
closing it drops every stream. Every chunk rechecks preference, effective endpoint and current
grants. WebDriver raw TCP tunnels are rejected, use the session-confined command instead. No
client-supplied host, port or URL is accepted.

The native forwarding client connects a standard Puppeteer client through that framed transport:

```text
material-browser.exe --data-dir C:\ClientIdentity lan-forward 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID
```

Create the client identity with `pair-key`, pair both public keys out of band, and grant the
client exact `tunnel.open`, `tunnel.exchange`, `tunnel.close` methods plus the profile id on the
server. The private key stays in the client's protected data directory. The command prints one
JSON line containing a local `ws://127.0.0.1:PORT/...` URL for `puppeteer.connect`'s
`browserWSEndpoint`. Keep it alive while connected. It binds only loopback, opens at most four
local streams and uses the paired encrypted transport for the LAN hop. Other local processes
under the same account can use that loopback endpoint, so run it only while needed. Browser
interoperability remains unverified until exercised with a matched engine bundle.

For an existing Selenium session, use the session-confined relay instead:

```text
material-browser.exe --data-dir C:\ClientIdentity lan-webdriver 192.168.1.20:8788 SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY PROFILE_UUID
```

Grant `automation.endpoint` and `automation.webdriver` for that profile. This prints a loopback
HTTP URL and the owned `sessionId`. The example [paired-selenium.py](../../../examples/paired-selenium.py)
attaches an ordinary Selenium client to that existing session. Creating a new session through the
relay is rejected. The relay accepts only the owned session path, exact loopback Host and bounded
JSON requests, with no browser-origin or transfer-encoding fallback. Host lifecycle operations
retain ownership, so examples do not quit the managed session behind the host's back.

`operations.list` returns the latest 128 snapshot, restore, synchronization and password-change
attempts in this host process. Each has a random operation id, method, actual terminal state and
start/terminal events with Unix millisecond times. Successful object results include `operationId`.
These calls remain synchronous and serialized, so this is completion history rather than live
parallel progress. Records contain no request parameters, results or exception messages and do
not persist after host exit. LAN access to this global history requires an explicit method grant
and the all-profiles scope.

Snapshot, restore and removal check supervisor state and the engine's exclusive profile lock.
Caller-supplied `running` is overwritten with host-attested state. Locking the vault requires all
owned browser processes to stop and all active-directory locks to be available. A host failure can
leave browser processes alive; recovery must independently establish that they are stopped before
any destructive or snapshot operation. A source-only lock check does not prove crash recovery.

## Explicitly paired LAN control

Generate a native static key once:

```text
material-browser.exe --data-dir C:\MaterialBrowserData pair-key
```

The private key is written using create-new semantics to protected `lan-key`; only the base64
public key is printed. Exchange public keys through a trusted out-of-band channel. Never accept
a key copied from an untrusted WebSocket connection as authorization.

On Windows the host derives the current user's SID from the process identity, replaces the data
directory DACL with a protected user-only rule, and verifies the resulting rules. It separately
protects the local API descriptor and LAN identity file, including pre-existing explicit rules.
Create protected `lan-peers.json` locally with exact method and profile grants:

```json
{"peers":[{"publicKey":"BASE64_32_BYTE_PEER_PUBLIC_KEY","methods":["profiles.list","profiles.status","profiles.stop"],"profileIds":["PROFILE_UUID"],"revoked":false}]}
```

Start with an explicit private IPv4 interface and nonzero port:

```text
material-browser.exe --data-dir C:\MaterialBrowserData lan 192.168.1.20:8788
```

This is native WebSocket transport protected by `Noise_KK_25519_ChaChaPoly_SHA256`, without TLS.
A client sends its paired public key as the first text frame, then the binary Noise KK handshake
message. The server sends the second handshake message. Both handshake application payloads are
empty. Only after the handshake completes may binary encrypted JSON envelopes execute. Each
request and reply occupies one Noise transport message, with a 65,535-byte ciphertext bound.
Plaintext commands, wrong keys, tampered records and replayed records are rejected. Noise provides
authentication and encryption; it does not conceal IP addresses, transport timing or traffic size.

Each method must appear verbatim in the peer grant. Profile methods and revision operations require
an explicitly granted profile id. `profiles.list` is filtered to those ids. Grants are reread before
execution and while connections idle. Setting `revoked` to `true` closes the peer's connection on
the next bounded check. Existing operations that have already begun are not rolled back.
The listener caps concurrent connections at 16 and applies handshake/read/write timeouts. Unknown
peers never reach the core. A native client must pin the server's out-of-band public key as well.
There is no unauthenticated LAN control or plaintext HTTP fallback.

`lan-call PRIVATE_ADDRESS SERVER_PUBLIC_KEY CLIENT_PUBLIC_KEY` reads the same complete JSON
request envelope from standard input and prints one structured reply. Run it with the client
identity data directory to create/unlock the remote vault or manage remote profile lifecycle
through explicit grants. Passwords remain in the protected pipe, never arguments or environment.
The listener owns its own `Host`; do not start another stdio host for the same data directory.
Profile creation and duplication require both explicit method permission and the global `*`
profile scope because they mint new ids. An existing-profile grant cannot authorize either.

## Verification and limitations

Host unit tests cover message bounds, credential comparison, Noise tampering/replay/wrong-key
rejection, exact grants and private-address selection. Loopback HTTP and persistent stdio smoke
checks must be run against the exact built executable. Native/browser integration and LAN
reachability require separate runtime evidence. Unsupported engine capabilities remain unavailable.
The examples use the same stdio envelope, retain one process and place no password in argv.

CLI synchronization and revisions also have dedicated aliases:

```text
material-browser.exe --data-dir C:\MaterialBrowserData vault join C:\SharedCiphertext
material-browser.exe --data-dir C:\MaterialBrowserData sync configure C:\SharedCiphertext
material-browser.exe --data-dir C:\MaterialBrowserData sync push
material-browser.exe --data-dir C:\MaterialBrowserData sync pull
material-browser.exe --data-dir C:\MaterialBrowserData sync conflicts
material-browser.exe --data-dir C:\MaterialBrowserData sync resolve PROFILE_UUID REVISION_UUID
material-browser.exe --data-dir C:\MaterialBrowserData revisions list PROFILE_UUID
material-browser.exe --data-dir C:\MaterialBrowserData revisions restore PROFILE_UUID REVISION_UUID
```

A LAN grant may explicitly name `"*"` in `profileIds` to authorize all profiles. This is required
for profile creation and vault, settings and synchronization methods, because those methods affect
the entire vault. It does not grant any method implicitly. `profiles.status` is filtered like
`profiles.list`. Use specific profile ids for a restricted operator and leave global methods out.
