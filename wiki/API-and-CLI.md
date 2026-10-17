# API and CLI reference

The native host exposes a shared command dispatcher. The authoritative current method inventory is in [Architecture](../docs/architecture.md).

## Request envelope

```json
{"id":"example-1","method":"profiles.list","params":{}}
```

Success returns `id` and `result`. Failure returns `id` and an `error` object with `code` and `message`. This is a protocol example, not a network request made by this page.

## Profile preference example

```json
{"id":"example-2","method":"profiles.update","params":{"id":"YOUR_PROFILE_UUID","automation":"off"}}
```

Use the exact parameter contract supported by the installed host. Capability-dependent lifecycle and automation operations may be unavailable. A response example must never be treated as a successful real operation.

## CLI safety

Run the installed host's help command to inspect its actual flags before issuing commands. Secrets belong on the supported protected standard-input or local IPC route, never argv, environment variables, command history or logs. This handbook deliberately does not invent a command line whose flags have not been verified against the installed build.
