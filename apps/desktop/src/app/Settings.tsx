import React, { useEffect, useMemo, useState } from "react";
import { request, type PasswordManagerDetection } from "../api";
import { definitions, categories } from "../settings/model.mjs";
import { SettingControl } from "../settings/SettingControl";
import { Schedules } from "../settings/sections/Schedules";
import { HistoryTransfer } from "../settings/sections/HistoryTransfer";
import { NotificationCenter } from "../settings/sections/NotificationCenter";
import { EditorIntegration } from "../settings/sections/EditorIntegration";
import { Btn, ButtonGroup, IconBtn, Item, Ms, SegList, Switch, Dropdown, cx } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp } from "./context";
import { APP_VERSION } from "../build-version";
import { updatedLabel } from "./Shell";
import { readManagerDefaults, writeManagerDefaults } from "./manager-defaults";
import { databaseBasename, recommendedSource } from "../password-manager-model.mjs";
import { LockDialog, SupportTickets } from "./Safety";
import { METHODS } from "./locks-model.mjs";
import { codeName } from "./codename";
import { ConfirmAction } from "../settings/ConfirmAction";
import "../settings/settings-m3.css";

type Section = { id: string; label: string; icon: string; groups: { label: string; keys?: string[]; render?: () => React.ReactNode; note?: string }[]; subtitle?: string };
const ORDER = [
  ["language", "Language and voice", "translate"],
  ["appearance", "Appearance", "palette"],
  ["accessibility", "Accessibility and focus", "accessibility_new"],
  ["passwords", "Passwords and passkeys", "key"],
  ["notifications", "Notifications", "notifications"],
  ["schedules", "Schedules", "event_repeat"],
  ["school", "School mode", "school"],
  ["locks", "Locks and authenticator", "lock"],
  ["history", "History and transfer", "history"],
  ["tools", "Tools and integrations", "extension"],
  ["about", "About", "info"],
] as const;
const SECTION_OF: Record<string, string> = { focus: "accessibility", privacy: "locks" };

