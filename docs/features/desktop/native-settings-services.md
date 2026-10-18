# Native settings services

The desktop main process loads `electron/services/fonts.cjs` and
`electron/services/editors.cjs`. These modules have no renderer or network access.
All APIs are asynchronous and return either `{ok:true,...}` or
`{ok:false,error:{code,message}}`. Error messages omit file paths and child output.

## Installed fonts

`listInstalledFonts()` invokes the operating system's fixed PowerShell executable
with a fixed, noninteractive script and no interpolated user input. It enumerates
installed GDI font families and their available Regular, Bold, Italic and combined
BoldItalic styles. Success returns `source: 'windows-gdi'` and
`fonts: [{id,family,style}]`. The stable identity is the serialized family/style
pair. It does not enumerate variable-font axes or promise OpenType feature coverage.
The operation has a ten-second default timeout and a bounded response buffer.
Unsupported platforms, empty inventory and invalid responses remain explicit errors.

## External editors

`discoverEditors()` checks known local installation paths for Notepad, Visual
Studio Code and Notepad++. It never launches an editor. An optional main-process
`selectedEditor` path, obtained through an explicit executable-selection dialog,
adds the `selected` editor. Discovery returns `{id,name,executable}` entries only
for existing, resolved executable files. Network paths and command scripts are
excluded. No PATH search, shell, registry command or user-supplied argument string
is executed.

`openInEditor({editorId,fileId}, options)` requires a trusted main-process call.
Main must supply `trustedRequest:true`, a dedicated `exportRoot`, and an
`approvedFiles` list with `{id,path,nonSecret:true,applicationOwned:true}` entries.
These options must never be copied from renderer input. The renderer sends opaque
identities only. Main creates a sanitized export in its owned area before approval:
never approve live settings, imported personal wording, credentials, profiles,
authentication state or arbitrary user documents. The service resolves the file,
requires containment inside that export area, permits JSON/text/Markdown files up
to one MiB, and launches only the selected discovered editor with that one literal
file argument. Selection itself is not permission to open a document.

A successful result reports `state:'launched'`, not that the editor finished
loading or saved changes. Startup timeout and process errors remain failures.
The service does not read back edits, import settings or execute document content.

## Verification

Run `node --test apps/desktop/electron/services/native-settings.test.cjs` locally.
Coverage includes a real Windows font enumeration, fixed-command assertions,
invalid responses, unavailable editors, rejected commands/network paths,
explicit trust and non-secret approval, resolved containment, file size, literal
argument delivery, process errors and startup timeout. Synthetic editor adapters
avoid launching personal applications during tests. Settings UI integration and
real editor interaction need separate runtime verification.
