"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { listInstalledFonts } = require("./services/fonts.cjs");
const { discoverEditors, openInEditor } = require("./services/editors.cjs");
const operations = new Set([
  "fonts",
  "editors",
  "choose-editor",
  "open-export",
]);
const failure = (code, message) => ({ ok: false, error: { code, message } });
function registerSettingsIpc({ ipcMain, app, dialog, trusted, getWindow }) {
  let selectedEditor;
  let loadedEditor = false;
  async function editorOptions() {
    if (!loadedEditor) {
      loadedEditor = true;
      try {
        const file = path.join(app.getPath("userData"), "editor-choice.json");
        if ((await fs.stat(file)).size <= 4096) {
          const value = JSON.parse(await fs.readFile(file, "utf8"));
          if (typeof value.executable === "string")
            selectedEditor = value.executable;
        }
      } catch {
        /* An absent optional choice keeps platform discovery active. */
      }
    }
    return selectedEditor ? { selectedEditor } : {};
  }
  ipcMain.handle(
    "material:settings-service",
    async (event, operation, params = {}) => {
      if (
        !trusted(event) ||
        !operations.has(operation) ||
        !params ||
        typeof params !== "object" ||
        Array.isArray(params)
      )
        return failure(
          "INVALID_REQUEST",
          "This settings operation is not allowed.",
        );
      let serialized;
      try {
        serialized = JSON.stringify(params);
      } catch {
        return failure("INVALID_REQUEST", "The request is invalid.");
      }
      if (Buffer.byteLength(serialized) > 262144)
        return failure(
          "REQUEST_TOO_LARGE",
          "The settings request exceeds its size limit.",
        );
      try {
        if (operation === "fonts") {
          if (Object.keys(params).length)
            return failure(
              "INVALID_REQUEST",
              "Font enumeration takes no path or command.",
            );
          return await listInstalledFonts();
        }
        if (operation === "editors") {
          if (Object.keys(params).length)
            return failure(
              "INVALID_REQUEST",
              "Editor discovery takes no renderer paths.",
            );
          const result = await discoverEditors(await editorOptions());
          return result.ok
            ? {
                ok: true,
                editors: result.editors.map(({ id, name }) => ({ id, name })),
              }
            : result;
        }
        if (operation === "choose-editor") {
          if (Object.keys(params).length)
            return failure(
              "INVALID_REQUEST",
              "Choose the executable through the native picker.",
            );
          const result = await dialog.showOpenDialog(getWindow(), {
            properties: ["openFile"],
            filters: [{ name: "Editor executable", extensions: ["exe"] }],
          });
          if (result.canceled || result.filePaths.length !== 1)
            return { ok: true, state: "cancelled" };
          const chosen = result.filePaths[0];
          const verified = await discoverEditors({ selectedEditor: chosen });
          if (
            !verified.ok ||
            !verified.editors.some((e) => e.id === "selected")
          )
            return failure(
              "INVALID_EDITOR",
              "The selected editor could not be verified.",
            );
          selectedEditor = chosen;
          const root = app.getPath("userData");
          await fs.mkdir(root, { recursive: true });
          const temporary = path.join(
            root,
            `editor-choice-${randomUUID()}.tmp`,
          );
          await fs.writeFile(
            temporary,
            JSON.stringify({ version: 1, executable: chosen }),
            { flag: "wx" },
          );
          await fs.rename(temporary, path.join(root, "editor-choice.json"));
          return { ok: true, state: "selected", editorId: "selected" };
        }
        if (
          Object.keys(params).some(
            (k) =>
              !["editorId", "format", "preferences", "schedules"].includes(k),
          ) ||
          typeof params.editorId !== "string" ||
          !["json", "md"].includes(params.format)
        )
          return failure(
            "INVALID_REQUEST",
            "Choose a supported editor and complete settings export.",
          );
        const model = await import(
          pathToFileURL(path.join(__dirname, "../shared/settings-model.mjs"))
            .href
        );
        const value = model.parseImport(
          JSON.stringify({
            schemaVersion: 1,
            preferences: params.preferences,
            schedules: params.schedules,
          }),
        );
        const text = model.formatExport(
          model.exportPreferences(value.preferences, value.schedules),
          params.format,
        );
        const exportRoot = path.join(
          app.getPath("userData"),
          "settings-exports",
        );
        await fs.mkdir(exportRoot, { recursive: true });
        const fileId = randomUUID(),
          file = path.join(exportRoot, `${fileId}.${params.format}`);
        await fs.writeFile(file, text, { encoding: "utf8", flag: "wx" });
        return await openInEditor(
          { editorId: params.editorId, fileId },
          {
            ...(await editorOptions()),
            trustedRequest: true,
            approvedFiles: [
              {
                id: fileId,
                path: file,
                nonSecret: true,
                applicationOwned: true,
              },
            ],
            exportRoot,
          },
        );
      } catch {
        return failure(
          "SETTINGS_SERVICE_UNAVAILABLE",
          "The requested local settings operation could not complete. Existing settings were preserved.",
        );
      }
    },
  );
}
module.exports = { registerSettingsIpc };
