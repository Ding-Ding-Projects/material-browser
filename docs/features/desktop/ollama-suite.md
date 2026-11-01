# Local Ollama suite

The Local models page manages a local [Ollama](https://ollama.com) installation: install it, start it, browse the public model library with a hardware fit verdict for each tag, pull models through a free queue and chat with installed models. The layout follows `design/remaining-features/Ollama.dc.html`.

The renderer page is `apps/desktop/src/app/Ollama.tsx` (`OllamaPage`), the typed bridge is `apps/desktop/src/ollama-api.ts` and the main-process service is `apps/desktop/electron/services/ollama.cjs`, registered on the IPC channel `material:ollama`. Streaming progress arrives on `material:event` with types `ollama.queue`, `ollama.chat`, `ollama.installer` and `ollama.catalogue`.

## Network access

The service talks to three places only:

- Ollama's documented local HTTP API at `http://127.0.0.1:11434`: `GET /api/version`, `/api/tags`, `/api/ps`; `POST /api/show`, `/api/pull` (streaming), `/api/chat` (streaming); `DELETE /api/delete`.
- The GitHub releases API for `ollama/ollama` (`/repos/ollama/ollama/releases/latest`) and that release's own download URLs.
- The public library pages at `https://ollama.com/library` and `https://ollama.com/library/<model>/tags`.

Every IPC payload is limited to 512 KB, every JSON answer from Ollama to 4 MB, every streamed line to 256 KB and every library page to 8 MB. Model names must match a strict pattern (lowercase name, optional single namespace, optional tag of letters, digits, `.`, `_` and `-`) before they are sent anywhere.

## States

The status chip and the page keep four states apart:

| State | Meaning | What the page offers |
| --- | --- | --- |
| Running | `/api/version` answers with a version | Store, Installed, Chat and the pull queue |
| Installed, not running | Connection refused and `ollama.exe` exists in the default install folder | **Start Ollama** |
| Not installed | Connection refused and no executable found | **Install Ollama** |
| Not responding | Something answers on port 11434 but not as Ollama does, or the request times out | **Check again** with the reason |

Ollama is never started by itself. **Start Ollama** runs `ollama serve` detached and waits up to 15 seconds for `/api/version`.

## Installer (Windows)

**Install Ollama** reads the latest release from the GitHub API and only accepts an asset named exactly `OllamaSetup.exe` whose download URL starts with `https://github.com/ollama/ollama/releases/download/`. It then:

1. Takes the expected SHA-256 from the asset's published `digest` field, or failing that from a `sha256sum.txt` asset in the same release. If neither exists the hash is recorded as unpublished.
2. Downloads to `<userData>/ollama/installer/OllamaSetup.exe.part`, refusing any byte past the published size and requiring the final size to match exactly.
3. Compares the SHA-256. A mismatch deletes the file. With no published hash the result is shown as **Integrity unverified**.
4. Shows a confirmation dialog with version, size and hash. The installer runs only after **Run installer** is pressed, and the file is checked again just before it runs. No silent switches are passed, so the official installer shows its own window.

Material Browser never changes `PATH` or any other environment variable.

## Store

The Ollama website has no stable JSON catalogue, so the catalogue adapter scrapes the HTML library index for model names, descriptions and capability badges, then each model's tags page for tag names, digests, download sizes and context length. Parsing is isolated in `parseLibraryIndex` and `parseTagsPage`; if the index yields no models the catalogue is reported as unavailable rather than guessed. Each catalogue records `retrievedAt`, the number of pages read, model and tag counts and a complete or incomplete verdict (incomplete when any tags page failed, with the failed models listed). It is cached at `<userData>/ollama/catalogue.json`. When a refresh fails, the last verified copy is shown with its age and an "offline" note. Installed models from `/api/tags` are always merged in, so they appear even with no catalogue.

The page shows the cached copy first, then refreshes in the background. About 270 pages are read on a full refresh, four at a time.

## Hardware fit

Evidence collected: total memory (`os.totalmem`), free space on the drive that holds the models folder (`OLLAMA_MODELS` or `~/.ollama/models`, via `fs.statfsSync`), and on Windows the graphics adapters from `Get-CimInstance Win32_VideoController` with `wmic path win32_VideoController get AdapterRAM,Name` as fallback. `AdapterRAM` is a 32-bit value, so a reading near 4 GB is shown as "at least".

The verdict uses the download size and those measurements only, never the model name:

- **Unknown** when the size, memory, graphics memory or (for models not yet installed) free disk is missing.
- **Unlikely** when the download does not fit on the disk, or the estimate does not fit in graphics memory plus half of system memory.
- **Runs well** when the estimate fits in graphics memory.
- **Runs with limits** otherwise.

The estimate is the download size times 1.2 plus 1 GB. The evidence line under the list shows the measured memory, adapters, graphics memory, free disk and the detection method.

## Pull queue

The queue holds up to 50 items. Pulls run one at a time by default (up to three can be chosen). Each item is Waiting, Pulling, Done, Failed or Stopped. Waiting items can be cancelled; a pull in progress is aborted. A pull that ends without Ollama reporting `success` is marked Failed. The summary says how many finished, failed and stopped, and that unfinished pulls installed nothing although partly downloaded layers may stay on disk. The queue never shows prices or payment wording.

## Chat

The chat tab picks from installed models, streams tokens from `/api/chat` and has a **Stop** button that aborts the request. History is kept in memory for the session only and is never written to disk. Messages are limited to 200 per request, 32 000 characters each and 256 KB in total.

## Not verified

- No Windows runtime test was possible. The installer flow, graphics detection through PowerShell and `wmic`, the default install path `%LOCALAPPDATA%\Programs\Ollama\ollama.exe` and starting `ollama serve` were tested only with stubs.
- The GitHub API was not reachable from the build environment, so whether current releases publish a `digest` for `OllamaSetup.exe` was not confirmed. Without one the installer reports integrity as unverified.
- The library parser was checked against the live `ollama.com/library` and one tags page on 2026-11-01. The site can change at any time; the parser then reports the catalogue as unavailable.
- No test ran against a real Ollama server; the local API calls were tested with stubbed responses that follow the documented formats.
- The fit thresholds are a conservative estimate, not a measurement of actual inference speed.
