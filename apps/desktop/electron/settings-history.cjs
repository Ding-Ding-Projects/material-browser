"use strict";
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createHistoryService } = require("./services/history.cjs");
const { createCredentialStore } = require("./services/credential-store.cjs");
const { createDisplayNameStore } = require("./settings-display-name.cjs");
const { historyContext } = require("./history-context.cjs");
const { verifyHistoryRuntime } = require("./history-runtime.cjs");
const parameters = {
  "display-name-read": [],
  "display-name-write": ["expectedName", "displayName", "action"],
  "history-status": [],
  "history-setup": ["secret"],
  "history-unlock": ["secret"],
  "history-lock": [],
  "history-change-password": ["oldSecret", "newSecret"],
  "history-list": ["actions", "from", "to", "limit"],
  "history-diff": ["revision"],
  "history-label": ["revision", "label"],
  "history-restore": ["revision"],
  "history-recover": ["decision"],
  "history-retention": ["visibleDays"],
  "history-export": [],
};
const project = (record) => ({
  schemaVersion: 1,
  preferences: record.preferences,
  schedules: record.schedules,
});
const unavailable = () => ({
  ok: false,
  error: {
    code: "HISTORY_RUNTIME_UNAVAILABLE",
    message:
      "Protected history is unavailable because its verified local runtime could not be loaded.",
  },
});

function createSettingsHistory({
  app,
  resourcesPath,
  explicitDataDirectory,
  getPreferencesStore,
  runtimeVerifier = verifyHistoryRuntime,
  serviceFactory = createHistoryService,
  credentialFactory = createCredentialStore,
  displayNameFactory = createDisplayNameStore,
}) {
  let context, displayNames, service, serviceIdentity;
  const getContext = () =>
    context ||
    (context = historyContext({ app, resourcesPath, explicitDataDirectory }));
  const getNames = () =>
    displayNames ||
    (displayNames = displayNameFactory({
      appDataRoot: getContext().appDataRoot,
    }));
  async function getService() {
    const trusted = getContext();
    const runtime = await runtimeVerifier({
      manifestPath: trusted.manifestPath,
      payloadParent: trusted.payloadParent,
    });
    const identity = `${runtime.gitExecutable}:${runtime.gitSha256}`;
    if (!service || identity !== serviceIdentity) {
      const model = await import(
        pathToFileURL(path.join(__dirname, "../shared/settings-model.mjs")).href
      );
      service = serviceFactory({
        appDataRoot: trusted.appDataRoot,
        historyRoot: path.join(trusted.appDataRoot, "settings-history"),
        gitExecutable: runtime.gitExecutable,
        gitSha256: runtime.gitSha256,
        credentialStore: credentialFactory({ namespace: trusted.namespace }),
        validatePreferences: model.validatePreferences,
        validateSchedule: model.validateSchedule,
      });
      serviceIdentity = identity;
    }
    return service;
  }
  const apply = (snapshot, expected) =>
    snapshot?.kind === "display-name"
      ? getNames().apply(snapshot, expected)
      : getPreferencesStore().apply(snapshot, expected);
  return Object.freeze({
    async recordChange(result) {
      if (!result.changed) return { recorded: false, unchanged: true };
      try {
        // The preference store has already released its mutex before this call.
        const history = await getService();
        const status = await history.status();
        if (!status.ok) return { recorded: false, warning: status.error.code };
        if (!status.configured)
          return { recorded: false, state: "not-configured" };
        return await history.recordSettings({
          before: result.before,
          after: result.after,
          action: "settings-changed",
        });
      } catch {
        return { recorded: false, state: "unavailable" };
      }
    },
    async handle(operation, params) {
      if (
        !Object.hasOwn(parameters, operation) ||
        !params ||
        typeof params !== "object" ||
        Array.isArray(params) ||
        Object.keys(params).some((key) => !parameters[operation].includes(key))
      )
        return {
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "This protected settings request is invalid.",
          },
        };
      for (const key of ["secret", "oldSecret", "newSecret"])
        if (
          Object.hasOwn(params, key) &&
          (typeof params[key] !== "string" || params[key].length > 256)
        )
          return {
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Enter a supported password or PIN.",
            },
          };
      try {
        if (operation === "display-name-read") {
          const value = await getNames().read();
          return { ok: true, displayName: value.record.displayName };
        }
        let history;
        try {
          history = await getService();
        } catch {
          return unavailable();
        }
        switch (operation) {
          case "history-status":
            return await history.status();
          case "history-setup": {
            const result = await history.setup(params.secret);
            if (!result.ok) return result;
            try {
              const current = await getPreferencesStore().read();
              const baseline = await history.recordSettings({
                before: null,
                after: project(current.record),
                action: "created",
              });
              return {
                ...result,
                baselineRecorded: baseline.recorded === true,
                ...(baseline.warning ? { warning: baseline.warning } : {}),
              };
            } catch {
              return {
                ...result,
                baselineRecorded: false,
                warning: "HISTORY_BASELINE_UNAVAILABLE",
              };
            }
          }
          case "history-unlock":
            return await history.unlock(params.secret);
          case "history-lock":
            return await history.lock();
          case "history-change-password":
            return await history.changePassword(
              params.oldSecret,
              params.newSecret,
            );
          case "history-list":
            return await history.list(params);
          case "history-diff":
            return await history.diff(params.revision);
          case "history-label":
            return await history.label(params.revision, params.label);
          case "history-retention":
            return await history.setRetention(params);
          case "history-export":
            return await history.exportRedacted();
          case "history-recover":
            return await history.recover(params.decision, apply);
          case "history-restore": {
            const description = await history.diff(params.revision);
            if (!description.ok) return description;
            const current =
              description.recordKind === "display-name"
                ? await getNames().read()
                : await getPreferencesStore().read();
            const expected =
              description.recordKind === "display-name"
                ? current.record
                : project(current.record);
            const expectedNativeRevision =
              description.recordKind === "display-name"
                ? current.revision
                : current.record.revision;
            return await history.restore(
              params.revision,
              { expected, expectedNativeRevision },
              apply,
            );
          }
          case "display-name-write": {
            const current = await getNames().read();
            if (params.expectedName !== current.record.displayName)
              return {
                ok: false,
                error: {
                  code: "HISTORY_STATE_CONFLICT",
                  message:
                    "The display name changed elsewhere. Reload before trying again.",
                },
              };
            return await history.transactDisplayName(
              {
                before: current.record.displayName,
                after: params.displayName,
                action: params.action,
                expectedNativeRevision: current.revision,
              },
              apply,
            );
          }
          default:
            return {
              ok: false,
              error: {
                code: "INVALID_REQUEST",
                message: "This protected settings request is invalid.",
              },
            };
        }
      } catch {
        return {
          ok: false,
          error: {
            code: "HISTORY_UNAVAILABLE",
            message:
              "Protected settings could not complete this operation. Existing records were preserved.",
          },
        };
      }
    },
  });
}
module.exports = {
  createSettingsHistory,
  historyOperations: Object.keys(parameters),
};
