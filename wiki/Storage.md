# Optional encrypted storage

The optional container service stores ciphertext. It must not receive vault passwords or decrypted browser data. Keep administration authenticated and use the published deployment configuration for the release you actually installed.

Before deployment, review the storage directory, port, access controls and backup policy. Start only the intended service and verify its real health endpoint and LAN address. A container configuration or a successful image build alone is not deployment proof.

HTTP administration has a network-path tampering limitation. Use the supported protected transport for the intended environment; do not expose the service publicly merely to make a connectivity test pass.

The offline documentation bundle may be served at `/docs/` by the optional service. The same complete articles and task walkthroughs remain available locally. Installing documentation does not deploy storage, and a walkthrough checkmark never means a service has started.
