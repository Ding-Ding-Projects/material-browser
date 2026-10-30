import { MaterialInput } from "../../MaterialPrimitives";
import React, { useState } from "react";
import { Button } from "../../components";
import { resolveSearchRecords } from "../interaction-model.mjs";
import { Search } from "../../Search";
import type { SettingsController } from "../store";
import { downloadText } from "./HistoryTransfer";
export function NotificationCenter({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const [rows, setRows] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [undo, setUndo] = useState<string[]>([]),
    [unread, setUnread] = useState(false),
    [last, setLast] = useState<string | null>(null);
  const items = c.record.notices.filter((n) => !unread || !n.dismissed);
  const visibleRecords = resolveSearchRecords(rows, items);
  function select(id: string, checked: boolean, shift: boolean) {
    const index = visibleRecords.findIndex((item) => item.id === id);
    const previous = visibleRecords.findIndex((item) => item.id === last);
    let ids = [id];
    if (shift && previous >= 0 && index >= 0)
      ids = visibleRecords
        .slice(Math.min(previous, index), Math.max(previous, index) + 1)
        .map((item) => item.id);
    setSelected((old) =>
      checked
        ? [...new Set([...old, ...ids])]
        : old.filter((key) => !ids.includes(key)),
    );
    setLast(id);
  }
  return (
    <section className="setting-card">
      <h2>{t("Notification centre")}</h2>
      <p>
        {t(
          "The centre retains the latest 500 non-sensitive application messages. Dismissed messages remain reviewable.",
        )}
      </p>
      <label>
        <MaterialInput
          type="checkbox"
          aria-label={t("Undismissed only")} checked={unread}
          onChange={(e) => setUnread(e.target.checked)}
        />
        {t("Undismissed only")}
      </label>
      <Search
        label={t("Search notifications")}
        items={items.map((x) => `${x.kind} ${x.message} ${x.at}`)}
        itemKeys={items.map((n) => n.id)}
        onKeys={setRows}
        t={t}
      />
      <div className="actions">
        <Button
          secondary
          onClick={() => setSelected(visibleRecords.map((n) => n.id))}
        >
          {t("Select all matches")}
        </Button>
        <Button
          secondary
          onClick={() =>
            setSelected(
              visibleRecords
                .map((n) => n.id)
                .filter((id) => !selected.includes(id)),
            )
          }
        >
          {t("Inverse selection")}
        </Button>
        <Button
          secondary
          disabled={!selected.length}
          onClick={async () => {
            const result = await c.dismiss(selected);
            if (result.ok) {
              setUndo(selected);
              setSelected([]);
            }
          }}
        >
          {t("Dismiss selected")}
        </Button>
        <Button
          secondary
          disabled={!undo.length}
          onClick={async () => {
            const result = await c.persist((old) => ({
              ...old,
              notices: old.notices.map((n) =>
                undo.includes(n.id) ? { ...n, dismissed: false } : n,
              ),
            }));
            if (result.ok) setUndo([]);
          }}
        >
          {t("Undo dismissal")}
        </Button>
        <Button
          secondary
          disabled={!selected.length}
          onClick={() =>
            downloadText(
              JSON.stringify(
                {
                  schemaVersion: 1,
                  encoding: "UTF-8",
                  lineEndings: "LF",
                  messages: items.filter((n) => selected.includes(n.id)),
                },
                null,
                2,
              ) + "\n",
              "notifications.json",
              "application/json",
            )
          }
        >
          {t("Export selected")}
        </Button>
      </div>
      {!rows.length && <p>{t("No notifications")}</p>}
      {visibleRecords
        .slice()
        .reverse()
        .map((n: any) => {
          return (
            <article className="settings-record" key={n.id}>
              <label>
                <MaterialInput
                  type="checkbox"
                  aria-label={`${t("Select")} ${t(n.kind)} ${new Date(n.at).toLocaleString()}`} checked={selected.includes(n.id)}
                  onClick={(e) =>
                    select(n.id, !selected.includes(n.id), e.shiftKey)
                  }
                  onChange={() => {}}
                />
                {t(n.kind)} · {new Date(n.at).toLocaleString()}
              </label>
              <p>{n.message}</p>
              <p>{t(n.dismissed ? "Dismissed" : "Undismissed")}</p>
              <Button
                secondary
                disabled={n.dismissed}
                onClick={async () => {
                  const result = await c.dismiss([n.id]);
                  if (result.ok) setUndo([n.id]);
                }}
              >
                {t("Dismiss")}
              </Button>
            </article>
          );
        })}
    </section>
  );
}
