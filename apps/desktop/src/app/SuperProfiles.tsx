import React, { useEffect, useRef, useState } from "react";
import { request, type SuperProfile, type SuperRevision, type SuperSession } from "../api";
import { finishSuperProfileMutation, superSessionPresentation } from "../SuperProfiles.model.mjs";
import { operationFailure } from "../operation-errors.mjs";
import { ConfirmAction } from "../settings/ConfirmAction";
import { Avatar, Btn, Checkbox, Dialog, IconBtn, Item, Loading, Menu, Ms, SegList, Tabs, cx } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp, ago, dateOf } from "./context";
import { TemplateWizard } from "./TemplateWizard";

type Session = SuperSession & { profileId: string; revisionId: string; distribution: string; startedAt?: number };
type Confirm = { kind: "launch" | "remove" | "restore" | "stop" | "discard" | "finalize"; revision?: string; session?: Session };
const BACKEND = (backend: string) => (backend === "windows-sandbox" ? "Windows Sandbox" : "WSL 2");
const ICON = (p: SuperProfile) => (p.settings.backend === "windows-sandbox" ? "desktop_windows" : p.settings.launchMode === "desktop" ? "desktop_mac" : p.settings.launchMode === "browser" ? "web" : "terminal");
const LIVE = (s: Session) => !["stopped", "saved", "discarded"].includes(s.state);

