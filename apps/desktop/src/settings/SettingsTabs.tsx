import { PlatformPicker } from "../MaterialPrimitives";
import { Disclosure, DisclosureTitle, MaterialInput } from "../MaterialPrimitives";
import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Field } from "../components";
import { Search } from "../Search";
import {
  bindTabChanges,
  initializeTabSelection,
} from "./interaction-model.mjs";
import { Choice } from "./SettingControl";
import { categories } from "./model.mjs";
import {
  defaultTabs,
  validateTabs,
  moveTab,
  previewTabClose,
  closeTabs,
  orderedOpenTabs,
} from "./tab-model.mjs";
import "./docked-tabs.mjs";
export function SettingsTabs({
  value,
  onChange,
  t,
  children,
}: {
  value: string;
  onChange: (id: string) => void;
  t: (s: string) => string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<any>(() => {
      try {
        return validateTabs(
          JSON.parse(localStorage.getItem("settings.tabs.v1") || "null"),
        );
      } catch {
        return defaultTabs();
      }
    }),
    [rows, setRows] = useState<string[]>([]),
    [master, setMaster] = useState<string[]>([]),
    [groupRows, setGroupRows] = useState<string[]>([]),
    [memberRows, setMemberRows] = useState<string[]>([]),
    [selectedGroup, setSelectedGroup] = useState(""),
    [groupName, setGroupName] = useState(""),
    [groupColor, setGroupColor] = useState("#475f99"),
    [context, setContext] = useState<string | null>(null),
    [menuRows, setMenuRows] = useState<number[]>([]),
    [catalog, setCatalog] = useState(false),
    [catalogRows, setCatalogRows] = useState<number[]>([]),
    [error, setError] = useState(""),
    [bulk, setBulk] = useState(false),
    [bulkRows, setBulkRows] = useState<string[]>([]),
    [inverse, setInverse] = useState(false),
    [includePinned, setIncludePinned] = useState(false),
    [bulkQuery, setBulkQuery] = useState(""),
    [bulkValid, setBulkValid] = useState(false);
  const [compactWidth, setCompactWidth] = useState(false),
    [navigationOpen, setNavigationOpen] = useState(false);
  const layout = useRef<HTMLDivElement | null>(null),
    navigationToggle = useRef<HTMLButtonElement | null>(null),
    content = useRef<HTMLDivElement | null>(null);
  const compact = compactWidth && ["left", "right"].includes(state.edge);
  useEffect(() => {
    const element = layout.current;
    if (!element) return;
    const measure = () =>
      setCompactWidth(element.getBoundingClientRect().width < 680);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const selectVisible = (id: string, closeNavigation = true) => {
    onChange(id);
    if (compact && closeNavigation) {
      setNavigationOpen(false);
      requestAnimationFrame(() => content.current?.focus());
    }
  };
  const instance = useId();
  const strip = useRef<HTMLElement | null>(null);
  const label = (id: string) =>
      t(categories.find((x) => x[0] === id)?.[1] || id),
    visible = orderedOpenTabs(state, value),
    all = state.order.filter((id: string) => !state.closed.includes(id)),
    members = all.filter(
      (id: string) => state.membership[id] === selectedGroup,
    ),
    vertical = ["left", "right"].includes(state.edge);
  const displayedIds = rows.filter((id) => visible.includes(id));
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    return bindTabChanges(element, displayedIds, (id: string) =>
      selectVisible(id, false),
    );
  }, [JSON.stringify(displayedIds), onChange, compact]);
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    let current = true;
    void initializeTabSelection(element, displayedIds, value, () => current);
    return () => {
      current = false;
    };
  }, [JSON.stringify(displayedIds), value]);
  function save(next: any) {
    try {
      const valid = validateTabs(next);
      localStorage.setItem("settings.tabs.v1", JSON.stringify(valid));
      setState(valid);
      setError("");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tab layout could not be saved",
      );
      return false;
    }
  }
  function activate(id: string) {
    if (state.closed.includes(id)) {
      save({ ...state, closed: state.closed.filter((x: string) => x !== id) });
    }
    selectVisible(id);
  }
  function close(ids: string[]) {
    const result = closeTabs(state, ids, includePinned);
    if (save(result.state) && result.close.includes(value)) {
      const first = result.state.order.find(
        (id: string) => !result.state.closed.includes(id),
      );
      if (first) onChange(first);
      else setCatalog(true);
    }
    setBulk(false);
  }
  const commands = [
    "Open",
    "Pin or unpin",
    "Move earlier",
    "Move later",
    "Close this tab",
    "Close other tabs",
  ];
  const bulkMatches = bulkRows.filter((id) => all.includes(id)),
    preview = previewTabClose(
      state,
      inverse
        ? all.filter((id: string) => !bulkMatches.includes(id))
        : bulkMatches,
      includePinned,
    );
  return (
    <div
      ref={layout}
      className={`settings-tabs-layout edge-${state.edge} ${compact ? "compact-navigation" : ""}`}
    >
      {compact && (
        <div className="settings-navigation-bar">
          <strong>{label(value)}</strong>
          <button
            ref={navigationToggle}
            aria-expanded={navigationOpen}
            aria-controls={`${instance}-navigation`}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {t("Sections")}
          </button>
          <button
            aria-label={t("Actions for current tab")}
            onClick={() => {
              setContext(value);
              setNavigationOpen(true);
            }}
          >
            ⋯
          </button>
        </div>
      )}
      <aside
        id={`${instance}-navigation`}
        className="settings-tab-rail"
        hidden={compact && !navigationOpen}
        onKeyDown={(event) => {
          if (compact && event.key === "Escape") {
            event.preventDefault();
            setNavigationOpen(false);
            navigationToggle.current?.focus();
          }
        }}
      >
        <Disclosure>
          <DisclosureTitle>{t("Tab controls")}</DisclosureTitle>
          <Choice
            label={t("Dock tabs")}
            value={state.edge}
            options={
              ["left", "right", "top", "bottom"].map((x) => [x, t(x)]) as [
                string,
                string,
              ][]
            }
            onChange={(edge) => save({ ...state, edge })}
            t={t}
          />
          <Search
            key={`${instance}:strip`}
            label={t("Search current tabs")}
            items={visible.map(label)}
            itemKeys={visible}
            onKeys={setRows}
            t={t}
          />
          <Button secondary onClick={() => setCatalog(!catalog)}>
            {t("New tab")}
          </Button>
          <Button secondary onClick={() => setBulk(!bulk)}>
            {t("Close tabs by text")}
          </Button>
        </Disclosure>
        {error && <p role="alert">{t(error)}</p>}
        {React.createElement(
          "material-settings-tabs",
          {
            ref: strip,
            vertical: vertical ? "" : undefined,
            "aria-orientation": vertical ? "vertical" : "horizontal",
            activeTabIndex: rows
              .filter((id) => visible.includes(id))
              .indexOf(value),
          },
          rows
            .filter((id) => visible.includes(id))
            .filter(Boolean)
            .map((id) =>
              React.createElement(
                "md-primary-tab",
                {
                  key: id,
                  onClick: () => selectVisible(id),
                  "aria-controls": `panel-${id}`,
                  style: state.membership[id]
                    ? {
                        "--md-primary-tab-active-indicator-color":
                          state.groups.find(
                            (g: any) => g.id === state.membership[id],
                          )?.color,
                      }
                    : undefined,
                  onContextMenu: (e: Event) => {
                    e.preventDefault();
                    setContext(id);
                  },
                  onKeyDown: (e: KeyboardEvent) => {
                    if (
                      e.key === "ContextMenu" ||
                      (e.shiftKey && e.key === "F10")
                    ) {
                      e.preventDefault();
                      setContext(id);
                    }
                  },
                },
                `${state.pinned.includes(id) ? "● " : ""}${state.membership[id] ? state.groups.find((g: any) => g.id === state.membership[id])?.name + ": " : ""}${label(id)}`,
              ),
            ),
        )}
        <Button secondary onClick={() => setContext(value)}>
          {t("Actions for current tab")}
        </Button>
        {context && (
          <div
            className="choice-popover"
            role="dialog"
            aria-label={t("Tab actions")}
          >
            <h3>{label(context)}</h3>
            <Search
              key={`${instance}:context:${context}`}
              label={t("Search tab actions")}
              items={commands.map(t)}
              onResults={setMenuRows}
              t={t}
            />
            {menuRows.map((i) => (
              <Button
                secondary
                key={i}
                onClick={() => {
                  if (i === 0) activate(context);
                  if (i === 1)
                    save({
                      ...state,
                      pinned: state.pinned.includes(context)
                        ? state.pinned.filter((x: string) => x !== context)
                        : [...state.pinned, context],
                    });
                  if (i === 2 || i === 3)
                    save(moveTab(state, context, i === 2 ? -1 : 1));
                  if (i === 4) close([context]);
                  if (i === 5)
                    close(all.filter((id: string) => id !== context));
                  setContext(null);
                }}
              >
                {t(commands[i])}
              </Button>
            ))}
            <Choice
              label={t("Move into group")}
              value={state.membership[context] || ""}
              options={[
                ["", t("No group")],
                ...state.groups.map((g: any) => [g.id, g.name]),
              ]}
              onChange={(group) => {
                const membership = { ...state.membership };
                if (group) membership[context] = group;
                else delete membership[context];
                save({ ...state, membership });
                setContext(null);
              }}
              t={t}
            />
            <Button secondary onClick={() => setContext(null)}>
              {t("Close")}
            </Button>
          </div>
        )}
        <Disclosure>
          <DisclosureTitle>{t("Find tabs and groups")}</DisclosureTitle>
          <Search
            key={`${instance}:master`}
            label={t("Search all open tabs")}
            items={all.map(
              (id: string) =>
                `${label(id)} ${state.groups.find((g: any) => g.id === state.membership[id])?.name || ""} ${state.pinned.includes(id) ? t("Pinned") : ""}`,
            )}
            itemKeys={all}
            onKeys={setMaster}
            t={t}
          />
          {master
            .filter((id) => all.includes(id))
            .map((id) => (
              <Button secondary key={id} onClick={() => activate(id)}>
                {label(id)}
              </Button>
            ))}
          <Search
            key={`${instance}:groups`}
            label={t("Search groups")}
            items={state.groups.map((g: any) => g.name)}
            itemKeys={state.groups.map((g: any) => g.id)}
            onKeys={setGroupRows}
            t={t}
          />
          {groupRows
            .map((id) => state.groups.find((g: any) => g.id === id))
            .filter(Boolean)
            .map((g: any) => (
              <div key={g.id} className="tab-group-tools">
                <Button secondary onClick={() => setSelectedGroup(g.id)}>
                  {g.name}
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    save({
                      ...state,
                      groups: state.groups.map((x: any) =>
                        x.id === g.id ? { ...x, collapsed: !x.collapsed } : x,
                      ),
                    })
                  }
                >
                  {t(g.collapsed ? "Expand" : "Collapse")}
                </Button>
              </div>
            ))}
          <Choice
            label={t("Selected group")}
            value={selectedGroup}
            options={[
              ["", t("No group")],
              ...state.groups.map((g: any) => [g.id, g.name]),
            ]}
            onChange={setSelectedGroup}
            t={t}
          />
          <Search
            key={`${instance}:group-members:${selectedGroup}`}
            label={t("Search selected group tabs")}
            items={members.map(label)}
            itemKeys={members}
            onKeys={setMemberRows}
            t={t}
          />
          {memberRows
            .filter((id) => members.includes(id))
            .map((id) => (
              <Button secondary key={id} onClick={() => activate(id)}>
                {label(id)}
              </Button>
            ))}
          <Field
            label={t("Group name")}
            value={groupName}
            onChange={setGroupName}
          />
          <PlatformPicker
            type="color"
            value={groupColor}
            aria-label={t("Group color")}
            onChange={(e) => setGroupColor(e.target.value)}
          />
          <Button
            secondary
            onClick={() => {
              if (!groupName.trim()) return;
              save({
                ...state,
                groups: [
                  ...state.groups,
                  {
                    id: crypto.randomUUID(),
                    name: groupName.trim(),
                    color: groupColor,
                    collapsed: false,
                  },
                ],
              });
              setGroupName("");
            }}
          >
            {t("Create group")}
          </Button>
          <Button
            secondary
            disabled={!selectedGroup || !groupName.trim()}
            onClick={() =>
              save({
                ...state,
                groups: state.groups.map((g: any) =>
                  g.id === selectedGroup
                    ? { ...g, name: groupName.trim(), color: groupColor }
                    : g,
                ),
              })
            }
          >
            {t("Rename selected group")}
          </Button>
          <Button
            secondary
            disabled={!selectedGroup}
            onClick={() => {
              const membership = { ...state.membership };
              for (const id of Object.keys(membership))
                if (membership[id] === selectedGroup) delete membership[id];
              save({
                ...state,
                membership,
                groups: state.groups.filter((g: any) => g.id !== selectedGroup),
              });
              setSelectedGroup("");
            }}
          >
            {t("Remove group")}
          </Button>
        </Disclosure>
      </aside>
      <div
        ref={content}
        className="settings-tab-content"
        tabIndex={-1}
        aria-label={label(value)}
      >
        {catalog && (
          <section className="setting-card">
            <h2>{t("New tab")}</h2>
            <Search
              key={`${instance}:catalog`}
              label={t("Search destinations")}
              items={categories.map(([, name]) => t(name))}
              onResults={setCatalogRows}
              t={t}
            />
            {catalogRows.map((i) => (
              <Button
                secondary
                key={categories[i][0]}
                onClick={() => {
                  activate(categories[i][0]);
                  setCatalog(false);
                }}
              >
                {t(categories[i][1])}
              </Button>
            ))}
          </section>
        )}
        {bulk && (
          <section className="setting-card">
            <h2>{t("Close tabs by text")}</h2>
            <p>
              {t(
                "Use the search below to preview affected labels. Pinned tabs are excluded unless selected explicitly.",
              )}
            </p>
            <div>
              <Search
                key={`${instance}:bulk`}
                label={t("Text in tab labels")}
                items={all.map(label)}
                itemKeys={all}
                onKeys={setBulkRows}
                onState={(s) => {
                  setBulkQuery(s.query);
                  setBulkValid(s.valid);
                }}
                t={t}
              />
            </div>
            <label>
              <MaterialInput
                type="checkbox"
                checked={inverse}
                onChange={(e) => setInverse(e.target.checked)}
              />
              {t("Close tabs not matching")}
            </label>
            <label>
              <MaterialInput
                type="checkbox"
                checked={includePinned}
                onChange={(e) => setIncludePinned(e.target.checked)}
              />
              {t("Include pinned tabs")}
            </label>
            <p>
              {t("Affected tabs")}:{" "}
              {preview.close.map(label).join(", ") || t("None")}
            </p>
            <p>
              {t("Excluded tabs")}:{" "}
              {preview.excluded.map(label).join(", ") || t("None")}
            </p>
            <Button
              disabled={
                !bulkQuery.trim() || !bulkValid || !preview.close.length
              }
              onClick={() => {
                if (bulkQuery.trim() && bulkValid) close(preview.close);
              }}
            >
              {t("Close previewed tabs")}
            </Button>
            <Button secondary onClick={() => setBulk(false)}>
              {t("Cancel")}
            </Button>
          </section>
        )}
        {children}
      </div>
    </div>
  );
}
