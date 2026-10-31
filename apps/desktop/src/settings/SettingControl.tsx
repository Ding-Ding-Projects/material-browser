import React, { useState, useId, useRef, useEffect } from "react";
import { Btn, ButtonGroup, Dropdown, IconBtn, Ms, Slider, Switch, TextField } from "../m3";
import { validateValue } from "./model.mjs";
import { choiceAccessibleName, parseNumericDraft } from "./interaction-model.mjs";
import { preferenceProvenance } from "./record.mjs";
import type { SettingsController } from "./store";

export const SETTING_ICONS: Record<string, string> = {
  language: "translate",
  funnyEnglish: "sentiment_very_satisfied",
  funnyCantonese: "sentiment_satisfied",
  dialogEmoji: "add_reaction",
  narration: "record_voice_over",
  narratorLanguage: "voice_selection",
  voiceEnglish: "graphic_eq",
  voiceCantonese: "graphic_eq",
  speechRate: "speed",
  speechPitch: "tune",
  screenReaderMode: "hearing",
  theme: "dark_mode",
  density: "density_medium",
  accent: "palette",
  fontFamily: "font_download",
  fontScale: "format_size",
  fontWeight: "format_bold",
  motion: "animation",
  logoPreset: "shield_lock",
  accessibilityVisible: "accessibility_new",
  textScale: "text_increase",
  highContrast: "contrast",
  strongFocus: "center_focus_strong",
  largeTargets: "touch_app",
  focus: "center_focus_weak",
  lowStimulation: "do_not_disturb_on",
  timeAwareness: "timer",
  oneThing: "filter_1",
  nextAction: "flag",
  momentum: "trending_up",
  idleMinutes: "hourglass_empty",
  snoozeMinutes: "snooze",
  actionSounds: "music_note",
  actionSoundVolume: "volume_up",
  toastSeconds: "timelapse",
  quietEnabled: "bedtime",
  quietStart: "schedule",
  quietEnd: "alarm",
  paletteSize: "open_in_full",
};

const ACCENTS: [string, string][] = [
  ["#006A6A", "Teal"],
  ["#4B607C", "Slate blue"],
  ["#8F4C38", "Clay"],
  ["#6750A4", "Violet"],
  ["#386A20", "Leaf"],
  ["#984061", "Rose"],
];

/** Picker for a single value. Two to four options become a connected button group. */
export function Choice({
  label,
  value,
  options,
  onChange,
  t,
  previewFont = false,
  showLabel = true,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  t: (s: string) => string;
  previewFont?: boolean;
  showLabel?: boolean;
}) {
  if (options.length >= 2 && options.length <= 4 && !previewFont)
    return <ButtonGroup label={label} value={value} onChange={onChange} options={options} showLabel={showLabel && false} />;
  return (
    <Dropdown
      label={showLabel ? label : t("Choice")}
      ariaLabel={choiceAccessibleName(label, value, options, t("Choose automatically"))}
      value={value}
      onChange={onChange}
      options={options.length ? options : [["", t("Choose automatically")]]}
    />
  );
}

function NumericInput({ definition: d, value, onChange, t }: { definition: any; value: number; onChange: (v: number) => void; t: (s: string) => string }) {
  const current = Number.isFinite(value) ? value : d.initial;
  const decimals = String(d.step).includes(".") ? String(d.step).split(".")[1].length : 0;
  return (
    <Slider
      label={t(d.label)}
      value={current}
      min={d.min}
      max={d.max}
      step={d.step}
      valueText={current.toFixed(decimals)}
      onChange={(v) => onChange(Number(v.toFixed(decimals)))}
    />
  );
}

function DraftField({ definition: d, value, onChange, t }: { definition: any; value: string; onChange: (value: string) => void; t: (s: string) => string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      label={t(d.label)}
      value={draft}
      type={d.type === "time" ? "time" : "text"}
      onChange={(text) => {
        setDraft(text);
        onChange(text);
      }}
    />
  );
}

function AccentInput({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (s: string) => string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div role="radiogroup" aria-label={t("Accent colour")} style={{ display: "flex", gap: 6 }}>
        {ACCENTS.map(([hex, name]) => {
          const on = value.toUpperCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(name)}
              title={t(name)}
              className="sl"
              onClick={() => onChange(hex)}
              style={{ width: 32, height: 32, borderRadius: on ? 10 : 999, border: on ? "3px solid var(--on-surface)" : "0", background: hex, cursor: "pointer" }}
            />
          );
        })}
      </div>
      <div style={{ width: 132 }}>
        <TextField
          label={t("Hex")}
          value={draft}
          mono
          maxLength={7}
          onChange={(text) => {
            setDraft(text);
            if (/^#[\da-f]{6}$/i.test(text)) onChange(text);
          }}
        />
      </div>
    </div>
  );
}

export function SettingInput({
  definition: d,
  value,
  onChange,
  t,
  voices = [],
  compact = false,
}: {
  definition: any;
  value: any;
  onChange: (v: any) => void;
  t: (s: string) => string;
  voices?: [string, string][];
  compact?: boolean;
}) {
  if (d.type === "boolean") return <Switch checked={value === true} onChange={onChange} label={t(d.label)} />;
  if (d.type === "number") return <NumericInput definition={d} value={value} onChange={onChange} t={t} />;
  if (d.type === "select" || d.type === "voice" || d.type === "font")
    return (
      <Choice
        label={t(d.label)}
        value={value}
        showLabel={!compact}
        previewFont={d.type === "font" || d.type === "voice"}
        options={d.type === "voice" || d.type === "font" ? voices : d.options.map(([v, l]: [string, string]) => [v, t(l)])}
        onChange={onChange}
        t={t}
      />
    );
  if (d.type === "color") return <AccentInput value={String(value || "")} onChange={onChange} t={t} />;
  return <DraftField definition={d} value={String(value ?? "")} onChange={onChange} t={t} />;
}