export function SuperProfilesPage() {
  const app = useApp();
  const { t, status, now, settings, narrator } = app;
  const unlocked = status?.unlocked === true;
  const [templates, setTemplates] = useState<SuperProfile[]>([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"overview" | "session" | "revisions">("overview");
  const [revisions, setRevisions] = useState<SuperRevision[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wizard, setWizard] = useState<"new" | "edit" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [consent, setConsent] = useState(false);
  const [hostDialog, setHostDialog] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [saveMenu, setSaveMenu] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{ sessionId: string; categories: { id: string; included: boolean }[]; excluded: string[] } | null>(null);
  const [categories, setCategories] = useState<string[]>(["browser", "workspace"]);
  const [compactDetail, setCompactDetail] = useState(false);
  const inFlight = useRef(false);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const lastStates = useRef<Record<string, string>>({});
  const firstSeen = useRef<Record<string, number>>({});
  const profile = templates.find((p) => p.id === selected);
  const search = useSearch(templates.map((p) => `${p.name} ${BACKEND(p.settings.backend)} ${p.settings.launchMode}`));
  const shown = search.indices.map((i) => templates[i]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const mine = sessions.filter((s) => s.profileId === selected);
  const live = mine.find(LIVE) || mine[mine.length - 1];
  const activeSession = mine.some(LIVE);

  const reload = async () => {
    const [list, caps, active] = await Promise.all([
      request("superProfiles.list"),
      request("superProfiles.capabilities"),
      request("superProfiles.sessions.status"),
    ]);
    if (!unlockedRef.current) return;
    setTemplates(list);
    setCapabilities(caps);
    setSessions(Array.isArray(active) ? active : active.sessions || []);
    setSelected((current) => (list.some((p: SuperProfile) => p.id === current) ? current : list[0]?.id || ""));
  };
  const run = async (action: () => Promise<void | string>, label?: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      const message = t(result || label || "Completed");
      void settings.notify(message, "success");
      return true;
    } catch (e) {
      const [english, cantonese] = operationFailure(e);
      setError(t(english));
      void settings.notify(english, "error");
      narrator.speak(english, cantonese, "error");
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  useEffect(() => {
    if (unlocked) void run(reload, "Super Profiles ready");
    else {
      setTemplates([]);
      setSelected("");
    }
  }, [unlocked]);
  useEffect(() => {
    const handler = () => setWizard("new");
    window.addEventListener("super-profiles-create", handler);
    return () => window.removeEventListener("super-profiles-create", handler);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const active = await request("superProfiles.sessions.status");
        if (cancelled) return;
        const rows: Session[] = Array.isArray(active) ? active : active.sessions || [];
        for (const row of rows) firstSeen.current[row.id] ||= row.events?.[0]?.timestampMs || Date.now();
        const completed = rows.some((row) => ["saved", "discarded"].includes(row.state) && lastStates.current[row.id] !== row.state);
        lastStates.current = Object.fromEntries(rows.map((row) => [row.id, row.state]));
        setSessions(rows);
        if (completed && unlockedRef.current) setTemplates(await request("superProfiles.list"));
      } catch {
        /* the last observation stays on screen */
      } finally {
        if (!cancelled) timer = setTimeout(poll, 2500);
      }
    };
    timer = setTimeout(poll, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let current = true;
    setRevisions([]);
    if (selected && unlocked)
      request("superProfiles.revisions.list", { id: selected })
        .then((value: SuperRevision[]) => current && setRevisions([...value].sort((a, b) => b.createdAt - a.createdAt)))
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [selected, profile?.revisionId, unlocked]);
  const view = live ? superSessionPresentation(live) : null;
  useEffect(() => {
    setPreview(null);
    if (!live || !view?.canSave) return;
    request("superProfiles.sessions.preview", { sessionId: live.id })
      .then((result) => {
        setPreview(result);
        setCategories(result.categories.filter((c: any) => c.included && ["browser", "workspace"].includes(c.id)).map((c: any) => c.id));
      })
      .catch(() => setPreview(null));
  }, [live?.id, live?.state, view?.canSave]);
  const save = () =>
    void run(async () => {
      if (!live || !superSessionPresentation(live).canSave || !categories.length) throw Error("SESSION_NOT_STOPPED");
      const result = await request("superProfiles.sessions.save", {
        sessionId: live.id,
        expectedRevisionId: live.revisionId,
        categories,
        closeAfterSave: true,
      });
      return finishSuperProfileMutation({ kind: "save", result, clearSelection: () => {}, refresh: reload });
    }, "Saved as a new revision");
  const execute = async () => {
    if (!profile || !confirm) return { ok: false, message: t("Unavailable") };
    const ok = await run(async () => {
      const id = profile.id,
        expectedRevisionId = profile.revisionId;
      let result: any;
      if (confirm.kind === "launch") {
        if (!consent) throw Error("IDENTITY_CONSENT_REQUIRED");
        result = await request("superProfiles.sessions.launch", { profileId: id, requireStableIdentity: false });
        setTab("session");
      } else if (confirm.kind === "discard") result = await request("superProfiles.sessions.discard", { sessionId: confirm.session?.id });
      else if (confirm.kind === "stop") result = await request("superProfiles.sessions.stop", { sessionId: confirm.session?.id });
      else if (confirm.kind === "finalize")
        result = await request("superProfiles.sessions.finalizeSave", {
          sessionId: confirm.session?.id,
          operationId: confirm.session?.operationId,
          expectedRevisionId: confirm.session?.revisionId,
          confirmAfterUnlock: true,
        });
      else if (confirm.kind === "restore") await request("superProfiles.revisions.restore", { id, expectedRevisionId, revisionId: confirm.revision });
      else await request("superProfiles.remove", { id, expectedRevisionId });
      const kind = confirm.kind;
      setConfirm(null);
      return finishSuperProfileMutation({
        kind,
        result,
        clearSelection: () => setSelected(""),
        refresh: reload,
      });
    });
    return ok ? { ok: true as const } : { ok: false as const, message: t("Some operations failed") };
  };
  if (!unlocked) return null;
  const revisionNumber = (id: string) => revisions.length - revisions.findIndex((r) => r.id === id);
  const sessionTitle = !live
    ? t("No session")
    : live.state === "provisioning"
      ? t("Preparing the guest")
      : live.state === "collecting"
        ? t("Collecting changes")
        : LIVE(live)
          ? t("Session open")
          : t(live.state === "saved" ? "Saved and closed" : live.state === "discarded" ? "Discarded and closed" : "Session stopped");
  return (
    <>
      <section className={cx("pane scroll", compactDetail && profile && "compact-hidden")} aria-labelledby="sp-h" style={{ width: 340, flexShrink: 0, padding: "28px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: "0 8px" }}>
          <h1 id="sp-h" className="headline-m em">{t("Super Profiles")}</h1>
          <p className="body-m on-sv">{t("Reusable guest environments")}</p>
        </div>
        <SearchBar small label={t("Search templates")} {...search} t={t} />
        {templates.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", padding: "0 8px" }}>
            <p className="body-m on-sv">{t("No templates yet. A template describes a disposable guest with its own browser and workspace.")}</p>
            <Btn icon="library_add" onClick={() => setWizard("new")}>{t("New template")}</Btn>
          </div>
        ) : (
          <div className="seglist" role="listbox" aria-label={t("Templates")}>
            {shown.map((p, index) => {
              const open = sessions.some((s) => s.profileId === p.id && LIVE(s));
              const tones = ["p shape-cookie", "t shape-sq", "s shape-arch"];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === selected}
                  className={cx("li tall sl", p.id === selected && "sel")}
                  onClick={() => {
                    setSelected(p.id);
                    setCompactDetail(true);
                  }}
                >
                  <div className={cx("av l", tones[index % 3])} aria-hidden="true"><Ms name={ICON(p)} /></div>
                  <span className="txt">
                    <span>{p.name}</span>
                    <span className="sup">{BACKEND(p.settings.backend)} · {t(p.settings.launchMode)}</span>
                  </span>
                  {open && <span className="stat"><Ms name="circle" fill />{t("Open")}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <Btn variant="outlined" icon="memory" style={{ alignSelf: "flex-start" }} onClick={() => setHostDialog(true)}>{t("Host capabilities")}</Btn>
      </section>
      <section className={cx("pane scroll", !compactDetail && "compact-hidden")} aria-labelledby="dev-h" style={{ flex: 1, padding: "28px 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {!profile ? (
          <div style={{ margin: "auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <Ms name="layers" size={40} className="on-sv" />
            <p className="body-m on-sv">{t("Select a template, or make a new one.")}</p>
          </div>
        ) : (
          <>
            <Btn variant="text" icon="arrow_back" className="compact-back" style={{ alignSelf: "flex-start" }} onClick={() => setCompactDetail(false)}>{t("Templates")}</Btn>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Avatar name="" size="xl" tone="p" shape="shape-cookie" icon={ICON(profile)} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 id="dev-h" className="headline-l em">{profile.name}</h2>
                <p className="body-m on-sv">
                  {[BACKEND(profile.settings.backend), t(profile.settings.launchMode), profile.engine === "firefox" ? "Firefox" : "Chromium", `${revisions.length} ${t(revisions.length === 1 ? "revision" : "revisions")}`].join(" · ")}
                </p>
              </div>
              <IconBtn icon="edit" label={t("Edit template")} disabled={busy || activeSession} onClick={() => setWizard("edit")} />
              <IconBtn icon="more_vert" label={t("More actions")} aria-haspopup="menu" onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ x: r.right - 320, y: r.bottom + 4 });
              }} />
            </div>
            <Tabs label={t("Template sections")} idPrefix="sp" value={tab} onChange={setTab} tabs={[["overview", t("Overview")], ["session", t("Session")], ["revisions", t("Revisions")]]} />
            <div role="tabpanel" id={`sp-panel-${tab}`} aria-labelledby={`sp-tab-${tab}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {tab === "overview" && (
                <>
                  <SegList>
                    <Item icon="dns" overline={t("Environment")} title={BACKEND(profile.settings.backend)} support={profile.settings.backend === "wsl2" ? t(profile.settings.rootfsPath ? "Custom root filesystem" : "Verified managed base") : undefined} />
                    <Item icon="open_in_browser" overline={t("Opens as")} title={t(profile.settings.launchMode)} />
                    <Item icon="public" overline={t("Engine")} title={profile.engine === "firefox" ? "Firefox" : "Chromium"} />
                    <Item icon="folder" overline={t("Workspace folder")} title={profile.settings.workspacePath || t("None")} mono={!!profile.settings.workspacePath} />
                    <Item icon="terminal" overline={t("Commands")} title={`${(profile.settings.setupCommands || []).length} ${t("setup")} · ${(profile.settings.startupCommands || []).length} ${t("startup")} · ${(profile.settings.installers || []).length} ${t("installers")}`} />
                    <Item icon="key" overline={t("Password manager")} title={profile.settings.passwordManager ? t("KeePassXC inside the guest") : t("None")} />
                    <Item icon="update" overline={t("Updated")} title={dateOf(profile.updatedAt)} />
                  </SegList>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn size="m" icon="rocket_launch" disabled={busy || activeSession} onClick={() => { setConsent(false); setConfirm({ kind: "launch" }); }}>{t("Launch session")}</Btn>
                  </div>
                  {activeSession && <p className="body-m on-sv">{t("Stop the open session before editing, deleting or launching this template again.")}</p>}
                </>
              )}
              {tab === "session" && (
                <section className="card filled" style={{ padding: 24, borderRadius: 28, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    {live && LIVE(live) ? <Loading label={sessionTitle} /> : <Avatar name="" tone="s" shape="shape-pill" icon={live ? "check" : "power_settings_new"} />}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <h3 className="title-l">{sessionTitle}</h3>
                      <p className="body-m on-sv">
                        {live
                          ? `${t(view!.healthStatus === "ready" ? "Healthy" : view!.healthStatus === "starting" ? "Starting" : view!.healthStatus === "exited" ? "Exited" : "Health unknown")} · ${t("started")} ${ago(firstSeen.current[live.id], now, t)}`
                          : t("Launch the template to open a disposable guest.")}
                      </p>
                    </div>
                    {live && view?.canStop && (
                      <Btn variant="outlined" icon="stop" disabled={busy} onClick={() => setConfirm({ kind: "stop", session: live })}>
                        {t(live.state === "provisioning" ? "Cancel" : live.state === "collecting" ? "Cancel save" : "Stop")}
                      </Btn>
                    )}
                    {!live && <Btn icon="rocket_launch" disabled={busy} onClick={() => { setConsent(false); setConfirm({ kind: "launch" }); }}>{t("Launch session")}</Btn>}
                  </div>
                  {live && (
                    <>
                      <p className="body-m">{t(view!.healthDetail)}</p>
                      {view!.healthStatus === "unknown" && view!.canStop && !view!.canSave && <p className="body-m on-sv">{t("Current readiness is unknown. Stop the session before saving.")}</p>}
                      {view!.retained && <p className="body-m on-sv">{t("Retained output may be available for recovery. Nothing is saved automatically.")}</p>}
                      {preview ? (
                        <>
                          <p className="body-m">{t("Changes stay in this session until you save them back. The list shows exactly what will be kept.")}</p>
                          <div className="seglist">
                            {preview.categories.filter((c) => ["browser", "workspace"].includes(c.id)).map((c) => {
                              const on = categories.includes(c.id);
                              return (
                                <div key={c.id} className="li">
                                  <Ms name={on ? "add_circle" : "do_not_disturb_on"} className={on ? "c-primary" : "on-sv"} />
                                  <span className="txt">
                                    <span>{t(c.id === "browser" ? "Browser data" : "Workspace files")}</span>
                                    <span className="sup">{t(c.id === "browser" ? "Bookmarks, history, cookies and extensions" : "The template’s workspace folder")}</span>
                                  </span>
                                  <span className="trail">{t(on ? "Saved" : "Left out")}</span>
                                </div>
                              );
                            })}
                            {preview.excluded.slice(0, 4).map((x) => (
                              <div key={x} className="li">
                                <Ms name="remove_circle" className="c-error" />
                                <span className="txt"><span>{t(x)}</span><span className="sup">{t("Never saved back")}</span></span>
                                <span className="trail">{t("Excluded")}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        view!.canStop && <p className="body-m on-sv">{t("When the guest is ready, the changes to save appear here.")}</p>
                      )}
                      {live.events?.length ? (
                        <details>
                          <summary className="label-l" style={{ cursor: "pointer" }}>{t("Session progress")}</summary>
                          <ol className="body-s on-sv" style={{ paddingLeft: 20, marginTop: 8 }}>
                            {live.events.slice(-12).map((event) => (
                              <li key={event.sequence}>{new Date(event.timestampMs).toLocaleTimeString()} · {t(event.phase)}</li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {view!.canSave && (
                          <div className="split">
                            <Btn size="m" icon="save" disabled={busy || !categories.length} onClick={save}>
                              {t("Save as revision")} {revisions.length + 1}
                            </Btn>
                            <Btn size="m" aria-label={t("Choose what to save")} aria-haspopup="menu" disabled={busy} onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setSaveMenu({ x: r.left, y: r.bottom + 4 });
                            }}>
                              <Ms name="keyboard_arrow_down" />
                            </Btn>
                          </div>
                        )}
                        {live.saveConfirmationRequired && live.operationId && (
                          <Btn size="m" disabled={busy} onClick={() => setConfirm({ kind: "finalize", session: live })}>{t("Review collected save")}</Btn>
                        )}
                        {view!.canDiscard && (
                          <Btn size="m" variant="text" disabled={busy} onClick={() => setConfirm({ kind: "discard", session: live })}>{t("Discard changes")}</Btn>
                        )}
                      </div>
                      {live.savedRevisionId && <p className="body-s on-sv">{t("Saved as")} {t("revision")} {revisionNumber(live.savedRevisionId)}</p>}
                    </>
                  )}
                </section>
              )}
              {tab === "revisions" && <RevisionList revisions={revisions} current={profile.revisionId} busy={busy || activeSession} onRestore={(id) => setConfirm({ kind: "restore", revision: id })} />}
            </div>
            {error && (
              <div className="card tint-e" role="alert" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}>
                <Ms name="error" /><p className="body-m" style={{ flex: 1 }}>{error}</p>
                <IconBtn icon="close" label={t("Dismiss")} onClick={() => setError("")} />
              </div>
            )}
          </>
        )}
      </section>
      <aside className="pane scroll hide-s" aria-label={t("Revision history")} style={{ width: 340, flexShrink: 0, padding: "28px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 className="title-l" style={{ padding: "0 8px" }}>{t("Revision history")}</h2>
        {profile ? (
          <RevisionList revisions={revisions} current={profile.revisionId} busy={busy || activeSession} onRestore={(id) => setConfirm({ kind: "restore", revision: id })} />
        ) : (
          <p className="body-m on-sv" style={{ padding: "0 8px" }}>{t("Select a template")}</p>
        )}
        <div className="card outlined" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}>
          <Ms name="info" className="on-sv" />
          <p className="body-m on-sv">{t("Restoring creates a new revision. Nothing is deleted.")}</p>
        </div>
      </aside>
      {menu && profile && (
        <Menu label={profile.name} anchor={menu} onClose={() => setMenu(null)} t={t} groups={[
          [
            { id: "launch", label: t("Launch session"), icon: "rocket_launch", disabled: activeSession, onSelect: () => { setConsent(false); setConfirm({ kind: "launch" }); } },
            { id: "edit", label: t("Edit template"), icon: "edit", disabled: activeSession, onSelect: () => setWizard("edit") },
            { id: "duplicate", label: t("Duplicate"), icon: "content_copy", onSelect: () => void run(async () => {
              const copy = await request("superProfiles.duplicate", { id: profile.id, name: `${profile.name} (${t("Copy")})` });
              await reload();
              setSelected(copy.id);
            }, "Duplicated") },
            { id: "refresh", label: t("Refresh"), icon: "refresh", onSelect: () => void run(reload, "Refreshed") },
          ],
          [{ id: "delete", label: t("Delete template…"), icon: "delete", danger: true, disabled: activeSession, onSelect: () => setConfirm({ kind: "remove" }) }],
        ]} />
      )}
      {saveMenu && preview && (
        <Menu label={t("Choose what to save")} anchor={saveMenu} filterable={false} onClose={() => setSaveMenu(null)} t={t} groups={[
          preview.categories.filter((c) => ["browser", "workspace"].includes(c.id)).map((c) => ({
            id: c.id,
            label: t(c.id === "browser" ? "Browser data" : "Workspace files"),
            icon: categories.includes(c.id) ? "check_box" : "check_box_outline_blank",
            onSelect: () => setCategories((all) => (all.includes(c.id) ? all.filter((x) => x !== c.id) : [...all, c.id])),
          })),
        ]} />
      )}
      {wizard && (
        <TemplateWizard
          profile={wizard === "edit" ? profile : undefined}
          busy={busy}
          onCancel={() => setWizard(null)}
          onSave={async (draft) => {
            if (inFlight.current) return;
            inFlight.current = true;
            setBusy(true);
            try {
              const result = await request(wizard === "edit" ? "superProfiles.update" : "superProfiles.create", {
                ...draft,
                ...(wizard === "edit" && profile ? { id: profile.id, expectedRevisionId: profile.revisionId } : {}),
              });
              await reload();
              setSelected(result.id);
              setWizard(null);
              void settings.notify(t("Template saved"), "success");
            } catch (e) {
              void settings.notify(operationFailure(e)[0], "error");
              throw e;
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          }}
        />
      )}
      {hostDialog && (
        <Dialog title={t("Host capabilities")} icon="memory" onClose={() => setHostDialog(false)} actions={<Btn onClick={() => setHostDialog(false)}>{t("Done")}</Btn>}>
          <SegList>
            <Item icon={capabilities?.wsl2?.available ? "check_circle" : "block"} overline="WSL 2" title={t(capabilities?.wsl2?.available ? "Available" : "Unavailable")}
              support={capabilities?.wsl2?.available ? `${t("Modes")}: ${(capabilities.wsl2.modes || []).map(t).join(", ")}` : capabilities?.wsl2?.reason} />
            <Item icon={capabilities?.windowsSandbox?.available ? "check_circle" : "block"} overline="Windows Sandbox" title={t(capabilities?.windowsSandbox?.available ? "Available" : "Unavailable")}
              support={capabilities?.windowsSandbox?.available ? `${t("Modes")}: ${(capabilities.windowsSandbox.modes || []).map(t).join(", ")}` : capabilities?.windowsSandbox?.reason} />
            <Item icon="fingerprint" overline={t("Stable identity")} title={t("Unavailable")} />
          </SegList>
          <p>{t("Capability availability is not proof that a session launched successfully. Host features are never enabled automatically.")}</p>
        </Dialog>
      )}
      {confirm && profile && (confirm.kind === "remove" || confirm.kind === "discard") && (
        <ConfirmAction
          title={confirm.kind === "remove" ? `${t("Delete")} “${profile.name}”?` : t("Discard this session’s changes?")}
          icon={confirm.kind === "remove" ? "delete" : "delete_sweep"}
          confirmLabel={confirm.kind === "remove" ? "Delete" : "Discard"}
          description={t(confirm.kind === "remove"
            ? "This deletes the template and its revision history. Open sessions must be closed first."
            : "The guest stops and is removed without saving. Existing revisions are kept.")}
          t={t}
          onCancel={() => setConfirm(null)}
          onConfirm={execute}
        />
      )}
      {confirm && profile && !["remove", "discard"].includes(confirm.kind) && (
        <Dialog
          title={t({ launch: "Launch session", restore: "Restore this revision?", stop: "Stop the session?", finalize: "Confirm collected save" }[confirm.kind as "launch"])}
          icon={{ launch: "rocket_launch", restore: "history", stop: "stop_circle", finalize: "save" }[confirm.kind as "launch"]}
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <Btn variant="text" onClick={() => setConfirm(null)}>{t("Cancel")}</Btn>
              <Btn disabled={busy || (confirm.kind === "launch" && !consent)} onClick={() => void execute()}>
                {t({ launch: "Launch with standard identity", restore: "Restore", stop: "Stop", finalize: "Confirm save" }[confirm.kind as "launch"])}
              </Btn>
            </>
          }
        >
          {confirm.kind === "launch" && (
            <>
              <p>{t("Launching runs the template’s setup and startup commands inside a new disposable guest.")}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
                <Checkbox checked={consent} onChange={setConsent} label={t("Use standard identity for this launch only")} />
                <span className="body-m" aria-hidden="true">{t("Use standard identity for this launch only")}</span>
              </div>
            </>
          )}
          {confirm.kind === "restore" && <p>{t("Restoring creates a new revision from the chosen one. Nothing is deleted.")}</p>}
          {confirm.kind === "stop" && <p>{t("Stopping interrupts the guest. Unsaved work inside it may be lost. The template is unchanged until you save back.")}</p>}
          {confirm.kind === "finalize" && <p>{t("This save was collected before the vault was locked or the app restarted. Confirm it to create its encrypted revision now.")}</p>}
        </Dialog>
      )}
    </>
  );
}

function RevisionList({ revisions, current, busy, onRestore }: { revisions: SuperRevision[]; current: string; busy: boolean; onRestore: (id: string) => void }) {
  const { t } = useApp();
  if (!revisions.length) return <p className="body-m on-sv" style={{ padding: "0 8px" }}>{t("No revisions yet")}</p>;
  return (
    <div className="seglist">
      {revisions.map((r, index) => {
        const on = r.id === current;
        const number = revisions.length - index;
        return (
          <div key={r.id} className={cx("li tall", on && "sel")}>
            <Ms name={on ? "radio_button_checked" : "history"} fill={on} />
            <span className="txt">
              <span>{t("Revision")} {number}{on ? ` · ${t("current")}` : ""}</span>
              <span className="sup">{dateOf(r.createdAt)} · {Math.max(1, Math.round(r.archiveBytes / 1024))} KB</span>
            </span>
            {!on && <Btn variant="text" size="xs" disabled={busy} onClick={() => onRestore(r.id)}>{t("Restore")}</Btn>}
          </div>
        );
      })}
    </div>
  );
}
