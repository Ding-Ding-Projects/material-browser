# File converter and offline changelog

The Toolbox page puts a local file converter and the release changelog side by side. The layout, components and copy follow the approved artboard `design/remaining-features/Toolbox.dc.html`.

## File converter

Conversions run inside the Electron main process using only what ships with the application. No file is uploaded and no external program is started; the service does not use `child_process` and never looks for tools on `PATH`.

| Category | Inputs | Outputs | How |
| --- | --- | --- | --- |
| Images | PNG, JPEG | PNG, JPEG, optional resize by width (aspect ratio kept) | Electron `nativeImage` |
| Data | CSV | JSON (pretty or minified) | RFC 4180 parser in plain JavaScript |
| Data | JSON | CSV, pretty JSON, minified JSON | Plain JavaScript |
| Data | Netscape bookmark HTML (`.html`, `.htm`) | JSON folder tree | Plain JavaScript |
| Documents | PDF, Word, OpenDocument, text and others | None | Shown as "Unavailable: no bundled converter in this build" |
| Audio and video | MP3, WAV, MP4, MOV and others | None | Shown as unavailable in the same way |

WebP output is not offered, because `nativeImage` cannot encode it. The artboard's sample row "photo.png → WebP" is therefore shown in the build as a PNG or JPEG target instead.

### Choosing files and the output folder

Files are chosen with the native open dialog or dropped onto the drop area. Only absolute paths cross the IPC bridge; the renderer never sends file contents. Dropped files are resolved to paths through `webUtils.getPathForFile`, which the preload must expose as `pathForFile` (see Integration). The first conversion asks for an output folder with the native folder dialog; it can be changed at any time.

### Queue

- One file is converted at a time. Queued jobs hold only a path and options, so memory use does not grow with the queue length.
- Each file is checked against a size cap before it is read: 50 MB for images, 25 MB for data files. Larger files fail with "The file is larger than the limit for its category".
- A queued job can be canceled at once. A running job stops at the next stage boundary (reading, converting, writing, checking) and anything it had written is removed.
- Output is written to a temporary file in the chosen folder, then moved into place with a hard link that fails if the name is taken, so an existing file is never replaced. Names are taken as `name.ext`, then `name (1).ext`, `name (2).ext` and so on. On file systems without hard links, the service checks the name and then renames.
- After writing, the output is read back from disk and checked before the job is marked done: images must decode to the expected dimensions, JSON must parse and have the expected row count (or match the input exactly for reformatting), CSV must parse to the expected number of records, and bookmark JSON must contain every bookmark. A file that fails the check is removed and the job is marked failed.

### CSV rules

- Fields are separated by commas; records by CRLF, LF or CR. A final line break does not add a record. A leading byte order mark is ignored.
- Quoted fields may contain commas, doubled quotes and line breaks.
- An unclosed quote, or text after a closing quote, is an error.
- The first record is the header. Empty header names become `columnN`; repeated names get `_2`, `_3` suffixes. A record with a different number of fields from the header is an error rather than being padded or cut. Blank lines between records are skipped.
- CSV output uses CRLF line breaks and quotes fields that contain commas, quotes, line breaks or leading or trailing spaces. JSON to CSV accepts an array of objects (columns in first-seen key order) or an array of arrays.
- Data files must be UTF-8.

## Changelog

The changelog is read from `apps/desktop/assets/changelog.json`, which is bundled into the renderer at build time, so the page works offline. Releases are listed newest first. The release matching the running version is highlighted with the "This version" overline and a filled icon. The search bar is the shared `SearchBar` with the regex builder, and matches version, date, summary and notes.

`scripts/build-changelog.mjs` regenerates `changelog.json` from `CHANGELOG.md` at the repository root (Keep a Changelog headings such as `## [1.2.0] - 2026-11-01`). The repository has no such file yet, so the script currently keeps the shipped `changelog.json` and only checks that it has an entry for the current `apps/desktop/package.json` version. It does not read git history or the network.

The shipped file has a single entry for version 0.1.1 with no date, because no earlier release notes are recorded in this repository.

## Integration

The page component is `ToolboxPage` in `apps/desktop/src/app/Toolbox.tsx`. Cantonese strings are in `toolboxZh` in `apps/desktop/src/app/Toolbox.locale.ts` and still need to be merged in `src/i18n.ts`. The renderer bridge is `apps/desktop/src/converter-api.ts`.

Main process:

```js
const { registerConverterIpc } = require("./services/converter.cjs");
registerConverterIpc({ ipcMain, app, dialog, trusted, getWindow: () => window });
```

Preload (inside the frozen `materialBrowser` object; `webUtils` comes from `require("electron")`):

```js
converter: (operation, params = {}) => ipcRenderer.invoke("material:converter", operation, params),
pathForFile: (file) => webUtils.getPathForFile(file),
```

The IPC channel `material:converter` accepts `capabilities`, `status`, `choose-files`, `inspect`, `choose-folder`, `enqueue`, `cancel`, `clear` and `reveal` from the trusted renderer frame only.

## Not verified

- Image conversion has not been run: the automated tests run under plain Node.js without Electron, so `nativeImage` decoding, encoding, resizing and the image check are untested.
- The page has not been rendered in the running application, and no screenshot has been taken; it is not yet reachable from the navigation.
- Drag and drop depends on the `pathForFile` preload entry, which is not yet added.
- Hard-link placement has been exercised on Linux only; behaviour on NTFS and on network or removable drives on Windows has not been checked.
- Very large CSV files are held in memory as one string while converted; the 25 MB cap bounds this but peak memory has not been measured.
- Bookmark parsing has been checked against a hand-written sample, not against exports from each browser.
