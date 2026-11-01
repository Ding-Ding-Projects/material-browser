import React, { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "../build-version";
import { request } from "../api";
import { Btn, Dialog, IconBtn, Ms, TextField, cx } from "../m3";
import { useApp, engineLabel, automationLabel, type Page } from "./context";

export const BUILT_AT: string =
  typeof __MATERIAL_BROWSER_BUILT_AT__ === "string" ? __MATERIAL_BROWSER_BUILT_AT__ : "";
declare const __MATERIAL_BROWSER_BUILT_AT__: string;

export function updatedLabel(t: (s: string) => string) {
  const value = BUILT_AT ? new Date(BUILT_AT) : null;
  return value && Number.isFinite(value.getTime())
    ? `${APP_VERSION} · ${t("updated")} ${value.toLocaleDateString()}`
    : `${APP_VERSION} · ${t("updated")} ${t("unknown")}`;
}

const LOGOS: Record<string, string> = {
  monogram: "shield_lock",
  profiles: "group",
  compass: "explore",
};

export function TitleBar({
  onNotifications,
  unread,
  onAccessibility,
  minimal,
}: {
  onNotifications: () => void;
  unread: number;
  onAccessibility: () => void;
  minimal?: boolean;
}) {
  const { t, prefs, displayName, status, openPalette, perform, refresh, navigate, busy } = useApp();
  const [maximized, setMaximized] = useState(false);
  useEffect(
    () =>
      window.materialBrowser?.onEvent((event: any) => {
        if (event?.type === "window-state") setMaximized(event.maximized === true);
      }),
    [],
  );
  const windowAction = async (action: "minimize" | "maximize" | "restore" | "close") => {
    const state = await window.materialBrowser?.windowAction?.(action).catch(() => null);
    if (state) setMaximized(state.maximized);
  };
  return (
    <header className="tbar">
      <div className="brand">
        <div className="logo" aria-hidden="true">
          <Ms name={LOGOS[prefs.logoPreset] || "shield_lock"} fill />
        </div>
        <div className="bt">
          <span className="title-m em">{displayName || "Material Browser"}</span>
          <span className="label-s on-sv">{updatedLabel(t)}</span>
        </div>
      </div>
      <div className="mid">
        {!minimal && (
          <label className="search sm">
            <Ms name="search" />
            <input
              aria-label={t("Search everything")}
              placeholder={t("Search profiles, settings and help")}
              value=""
              readOnly
              onFocus={(event) => {
                event.currentTarget.blur();
                openPalette();
              }}
              onKeyDown={(event) => {
                if (event.key.length === 1) {
                  event.preventDefault();
                  openPalette(event.key);
                }
              }}
            />
            <span className="kbd">Ctrl+Shift+F</span>
            <IconBtn
              icon="regular_expression"
              label={t("Open regex builder for this search")}
              onClick={() => openPalette("^")}
            />
          </label>
        )}
      </div>
      {!minimal && status && (
        <button
          type="button"
          className="chip assist sl hide-c"
          disabled={busy}
          onClick={() => {
            if (status.unlocked)
              void perform(async () => {
                await request("vault.lock");
                await refresh();
              }, ["*"], ["Vault locked", "保險庫已鎖上"]);
            else navigate("profiles");
          }}
          title={t(status.unlocked ? "Lock the vault" : "Unlock the vault")}
        >
          <Ms name={status.unlocked ? "lock_open" : "lock"} fill />
          {t(status.unlocked ? "Vault unlocked" : "Vault locked")}
        </button>
      )}
      {!minimal && (
        <IconBtn
          icon="notifications"
          label={unread ? `${t("Notifications")}, ${unread} ${t("new")}` : t("Notifications")}
          badge={unread || undefined}
          onClick={onNotifications}
        />
      )}
      <span data-accessibility-entry>
        <IconBtn icon="accessibility_new" label={t("Accessibility tools")} onClick={onAccessibility} />
      </span>
      {window.materialBrowser?.windowAction && (
        <div className="wctl">
          <button type="button" aria-label={t("Minimize")} title={t("Minimize")} onClick={() => void windowAction("minimize")}>
            <Ms name="minimize" size={20} />
          </button>
          <button
            type="button"
            aria-label={t(maximized ? "Restore window" : "Maximize")}
            title={t(maximized ? "Restore window" : "Maximize")}
            onClick={() => void windowAction(maximized ? "restore" : "maximize")}
          >
            <Ms name={maximized ? "filter_none" : "crop_square"} size={18} />
          </button>
          <button type="button" aria-label={t("Close")} title={t("Close")} onClick={() => void windowAction("close")}>
            <Ms name="close" size={20} />
          </button>
        </div>
      )}
    </header>
  );
}

const DESTINATIONS: [Page, string, string, string][] = [
  ["profiles", "Profiles", "group", "Profiles"],
  ["super-profiles", "Super Profiles", "layers", "Super Profiles"],
  ["sync", "Sync", "sync", "Synchronization"],
  ["servers", "Servers", "dns", "Minecraft servers"],
  ["settings", "Settings", "settings", "Settings"],
];

export function Rail({ onFab, fabIcon, fabLabel }: { onFab: () => void; fabIcon: string; fabLabel: string }) {
  const { t, page, navigate, status, conflicts, perform, refresh, busy } = useApp();
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("rail.expanded") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("rail.expanded", String(expanded));
    } catch {}
  }, [expanded]);
  const current = page === "launch" ? "profiles" : page;
  return (
    <nav className={cx("rail", expanded && "rail-open")} aria-label={t("Destinations")}>
      <IconBtn
        className="rail-x"
        icon={expanded ? "menu_open" : "menu"}
        label={t(expanded ? "Collapse navigation" : "Expand navigation")}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      />
      <button
        type="button"
        className={cx("fab flat sl rail-x", expanded && "ext")}
        aria-label={fabLabel}
        title={fabLabel}
        disabled={!status?.unlocked || busy}
        style={{ margin: "4px 0 20px" }}
        onClick={onFab}
      >
        <Ms name={fabIcon} />
        {expanded && <span>{fabLabel}</span>}
      </button>
      {DESTINATIONS.map(([id, label, icon, name]) => (
        <button
          type="button"
          key={id}
          className={cx("ri", current === id && "on")}
          aria-current={current === id ? "page" : undefined}
          aria-label={id === "sync" && conflicts.length ? `${t(name)}, ${t("needs attention")}` : t(name)}
          onClick={() => navigate(id)}
        >
          <span className="ind">
            <Ms name={icon} />
            {id === "sync" && conflicts.length > 0 && (
              <span className="badge" aria-hidden="true">{conflicts.length}</span>
            )}
          </span>
          {t(label)}
        </button>
      ))}
      <div className="rail-x" style={{ flex: 1 }} />
      <button
        type="button"
        className="ri rail-x"
        disabled={!status?.unlocked || busy}
        onClick={() =>
          void perform(async () => {
            await request("vault.lock");
            await refresh();
          }, ["*"], ["Vault locked", "保險庫已鎖上"])
        }
      >
        <span className="ind">
          <Ms name="lock" />
        </span>
        {t("Lock")}
      </button>
    </nav>
  );
}

