import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ProfilesWorkspace } from "./workspace/ProfilesWorkspace";
import { Onboarding } from "./workspace/Onboarding";
import { Synchronization } from "./workspace/Synchronization";
import { WorkspaceHeader, WorkspaceNavigation } from "./workspace/Shell";
import {
  catalogDestinations,
  validSelection,
  createOperationRegistry,
} from "./workspace/model.mjs";
import { Button, Field, Select, Modal } from "./components";
import { Search } from "./Search";
import { request, Profile } from "./api";
import type { PasswordManagerDetection } from "./api";
import {
  DEFAULT_PASSWORD_MANAGER_FORM,
  buildPasswordManager,
  databaseBasename,
  recommendedSource,
  sourceOptions,
} from "./password-manager-model.mjs";
type PasswordManagerForm = {
  enabled: boolean;
  source: string;
  databaseMode: string;
  databasePath: string;
  extension: boolean;
  passkeys: boolean;
};
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
import { definitions, categories } from "./settings/model.mjs";
import { SuperProfiles } from "./SuperProfiles";
import { ProfileLaunch } from "./ProfileLaunch";
import { operationFailure } from "./operation-errors.mjs";
import { useDisplayName } from "./settings/useDisplayName";
import "./workspace/workspace.css";
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
    [selected, setSelected] = useState<string>(() =>
      read("selectedProfile", ""),
    ),
    [notice, setNotice] = useState(""),
    [celebration, setCelebration] = useState(""),
    [create, setCreate] = useState(false),
    [palette, setPalette] = useState(false),
    [setup, setSetup] = useState(() => read("setup", 0)),
    [showSetup, setShowSetup] = useState(() => !read("setupComplete", false)),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [engine, setEngine] = useState("chromium"),
    [managerForm, setManagerForm] = useState<PasswordManagerForm>({
      ...DEFAULT_PASSWORD_MANAGER_FORM,
    }),
    [managerDetection, setManagerDetection] =
      useState<PasswordManagerDetection | null>(null),
    [folder, setFolder] = useState(""),
    [conflicts, setConflicts] = useState<any[]>([]);
  const [commandRows, setCommandRows] = useState<number[]>([]);
  const [workspaceTabs, setWorkspaceTabs] = useState<
    {
      id: string;
      label: string;
      page: string;
      setting?: string;
      section?: string;
    }[]
  >([]);
  const [launchTarget, setLaunchTarget] = useState<Profile | null>(null);
  const launchInFlight = useRef(false);
  const [pendingOperations, setPendingOperations] = useState<string[]>([]);
  const operations = useRef(createOperationRegistry(setPendingOperations));
  const busy = pendingOperations.length > 0;
  const [activeTab, setActiveTab] = useState("");
  useEffect(() => {
    if (selected)
      localStorage.setItem("selectedProfile", JSON.stringify(selected));
  }, [selected]);
  useEffect(() => {
    if (!status?.unlocked || !profiles.some((p) => p.id === launchTarget?.id))
      setLaunchTarget(null);
  }, [status?.unlocked, profiles]);
  useEffect(() => setLaunchTarget(null), [selected]);
  const refreshSequence = useRef(0);
  const refresh = async () => {
    const sequence = ++refreshSequence.current;
    const s = await request("system.status");
    if (sequence !== refreshSequence.current) return;
    setStatus({ ...s, exists: s.vaultExists, unlocked: s.locked === false });
    if (s.locked === false) {
      const rows = await request("profiles.list");
      if (sequence !== refreshSequence.current) return;
      const next = Array.isArray(rows) ? rows : rows.profiles || [];
      setProfiles(next);
      setSelected((current) => validSelection(next, current));
    } else {
      setProfiles([]);
      setConflicts([]);
    }
  };
  const perform = async (fn: () => Promise<any>, keys: string[] = ["*"]) => {
    return operations.current.runMany(keys, async () => {
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
      }
    });
  };
  useEffect(() => {
    refresh().catch(() => setStatus(null));
    const off = window.materialBrowser?.onEvent((event: any) => {
      if (
        event?.type !== "settings-updated" &&
        event?.type !== "super-profile-session"
      )
        refresh().catch(() => setStatus(null));
    });
    return off;
  }, []);
  useEffect(() => {
    localStorage.setItem("setup", JSON.stringify(setup));
  }, [setup]);
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
    const passwordManager = buildPasswordManager(managerForm);
    const created = await request("profiles.create", {
      name: name.trim(),
      engine,
      ...(passwordManager ? { passwordManager } : {}),
    });
    if (created?.id) setSelected(created.id);
    setName("");
    setManagerForm({ ...DEFAULT_PASSWORD_MANAGER_FORM });
    setCreate(false);
    await refresh();
  };
  const detectPasswordManager = async () => {
    try {
      const detection = await request("passwordManager.detect");
      setManagerDetection(detection);
      const source = recommendedSource(detection);
      setManagerForm((form) => ({
        ...form,
        source: source === "none" ? form.source : source,
      }));
    } catch {
      setManagerDetection(null);
    }
  };
  const updateManager = (patch: Partial<typeof managerForm>) =>
    setManagerForm((form) => ({ ...form, ...patch }));
  const chooseFolder = async () => {
    if (!window.materialBrowser) throw Error("BACKEND_UNAVAILABLE");
    const chosen = await window.materialBrowser.chooseDirectory();
    if (chosen) {
      await request("sync.configure", { folder: chosen });
      setFolder(chosen);
    }
  };
  const conflictGeneration = useRef(0);
  const currentStatus = useRef(status);
  currentStatus.current = status;
  const loadConflicts = async () => {
    const generation = ++conflictGeneration.current;
    const rows = await request("sync.conflicts");
    if (
      !currentStatus.current?.unlocked ||
      generation !== conflictGeneration.current
    )
      return;
    setConflicts(Array.isArray(rows) ? rows : rows.conflicts || []);
  };
  const commands = catalogDestinations(definitions, categories);
  const commandLabel = (label: string) =>
    label.startsWith("Settings: ")
      ? `${t("Settings")}: ${t(label.slice(10))}`
      : t(label);
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
      <p>{t("Automation is off until explicitly enabled for this profile.")}</p>
      <details
        className="password-manager-option"
        open={managerForm.enabled}
        onToggle={(event) => {
          const open = (event.currentTarget as HTMLDetailsElement).open;
          updateManager({ enabled: open });
          if (open && !managerDetection) void detectPasswordManager();
        }}
      >
        <summary>{t("Password manager (optional)")}</summary>
        <p>
          {t(
            "Pair this profile with a KeePassXC database. The database password is never stored by this application.",
          )}
        </p>
        <Select
          label={t("KeePassXC source")}
          value={managerForm.source}
          onChange={(value) => updateManager({ source: value })}
          options={sourceOptions(managerDetection).map((option) => [
            option.value,
            option.available
              ? t(option.label)
              : `${t(option.label)} (${t(option.reason)})`,
          ])}
        />
        {managerDetection && !managerDetection.installed && (
          <p className="literal">
            {t("No installed KeePassXC was detected. Releases:")}{" "}
            {managerDetection.sourceRelease}
          </p>
        )}
        <Select
          label={t("Database")}
          value={managerForm.databaseMode}
          onChange={(value) => updateManager({ databaseMode: value })}
          options={[
            ["existing", t("Use an existing database")],
            ["create", t("Create a new database at this path")],
          ]}
        />
        <Field
          label={t("Database path (.kdbx)")}
          value={managerForm.databasePath}
          onChange={(value) => updateManager({ databasePath: value })}
          required={managerForm.enabled}
        />
        <Button
          secondary
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              const chosen = await window.materialBrowser?.chooseDatabaseFile();
              if (chosen) updateManager({ databasePath: chosen });
            })
          }
        >
          {t("Choose database file")}
        </Button>
        {managerForm.databasePath && (
          <p className="literal">{databaseBasename(managerForm.databasePath)}</p>
        )}
        <label className="switch-row">
          {React.createElement("md-switch", {
            selected: managerForm.extension,
            onChange: (event: Event) =>
              updateManager({
                extension: (event.target as unknown as { selected: boolean })
                  .selected,
              }),
            "aria-label": t("Install the KeePassXC browser extension"),
          })}
          <span>{t("Install the KeePassXC browser extension")}</span>
        </label>
        <label className="switch-row">
          {React.createElement("md-switch", {
            selected: managerForm.passkeys,
            onChange: (event: Event) =>
              updateManager({
                passkeys: (event.target as unknown as { selected: boolean })
                  .selected,
              }),
            "aria-label": t("Enable passkeys"),
          })}
          <span>{t("Enable passkeys")}</span>
        </label>
        <p>
          {t(
            "The browser still asks once to enable the extension. Nothing is installed silently.",
          )}
        </p>
      </details>
      <Button
        disabled={
          busy ||
          !name.trim() ||
          (managerForm.enabled && !managerForm.databasePath.trim())
        }
        onClick={() => void perform(createProfile)}
      >
        {t("Create")}
      </Button>
    </>
  );
  return (
    <div className={`app-shell palette-${prefs.paletteSize}`}>
      <WorkspaceHeader {...{ prefs, displayName, t, status, setPalette }} />
      {workspaceTabs.length > 0 && (
        <div className="workspace-tab-strip" aria-label={t("Open tabs")}>
          {workspaceTabs.map((target) => (
            <div
              key={target.id}
              className={activeTab === target.id ? "active" : ""}
            >
              <button
                onClick={() => {
                  setActiveTab(target.id);
                  setShowSetup(false);
                  setPage(target.page);
                  if (target.section)
                    settingsController.selectSection(target.section);
                  if (target.setting) {
                    settingsController.selectSection(target.section!);
                    setTimeout(
                      () =>
                        window.dispatchEvent(
                          new CustomEvent("settings-reveal", {
                            detail: target.setting,
                          }),
                        ),
                      0,
                    );
                  }
                }}
              >
                {commandLabel(target.label)}
              </button>
              <button
                aria-label={`${t("Close")} ${commandLabel(target.label)}`}
                onClick={() => {
                  setWorkspaceTabs((tabs) =>
                    tabs.filter((tab) => tab.id !== target.id),
                  );
                  if (activeTab === target.id) setActiveTab("");
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="body">
        <WorkspaceNavigation
          {...{
            t,
            page,
            setPage: (value: string) => {
              setActiveTab("");
              setPage(value);
            },
            setShowSetup: (value: boolean) => {
              setActiveTab("");
              setShowSetup(value);
            },
            status,
            busy,
            perform,
            refresh,
          }}
        />
        <main className="workspace-main">
          {!status && (
            <section className="banner">
              <h2>{t("Backend unavailable")}</h2>
              <p>
                {t(
                  "The native host is not connected. No profile data is simulated. Build and open the desktop package to use the vault.",
                )}
              </p>
              <Button secondary onClick={() => void perform(refresh)}>
                {t("Retry connection")}
              </Button>
            </section>
          )}
          {showSetup ? (
            <Onboarding
              {...{
                t,
                setup: status?.unlocked
                  ? Math.min(
                      profiles.length ? 3 : 1,
                      Math.max(0, Number(setup) || 0),
                    )
                  : 0,
                setSetup,
                status,
                password,
                setPassword,
                busy,
                perform,
                refresh,
                setFolder,
                profileForm,
                profiles,
                folder,
                chooseFolder,
                setShowSetup,
                setPage,
              }}
            />
          ) : null}
          <div hidden={showSetup || page !== "super-profiles"}>
            <SuperProfiles t={t} unlocked={status?.unlocked === true} />
          </div>
          <div hidden={showSetup || page !== "profiles"}>
            <ProfilesWorkspace
              profiles={profiles}
              selected={selected}
              onSelect={setSelected}
              unlocked={status?.unlocked === true}
              t={t}
              onCreate={() => setCreate(true)}
              onLaunch={setLaunchTarget}
              refresh={refresh}
              operations={operations.current}
              pending={pendingOperations}
              onResults={(results) => {
                const failed = results.some((result) => !result.ok);
                const english = failed ? "Some operations failed" : "Completed";
                const cantonese = failed ? "部分操作未能完成" : "已完成";
                const message = styledMessage(
                  failed ? "error" : "success",
                  english,
                  cantonese,
                  prefs,
                );
                settingsController.notify(
                  message,
                  failed ? "error" : "success",
                );
                narrator.speak(
                  english,
                  cantonese,
                  failed ? "error" : "success",
                );
              }}
            />
          </div>
          <div hidden={showSetup || page !== "sync"}>
            <Synchronization
              {...{
                t,
                folder,
                busy,
                status,
                perform,
                chooseFolder,
                loadConflicts,
                refresh,
                conflicts,
                profiles,
              }}
            />
          </div>
          <div hidden={showSetup || page !== "settings"}>
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
          </div>
        </main>
      </div>
      <AccessibilityTools
        controller={settingsController}
        t={t}
        narrator={narrator}
      />
      <AttentionStatus controller={settingsController} t={t} />
      <Toasts controller={settingsController} t={t} />
      <footer className="app-status" role="status" aria-live="polite">
        <span className={busy ? "pulse" : ""}>{busy ? "●" : "○"}</span>
        {notice || t("Local settings")}
      </footer>
      {create && (
        <Modal title={t("Create profile")} onClose={() => setCreate(false)}>
          {profileForm}
        </Modal>
      )}
      {launchTarget && (
        <ProfileLaunch
          profile={launchTarget}
          busy={operations.current.blocked([launchTarget.id])}
          t={t}
          onClose={() => setLaunchTarget(null)}
          onLaunch={(id) => {
            if (operations.current.blocked([id]) || launchInFlight.current)
              return;
            launchInFlight.current = true;
            setLaunchTarget(null);
            void perform(async () => {
              if (!status?.unlocked) throw new Error("VAULT_LOCKED");
              if (!profiles.some((p) => p.id === id))
                throw new Error("PROFILE_NOT_FOUND");
              await request("profiles.launch", {
                id,
                requireStableIdentity: false,
              });
              await refresh();
            }, [id]).finally(() => {
              launchInFlight.current = false;
            });
          }}
        />
      )}
      {palette && (
        <Modal title={t("New tab")} onClose={() => setPalette(false)}>
          <Search
            label={t("Search")}
            items={commands.map((command) => commandLabel(command.label))}
            onResults={setCommandRows}
            t={t}
          />
          {commandRows.map((i) => (
            <Button
              key={commands[i].id}
              secondary
              onClick={() => {
                setPalette(false);
                const target = commands[i];
                setActiveTab(target.id);
                if (target.page)
                  setWorkspaceTabs((tabs) =>
                    tabs.some((tab) => tab.id === target.id)
                      ? tabs
                      : [...tabs, { ...target, page: target.page }],
                  );
                if (target.setting) {
                  setShowSetup(false);
                  setPage("settings");
                  settingsController.selectSection(target.section!);
                  setTimeout(
                    () =>
                      window.dispatchEvent(
                        new CustomEvent("settings-reveal", {
                          detail: target.setting,
                        }),
                      ),
                    0,
                  );
                } else if (target.page) {
                  setShowSetup(false);
                  setPage(target.page);
                  if (target.section)
                    settingsController.selectSection(target.section);
                } else if (target.id === "action:setup") setShowSetup(true);
                else if (target.id === "action:create") setCreate(true);
                else if (target.id === "action:lock")
                  void perform(async () => {
                    await request("vault.lock");
                    await refresh();
                  });
              }}
            >
              {commandLabel(commands[i].label)}
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
