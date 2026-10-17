# Storage HTTP API

All paths use exact configured Host values. Browser requests with an Origin must match the HTTP origin exactly. No wildcard CORS or arbitrary filesystem route exists. Responses disable caching and send a restrictive Content Security Policy. Diagnostic failures omit filesystem paths and internal exceptions.

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /health` | None | Minimal status, version and HTTP transport label |
| `POST /api/pair` | JSON `{secret}` containing the host-issued one-use pairing code | HttpOnly SameSite Strict session cookie; JSON `{id,csrfToken,expiresAt}` |
| `GET /api/session` | Session cookie | Current id, creation/expiry timestamps and csrfToken |
| `GET /api/stats` | Session cookie | `{bytes,chunks,revisions,quotaBytes,maxChunkBytes}` |
| `GET /api/sessions` | Session cookie | Session ids and creation/expiry timestamps, with current flag |
| `DELETE /api/sessions/:id` | Session cookie and `X-CSRF-Token` | Revokes the specified session immediately |
| `POST /api/logout` | Session cookie and `X-CSRF-Token` | Revokes current session and clears its cookie |
| `PUT /api/vaults/:vault/chunks/:sha256` | Encrypted octet bytes, Content-Length, cookie and CSRF | Publishes immutable object only after size/hash verification and flush |
| `GET /api/vaults/:vault/chunks/:sha256` | Session cookie | Encrypted octet bytes |
| `PUT /api/vaults/:vault/revisions/:sha256` | Same as chunk upload | Immutable encrypted revision envelope |
| `GET /api/vaults/:vault/revisions/:sha256` | Session cookie | Encrypted revision envelope |
| `GET /api/vaults/:vault/head` | Session cookie | `{revisionId}` or null |
| `PUT /api/vaults/:vault/head` | JSON `{revisionId,expectedHead}`, cookie and CSRF | New head, only if immutable revision exists and expected head matches |

Vault identifiers and object identifiers are exactly 64 lowercase hexadecimal characters. Object identifiers are SHA-256 over ciphertext. Head values expose only opaque revision identities. These routes provide administration access to ciphertext; they are not a native-client bearer API. No route uploads passwords, lists the host filesystem, deletes arbitrary paths or accepts command text.

Expected failures include 400 for invalid metadata, 401 for missing/revoked/expired authentication, 403 for Host/Origin/CSRF rejection, 404 for an unavailable object, 409 for a head conflict, 413 for bounds, 422 for a content mismatch, 429 for resource/rate limits and 507 for quota exhaustion. A non-success status never acknowledges durable publication.