export type WorkspaceTab = {
  id: string;
  label: string;
  page: string;
  section?: string;
  setting?: string;
  pinned?: boolean;
};

export function TabsPane({
  tabs,
  setTabs,
  active,
  onSelect,
  onNew,
  dock,
  setDock,
}: {
  tabs: WorkspaceTab[];
  setTabs: (update: (tabs: WorkspaceTab[]) => WorkspaceTab[]) => void;
  active: string;
  onSelect: (tab: WorkspaceTab) => void;
  onNew: () => void;
  dock: "left" | "right";
  setDock: (dock: "left" | "right") => void;
}) {
  const { t, page, profiles, runtimes, selected, setSelected, navigate, locks } = useApp();
  const [finding, setFinding] = useState(false);
  const [filter, setFilter] = useState("");
  const [closing, setClosing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("tabs.collapsed") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("tabs.collapsed", JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);
  const list = useRef<HTMLDivElement>(null);
  const match = (label: string) => !filter || label.toLowerCase().includes(filter.toLowerCase());
  const running = runtimes
    .map((r) => ({ runtime: r, profile: profiles.find((p) => p.id === r.profileId) }))
    .filter((x) => x.profile && match(x.profile.name));
  const utilities = tabs.filter((tab) => !tab.pinned && match(t(tab.label)));
  const homeActive = !active && (page === "profiles" || page === "launch");
  const group = (key: string, label: string, color: string, count: number) => (
    <button
      type="button"
      className="nd-head sl"
      style={{ border: 0, background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", borderRadius: 999 }}
      aria-expanded={!collapsed[key]}
      onClick={() => setCollapsed({ ...collapsed, [key]: !collapsed[key] })}
    >
      <span className="grp-dot" style={{ background: color }} />
      <span style={{ flex: 1 }}>
        {label}
        <span className="on-sv" style={{ fontWeight: 400 }}> · {count}</span>
      </span>
      <Ms name={collapsed[key] ? "chevron_right" : "expand_more"} size={20} />
    </button>
  );
  return (
    <aside
      className="pane hide-m"
      aria-label={t("Tabs")}
      style={{ width: 248, flexShrink: 0, padding: 12, display: "flex", flexDirection: "column", gap: 2, order: dock === "right" ? 3 : 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 0 8px 12px" }}>
        <span className="title-s" style={{ flex: 1 }}>{t("Tabs")}</span>
        <IconBtn size="sm" icon="manage_search" label={t("Find a tab")} aria-pressed={finding} onClick={() => setFinding(!finding)} />
        <IconBtn
          size="sm"
          icon={dock === "left" ? "dock_to_left" : "dock_to_right"}
          label={t("Move the tab strip to another edge")}
          onClick={() => setDock(dock === "left" ? "right" : "left")}
        />
        <IconBtn size="sm" variant="tonal" icon="add" label={t("New tab")} onClick={onNew} />
      </div>
      {finding && (
        <label className="search sm" style={{ marginBottom: 8 }}>
          <Ms name="manage_search" size={20} />
          <input autoFocus aria-label={t("Find tabs and groups")} placeholder={t("Find tabs and groups")} value={filter} onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setFilter(""); setFinding(false); } }} />
        </label>
      )}
      <div
        ref={list}
        className="nd scroll"
        role="tablist"
        aria-orientation="vertical"
        aria-label={t("Open tabs")}
        style={{ flex: 1, minHeight: 0 }}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const items = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=tab]") || []);
          const index = items.indexOf(document.activeElement as HTMLElement);
          const next =
            event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          event.preventDefault();
          items[next]?.focus();
        }}
      >
        {match(t("Profiles")) && (
          <button
            type="button"
            className={cx("ndi c sl", homeActive && "on")}
            role="tab"
            aria-selected={homeActive}
            tabIndex={homeActive ? 0 : -1}
            onClick={() => {
              onSelect({ id: "", label: "Profiles", page: "profiles" });
              navigate("profiles");
            }}
          >
            <Ms name="group" size={20} />
            <span className="lbl">{t("Profiles")}</span>
            <Ms name="keep" size={18} label={t("Pinned")} />
          </button>
        )}
        {running.length > 0 && group("running", t("Running"), "var(--tertiary)", running.length)}
        {!collapsed.running &&
          running.map(({ runtime, profile }) => {
            const on = !active && page === "profiles" && selected === profile!.id;
            return (
              <button
                type="button"
                key={runtime.profileId}
                className={cx("ndi c sl", on && "on")}
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => {
                  onSelect({ id: "", label: profile!.name, page: "profiles" });
                  setSelected(profile!.id);
                  navigate("profiles");
                }}
              >
                <Ms name={runtime.effectiveMode === "off" ? "public" : "smart_toy"} size={20} />
                <span className="lbl">
                  {profile!.name} · {runtime.effectiveMode === "off" ? engineLabel(profile!.engine) : automationLabel(runtime.effectiveMode, t)}
                </span>
                {locks.locks[profile!.id] && <Ms name="lock" size={18} label={t("Locked")} />}
              </button>
            );
          })}
        {utilities.length > 0 && group("utilities", t("Utilities"), "var(--primary)", utilities.length)}
        {!collapsed.utilities &&
          utilities.map((tab) => (
            <div key={tab.id} style={{ position: "relative", display: "flex" }}>
              <button
                type="button"
                id={`work-tab-${tab.id}`}
                className={cx("ndi c sl", active === tab.id && "on")}
                role="tab"
                aria-selected={active === tab.id}
                tabIndex={active === tab.id ? 0 : -1}
                style={{ paddingRight: 44 }}
                onClick={() => onSelect(tab)}
                onKeyDown={(event) => {
                  if (event.key === "Delete") setTabs((all) => all.filter((x) => x.id !== tab.id));
                }}
              >
                <Ms name={tab.setting ? "tune" : tab.page === "settings" ? "settings" : tab.page === "sync" ? "sync" : tab.page === "super-profiles" ? "layers" : "tab"} size={20} />
                <span className="lbl">{t(tab.label.replace(/^Settings: /, ""))}</span>
              </button>
              <IconBtn
                size="sm"
                icon="close"
                label={`${t("Close tab")} ${t(tab.label)}`}
                style={{ position: "absolute", right: 8, top: 8 }}
                onClick={() => setTabs((all) => all.filter((x) => x.id !== tab.id))}
              />
            </div>
          ))}
      </div>
      <Btn variant="text" icon="tab_close" style={{ justifyContent: "flex-start" }} disabled={!tabs.length} onClick={() => setClosing(true)}>
        {t("Close tabs containing…")}
      </Btn>
      {closing && <CloseTabsDialog tabs={tabs} setTabs={setTabs} onClose={() => setClosing(false)} />}
    </aside>
  );
}

