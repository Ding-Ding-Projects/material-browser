import React, { useState, useId, useRef, useEffect } from "react";
import { Button, Field } from "../components";
import { Search } from "../Search";
import { validateValue } from "./model.mjs";
import {
  settingInstanceId,
  choiceAccessibleName,
  parseNumericDraft,
  resolveSearchRecords,
} from "./interaction-model.mjs";
import { preferenceProvenance } from "./record.mjs";
import type { SettingsController } from "./store";
import "@material/web/switch/switch.js";
import "@material/web/slider/slider.js";
import "@material/web/iconbutton/icon-button.js";
export function Choice({
  label,
  value,
  options,
  onChange,
  t,
  previewFont = false,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  t: (s: string) => string;
  previewFont?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [matches, setMatches] = useState<string[]>([]),
    [page, setPage] = useState(0);
  const id = useId();
  const opener = useRef<HTMLElement | null>(null);
  const choices = resolveSearchRecords(
    matches,
    options.map(([id, label]) => ({ id, label })),
  );
  return (
    <div className="settings-choice">
      <span className="field-label">{label}</span>
      {React.createElement(
        "md-outlined-button",
        {
          ref: opener,
          id,
          "aria-label": choiceAccessibleName(
            label,
            value,
            options,
            t("Choose automatically"),
          ),
          onClick: () => setOpen(!open),
          "aria-expanded": open,
          "aria-controls": `${id}-options`,
        },
        options.find((x) => x[0] === value)?.[1] ||
          value ||
          t("Choose automatically"),
      )}
      {open && (
        <div
          id={`${id}-options`}
          className="choice-popover"
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              opener.current?.focus();
            }
          }}
        >
          <Search
            key={id}
            label={t("Search options")}
            items={options.map((x) => x[1])}
            itemKeys={options.map(([id]) => id)}
            onKeys={(ids) => {
              setMatches(ids);
              setPage(0);
            }}
            t={t}
          />
          <div className="choice-options">
            {choices.slice(page * 50, (page + 1) * 50).map((option: any) => (
              <Button
                secondary
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                  opener.current?.focus();
                }}
              >
                <span
                  style={
                    previewFont
                      ? {
                          fontFamily: `${JSON.stringify(option.id)},sans-serif`,
                        }
                      : undefined
                  }
                >
                  {option.label}
                </span>
              </Button>
            ))}
            {choices.length === 0 && (
              <p role="status">{t("No matching options")}</p>
            )}
          </div>
          {choices.length > 50 && (
            <div className="actions">
              <Button
                secondary
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("Previous")}
              </Button>
              <span role="status">
                {page * 50 + 1}–{Math.min((page + 1) * 50, choices.length)} /{" "}
                {choices.length}
              </span>
              <Button
                secondary
                disabled={(page + 1) * 50 >= choices.length}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          )}
          <Button
            secondary
            onClick={() => {
              setOpen(false);
              opener.current?.focus();
            }}
          >
            {t("Close picker")}
          </Button>
        </div>
      )}
    </div>
  );
}
function NumericInput({
  definition: d,
  value,
  onChange,
  t,
}: {
  definition: any;
  value: number;
  onChange: (v: number) => void;
  t: (s: string) => string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(
    () => setDraft(Number.isFinite(value) ? String(value) : ""),
    [value],
  );
  return (
    <div className="range-control">
      {React.createElement("md-slider", {
        min: d.min,
        max: d.max,
        step: d.step,
        value: Number.isFinite(value) ? value : d.initial,
        onInput: (e: any) => {
          setDraft(String(e.target.value));
          onChange(Number(e.target.value));
        },
        "aria-label": t(d.label),
      })}
      <Field
        label={t(d.label)}
        value={draft}
        type="text"
        inputMode="decimal"
        clearLabel={`${t("Clear field")}: ${t(d.label)}`}
        onChange={(text) => {
          setDraft(text);
          onChange(parseNumericDraft(text));
        }}
      />
    </div>
  );
}
function DraftField({
  definition: d,
  value,
  onChange,
  t,
}: {
  definition: any;
  value: string;
  onChange: (value: string) => void;
  t: (s: string) => string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field
      label={t(d.label)}
      value={draft}
      type={d.type === "time" ? "time" : "text"}
      clearLabel={`${t("Clear field")}: ${t(d.label)}`}
      onChange={(text) => {
        setDraft(text);
        onChange(text);
      }}
    />
  );
}
export function SettingInput({
  definition: d,
  value,
  onChange,
  t,
  voices = [],
}: {
  definition: any;
  value: any;
  onChange: (v: any) => void;
  t: (s: string) => string;
  voices?: [string, string][];
}) {
  const id = useId();
  if (d.type === "boolean")
    return React.createElement("md-switch", {
      selected: value,
      onChange: (e: any) => onChange(e.target.selected),
      "aria-label": t(d.label),
      "data-setting": d.key,
    });
  if (d.type === "number")
    return (
      <NumericInput definition={d} value={value} onChange={onChange} t={t} />
    );
  if (d.type === "select" || d.type === "voice" || d.type === "font")
    return (
      <Choice
        label={t(d.label)}
        value={value}
        options={
          d.type === "voice" || d.type === "font"
            ? voices
            : d.options.map(([v, l]: [string, string]) => [v, t(l)])
        }
        onChange={onChange}
        t={t}
        previewFont={d.type === "font"}
      />
    );
  if (d.type === "color")
    return (
      <div className="range-control">
        <input
          type="color"
          value={value}
          aria-label={t(d.label)}
          onChange={(e) => onChange(e.target.value)}
        />
        <DraftField definition={d} value={value} onChange={onChange} t={t} />
      </div>
    );
  return <DraftField definition={d} value={value} onChange={onChange} t={t} />;
}
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
    [sample, setSample] = useState(d.initial),
    [sampleResult, setSampleResult] = useState(""),
    [error, setError] = useState(""),
    [resetVersion, setResetVersion] = useState(0);
  const instance = useId();
  const info = useRef<HTMLElement | null>(null),
    id = settingInstanceId(d.key, instance);
  const p = preferenceProvenance(c.record, d.key, c.preferences);
  const apply = (value: any) => {
    try {
      validateValue(d.key, value);
      if (d.key === "accessibilityVisible" && !value) {
        window.dispatchEvent(new CustomEvent("settings-hide-accessibility"));
        return;
      }
      c.update(d.key, value);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid value");
    }
  };
  return (
    <section
      className="setting-card"
      id={id}
      tabIndex={-1}
      data-setting-id={d.key}
    >
      <div className="setting-heading">
        <h2>{t(d.label)}</h2>
        {React.createElement(
          "md-icon-button",
          {
            ref: info,
            "aria-label": `${t("Explanation and example")}: ${t(d.label)}`,
            "aria-expanded": help,
            "aria-controls": `${id}-help`,
            title: t("Explanation and example"),
            onClick: () => {
              setHelp(!help);
              setSample(d.initial);
              setSampleResult("");
            },
          },
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11 17h2v-6h-2v6zm1-15a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-11h2V7h-2v2z"
            />
          </svg>,
        )}
      </div>
      {help && (
        <div
          className="setting-help"
          id={`${id}-help`}
          role="region"
          aria-label={`${t("Explanation and example")}: ${t(d.label)}`}
        >
          <p>{t(d.help)}</p>
          <h3>{t("Practice only")}</h3>
          <p>{t("This example does not change your settings.")}</p>
          <SettingInput
            definition={d}
            value={sample}
            onChange={setSample}
            t={t}
            voices={voices}
          />
          <div className="actions">
            <Button
              secondary
              onClick={() => {
                try {
                  validateValue(d.key, sample);
                  setSampleResult(t("Valid value") + ": " + String(sample));
                } catch (e) {
                  setSampleResult(
                    e instanceof Error ? e.message : "Invalid value",
                  );
                }
              }}
            >
              {t("Try example")}
            </Button>
            <Button
              secondary
              onClick={() => {
                setSample(d.initial);
                setSampleResult("");
              }}
            >
              {t("Reset example")}
            </Button>
            <Button
              secondary
              onClick={() => {
                setHelp(false);
                info.current?.focus();
              }}
            >
              {t("Close explanation")}
            </Button>
          </div>
          <p role="status">{sampleResult}</p>
        </div>
      )}
      <SettingInput
        key={resetVersion}
        definition={d}
        value={c.record.preferences[d.key]}
        onChange={apply}
        t={t}
        voices={voices}
      />
      <p className="provenance">
        {t(p.source === "saved-local" ? "Saved locally" : "Compiled default")} ·{" "}
        {t("Default")}:{" "}
        <code>
          {d.type === "voice" && !d.initial
            ? t("Choose automatically")
            : d.type === "boolean"
              ? t(d.initial ? "On" : "Off")
              : d.options
                ? t(
                    d.options.find(
                      ([v]: [string, string]) => v === d.initial,
                    )?.[1] || String(d.initial),
                  )
                : String(d.initial)}
        </code>
        {p.temporarilyOverridden && (
          <>
            {" "}
            · {t("Scheduled override")}: <code>{String(p.effectiveValue)}</code>
          </>
        )}
      </p>
      {error && (
        <p className="validation" role="alert">
          {t(error)}
        </p>
      )}
      <Button
        secondary
        onClick={() => {
          c.reset(d.key);
          setError("");
          setResetVersion((v) => v + 1);
        }}
      >
        {t("Reset this setting")}
      </Button>
    </section>
  );
}
