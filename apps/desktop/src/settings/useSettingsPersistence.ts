import { useState, useCallback, useEffect, useRef } from "react";
import { readPresentationRecord, readStoredPresentation } from "./record.mjs";
import type { SettingsRecord, SaveResult } from "./types";
import {
  loadNativePreferences,
  preferenceIdentity,
} from "./native-preferences.mjs";
const KEY = "presentation.v1";
function initial(): SettingsRecord {
  try {
    return readStoredPresentation(
      localStorage.getItem(KEY),
      localStorage.getItem("appearance"),
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
export function useSettingsPersistence() {
  const [record, setRecord] = useState<SettingsRecord>(initial),
    [storageError, setStorageError] = useState(""),
    [storageReady, setStorageReady] = useState(false),
    [saving, setSaving] = useState(false);
  const current = useRef(record);
  const nativeRevision = useRef<number | null>(null);
  const writes = useRef<Promise<SaveResult>>(Promise.resolve({ ok: true }));
  const initialization = useRef<Promise<any> | null>(null);
  const pendingWrites = useRef(0);
  const nativeRequest = useCallback(
    async (operation: string, params: Record<string, unknown> = {}) => {
      if (!window.materialBrowser)
        throw Error(
          "Native preference storage is unavailable. Existing saved preferences were preserved.",
        );
      const result = await window.materialBrowser.settingsService(
        operation,
        params,
      );
      if (!result?.ok)
        throw Error(
          result?.error?.message ||
            "Native preference storage could not complete the request.",
        );
      return result;
    },
    [],
  );
  const acceptNative = useCallback((saved: any) => {
    const changed =
      preferenceIdentity(current.current) !== preferenceIdentity(saved);
    const next = readPresentationRecord({
      ...current.current,
      ...(changed ? { undoStack: [], redoStack: [] } : {}),
      preferences: saved.preferences,
      schedules: saved.schedules,
      writtenKeys: saved.writtenKeys,
    }) as SettingsRecord;
    nativeRevision.current = saved.revision;
    current.current = next;
    setRecord(next);
    setStorageReady(true);
    setStorageError("");
  }, []);
  const loadSaved = useCallback(
    () =>
      loadNativePreferences(nativeRequest, () => ({
        current: localStorage.getItem(KEY),
        appearance: localStorage.getItem("appearance"),
      })),
    [nativeRequest],
  );
  const reloadSaved = useCallback(async () => {
    await writes.current;
    try {
      acceptNative(await loadSaved());
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Saved preferences could not be loaded.",
      );
    }
  }, [loadSaved, acceptNative]);
  useEffect(() => {
    let active = true;
    if (!initialization.current) initialization.current = loadSaved();
    initialization.current
      .then((saved) => {
        if (active) acceptNative(saved);
      })
      .catch((error) => {
        if (active)
          setStorageError(
            error instanceof Error
              ? error.message
              : "Preference migration could not complete. The original local record was preserved.",
          );
      });
    return () => {
      active = false;
    };
  }, [loadSaved, acceptNative]);
  const persist = useCallback(
    (change: (old: SettingsRecord) => SettingsRecord) => {
      pendingWrites.current++;
      setSaving(true);
      const operation: Promise<SaveResult> = writes.current
        .then(async (): Promise<SaveResult> => {
          if (nativeRevision.current === null)
            throw Error(
              "Preferences are still loading or unavailable. Reload saved preferences before editing.",
            );
          const old = current.current,
            next = change(old);
          if (next === old) return { ok: true };
          const projection = (value: SettingsRecord) =>
            JSON.stringify([
              value.preferences,
              value.schedules,
              value.writtenKeys,
            ]);
          const nativeChanged = projection(old) !== projection(next);
          let historyWarning = "";
          if (nativeChanged) {
            const saved = await nativeRequest("preferences-write", {
              expectedRevision: nativeRevision.current,
              preferences: next.preferences,
              schedules: next.schedules,
              writtenKeys: next.writtenKeys,
            });
            nativeRevision.current = saved.record.revision;
            next.preferences = saved.record.preferences;
            next.schedules = saved.record.schedules;
            next.writtenKeys = saved.record.writtenKeys;
            if (saved.history?.warning)
              historyWarning =
                "Preferences were saved, but protected history could not record this change.";
          }
          next.revision = old.revision + 1;
          current.current = next;
          setRecord(next);
          try {
            localStorage.setItem(KEY, JSON.stringify(next));
            setStorageError(historyWarning);
          } catch {
            const message = nativeChanged
              ? "Preferences were saved, but the local workspace cache could not be updated."
              : "The workspace change could not be saved. The previous state was preserved.";
            setStorageError(message);
            if (!nativeChanged) {
              current.current = old;
              setRecord(old);
              return { ok: false, message };
            }
            return { ok: true, warning: message };
          }
          return historyWarning
            ? { ok: true, warning: historyWarning }
            : { ok: true };
        })
        .catch((error): SaveResult => {
          const message =
            error instanceof Error
              ? error.message
              : "Preferences could not be saved. Existing saved values were preserved.";
          setStorageError(message);
          return { ok: false, message };
        })
        .finally(() => {
          pendingWrites.current--;
          setSaving(pendingWrites.current > 0);
        });
      writes.current = operation;
      return operation;
    },
    [nativeRequest],
  );
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const cached = readPresentationRecord(e.newValue) as SettingsRecord;
        const next = {
          ...cached,
          preferences: current.current.preferences,
          schedules: current.current.schedules,
          writtenKeys: current.current.writtenKeys,
        };
        current.current = next;
        setRecord(next);
        void reloadSaved();
      } catch {
        setStorageError(
          "A newer local preferences record is invalid. The current values are retained.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [reloadSaved]);
  return {
    record,
    current,
    persist,
    storageError,
    storageReady,
    saving,
    reloadSaved,
  };
}
