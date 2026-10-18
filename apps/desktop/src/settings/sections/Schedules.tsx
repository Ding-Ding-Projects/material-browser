import React, { useState } from "react";
import { Button, Field } from "../../components";
import { Search } from "../../Search";
import { Choice, SettingInput } from "../SettingControl";
import { ConfirmAction } from "../ConfirmAction";
import { preserveScheduleEdit } from "../history-model.mjs";
import { resolveSearchRecords } from "../interaction-model.mjs";
import { definitions, validateSchedule } from "../model.mjs";
import type { SettingsController } from "../store";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function Schedules({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const [label, setLabel] = useState(""),
    [key, setKey] = useState("theme"),
    [value, setValue] = useState<any>("dark"),
    [start, setStart] = useState("18:00"),
    [end, setEnd] = useState("08:00"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]),
    [priority, setPriority] = useState("1"),
    [error, setError] = useState(""),
    [rows, setRows] = useState<string[]>([]),
    [editing, setEditing] = useState<string | null>(null),
    [remove, setRemove] = useState<string | null>(null);
  const d = definitions.find((x) => x.key === key)!;
  function save() {
    try {
      const previous = c.record.schedules.find((r) => r.id === editing);
      const rule = validateSchedule(
        preserveScheduleEdit(previous, {
          id: editing || crypto.randomUUID(),
          label,
          enabled: previous?.enabled ?? true,
          priority: Number(priority),
          startDate: from,
          endDate: to,
          startTime: start,
          endTime: end,
          weekdays,
          values: { ...previous?.values, [key]: value },
          source: "local",
        }),
      );
      const rules = editing
        ? c.record.schedules.map((r) => (r.id === editing ? rule : r))
        : [...c.record.schedules, rule];
      c.transact(
        editing ? "Updated schedule" : "Created schedule",
        c.record.preferences,
        rules,
      );
      setEditing(null);
      setLabel("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid schedule");
    }
  }
  function edit(r: any) {
    setEditing(r.id);
    setLabel(r.label);
    setStart(r.startTime);
    setEnd(r.endTime);
    setFrom(r.startDate);
    setTo(r.endDate);
    setWeekdays(r.weekdays);
    setPriority(String(r.priority));
    const [k, v] = Object.entries(r.values)[0];
    setKey(k);
    setValue(v);
  }
  return (
    <div className="settings-workflows">
      <section className="setting-card">
        <h2>{t(editing ? "Edit schedule" : "Create schedule")}</h2>
        <p>
          {t(
            "Higher priority wins; later rules win ties. Overnight rules belong to the starting day. Equal times mean all day.",
          )}
        </p>
        <p>
          {t("Local timezone")}:{" "}
          <code>{Intl.DateTimeFormat().resolvedOptions().timeZone}</code>.{" "}
          {t(
            "Daylight-saving changes follow the local clock; repeated times match twice and skipped times do not occur.",
          )}
        </p>
        <div className="settings-grid">
          <Field
            label={t("Schedule label")}
            value={label}
            onChange={setLabel}
          />
          <Field
            label={t("Priority")}
            type="number"
            value={priority}
            onChange={setPriority}
          />
          <Field
            label={t("Start time")}
            type="time"
            value={start}
            onChange={setStart}
          />
          <Field
            label={t("End time")}
            type="time"
            value={end}
            onChange={setEnd}
          />
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
        <div className="weekday-controls">
          <Button secondary onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}>
            {t("Every day")}
          </Button>
          {days.map((day, i) => (
            <label key={day}>
              {React.createElement("md-switch", {
                "aria-label": t(day),
                selected: weekdays.includes(i),
                onChange: (e: any) =>
                  setWeekdays(
                    e.target.selected
                      ? [...weekdays, i]
                      : weekdays.filter((x) => x !== i),
                  ),
              })}
              {t(day)}
            </label>
          ))}
        </div>
        <Choice
          label={t("Setting")}
          value={key}
          options={
            definitions.map((x) => [x.key, t(x.label)]) as [string, string][]
          }
          onChange={(v) => {
            setKey(v);
            setValue(c.record.preferences[v]);
          }}
          t={t}
        />
        <SettingInput definition={d} value={value} onChange={setValue} t={t} />
        <p>{t("Local source")}</p>
        <p>
          {t("Online schedule sources are not yet supported in this build.")}
        </p>
        {error && <p role="alert">{t(error)}</p>}
        <div className="actions">
          <Button onClick={save}>
            {t(editing ? "Save changes" : "Add schedule")}
          </Button>
          {editing && (
            <Button
              secondary
              onClick={() => {
                setEditing(null);
                setLabel("");
              }}
            >
              {t("Cancel")}
            </Button>
          )}
        </div>
      </section>
      <section className="setting-card">
        <h2>{t("Schedules")}</h2>
        <Search
          label={t("Search schedules")}
          items={c.record.schedules.map(
            (r) =>
              `${r.label} ${r.startTime} ${r.endTime} ${Object.keys(r.values).join(" ")}`,
          )}
          itemKeys={c.record.schedules.map((r) => r.id)}
          onKeys={setRows}
          t={t}
        />
        <p>
          {t("Active rules")}: {c.activeSchedules.join(", ") || t("None")}
        </p>
        {!c.record.schedules.length && <p>{t("No schedules")}</p>}
        {resolveSearchRecords(rows, c.record.schedules).map((r: any) => {
          const i = c.record.schedules.findIndex((item) => item.id === r.id);
          return (
            <article className="settings-record" key={r.id}>
              <h3>{r.label}</h3>
              <p>
                {r.startTime}–{r.endTime} · {t("Priority")} {r.priority} ·{" "}
                {r.weekdays.map((n: number) => t(days[n])).join(", ")}
              </p>
              <p>
                {Object.entries(r.values)
                  .map(
                    ([k, v]) =>
                      `${t(definitions.find((d) => d.key === k)?.label || k)}: ${String(v)}`,
                  )
                  .join(", ")}
              </p>
              <div className="actions">
                <Button secondary onClick={() => edit(r)}>
                  {t("Edit")}
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    c.transact(
                      r.enabled ? "Disabled schedule" : "Enabled schedule",
                      c.record.preferences,
                      c.record.schedules.map((x) =>
                        x.id === r.id ? { ...x, enabled: !x.enabled } : x,
                      ),
                    )
                  }
                >
                  {t(r.enabled ? "Disable" : "Enable")}
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    c.transact("Duplicated schedule", c.record.preferences, [
                      ...c.record.schedules,
                      {
                        ...r,
                        id: crypto.randomUUID(),
                        label: r.label.slice(0, 113) + " (copy)",
                      },
                    ])
                  }
                >
                  {t("Duplicate")}
                </Button>
                <Button
                  secondary
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...c.record.schedules];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    c.transact(
                      "Reordered schedules",
                      c.record.preferences,
                      next,
                    );
                  }}
                >
                  {t("Move earlier")}
                </Button>
                <Button secondary onClick={() => setRemove(r.id)}>
                  {t("Remove")}
                </Button>
              </div>
            </article>
          );
        })}
      </section>
      {remove && (
        <ConfirmAction
          title={t("Remove schedule")}
          description={
            c.record.schedules.find((r) => r.id === remove)?.label || ""
          }
          t={t}
          onCancel={() => setRemove(null)}
          onConfirm={() => {
            c.transact(
              "Removed schedule",
              c.record.preferences,
              c.record.schedules.filter((r) => r.id !== remove),
            );
            setRemove(null);
          }}
        />
      )}
    </div>
  );
}
