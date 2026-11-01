/* Shared controls for the Personalize page: info icons, bounded steppers and the colour picker. */
import React, { useContext, useEffect, useRef, useState } from "react";
import { Btn, Dialog, IconBtn, TextField } from "../m3";
import { AppContext } from "./context";
import { formatHex, hsvToRgb, normaliseHex, parseHex, rgbToHsv } from "./colour.mjs";

/** Translation function from the app context, or plain English outside it. */
export function useT(): (s: string) => string {
  return useContext(AppContext)?.t ?? ((s: string) => s);
}

/**
 * Small info button next to a control. Its accessible name is "About <control>" and it
 * opens a short dialog with an explanation written for that one control.
 */
export function InfoIcon({ control, text }: { control: string; text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconBtn icon="info" size="sm" label={`${t("About")} ${control}`} onClick={() => setOpen(true)} />
      {open && (
        <Dialog title={control} icon="info" width={360} onClose={() => setOpen(false)} actions={<Btn variant="text" onClick={() => setOpen(false)}>{t("Close")}</Btn>}>
          <p>{text}</p>
        </Dialog>
      )}
    </>
  );
}

/** Bounded number stepper: minus, a validated number field, plus. Same anatomy as ServerConfig. */
export function Stepper({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
  lessLabel,
  moreLabel,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  lessLabel: string;
  moreLabel: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const bound = (n: number) => Math.min(max, Math.max(min, Math.round((n - min) / step) * step + min));
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) setDraft(String(value));
    else {
      const next = bound(n);
      setDraft(String(next));
      if (next !== value) onChange(next);
    }
  };
  const n = Number(draft);
  const invalid = draft.trim() !== "" && (!Number.isFinite(n) || n < min || n > max);
  return (
    <div className="pz-stepper" role="group" aria-label={label}>
      <IconBtn icon="remove" variant="outlined" size="sm" label={lessLabel} disabled={value <= min} onClick={() => onChange(bound(value - step))} />
      <div onBlur={commit}>
        <TextField
          label={unit}
          value={draft}
          inputMode="numeric"
          error={invalid ? `${min} ${t("to")} ${max}` : undefined}
          onChange={setDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onChange(bound(value + (event.key === "ArrowUp" ? step : -step)));
            }
          }}
        />
      </div>
      <IconBtn icon="add" variant="outlined" size="sm" label={moreLabel} disabled={value >= max} onClick={() => onChange(bound(value + step))} />
    </div>
  );
}

type Hsv = { h: number; s: number; v: number };
const hexOf = (hsv: Hsv) => formatHex(hsvToRgb(hsv));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Colour picker with no fixed palette limit: a saturation and brightness area plus a hue bar,
 * both fully keyboard operable, and a validated hex field.
 * Arrow keys move by 1, Shift with an arrow by 10, Home and End jump to the edges.
 */
export function ColourPicker({
  value,
  onChange,
  label,
  before,
  after,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  /** Rendered in the right column above the hex field (the artboard puts swatches here). */
  before?: React.ReactNode;
  /** Rendered in the right column below the hex field (translations and contrast). */
  after?: React.ReactNode;
}) {
  const t = useT();
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(parseHex(value) || { r: 0, g: 0, b: 0 }));
  const [draft, setDraft] = useState(value);
  const area = useRef<HTMLDivElement>(null);
  const hueBar = useRef<HTMLDivElement>(null);

  // Follow outside changes (swatches, element switch) without losing the hue on greys.
  useEffect(() => {
    const normal = normaliseHex(value);
    if (!normal) return;
    setDraft(normal);
    setHsv((current) => {
      if (hexOf(current) === normal) return current;
      const next = rgbToHsv(parseHex(normal)!);
      return next.s === 0 || next.v === 0 ? { ...next, h: current.h } : next;
    });
  }, [value]);

  const push = (next: Hsv) => {
    const bounded = { h: ((next.h % 360) + 360) % 360, s: clamp(next.s, 0, 100), v: clamp(next.v, 0, 100) };
    setHsv(bounded);
    const hex = hexOf(bounded);
    setDraft(hex);
    if (hex !== normaliseHex(value)) onChange(hex);
  };
  const fromArea = (x: number, y: number) => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    push({ ...hsv, s: ((x - rect.left) / rect.width) * 100, v: 100 - ((y - rect.top) / rect.height) * 100 });
  };
  const fromHue = (x: number) => {
    const rect = hueBar.current?.getBoundingClientRect();
    if (!rect?.width) return;
    push({ ...hsv, h: clamp(((x - rect.left) / rect.width) * 360, 0, 359.9) });
  };
  const pureHue = hexOf({ h: hsv.h, s: 100, v: 100 });
  const current = hexOf(hsv);
  const valid = parseHex(draft) !== null;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
     <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        ref={area}
        className="pz-area"
        role="slider"
        tabIndex={0}
        aria-label={`${label}: ${t("Colour area")}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={`${t("Saturation")} ${Math.round(hsv.s)}%, ${t("brightness")} ${Math.round(hsv.v)}%, ${current}`}
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          fromArea(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => event.buttons === 1 && fromArea(event.clientX, event.clientY)}
        onKeyDown={(event) => {
          const d = event.shiftKey ? 10 : 1;
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: hsv.s - d },
            ArrowRight: { s: hsv.s + d },
            ArrowUp: { v: hsv.v + d },
            ArrowDown: { v: hsv.v - d },
            Home: { s: 0 },
            End: { s: 100 },
            PageUp: { v: 100 },
            PageDown: { v: 0 },
          };
          const move = moves[event.key];
          if (!move) return;
          event.preventDefault();
          push({ ...hsv, ...move });
        }}
      >
        <span className="pz-area-thumb" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: current }} />
      </div>
      <div
        ref={hueBar}
        className="pz-hue"
        role="slider"
        tabIndex={0}
        aria-label={`${label}: ${t("Hue")}`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.min(359, Math.round(hsv.h))}
        aria-valuetext={`${Math.min(359, Math.round(hsv.h))}°`}
        style={{ width: 220 }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          fromHue(event.clientX);
        }}
        onPointerMove={(event) => event.buttons === 1 && fromHue(event.clientX)}
        onKeyDown={(event) => {
          const d = event.shiftKey ? 10 : 1;
          const next =
            event.key === "ArrowRight" || event.key === "ArrowUp" ? hsv.h + d
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? hsv.h - d
            : event.key === "Home" ? 0
            : event.key === "End" ? 359
            : null;
          if (next === null) return;
          event.preventDefault();
          push({ ...hsv, h: next });
        }}
      >
        <span style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
     </div>
     <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 200px", minWidth: 0 }}>
      {before}
      <HexField
        draft={draft}
        valid={valid}
        onDraft={(text) => {
          setDraft(text);
          const normal = normaliseHex(text);
          if (normal) {
            const next = rgbToHsv(parseHex(normal)!);
            setHsv(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
            if (normal !== normaliseHex(value)) onChange(normal);
          }
        }}
        onRevert={() => setDraft(normaliseHex(value) || value)}
      />
      {after}
     </div>
    </div>
  );
}

function HexField({ draft, valid, onDraft, onRevert }: { draft: string; valid: boolean; onDraft: (s: string) => void; onRevert: () => void }) {
  const t = useT();
  return (
    <div onBlur={() => !valid && onRevert()}>
      <TextField
        label={t("Hex")}
        value={draft}
        mono
        maxLength={7}
        error={valid ? undefined : t("Use 3 or 6 hex digits, like #006A6A")}
        onChange={onDraft}
      />
    </div>
  );
}
