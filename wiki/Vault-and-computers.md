# Vault and computer setup

## Create a vault

Choose a dedicated application-owned directory. A vault uses Argon2id key derivation and authenticated XChaCha20-Poly1305 encryption. The native process owns runtime keys. Keep the password in your password manager; the documentation never asks for it.

A successful create or unlock response is required before profile actions become available. A password error or unavailable host is not a successful setup. Lock the vault when finished.

## Join another computer

Configure an authorized folder synchronization target and bring down the encrypted vault data through the product's supported synchronization workflow. Unlock with the same vault password in the protected native application. Use the capability report on the destination computer before launching any restored profile.

Do not assume a profile can migrate between operating systems, engine versions or computers. These combinations need explicit verification. Copying a running browser directory is not a consistent backup. Preserve source data until the destination has been independently verified.

## Recovery

A lost password cannot be recovered by this documentation. Keep independent encrypted backups. If setup fails, retain the existing data directory and inspect the operation's structured error. Do not delete the original vault to make a new setup appear successful.
