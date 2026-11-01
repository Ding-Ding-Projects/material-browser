import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { request, type Profile } from "../api";
import { translate, type Language } from "../i18n";
import { parseVocabulary, replaceLabel } from "../vocabulary.mjs";
import { useSettings } from "../settings/store";
import { usePresentationEffects, useNarrator } from "../settings/effects";
import { styledMessage } from "../settings/messages.mjs";
import { useDisplayName } from "../settings/useDisplayName";
import { operationFailure } from "../operation-errors.mjs";
import { createOperationRegistry, validSelection, catalogDestinations } from "../workspace/model.mjs";
import { restoreWorkspaceTabs } from "../workspace/workspace-tabs-model.mjs";
import { definitions, categories } from "../settings/model.mjs";
import { Provider, type AppContextValue, type Page, type Runtime, type Status } from "./context";
import { TitleBar, Rail, TabsPane, StatusBar, type WorkspaceTab } from "./Shell";
import { ProfilesPage } from "./Profiles";
import { LaunchPage } from "./Launch";
import { VaultUnlock, FirstRun } from "./Vault";
import { Palette } from "./Palette";
import { CreateProfileDialog } from "./CreateProfile";
import { NotificationsPanel, LiveLayer, AccessibilityPanel, AttentionBar } from "./Live";
import { UnlockDialog, SupportTickets } from "./Safety";
import { useLockStore } from "./locks";
import { SyncPage } from "./Sync";
import { SuperProfilesPage } from "./SuperProfiles";
import { ServersPage } from "./Servers";
import { OllamaPage } from "./Ollama";
import { ToolboxPage } from "./Toolbox";
import { SettingsPage } from "./Settings";

const read = (key: string, fallback: any) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

