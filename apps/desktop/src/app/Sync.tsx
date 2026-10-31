import React, { useEffect, useRef, useState } from "react";
import { operationFailure } from "../operation-errors.mjs";
import { request } from "../api";
import { Btn, Dialog, IconBtn, Item, Ms, RadioList, SegList, Switch, WavyProgress } from "../m3";
import { useApp, ago, dateOf } from "./context";

type SyncStatus = { configured: boolean; folder: string | null; conflicts: number };
const read = (key: string, fallback: any) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

export function SyncPage() {
  const app = useApp();
  const { t, profiles, conflicts, loadConflicts, refresh, operations, settings, narrator, now, status: vault, pending } = app;
  const [state, setState] = useState<SyncStatus | null>(null);
  const [phase, setPhase] = useState<{ step: number; label: string } | null>(null);
  const [last, setLast] = useState<{ at: number; ok: boolean } | null>(() => read("sync.last", null));
  const [joined] = useState<number | null>(() => read("sync.joined", null));
  const [auto, setAuto] = useState<boolean>(() => read("sync.auto", false));
  const [error, setError] = useState("");
  const [joinHelp, setJoinHelp] = useState(false);
  const [serverHelp, setServerHelp] = useState(false);
  const running = useRef(false);
  const loadStatus = async () => {
    try {
      setState(await request("sync.status"));
    } catch {
      setState(null);
    }
  };
  useEffect(() => {
    void loadStatus();
    void loadConflicts().catch(() => {});
  }, []);
  const chooseFolder = () =>
    void app.perform(async () => {
      const chosen = await window.materialBrowser?.chooseDirectory();
      if (!chosen) return;
      await request("sync.configure", { folder: chosen });
      try {
        localStorage.setItem("sync.joined", JSON.stringify(Date.now()));
      } catch {}
      await loadStatus();
    }, ["*"], ["Sync storage connected", "已連接同步儲存位置"]);
  const syncNow = async () => {
    if (running.current || !state?.configured) return;
    running.current = true;
    setError("");
    const reservation = await operations.runMany(["*"], async () => {
      try {
        setPhase({ step: 1, label: "Uploading encrypted changes" });
        await request("sync.push");
        setPhase({ step: 2, label: "Downloading encrypted changes" });
        await request("sync.pull");
        await loadConflicts();
        await refresh();
        const at = Date.now();
        setLast({ at, ok: true });
        localStorage.setItem("sync.last", JSON.stringify({ at, ok: true }));
        void settings.notify(t("Sync finished"), "success");
        narrator.speak("Sync finished", "同步完成", "success");
      } catch (e) {
        const [english, cantonese] = operationFailure(e);
        setError(t(english));
        setLast({ at: Date.now(), ok: false });
        void settings.notify(english, "error");
        narrator.speak(english, cantonese, "error");
      } finally {
        setPhase(null);
        await loadStatus();
      }
    });
    running.current = false;
    return reservation;
  };
  useEffect(() => {
    const handler = () => void syncNow();
    window.addEventListener("sync-now", handler);
    return () => window.removeEventListener("sync-now", handler);
  });
  useEffect(() => {
    try {
      localStorage.setItem("sync.auto", JSON.stringify(auto));
    } catch {}
    if (!auto || !state?.configured || !vault?.unlocked) return;
    const timer = setInterval(() => {
      if (!pending.length) void syncNow();
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [auto, state?.configured, vault?.unlocked]);
  const included = profiles.filter((p) => (p as any).sync === true);
  return (
    <>
      <section className="pane scroll" aria-labelledby="sync-h" style={{ flex: 1, padding: "28px 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 id="sync-h" className="headline-l em">{t("Synchronization")}</h1>
            <p className="body-l on-sv">{t("Encrypted copies on storage you host. The storage never sees your data.")}</p>
          </div>
          <Btn size="m" icon="sync" disabled={!state?.configured || !!phase || pending.length > 0} onClick={() => void syncNow()}>{t("Sync now")}</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          <section className={state?.configured ? "card tint" : "card filled"} style={{ padding: 24, borderRadius: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Ms name={state?.configured ? (last && !last.ok ? "cloud_off" : "cloud_done") : "cloud_off"} size={32} fill />
              <div style={{ flex: 1 }}>
                <h2 className="title-l">{t("Your storage")}</h2>
                <p className="body-m">
                  {state === null
                    ? t("Checking…")
                    : !state.configured
                      ? t("Not connected yet")
                      : last
                        ? `${t(last.ok ? "Connected" : "Last sync failed")} · ${t("last sync")} ${ago(last.at, now, t)}`
                        : `${t("Connected")} · ${t("not synced yet")}`}
                </p>
              </div>
            </div>
            {phase ? (
              <>
                <WavyProgress value={phase.step / 2} indeterminate label={`${t(phase.label)}, ${t("step")} ${phase.step} ${t("of")} 2`} />
                <p className="body-s" role="status">{t(phase.label)} · {t("step")} {phase.step} {t("of")} 2</p>
              </>
            ) : state?.configured ? (
              <p className="body-s">{included.length} {t(included.length === 1 ? "profile included" : "profiles included")} · {conflicts.length} {t(conflicts.length === 1 ? "conflict" : "conflicts")}</p>
            ) : (
              <Btn variant="filled" icon="folder_open" style={{ alignSelf: "flex-start" }} onClick={chooseFolder}>{t("Choose a sync folder")}</Btn>
            )}
            {error && <p className="body-s" role="alert" style={{ color: "var(--error)" }}>{error}</p>}
          </section>
          <section className="card filled" style={{ padding: 24, borderRadius: 28, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Ms name="devices" size={32} className="c-primary" />
              <div style={{ flex: 1 }}>
                <h2 className="title-l">{t("This computer")}</h2>
                <p className="body-m on-sv">{joined ? `${t("joined")} ${dateOf(joined)}` : t("Holds the vault this window unlocked")}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="body-l" style={{ flex: 1 }}>{t("Sync automatically")}<span className="body-s on-sv" style={{ display: "block" }}>{t("Every 10 minutes while the vault is unlocked")}</span></span>
              <Switch label={t("Sync automatically")} checked={auto} disabled={!state?.configured} onChange={setAuto} />
            </div>
            <Btn variant="tonal" icon="qr_code_2" style={{ alignSelf: "flex-start" }} disabled={!state?.configured} onClick={() => setJoinHelp(true)}>{t("Join another computer")}</Btn>
          </section>
        </div>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="server-h">
          <h2 id="server-h" className="title-m">{t("Storage")}</h2>
          <SegList>
            <Item icon="folder_shared" overline={t("Address")} title={state?.folder || t("No folder chosen")} mono={!!state?.folder}
              trailing={<Btn variant="text" onClick={chooseFolder}>{t(state?.configured ? "Change" : "Choose")}</Btn>} />
            <Item icon="enhanced_encryption" overline={t("Encryption")} title={t("Encrypted on this computer before anything is written")} />
            <Item icon="inventory_2" overline={t("Vault in storage")} title={`${included.length} ${t("of")} ${profiles.length} ${t("profiles included")}`}
              support={t("Turn on sync for a profile in its details")} />
          </SegList>
          <Btn variant="text" icon="add_to_queue" style={{ alignSelf: "flex-start" }} onClick={() => setServerHelp(true)}>{t("Set up a storage server")}</Btn>
        </section>
      </section>
      <Conflicts />
      {joinHelp && (
        <Dialog title={t("Join another computer")} icon="qr_code_2" onClose={() => setJoinHelp(false)} actions={<Btn onClick={() => setJoinHelp(false)}>{t("Done")}</Btn>}>
          <p>{t("On the other computer, open Material Browser, choose “Join a vault from another computer”, enter this vault’s passphrase, then choose this same folder.")}</p>
          <div className="tf" style={{ ["--tf-bg" as string]: "var(--surface-container-high)" }}>
            <span className="lab">{t("Sync folder")}</span>
            <span className="val mono body-m" title={state?.folder || ""}>{state?.folder}</span>
            <IconBtn icon="content_copy" label={t("Copy path")} onClick={() => void navigator.clipboard?.writeText(state?.folder || "").then(() => app.snack(t("Path copied")))} />
          </div>
          <p className="body-s on-sv">{t("The passphrase never travels with the folder. Only encrypted copies do.")}</p>
        </Dialog>
      )}
      {serverHelp && (
        <Dialog title={t("Set up a storage server")} icon="add_to_queue" onClose={() => setServerHelp(false)} actions={<Btn onClick={() => setServerHelp(false)}>{t("Done")}</Btn>}>
          <p>{t("The storage service runs as its own app, set up with the hosting wizard on the computer that keeps the files. It stores only encrypted chunks.")}</p>
          <p>{t("This desktop syncs through a folder. Point it at a folder the other computers can also reach, such as a shared drive.")}</p>
        </Dialog>
      )}
    </>
  );
}

function Conflicts() {
  const app = useApp();
  const { t, conflicts, profiles, loadConflicts, refresh, pending } = app;
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [details, setDetails] = useState<Record<string, any>>({});
  const conflict = conflicts[Math.min(index, conflicts.length - 1)];
  const name = conflict ? profiles.find((p) => p.id === conflict.profileId)?.name || conflict.profileId : "";
  useEffect(() => {
    setChoice("");
    if (!conflict) return;
    request("revisions.list", { id: conflict.profileId })
      .then((list: any[]) => setDetails(Object.fromEntries((Array.isArray(list) ? list : []).map((r) => [r.id, r]))))
      .catch(() => setDetails({}));
  }, [conflict?.profileId, (conflict?.revisionIds || []).join()]);
  return (
    <aside className="pane scroll hide-s" aria-labelledby="conf-h" style={{ width: 420, flexShrink: 1, minWidth: 0, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Ms name={conflicts.length ? "merge" : "task_alt"} className={conflicts.length ? "c-error" : "c-primary"} />
        <h2 id="conf-h" className="title-l" style={{ flex: 1 }}>
          {conflicts.length ? `${conflicts.length} ${t(conflicts.length === 1 ? "conflict to review" : "conflicts to review")}` : t("No conflicts")}
        </h2>
        <IconBtn icon="refresh" label={t("Check for conflicts")} onClick={() => void app.perform(loadConflicts, ["*"], ["Conflicts checked", "已檢查衝突"])} />
      </div>
      {!conflict ? (
        <p className="body-m on-sv">{t("When a profile changes here and elsewhere before syncing, both versions wait here for you to pick one.")}</p>
      ) : (
        <>
          <p className="body-m on-sv">{name} {t("changed in more than one place. Pick which to keep.")}</p>
          <RadioList
            label={`${name} ${t("conflict")}`}
            value={choice}
            onChange={setChoice}
            options={(conflict.revisionIds || []).map((id: string, i: number) => {
              const detail = details[id];
              return {
                value: id,
                overline: `${t("Version")} ${i + 1}`,
                title: detail ? `${t("Saved")} ${dateOf(detail.createdAt)}` : `${t("Revision")} ${id.slice(0, 8)}`,
                support: detail ? `${Object.keys(detail.files || {}).length} ${t("files")} · ${id.slice(0, 8)}` : id,
                trailing: <Ms name={i === 0 ? "laptop_windows" : "cloud"} />,
              };
            })}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            {conflicts.length > 1 && <span className="body-s on-sv" style={{ flex: 1 }}>{index + 1} {t("of")} {conflicts.length}</span>}
            <Btn variant="text" onClick={() => setIndex((index + 1) % Math.max(1, conflicts.length))}>{t("Later")}</Btn>
            <Btn
              disabled={!choice || pending.length > 0}
              onClick={() =>
                void app.perform(async () => {
                  await request("sync.resolve", { id: conflict.profileId, revisionId: choice });
                  await loadConflicts();
                  await refresh();
                }, ["*"], ["Conflict resolved", "已解決衝突"])
              }
            >
              {t("Apply")}
            </Btn>
          </div>
        </>
      )}
    </aside>
  );
}
