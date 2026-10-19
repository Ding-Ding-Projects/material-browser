import { useState, useMemo, useCallback, useEffect } from "react";
import {
  defaults,
  validatePreferences,
  validateValue,
  validateSchedule,
  effectivePreferences,
} from "./model.mjs";
import { historyTransition } from "./history-model.mjs";
import { useSettingsPersistence } from "./useSettingsPersistence";
import type { SettingsRecord, Preferences, Notice } from "./types";
export type { SettingsRecord, Preferences, Notice, Revision } from "./types";
export function useSettings() {
  const {
    record,
    current,
    persist,
    storageError,
    storageReady,
    saving,
    reloadSaved,
  } = useSettingsPersistence();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const transact = useCallback(
    (
      action: string,
      preferences: Preferences,
      schedules?: any[],
      written?: string[],
    ) => {
      const validated = validatePreferences(preferences),
        validSchedules = (schedules ?? current.current.schedules).map(
          validateSchedule,
        );
      if (validSchedules.length > 200)
        throw Error("At most 200 local schedules are supported");
      const expected = JSON.stringify([
        current.current.preferences,
        current.current.schedules,
      ]);
      return persist((old) => {
        if (JSON.stringify([old.preferences, old.schedules]) !== expected)
          throw Error(
            "Another preference change completed first. Review the saved values and retry this action.",
          );
        return historyTransition(
          old,
          { preferences: validated, schedules: validSchedules },
          {
            action,
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            written,
          },
        ) as SettingsRecord;
      });
    },
    [persist],
  );
  const update = useCallback(
    (key: string, value: any) => {
      validateValue(key, value);
      return persist(
        (old) =>
          historyTransition(
            old,
            {
              preferences: { ...old.preferences, [key]: value },
              schedules: old.schedules,
            },
            {
              action: `Changed ${key}`,
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              written: [key],
            },
          ) as SettingsRecord,
      );
    },
    [persist],
  );
  const notify = useCallback(
    (message: string, kind: Notice["kind"] = "info") =>
      persist((old) => ({
        ...old,
        notices: [
          ...old.notices,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            kind,
            message: message.slice(0, 1000),
            dismissed: false,
          },
        ].slice(-500),
      })),
    [persist],
  );
  const effective = useMemo(
    () => effectivePreferences(record.preferences, record.schedules, now),
    [record.preferences, record.schedules, now],
  );
  return {
    record,
    preferences: effective.preferences,
    activeSchedules: effective.active,
    storageError,
    storageReady,
    saving,
    reloadSaved,
    update,
    transact,
    undo: () =>
      persist(
        (old) =>
          historyTransition(old, null, {
            mode: "undo",
            action: "Undid latest change",
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
          }) as SettingsRecord,
      ),
    redo: () =>
      persist(
        (old) =>
          historyTransition(old, null, {
            mode: "redo",
            action: "Redid change",
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
          }) as SettingsRecord,
      ),
    notify,
    persist,
    reset: (key: string) => update(key, (defaults as Preferences)[key]),
    selectSection: (section: string) =>
      persist((old) => (old.section === section ? old : { ...old, section })),
    dismiss: (ids: string[]) =>
      persist((old) => ({
        ...old,
        notices: old.notices.map((n) =>
          ids.includes(n.id) ? { ...n, dismissed: true } : n,
        ),
      })),
  };
}
export type SettingsController = ReturnType<typeof useSettings>;