function defaultText(d: any, t: (s: string) => string) {
  if (d.type === "voice" && !d.initial) return t("Choose automatically");
  if (d.type === "boolean") return t(d.initial ? "On" : "Off");
  if (d.options) return t(d.options.find(([v]: [string, string]) => v === d.initial)?.[1] || String(d.initial));
  return String(d.initial);
}

/** One setting as a segmented list item: icon, label, current state, control, help and reset. */
export function SettingControl({
  definition: d,
  controller: c,
  t,
  voices,
}: {
  definition: any;
  controller: SettingsController;
  t: (s: string) => string;
  voices?: [string, string][];
}) {
  const [help, setHelp] = useState(false),
    [sample, setSample] = useState<any>(d.initial),
    [sampleResult, setSampleResult] = useState(""),
    [error, setError] = useState(""),
    [resetVersion, setResetVersion] = useState(0);
  const id = useId();
  const info = useRef<HTMLButtonElement | null>(null);
  const p = preferenceProvenance(c.record, d.key, c.preferences);
  const value = c.record.preferences[d.key];
  const apply = (next: any) => {
    try {
      validateValue(d.key, next);
      if (d.key === "accessibilityVisible" && !next) {
        window.dispatchEvent(new Event("settings-accessibility"));
        return;
      }
      c.update(d.key, next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid value");
    }
  };
  const below = d.type === "number" || d.type === "color" || (d.type === "select" && d.options.length <= 4) || d.type === "text" || d.type === "time";
  const current =
    d.type === "number"
      ? `${Number.isFinite(value) ? value : d.initial}${d.key.includes("Minutes") ? ` ${t("min")}` : d.key === "toastSeconds" ? ` s` : d.key === "actionSoundVolume" ? "%" : ` ${t("of")} ${d.max}`}`
      : d.type === "boolean" || d.type === "select" || d.type === "voice"
        ? ""
        : "";
  const changed = p.source === "saved-local" && JSON.stringify(value) !== JSON.stringify(d.initial);
  const control = (
    <SettingInput compact key={resetVersion} definition={d} value={value} onChange={apply} t={t} voices={voices} />
  );
  return (
    <div className="li setting-row" id={id} tabIndex={-1} data-setting-id={d.key} style={{ flexWrap: "wrap", alignItems: below ? "flex-start" : "center", padding: "12px 16px" }}>
      <Ms name={SETTING_ICONS[d.key] || "tune"} style={{ marginTop: below ? 2 : 0 }} />
      <div className="txt" style={{ minWidth: 160 }}>
        <span>{t(d.label)}</span>
        <span className="sup">
          {current ? `${current} · ` : ""}
          {t(p.source === "saved-local" ? "Saved locally" : "Default")}
          {p.source === "saved-local" ? ` · ${t("default")} ${defaultText(d, t)}` : ""}
          {p.temporarilyOverridden ? ` · ${t("Scheduled now")}: ${String(p.effectiveValue)}` : ""}
        </span>
      </div>
      <IconBtn
        ref={info}
        icon="info"
        size="sm"
        label={`${t("Explanation and example")}: ${t(d.label)}`}
        aria-expanded={help}
        aria-controls={`${id}-help`}
        onClick={() => {
          setHelp(!help);
          setSample(d.initial);
          setSampleResult("");
        }}
      />
      {changed && (
        <IconBtn icon="restart_alt" size="sm" label={`${t("Reset this setting")}: ${t(d.label)}`} onClick={() => { c.reset(d.key); setResetVersion((v) => v + 1); }} />
      )}
      {!below && <div style={{ marginLeft: 8 }}>{control}</div>}
      {below && <div style={{ flexBasis: "100%", paddingLeft: 40, paddingTop: 8 }}>{control}</div>}
      {help && (
        <div
          id={`${id}-help`}
          role="region"
          aria-label={`${t("Explanation and example")}: ${t(d.label)}`}
          className="card filled"
          style={{ flexBasis: "100%", marginTop: 12, padding: 16, borderRadius: 16, display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-container-high)", ["--tf-bg" as string]: "var(--surface-container-high)" }}
        >
          <p className="body-m">{t(d.help)}</p>
          <p className="label-l">{t("Practice only")} · <span className="on-sv" style={{ fontWeight: 400 }}>{t("This example does not change your settings.")}</span></p>
          <SettingInput definition={d} value={sample} onChange={setSample} t={t} voices={voices} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="tonal" size="xs" onClick={() => {
              try {
                validateValue(d.key, sample);
                setSampleResult(t("Valid value") + ": " + String(sample));
              } catch (e) {
                setSampleResult(e instanceof Error ? e.message : "Invalid value");
              }
            }}>{t("Try example")}</Btn>
            <Btn variant="text" size="xs" onClick={() => { setSample(d.initial); setSampleResult(""); }}>{t("Reset example")}</Btn>
            <Btn variant="text" size="xs" onClick={() => { c.reset(d.key); setError(""); setResetVersion((v) => v + 1); }}>{t("Reset this setting")}</Btn>
            <Btn variant="text" size="xs" onClick={() => { setHelp(false); info.current?.focus(); }}>{t("Close explanation")}</Btn>
          </div>
          <p className="body-s on-sv" role="status">{sampleResult}</p>
        </div>
      )}
      {error && <p className="body-s c-error" role="alert" style={{ flexBasis: "100%", paddingLeft: 40 }}>{t(error)}</p>}
    </div>
  );
}

export { parseNumericDraft };
