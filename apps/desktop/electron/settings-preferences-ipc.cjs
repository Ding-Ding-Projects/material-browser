"use strict";
const { createPreferencesStore } = require("./settings-preferences.cjs");
const messages = {
  SETTINGS_CONFLICT:
    "Preferences changed elsewhere. Reload the saved preferences before editing again.",
  INVALID_SETTINGS_REQUEST: "The preference request is invalid.",
  SETTINGS_STORAGE_UNAVAILABLE:
    "Preferences could not be saved or loaded. The existing saved record was preserved.",
};
function createPreferencesOperations({
  app,
  getWindow,
  storeFactory = createPreferencesStore,
  getPreferencesStore,
  onSaved = async () => ({ recorded: false, state: "unavailable" }),
}) {
  let store;
  const getStore = () =>
    getPreferencesStore
      ? getPreferencesStore()
      : store ||
        (store = storeFactory({ appDataRoot: app.getPath("userData") }));
  return async function handle(operation, params) {
    try {
      if (operation === "preferences-read") {
        if (Object.keys(params).length) throw Error("INVALID_SETTINGS_REQUEST");
        return { ok: true, ...(await getStore().read()) };
      }
      if (operation !== "preferences-write")
        throw Error("INVALID_SETTINGS_REQUEST");
      const result = await getStore().write(params);
      let history;
      try {
        history = await onSaved(result);
      } catch {
        history = { recorded: false, warning: "HISTORY_WRITE_FAILED" };
      }
      if (result.changed) {
        try {
          const target = getWindow();
          if (
            target &&
            !target.isDestroyed() &&
            !target.webContents.isDestroyed()
          )
            target.webContents.send("material:event", {
              type: "settings-updated",
              revision: result.record.revision,
            });
        } catch {
          // Notification delivery cannot turn a durable save into a failed save.
        }
      }
      return {
        ok: true,
        initialized: result.initialized,
        changed: result.changed,
        record: result.record,
        history,
      };
    } catch (error) {
      const code = Object.hasOwn(messages, error.message)
        ? error.message
        : "SETTINGS_STORAGE_UNAVAILABLE";
      return { ok: false, error: { code, message: messages[code] } };
    }
  };
}
module.exports = { createPreferencesOperations };
