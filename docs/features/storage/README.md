# Optional ciphertext storage service

The optional storage service keeps immutable encrypted objects and opaque revision references. It never accepts vault passwords, profile keys, unlocked browser data or unencrypted snapshots. Encryption and revision validation happen in the native client before transfer. The browser dashboard administers capacity and sessions; it does not unlock profiles.

- [Hosting, pairing and security boundaries](hosting.md)
- [HTTP storage API](api.md)

The HTTP API has no Postman collection because administration requires a browser-scoped session and a one-use local pairing ceremony. The documented request shapes are intended for integration tests and the bundled dashboard.