export function SettingsPage({
  section: sectionProp,
  onSection,
  wordingLoaded,
  onWordingFile,
  onClearWording,
  onSetup,
  onTickets,
}: {
  section: string;
  onSection: (id: string) => void;
  wordingLoaded: boolean;
  onWordingFile: (f: File) => void;
  onClearWording: () => void;
  onSetup: () => void;
  onTickets: () => void;
}) {
  const app = useApp();
  const { t, settings: c, narrator, displayName, locks, requireUnlock } = app;
  const select = onSection;
  const raw = sectionProp;
  const section = ORDER.some(([id]) => id === raw) ? raw : SECTION_OF[raw] || "language";
  const [fonts, setFonts] = useState<{ family: string }[]>([]);
  const [resetting, setResetting] = useState(false);
  const search = useSearch(definitions.map((d: any) => `${t(d.label)} ${t(d.help)}`));
  const unread = c.record.notices.filter((n) => !n.dismissed).length;
  useEffect(() => {
    window.materialBrowser?.settingsService("fonts").then((r) => r?.ok && setFonts(r.fonts)).catch(() => {});
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail;
      const d = (definitions as any[]).find((x) => x.key === key);
      if (!d) return;
      search.setQuery("");
      select(SECTION_OF[d.category] || d.category);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`[data-setting-id="${key}"]`);
          el?.scrollIntoView({ block: "center" });
          el?.focus();
          el?.classList.add("setting-highlight");
          setTimeout(() => el?.classList.remove("setting-highlight"), 1600);
        }),
      );
    };
    window.addEventListener("settings-reveal", handler);
    return () => window.removeEventListener("settings-reveal", handler);
  }, [c]);
  const fontOptions: [string, string][] = [
    ["system", t("System interface")],
    ["sans-serif", t("Generic sans-serif")],
    ["serif", t("Generic serif")],
    ["monospace", t("Generic monospace")],
    ...[...new Set(["Roboto Flex", "Roboto", "Roboto Mono", "Noto Sans HK Variable", ...fonts.map((f) => f.family)])].map((f) => [f, f] as [string, string]),
  ];
  const voiceOptions = (key: string) => {
    const result = key === "voiceEnglish" ? narrator.english : narrator.cantonese;
    return [["", t("System default")], ...(result?.available || []).map((v: SpeechSynthesisVoice) => [v.voiceURI, `${v.name} (${v.lang})`])] as [string, string][];
  };
  const row = (key: string) => {
    const d = (definitions as any[]).find((x) => x.key === key);
    if (!d) return null;
    return <SettingControl key={key} definition={d} controller={c} t={t} voices={d.type === "voice" ? voiceOptions(key) : d.type === "font" ? fontOptions : undefined} />;
  };
  const sections: Record<string, Section> = {
    language: {
      id: "language", label: "Language and voice", icon: "translate",
      groups: [
        { label: "Language", keys: ["language", "funnyEnglish", "funnyCantonese", "dialogEmoji"], render: () => (
          <>
            <Item icon="badge" title={t("Application name")} support={t("Your chosen name appears everywhere")}
              trailing={<Btn variant="text" trailingIcon="edit" onClick={() => app.navigate("settings", { section: "history" })}>{displayName || "Material Browser"}</Btn>} />
            <div className="li" style={{ flexWrap: "wrap" }}>
              <Ms name="dictionary" />
              <div className="txt"><span>{t("Personal wording")}</span><span className="sup">{t(wordingLoaded ? "Loaded on this computer" : "Drop a wording file anywhere, or upload one")}</span></div>
              <label className="btn text sl" style={{ cursor: "pointer" }}>
                <Ms name="upload_file" />{t(wordingLoaded ? "Replace" : "Upload")}
                <input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onWordingFile(f); e.target.value = ""; }} />
              </label>
              {wordingLoaded && <IconBtn icon="delete" label={t("Clear personal wording")} onClick={onClearWording} />}
            </div>
          </>
        ) },
        { label: "Voice and sound", keys: ["narration", "narratorLanguage", "voiceEnglish", "voiceCantonese", "speechRate", "speechPitch", "screenReaderMode"], render: () => (
          <div className="li" style={{ flexWrap: "wrap" }}>
            <Ms name="campaign" />
            <div className="txt"><span>{t("Voice sample")}</span><span className="sup">{t(narrator.speechStatus || (narrator.supported ? "Reads a short synthetic sentence" : "Speech is unavailable on this computer"))}</span></div>
            <IconBtn icon="play_circle" label={t("Sample voice")} disabled={!narrator.supported} onClick={() => narrator.speak("This is a synthetic voice sample.", "這是合成語音例子。", "info", true)} />
            <IconBtn icon="stop_circle" label={t("Stop speech")} disabled={!narrator.supported} onClick={narrator.stop} />
          </div>
        ) },
      ],
    },
    appearance: { id: "appearance", label: "Appearance", icon: "palette", groups: [
      { label: "Theme", keys: ["theme", "accent", "density", "motion"] },
      { label: "Type and brand", keys: ["fontFamily", "fontScale", "fontWeight", "logoPreset", "paletteSize"] },
    ] },
    accessibility: { id: "accessibility", label: "Accessibility and focus", icon: "accessibility_new", groups: [
      { label: "Accessibility", keys: ["accessibilityVisible", "textScale", "highContrast", "strongFocus", "largeTargets"], render: () => (
        <Item icon="keyboard" title={t("Keyboard help")} support={t("Tab moves focus. Enter or Space activates. Escape closes.")}
          trailing={<Btn variant="text" onClick={() => window.dispatchEvent(new Event("settings-accessibility"))}>{t("Open tools")}</Btn>} />
      ) },
      { label: "Focus modes", keys: ["focus", "lowStimulation", "timeAwareness", "oneThing", "nextAction", "momentum", "idleMinutes", "snoozeMinutes"], note: "Each mode works on its own. None is a medical tool." },
    ] },
    passwords: { id: "passwords", label: "Passwords and passkeys", icon: "key", subtitle: "Defaults offered when you create a profile. Each profile keeps its own pairing.", groups: [
      { label: "Passwords and passkeys", render: () => <PasswordDefaults /> },
    ] },
    notifications: { id: "notifications", label: "Notifications", icon: "notifications", groups: [
      { label: "Sound", keys: ["actionSounds", "actionSoundVolume"], render: () => (
        <Item icon="play_circle" title={t("Preview action sound")} support={t("Silent means sounds are muted or audio is unavailable")}
          trailing={<IconBtn icon="play_arrow" label={t("Preview action sound")} onClick={() => void c.previewSound()} />} />
      ) },
      { label: "Toasts and quiet hours", keys: ["toastSeconds", "quietEnabled", "quietStart", "quietEnd"] },
      { label: "Notification list", render: () => <div className="li" style={{ display: "block", padding: 16 }}><NotificationCenter controller={c} t={t} /></div> },
    ] },
    schedules: { id: "schedules", label: "Schedules", icon: "event_repeat", groups: [{ label: "Scheduled settings", render: () => <div className="li" style={{ display: "block", padding: 16 }}><Schedules controller={c} t={t} /></div> }] },
    school: { id: "school", label: "School mode", icon: "school", groups: [{ label: "School mode", render: () => <SchoolMode /> }] },
    locks: { id: "locks", label: "Locks and authenticator", icon: "lock", subtitle: "Just for fun, never security. The vault is what protects your data.", groups: [{ label: "Element locks", render: () => <LocksSection onTickets={onTickets} /> }] },
    history: { id: "history", label: "History and transfer", icon: "history", groups: [{ label: "Local history", render: () => <div className="li" style={{ display: "block", padding: 16 }}><HistoryTransfer controller={c} t={t} /></div> }] },
    tools: { id: "tools", label: "Tools and integrations", icon: "extension", groups: [
      { label: "Editors", render: () => <div className="li" style={{ display: "block", padding: 16 }}><EditorIntegration controller={c} t={t} /></div> },
      { label: "Not available yet", render: () => (
        <>
          {[
            ["transform", "File converter", "Offline conversion adapters are not bundled yet."],
            ["neurology", "Local model manager", "No verified model catalogue or runtime is connected."],
            ["sports_esports", "Game server manager", "Server lifecycle adapters are not built yet."],
            ["system_update", "Automatic updates", "No verified release feed is configured. Updates come from new installers."],
            ["monitor_heart", "Status service", "No status service is registered."],
          ].map(([icon, title, support]) => <Item key={title} icon={icon} title={t(title)} support={t(support)} trailing={<span className="trail">{t("Not yet")}</span>} />)}
        </>
      ) },
    ] },
    about: { id: "about", label: "About", icon: "info", groups: [{ label: "Material Browser", render: () => (
      <>
        <Item icon="shield_lock" overline={t("Version")} title={`${APP_VERSION} · ${codeName(APP_VERSION)}`} support={updatedLabel(t)} />
        <Item icon="badge" overline={t("Name on this computer")} title={displayName || "Material Browser"} />
        <Item icon="flag" title={t("Run the four setup steps again")} trailing={<Btn variant="text" onClick={onSetup}>{t("Setup")}</Btn>} />
        <Item icon="volunteer_activism" overline={t("Price")} title={t("Free. No payments, ads or upgrade prompts.")} />
        <Item icon="description" overline={t("Licence")} title="MIT" />
      </>
    ) }] },
  };
  const current = sections[section];
  const filtering = search.query.trim().length > 0;
  const hits = useMemo(() => search.indices.map((i) => (definitions as any[])[i]).filter(Boolean), [search.indices]);
  const keysOf = (s: Section) => s.groups.flatMap((g) => g.keys || []);
  return (
    <>
      <nav className="pane scroll hide-s" aria-label={t("Settings sections")} style={{ width: 300, flexShrink: 0, padding: "28px 12px 16px", display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start", maxHeight: "100%" }}>
        <h1 className="headline-s em" style={{ padding: "0 16px" }}>{t("Settings")}</h1>
        <SearchBar label={t("Search settings")} {...search} t={t} />
        <div className="nd" style={{ marginTop: 4 }}>
          {ORDER.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={cx("ndi sl", !filtering && section === id && "on")}
              aria-current={!filtering && section === id ? "page" : undefined}
              onClick={() => {
                search.setQuery("");
                const go = () => select(id);
                if (locks.locks[`settings:${id}`]) requireUnlock(`settings:${id}`, go);
                else go();
              }}
            >
              <Ms name={icon} />
              <span className="lbl">{t(label)}</span>
              {id === "notifications" && unread > 0 && <span className="tr">{unread}</span>}
              {locks.locks[`settings:${id}`] && <Ms name="lock" size={18} label={t("Locked")} />}
            </button>
          ))}
        </div>
      </nav>
      <section className="pane scroll" aria-labelledby="settings-h" style={{ flex: 1, padding: "28px 32px 32px", display: "flex", flexDirection: "column", gap: 20, ["--tf-bg" as string]: "var(--surface-container)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 id="settings-h" className="headline-m em">{filtering ? `${t("Search results")} · ${hits.length}` : t(current.label)}</h2>
            <p className="body-m on-sv" role="status">
              {c.storageError
                ? t("Preference storage needs attention")
                : !c.storageReady
                  ? t("Loading saved preferences")
                  : c.saving
                    ? t("Saving preferences")
                    : t(current.subtitle || "Saved on this computer. Every change appears in local history.")}
            </p>
          </div>
          {!filtering && keysOf(current).length > 0 && <Btn variant="outlined" icon="restart_alt" onClick={() => setResetting(true)}>{t("Reset section")}</Btn>}
        </div>
        <div className="compact-back" style={{ flexWrap: "wrap", gap: 8 }}>
          <Dropdown label={t("Section")} value={section} onChange={(id) => select(id)} options={ORDER.map(([id, label]) => [id, t(label)] as [string, string])} />
        </div>
        {c.storageError && (
          <div className="card tint-e" role="alert" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12, alignItems: "center" }}>
            <Ms name="error" /><p className="body-m" style={{ flex: 1 }}>{t(c.storageError)}</p>
            <Btn variant="text" onClick={() => void c.reloadSaved()}>{t("Reload saved preferences")}</Btn>
          </div>
        )}
        {filtering ? (
          hits.length ? <div className="seglist">{hits.map((d: any) => row(d.key))}</div> : <p className="body-m on-sv">{t("No matching settings")}</p>
        ) : (
          <div className="settings-grid">
            {current.groups.map((group) => (
              <section key={group.label} aria-label={t(group.label)} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <h3 className="ov-label">{t(group.label)}</h3>
                <div className="seglist">
                  {(group.keys || []).map(row)}
                  {group.render?.()}
                </div>
                {group.note && <p className="body-s on-sv" style={{ padding: "8px 16px" }}>{t(group.note)}</p>}
              </section>
            ))}
          </div>
        )}
      </section>
      {resetting && (
        <ConfirmAction
          title={`${t("Reset")} ${t(current.label)}?`}
          icon="restart_alt"
          confirmLabel="Reset"
          description={t("Every setting in this section returns to its default. The change appears in local history and can be undone there.")}
          t={t}
          onCancel={() => setResetting(false)}
          onConfirm={async () => {
            const keys = keysOf(current);
            const result = await c.transact(
              `Reset ${current.label}`,
              { ...c.record.preferences, ...Object.fromEntries(keys.map((k) => [k, (definitions as any[]).find((d) => d.key === k)?.initial])) },
              undefined,
              keys,
            );
            if (result?.ok !== false) setResetting(false);
            return result?.ok === false ? result : { ok: true };
          }}
        />
      )}
    </>
  );
}

