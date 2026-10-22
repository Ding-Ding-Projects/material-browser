import React, { useEffect, useRef, useState } from "react";
import { request, SuperProfile, SuperRevision, SuperSession } from "./api";
import { Button, Modal, Tabs } from "./components";
import { Search } from "./Search";
import { SuperProfilesWizard } from "./SuperProfilesWizard";
import "./SuperProfiles.css";
import {
  finishSuperProfileMutation,
  superSessionPresentation,
} from "./SuperProfiles.model.mjs";
import { operationFailure } from "./operation-errors.mjs";
type Session = {
  health?: SuperSession["health"];
  id: string;
  profileId: string;
  revisionId: string;
  distribution: string;
  mode: string;
  state: string;
  message?: string;
  phase?: string;
  operationId?: string;
  saveConfirmationRequired?: boolean;
  savedRevisionId?: string;
  saved?: boolean;
  cleanupPending?: boolean;
  events?: {
    sequence: number;
    timestampMs: number;
    phase: string;
    message: string;
  }[];
};
export function SuperProfiles({
  t,
  unlocked,
}: {
  t: (s: string) => string;
  unlocked: boolean;
}) {
  const [profiles, setProfiles] = useState<SuperProfile[]>([]),
    [selected, setSelected] = useState(""),
    [rows, setRows] = useState<number[]>([]);
  const [detail, setDetail] = useState("overview"),
    [showDetail, setShowDetail] = useState(false),
    [sort, setSort] = useState<"name" | "updatedAt">("name");
  const [revisions, setRevisions] = useState<SuperRevision[]>([]),
    [sessions, setSessions] = useState<Session[]>([]);
  const [capabilities, setCapabilities] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [wizard, setWizard] = useState<"new" | "edit" | null>(null),
    [confirm, setConfirm] = useState<{
      kind:
        | "launch"
        | "remove"
        | "restore"
        | "save"
        | "stop"
        | "discard"
        | "finalize";
      revision?: string;
      session?: Session;
    } | null>(null);
  const [saveCategories, setSaveCategories] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    sessionId: string;
    categories: { id: string; included: boolean }[];
    excluded: string[];
    stopped: boolean;
  } | null>(null);
  const [identityConsent, setIdentityConsent] = useState(false);
  const lastSessionStates = useRef<Record<string, string>>({});
  const inFlight = useRef(false),
    selection = useRef(""),
    unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const profile = profiles.find((p) => p.id === selected);
  const activeSession = sessions.some(
    (s) =>
      s.profileId === selected &&
      !["stopped", "saved", "discarded"].includes(s.state),
  );
  const refresh = async () => {
    const [templates, caps, active] = await Promise.all([
      request("superProfiles.list"),
      request("superProfiles.capabilities"),
      request("superProfiles.sessions.status"),
    ]);
    if (!unlockedRef.current) return;
    setProfiles(templates);
    setCapabilities(caps);
    setSessions(Array.isArray(active) ? active : active.sessions || []);
  };
  const run = async (action: () => Promise<void | string>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(t("Working"));
    try {
      const result = await action();
      setNotice(t(result || "Completed"));
    } catch (e) {
      setNotice(t(operationFailure(e)[0]));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  useEffect(() => {
    if (unlocked) {
      void run(refresh);
    } else {
      setProfiles([]);
      setRevisions([]);
      setWizard(null);
      setConfirm(null);
      setPreview(null);
      setIdentityConsent(false);
      setSelected("");
    }
  }, [unlocked]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const active = await request("superProfiles.sessions.status");
        if (!cancelled) {
          const rows: Session[] = Array.isArray(active)
            ? active
            : active.sessions || [];
          const completedSave = rows.some(
            (row) =>
              ["saved", "discarded"].includes(row.state) &&
              lastSessionStates.current[row.id] !== row.state,
          );
          lastSessionStates.current = Object.fromEntries(
            rows.map((row) => [row.id, row.state]),
          );
          setSessions(rows);
          if (completedSave && unlockedRef.current) {
            const templates = await request("superProfiles.list");
            if (!cancelled && unlockedRef.current) setProfiles(templates);
          }
        }
      } catch {
        if (!cancelled)
          setNotice(t("Session status unavailable. Retry Refresh."));
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
    selection.current = selected;
    setRevisions([]);
    setConfirm(null);
    setWizard(null);
    setIdentityConsent(false);
  }, [selected, unlocked]);
  useEffect(() => {
    let current = true;
    if (selected && unlocked)
      request("superProfiles.revisions.list", { id: selected })
        .then((value) => {
          if (current && selection.current === selected)
            setRevisions(
              [...value].sort(
                (a: SuperRevision, b: SuperRevision) =>
                  b.createdAt - a.createdAt,
              ),
            );
        })
        .catch((e) => {
          if (current && selection.current === selected)
            setNotice(t(operationFailure(e)[0]));
        });
    return () => {
      current = false;
    };
  }, [selected, profile?.revisionId, unlocked]);
  const ask = (value: NonNullable<typeof confirm>) => {
    setIdentityConsent(false);
    setPreview(null);
    if (value.kind === "save") {
      void run(async () => {
        const result = await request("superProfiles.sessions.preview", {
          sessionId: value.session?.id,
        });
        setPreview(result);
        setSaveCategories(
          result.categories
            .filter(
              (c: { id: string; included: boolean }) =>
                c.included && ["browser", "workspace"].includes(c.id),
            )
            .map((c: { id: string }) => c.id),
        );
        setConfirm(value);
      });
    } else setConfirm(value);
  };
  const execute = () =>
    void run(async () => {
      if (!profile || !confirm || !unlockedRef.current) return;
      const id = profile.id,
        expectedRevisionId = profile.revisionId;
      let result: any;
      if (confirm.kind === "launch") {
        if (!identityConsent) throw Error("IDENTITY_CONSENT_REQUIRED");
        result = await request("superProfiles.sessions.launch", {
          profileId: id,
          requireStableIdentity: false,
        });
      } else if (confirm.kind === "discard")
        result = await request("superProfiles.sessions.discard", {
          sessionId: confirm.session?.id,
        });
      else if (confirm.kind === "save") {
        const current = sessions.find((s) => s.id === confirm.session?.id);
        if (!current || !superSessionPresentation(current).canSave)
          throw Error("SESSION_NOT_STOPPED");
        result = await request("superProfiles.sessions.save", {
          sessionId: confirm.session?.id,
          expectedRevisionId: confirm.session?.revisionId,
          categories: saveCategories,
          closeAfterSave: true,
        });
      } else if (confirm.kind === "stop")
        result = await request("superProfiles.sessions.stop", {
          sessionId: confirm.session?.id,
        });
      else if (confirm.kind === "finalize")
        result = await request("superProfiles.sessions.finalizeSave", {
          sessionId: confirm.session?.id,
          operationId: confirm.session?.operationId,
          expectedRevisionId: confirm.session?.revisionId,
          confirmAfterUnlock: true,
        });
      else if (confirm.kind === "restore")
        await request("superProfiles.revisions.restore", {
          id,
          expectedRevisionId,
          revisionId: confirm.revision,
        });
      else await request("superProfiles.remove", { id, expectedRevisionId });
      const kind = confirm.kind;
      setConfirm(null);
      return finishSuperProfileMutation({
        kind,
        result,
        clearSelection: () => {
          selection.current = "";
          setSelected("");
          setRevisions([]);
        },
        refresh,
      });
    });
  if (!unlocked)
    return (
      <section className="surface">
        <h1>{t("Super Profiles")}</h1>
        <p>{t("Unlock the vault before using this action.")}</p>
      </section>
    );
  return (
    <div className="super-workspace">
      <div className="page-heading">
        <div>
          <h1>{t("Super Profiles")}</h1>
          <p>{t("Reusable environments with explicit save-back revisions.")}</p>
        </div>
        <Button disabled={busy} onClick={() => setWizard("new")}>
          {t("Create Super Profile")}
        </Button>
      </div>
      <p className="super-notice" role="status" aria-live="polite">
        {notice || t("Select a template to begin")}
      </p>
      <div className="super-actions">
        <Button secondary disabled={busy} onClick={() => void run(refresh)}>
          {t("Refresh")}
        </Button>
      </div>
      {wizard ? (
        <SuperProfilesWizard
          key={wizard === "edit" ? selected : "new"}
          profile={wizard === "edit" ? profile : undefined}
          t={t}
          busy={busy}
          onCancel={() => setWizard(null)}
          onSave={async (draft) => {
            if (inFlight.current) return;
            inFlight.current = true;
            setBusy(true);
            try {
              const result = await request(
                wizard === "edit"
                  ? "superProfiles.update"
                  : "superProfiles.create",
                {
                  ...draft,
                  ...(wizard === "edit" && profile
                    ? { id: profile.id, expectedRevisionId: profile.revisionId }
                    : {}),
                },
              );
              await refresh();
              setSelected(result.id);
              setWizard(null);
              setNotice(t("Template saved"));
            } catch (e) {
              setNotice(t(operationFailure(e)[0]));
              throw e;
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          }}
        />
      ) : (
        <div
          className={`super-columns ${showDetail && profile ? "show-detail" : ""}`}
        >
          <section className="surface super-list">
            <Search
              label={t("Search")}
              items={profiles.map((p) => `${p.name} ${p.settings.backend}`)}
              onResults={setRows}
              t={t}
            />
            {!profiles.length && <p>{t("No Super Profiles yet")}</p>}
            <div className="table-scroll">
              <table className="workspace-table">
                <caption className="sr-only">{t("Super Profiles")}</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <button onClick={() => setSort("name")}>
                        {t("Name")}
                      </button>
                    </th>
                    <th scope="col">{t("Environment")}</th>
                    <th scope="col">{t("Sessions")}</th>
                    <th scope="col">
                      <button onClick={() => setSort("updatedAt")}>
                        {t("Updated")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .map((i) => profiles[i])
                    .filter(Boolean)
                    .sort((a, b) =>
                      sort === "name"
                        ? a.name.localeCompare(b.name)
                        : b.updatedAt - a.updatedAt,
                    )
                    .map((p) => (
                      <tr
                        key={p.id}
                        aria-selected={selected === p.id}
                        className={selected === p.id ? "selected" : ""}
                      >
                        <th scope="row">
                          <button
                            className="record-name"
                            disabled={busy}
                            onClick={() => {
                              setSelected(p.id);
                              setShowDetail(true);
                              setDetail("overview");
                            }}
                          >
                            {p.name}
                          </button>
                        </th>
                        <td>
                          {p.settings.backend}
                          <small>
                            {t(p.settings.launchMode || "terminal")}
                          </small>
                        </td>
                        <td>
                          {
                            sessions.filter(
                              (session) => session.profileId === p.id,
                            ).length
                          }
                        </td>
                        <td>{new Date(p.updatedAt * 1000).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="surface super-inspector">
            {profile ? (
              <>
                <button
                  className="back-to-list"
                  onClick={() => setShowDetail(false)}
                >
                  ← {t("Back to profiles")}
                </button>
                <Tabs
                  panelPrefix="super-panel"
                  items={[
                    ["overview", t("Overview")],
                    ["sessions", t("Sessions")],
                    ["revisions", t("Revisions")],
                  ]}
                  value={detail}
                  onChange={setDetail}
                />
                <div
                  hidden={detail !== "overview"}
                  role="tabpanel"
                  id="super-panel-overview"
                >
                  <h2>{profile.name}</h2>
                  <dl>
                    <dt>{t("Environment")}</dt>
                    <dd>{profile.settings.backend}</dd>
                    <dt>{t("Engine")}</dt>
                    <dd>{profile.engine}</dd>
                    <dt>{t("Current revision")}</dt>
                    <dd>{profile.revisionId}</dd>
                  </dl>
                  <div className="super-actions">
                    <Button
                      disabled={busy || activeSession}
                      onClick={() => ask({ kind: "launch" })}
                    >
                      {t("Launch")}
                    </Button>
                    <Button
                      secondary
                      disabled={busy || activeSession}
                      onClick={() => setWizard("edit")}
                    >
                      {t("Edit template")}
                    </Button>
                    <Button
                      secondary
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const copy = await request(
                            "superProfiles.duplicate",
                            {
                              id: profile.id,
                              name: `${profile.name} (${t("Copy")})`,
                            },
                          );
                          await refresh();
                          setSelected(copy.id);
                        })
                      }
                    >
                      {t("Duplicate")}
                    </Button>
                    <Button
                      secondary
                      disabled={busy || activeSession}
                      onClick={() => ask({ kind: "remove" })}
                    >
                      {t("Delete template")}
                    </Button>
                  </div>
                  {activeSession && (
                    <p>
                      {t(
                        "Stop the active session before editing, deleting or launching this template again.",
                      )}
                    </p>
                  )}
                </div>
                <div
                  hidden={detail !== "sessions"}
                  role="tabpanel"
                  id="super-panel-sessions"
                >
                  <h3>{t("Sessions")}</h3>
                  {sessions.filter((s) => s.profileId === profile.id).length ===
                    0 && <p>{t("No sessions reported")}</p>}
                  {sessions
                    .filter((s) => s.profileId === profile.id)
                    .map((s) => {
                      const view = superSessionPresentation(s);
                      return (
                        <article key={s.id}>
                          <h4>{s.distribution || s.id}</h4>
                          <p>
                            {t("State")}: {t(s.state)} · {t(s.mode)}
                          </p>
                          <p>
                            {t("Session health")}: {t(view.healthStatus)}
                          </p>
                          <p>{t(view.healthDetail)}</p>
                          {view.healthStatus === "unknown" &&
                            view.canStop &&
                            !view.canSave && (
                              <p role="status">
                                {t(
                                  "Current readiness is unknown. The lifecycle state may reflect an earlier observation. Stop the session before saving.",
                                )}
                              </p>
                            )}
                          <p>
                            {t(
                              "Process observations do not verify a visible desktop.",
                            )}
                          </p>
                          {view.retained && (
                            <p>
                              {t(
                                "Retained output and staging may be available for recovery. Nothing is saved automatically. Stop to confirm closure before saving, or discard the owned session.",
                              )}
                            </p>
                          )}
                          {s.savedRevisionId && (
                            <p>
                              {t("Saved revision")}:{" "}
                              <span className="literal">
                                {s.savedRevisionId}
                              </span>
                            </p>
                          )}
                          {s.phase && (
                            <p>
                              {t("Phase")}: {t(s.phase)}
                            </p>
                          )}
                          {s.events?.length ? (
                            <details>
                              <summary>{t("Session progress")}</summary>
                              <ol>
                                {s.events.map((event) => (
                                  <li key={event.sequence}>
                                    {new Date(
                                      event.timestampMs,
                                    ).toLocaleTimeString()}{" "}
                                    · {t(event.phase)}
                                  </li>
                                ))}
                              </ol>
                            </details>
                          ) : null}
                          <div className="super-actions">
                            <Button
                              secondary
                              disabled={busy || !view.canStop}
                              onClick={() => ask({ kind: "stop", session: s })}
                            >
                              {t(
                                s.state === "provisioning"
                                  ? "Cancel provisioning"
                                  : s.state === "collecting"
                                    ? "Cancel save"
                                    : "Stop",
                              )}
                            </Button>
                            <Button
                              secondary
                              disabled={busy || !view.canSave}
                              onClick={() => ask({ kind: "save", session: s })}
                            >
                              {t("Save back and close")}
                            </Button>
                            <Button
                              secondary
                              disabled={busy || !view.canDiscard}
                              onClick={() =>
                                ask({ kind: "discard", session: s })
                              }
                            >
                              {t("Discard and close")}
                            </Button>
                            {s.saveConfirmationRequired && s.operationId && (
                              <Button
                                disabled={busy}
                                onClick={() =>
                                  ask({ kind: "finalize", session: s })
                                }
                              >
                                {t("Review collected save")}
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </div>
                <div
                  hidden={detail !== "revisions"}
                  role="tabpanel"
                  id="super-panel-revisions"
                >
                  <h3>{t("Revisions")}</h3>
                  {revisions.map((r) => (
                    <article key={r.id}>
                      <p>
                        {r.name} ·{" "}
                        {new Date(r.createdAt * 1000).toLocaleString()} ·{" "}
                        {r.archiveBytes} {t("bytes")}
                      </p>
                      <small>{r.id}</small>
                      <div className="super-actions">
                        <Button
                          secondary
                          disabled={
                            busy || activeSession || r.id === profile.revisionId
                          }
                          onClick={() =>
                            ask({ kind: "restore", revision: r.id })
                          }
                        >
                          {t("Restore")}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>{t("Select a template to begin")}</p>
            )}
          </section>
        </div>
      )}
      <details className="surface">
        <summary>{t("Host capabilities")}</summary>
        <p>
          {t(
            "Capability availability is not proof that a session launched successfully.",
          )}
        </p>
        <dl>
          <dt>WSL 2</dt>
          <dd>
            {t(capabilities?.wsl2?.available ? "Available" : "Unavailable")}
          </dd>
          <dt>Windows Sandbox</dt>
          <dd>
            {t(
              capabilities?.windowsSandbox?.available
                ? "Available"
                : "Unavailable",
            )}
          </dd>
          <dt>{t("Stable identity")}</dt>
          <dd>{t("Unavailable")}</dd>
        </dl>
        <p>
          {t(
            "WSL graphical modes require WSLg and the selected guest programs. Sandbox must already be enabled.",
          )}
        </p>
      </details>
      {confirm && profile && (
        <Modal
          title={t(
            {
              launch: "Launch Super Profile",
              remove: "Delete template",
              restore: "Restore revision",
              save: "Review save-back",
              stop: "Stop session",
              discard: "Discard and close",
              finalize: "Confirm collected save",
            }[confirm.kind],
          )}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          closeLabel={t("Cancel")}
          accessibilityLabel={t("Accessibility")}
          actions={
            <Button
              disabled={
                busy ||
                (confirm.kind === "launch" && !identityConsent) ||
                (confirm.kind === "save" &&
                  (!preview ||
                    preview.sessionId !== confirm.session?.id ||
                    saveCategories.length === 0 ||
                    !superSessionPresentation(
                      sessions.find((s) => s.id === confirm.session?.id) || {},
                    ).canSave))
              }
              onClick={execute}
            >
              {t(
                {
                  launch: "Launch with standard identity",
                  remove: "Delete template",
                  restore: "Restore",
                  save: "Save back and close",
                  stop: "Stop",
                  discard: "Discard and close",
                  finalize: "Confirm collected save",
                }[confirm.kind],
              )}
            </Button>
          }
        >
          <p>
            <strong>{profile.name}</strong>
          </p>
          {confirm.kind === "launch" && (
            <>
              <p>
                {t(
                  "Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.",
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={identityConsent}
                  onChange={(e) => setIdentityConsent(e.target.checked)}
                  disabled={busy}
                />
                {t("Use standard identity for this launch only")}
              </label>
              <p>
                {t(
                  "Launching executes the template commands. Review the template before continuing.",
                )}
              </p>
            </>
          )}
          {confirm.kind === "save" && (
            <>
              <p>
                {t(
                  "The host will gracefully stop this session, save the selected data as a new encrypted revision, and remove the disposable guest. Existing revisions remain available.",
                )}
              </p>
              <p>
                {t(
                  "Only managed browser data and workspace files are included. The operating system, external folders and machine identity are excluded.",
                )}
              </p>
              <fieldset disabled={busy}>
                <legend>{t("Save categories")}</legend>
                {preview?.categories
                  .filter((c) => ["browser", "workspace"].includes(c.id))
                  .map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={saveCategories.includes(c.id)}
                        onChange={(e) =>
                          setSaveCategories((previous) =>
                            e.target.checked
                              ? [...previous, c.id]
                              : previous.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {t(c.id)}
                    </label>
                  ))}
              </fieldset>
              <p>
                {t(
                  "Select at least one category. Unselected categories are excluded from the new revision.",
                )}
              </p>
              <p>
                {t(
                  "Cancel leaves the session unchanged. Saving may include private files stored inside the environment.",
                )}
              </p>
            </>
          )}
          {confirm.kind === "discard" && (
            <p>
              {t(
                "Discard gracefully stops and removes the disposable guest without saving changes. Existing revisions are preserved. Cleanup failures remain visible and can be retried.",
              )}
            </p>
          )}
          {confirm.kind === "finalize" && (
            <p>
              {t(
                "This save was collected before the vault was locked or the application restarted. Confirm this exact operation to create its encrypted revision now.",
              )}
            </p>
          )}
          {confirm.kind === "remove" && (
            <p>
              {t(
                "Delete this template and its revision history? This cannot be undone.",
              )}
            </p>
          )}
          {confirm.kind === "restore" && (
            <>
              <p>
                {t(
                  "Restore creates a new revision from the selected history entry.",
                )}
              </p>
              <p>{confirm.revision}</p>
            </>
          )}
          {confirm.kind === "stop" && (
            <p>
              {t(
                "Stopping interrupts this owned session. Unsaved application work may be lost. The template is unchanged until you save back.",
              )}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
