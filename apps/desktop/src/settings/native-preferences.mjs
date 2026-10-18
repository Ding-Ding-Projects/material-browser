import { readStoredPresentation } from "./record.mjs";

export async function loadNativePreferences(request, readLegacy) {
  const result = await request("preferences-read");
  if (result.initialized) return result.record;
  let legacy;
  try {
    const { current, appearance } = readLegacy();
    legacy = readStoredPresentation(current, appearance);
  } catch {
    throw Error(
      "The previous local preferences are invalid. They were preserved and were not migrated.",
    );
  }
  try {
    return (
      await request("preferences-write", {
        expectedRevision: result.record.revision,
        preferences: legacy.preferences,
        schedules: legacy.schedules,
        writtenKeys: legacy.writtenKeys,
      })
    ).record;
  } catch (error) {
    // Another process may have completed the only permitted migration.
    const latest = await request("preferences-read");
    if (latest.initialized) return latest.record;
    throw error;
  }
}

export const preferenceIdentity = (value) =>
  JSON.stringify([value.preferences, value.schedules]);