function PasswordDefaults() {
  const { t } = useApp();
  const [form, setForm] = useState(readManagerDefaults());
  const [detection, setDetection] = useState<PasswordManagerDetection | null>(null);
  useEffect(() => {
    request("passwordManager.detect").then(setDetection).catch(() => setDetection(null));
  }, []);
  const update = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch };
    setForm(next);
    writeManagerDefaults(next);
  };
  const found = detection ? recommendedSource(detection) : "none";
  return (
    <>
      <Item icon="key" title="KeePassXC"
        support={t(!detection ? "Checking this computer…" : detection.installed ? "Found on this computer" : detection.wslDistributions?.length ? "Available inside WSL" : "Not found on this computer")}
        trailing={<ButtonGroup label={t("KeePassXC source")} value={form.source} onChange={(source) => update({ source })} options={[["installed", t("Installed")], ["wsl", "WSL"]]} />} />
      <Item icon="link" title={t("Offer pairing for new profiles")} support={t(found === "none" ? "Install KeePassXC first, or skip this" : "New profiles start with pairing switched on")}
        trailing={<Switch label={t("Offer pairing for new profiles")} checked={form.enabled} onChange={(enabled) => update({ enabled })} />} />
      <Item icon="database" title={t("Database")} mono={!!form.databasePath} support={form.databasePath ? databaseBasename(form.databasePath) : t("Chosen per profile")}
        trailing={<Btn variant="text" onClick={() => void window.materialBrowser?.chooseDatabaseFile().then((p) => p && update({ databasePath: p }))}>{t("Change")}</Btn>} />
      <Item icon="extension" title={t("Browser extension")} support={t("Fills passwords inside each profile")}
        trailing={<Switch label={t("Browser extension")} checked={form.extension} onChange={(extension) => update({ extension })} />} />
      <Item icon="passkey" title={t("Passkeys")} support={t("Stored in KeePassXC, not in the browser")}
        trailing={<Switch label={t("Passkeys")} checked={form.passkeys} onChange={(passkeys) => update({ passkeys })} />} />
    </>
  );
}

