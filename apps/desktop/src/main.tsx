import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { APP_VERSION } from "./build-version";
import { Button, Field, Select, Modal, Tabs } from "./components";
import { Search } from "./Search";
import { request, Profile } from "./api";
import { translate, Language } from "./i18n";
import { parseVocabulary, replaceLabel } from "./vocabulary.mjs";
import "./style.css";
import "./settings/settings.css";
import { useSettings } from "./settings/store";
import { usePresentationEffects, useNarrator } from "./settings/effects";
import { SettingsWorkspace } from "./settings/SettingsWorkspace";
import {
  AccessibilityTools,
  AttentionStatus,
  Toasts,
} from "./settings/LiveTools";
import { styledMessage } from "./settings/messages.mjs";
import { definitions } from "./settings/model.mjs";
import { SuperProfiles } from './SuperProfiles';
import { ProfileLaunch } from './ProfileLaunch';
import { operationFailure } from './operation-errors.mjs';
import { useDisplayName } from "./settings/useDisplayName";
const read = (key: string, fallback: any) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
function App() {
  const displayName = useDisplayName();
  const settingsController = useSettings();
  const prefs = settingsController.preferences;
  usePresentationEffects(prefs);
  const narrator = useNarrator(prefs);
  const [entries, setEntries] = useState<Record<string, string>>(() => {
    try {
      return parseVocabulary(localStorage.getItem("wording") || "").entries;
    } catch {
      return {};
    }
  });
  const t = (s: string) =>
    replaceLabel(translate(s, prefs.language as Language), entries);
  const [page, setPage] = useState("profiles"),
    [status, setStatus] = useState<any>(null),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState("overview"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [celebration, setCelebration] = useState(""),
    [create, setCreate] = useState(false),
    [palette, setPalette] = useState(false),
    [setup, setSetup] = useState(() => read("setup", 0)),
    [showSetup, setShowSetup] = useState(() => !read("setupComplete", false)),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [engine, setEngine] = useState("chromium"),
    [automation, setAutomation] = useState("off"),
    [folder, setFolder] = useState(""),
    [revisions, setRevisions] = useState<any[]>([]),
    [conflicts, setConflicts] = useState<any[]>([]),
    [runtime, setRuntime] = useState<any>(null);
  const [profileRows, setProfileRows] = useState<number[]>([]),
    [revisionRows, setRevisionRows] = useState<number[]>([]),
    [conflictRows, setConflictRows] = useState<number[]>([]),
    [commandRows, setCommandRows] = useState<number[]>([]),
    [automationRows, setAutomationRows] = useState<number[]>([]);
  const profile = profiles.find((p) => p.id === selected);
  const [launchTarget, setLaunchTarget] = useState<Profile | null>(null);
  const launchInFlight = useRef(false);
  useEffect(() => {
    if (!status?.unlocked || !profiles.some(p => p.id === launchTarget?.id)) setLaunchTarget(null);
  }, [status?.unlocked, profiles]);
  useEffect(() => setLaunchTarget(null), [selected]);
  const refresh = async () => {
    const s = await request("system.status");
    setStatus({ ...s, exists: s.vaultExists, unlocked: s.locked === false });
    if (s.locked === false) {
      const rows = await request("profiles.list");
      setProfiles(Array.isArray(rows) ? rows : rows.profiles || []);
    } else setProfiles([]);
  };
  const perform = async (fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true);
    setNotice(styledMessage("progress", "Working", "處理中", prefs));
    try {
      await fn();
      const message = styledMessage("success", "Completed", "已完成", prefs);
      setNotice(message);
      settingsController.notify(message, "success");
      narrator.speak("Completed", "已完成", "success");
    } catch (e) {
      const [english, cantonese] = operationFailure(e);
      const message = styledMessage("error", english, cantonese, prefs);
      setNotice(message);
      settingsController.notify(message, "error");
      narrator.speak(english, cantonese, "error");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    refresh().catch(() => setStatus(null));
    const off = window.materialBrowser?.onEvent((event: any) => {
      if (event?.type !== "settings-updated" && event?.type !== "super-profile-session")
        refresh().catch(() => setStatus(null));
    });
    return off;
  }, []);
  useEffect(() => {
    localStorage.setItem("setup", JSON.stringify(setup));
  }, [setup]);
  useEffect(() => {
    setAutomation(profile?.automation || "off");
    setRevisions([]);
    setRuntime(null);
    if (profile)
      request("profiles.status", { id: profile.id })
        .then((rows) =>
          setRuntime(
            Array.isArray(rows)
              ? rows.find((r) => r.profileId === profile.id)
              : rows,
          ),
        )
        .catch(() => {});
  }, [selected, profiles]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setPalette(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const importWording = async (file: File) => {
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 262144)
        throw Error();
      const text = await file.text();
      const parsed = parseVocabulary(text);
      localStorage.setItem("wording", JSON.stringify(parsed));
      setEntries(parsed.entries);
      setCelebration(
        parsed.entries["private vocabulary"] || t("Personal wording applied"),
      );
      setTimeout(() => setCelebration(""), 3000);
    } catch {
      setNotice(t("Invalid personal wording file"));
    }
  };
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length === 1)
        void importWording(e.dataTransfer.files[0]);
      else setNotice(t("Invalid personal wording file"));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [prefs.language]);
  const createProfile = async () => {
    if (!name.trim()) throw Error("NAME_REQUIRED");
    await request("profiles.create", { name: name.trim(), engine });
    setName("");
    setCreate(false);
    await refresh();
  };
  const chooseFolder = async () => {
    if (!window.materialBrowser) throw Error("BACKEND_UNAVAILABLE");
    const chosen = await window.materialBrowser.chooseDirectory();
    if (chosen) {
      await request("sync.configure", { folder: chosen });
      setFolder(chosen);
    }
  };
  const loadRevisions = async () => {
    if (!profile) return;
    const rows = await request("revisions.list", { id: profile.id });
    setRevisions(Array.isArray(rows) ? rows : rows.revisions || []);
  };
  const loadConflicts = async () => {
    const rows = await request("sync.conflicts");
    setConflicts(Array.isArray(rows) ? rows : rows.conflicts || []);
  };
  const commands = [
    "Profiles",
    "Synchronization",
    "Settings",
    "Setup",
    "Create profile",
    "Lock vault",
    ...definitions.map((d) => `Settings: ${d.label}`),
  ];
  const profileForm = (
    <>
      <Field label={t("Name")} value={name} onChange={setName} required />
      <Select
        label={t("Engine")}
        value={engine}
        onChange={setEngine}
        options={[
          ["chromium", "Chromium"],
          ["firefox", "Firefox"],
        ]}
      />
      <p>Automation is off until explicitly enabled for this profile.</p>
      <Button
        disabled={busy || !name.trim()}
        onClick={() => void perform(createProfile)}
      >
        {t("Create")}
      </Button>
    </>
  );
  return (
    <div className={`app-shell palette-${prefs.paletteSize}`}>
      <header>
        <div className="brand-mark" aria-hidden="true">
          {prefs.logoPreset === "profiles"
            ? "▤"
            : prefs.logoPreset === "compass"
              ? "◇"
              : "M"}
        </div>
        <div className="identity">
          <strong>{displayName || "Material Browser"}</strong>
          <small>
              {t("Version")} {APP_VERSION} · {t("Updated")}: {t("Unavailable")}
          </small>
        </div>
        <span className="connection">
          {t(
            status
              ? status.unlocked
                ? "Connected"
                : "Locked"
              : "Backend unavailable",
          )}
        </span>
        <Button secondary onClick={() => setPalette(true)}>
          {t("Command palette")} <kbd>Ctrl Shift F</kbd>
        </Button>
      </header>
      <div className="body">
        <nav aria-label="Workspace">
          {[
            ["profiles", "Profiles"],
            ["super-profiles", "Super Profiles"],
            ["sync", "Synchronization"],
            ["settings", "Settings"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                if (id === "settings") setShowSetup(false);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {id === "profiles" ? "▤" : id === "sync" ? "⇄" : "⚙"}
              </span>
              {t(label)}
            </button>
          ))}
          <button onClick={() => setShowSetup(true)}>{t("Setup")}</button>
          <button
            disabled={!status?.unlocked || busy}
            onClick={() =>
              void perform(async () => {
                await request("vault.lock");
                await refresh();
              })
            }
          >
            {t("Lock vault")}
          </button>
        </nav>
        <main>
          {!status && (
            <section className="banner">
              <h2>{t("Backend unavailable")}</h2>
              <p>
                The native host is not connected. No profile data is simulated.
                Build and open the desktop package to use the vault.
              </p>
              <Button secondary onClick={() => void perform(refresh)}>
                {t("Retry connection")}
              </Button>
            </section>
          )}
          {showSetup ? (
            <section className="surface wizard">
              <div className="eyebrow">
                {t("Setup progress")} {setup + 1}/4
              </div>
              <h1>
                {t(
                  [
                    "Create vault",
                    "Create profile",
                    "Optional synchronization",
                    "Workspace ready",
                  ][setup],
                )}
              </h1>
              <progress
                max={4}
                value={setup + 1}
                aria-label={t("Setup progress")}
              />
              {setup === 0 && (
                <>
                  {status?.unlocked ? (
                    <p>{t("Connected")}</p>
                  ) : (
                    <>
                      <p>
                        Create an encrypted vault or unlock the existing vault.
                        Passwords are never saved by this interface.
                      </p>
                      <Field
                        label={t("Password")}
                        value={password}
                        onChange={setPassword}
                        type="password"
                      />
                      <Button
                        disabled={busy || !status || !password}
                        onClick={() =>
                          void perform(async () => {
                            const secret = password;
                            setPassword("");
                            await request(
                              status?.exists ? "vault.unlock" : "vault.create",
                              { password: secret },
                            );
                            await refresh();
                          })
                        }
                      >
                        {t(status?.exists ? "Unlock vault" : "Create vault")}
                      </Button>
                      {!status?.exists && (
                        <Button
                          secondary
                          disabled={busy || !password || !status}
                          onClick={() =>
                            void perform(async () => {
                              const chosen =
                                await window.materialBrowser?.chooseDirectory();
                              if (chosen) {
                                const secret = password;
                                setPassword("");
                                await request("vault.join", {
                                  folder: chosen,
                                  password: secret,
                                });
                                setFolder(chosen);
                                await refresh();
                              }
                            })
                          }
                        >
                          Join existing shared vault
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
              {setup === 1 && (
                <>
                  {profileForm}
                  <p>{profiles.length} profiles</p>
                </>
              )}
              {setup === 2 && (
                <>
                  <p>
                    Choose a shared folder to exchange encrypted snapshots. This
                    step is optional.
                  </p>
                  <p className="literal">{folder}</p>
                  <Button
                    disabled={busy}
                    onClick={() => void perform(chooseFolder)}
                  >
                    {t("Choose folder")}
                  </Button>
                </>
              )}
              {setup === 3 && (
                <p>
                  Vault is unlocked and your profile workspace is ready. Managed
                  browser launch remains subject to actual installed engine
                  capabilities.
                </p>
              )}
              <div className="actions">
                <Button
                  secondary
                  disabled={setup === 0 || busy}
                  onClick={() => setSetup(setup - 1)}
                >
                  {t("Back")}
                </Button>
                {setup === 2 && (
                  <Button secondary onClick={() => setSetup(3)}>
                    {t("Skip")}
                  </Button>
                )}
                <Button
                  disabled={
                    busy ||
                    (setup === 0 && !status?.unlocked) ||
                    (setup === 1 && !profiles.length)
                  }
                  onClick={() => {
                    if (setup === 3) {
                      localStorage.setItem("setupComplete", "true");
                      setShowSetup(false);
                      setPage("profiles");
                    } else setSetup(setup + 1);
                  }}
                >
                  {t(setup === 3 ? "Finish" : "Next")}
                </Button>
              </div>
            </section>
          ) : page === "super-profiles" ? (
            <SuperProfiles t={t}/>
          ) : page === "profiles" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">LOCAL WORKSPACE</span>
                  <h1>{t("Profiles")}</h1>
                </div>
                <Button
                  disabled={!status?.unlocked}
                  onClick={() => setCreate(true)}
                >
                  {t("Create profile")}
                </Button>
              </div>
              <div className="profiles-layout">
                <section className="surface profile-list">
                  <Search
                    label={t("Search")}
                    items={profiles.map((p) => `${p.name} ${p.engine}`)}
                    onResults={setProfileRows}
                    t={t}
                  />
                  {profiles.length === 0 ? (
                    <p className="empty">{t("No profiles yet")}</p>
                  ) : (
                    profileRows.map((i) => (
                      <button
                        className={`profile-row ${selected === profiles[i].id ? "selected" : ""}`}
                        key={profiles[i].id}
                        onClick={() => setSelected(profiles[i].id)}
                      >
                        <span className="avatar">
                          {profiles[i].name.slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{profiles[i].name}</strong>
                          <small>
                            {profiles[i].engine} · {profiles[i].automation}
                          </small>
                        </span>
                      </button>
                    ))
                  )}
                </section>
                <section className="surface detail">
                  {profile ? (
                    <>
                      <div className="detail-heading">
                        <span className="avatar large">
                          {profile.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <h2>{profile.name}</h2>
                          <p>{profile.engine}</p>
                        </div>
                      </div>
                      <Tabs
                        items={["overview", "revisions", "automation"].map(
                          (x) => [x, t(x[0].toUpperCase() + x.slice(1))],
                        )}
                        value={detail}
                        onChange={(x) => {
                          setDetail(x);
                          if (x === "revisions") void perform(loadRevisions);
                        }}
                      />
                      <div role="tabpanel" id={`panel-${detail}`}>
                        {detail === "overview" ? (
                          <>
                            <dl>
                              <dt>ID</dt>
                              <dd>{profile.id}</dd>
                              <dt>{t("Profile identity")}</dt>
                              <dd>
                                <pre>
                                  {JSON.stringify(
                                    profile.identity || {},
                                    null,
                                    2,
                                  )}
                                </pre>
                              </dd>
                            </dl>
                            <div className="actions">
                              {[
                                ["profiles.launch", "Launch"],
                                ["profiles.stop", "Stop"],
                                ["profiles.duplicate", "Duplicate"],
                                ["profiles.snapshot", "Snapshot"],
                              ].map(([method, label]) => (
                                <Button
                                  key={method}
                                  disabled={busy}
                                  secondary={label !== "Launch"}
                                  onClick={() =>
                                    method === 'profiles.launch' ? setLaunchTarget({ ...profile }) : void perform(async () => {
                                      await request(method, {
                                        id: profile.id,
                                        running: false,
                                      });
                                      await refresh();
                                    })
                                  }
                                >
                                  {t(label)}
                                </Button>
                              ))}
                            </div>
                            <p className="help">
                              Actions run only when the native host supports
                              them. Unsupported engine integrations return a
                              capability reason.
                            </p>
                          </>
                        ) : detail === "revisions" ? (
                          <>
                            <Search
                              label={t("Search")}
                              items={revisions.map((r) => JSON.stringify(r))}
                              onResults={setRevisionRows}
                              t={t}
                            />
                            <Button
                              secondary
                              disabled={busy}
                              onClick={() => void perform(loadRevisions)}
                            >
                              {t("Refresh")}
                            </Button>
                            {!revisions.length && <p>{t("No revisions")}</p>}
                            {revisionRows.map((i) => (
                              <article className="record" key={i}>
                                <code>{revisions[i].id}</code>
                                <p>{revisions[i].createdAt}</p>
                                <Button
                                  secondary
                                  disabled={busy}
                                  onClick={() =>
                                    void perform(async () => {
                                      await request("revisions.restore", {
                                        id: profile.id,
                                        revisionId: revisions[i].id,
                                      });
                                      await loadRevisions();
                                    })
                                  }
                                >
                                  {t("Restore")}
                                </Button>
                              </article>
                            ))}
                          </>
                        ) : (
                          <>
                            <Search
                              label={t("Search")}
                              items={[
                                "Off Selenium Puppeteer saved effective restart",
                              ]}
                              onResults={setAutomationRows}
                              t={t}
                            />
                            {automationRows.length > 0 && (
                              <>
                                <p>
                                  {t("Saved preference")}: {profile.automation}
                                </p>
                                <p>
                                  {t("Effective mode")}:{" "}
                                  {runtime?.effectiveMode || t("Unavailable")}
                                </p>
                                {runtime &&
                                  runtime.effectiveMode !==
                                    profile.automation && (
                                    <p>{t("Restart required")}</p>
                                  )}
                                <Select
                                  label={t("Automation")}
                                  value={automation}
                                  onChange={setAutomation}
                                  options={[
                                    ["off", t("Off")],
                                    ["selenium", "Selenium"],
                                    ["puppeteer", "Puppeteer"],
                                  ]}
                                />
                                <p>
                                  Saving changes the preference. A running
                                  profile requires restart before its automation
                                  mode changes. Default: Off.
                                </p>
                                <Button
                                  disabled={busy}
                                  onClick={() =>
                                    void perform(async () => {
                                      await request("profiles.update", {
                                        id: profile.id,
                                        automation,
                                      });
                                      await refresh();
                                    })
                                  }
                                >
                                  {t("Save preference")}
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      <h2>{t("Select a profile")}</h2>
                      <p>
                        Keep identities, snapshots and automation preferences in
                        separate profiles.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : page === "sync" ? (
            <>
              <div className="page-heading">
                <h1>{t("Synchronization")}</h1>
              </div>
              <section className="surface">
                <h2>{t("Folder")}</h2>
                <p className="literal">{folder || t("Unavailable")}</p>
                <div className="actions">
                  <Button
                    disabled={busy || !status?.unlocked}
                    onClick={() => void perform(chooseFolder)}
                  >
                    {t("Choose folder")}
                  </Button>
                  {[
                    ["sync.push", "Upload changes"],
                    ["sync.pull", "Download changes"],
                  ].map(([method, label]) => (
                    <Button
                      key={method}
                      secondary
                      disabled={busy || !status?.unlocked}
                      onClick={() =>
                        void perform(async () => {
                          await request(method);
                          await loadConflicts();
                          await refresh();
                        })
                      }
                    >
                      {t(label)}
                    </Button>
                  ))}
                </div>
                <h2>{t("Conflicts")}</h2>
                <Search
                  label={t("Search")}
                  items={conflicts.map((c) => JSON.stringify(c))}
                  onResults={setConflictRows}
                  t={t}
                />
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void perform(loadConflicts)}
                >
                  {t("Refresh")}
                </Button>
                {!conflicts.length && <p>{t("No conflicts")}</p>}
                {conflictRows.map((i) => (
                  <article className="record" key={i}>
                    <pre>{JSON.stringify(conflicts[i], null, 2)}</pre>
                    <div className="actions">
                      {(conflicts[i].revisionIds || []).map(
                        (revisionId: string) => (
                          <Button
                            secondary
                            disabled={busy}
                            key={revisionId}
                            onClick={() =>
                              void perform(async () => {
                                await request("sync.resolve", {
                                  id: conflicts[i].profileId,
                                  revisionId,
                                });
                                await loadConflicts();
                              })
                            }
                          >
                            {t("Restore")} {revisionId}
                          </Button>
                        ),
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <SettingsWorkspace
              controller={settingsController}
              t={t}
              narrator={narrator}
              wordingLoaded={Object.keys(entries).length > 0}
              onWordingFile={(file) => void importWording(file)}
              onClearWording={() => {
                localStorage.removeItem("wording");
                setEntries({});
              }}
            />
          )}
        </main>
      </div>
      <AccessibilityTools
        controller={settingsController}
        t={t}
        narrator={narrator}
      />
      <AttentionStatus controller={settingsController} t={t} />
      <Toasts controller={settingsController} t={t} />
      <footer role="status" aria-live="polite">
        <span className={busy ? "pulse" : ""}>{busy ? "●" : "○"}</span>
        {notice || t("Local settings")}
      </footer>
      {create && (
        <Modal title={t("Create profile")} onClose={() => setCreate(false)}>
          {profileForm}
        </Modal>
      )}
      {launchTarget && (
        <ProfileLaunch profile={launchTarget} busy={busy} t={t}
          onClose={() => setLaunchTarget(null)}
          onLaunch={(id) => {
            if (busy || launchInFlight.current) return;
            launchInFlight.current = true;
            setLaunchTarget(null);
            void perform(async () => {
              if (!status?.unlocked) throw new Error('VAULT_LOCKED');
              if (!profiles.some(p => p.id === id)) throw new Error('PROFILE_NOT_FOUND');
              await request('profiles.launch', { id, requireStableIdentity: false });
              await refresh();
            }).finally(() => { launchInFlight.current = false; });
          }} />
      )}
      {palette && (
        <Modal title={t("Command palette")} onClose={() => setPalette(false)}>
          <Search
            label={t("Search")}
            items={commands.map(t)}
            onResults={setCommandRows}
            t={t}
          />
          {commandRows.map((i) => (
            <Button
              key={i}
              secondary
              onClick={() => {
                setPalette(false);
                if (i >= 6) {
                  setShowSetup(false);
                  setPage("settings");
                  const target = definitions[i - 6];
                  settingsController.selectSection(target.category);
                  setTimeout(
                    () =>
                      window.dispatchEvent(
                        new CustomEvent("settings-reveal", {
                          detail: target.key,
                        }),
                      ),
                    0,
                  );
                  return;
                }
                if (i < 3) {
                  setShowSetup(false);
                  setPage(["profiles", "sync", "settings"][i]);
                } else if (i === 3) setShowSetup(true);
                else if (i === 4) setCreate(true);
                else
                  void perform(async () => {
                    await request("vault.lock");
                    await refresh();
                  });
              }}
            >
              {t(commands[i])}
            </Button>
          ))}
        </Modal>
      )}
      {celebration && (
        <div className="celebration" role="status" aria-live="polite">
          <strong>{celebration}</strong>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
