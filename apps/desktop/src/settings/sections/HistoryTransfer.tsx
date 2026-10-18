import React, { useState } from "react";
import { Button, Field } from "../../components";
import { Search } from "../../Search";
import { Choice } from "../SettingControl";
import { ConfirmAction } from "../ConfirmAction";
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
    [reset, setReset] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [action, setAction] = useState(""),
    [rows, setRows] = useState<number[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const filtered = c.record.revisions.filter(
    (r) =>
      (!from || r.at.slice(0, 10) >= from) &&
      (!to || r.at.slice(0, 10) <= to) &&
      (!action || r.action === action),
  );
  const actions = [...new Set(c.record.revisions.map((r) => r.action))];
  async function importFile(file: File) {
    try {
      if (file.size > 262144) throw Error("Import exceeds 256 KiB");
      const next = parseImport(await file.text());
      setPending(next);
      setError("");
    } catch (e) {
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
        {error && <p role="alert">{t(error)}</p>}
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
              onClick={() => {
                c.transact(
                  "Imported preferences",
                  pending.preferences,
                  pending.schedules,
                  Object.keys(pending.preferences),
                );
                setPending(null);
              }}
            >
              {t("Apply import")}
            </Button>
            <Button secondary onClick={() => setPending(null)}>
              {t("Cancel")}
            </Button>
          </div>
        )}
      </section>
      <section className="setting-card">
        <h2>{t("History")}</h2>
        <p>
          {t(
            "Local settings history is not yet the protected native history service.",
          )}
        </p>
        <div className="actions">
          <Button
            disabled={c.record.revisions.length < 2}
            secondary
            onClick={() => {
              const r = c.record.revisions[c.record.revisions.length - 2];
              c.transact("Undid latest change", r.preferences, r.schedules);
            }}
          >
            {t("Undo latest change")}
          </Button>
          <Button
            disabled={c.record.revisions.length < 2}
            secondary
            onClick={() => {
              const r = c.record.revisions[c.record.revisions.length - 2];
              c.transact("Restored previous state", r.preferences, r.schedules);
            }}
          >
            {t("Redo previous state")}
          </Button>
        </div>
        <div className="settings-grid">
          <Field
            label={t("Start date")}
            type="date"
            value={from}
            onChange={setFrom}
          />
          <Field
            label={t("End date")}
            type="date"
            value={to}
            onChange={setTo}
          />
        </div>
        <Choice
          label={t("Action")}
          value={action}
          options={[
            ["", t("All actions")],
            ...actions.map(
              (a) =>
                [
                  a,
                  `${a} (${c.record.revisions.filter((r) => r.action === a).length})`,
                ] as [string, string],
            ),
          ]}
          onChange={setAction}
          t={t}
        />
        <Search
          label={t("Search history")}
          items={filtered.map((r) => `${r.at} ${r.action} ${r.keys.join(" ")}`)}
          onResults={setRows}
          t={t}
        />
        <div className="actions">
          <Button
            secondary
            onClick={() => setSelected(rows.map((i) => filtered[i].id))}
          >
            {t("Select all matches")}
          </Button>
          <Button
            secondary
            onClick={() =>
              setSelected(
                rows
                  .map((i) => filtered[i].id)
                  .filter((id) => !selected.includes(id)),
              )
            }
          >
            {t("Inverse selection")}
          </Button>
          <Button
            secondary
            disabled={!selected.length}
            onClick={() =>
              downloadText(
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    omitted: ["Personal wording", "Credentials"],
                    revisions: filtered.filter((r) => selected.includes(r.id)),
                  },
                  null,
                  2,
                ) + "\n",
                "settings-history.json",
                "application/json",
              )
            }
          >
            {t("Export selected")}
          </Button>
        </div>
        {!filtered.length && <p>{t("No recorded changes")}</p>}
        {rows
          .slice()
          .reverse()
          .map((i) => {
            const r = filtered[i];
            return (
              <article key={r.id} className="settings-record">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((id) => id !== r.id),
                      )
                    }
                  />
                  {r.action}
                </label>
                <p>{new Date(r.at).toLocaleString()}</p>
                <details>
                  <summary>{t("Changes")}</summary>
                  {r.keys.map((k) => (
                    <p key={k}>
                      {k}: {String(r.preferences[k])}
                    </p>
                  ))}
                </details>
                <Button
                  secondary
                  onClick={() =>
                    setPending({
                      preferences: r.preferences,
                      schedules: r.schedules,
                    })
                  }
                >
                  {t("Restore revision")}
                </Button>
              </article>
            );
          })}
      </section>
      {reset && (
        <ConfirmAction
          title={t("Reset all preferences")}
          description={t(
            "Restore the built-in defaults and remove local schedules. History is retained.",
          )}
          t={t}
          onCancel={() => setReset(false)}
          onConfirm={() => {
            c.transact(
              "Reset preferences",
              { ...defaults },
              [],
              Object.keys(defaults),
            );
            setReset(false);
          }}
        />
      )}
    </div>
  );
}