const SCHOOL_KEY = "school-mode.v1";
export function schoolModeOn() {
  try {
    return JSON.parse(localStorage.getItem(SCHOOL_KEY) || "null")?.on === true;
  } catch {
    return false;
  }
}

function SchoolMode() {
  const { t, settings: c, snack, locks } = useApp();
  const [on, setOn] = useState(schoolModeOn());
  const [locking, setLocking] = useState(false);
  const toggle = async (next: boolean) => {
    if (next) {
      const saved = { funnyEnglish: c.preferences.funnyEnglish, funnyCantonese: c.preferences.funnyCantonese, dialogEmoji: c.preferences.dialogEmoji };
      localStorage.setItem(SCHOOL_KEY, JSON.stringify({ on: true, saved }));
      await c.transact("Turned on school mode", { ...c.record.preferences, funnyEnglish: 1, funnyCantonese: 1, dialogEmoji: false }, undefined, ["funnyEnglish", "funnyCantonese", "dialogEmoji"]);
    } else {
      let saved: any = {};
      try {
        saved = JSON.parse(localStorage.getItem(SCHOOL_KEY) || "{}").saved || {};
      } catch {}
      localStorage.removeItem(SCHOOL_KEY);
      await c.transact("Turned off school mode", { ...c.record.preferences, ...saved }, undefined, Object.keys(saved));
    }
    setOn(next);
    snack(t(next ? "School mode on" : "School mode off"));
  };
  return (
    <>
      <Item icon="school" title={t("School mode")} support={t("Plain, serious wording; no emoji or dim sum surprises")}
        trailing={<Switch label={t("School mode")} checked={on} onChange={(v) => (locks.locks["settings:school"] && !v ? undefined : void toggle(v))} />} />
      <Item icon="lock" title={t("Keep it on with a lock")} support={t(locks.locks["settings:school"] ? "This section is locked" : "Ask for a PIN or password before this section opens")}
        trailing={!locks.locks["settings:school"] && <Btn variant="text" onClick={() => setLocking(true)}>{t("Lock section")}</Btn>} />
      <Item icon="devices" title={t("This computer only")} support={t("No shared school or family record is connected. Each computer keeps its own choice.")} />
      {locking && <LockDialog target={{ id: "settings:school", label: t("School mode") }} onClose={() => setLocking(false)} />}
    </>
  );
}

