import React, { useEffect, useMemo, useRef, useState } from "react";
import { request, type Profile } from "../api";
import { operationFailure } from "../operation-errors.mjs";
import { runTargets, profileOperationParams } from "../workspace/model.mjs";
import { ConfirmAction } from "../settings/ConfirmAction";
import {
  Avatar,
  Btn,
  Checkbox,
  Chip,
  Dialog,
  IconBtn,
  Item,
  Menu,
  Ms,
  SegList,
  Switch,
  Tabs,
  TextField,
  cx,
  type MenuEntry,
} from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp, elapsed, ago, dateOf, engineLabel, automationLabel } from "./context";
import { LockDialog } from "./Safety";
import { appearanceFor, AppearanceDialog } from "./appearance";

type Result = { id: string; name: string; ok: boolean; message: string };

export function exportProfiles(profiles: Profile[]) {
  const payload = {
    format: "material-browser-profiles",
    version: 1,
    note: "Profile settings only. Encrypted browser data stays in the vault.",
    profiles: profiles.map((p) => ({
      name: p.name,
      engine: p.engine,
      automation: p.automation,
      passwordManager: p.passwordManager || null,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = profiles.length === 1 ? `${profiles[0].name}.profile.json` : `profiles-${profiles.length}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function ProfilesPage() {
  const app = useApp();
  const { t, profiles, runtimes, selected, setSelected, status, navigate, refresh, operations, pending, now, locks, requireUnlock, settings, snack } = app;
  const unlocked = status?.unlocked === true;
  const [engine, setEngine] = useState("all");
  const [automation, setAutomation] = useState("all");
  const [checked, setChecked] = useState<string[]>([]);
  const anchor = useRef<string>("");
  const [menu, setMenu] = useState<{ profile: Profile; x: number; y: number } | null>(null);
  const [automationMenu, setAutomationMenu] = useState<{ x: number; y: number } | null>(null);
  const [review, setReview] = useState<{ method: string; targets: Profile[]; revisionId?: string } | null>(null);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [locking, setLocking] = useState<Profile | null>(null);
  const [appearance, setAppearance] = useState<Profile | null>(null);
  const [stats, setStats] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [compactDetail, setCompactDetail] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const vaultEpoch = useRef({ unlocked, epoch: 0 });
  if (vaultEpoch.current.unlocked !== unlocked) vaultEpoch.current = { unlocked, epoch: vaultEpoch.current.epoch + 1 };
  const search = useSearch(profiles.map((p) => `${p.name} ${engineLabel(p.engine)} ${p.automation}`));
  const matched = new Set(search.indices.map((i) => profiles[i]?.id));
  const rows = profiles
    .filter((p) => matched.has(p.id) && (engine === "all" || p.engine === engine) && (automation === "all" || p.automation === automation))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) || a.id.localeCompare(b.id));
  useEffect(() => setChecked((ids) => ids.filter((id) => profiles.some((p) => p.id === id))), [profiles]);
  useEffect(() => {
    if (!unlocked) {
      setChecked([]);
      setResults([]);
    }
  }, [unlocked]);
  const runtimeOf = (id: string) => runtimes.find((r) => r.profileId === id);
  const profile = profiles.find((p) => p.id === selected);
  const targets = profiles.filter((p) => checked.includes(p.id));

  const execute = async (method: string, items: Profile[], extra: Record<string, unknown> = {}) => {
    if (!unlocked || !items.length) return false;
    const ids = items.map((p) => p.id);
    const epoch = vaultEpoch.current.epoch;
    const reservation = await operations.runMany(ids, async () => {
      const outcome: Result[] = await runTargets(
        items,
        (p: Profile) => request(method, profileOperationParams(method, p, extra, t("Copy"))),
        (error: unknown) => operationFailure(error)[0],
      );
      if (vaultEpoch.current.epoch !== epoch) return false;
      setResults(outcome.filter((r) => !r.ok));
      const failed = outcome.some((r) => !r.ok);
      void settings.notify(
        failed ? `${t("Some operations failed")}: ${outcome.filter((r) => !r.ok).map((r) => `${r.name} (${t(r.message)})`).join(", ")}` : t("Completed"),
        failed ? "error" : "success",
      );
      await refresh();
      await app.refreshRuntime();
      return outcome.every((r) => r.ok);
    });
    return reservation.accepted && reservation.value === true;
  };
  // Each locked element asks for its own unlock once per session before the action runs.
  const guarded = (items: Profile[], then: () => void) =>
    items.reduceRight<() => void>((next, p) => () => requireUnlock(p.id, next), then)();
  const actions = (p: Profile): MenuEntry[][] => {
    const running = !!runtimeOf(p.id);
    return [
      [
        running
          ? { id: "focus", label: t("Show window"), icon: "open_in_new", shortcut: "Enter", onSelect: () => void app.perform(() => request("profiles.focus", { id: p.id }), [p.id]) }
          : { id: "launch", label: t("Launch"), icon: "play_arrow", shortcut: "Enter", onSelect: () => guarded([p], () => navigate("launch", { profile: p.id })) },
        { id: "rename", label: t("Rename"), icon: "edit", shortcut: "F2", onSelect: () => guarded([p], () => setRenaming(p)) },
        { id: "duplicate", label: t("Duplicate"), icon: "content_copy", shortcut: "Ctrl+D", onSelect: () => void execute("profiles.duplicate", [p]) },
        { id: "snapshot", label: t("Snapshot"), icon: "photo_camera", disabled: running, onSelect: () => void execute("profiles.snapshot", [p]) },
        { id: "export", label: t("Export…"), icon: "ios_share", onSelect: () => exportProfiles([p]) },
      ],
      [
        { id: "appearance", label: t("Edit appearance…"), icon: "format_paint", onSelect: () => setAppearance(p) },
        locks.locks[p.id]
          ? { id: "unlock", label: t("Remove lock…"), icon: "lock_open", onSelect: () => requireUnlock(p.id, () => void locks.save(null, p.id).then(() => snack(t("Lock removed")))) }
          : { id: "lock", label: t("Lock this element…"), icon: "lock", onSelect: () => setLocking(p) },
      ],
      [
        ...(running ? [{ id: "stop", label: t("Stop"), icon: "stop_circle", onSelect: () => guarded([p], () => setReview({ method: "profiles.stop", targets: [p] })) }] : []),
        { id: "delete", label: t("Delete profile…"), icon: "delete", shortcut: "Del", danger: true, disabled: running, onSelect: () => guarded([p], () => setReview({ method: "profiles.remove", targets: [p] })) },
      ],
    ];
  };
  const openMenu = (p: Profile, element: HTMLElement | null, point?: { x: number; y: number }) => {
    const rect = element?.getBoundingClientRect();
    setMenu({ profile: p, x: point?.x ?? (rect ? rect.right - 320 : 200), y: point?.y ?? (rect ? rect.bottom + 4 : 200) });
  };
  const toggle = (id: string, value: boolean, event: React.MouseEvent) => {
    if (event.shiftKey && anchor.current) {
      const ids = rows.map((p) => p.id);
      const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((x, y) => x - y);
      if (a >= 0 && b >= 0) {
        const range = ids.slice(a, b + 1);
        setChecked((current) => (value ? [...new Set([...current, ...range])] : current.filter((x) => !range.includes(x))));
        return;
      }
    }
    anchor.current = id;
    setChecked((current) => (value ? [...current, id] : current.filter((x) => x !== id)));
  };
  const importFile = async (file: File) => {
    if (file.size > 512 * 1024) throw new Error("INVALID_FILE");
    const data = JSON.parse(await file.text());
    if (data?.format !== "material-browser-profiles" || !Array.isArray(data.profiles)) throw new Error("INVALID_FILE");
    const items = data.profiles.slice(0, 100).filter((p: any) => typeof p?.name === "string" && ["chromium", "firefox"].includes(p.engine));
    for (const item of items) {
      const created = await request("profiles.create", {
        name: item.name.slice(0, 120),
        engine: item.engine,
        ...(item.passwordManager ? { passwordManager: item.passwordManager } : {}),
      });
      if (created?.id && ["selenium", "puppeteer"].includes(item.automation))
        await request("profiles.update", { id: created.id, automation: item.automation });
    }
    await refresh();
    return items.length;
  };
  const counts = useMemo(
    () => ({
      chromium: profiles.filter((p) => p.engine === "chromium").length,
      firefox: profiles.filter((p) => p.engine === "firefox").length,
      automated: profiles.filter((p) => p.automation !== "off").length,
      managers: profiles.filter((p) => p.passwordManager).length,
      synced: profiles.filter((p) => (p as any).sync === true).length,
    }),
    [profiles],
  );
  const selectRow = (p: Profile) => {
    setSelected(p.id);
    setCompactDetail(true);
  };

  if (!unlocked) return null;
  return (
    <>
      <section
        className={cx("pane scroll", compactDetail && profile && "compact-hidden")}
        aria-labelledby="profiles-h"
        style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}
      >
        <div className="page-head">
          <div>
            <h1 id="profiles-h" className="headline-m em">{t("Profiles")}</h1>
            <p className="body-m on-sv">
              {profiles.length} {t(profiles.length === 1 ? "profile, encrypted in your vault" : "profiles, encrypted in your vault")}
            </p>
          </div>
          <Btn variant="outlined" icon="upload" onClick={() => fileInput.current?.click()}>{t("Import")}</Btn>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file)
                void app.perform(async () => {
                  const count = await importFile(file);
                  snack(`${count} ${t(count === 1 ? "profile imported" : "profiles imported")}`);
                }, ["*"]);
            }}
          />
        </div>
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <SearchBar label={t("Search profiles")} {...search} t={t} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Chip on={engine === "all"} onClick={() => setEngine("all")}>{t("All engines")}</Chip>
            <Chip on={engine === "chromium"} onClick={() => setEngine(engine === "chromium" ? "all" : "chromium")}>Chromium</Chip>
            <Chip on={engine === "firefox"} onClick={() => setEngine(engine === "firefox" ? "all" : "firefox")}>Firefox</Chip>
            <button
              type="button"
              className={cx("chip sl", automation !== "all" && "on")}
              aria-haspopup="menu"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setAutomationMenu({ x: rect.left, y: rect.bottom + 4 });
              }}
            >
              {automation !== "all" && <Ms name="check" />}
              {automation === "all" ? t("Automation") : automationLabel(automation, t)}
              <Ms name="arrow_drop_down" />
            </button>
            <div style={{ flex: 1 }} />
            <Chip icon="bar_chart" onClick={() => setStats(true)}>{t("Statistics")}</Chip>
          </div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <Ms name={profiles.length ? "search_off" : "person_add"} size={40} className="on-sv" />
            <p className="title-m">{t(profiles.length ? "No profiles match" : "No profiles yet")}</p>
            <p className="body-m on-sv">{t(profiles.length ? "Clear the search or filters to see every profile." : "Create a profile to keep one browser’s data encrypted in your vault.")}</p>
            {!profiles.length && <Btn icon="person_add" onClick={app.openCreate}>{t("Create profile")}</Btn>}
          </div>
        ) : (
          <div className="seglist" role="list" aria-label={t("Profiles")} style={{ padding: "16px 24px 112px" }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && checked.length) {
                event.preventDefault();
                setChecked([]);
              } else if (event.ctrlKey && event.key.toLowerCase() === "a" && !(event.target as HTMLElement).matches("input")) {
                event.preventDefault();
                setChecked(rows.map((p) => p.id));
              }
            }}>
            {rows.map((p) => {
              const runtime = runtimeOf(p.id);
              const on = checked.includes(p.id);
              const sel = p.id === selected;
              const look = appearanceFor(p.id);
              const locked = !!locks.locks[p.id];
              const busy = pending.includes(p.id) || pending.includes("*");
              return (
                <div
                  key={p.id}
                  role="listitem"
                  className={cx("li tall", (sel || on) && "sel")}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openMenu(p, null, { x: event.clientX, y: event.clientY });
                  }}
                  onKeyDown={(event) => {
                    if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
                      event.preventDefault();
                      openMenu(p, event.currentTarget as HTMLElement);
                    } else if (event.key === "F2") {
                      event.preventDefault();
                      guarded([p], () => setRenaming(p));
                    } else if (event.key === "Delete" && !runtime) {
                      event.preventDefault();
                      guarded([p], () => setReview({ method: "profiles.remove", targets: [p] }));
                    } else if (event.ctrlKey && event.key.toLowerCase() === "d") {
                      event.preventDefault();
                      void execute("profiles.duplicate", [p]);
                    }
                  }}
                >
                  <Checkbox checked={on} label={`${t("Select")} ${p.name}`} onChange={(value, event) => toggle(p.id, value, event)} />
                  <Avatar name={p.name} seed={p.id} size="l" shape={look.shape} tone={look.tone} />
                  <div className="txt">
                    <button
                      type="button"
                      className="title-m rowlink"
                      aria-current={sel ? "true" : undefined}
                      onClick={() => selectRow(p)}
                      onDoubleClick={() => !runtime && guarded([p], () => navigate("launch", { profile: p.id }))}
                    >
                      {p.name}
                    </button>
                    <span className="sup">
                      {[engineLabel(p.engine), automationLabel(p.automation, t), p.passwordManager ? "KeePassXC" : "", locked ? t("locked") : ""].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {runtime ? (
                    <span className={cx("stat", !sel && !on && "c-tertiary")} style={sel || on ? { color: "var(--on-secondary-container)" } : undefined}>
                      <Ms name="circle" fill />
                      {t("Running")} · {elapsed(runtime.seenAt, now, t)}
                    </span>
                  ) : (
                    <span className="stat on-sv hide-s">
                      <Ms name="pause_circle" />
                      {t("Stopped")}
                    </span>
                  )}
                  {runtime ? (
                    <IconBtn icon="more_vert" label={`${t("More actions for")} ${p.name}`} aria-haspopup="menu"
                      style={sel || on ? { color: "var(--on-secondary-container)" } : undefined}
                      onClick={(event) => openMenu(p, event.currentTarget)} />
                  ) : (
                    <div className="split">
                      <Btn variant="tonal" icon="play_arrow" disabled={busy} onClick={() => guarded([p], () => navigate("launch", { profile: p.id }))}>
                        {t("Launch")}
                      </Btn>
                      <Btn variant="tonal" aria-label={`${t("Launch options for")} ${p.name}`} aria-haspopup="menu" disabled={busy}
                        onClick={(event) => openMenu(p, event.currentTarget)}>
                        <Ms name="keyboard_arrow_down" />
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {results.length > 0 && (
          <div className="card tint-e" role="alert" style={{ margin: "0 24px 96px", padding: 16, borderRadius: 20, display: "flex", gap: 12 }}>
            <Ms name="error" />
            <div style={{ flex: 1 }}>
              {results.map((r) => (
                <p key={r.id} className="body-m"><strong>{r.name}</strong>: {t(r.message)}</p>
              ))}
            </div>
            <IconBtn icon="close" label={t("Dismiss")} onClick={() => setResults([])} />
          </div>
        )}
        {checked.length > 0 && (
          <div style={{ position: "sticky", bottom: 24, marginTop: "auto", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div className="ftb vibrant" role="toolbar" aria-label={`${checked.length} ${t("selected")}`} style={{ pointerEvents: "auto" }}>
              <span className="label-l" style={{ padding: "0 8px 0 12px" }}>{checked.length} {t("selected")}</span>
              <IconBtn icon="content_copy" label={t("Duplicate")} onClick={() => void execute("profiles.duplicate", targets)} />
              <IconBtn icon="photo_camera" label={t("Snapshot")} disabled={targets.some((p) => runtimeOf(p.id))} onClick={() => void execute("profiles.snapshot", targets)} />
              <IconBtn icon="ios_share" label={t("Export")} onClick={() => exportProfiles(targets)} />
              <IconBtn icon="stop_circle" label={t("Stop")} disabled={!targets.some((p) => runtimeOf(p.id))}
                onClick={() => guarded(targets, () => setReview({ method: "profiles.stop", targets: targets.filter((p) => runtimeOf(p.id)) }))} />
              <span className="sep" />
              <IconBtn icon="delete" label={t("Delete")} disabled={targets.some((p) => runtimeOf(p.id))}
                onClick={() => guarded(targets, () => setReview({ method: "profiles.remove", targets }))} />
            </div>
          </div>
        )}
      </section>
      {profile ? (
        <Inspector
          profile={profile}
          className={cx(!compactDetail && "compact-hidden")}
          onBack={() => setCompactDetail(false)}
          onRename={() => guarded([profile], () => setRenaming(profile))}
          onReview={setReview}
          execute={execute}
          guarded={guarded}
        />
      ) : (
        <aside className="pane hide-s" style={{ width: 380, flexShrink: 0, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
          <Ms name="touch_app" size={40} className="on-sv" />
          <p className="body-m on-sv">{t("Select a profile to see its details.")}</p>
        </aside>
      )}
      {menu && <Menu label={menu.profile.name} anchor={menu} groups={actions(menu.profile)} onClose={() => setMenu(null)} t={t} />}
      {automationMenu && (
        <Menu
          label={t("Automation")}
          anchor={automationMenu}
          filterable={false}
          t={t}
          onClose={() => setAutomationMenu(null)}
          groups={[[
            { id: "all", label: t("Any automation"), icon: automation === "all" ? "check" : "remove", onSelect: () => setAutomation("all") },
            { id: "off", label: t("No automation"), icon: automation === "off" ? "check" : "block", onSelect: () => setAutomation("off") },
            { id: "selenium", label: "Selenium", icon: automation === "selenium" ? "check" : "smart_toy", onSelect: () => setAutomation("selenium") },
            { id: "puppeteer", label: "Puppeteer", icon: automation === "puppeteer" ? "check" : "smart_toy", onSelect: () => setAutomation("puppeteer") },
          ]]}
        />
      )}
      {stats && (
        <Dialog title={t("Statistics")} icon="bar_chart" onClose={() => setStats(false)} actions={<Btn onClick={() => setStats(false)}>{t("Done")}</Btn>}>
          <SegList>
            <Item icon="group" overline={t("Profiles")} title={String(profiles.length)} />
            <Item icon="play_circle" overline={t("Running now")} title={String(runtimes.length)} />
            <Item icon="public" overline="Chromium · Firefox" title={`${counts.chromium} · ${counts.firefox}`} />
            <Item icon="smart_toy" overline={t("With automation")} title={String(counts.automated)} />
            <Item icon="key" overline={t("Paired with KeePassXC")} title={String(counts.managers)} />
            <Item icon="cloud_sync" overline={t("Included in sync")} title={String(counts.synced)} />
          </SegList>
        </Dialog>
      )}
      {renaming && <RenameDialog profile={renaming} onClose={() => setRenaming(null)} execute={execute} />}
      {locking && <LockDialog target={{ id: locking.id, label: locking.name }} onClose={() => setLocking(null)} />}
      {appearance && <AppearanceDialog profile={appearance} onClose={() => setAppearance(null)} />}
      {review?.method === "profiles.remove" && (
        <ConfirmAction
          title={review.targets.length === 1 ? `${t("Delete")} “${review.targets[0].name}”?` : `${t("Delete")} ${review.targets.length} ${t("profiles")}?`}
          icon="person_remove"
          confirmLabel="Delete"
          description={`${t("This permanently removes the encrypted browser data and revision history for")} ${review.targets.map((p) => p.name).join(", ")}. ${t("Other profiles and your KeePassXC database are kept.")}`}
          t={t}
          onCancel={() => setReview(null)}
          onConfirm={async () => {
            const ok = await execute("profiles.remove", review.targets);
            if (ok) {
              setReview(null);
              setChecked([]);
              snack(t("Deleted"));
            }
            return ok ? { ok: true } : { ok: false, message: t("Some operations failed") };
          }}
        />
      )}
      {review?.method === "revisions.restore" && (
        <ConfirmAction
          title={t("Restore this revision?")}
          icon="history"
          confirmLabel="Restore"
          description={`${t("Current profile data for")} ${review.targets[0].name} ${t("will be replaced by the selected revision.")}`}
          t={t}
          onCancel={() => setReview(null)}
          onConfirm={async () => {
            const ok = await execute("revisions.restore", review.targets, { revisionId: review.revisionId });
            if (ok) setReview(null);
            return ok ? { ok: true } : { ok: false, message: t("Some operations failed") };
          }}
        />
      )}
      {review?.method === "profiles.stop" && (
        <Dialog
          title={review.targets.length === 1 ? `${t("Stop")} ${review.targets[0].name}?` : `${t("Stop")} ${review.targets.length} ${t("browsers")}?`}
          icon="stop_circle"
          onClose={() => setReview(null)}
          actions={
            <>
              <Btn variant="text" onClick={() => setReview(null)}>{t("Cancel")}</Btn>
              <Btn onClick={() => {
                const value = review;
                setReview(null);
                void execute("profiles.stop", value.targets);
              }}>{t("Stop")}</Btn>
            </>
          }
        >
          <p>{t("The browser closes and its data is encrypted back into the vault. Unsaved work in open pages may be lost.")}</p>
        </Dialog>
      )}
    </>
  );
}

function RenameDialog({ profile, onClose, execute }: { profile: Profile; onClose: () => void; execute: (m: string, p: Profile[], e?: Record<string, unknown>) => Promise<boolean> }) {
  const { t, snack } = useApp();
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const previous = profile.name;
    const ok = await execute("profiles.update", [profile], { name: name.trim() });
    setSaving(false);
    if (ok) {
      onClose();
      snack(`${name.trim()} ${t("renamed")}`, { label: t("Undo"), run: () => void execute("profiles.update", [{ ...profile, name: name.trim() }], { name: previous }) });
    }
  };
  return (
    <Dialog
      title={t("Rename profile")}
      icon="edit"
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" onClick={onClose}>{t("Cancel")}</Btn>
          <Btn disabled={!name.trim() || name.trim() === profile.name || saving} onClick={() => void save()}>{t("Save")}</Btn>
        </>
      }
    >
      <TextField label={t("Name")} value={name} onChange={setName} required autoFocus maxLength={120} onKeyDown={(e) => e.key === "Enter" && void save()} />
    </Dialog>
  );
}

function Inspector({
  profile,
  className,
  onBack,
  onRename,
  onReview,
  execute,
  guarded,
}: {
  profile: Profile;
  className?: string;
  onBack: () => void;
  onRename: () => void;
  onReview: (review: { method: string; targets: Profile[]; revisionId?: string }) => void;
  execute: (m: string, p: Profile[], e?: Record<string, unknown>) => Promise<boolean>;
  guarded: (items: Profile[], then: () => void) => void;
}) {
  const app = useApp();
  const { t, runtimes, now, navigate, pending } = app;
  const [tab, setTab] = useState<"overview" | "identity" | "revisions">("overview");
  const [revisions, setRevisions] = useState<any[] | null>(null);
  const runtime = runtimes.find((r) => r.profileId === profile.id);
  const busy = pending.includes(profile.id) || pending.includes("*");
  const look = appearanceFor(profile.id);
  const requestId = useRef(0);
  useEffect(() => {
    setTab("overview");
    setRevisions(null);
  }, [profile.id]);
  const loadRevisions = async () => {
    const id = ++requestId.current;
    try {
      const value = await request("revisions.list", { id: profile.id });
      if (id === requestId.current) setRevisions(Array.isArray(value) ? value : value?.revisions || []);
    } catch {
      if (id === requestId.current) setRevisions([]);
    }
  };
  useEffect(() => {
    if (tab === "revisions") void loadRevisions();
  }, [tab, profile.id, profile.updatedAt]);
  const identity = (profile.identity || {}) as Record<string, string>;
  const pm = profile.passwordManager;
  return (
    <aside
      className={cx("pane scroll", className)}
      aria-label={`${profile.name} ${t("details")}`}
      style={{ width: 380, flexShrink: 0, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <Btn variant="text" icon="arrow_back" className="compact-back" style={{ alignSelf: "flex-start" }} onClick={onBack}>{t("Profiles")}</Btn>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Avatar name={profile.name} seed={profile.id} size="xl" shape={look.shape} tone={look.tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="headline-s em" style={{ overflowWrap: "anywhere" }}>{profile.name}</h2>
          <p className="body-m on-sv">
            {runtime ? `${t("Running for")} ${elapsed(runtime.seenAt, now, t)}` : t("Stopped")}
          </p>
        </div>
        <IconBtn icon="edit" label={`${t("Rename")} ${profile.name}`} onClick={onRename} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {runtime ? (
          <>
            <Btn size="m" icon="open_in_new" style={{ flex: 1 }} disabled={busy}
              onClick={() => void app.perform(() => request("profiles.focus", { id: profile.id }), [profile.id])}>
              {t("Show window")}
            </Btn>
            <Btn size="m" variant="tonal" aria-label={`${t("Stop")} ${profile.name}`} title={t("Stop")} style={{ padding: "0 20px" }} disabled={busy}
              onClick={() => guarded([profile], () => onReview({ method: "profiles.stop", targets: [profile] }))}>
              <Ms name="stop" />
            </Btn>
          </>
        ) : (
          <>
            <Btn size="m" icon="play_arrow" style={{ flex: 1 }} disabled={busy} onClick={() => guarded([profile], () => navigate("launch", { profile: profile.id }))}>
              {t("Launch")}
            </Btn>
            <Btn size="m" variant="tonal" aria-label={`${t("Snapshot")} ${profile.name}`} title={t("Snapshot")} style={{ padding: "0 20px" }} disabled={busy}
              onClick={() => void execute("profiles.snapshot", [profile]).then(() => { if (tab === "revisions") void loadRevisions(); })}>
              <Ms name="photo_camera" />
            </Btn>
          </>
        )}
      </div>
      <Tabs
        label={t("Profile sections")}
        idPrefix="profile"
        value={tab}
        onChange={setTab}
        tabs={[["overview", t("Overview")], ["identity", t("Identity")], ["revisions", t("Revisions")]]}
      />
      <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {tab === "overview" && (
          <>
            <SegList>
              <Item icon="public" overline={t("Engine")} title={runtime?.engineVersion ? `${engineLabel(profile.engine)} ${runtime.engineVersion}` : engineLabel(profile.engine)} />
              <Item icon="smart_toy" overline={t("Automation")} title={profile.automation === "off" ? t("Off") : automationLabel(profile.automation, t)}
                support={runtime && runtime.effectiveMode !== profile.automation ? `${t("Running with")} ${automationLabel(runtime.effectiveMode, t)}` : undefined} />
              <Item icon="key" overline={t("Password manager")} title={pm ? `KeePassXC · ${t(pm.source === "wsl" ? "WSL copy" : "installed copy")}` : t("None")} />
              <Item icon="passkey" overline={t("Passkeys")} title={pm ? t(pm.passkeys ? "Stored in KeePassXC" : "Off") : t("Off")} />
              <Item
                icon={(profile as any).sync ? "cloud_done" : "cloud_off"}
                overline={t("Sync")}
                title={t((profile as any).sync ? "Included in sync" : "Not synced")}
                trailing={
                  <Switch
                    label={t("Include in sync")}
                    checked={(profile as any).sync === true}
                    disabled={busy}
                    onChange={(value) => void execute("profiles.update", [profile], { sync: value })}
                  />
                }
              />
              <Item icon="calendar_today" overline={t("Created")} title={dateOf(profile.createdAt) || t("Unavailable")} support={profile.updatedAt ? `${t("Changed")} ${ago(profile.updatedAt, now, t)}` : undefined} />
            </SegList>
            <div className="card tint" style={{ padding: 16, display: "flex", gap: 12, borderRadius: 20 }}>
              <Ms name="info" />
              <p className="body-m">{t("Browser data stays encrypted at rest. Stopping the browser saves it back to the vault.")}</p>
            </div>
          </>
        )}
        {tab === "identity" && (
          <>
            <SegList>
              <Item icon="language" overline={t("Locale")} title={identity.locale || t("Unavailable")} />
              <Item icon="schedule" overline={t("Time zone")} title={identity.timezone || t("Unavailable")} />
              <Item icon="fingerprint" overline={t("Identity seed")} title={identity.seed || t("Unavailable")} mono />
              <Item icon="tag" overline={t("Profile id")} title={profile.id} mono />
            </SegList>
            <div className="card tint-t" style={{ padding: 16, display: "flex", gap: 12, borderRadius: 20 }}>
              <Ms name="shield" />
              <p className="body-m">{t("Stable browser identity is unavailable in this build. Launches use the engine’s standard identity.")}</p>
            </div>
          </>
        )}
        {tab === "revisions" && (
          <>
            {revisions === null ? (
              <p className="body-m on-sv" role="status">{t("Loading revisions")}</p>
            ) : revisions.length === 0 ? (
              <p className="body-m on-sv">{t("No revisions yet. Take a snapshot while the browser is stopped.")}</p>
            ) : (
              <SegList label={t("Revisions")}>
                {revisions.slice().reverse().map((revision: any, index: number) => (
                  <Item
                    key={revision.id || index}
                    tall
                    icon={index === 0 ? "radio_button_checked" : "history"}
                    selected={index === 0}
                    title={index === 0 ? t("Latest snapshot") : dateOf(revision.createdAt) || revision.id}
                    support={`${index === 0 ? `${dateOf(revision.createdAt)} · ` : ""}${Object.keys(revision.files || {}).length} ${t("files")}`}
                    trailing={
                      index === 0 ? undefined : (
                        <Btn variant="text" disabled={busy || !!runtime}
                          onClick={() => guarded([profile], () => onReview({ method: "revisions.restore", targets: [profile], revisionId: revision.id }))}>
                          {t("Restore")}
                        </Btn>
                      )
                    }
                  />
                ))}
              </SegList>
            )}
            <div className="card outlined" style={{ padding: 16, display: "flex", gap: 12, borderRadius: 20 }}>
              <Ms name="info" />
              <p className="body-m">{t("Restoring replaces this profile’s data with the chosen snapshot. Stop the browser first.")}</p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
