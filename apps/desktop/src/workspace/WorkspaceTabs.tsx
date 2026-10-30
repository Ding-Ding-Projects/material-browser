import { readTabPreference, tabFocusId } from "./workspace-tabs-model.mjs";
import { MaterialInput } from "../MaterialPrimitives";
import React, { useState } from "react";
import { Button } from "../components";
import { Search } from "../Search";
import { Icon } from "../Icon";
import { mdiClose, mdiPin, mdiPinOutline, mdiPlus, mdiAccountMultipleOutline } from "@mdi/js";
export type WorkspaceTab = { id: string; label: string; page: string; setting?: string; section?: string };
export function WorkspaceTabs({ tabs, active, page, onSelect, onClose, onHome, onNew, label, t }: {
  tabs: WorkspaceTab[]; active: string; page: string; onSelect: (tab: WorkspaceTab) => void;
  onClose: (id: string) => void; onHome: () => void; onNew: () => void;
  label: (s: string) => string; t: (s: string) => string;
}) {
  const [matches, setMatches] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem("workspace.pins.v1") || "[]"); return Array.isArray(value) ? value.filter((x) => typeof x === "string").slice(0, 200) : []; } catch { return []; } });
  const [grouped, setGrouped] = useState(() => { try { return readTabPreference(localStorage, "workspace.grouped.v1", true) !== false; } catch { return true; } });
  const togglePin = (id: string) => { const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id]; setPinned(next); try { localStorage.setItem("workspace.pins.v1", JSON.stringify(next)); } catch {} };
  const visible = tabs.filter((tab) => matches.includes(tab.id));
  const groups = grouped ? ["pinned", ...Array.from(new Set(visible.filter((x) => !pinned.includes(x.id)).map((x) => x.page)))] : ["all"];
  return <aside className="workspace-dock" aria-label={t("Open tabs")}>
    <div className="dock-heading"><strong>{t("Open tabs")}</strong><button className="icon-control" onClick={onNew} aria-label={t("New tab")} title={t("New tab")}><Icon path={mdiPlus} size={22} /></button></div>
    <button className={`dock-home${page === "profiles" && !active ? " active" : ""}`} onClick={onHome}><Icon path={mdiAccountMultipleOutline} size={20}/>{t("Profiles")}<Icon path={mdiPin} size={16}/></button>
    <Search label={t("Search tabs")} items={tabs.map((x) => label(x.label))} itemKeys={tabs.map((x) => x.id)} onKeys={setMatches} t={t}/>
    <label className="dock-group-toggle"><MaterialInput type="checkbox" checked={grouped} onChange={(e) => { setGrouped(e.target.checked); try { localStorage.setItem("workspace.grouped.v1", String(e.target.checked)); } catch {} }}/>{t("Group by destination")}</label>
    <div className="workspace-tab-strip" role="tablist" aria-label={t("Open tabs")} aria-orientation="vertical" onKeyDown={(event) => {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const index = controls.indexOf(document.activeElement as HTMLButtonElement); if (index < 0 || !controls.length) return;
      const next = event.key === "ArrowDown" ? (index + 1) % controls.length : event.key === "ArrowUp" ? (index + controls.length - 1) % controls.length : event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); controls[next].focus(); controls[next].click(); }
    }}>
      {groups.map((group) => { const members = visible.filter((x) => group === "all" || (group === "pinned" ? pinned.includes(x.id) : !pinned.includes(x.id) && x.page === group)); return members.length ? <React.Fragment key={group}>
        {grouped && <span className="dock-group-label">{t(group === "pinned" ? "Pinned" : group === "super-profiles" ? "Super Profiles" : group === "sync" ? "Synchronization" : group === "settings" ? "Settings" : "Profiles")}</span>}
        {members.map((tab) => <div key={tab.id} className={active === tab.id ? "active" : ""}>
          <button role="tab" id={`work-tab-${tab.id}`} aria-selected={active === tab.id} aria-controls="workspace-content" tabIndex={tabFocusId(visible.map((item) => item.id), active) === tab.id ? 0 : -1} onClick={() => onSelect(tab)}>{label(tab.label)}</button>
          <button onClick={() => togglePin(tab.id)} aria-label={`${t(pinned.includes(tab.id) ? "Unpin" : "Pin")} ${label(tab.label)}`} aria-pressed={pinned.includes(tab.id)}><Icon path={pinned.includes(tab.id) ? mdiPin : mdiPinOutline} size={16}/></button>
          {!pinned.includes(tab.id) && <button onClick={() => onClose(tab.id)} aria-label={`${t("Close")} ${label(tab.label)}`}><Icon path={mdiClose} size={16}/></button>}
        </div>)}
      </React.Fragment> : null; })}
    </div>
    <p className="dock-hint">{t("Open tools from New tab. Your workspace stays in place.")}</p>
  </aside>;
}
