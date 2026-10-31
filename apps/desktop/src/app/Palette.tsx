import React, { useEffect, useMemo, useRef, useState } from "react";
import { request } from "../api";
import { definitions, categories } from "../settings/model.mjs";
import { Btn, Chip, IconBtn, Ms, Switch, cx } from "../m3";
import { RegexBuilder, useMatches, type RegexState } from "../m3/search";
import { useApp, engineLabel, automationLabel } from "./context";

type Row = {
  id: string;
  kind: "profiles" | "settings" | "help";
  icon: string;
  title: string;
  support: string;
  run?: () => void;
  control?: React.ReactNode;
  tab?: { id: string; label: string; page: string; section?: string; setting?: string };
};

export function Palette({
  initial,
  onClose,
  onOpenTab,
  onAction,
}: {
  initial: string;
  onClose: () => void;
  onOpenTab: (tab: NonNullable<Row["tab"]>) => void;
  onAction: (id: "create" | "setup" | "tickets" | "accessibility" | "notifications") => void;
}) {
  const app = useApp();
  const { t, profiles, runtimes, settings, prefs, navigate, locks, requireUnlock, perform, refreshRuntime, status } = app;
  const [query, setQuery] = useState(initial === "^" ? "" : initial);
  const [state, setState] = useState<RegexState>({ regex: initial === "^", flags: "i" });
  const [filter, setFilter] = useState<"all" | "profiles" | "settings" | "help">("all");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const full = prefs.paletteSize === "full";
  useEffect(() => {
    requestAnimationFrame(() => {
      input.current?.focus();
      const length = input.current?.value.length || 0;
      input.current?.setSelectionRange(length, length);
    });
  }, []);
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (status?.unlocked)
      for (const p of profiles) {
        const running = runtimes.some((r) => r.profileId === p.id);
        const locked = !!locks.locks[p.id];
        const where = `${t("Profiles")} · ${engineLabel(p.engine)} · ${automationLabel(p.automation, t)}`;
        out.push(
          running
            ? { id: `show:${p.id}`, kind: "profiles", icon: "open_in_new", title: `${t("Launch")} ${p.name}`, support: t("Already running · shows its window"),
                run: () => void perform(() => request("profiles.focus", { id: p.id }), [p.id]) }
            : { id: `launch:${p.id}`, kind: "profiles", icon: locked ? "lock" : "play_arrow", title: `${t("Launch")} ${p.name}`, support: locked ? t("Locked · asks for its unlock first") : where,
                run: () => requireUnlock(p.id, () => navigate("launch", { profile: p.id })) },
        );
        if (running)
          out.push({ id: `stop:${p.id}`, kind: "profiles", icon: locked ? "lock" : "stop_circle", title: `${t("Stop")} ${p.name}`,
            support: locked ? t("Locked · asks for its unlock first") : t("Encrypts its data back into the vault"),
            control: locked ? <Btn variant="tonal" size="xs" onClick={(e) => { e.stopPropagation(); requireUnlock(p.id, () => {}); }}>{t("Unlock")}</Btn> : undefined,
            run: () => requireUnlock(p.id, () => void perform(async () => { await request("profiles.stop", { id: p.id }); await refreshRuntime(); }, [p.id], ["Stopped", "已停止"])) });
        out.push({ id: `open:${p.id}`, kind: "profiles", icon: "person", title: p.name, support: where, run: () => navigate("profiles", { profile: p.id }) });
      }
    for (const [id, label, icon] of [["profiles", "Profiles", "group"], ["super-profiles", "Super Profiles", "layers"], ["sync", "Synchronization", "sync"], ["settings", "Settings", "settings"]] as const)
      out.push({ id: `page:${id}`, kind: "help", icon, title: t(label), support: t("Go to"), tab: { id: `page:${id}`, label, page: id } });
    for (const [id, label] of categories as [string, string][])
      out.push({ id: `category:${id}`, kind: "settings", icon: "tune", title: t(label), support: t("Settings"), tab: { id: `category:${id}`, label: `Settings: ${label}`, page: "settings", section: id } });
    for (const d of definitions as any[]) {
      const section = (categories as [string, string][]).find(([c]) => c === d.category)?.[1] || "";
      out.push({
        id: `setting:${d.key}`,
        kind: "settings",
        icon: d.type === "boolean" ? "toggle_on" : "tune",
        title: t(d.label),
        support: `${t("Settings")} · ${t(section)}`,
        tab: { id: `setting:${d.key}`, label: `Settings: ${d.label}`, page: "settings", section: d.category, setting: d.key },
        control:
          d.type === "boolean" ? (
            <span onClick={(e) => e.stopPropagation()}>
              <Switch label={t(d.label)} checked={(prefs as any)[d.key] === true} onChange={(value) => void settings.update(d.key, value)} />
            </span>
          ) : undefined,
      });
    }
    out.push(
      { id: "action:create", kind: "help", icon: "person_add", title: t("Create profile"), support: t("Profiles"), run: () => onAction("create") },
      { id: "action:setup", kind: "help", icon: "flag", title: t("Setup"), support: t("Reopen the four first-run steps"), run: () => onAction("setup") },
      { id: "action:notifications", kind: "help", icon: "notifications", title: t("Notifications"), support: t("Open the notification list"), run: () => onAction("notifications") },
      { id: "action:accessibility", kind: "help", icon: "accessibility_new", title: t("Accessibility tools"), support: t("Text size, contrast, motion and speech"), run: () => onAction("accessibility") },
      { id: "action:tickets", kind: "help", icon: "confirmation_number", title: t("Support Tickets"), support: t("Locked out of an element"), run: () => onAction("tickets") },
      { id: "help:keys", kind: "help", icon: "keyboard", title: t("Keyboard shortcuts"), support: "Ctrl+Shift+F · F2 · Ctrl+D · Del · Shift+F10" },
    );
    if (status?.unlocked)
      out.push({ id: "action:lock", kind: "help", icon: "lock", title: t("Lock vault"), support: t("Closes every profile’s encrypted data"),
        run: () => void perform(async () => { await request("vault.lock"); await app.refresh(); }, ["*"], ["Vault locked", "保險庫已鎖上"]) });
    return out;
  }, [profiles, runtimes, prefs, locks.locks, status?.unlocked, t]);
  const scoped = rows.filter((row) => filter === "all" || row.kind === filter);
  const { indices, status: matchStatus } = useMatches(scoped.map((r) => `${r.title} ${r.support}`), query, state);
  const shown = indices.map((i) => scoped[i]).filter(Boolean).slice(0, 60);
  useEffect(() => setActive(0), [query, filter, state.regex]);
  const go = (row?: Row) => {
    if (!row) return;
    if (row.run) {
      onClose();
      row.run();
    } else if (row.tab) {
      onClose();
      onOpenTab(row.tab);
    }
  };
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div className="m3-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={full ? { padding: 0 } : { alignItems: "flex-start", paddingTop: 72 }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Command palette")}
        className="e3 m3-dialog"
        style={{
          width: full ? "100vw" : 760,
          maxWidth: "100%",
          height: full ? "100vh" : undefined,
          maxHeight: full ? "100vh" : "calc(100vh - 96px)",
          background: "var(--surface-container-high)",
          borderRadius: full ? 0 : 28,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (query) setQuery("");
            else onClose();
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 72, padding: "0 12px 0 20px", flexShrink: 0 }}>
          <Ms name="search" className="on-sv" />
          <input
            ref={input}
            aria-label={t("Search everything")}
            placeholder={t("Search profiles, settings and help")}
            value={query}
            aria-controls="palette-rows"
            aria-activedescendant={shown[active] ? `palette-row-${active}` : undefined}
            className={state.regex ? "mono" : undefined}
            style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", color: "var(--on-surface)", fontSize: 18, outline: "none", padding: "0 12px" }}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((a) => (shown.length ? (a + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length : 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(shown[active]);
              }
            }}
          />
          <IconBtn icon="regular_expression" label={`${t("Regex builder")}${state.regex ? `, ${t("on")}` : ""}`} aria-pressed={state.regex} variant={state.regex ? "tonal" : undefined}
            onClick={() => setState({ ...state, regex: !state.regex })} />
          <IconBtn icon={full ? "close_fullscreen" : "open_in_full"} label={t(full ? "Card view" : "Full window view")} onClick={() => void settings.update("paletteSize", full ? "card" : "full")} />
          <IconBtn icon="close" label={t("Close palette")} onClick={onClose} />
        </div>
        <div className="div" />
        {state.regex && <RegexBuilder query={query} setQuery={setQuery} state={state} setState={setState} status={matchStatus} t={t} />}
        <div style={{ display: "flex", gap: 8, padding: "16px 20px 8px", flexWrap: "wrap" }}>
          {(["all", "profiles", "settings", "help"] as const).map((key) => (
            <Chip key={key} on={filter === key} onClick={() => setFilter(key)}>{t(key === "all" ? "All" : key === "profiles" ? "Profiles" : key === "settings" ? "Settings" : "Help")}</Chip>
          ))}
        </div>
        <div ref={list} id="palette-rows" role="listbox" aria-label={t("Results")} className="scroll" style={{ padding: "8px 12px 12px", flex: 1, minHeight: 0 }}>
          {shown.length === 0 ? (
            <p className="body-m on-sv" role="status" style={{ padding: 16 }}>{matchStatus.valid ? t("No matches") : t(matchStatus.error || "Invalid pattern")}</p>
          ) : (
            <div className="seglist">
              {shown.map((row, index) => (
                <div
                  key={row.id}
                  id={`palette-row-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  className={cx("li sl", index === active && "sel")}
                  style={{ cursor: row.run || row.tab ? "pointer" : "default" }}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(row)}
                >
                  <Ms name={row.icon} />
                  <span className="txt"><span>{row.title}</span><span className="sup">{row.support}</span></span>
                  {row.control}
                  {index === active && !row.control && (row.run || row.tab) && <span className="kbd">Enter</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", flexWrap: "wrap" }} className="body-s on-sv">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> {t("Move")}</span>
          <span><span className="kbd">Enter</span> {t("Go to it")}</span>
          <span><span className="kbd">Esc</span> {t("Clear, then close")}</span>
          <span style={{ flex: 1 }} />
          <span>{t(full ? "Full window, remembered" : "Card size, remembered")}</span>
        </div>
      </section>
    </div>
  );
}