function LocksSection({ onTickets }: { onTickets: () => void }) {
  const { t, locks, profiles, requireUnlock, snack } = useApp();
  const [target, setTarget] = useState("");
  const [locking, setLocking] = useState<{ id: string; label: string } | null>(null);
  const label = (id: string) =>
    id.startsWith("settings:") ? `${t("Settings")} · ${t(ORDER.find(([s]) => `settings:${s}` === id)?.[1] || id.slice(9))}` : profiles.find((p) => p.id === id)?.name || locks.locks[id]?.label || id;
  const options: [string, string][] = [
    ...profiles.filter((p) => !locks.locks[p.id]).map((p) => [p.id, `${t("Profile")} · ${p.name}`] as [string, string]),
    ...ORDER.filter(([id]) => !locks.locks[`settings:${id}`] && id !== "locks").map(([id, l]) => [`settings:${id}`, `${t("Settings")} · ${t(l)}`] as [string, string]),
  ];
  const entries = Object.values(locks.locks);
  return (
    <>
      {entries.length === 0 && <Item icon="lock_open" title={t("Nothing is locked")} support={t("Lock a profile or a settings section to ask for a PIN, password or code first.")} />}
      {entries.map((lock) => (
        <Item key={lock.id} icon="lock" title={label(lock.id)} support={t(METHODS.find(([m]) => m === lock.method)?.[1] || lock.method)}
          trailing={<Btn variant="text" onClick={() => requireUnlock(lock.id, () => void locks.save(null, lock.id).then(() => snack(t("Lock removed"))))}>{t("Remove")}</Btn>} />
      ))}
      <div className="li" style={{ flexWrap: "wrap" }}>
        <Ms name="add_moderator" />
        <div className="txt"><span>{t("Lock something")}</span><span className="sup">{t("PIN, password, authenticator code or a mix")}</span></div>
        <div style={{ width: 260 }}>
          <Dropdown label={t("Element")} value={target} onChange={setTarget} options={options.length ? options : [["", t("Nothing left to lock")]]} />
        </div>
        <Btn disabled={!target} onClick={() => setLocking({ id: target, label: options.find(([id]) => id === target)?.[1] || target })}>{t("Lock it")}</Btn>
      </div>
      <Item icon="confirmation_number" title={t("Support Tickets")} support={t("Locked out? The desk of one has an answer.")} trailing={<Btn variant="text" onClick={onTickets}>{t("Open")}</Btn>} />
      {locking && <LockDialog target={locking} onClose={() => { setLocking(null); setTarget(""); }} />}
    </>
  );
}
