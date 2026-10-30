import { MaterialInput } from "../MaterialPrimitives";
import { Icon } from "../Icon";
import { mdiArrowUp, mdiArrowDown, mdiRefresh, mdiPlay, mdiDotsVertical } from "../icons";
import React from "react";
import { Profile } from "../api";
import { Button } from "../components";
import { Search } from "../Search";
import { observedRuntime } from "./model.mjs";
import { operationFailure } from "../operation-errors.mjs";
type Props = {
  profiles: Profile[];
  rows: Profile[];
  targets: Profile[];
  selected: string;
  runtime: any;
  engine: string;
  sort: { key: string; direction: string };
  checked: string[];
  pending: string[];
  busy: boolean;
  unlocked: boolean;
  t: (s: string) => string;
  setMatched: (ids: string[]) => void;
  setEngine: (s: string) => void;
  setChecked: React.Dispatch<React.SetStateAction<string[]>>;
  sortBy: (key: string) => void;
  select: (id: string) => void;
  date: (value?: number | string) => string;
  refresh: () => Promise<void>;
  setResults: (results: any[]) => void;
  onLaunch: (profile: Profile) => void;
  act: (method: string, label: string, targets: Profile[]) => void;
};
export function ProfileTable({
  profiles,
  rows,
  targets,
  selected,
  runtime,
  engine,
  sort,
  checked,
  pending,
  busy,
  unlocked,
  t,
  setMatched,
  setEngine,
  setChecked,
  sortBy,
  select,
  date,
  refresh,
  setResults,
  act,
  onLaunch,
}: Props) {
  return (
    <section className="surface profile-list" aria-label={t("Profiles")}>
      <Search
        label={t("Search profiles")}
        items={profiles.map((p) => `${p.name} ${p.engine} ${p.automation}`)}
        itemKeys={profiles.map((p) => p.id)}
        onKeys={setMatched}
        t={t}
      />
      <div className="table-toolbar">
        {React.createElement("md-chip-set", { "aria-label": t("Engine") }, ["all", "chromium", "firefox"].map((value) => React.createElement("md-filter-chip", { key: value, label: value === "all" ? t("All engines") : value === "chromium" ? "Chromium" : "Firefox", selected: engine === value, onClick: () => setEngine(value) })))}
        <span className="table-count">
          {rows.length} / {profiles.length}
        </span>
        <Button
          secondary
          disabled={busy || !unlocked}
          onClick={() =>
            void refresh().catch((error) =>
              setResults([
                {
                  id: "refresh",
                  name: t("Refresh"),
                  ok: false,
                  message: operationFailure(error)[0],
                },
              ]),
            )
          }
        >
          <Icon path={mdiRefresh} size={18} /> {t("Refresh")}
        </Button>
      </div>
      {targets.length > 0 && (
        <div className="bulk-toolbar" aria-label={t("Selected profiles")}>
          <strong>
            {targets.length} {t("Selected profiles")}
          </strong>
          {[
            ["profiles.duplicate", "Duplicate"],
            ["profiles.snapshot", "Snapshot"],
            ["profiles.stop", "Stop"],
            ["profiles.remove", "Remove"],
          ].map(([method, label]) => (
            <Button
              key={method}
              secondary
              disabled={
                targets.some((p) => pending.includes(p.id)) || !unlocked
              }
              onClick={() => act(method, label, targets)}
            >
              {t(label)}
            </Button>
          ))}
          <Button secondary disabled={busy} onClick={() => setChecked([])}>
            {t("Clear selection")}
          </Button>
        </div>
      )}
      <div className="card-list-controls">
        <label className="check-target"><MaterialInput type="checkbox" aria-label={t("Select visible profiles")}
          checked={rows.length > 0 && rows.every((p) => checked.includes(p.id))} disabled={!rows.length}
          onChange={(e) => setChecked((current) => e.target.checked ? Array.from(new Set([...current, ...rows.map((p) => p.id)])) : current.filter((id) => !rows.some((p) => p.id === id)))} />{t("Select visible profiles")}</label>
        {React.createElement("md-chip-set", { "aria-label": t("Sort profiles") }, [["name", "Name"], ["engine", "Engine"], ["automation", "Automation"], ["updatedAt", "Updated"]].map(([key, label]) => React.createElement("md-filter-chip", { key, label: `${t(label)}${sort.key === key ? sort.direction === "asc" ? " ↑" : " ↓" : ""}`, "aria-label": `${t(label)}: ${t(sort.key === key && sort.direction === "desc" ? "Descending" : "Ascending")}`, selected: sort.key === key, onClick: () => sortBy(key) })))}
      </div>
      <div className="profile-cards" role="list">
        {rows.map((p) => {
          const state = p.id === selected ? observedRuntime(runtime) : "Unavailable";
          return <article role="listitem" key={p.id} className={`profile-card${selected === p.id ? " selected" : ""}`}>
            <label className="check-target"><MaterialInput type="checkbox" aria-label={`${t("Select")} ${p.name}`} checked={checked.includes(p.id)} disabled={pending.includes(p.id)}
              onChange={(e) => setChecked((ids) => e.target.checked ? [...new Set([...ids, p.id])] : ids.filter((id) => id !== p.id))} /></label>
            <button className="profile-card-main record-name" aria-pressed={selected === p.id} onClick={() => select(p.id)}>
              <span className="profile-avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="profile-card-copy"><strong>{p.name}</strong><small>{p.engine} · {p.automation === "off" ? t("Off") : p.automation}{p.passwordManager ? " · KeePassXC" : ""}</small><small>{t("Updated")}: {date(p.updatedAt)}</small></span>
            </button>
            <span className="state-badge" data-running={state === "Running"}>{t(state)}</span>
            <Button secondary disabled={pending.includes("*") || pending.includes(p.id) || !unlocked} onClick={() => onLaunch({ ...p })}><Icon path={mdiPlay} size={18} />{t("Launch")}</Button>
            <button className="icon-control" aria-label={`${t("Profile details")}: ${p.name}`} title={t("Profile details")} onClick={() => select(p.id)}><Icon path={mdiDotsVertical} size={20} /></button>
          </article>;
        })}
      </div>
      {!rows.length && (
        <div className="empty">
          <h2>{t(profiles.length ? "No results" : "No profiles yet")}</h2>
          <p>
            {t(
              profiles.length
                ? "Change the search or engine filter."
                : "Create a profile to keep browser data separate.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