function CloseTabsDialog({
  tabs,
  setTabs,
  onClose,
}: {
  tabs: WorkspaceTab[];
  setTabs: (update: (tabs: WorkspaceTab[]) => WorkspaceTab[]) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [inverse, setInverse] = useState(false);
  const hits = tabs.filter((tab) => !tab.pinned && text && t(tab.label).toLowerCase().includes(text.toLowerCase()) !== inverse);
  return (
    <Dialog
      title={t("Close tabs containing…")}
      icon="tab_close"
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" onClick={onClose}>{t("Cancel")}</Btn>
          <Btn
            disabled={!hits.length}
            onClick={() => {
              const ids = new Set(hits.map((tab) => tab.id));
              setTabs((all) => all.filter((tab) => !ids.has(tab.id)));
              onClose();
            }}
          >
            {t("Close")} {hits.length}
          </Btn>
        </>
      }
    >
      <TextField label={t("Text in the tab name")} value={text} onChange={setText} autoFocus />
      <label className="body-m" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="cbt sl" role="checkbox" aria-checked={inverse} onClick={() => setInverse(!inverse)} aria-label={t("Close tabs that do not contain it")}>
          <span className="cb">{inverse && <Ms name="check" />}</span>
        </button>
        {t("Close tabs that do not contain it")}
      </label>
      <p>{hits.length ? hits.map((tab) => t(tab.label)).join(", ") : t("No tabs match. Pinned tabs are never closed.")}</p>
    </Dialog>
  );
}

export function StatusBar({ notice }: { notice: string }) {
  const { t, status, runtimes, prefs, busy } = useApp();
  const language = prefs.language === "yue" ? "廣東話" : prefs.language === "both" ? "English · 廣東話" : "English";
  const funny = prefs.language === "yue" ? prefs.funnyCantonese : prefs.funnyEnglish;
  return (
    <footer className="sbar" role="status" aria-live="polite">
      <span className="stat">
        <Ms name={status ? "verified_user" : "error"} fill className={status ? "c-primary" : "c-error"} />
        {t(status ? "Native host connected" : "Native host unavailable")}
      </span>
      {status?.unlocked && (
        <span>
          {runtimes.length} {t(runtimes.length === 1 ? "browser running" : "browsers running")}
        </span>
      )}
      {(busy || notice) && (
        <span className="stat">
          {busy && <Ms name="progress_activity" className="c-primary" />}
          {notice}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <span className="hide-s">
        {language} · {t("Funny level")} {funny}
      </span>
      <span className="hide-s">{updatedLabel(t)}</span>
    </footer>
  );
}
