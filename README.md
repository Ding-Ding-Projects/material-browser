# Material Browser

An encrypted browser-profile workspace for Windows, with optional self-hosted storage.

**Development status:** source implementation and focused local checks are in progress. There is no verified release yet.
Live snapshots, portable browser credentials and advanced identity controls require managed
browser integrations and must not be inferred from the interface or profile-file copying.

- [Architecture](docs/architecture.md)
- [Roadmap](ROADMAP.md)
- [Handoff](HANDOFF.md)
- [Continuation state](CLOSEOUT_PROMPT.md)

The encrypted core, desktop workspace, native control transports, interactive documentation,
storage service and portable hosting wizard have source implementations. Focused checks have
passed separately, but the combined application is not release-ready. Real Chromium and
Firefox attempts reached normal-mode launch and then failed at graceful stop. A subsequent
repair needs a newly built runtime matrix. Native credential portability, consistent live
snapshots and advanced identity controls remain incomplete. No published container,
documentation deployment or end-to-end two-computer proof is claimed.

