import { validatePreferences, validateSchedule, defaults } from "./model.mjs";
export function readPresentationRecord(raw, legacy = null) {
  const blank = {
    schemaVersion: 1,
    revision: 0,
    preferences: { ...defaults },
    writtenKeys: [],
    schedules: [],
    revisions: [],
    notices: [],
    section: "language",
    snoozeUntil: 0,
  };
  if (!raw) {
    if (legacy && typeof legacy === "object")
      for (const key of ["language", "theme", "density", "accent"])
        if (Object.hasOwn(legacy, key)) {
          try {
            const p = validatePreferences(
              { [key]: legacy[key] },
              { partial: true },
            );
            blank.preferences[key] = p[key];
            blank.writtenKeys.push(key);
          } catch {}
        }
    return blank;
  }
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !data ||
    data.schemaVersion !== 1 ||
    !Number.isInteger(data.revision) ||
    data.revision < 0 ||
    !Array.isArray(data.writtenKeys) ||
    data.writtenKeys.some((k) => !Object.hasOwn(defaults, k)) ||
    new Set(data.writtenKeys).size !== data.writtenKeys.length ||
    !Array.isArray(data.schedules) ||
    data.schedules.length > 200 ||
    !Array.isArray(data.revisions) ||
    !Array.isArray(data.notices) ||
    typeof data.section !== "string" ||
    !Number.isFinite(data.snoozeUntil)
  )
    throw Error("Invalid local presentation record");
  const preferences = validatePreferences(data.preferences),
    schedules = data.schedules.map(validateSchedule);
  const revisions = data.revisions.map((r) => {
    if (
      !r ||
      typeof r.id !== "string" ||
      typeof r.action !== "string" ||
      r.action.length > 200 ||
      typeof r.at !== "string" ||
      !Number.isFinite(Date.parse(r.at)) ||
      !Array.isArray(r.keys) ||
      r.keys.some((k) => !Object.hasOwn(defaults, k)) ||
      !Array.isArray(r.schedules)
    )
      throw Error("Invalid preference history");
    return {
      id: r.id,
      at: r.at,
      action: r.action,
      keys: r.keys,
      preferences: validatePreferences(r.preferences),
      schedules: r.schedules.map(validateSchedule),
    };
  });
  const notices = data.notices.map((n) => {
    if (
      !n ||
      typeof n.id !== "string" ||
      !["info", "success", "warning", "error"].includes(n.kind) ||
      typeof n.message !== "string" ||
      n.message.length > 1000 ||
      typeof n.dismissed !== "boolean" ||
      typeof n.at !== "string" ||
      !Number.isFinite(Date.parse(n.at))
    )
      throw Error("Invalid notification history");
    return {
      id: n.id,
      at: n.at,
      kind: n.kind,
      message: n.message,
      dismissed: n.dismissed,
    };
  });
  return {
    ...blank,
    revision: data.revision,
    preferences,
    writtenKeys: data.writtenKeys,
    schedules,
    revisions,
    notices,
    section: data.section,
    snoozeUntil: data.snoozeUntil,
  };
}
export function preferenceProvenance(record, key, effective) {
  return {
    source: record.writtenKeys.includes(key)
      ? "saved-local"
      : "compiled-default",
    defaultValue: defaults[key],
    baseValue: record.preferences[key],
    effectiveValue: effective[key],
    temporarilyOverridden: record.preferences[key] !== effective[key],
  };
}
