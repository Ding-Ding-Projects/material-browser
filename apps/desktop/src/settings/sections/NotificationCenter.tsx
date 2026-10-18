import React, { useState } from "react";
import { Button } from "../../components";
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
  const [rows, setRows] = useState<number[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [undo, setUndo] = useState<string[]>([]),
    [unread, setUnread] = useState(false),
    [last, setLast] = useState<number | null>(null);
  const items = c.record.notices.filter((n) => !unread || !n.dismissed);
  function select(index: number, checked: boolean, shift: boolean) {
    let ids = [items[index].id];
    if (shift && last !== null)
      ids = items
        .slice(Math.min(last, index), Math.max(last, index) + 1)
        .map((x) => x.id);
    setSelected((old) =>
      checked
        ? [...new Set([...old, ...ids])]
        : old.filter((id) => !ids.includes(id)),
    );
    setLast(index);
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
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => setUnread(e.target.checked)}
        />
        {t("Undismissed only")}
      </label>
      <Search
        label={t("Search notifications")}
        items={items.map((x) => `${x.kind} ${x.message} ${x.at}`)}
        onResults={setRows}
        t={t}
      />
      <div className="actions">
        <Button
          secondary
          onClick={() => setSelected(rows.map((i) => items[i].id))}
        >
          {t("Select all matches")}
        </Button>
        <Button
          secondary
          onClick={() =>
            setSelected(
              rows
                .map((i) => items[i].id)
                .filter((id) => !selected.includes(id)),
            )
          }
        >
          {t("Inverse selection")}
        </Button>
        <Button
          secondary
          disabled={!selected.length}
          onClick={() => {
            setUndo(selected);
            c.dismiss(selected);
            setSelected([]);
          }}
        >
          {t("Dismiss selected")}
        </Button>
        <Button
          secondary
          disabled={!undo.length}
          onClick={() => {
            c.persist((old) => ({
              ...old,
              notices: old.notices.map((n) =>
                undo.includes(n.id) ? { ...n, dismissed: false } : n,
              ),
            }));
            setUndo([]);
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
      {rows
        .slice()
        .reverse()
        .map((i) => {
          const n = items[i];
          return (
            <article className="settings-record" key={n.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(n.id)}
                  onClick={(e) =>
                    select(i, !selected.includes(n.id), e.shiftKey)
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
                onClick={() => {
                  setUndo([n.id]);
                  c.dismiss([n.id]);
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
