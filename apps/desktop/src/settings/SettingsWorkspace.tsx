import React, { useState, useEffect } from "react";
import { Button, Tabs } from "../components";
import { Search } from "../Search";
import { definitions, categories } from "./model.mjs";
import { SettingControl } from "./SettingControl";
import { revealSettingKeys } from "./interaction-model.mjs";
import { SettingsTabs } from "./SettingsTabs";
import { Schedules } from "./sections/Schedules";
import { HistoryTransfer } from "./sections/HistoryTransfer";
import { NotificationCenter } from "./sections/NotificationCenter";
import { EditorIntegration } from "./sections/EditorIntegration";
import type { SettingsController } from "./store";
const unavailable = [
  [
    "privacy",
    "Shared restricted-presentation mode",
    "The shared operating-system record and independent credential service are not connected. A per-application switch would not provide shared behavior.",
  ],
  [
    "privacy",
    "Element locks",
    "Six independent credential policies, protected verification and exact action interception are not implemented. No lock is implied by the vault lock.",
  ],
  [
    "privacy",
    "Authenticator",
    "Protected entry storage, local QR registration and standards-vector acceptance are not yet connected. No credential input is collected here.",
  ],
  [
    "privacy",
    "Protected native history",
    "The isolated encrypted Git history and independent access factor are not connected. The local preference revision list is not that service.",
  ],
  [
    "tools",
    "File converter",
    "Packaged offline conversion adapters and output validators are missing. No format is offered as working without its adapter.",
  ],
  [
    "tools",
    "Local model manager",
    "Managed installation, verified catalogue and process lifecycle services are missing. This desktop does not start a model runtime from a decorative button.",
  ],
  [
    "tools",
    "Game server manager",
    "Version discovery, four execution-target adapters and typed server configuration are missing. No server lifecycle is simulated.",
  ],
  [
    "tools",
    "Automatic updates",
    "A verified accepted release feed and installed-update service are not configured. No update is reported available or installed.",
  ],
  [
    "tools",
    "Status service",
    "No authenticated service registration or status adapter is connected. Local UI actions are not remote delivery proof.",
  ],
  [
    "appearance",
    "Advanced element appearance",
    "The complete layered typography, image, state and motion editor remains unfinished. Global appearance values do not substitute for it.",
  ],
];
export function SettingsWorkspace({
  controller: c,
  t,
  narrator,
  wordingLoaded,
  onWordingFile,
  onClearWording,
}: {
  controller: SettingsController;
  t: (s: string) => string;
  narrator: any;
  wordingLoaded: boolean;
  onWordingFile: (f: File) => void;
  onClearWording: () => void;
}) {
  const [matches, setMatches] = useState<string[]>([]),
    [globalMatches, setGlobalMatches] = useState<number[]>([]),
    [capRows, setCapRows] = useState<number[]>([]),
    [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [fonts, setFonts] = useState<
    Array<{ id: string; family: string; style: string }>
  >([]);
  const [fontStatus, setFontStatus] = useState("Loading installed fonts");
  useEffect(() => {
    let active = true;
    window.materialBrowser
      ?.settingsService("fonts")
      .then((result) => {
        if (!active) return;
        if (result?.ok) {
          setFonts(result.fonts);
          setFontStatus("Installed fonts loaded");
        } else
          setFontStatus(
            result?.error?.message || "Installed fonts are unavailable.",
          );
      })
      .catch(() => {
        if (active) setFontStatus("Installed fonts are unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  const fontOptions: [string, string][] = [
    ["system", t("System interface")],
    ["sans-serif", t("Generic sans-serif")],
    ["serif", t("Generic serif")],
    ["monospace", t("Generic monospace")],
    ...[...new Set(fonts.map((f) => f.family))].map(
      (f) => [f, f] as [string, string],
    ),
  ];
  if (!fontOptions.some(([id]) => id === c.record.preferences.fontFamily))
    fontOptions.push([
      c.record.preferences.fontFamily,
      c.record.preferences.fontFamily + " (unavailable)",
    ]);
  const section = c.record.section;
  const local = definitions.filter((d) => d.category === section);
  const caps = unavailable.filter((r) => r[0] === section);
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail;
      const d = definitions.find((x) => x.key === key);
      if (d) {
        setRevealedKey(key);
        c.selectSection(d.category);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const el = document.querySelector<HTMLElement>(
              `.settings-workspace [data-setting-id="${key}"]`,
            );
            el?.scrollIntoView({ block: "center", behavior: "auto" });
            el?.focus();
            el?.classList.add("setting-highlight");
            setTimeout(() => el?.classList.remove("setting-highlight"), 1600);
          }),
        );
      }
    };
    window.addEventListener("settings-reveal", handler);
    return () => window.removeEventListener("settings-reveal", handler);
  }, [c]);
  const voiceOptions = (lang: string) => {
    const result =
      lang === "voiceEnglish" ? narrator.english : narrator.cantonese;
    const selected = c.record.preferences[lang];
    return [
      ["", t("Choose automatically")],
      ...result.available.map((v: SpeechSynthesisVoice) => [
        v.voiceURI,
        `${v.name} (${v.lang})${v.localService ? "" : " · network"}`,
      ]),
      ...(result.missing
        ? [
            [
              selected,
              t("Selected voice is unavailable; automatic fallback is active."),
            ],
          ]
        : []),
    ] as [string, string][];
  };
  return (
    <div className="settings-workspace">
      <div className="page-heading">
        <h1>{t("Settings")}</h1>
        <p>{t("Settings are saved on this device.")}</p>
      </div>
      {c.storageError && (
        <div className="banner" role="alert">
          <h2>{t("Save rejected")}</h2>
          <p>{t(c.storageError)}</p>
        </div>
      )}
      <details className="settings-global-finder">
        <summary>{t("Search all settings")}</summary>
        <Search
          label={t("Search settings")}
          items={definitions.map(
            (d) =>
              `${t(d.label)} ${t(d.help)} ${String(c.record.preferences[d.key])}`,
          )}
          onResults={setGlobalMatches}
          t={t}
        />
        <div className="finder-results">
          {globalMatches.map((i) => {
            const d = definitions[i];
            return (
              <Button
                secondary
                key={d.key}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("settings-reveal", { detail: d.key }),
                  )
                }
              >
                {t(d.label)} ·{" "}
                {t(categories.find((x) => x[0] === d.category)![1])} ·{" "}
                {String(c.record.preferences[d.key])}
              </Button>
            );
          })}
        </div>
      </details>
      <SettingsTabs value={section} onChange={c.selectSection} t={t}>
        <section
          role="tabpanel"
          id={`panel-${section}`}
          aria-label={t(
            categories.find((x) => x[0] === section)?.[1] || "Settings",
          )}
        >
          <Search
            key={`section-${section}`}
            label={t("Search this section")}
            items={local.map(
              (d) =>
                `${t(d.label)} ${t(d.help)} ${String(c.record.preferences[d.key])}`,
            )}
            itemKeys={local.map((d) => d.key)}
            onKeys={setMatches}
            t={t}
          />
          {local.length > 0 && !matches.length && (
            <p role="status">{t("No matching settings")}</p>
          )}
          {revealedKey &&
            !matches.includes(revealedKey) &&
            local.some((d) => d.key === revealedKey) && (
              <p role="status">
                {t(
                  "The requested setting is shown outside the current filter.",
                )}{" "}
                <Button secondary onClick={() => setRevealedKey(null)}>
                  {t("Clear reveal")}
                </Button>
              </p>
            )}
          <div className="settings-control-grid">
            {revealSettingKeys(matches, local, revealedKey)
              .map((key: string) => local.find((d) => d.key === key))
              .filter((d): d is NonNullable<typeof d> => d !== undefined)
              .map((d) => (
                <SettingControl
                  key={d.key}
                  definition={d}
                  controller={c}
                  t={t}
                  voices={
                    d.type === "voice"
                      ? voiceOptions(d.key)
                      : d.type === "font"
                        ? fontOptions
                        : undefined
                  }
                />
              ))}
          </div>
          {section === "appearance" && (
            <p role="status">
              {t(fontStatus)} ·{" "}
              {[...new Set(fonts.map((f) => f.family))].length}{" "}
              {t("font families")}
            </p>
          )}
          {section === "tools" && <EditorIntegration controller={c} t={t} />}
          {section === "language" && (
            <>
              <section className="setting-card">
                <h2>{t("Narration")}</h2>
                {narrator.speechStatus && (
                  <p role="status">{t(narrator.speechStatus)}</p>
                )}
                {!narrator.supported ? (
                  <p>
                    {t("Speech synthesis is unavailable on this platform.")}
                  </p>
                ) : (
                  <>
                    {[
                      ["English", narrator.english],
                      ["廣東話", narrator.cantonese],
                    ].map(([label, result]: any) => (
                      <p key={label}>
                        {label} · {t("Current voice")}:{" "}
                        {result.voice?.name ||
                          t("No supported voice is installed.")}
                        {result.missing &&
                          " · " +
                            t(
                              "Selected voice is unavailable; automatic fallback is active.",
                            )}
                        {result.voice &&
                          !result.voice.localService &&
                          " · " +
                            t(
                              "Network-backed voice may be unavailable offline.",
                            )}
                      </p>
                    ))}
                    <div className="actions">
                      <Button
                        disabled={
                          !narrator.english.voice && !narrator.cantonese.voice
                        }
                        onClick={() =>
                          narrator.speak(
                            "This is a synthetic voice sample. No personal record is read.",
                            "這是合成語音例子，沒有讀取個人資料。",
                            "info",
                            true,
                          )
                        }
                      >
                        {t("Sample voice")}
                      </Button>
                      <Button secondary onClick={narrator.pause}>
                        {t("Pause speech")}
                      </Button>
                      <Button secondary onClick={narrator.resume}>
                        {t("Resume speech")}
                      </Button>
                      <Button secondary onClick={narrator.stop}>
                        {t("Stop speech")}
                      </Button>
                    </div>
                  </>
                )}
              </section>
              <section className="setting-card" id="setting-personal-wording">
                <h2>{t("Personal wording")}</h2>
                <p>
                  {t(
                    wordingLoaded
                      ? "Personal wording loaded"
                      : "No personal wording loaded",
                  )}
                </p>
                <label className="file-control">
                  {t(wordingLoaded ? "Replace" : "Upload")}
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onWordingFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button secondary onClick={onClearWording}>
                  {t("Clear")}
                </Button>
                <p>{t("Personal wording and credentials are excluded.")}</p>
              </section>
            </>
          )}
          {section === "accessibility" && (
            <section className="setting-card">
              <h2>{t("Keyboard help")}</h2>
              <p>
                {t(
                  "Tab moves focus. Enter or Space activates. Escape closes an open panel. Ctrl+Shift+F opens commands.",
                )}
              </p>
              <Button
                secondary
                onClick={() =>
                  window.dispatchEvent(new Event("settings-accessibility"))
                }
              >
                {t("Accessibility")}
              </Button>
            </section>
          )}
          {section === "notifications" && (
            <NotificationCenter controller={c} t={t} />
          )}
          {section === "schedules" && <Schedules controller={c} t={t} />}
          {section === "history" && <HistoryTransfer controller={c} t={t} />}
          {caps.length > 0 && (
            <section className="setting-card">
              <h2>{t("Incomplete capability")}</h2>
              <Search
                label={t("Search capabilities")}
                items={caps.map((x) => x[1] + " " + x[2])}
                onResults={setCapRows}
                t={t}
              />
              {capRows
                .map((i) => caps[i])
                .filter(Boolean)
                .map((r) => (
                  <article className="settings-record" key={r[1]}>
                    <h3>{t(r[1])}</h3>
                    <p>{t(r[2])}</p>
                  </article>
                ))}
              <p>
                {t(
                  "No working control is claimed until its service is implemented and verified.",
                )}
              </p>
            </section>
          )}
          {section === "about" && (
            <section className="setting-card">
              <h2>Material Browser</h2>
              <p>
                {t("Version")}: 0.1.0 · {t("Updated")}: {t("Unavailable")}
              </p>
              <p>
                {t(
                  "Runtime evidence remains incomplete for the new Settings workspace.",
                )}
              </p>
              <p>
                {t(
                  "These local controls do not complete advanced appearance, regex parity, shared credentials, external services or the full layout matrix.",
                )}
              </p>
            </section>
          )}
        </section>
      </SettingsTabs>
    </div>
  );
}
