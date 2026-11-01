# Remaining features: design handoff

Design source for the surfaces Material Browser does not have yet. These files are a design,
not shipped behaviour. They sit in their own folder because the main canvas already uses
`Main.dc.html`; the existing eight artboards in `design/` are unchanged.

The canvas index is `canvas.json`. Every artboard links the shared `theme.css` and `m3.css`
(copies of the files one level up) and uses the same Material 3 Expressive component anatomy
as the main canvas. Each artboard has a `dark` toggle.

## Artboards

- `Main.dc.html`: Minecraft servers. A new Servers destination in the navigation rail. Server
  list filtered by execution target (this PC, Docker here, SSH host, Docker over SSH), with
  Running, Stopped and Disconnected kept distinct. Detail pane with start, graceful stop and
  restart, players, memory, ticks per second, verified server file and runtime, owned process
  and a typed command builder limited to the selected version.
- `ServerCreate.dc.html`: Guided creation in five steps: target, version (Java or Bedrock,
  release-channel filters, full catalogue search, unavailable server downloads disabled with a
  reason, catalogue retrieval time), server software and memory, EULA consent (no eula=true
  until the user switches it on), then progress with cancellation.
- `ServerConfig.dc.html`: `server.properties` as rich controls: switches, connected button
  groups, steppers, sliders with numeric alternatives and validated text, each labelled with its
  key and whether it applies live or needs a restart. Unknown keys are preserved. A permission
  matrix for allowlist and operators.
- `ServerContent.dc.html`: Plugin manager with catalogue search, licence, compatibility and hash,
  plus a file-added plugin marked as not fully managed. Worlds, export and import, automatic
  backups and restore points.
- `WorldGenerator.dc.html`: World generator in the server tab. A drawing canvas on a chunk grid
  (drag to draw an area, drag the area to move it, width and depth steppers with numeric fields,
  a Default 100 x 100 button and Centre on spawn) with a block, chunk and batch readout and a
  world-border switch. World settings: seed with a random action, world type, a superflat layer
  editor with presets, biome, features and lakes, single-biome picker, structures, terrain and
  dimension values, typed game rules with search, difficulty and hardcore. Output as a Folder or a
  ZIP file with Browse, never replacing existing files and checked after writing.
- `Ollama.dc.html`: Local model suite with healthy and not-installed states, store with fit
  verdicts, free pull queue.
- `Toolbox.dc.html`: Local file converter and offline changelog viewer.
- `OllamaStates.dc.html`: Ollama header states (checking, installed but not running, not
  responding, desktop app required), installer download, confirmation with version, size, SHA-256
  and integrity, installed list with remove confirmation, chat, pull queue item states, pulls at
  once, clear finished, catalogue unavailable and the store evidence footer.
- `ToolboxStates.dc.html`: Drop highlight, unavailable category line, Convert to and optional width,
  output folder row, waiting, failed and canceled rows, Clear finished, changelog release notes,
  Date not recorded and the no-results state. Image output is PNG or JPEG only.
- `Personalize.dc.html`: ADHD-friendly focus modes and the per-element appearance editor with a
  colour picker, colour translations and a live contrast check.
- `PersonalizeStates.dc.html`: Gentle timer durations and its status-bar timer, the Customize
  appearance menu item, background or text colour choice, hue bar, contrast line, corner radius
  and size controls, info icons, and Reset all elements with its confirmation.

## Implementation notes

Placeholders in square brackets are real values the running application fills in. Version
lists, hashes and plugin data must come from the official catalogues at run time, never from
these mockups.
