import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  defaults,
  validatePreferences,
  validateValue,
  validateSchedule,
  effectivePreferences,
} from "./model.mjs";
import { readPresentationRecord } from "./record.mjs";
export type Preferences = Record<string, any>;
export type Revision = {
  id: string;
  at: string;
  action: string;
  keys: string[];
  preferences: Preferences;
  schedules: any[];
};
export type Notice = {
  id: string;
  at: string;
  kind: "info" | "success" | "warning" | "error";
  message: string;
  dismissed: boolean;
};
export type SettingsRecord = {
  schemaVersion: 1;
  revision: number;
  preferences: Preferences;
  writtenKeys: string[];
  schedules: any[];
  revisions: Revision[];
  notices: Notice[];
  section: string;
  snoozeUntil: number;
};
const KEY = "presentation.v1";
function initial(): SettingsRecord {
  try {
    return readPresentationRecord(
      localStorage.getItem(KEY),
      JSON.parse(localStorage.getItem("appearance") || "null"),
    ) as SettingsRecord;
  } catch {
    const empty = readPresentationRecord(null) as SettingsRecord;
    empty.notices = [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: "warning",
        message:
          "Saved preferences could not be read. Defaults are active; the original record was not overwritten.",
        dismissed: false,
      },
    ];
    return empty;
  }
}
export function useSettings() {
  const [record, setRecord] = useState<SettingsRecord>(initial),
    [storageError, setStorageError] = useState(""),
    [now, setNow] = useState(() => new Date());
  const current = useRef(record);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const persist = useCallback(
    (change: (old: SettingsRecord) => SettingsRecord) => {
      const old = current.current,
        next = change(old);
      if (next === old) return;
      next.revision = old.revision + 1;
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) {
          const parsed = readPresentationRecord(stored);
          if (parsed.revision !== old.revision)
            throw Error(
              "Preferences changed in another window. Reload before editing.",
            );
        }
        localStorage.setItem(KEY, JSON.stringify(next));
        setStorageError("");
      } catch (e) {
        setStorageError(
          e instanceof Error
            ? e.message
            : "Local storage could not save this change.",
        );
        return;
      }
      current.current = next;
      setRecord(next);
    },
    [],
  );
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const next = readPresentationRecord(e.newValue) as SettingsRecord;
        current.current = next;
        setRecord(next);
        setStorageError("");
      } catch {
        setStorageError(
          "A newer local preferences record is invalid. The current values are retained.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
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
      persist((old) => {
        if (
          JSON.stringify(old.preferences) === JSON.stringify(validated) &&
          JSON.stringify(old.schedules) === JSON.stringify(validSchedules)
        )
          return old;
        const keys = Object.keys(validated).filter(
          (k) => old.preferences[k] !== validated[k],
        );
        const baseline = old.revisions.length
          ? old.revisions
          : [
              {
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
                action: "Initial preferences",
                keys: [],
                preferences: { ...old.preferences },
                schedules: old.schedules,
              },
            ];
        return {
          ...old,
          preferences: validated,
          writtenKeys: [...new Set([...old.writtenKeys, ...(written ?? keys)])],
          schedules: validSchedules,
          revisions: [
            ...baseline,
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              action,
              keys,
              preferences: { ...validated },
              schedules: validSchedules,
            },
          ],
        };
      });
    },
    [persist],
  );
  const update = useCallback(
    (key: string, value: any) => {
      validateValue(key, value);
      transact(
        `Changed ${key}`,
        { ...current.current.preferences, [key]: value },
        undefined,
        [key],
      );
    },
    [transact],
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
    update,
    transact,
    notify,
    persist,
    reset: (key: string) => update(key, (defaults as Preferences)[key]),
    selectSection: (section: string) => persist((old) => ({ ...old, section })),
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
