"use strict";
const path = require("node:path");
const { createHash } = require("node:crypto");
const files = require("./settings-files.cjs");
const { withNativeLock } = require("./services/native-lock.cjs");
function displayNameRecord(value) {
  if (
    !value ||
    Object.keys(value).some(
      (key) =>
        !["schemaVersion", "kind", "recordId", "displayName"].includes(key),
    ) ||
    value.schemaVersion !== 1 ||
    value.kind !== "display-name" ||
    value.recordId !== "application-display-name-v1" ||
    (value.displayName !== null &&
      (typeof value.displayName !== "string" ||
        !value.displayName.trim() ||
        value.displayName.length > 120 ||
        /[\x00-\x1f\x7f]/.test(value.displayName)))
  )
    throw Error("INVALID_DISPLAY_NAME_RECORD");
  return {
    schemaVersion: 1,
    kind: "display-name",
    recordId: "application-display-name-v1",
    displayName: value.displayName,
  };
}
function createDisplayNameStore({ appDataRoot, lock = withNativeLock }) {
  const root = path.resolve(appDataRoot || "");
  if (!path.isAbsolute(appDataRoot || "") || path.parse(root).root === root)
    throw Error("INVALID_SETTINGS_ROOT");
  const file = path.join(root, "presentation-display-name.json"),
    identity = createHash("sha256")
      .update(`presentation-display-name:${root.toLowerCase()}`)
      .digest("hex");
  const empty = {
    schemaVersion: 1,
    revision: 0,
    record: displayNameRecord({
      schemaVersion: 1,
      kind: "display-name",
      recordId: "application-display-name-v1",
      displayName: null,
    }),
  };
  async function load() {
    try {
      const value = JSON.parse((await files.read(file, 4096)).toString("utf8"));
      if (
        !value ||
        value.schemaVersion !== 1 ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 0 ||
        Object.keys(value).some(
          (key) => !["schemaVersion", "revision", "record"].includes(key),
        )
      )
        throw Error("INVALID_DISPLAY_NAME_RECORD");
      return {
        schemaVersion: 1,
        revision: value.revision,
        record: displayNameRecord(value.record),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return empty;
    }
  }
  return Object.freeze({
    read: () => lock(identity, load),
    apply: (value, { expected, expectedNativeRevision }) =>
      lock(identity, async (lease) => {
        if (
          !Number.isSafeInteger(expectedNativeRevision) ||
          expectedNativeRevision < 0
        )
          throw Error("INVALID_SETTINGS_REVISION");
        const next = displayNameRecord(value),
          previous = displayNameRecord(expected),
          current = await load();
        if (current.record.displayName === next.displayName)
          return { changed: false };
        if (
          current.revision !== expectedNativeRevision ||
          current.record.displayName !== previous.displayName
        )
          throw Error("DISPLAY_NAME_CONFLICT");
        if (current.revision >= Number.MAX_SAFE_INTEGER)
          throw Error("SETTINGS_REVISION_EXHAUSTED");
        lease.assertHeld();
        await files.atomic(
          file,
          JSON.stringify({
            schemaVersion: 1,
            revision: current.revision + 1,
            record: next,
          }),
        );
        lease.assertHeld();
        return { changed: true };
      }),
  });
}
module.exports = { createDisplayNameStore, displayNameRecord };
