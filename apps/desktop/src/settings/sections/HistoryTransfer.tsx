import React, { useState, useRef } from "react";
import { Button, Field } from "../../components";
import { Choice } from "../SettingControl";
import { ConfirmAction } from "../ConfirmAction";
import { ProtectedHistory } from "./ProtectedHistory";
import {
  defaults,
  exportPreferences,
  parseImport,
  formatExport,
} from "../model.mjs";
import type { SettingsController } from "../store";
export function downloadText(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function HistoryTransfer({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const [format, setFormat] = useState("json"),
    [pending, setPending] = useState<any>(null),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
  async function importFile(file: File) {
    try {
      if (file.size > 262144) throw Error("Import exceeds 256 KiB");
      const next = parseImport(await file.text());
      setPending({ ...next, action: "Imported preferences" });
      setError("");
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : "Invalid import");
    }
  }
  return (
    <div className="settings-workflows">
      <section className="setting-card">
        <h2>{t("History and transfer")}</h2>
        <p>{t("Personal wording and credentials are excluded.")}</p>
        <Choice
          label={t("Export format")}
          value={format}
          options={[
            ["json", "JSON (round-trip)"],
            ["jsonl", "JSON Lines"],
            ["csv", "CSV"],
            ["tsv", "TSV"],
            ["md", "Markdown"],
          ]}
          onChange={setFormat}
          t={t}
        />
        <div className="actions">
          <Button
            onClick={() =>
              downloadText(
                formatExport(
                  exportPreferences(c.record.preferences, c.record.schedules),
                  format,
                ),
                `material-browser-settings.${format}`,
              )
            }
          >
            {t("Export preferences")}
          </Button>
          <label className="file-control">
            {t("Import preferences")}
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <Button secondary onClick={() => setReset(true)}>
            {t("Reset all preferences")}
          </Button>
        </div>
        {error && (
          <p role="alert" tabIndex={-1} ref={errorRef}>
            {t(error)}
          </p>
        )}
        {pending && (
          <div className="import-preview">
            <h3>{t("Review import")}</h3>
            <p>
              {t("Changes")}:{" "}
              {Object.keys(pending.preferences)
                .filter(
                  (k) => pending.preferences[k] !== c.record.preferences[k],
                )
                .join(", ") || t("None")}
            </p>
            <p>
              {t("Schedules")}: {pending.schedules.length}
            </p>
            <Button
              disabled={applying}
              onClick={async () => {
                if (applyingRef.current) return;
                applyingRef.current = true;
                setApplying(true);
                try {
                  const result = await c.transact(
                    pending.action || "Imported preferences",
                    pending.preferences,
                    pending.schedules,
                    Object.keys(pending.preferences),
                  );
                  if (result.ok) {
                    setPending(null);
                    setError("");
                  } else {
                    setError(result.message);
                    requestAnimationFrame(() => errorRef.current?.focus());
                  }
                } catch {
                  setError(
                    "The import could not be saved. Review the values and retry.",
                  );
                  requestAnimationFrame(() => errorRef.current?.focus());
                } finally {
                  applyingRef.current = false;
                  setApplying(false);
                }
              }}
            >
              {t(
                applying
                  ? "Saving preferences"
                  : error
                    ? "Retry import"
                    : "Apply import",
              )}
            </Button>
            <Button secondary onClick={() => setPending(null)}>
              {t("Cancel")}
            </Button>
          </div>
        )}
      </section>
      <section className="setting-card">
        <h2>{t("Undo and redo preferences")}</h2>
        <p>
          {t(
            "Undo and redo change the current preferences and append a new event when protected history is configured. Existing legacy cache records are retained locally, but are not presented as protected history.",
          )}
        </p>
        <div className="actions">
          <Button
            secondary
            disabled={c.saving || !c.record.undoStack.length}
            onClick={c.undo}
          >
            {t("Undo latest change")}
          </Button>
          <Button
            secondary
            disabled={c.saving || !c.record.redoStack.length}
            onClick={c.redo}
          >
            {t("Redo previous state")}
          </Button>
        </div>
      </section>
      <ProtectedHistory controller={c} t={t} />
      {reset && (
        <ConfirmAction
          title={t("Reset all preferences")}
          description={t(
            "Restore the built-in defaults and remove local schedules. History is retained.",
          )}
          t={t}
          onCancel={() => setReset(false)}
          onConfirm={async () => {
            const result = await c.transact(
              "Reset preferences",
              { ...defaults },
              [],
              Object.keys(defaults),
            );
            if (result.ok) setReset(false);
            return result;
          }}
        />
      )}
    </div>
  );
}
