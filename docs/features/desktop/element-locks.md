# Element locks, unlock ladder and Support Tickets

Element locks put a second, playful key on a profile or a Settings section. They are deliberately not a security boundary: the encrypted vault is. The interface says so wherever a lock is created.

## Creating a lock

Open a profile's menu and choose **Lock this element…**, or go to **Settings → Locks and authenticator** and pick a profile or Settings section. Choose exactly one of six ways to unlock it:

1. PIN (4 to 12 digits)
2. Password (at least 6 characters)
3. PIN and password
4. Password and authenticator code
5. PIN and authenticator code
6. Password, PIN and code

For authenticator codes the dialog shows a new secret and a copyable `otpauth://` setup link. The lock is saved only after a current six-digit code from the authenticator app is entered, so the time on both devices is checked up front. Codes follow RFC 6238 (SHA-1, 30-second steps, six digits) and accept one step of clock drift either way.

PINs and passwords are stored only as salted PBKDF2-SHA-256 digests. The plain values never leave the dialog.

## Opening a locked element

Launching, renaming, stopping or deleting a locked profile, or opening a locked Settings section, first asks for its unlock. A successful unlock lasts for the session and ends when the vault locks.

## The unlock ladder

Five wrong attempts start a four-minute wait. During the wait the **Play your way out** dialog offers four rungs: Dim sum (name the dish), Sums (ten additions), Moles (tap eight moles) and Clock (read an analogue clock). Finishing any rung clears the waiting time, never the lock itself. At most three rungs can be finished per hour; after that the wait ends on its own.

## Support Tickets

**Locked out?** opens Support Tickets, a local desk of one. Submitting a ticket records it on this computer and answers it straight away with the location of the lock folder and a button to open it. Removing that folder resets every lock. The vault is not in it, so no profile data is affected. Nothing is sent anywhere.

## Storage

Locks and tickets are written by the Electron main process to `element-locks/` inside the application data folder, separate from the `vault/` folder. The IPC channel accepts only `read`, `write`, `folder` and `open` from the trusted renderer frame, only the `locks` and `tickets` stores, objects only, and at most 256 KB per store.
