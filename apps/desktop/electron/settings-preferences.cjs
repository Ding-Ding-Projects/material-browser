"use strict";
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const filesDefault = require("./settings-files.cjs");
const { withNativeLock } = require("./services/native-lock.cjs");
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function createPreferencesStore({
  appDataRoot,
  files = filesDefault,
  lock = withNativeLock,
}) {
  if (
    !path.isAbsolute(appDataRoot || "") ||
    path.parse(path.resolve(appDataRoot)).root === path.resolve(appDataRoot)
  )
    throw Error("INVALID_SETTINGS_ROOT");
  const root = path.resolve(appDataRoot),
    file = path.join(root, "presentation-settings.json");
  const lockId = createHash("sha256")
    .update(`presentation-settings:${root.toLowerCase()}`)
    .digest("hex");
  const modelPromise = import(
    pathToFileURL(path.join(__dirname, "../shared/settings-model.mjs")).href
  );
  let queue = Promise.resolve();
  function serial(action) {
    const result = queue.then(() => lock(lockId, action));
    queue = result.catch(() => {});
    return result;
  }
  async function snapshot(value) {
    const model = await modelPromise;
    if (
      !value ||
      Object.keys(value).some(
        (key) => !["schemaVersion", "preferences", "schedules"].includes(key),
      )
    )
      throw Error("INVALID_SETTINGS_SNAPSHOT");
    return { schemaVersion: 1, ...model.parseImport(JSON.stringify(value)) };
  }
  async function validate(value) {
    if (
      !value ||
      Object.keys(value).some(
        (key) =>
          ![
            "schemaVersion",
            "revision",
            "preferences",
            "schedules",
            "writtenKeys",
          ].includes(key),
      ) ||
      value.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !Array.isArray(value.writtenKeys)
    )
      throw Error("INVALID_SETTINGS_RECORD");
    const projected = await snapshot({
      schemaVersion: 1,
      preferences: value.preferences,
      schedules: value.schedules,
    });
    if (
      value.writtenKeys.some(
        (key) => !Object.hasOwn(projected.preferences, key),
      ) ||
      new Set(value.writtenKeys).size !== value.writtenKeys.length
    )
      throw Error("INVALID_SETTINGS_PROVENANCE");
    return {
      schemaVersion: 1,
      revision: value.revision,
      preferences: projected.preferences,
      schedules: projected.schedules,
      writtenKeys: [...value.writtenKeys],
    };
  }
  async function load() {
    try {
      return {
        initialized: true,
        record: await validate(
          JSON.parse((await files.read(file, 270336)).toString("utf8")),
        ),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const model = await modelPromise;
      return {
        initialized: false,
        record: {
          schemaVersion: 1,
          revision: 0,
          preferences: { ...model.defaults },
          schedules: [],
          writtenKeys: [],
        },
      };
    }
  }
  const project = (record) => ({
    schemaVersion: 1,
    preferences: record.preferences,
    schedules: record.schedules,
  });
  async function save(old, proposed, lease) {
    if (
      old.initialized &&
      equal({ ...old.record, revision: 0 }, { ...proposed, revision: 0 })
    )
      return { ...old, changed: false };
    if (old.record.revision >= Number.MAX_SAFE_INTEGER)
      throw Error("SETTINGS_REVISION_EXHAUSTED");
    const record = await validate({
      ...proposed,
      revision: old.record.revision + 1,
    });
    lease.assertHeld();
    await files.atomic(file, JSON.stringify(record));
    lease.assertHeld();
    return {
      initialized: true,
      record,
      changed: true,
      before: project(old.record),
      after: project(record),
    };
  }
  return Object.freeze({
    read: () => serial(load),
    write: (input) =>
      serial(async (lease) => {
        if (
          !input ||
          Object.keys(input).some(
            (key) =>
              ![
                "expectedRevision",
                "preferences",
                "schedules",
                "writtenKeys",
              ].includes(key),
          )
        )
          throw Error("INVALID_SETTINGS_REQUEST");
        const { expectedRevision, preferences, schedules, writtenKeys } = input;
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
          throw Error("INVALID_SETTINGS_REVISION");
        const old = await load();
        if (old.record.revision !== expectedRevision)
          throw Error("SETTINGS_CONFLICT");
        return save(
          old,
          {
            schemaVersion: 1,
            revision: expectedRevision,
            preferences,
            schedules,
            writtenKeys,
          },
          lease,
        );
      }),
    // History invokes this trusted callback with an authenticated expected snapshot.
    // It shares the same lock as ordinary writes, without re-entering the IPC queue.
    apply: (value, { expected, expectedNativeRevision }) =>
      serial(async (lease) => {
        if (
          !Number.isSafeInteger(expectedNativeRevision) ||
          expectedNativeRevision < 0
        )
          throw Error("INVALID_SETTINGS_REVISION");
        const target = await snapshot(value),
          previous = await snapshot(expected),
          old = await load();
        if (equal(project(old.record), target))
          return { ...old, changed: false };
        if (
          old.record.revision !== expectedNativeRevision ||
          !equal(project(old.record), previous)
        )
          throw Error("SETTINGS_CONFLICT");
        const changedKeys = Object.keys(target.preferences).filter(
          (key) => !equal(target.preferences[key], old.record.preferences[key]),
        );
        return save(
          old,
          {
            ...old.record,
            ...target,
            writtenKeys: [
              ...new Set([...old.record.writtenKeys, ...changedKeys]),
            ],
          },
          lease,
        );
      }),
  });
}
module.exports = { createPreferencesStore };