export function App() {
  const displayName = useDisplayName();
  const settings = useSettings();
  const prefs = settings.preferences;
  usePresentationEffects(prefs, settings.record);
  const narrator = useNarrator(prefs);
  const locks = useLockStore();
  const [entries, setEntries] = useState<Record<string, string>>(() => {
    try {
      return parseVocabulary(localStorage.getItem("wording") || "").entries;
    } catch {
      return {};
    }
  });
  const t = useCallback((s: string) => replaceLabel(translate(s, prefs.language as Language), entries), [prefs.language, entries]);
  const [status, setStatus] = useState<Status>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [selected, setSelectedState] = useState<string>(() => read("selectedProfile", ""));
  const [page, setPage] = useState<Page>("profiles");
  const [launchTarget, setLaunchTarget] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const operations = useRef(createOperationRegistry(setPending));
  const busy = pending.length > 0;
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [creating, setCreating] = useState(false);
  const [palette, setPalette] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [accessibility, setAccessibility] = useState(false);
  const [tickets, setTickets] = useState(false);
  const [unlocking, setUnlocking] = useState<{ id: string; then: () => void } | null>(null);
  const [snackbar, setSnackbar] = useState<{ id: number; message: string; action?: { label: string; run: () => void } } | null>(null);
  const [celebration, setCelebration] = useState("");
  const openLocks = useRef(new Set<string>());
  const [setupStep, setSetupStep] = useState<number>(() => read("setup", 0));
  const [setupDone, setSetupDone] = useState<boolean>(() => read("setupComplete", false));
  const [showSetup, setShowSetup] = useState(false);
  const [dock, setDock] = useState<"left" | "right">(() => (read("tabs.dock", "left") === "right" ? "right" : "left"));
  const [activeTab, setActiveTab] = useState("");
  const [settingsSection, setSettingsSection] = useState<string>(() => settings.record.section || "language");
  useEffect(() => {
    if (settings.storageReady) setSettingsSection(settings.record.section || "language");
  }, [settings.storageReady]);
  const [tabs, setTabsState] = useState<WorkspaceTab[]>(() =>
    restoreWorkspaceTabs(read("workspace.tabs.v1", []), catalogDestinations(definitions, categories)),
  );
  const setTabs = (update: (tabs: WorkspaceTab[]) => WorkspaceTab[]) =>
    setTabsState((current) => {
      const next = update(current);
      try {
        localStorage.setItem("workspace.tabs.v1", JSON.stringify(next.map((tab) => tab.id)));
      } catch {}
      return next;
    });
  useEffect(() => {
    try {
      localStorage.setItem("tabs.dock", JSON.stringify(dock));
      localStorage.setItem("setup", JSON.stringify(setupStep));
      localStorage.setItem("setupComplete", JSON.stringify(setupDone));
    } catch {}
  }, [dock, setupStep, setupDone]);
  const setSelected = (id: string) => {
    setSelectedState(id);
    try {
      localStorage.setItem("selectedProfile", JSON.stringify(id));
    } catch {}
  };

  const refreshSequence = useRef(0);
  const statusRef = useRef<Status>(null);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const s = await request("system.status");
    if (sequence !== refreshSequence.current) return;
    const next = { ...s, exists: s.vaultExists, unlocked: s.locked === false };
    statusRef.current = next;
    setStatus(next);
    if (s.locked === false) {
      const rows = await request("profiles.list");
      if (sequence !== refreshSequence.current) return;
      const list = Array.isArray(rows) ? rows : rows.profiles || [];
      setProfiles(list);
      setSelectedState((current) => validSelection(list, current));
    } else {
      setProfiles([]);
      setRuntimes([]);
      setConflicts([]);
      openLocks.current.clear();
    }
  }, []);
  const seen = useRef<Record<string, number>>((() => {
    try {
      return JSON.parse(sessionStorage.getItem("runtime.seen") || "{}");
    } catch {
      return {};
    }
  })());
  const refreshRuntime = useCallback(async () => {
    if (!statusRef.current?.unlocked) return;
    try {
      const value = await request("profiles.status");
      const list: any[] = Array.isArray(value) ? value : value ? [value] : [];
      const map: Record<string, number> = {};
      const next = list
        .filter((r) => r && typeof r.profileId === "string")
        .map((r) => {
          const key = `${r.profileId}:${r.pid}`;
          map[key] = seen.current[key] || Date.now();
          return { ...r, seenAt: map[key] } as Runtime;
        });
      seen.current = map;
      try {
        sessionStorage.setItem("runtime.seen", JSON.stringify(map));
      } catch {}
      setRuntimes(next);
    } catch {
      /* Runtime status is advisory; the list keeps its last observation. */
    }
  }, []);
  const conflictGeneration = useRef(0);
  const loadConflicts = useCallback(async () => {
    const generation = ++conflictGeneration.current;
    const rows = await request("sync.conflicts");
    if (!statusRef.current?.unlocked || generation !== conflictGeneration.current) return;
    setConflicts(Array.isArray(rows) ? rows : rows?.conflicts || []);
  }, []);
  const perform = useCallback(
    async (fn: () => Promise<any>, keys: string[] = ["*"], label?: [string, string]) =>
      operations.current.runMany(keys, async () => {
        setNotice(styledMessage("progress", "Working", "處理中", prefs));
        try {
          const value = await fn();
          const [english, cantonese] = label || ["Completed", "已完成"];
          const message = styledMessage("success", english, cantonese, prefs);
          setNotice(message);
          void settings.notify(message, "success");
          narrator.speak(english, cantonese, "success");
          return value;
        } catch (e) {
          const [english, cantonese] = operationFailure(e);
          const message = styledMessage("error", english, cantonese, prefs);
          setNotice(message);
          void settings.notify(message, "error");
          narrator.speak(english, cantonese, "error");
        }
      }),
    [prefs, settings.notify, narrator],
  );
  useEffect(() => {
    refresh().catch(() => setStatus(null));
    const off = window.materialBrowser?.onEvent((event: any) => {
      if (event?.type === "backend-disconnected") setStatus(null);
      else if (!["window-state", "settings-updated", "super-profile-session"].includes(event?.type)) refresh().catch(() => setStatus(null));
    });
    return off;
  }, []);
  useEffect(() => {
    if (!status?.unlocked) return;
    void refreshRuntime();
    loadConflicts().catch(() => {});
    const timer = setInterval(() => void refreshRuntime(), 5000);
    return () => clearInterval(timer);
  }, [status?.unlocked, profiles.length]);
  useEffect(() => {
    if (!notice || busy) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice, busy]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setPalette("");
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const open = () => setAccessibility(true);
    window.addEventListener("settings-accessibility", open);
    return () => window.removeEventListener("settings-accessibility", open);
  }, []);
  const importWording = async (file: File) => {
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > 262144) throw Error();
      const parsed = parseVocabulary(await file.text());
      localStorage.setItem("wording", JSON.stringify(parsed));
      setEntries(parsed.entries);
      setCelebration(parsed.entries["private vocabulary"] || t("Personal wording applied"));
      setTimeout(() => setCelebration(""), 3000);
    } catch {
      setNotice(t("Invalid personal wording file"));
      void settings.notify(t("Invalid personal wording file"), "error");
    }
  };
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length === 1) void importWording(e.dataTransfer.files[0]);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [prefs.language]);

  const navigate = useCallback((next: Page, options: { profile?: string; section?: string; setting?: string } = {}) => {
    setShowSetup(false);
    if (next !== "settings" || !options.setting) setActiveTab("");
    if (options.profile) {
      if (next === "launch") setLaunchTarget(options.profile);
      else setSelected(options.profile);
    }
    if (options.section) {
      setSettingsSection(options.section);
      void settings.selectSection(options.section);
    }
    if (options.setting) setTimeout(() => window.dispatchEvent(new CustomEvent("settings-reveal", { detail: options.setting })), 0);
    setPage(next);
    requestAnimationFrame(() => document.getElementById("workspace-content")?.focus({ preventScroll: true }));
  }, [settings.selectSection]);
  const requireUnlock = useCallback((id: string, then: () => void) => {
    if (!locks.locks[id] || openLocks.current.has(id)) then();
    else setUnlocking({ id, then });
  }, [locks.locks]);
  const snack = useCallback((message: string, action?: { label: string; run: () => void }) => setSnackbar({ id: Date.now(), message, action }), []);
  const unread = settings.record.notices.filter((n) => !n.dismissed).length;
  const value: AppContextValue = {
    t, prefs, settings, narrator, displayName: displayName || "", status, profiles, runtimes, selected, setSelected, page, navigate, launchTarget,
    refresh, refreshRuntime, perform, operations: operations.current, pending, busy, conflicts, loadConflicts,
    openCreate: () => setCreating(true), openPalette: (q = "") => setPalette(q), locks, requireUnlock, snack, now,
  };
  const openTab = (tab: WorkspaceTab) => {
    if (!tabs.some((x) => x.id === tab.id) && !tab.id.startsWith("page:profiles")) setTabs((all) => [...all, tab]);
    setActiveTab(tab.id.startsWith("page:profiles") ? "" : tab.id);
    navigate(tab.page as Page, { section: tab.section, setting: tab.setting });
    if (tab.setting || tab.section) setActiveTab(tab.id);
  };
  const vaultScreen = !status?.unlocked;
  const setupScreen = status?.unlocked && (showSetup || (!setupDone && profiles.length === 0));
  const fab: [string, string, () => void] =
    page === "super-profiles"
      ? ["library_add", t("New template"), () => window.dispatchEvent(new Event("super-profiles-create"))]
      : page === "sync"
        ? ["sync", t("Sync now"), () => window.dispatchEvent(new Event("sync-now"))]
        : page === "servers"
          ? ["add", t("New server"), () => window.dispatchEvent(new Event("servers-create"))]
        : ["person_add", t("Create profile"), () => setCreating(true)];
  return (
    <Provider value={value}>
      <div className="m3 win">
        <TitleBar minimal={vaultScreen} onNotifications={() => setNotifications(!notifications)} unread={unread} onAccessibility={() => setAccessibility(true)} />
        {vaultScreen || setupScreen ? (
          <main id="workspace-content" tabIndex={-1} className="scroll" style={{ flex: 1, padding: "24px 16px 40px", display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", alignContent: "flex-start", outline: "none" }}>
            {vaultScreen && <VaultUnlock />}
            {(!setupDone || setupScreen) && (
              <FirstRun
                step={setupStep}
                setStep={setSetupStep}
                onFinish={() => {
                  setSetupDone(true);
                  setShowSetup(false);
                  navigate("profiles");
                }}
              />
            )}
          </main>
        ) : (
          <div className="body">
            <Rail fabIcon={fab[0]} fabLabel={fab[1]} onFab={fab[2]} />
            <div className="panes">
              {page === "profiles" && <TabsPane
                tabs={tabs}
                setTabs={setTabs}
                active={activeTab}
                dock={dock}
                setDock={setDock}
                onNew={() => setPalette("")}
                onSelect={(tab) => {
                  if (!tab.id) return setActiveTab("");
                  setActiveTab(tab.id);
                  navigate(tab.page as Page, { section: tab.section, setting: tab.setting });
                  setActiveTab(tab.id);
                }}
              />}
              <main id="workspace-content" tabIndex={-1} style={{ display: "contents" }}>
                {page === "profiles" && <ProfilesPage />}
                {page === "launch" && <LaunchPage />}
                {page === "super-profiles" && <SuperProfilesPage />}
                {page === "sync" && <SyncPage />}
                {page === "servers" && <ServersPage />}
                {page === "models" && <OllamaPage />}
                {page === "tools" && <ToolboxPage />}
                {page === "settings" && (
                  <SettingsPage
                    section={settingsSection}
                    onSection={(id) => {
                      setSettingsSection(id);
                      void settings.selectSection(id);
                    }}
                    wordingLoaded={Object.keys(entries).length > 0}
                    onWordingFile={(file) => void importWording(file)}
                    onClearWording={() => {
                      localStorage.removeItem("wording");
                      setEntries({});
                    }}
                    onSetup={() => {
                      setSetupStep(1);
                      setShowSetup(true);
                    }}
                    onTickets={() => setTickets(true)}
                  />
                )}
              </main>
            </div>
          </div>
        )}
        <StatusBar notice={notice} />
        {notifications && <NotificationsPanel onClose={() => setNotifications(false)} onOpenAll={() => navigate("settings", { section: "notifications" })} />}
        <LiveLayer snackbar={snackbar} clearSnack={() => setSnackbar(null)} />
        <AttentionBar />
        {accessibility && <AccessibilityPanel onClose={() => setAccessibility(false)} />}
        {creating && <CreateProfileDialog onClose={() => setCreating(false)} onCreated={(id) => { setSelected(id); if (setupScreen) { setSetupDone(true); setShowSetup(false); } }} />}
        {palette !== null && (
          <Palette
            initial={palette}
            onClose={() => setPalette(null)}
            onOpenTab={openTab}
            onAction={(action) => {
              if (action === "create") setCreating(true);
              else if (action === "setup") { setSetupStep(1); setShowSetup(true); }
              else if (action === "tickets") setTickets(true);
              else if (action === "accessibility") setAccessibility(true);
              else if (action === "notifications") setNotifications(true);
            }}
          />
        )}
        {unlocking && (
          <UnlockDialog
            id={unlocking.id}
            onClose={() => setUnlocking(null)}
            onOpen={() => {
              openLocks.current.add(unlocking.id);
              const then = unlocking.then;
              setUnlocking(null);
              then();
            }}
          />
        )}
        {tickets && <SupportTickets onClose={() => setTickets(false)} />}
        {celebration && (
          <div className="m3-celebrate" role="status" aria-live="polite">
            <div className="display-s em">{celebration}</div>
          </div>
        )}
      </div>
    </Provider>
  );
}
