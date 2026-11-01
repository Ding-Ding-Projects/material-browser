# Local model service

Material Browser's privileged local-model service uses only admitted Ollama API routes at the fixed `http://127.0.0.1:11434` endpoint. It does not accept arbitrary API addresses, headers, credentials or shell text. Redirects, oversized payloads, malformed JSON, invalid model identities and cloud model identifiers are rejected.

## Interface and explicit actions

Create the service with `createLocalModelService({dataDir, fetch?, emit?, installedProbe?, maxParallel?})`, then call `request({action, params})`. The desktop bridge owns IPC trust and bounded request validation.

Actions are capabilities, status, list, running, show, pull, jobs, cancel, reconcile, remove, copy, catalogue, refreshCatalogue, installerPlan and install. Capabilities contain an actions array and explicit reasons for incomplete installation, owned runtime startup/shutdown, chat, generation, harness orchestration and hardware-fit evidence.

Status distinguishes an executable found in the normal per-user installation location from a healthy local API. Detection does not execute or adopt that installation. A stopped service reports its exact API condition rather than claiming Ollama is missing. List and running use `/api/tags` and `/api/ps`. Show returns selected installed local-model details and capabilities from `/api/show` without exposing prompt templates or raw chat payloads.

Pull requires an explicitly chosen exact model tag. It returns a durable queued job and runs at most two pulls concurrently through `/api/pull`. Progress retains API byte counts and digest/status metadata. Completion requires a terminal success frame and installed-inventory readback. A partial stream, malformed frame or failed item remains unsuccessful. Cancellation aborts the owned request; an active cancellation remains pending until its actual terminal result. Reconcile checks interrupted/failed/cancelled jobs against current installed tags without starting another download. Retry is an explicit new pull.

Remove and copy require `confirmed: true`, valid local installed membership and exact selected identities. Removal is blocked while the same tag has a pending pull. The service reads the resulting installed inventory before reporting removal/copy success. No action is run merely by opening the manager. Jobs retain bounded metadata locally, never prompt payloads, credentials or API response bodies in diagnostics.

The owner calls dispose before shutdown. It closes admission, aborts active operations, settles admitted requests and persists pending outcomes. It does not stop an unrelated existing Ollama process.

## Official catalogue and completeness

Catalogue browsing uses the official `https://ollama.com/library` document and every discovered model's official tag document. Supported next-page links are followed for both inventories, with two concurrent model readers, time/byte/page bounds and source-page SHA-256 identities. A refresh is promoted only after every discovered tag inventory completes. Missing pages, changed markup, cancellation or malformed responses preserve the prior snapshot with a stale/incomplete refresh state. No community proxy or curated list substitutes for the official source.

The returned record contains family `models` with `tags`, a flat `variants` alias, source, retrieval time, page count, source revision, tag count, stale state and a precise completeness scope. Official-library enumeration never claims exhaustive community-account discovery. Variant size, capabilities and hardware fit remain unknown until verified metadata exists; names do not become hardware evidence.

## Installer boundary

The official Windows x64 standalone archive is pinned to Ollama 0.40.13, 1601969847 bytes, SHA-256 `7afa38624fa62ee5d8293422d0ab084c1bb4603134c7f4dafce11a033b57cc19`. Its source is the normal official release at `https://github.com/ollama/ollama/releases/tag/v0.40.13`, read through the GitHub CLI on 2026-11-01. Exact time of that release readback was not retained.

The full archive member inventory and native publisher/final-file-identity admission are not integrated. The installer plan therefore reports unavailable, and install returns `INSTALLER_ADMISSION_INCOMPLETE`. This is an explicit delivery gap, not a working one-click installer. No unsafe extraction, user-PATH/startup mutation, implicit runtime launch or invented elevation is used. Owned runtime launch/stop, listener ownership and descendant lifetime verification remain incomplete.

## Verification

Run `node --test apps/desktop/electron/services/local-models/index.test.cjs`. Ten focused tests cover fixed local routing, response bounds, detected-but-stopped health, durable pull completion, incomplete streams, explicit removal consent, source pagination/tag retention, incomplete catalogue preservation, installer non-success, bounded concurrency, cancellation and malformed progress.

Read-only native inspection found an existing executable in the normal per-user installation location and a refused connection at the fixed local endpoint. No host model was pulled, copied or removed. These results are separate from built GUI, installation, inference and model-operation acceptance.

API references: [Ollama API introduction](https://docs.ollama.com/api/introduction), [installed models](https://docs.ollama.com/api/tags), [pull](https://docs.ollama.com/api/pull), [delete](https://docs.ollama.com/api/delete) and [Windows standalone distribution](https://docs.ollama.com/windows).

A full read-only official-library refresh completed at 2026-11-01T07:36:53.381Z: 266 model families, 7636 tags and 267 source documents. The retained source revision was `5508aba58860760f1bdfc2c082db177b559ccb571c74d3fcf674e4079777519f`. The temporary verification snapshot was removed after the bounded check. This establishes the source-enumeration route, not community-account completeness, model compatibility or successful inference.
