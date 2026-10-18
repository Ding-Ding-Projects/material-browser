import { validatePreferences, validateSchedule } from "./model.mjs";
export function validatedSnapshot(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.schedules))
    throw Error("Invalid settings snapshot");
  return {
    preferences: validatePreferences(value.preferences),
    schedules: value.schedules.map(validateSchedule),
  };
}
export function historyTransition(
  record,
  target,
  { action, id, at, mode = "edit", written = /** @type {string[]} */ ([]) },
) {
  const undo = [...(record.undoStack || [])],
    redo = [...(record.redoStack || [])],
    before = validatedSnapshot(record);
  let next;
  if (mode === "undo") {
    if (!undo.length) return record;
    next = validatedSnapshot(undo.pop());
    redo.push(before);
  } else if (mode === "redo") {
    if (!redo.length) return record;
    next = validatedSnapshot(redo.pop());
    undo.push(before);
  } else {
    next = validatedSnapshot(target);
    if (JSON.stringify(before) === JSON.stringify(next)) return record;
    undo.push(before);
    redo.length = 0;
  }
  const keys = Object.keys(next.preferences).filter(
    (k) => record.preferences[k] !== next.preferences[k],
  );
  const revisions = record.revisions.length
    ? record.revisions
    : [
        {
          id: id + "-initial",
          at,
          action: "Initial preferences",
          keys: [],
          ...before,
        },
      ];
  return {
    ...record,
    ...next,
    writtenKeys: [...new Set([...record.writtenKeys, ...keys, ...written])],
    undoStack: undo,
    redoStack: redo,
    revisions: [...revisions, { id, at, action, keys, ...next }],
  };
}
export function preserveScheduleEdit(existing, patch) {
  return {
    ...existing,
    ...patch,
    enabled: existing?.enabled ?? patch.enabled ?? true,
    values: { ...existing?.values, ...patch.values },
  };
}
