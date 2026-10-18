import React, { useEffect, useRef, useState } from "react";
import { Button, Field, Modal } from "../../components";
import { Search } from "../../Search";
import { Choice } from "../SettingControl";
import { ConfirmAction } from "../ConfirmAction";
import { resolveSearchRecords } from "../interaction-model.mjs";
import {
  historyError,
  historyRequest,
  useProtectedHistory,
} from "../protected-history";
import { HistoryAccess } from "./HistoryAccess";
import type { SettingsController } from "../store";
export function ProtectedHistory({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (value: string) => string;
}) {
  const h = useProtectedHistory();
  const [matches, setMatches] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<any>(null),
    [labelEdit, setLabelEdit] = useState<any>(null);
  const [name, setName] = useState<string | null>(null),
    [nameDraft, setNameDraft] = useState(""),
    [retention, setRetention] = useState("365"),
    [confirmation, setConfirmation] = useState<any>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const visible = resolveSearchRecords(
    matches,
    h.rows.map((row) => ({ ...row, id: row.revision })),
  );
  useEffect(() => {
    if (h.error) errorRef.current?.focus();
  }, [h.error]);
  async function refreshName() {
    const result = await historyRequest("display-name-read");
    if (result.ok) {
      setName(result.displayName);
      setNameDraft(result.displayName || "");
    }
  }
  useEffect(() => {
    void refreshName();
  }, []);
  async function mutate(operation: string, params: Record<string, unknown>) {
    const result = await h.run(operation, params);
    if (!result.ok)
      return { ok: false as const, message: historyError(result) };
    await c.reloadSaved();
    await refreshName();
    window.dispatchEvent(new Event("display-name-changed"));
    return { ok: true as const };
  }
  async function exportSelection() {
    const included = new Set(
      visible.filter((row) => selected.includes(row.id)).map((row) => row.id),
    );
    const result = await h.run("history-export");
    if (!result.ok) return;
    const revisions = result.revisions.filter((row: any) =>
      included.has(row.revision),
    );
    const blob = new Blob(
      [
        JSON.stringify(
          { schemaVersion: 1, revisions, omitted: result.omitted },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "protected-settings-history.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="settings-workflows protected-history">
      <div className="setting-card">
        <h2>{t("Protected native history")}</h2>
        <p>
          {t(
            "Encrypted append-only history uses an independent password or PIN. Imported personal wording, credentials and device paths are excluded.",
          )}
        </p>
        <p role="status">
          {t(
            !h.status
              ? "Checking protected history"
              : !h.status.ok
                ? "Protected history unavailable"
                : h.status.unlocked
                  ? "History unlocked"
                  : h.status.configured
                    ? "History locked"
                    : "History not configured",
          )}
        </p>
        {h.error && (
          <p
            role="alert"
            tabIndex={-1}
            ref={!labelEdit && !preview ? errorRef : undefined}
          >
            {t(h.error)}
          </p>
        )}
        <Button secondary disabled={h.busy} onClick={() => void h.refresh()}>
          {t("Refresh history status")}
        </Button>
      </div>
      <HistoryAccess history={h} t={t} />
      {h.status?.unlocked && (
        <>
          {h.status.recoveryPending && (
            <section className="setting-card">
              <h3>{t("Recover an unfinished operation")}</h3>
              <p>
                {t(
                  "Retry applies only the recorded expected state. Discard retains existing history and ends the pending operation without applying its target.",
                )}
              </p>
              <Button
                disabled={h.busy || h.status.needsExplicitDiscard}
                onClick={() =>
                  setConfirmation({ kind: "recover", decision: "retry" })
                }
              >
                {t("Retry recovery")}
              </Button>
              <Button
                secondary
                disabled={h.busy}
                onClick={() =>
                  setConfirmation({ kind: "recover", decision: "discard" })
                }
              >
                {t("Discard pending operation")}
              </Button>
            </section>
          )}
          <section className="setting-card">
            <h3>{t("Application display name")}</h3>
            <p>
              {t(
                "The default is Material Browser. A custom name changes only the workspace header; installed identity, file paths and update identity stay unchanged. Every saved change requires unlocked history.",
              )}
            </p>
            <Field
              label={t("Display name")}
              disabled={h.busy}
              value={nameDraft}
              onChange={setNameDraft}
            />
            <Button
              disabled={h.busy || !nameDraft.trim() || nameDraft.length > 120}
              onClick={() =>
                void mutate("display-name-write", {
                  expectedName: name,
                  displayName: nameDraft,
                  action: name === null ? "created" : "updated",
                })
              }
            >
              {t("Save display name")}
            </Button>
            <Button
              secondary
              disabled={h.busy || name === null}
              onClick={() => setConfirmation({ kind: "name-reset" })}
            >
              {t("Reset display name")}
            </Button>
          </section>
          <section className="setting-card">
            <h3>{t("Recorded changes")}</h3>
            <p>
              {t(
                "At most 500 matching records are shown. Dates, action and text filters compose. Exports omit free-text labels and values; physical pruning is not available.",
              )}
            </p>
            <div className="settings-grid">
              <Field
                label={t("Start date")}
                type="date"
                value={h.from}
                onChange={h.setFrom}
              />
              <Field
                label={t("End date")}
                type="date"
                value={h.to}
                onChange={h.setTo}
              />
            </div>
            <Choice
              label={t("History action")}
              value={h.action}
              options={[
                ["", t("All actions")],
                ...[
                  "created",
                  "updated",
                  "deleted",
                  "reset",
                  "restored",
                  "imported",
                  "settings-changed",
                ].map((action) => [action, action] as [string, string]),
              ]}
              onChange={h.setAction}
              t={t}
            />
            <Search
              label={t("Search protected history")}
              items={h.rows.map(
                (row) => `${row.date} ${row.action} ${row.label}`,
              )}
              itemKeys={h.rows.map((row) => row.revision)}
              onKeys={setMatches}
              t={t}
            />
            <div className="actions">
              <Button
                secondary
                onClick={() => setSelected(visible.map((row) => row.id))}
              >
                {t("Select all matches")}
              </Button>
              <Button
                secondary
                onClick={() =>
                  setSelected(
                    visible
                      .filter((row) => !selected.includes(row.id))
                      .map((row) => row.id),
                  )
                }
              >
                {t("Inverse selection")}
              </Button>
              <Button
                secondary
                disabled={
                  h.busy ||
                  !selected.some((id) => visible.some((row) => row.id === id))
                }
                onClick={exportSelection}
              >
                {t("Export selected redacted JSON")}
              </Button>
            </div>
            {!visible.length && <p>{t("No recorded changes")}</p>}
            {visible.map((row) => (
              <article className="settings-record" key={row.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, row.id]
                          : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                  {row.label || row.action}
                </label>
                <p>
                  {new Date(row.date).toLocaleString()} · {row.action}
                </p>
                <Button
                  secondary
                  disabled={h.busy}
                  onClick={async () => {
                    const result = await h.run("history-diff", {
                      revision: row.id,
                    });
                    if (result.ok) setPreview({ ...result, revision: row.id });
                  }}
                >
                  {t("Review changes")}
                </Button>
                <Button
                  secondary
                  disabled={h.busy}
                  onClick={() =>
                    setLabelEdit({ revision: row.id, label: row.label })
                  }
                >
                  {t("Edit history label")}
                </Button>
              </article>
            ))}
            <details>
              <summary>{t("History retention")}</summary>
              <p>
                {t(
                  "Default: show all retained records. A limit of 1–36500 days changes visibility only; encrypted records are not physically deleted.",
                )}
              </p>
              <Field
                label={t("Visible history days")}
                type="number"
                value={retention}
                onChange={setRetention}
              />
              <Button
                disabled={
                  h.busy ||
                  !Number.isInteger(Number(retention)) ||
                  Number(retention) < 1 ||
                  Number(retention) > 36500
                }
                onClick={() =>
                  void h.run("history-retention", {
                    visibleDays: Number(retention),
                  })
                }
              >
                {t("Save retention visibility")}
              </Button>
            </details>
          </section>
        </>
      )}
      {labelEdit && (
        <Modal
          title={t("Edit history label")}
          onClose={() => setLabelEdit(null)}
        >
          <Field
            label={t("History label")}
            disabled={h.busy}
            value={labelEdit.label}
            onChange={(label) => setLabelEdit({ ...labelEdit, label })}
          />
          {h.error && (
            <p ref={errorRef} role="alert" tabIndex={-1}>
              {t(h.error)}
            </p>
          )}
          <p>
            {t(
              "Labels are limited to 120 characters and are omitted from redacted exports. Clearing removes the visible label.",
            )}
          </p>
          <Button
            disabled={h.busy || labelEdit.label.length > 120}
            onClick={async () => {
              const result = await h.run("history-label", labelEdit);
              if (result.ok) setLabelEdit(null);
            }}
          >
            {t("Save label")}
          </Button>
        </Modal>
      )}
      {preview && (
        <Modal
          title={t("Review protected revision")}
          onClose={() => setPreview(null)}
        >
          <p>
            {preview.recordKind === "display-name"
              ? t("This revision changes the protected display name.")
              : `${t("Changed settings")}: ${(preview.changedKeys || []).join(", ")}`}
          </p>
          <p>
            {t(
              "Restore appends a new history event. It never rewrites earlier records.",
            )}
          </p>
          <Button
            disabled={h.busy || h.status?.recoveryPending}
            onClick={() => {
              setConfirmation({ kind: "restore", revision: preview.revision });
              setPreview(null);
            }}
          >
            {t("Restore this revision")}
          </Button>
        </Modal>
      )}
      {confirmation && (
        <ConfirmAction
          title={t(
            confirmation.kind === "restore"
              ? "Restore this revision"
              : confirmation.kind === "name-reset"
                ? "Reset display name"
                : confirmation.decision === "retry"
                  ? "Retry recovery"
                  : "Discard pending operation",
          )}
          description={t(
            "Review the affected protected record. Existing history is retained.",
          )}
          t={t}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            const result =
              confirmation.kind === "restore"
                ? await mutate("history-restore", {
                    revision: confirmation.revision,
                  })
                : confirmation.kind === "name-reset"
                  ? await mutate("display-name-write", {
                      expectedName: name,
                      displayName: null,
                      action: "reset",
                    })
                  : await mutate("history-recover", {
                      decision: confirmation.decision,
                    });
            if (result.ok) setConfirmation(null);
            return result;
          }}
        />
      )}
    </section>
  );
}
