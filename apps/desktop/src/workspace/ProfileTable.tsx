import { Icon } from "../Icon";
import { mdiArrowUp, mdiArrowDown, mdiRefresh } from "@mdi/js";
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
        <label>
          {t("Engine")}{" "}
          <select value={engine} onChange={(e) => setEngine(e.target.value)}>
            <option value="all">{t("All engines")}</option>
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
          </select>
        </label>
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
      <div className="table-scroll">
        <table className="workspace-table">
          <caption className="sr-only">{t("Profiles")}</caption>
          <thead>
            <tr>
              <th scope="col">
                <label className="check-target">
                  <input
                    type="checkbox"
                    aria-label={t("Select visible profiles")}
                    checked={
                      rows.length > 0 &&
                      rows.every((p) => checked.includes(p.id))
                    }
                    disabled={!rows.length}
                    onChange={(e) =>
                      setChecked((current) =>
                        e.target.checked
                          ? Array.from(
                              new Set([...current, ...rows.map((p) => p.id)]),
                            )
                          : current.filter(
                              (id) => !rows.some((p) => p.id === id),
                            ),
                      )
                    }
                  />
                </label>
              </th>
              {[
                ["name", "Name"],
                ["engine", "Engine"],
                ["runtime", "Runtime"],
                ["automation", "Saved preference"],
                ["updatedAt", "Updated"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    key === sort.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {key === "runtime" ? (
                    t(label)
                  ) : (
                    <button onClick={() => sortBy(key)}>
                      {t(label)}
                      {key === sort.key
                        ? sort.direction === "asc"
                          ? <Icon path={mdiArrowUp} size={16} />
                          : <Icon path={mdiArrowDown} size={16} />
                        : ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                aria-selected={selected === p.id}
                className={selected === p.id ? "selected" : ""}
              >
                <td>
                  <label className="check-target">
                    <input
                      type="checkbox"
                      aria-label={`${t("Select")} ${p.name}`}
                      checked={checked.includes(p.id)}
                      disabled={pending.includes(p.id)}
                      onChange={(e) =>
                        setChecked((ids) =>
                          e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((id) => id !== p.id),
                        )
                      }
                    />
                  </label>
                </td>
                <th scope="row">
                  <button className="record-name" onClick={() => select(p.id)}>
                    {p.name}
                  </button>
                </th>
                <td>{p.engine}</td>
                <td>
                  <span className="state-badge">
                    {t(
                      p.id === selected
                        ? observedRuntime(runtime)
                        : "Unavailable",
                    )}
                  </span>
                </td>
                <td>{p.automation}</td>
                <td>{date(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
