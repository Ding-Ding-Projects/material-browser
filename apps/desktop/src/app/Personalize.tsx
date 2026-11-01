/* Personalize: ADHD-friendly focus modes and the per-element appearance editor.
   Layout, copy and controls follow design/remaining-features/Personalize.dc.html. */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Btn, ButtonGroup, Dialog, Dropdown, Menu, Ms, Slider, Switch } from "../m3";
import { AppContext } from "./context";
import { BREAK_MINUTES, WORK_MINUTES, useFocusModes, type FocusModeId } from "./focus-modes";
import { contrastCheck, formatHex, normaliseHex, parseCssRgba, compositeColour, resolveCssBackground, translate } from "./colour.mjs";
import { RADIUS, SCALE } from "./appearance-elements-model.mjs";
import {
  appearanceTarget,
  applyAppearanceOverrides,
  elementLabel,
  firstElement,
  flashElements,
  listElements,
  resetAllOverrides,
  resetOverride,
  setOverride,
  useAppearanceOverrides,
  type ElementChoice,
} from "./appearance-elements";
import { ColourPicker, InfoIcon, Stepper, useT } from "./personalize-controls";

export { FocusModesProvider, FocusTimerStatus, useBreakIntoSteps, breakIntoStepsEnabled } from "./focus-modes";
export { InfoIcon } from "./personalize-controls";

const MODES: { id: FocusModeId; icon: string; label: string; help: string; about: string }[] = [
  {
    id: "calm",
    icon: "self_improvement",
    label: "Calm screen",
    help: "Hides badges, motion and non-urgent notifications",
    about: "Counters and dots on icons disappear, animations stop, and only errors pop up. Everything else still arrives in the notification list for later.",
  },
  {
    id: "oneThing",
    icon: "center_focus_strong",
    label: "One thing at a time",
    help: "Dims everything except the pane you are working in",
    about: "The pane you last clicked or moved into stays bright. Other panes fade back until you point at them or move focus there.",
  },
  {
    id: "steps",
    icon: "checklist",
    label: "Break it into steps",
    help: "Long forms show one step at a time with progress",
    about: "Forms that support it show a single step with a progress bar instead of every field at once. Forms that have not adopted it yet look the same.",
  },
  {
    id: "timer",
    icon: "timer",
    label: "Gentle timer",
    help: "A visible work-and-break timer in the status bar",
    about: "A quiet countdown sits in the status bar. It switches between work and break on its own and never makes a sound. Pause or reset it from the bar.",
  },
];

const SWATCHES = ["#006A6A", "#4B607C", "#8B5000", "#B3261E", "#5B4B9C", "#1D6B2B"];
type Part = "background" | "foreground";

function FocusModesSection() {
  const t = useT();
  const focus = useFocusModes();
  const { settings } = focus;
  return (
    <section className="pane" aria-labelledby="ad-h" style={{ flex: "1 1 420px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 id="ad-h" className="headline-s" style={{ margin: 0 }}>{t("Focus modes")}</h1>
      <p className="body-m on-sv" style={{ margin: 0 }}>{t("Built for ADHD-friendly work. Each mode changes the whole app right away and can be turned off any time.")}</p>
      <div className="seglist">
        {MODES.map((m) => (
          <React.Fragment key={m.id}>
            <div className="li plain" style={{ gap: 12 }}>
              <Ms name={m.icon} />
              <div className="txt"><span className="body-l">{t(m.label)}</span><span className="body-s on-sv">{t(m.help)}</span></div>
              <InfoIcon control={t(m.label)} text={t(m.about)} />
              <Switch checked={settings[m.id]} label={t(m.label)} onChange={(on) => focus.setMode(m.id, on)} />
            </div>
            {m.id === "timer" && settings.timer && (
              <div className="li plain" style={{ gap: 12, flexWrap: "wrap", paddingLeft: 56 }}>
                <div className="txt" style={{ flex: "1 1 140px" }}><span className="body-m">{t("Work length")}</span><span className="body-s on-sv">{WORK_MINUTES.min} {t("to")} {WORK_MINUTES.max} {t("minutes")}</span></div>
                <InfoIcon control={t("Work length")} text={t("How long each work stretch lasts before the timer offers a break. Changes take effect the next time the timer starts.")} />
                <Stepper label={t("Work length")} unit={t("Minutes")} value={settings.workMinutes} min={WORK_MINUTES.min} max={WORK_MINUTES.max} step={WORK_MINUTES.step}
                  lessLabel={t("Five fewer work minutes")} moreLabel={t("Five more work minutes")} onChange={focus.setWorkMinutes} />
                <div className="txt" style={{ flex: "1 1 140px" }}><span className="body-m">{t("Break length")}</span><span className="body-s on-sv">{BREAK_MINUTES.min} {t("to")} {BREAK_MINUTES.max} {t("minutes")}</span></div>
                <InfoIcon control={t("Break length")} text={t("How long each break lasts before work starts again. Short breaks keep momentum; longer ones help after a hard stretch.")} />
                <Stepper label={t("Break length")} unit={t("Minutes")} value={settings.breakMinutes} min={BREAK_MINUTES.min} max={BREAK_MINUTES.max} step={BREAK_MINUTES.step}
                  lessLabel={t("One fewer break minute")} moreLabel={t("One more break minute")} onChange={focus.setBreakMinutes} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function computedColour(id: string, part: Part): string | null {
  const el = firstElement(id);
  if (!el) return null;
  const styles: CSSStyleDeclaration[] = [];
  for (let node: HTMLElement | null = el; node; node = node.parentElement) styles.push(getComputedStyle(node));
  if (styles.some(style => Number(style.opacity) !== 1 || style.filter !== 'none' || style.mixBlendMode !== 'normal' || (style.backdropFilter && style.backdropFilter !== 'none'))) return null;
  const background = resolveCssBackground(styles.map(style => ({ color: style.backgroundColor, image: style.backgroundImage })));
  if (part === 'background') return background ? formatHex(background) : null;
  const foreground = parseCssRgba(styles[0].color);
  if (!foreground) return null;
  if (foreground.a === 1) return formatHex(foreground);
  return background ? formatHex(compositeColour(foreground, background)) : null;
}

/**
 * The appearance editor body. Used on the Personalize page and in the dialog opened from
 * the "Customize appearance" context menu entry.
 */
export function AppearanceEditor({ initial, headingId, heading = true }: { initial?: ElementChoice; headingId?: string; heading?: boolean }) {
  const t = useT();
  const overrides = useAppearanceOverrides();
  const [choices, setChoices] = useState<ElementChoice[]>(() => listElements());
  const [id, setId] = useState(initial?.id || "primary-buttons");
  const [part, setPart] = useState<Part>("background");
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => {
    const list = listElements();
    if (initial && !list.some((c) => c.id === initial.id)) list.push(initial);
    setChoices(list);
  }, [initial?.id]);
  const override = overrides[id] || {};
  const other: Part = part === "background" ? "foreground" : "background";
  const hex = normaliseHex(override[part] || "") || computedColour(id, part);
  const against = normaliseHex(override[other] || "") || computedColour(id, other);
  const names = hex ? translate(hex) : null;
  const renderedColoursKnown = computedColour(id, "background") !== null && computedColour(id, "foreground") !== null;
  const check = renderedColoursKnown && hex && against ? contrastCheck(hex, against) : null;
  const label = choices.find((c) => c.id === id)?.label || elementLabel(id);
  const update = (change: Partial<typeof override>) => setOverride(id, { ...override, ...change });
  const verdict = !check ? "" : check.passes ? t("(passes)") : check.advice === "darker" ? t("(too low, pick darker)") : t("(too low, pick lighter)");
  const textForPreview = hex && check && contrastCheck(hex, "#FFFFFF")!.ratio >= contrastCheck(hex, "#000000")!.ratio ? "#FFFFFF" : "#000000";

  return (
    <>
      {heading && <h2 id={headingId} className="title-l" style={{ margin: 0 }}>{t("Appearance editor")}</h2>}
      <p className="body-m on-sv" style={{ margin: 0 }}>{t("Pick any element, then change its colour, shape and size. Right-click anything and choose Customize appearance.")}</p>
      <div className="li plain" style={{ gap: 12, flexWrap: "wrap" }}>
        <span className="label-l" style={{ minWidth: 120 }}>{t("Element")}</span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Dropdown label={t("Chosen element")} value={id} options={choices.map((c) => [c.id, t(c.label)] as [string, string])} onChange={(next) => setId(next)} />
        </div>
        <InfoIcon control={t("Chosen element")} text={t("The part of the app you are changing. Groups such as Primary buttons change every matching control; right-clicking picks the exact element under the pointer.")} />
      </div>
      <div className="li plain" style={{ gap: 12, flexWrap: "wrap" }}>
        <span className="label-l" style={{ minWidth: 120 }}>{t("Colour for")}</span>
        <ButtonGroup label={t("Colour for")} value={part} onChange={setPart} options={[["background", t("Background")], ["foreground", t("Text")]]} />
        <InfoIcon control={t("Colour for")} text={t("Background fills the element. Text colours its words and icons. The contrast check always compares the two.")} />
      </div>
      {hex ? <ColourPicker
        value={hex}
        label={t(part === "background" ? "Background" : "Text")}
        onChange={(next) => update({ [part]: next })}
        before={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label={t("Swatches")}>
            {SWATCHES.map((s) => (
              <button key={s} type="button" className="ib sl pz-swatch" aria-label={`${t("Colour")} ${s}`} aria-pressed={s === hex} style={{ background: s }} onClick={() => update({ [part]: s })} />
            ))}
          </div>
        }
        after={
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <p className="body-s on-sv mono" style={{ margin: 0, flex: 1, overflowWrap: "anywhere" }}>
                {names ? `${names.rgb} · ${names.hsl} · ${names.oklch}` : ""}
              </p>
              <InfoIcon control={t("Colour translations")} text={t("The same colour written four ways. Hex and rgb suit most tools, hsl is easy to adjust by hand, and oklch keeps lightness even across hues.")} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <p className="body-s on-sv" style={{ margin: 0, flex: 1 }} aria-live="polite">
                {t("Contrast with its text:")} {check ? `${check.ratio.toFixed(1)}:1 ${t("with")} ${against} ${verdict}` : ""}
              </p>
              <InfoIcon control={t("Contrast check")} text={t("Compares this colour with the one it sits behind or in front of. 4.5 to 1 or more keeps ordinary text readable for most people.")} />
            </div>
          </>
        }
      /> : <div><p role="status">{t("The current colour cannot be resolved from a solid backdrop. Choose a swatch to set an explicit colour.")}</p><div className="pz-swatches" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{SWATCHES.map(s => <button key={s} type="button" className="ib sl pz-swatch" aria-label={`${t("Colour")} ${s}`} style={{ background: s }} onClick={() => update({ [part]: s })} />)}</div></div>}
      {!check && <p role="status">{t("Contrast unavailable: the actual foreground or background cannot be determined. No passing verdict is claimed.")}</p>}
      <div className="li plain" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="txt" style={{ flex: "1 1 160px" }}><span className="body-l">{t("Corner radius")}</span><span className="body-s on-sv">{RADIUS.min} {t("to")} {RADIUS.max} px</span></div>
        <InfoIcon control={t("Corner radius")} text={t("How round the corners are. 0 is square; 28 matches the large panes.")} />
        <Stepper label={t("Corner radius")} unit="px" value={override.radius ?? Math.min(RADIUS.max, parseFloat(firstElement(id) ? getComputedStyle(firstElement(id)!).borderTopLeftRadius : "") || 0)}
          min={RADIUS.min} max={RADIUS.max} step={RADIUS.step} lessLabel={t("Less rounded")} moreLabel={t("More rounded")}
          onChange={(radius) => update({ radius: Math.min(RADIUS.max, radius) })} />
      </div>
      <div className="li plain" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="txt" style={{ flex: "1 1 160px" }}><span className="body-l">{t("Size")}</span><span className="body-s on-sv">{override.scale ?? 100}%</span></div>
        <InfoIcon control={t("Size")} text={t("Makes the element larger or smaller, from 80 to 150 percent, without changing the text size setting.")} />
        <div style={{ flex: "1 1 200px" }}>
          <Slider label={t("Size")} value={override.scale ?? 100} min={SCALE.min} max={SCALE.max} step={SCALE.step} valueText={`${override.scale ?? 100}%`} onChange={(scale) => update({ scale })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn icon="visibility" size="m" disabled={!hex} style={{ background: hex || undefined, color: textForPreview }} onClick={() => flashElements(id)}>{t("Preview")}</Btn>
        <Btn variant="text" size="m" disabled={!overrides[id]} onClick={() => resetOverride(id)}>{t("Reset this element")}</Btn>
        <span style={{ flex: 1 }} />
        <Btn variant="text" size="m" disabled={!Object.keys(overrides).length} onClick={() => setConfirmAll(true)}>{t("Reset all elements")}</Btn>
      </div>
      <p className="body-s on-sv" style={{ margin: 0 }}>{t("Changes apply right away and are saved on this computer only.")} {label && overrides[id] ? `${t(label)}: ${t("customized")}` : ""}</p>
      {confirmAll && (
        <Dialog title={t("Reset every element?")} icon="format_color_reset" onClose={() => setConfirmAll(false)}
          actions={<><Btn variant="text" onClick={() => setConfirmAll(false)}>{t("Cancel")}</Btn><Btn onClick={() => { resetAllOverrides(); setConfirmAll(false); }}>{t("Reset all")}</Btn></>}>
          <p>{t("Every colour, corner and size change goes back to the theme. Focus modes are not affected.")}</p>
        </Dialog>
      )}
    </>
  );
}

/** Page component: focus modes and the appearance editor side by side, as in the artboard. */
export function PersonalizePage() {
  return (
    <div className="scroll" style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", alignContent: "flex-start", overflow: "auto" }}>
      <FocusModesSection />
      <section className="pane low" aria-labelledby="ap-h" style={{ flex: "1 1 520px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <AppearanceEditor headingId="ap-h" />
      </section>
    </div>
  );
}

/** Dialog version of the editor, opened from the context menu. */
export function AppearanceEditorDialog({ target, onClose }: { target: ElementChoice; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog title={`${t("Customize appearance")} · ${t(target.label)}`} icon="format_paint" width={640} onClose={onClose}
      actions={<Btn variant="text" onClick={onClose}>{t("Done")}</Btn>}>
      <AppearanceEditor initial={target} heading={false} />
    </Dialog>
  );
}

const editable = (el: Element | null) => !!el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");

/**
 * Global "Customize appearance" context menu. Mount once inside the ".m3" root.
 * Right-click, Shift+F10 or the ContextMenu key on an element with data-appearance-id
 * (or one of the built-in groups) offers the entry. Menus that other components already
 * opened (they call preventDefault) and text fields are left alone.
 */
export function AppearanceContextMenu() {
  const app = useContext(AppContext);
  const t = app?.t ?? ((s: string) => s);
  const [menu, setMenu] = useState<{ target: ElementChoice; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<ElementChoice | null>(null);
  useEffect(() => {
    applyAppearanceOverrides();
    const onContext = (event: MouseEvent) => {
      if (event.defaultPrevented || editable(event.target as Element)) return;
      if ((event.target as Element)?.closest?.(".m3-overlay, [role=menu]")) return;
      if (window.getSelection()?.toString()) return;
      const target = appearanceTarget(event.target as Element);
      if (!target) return;
      event.preventDefault();
      setMenu({ target, x: event.clientX, y: event.clientY });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !((event.shiftKey && event.key === "F10") || event.key === "ContextMenu")) return;
      const active = document.activeElement;
      if (editable(active) || active?.closest(".m3-overlay, [role=menu]")) return;
      const target = appearanceTarget(active);
      if (!target) return;
      event.preventDefault();
      const rect = (active as HTMLElement).getBoundingClientRect();
      setMenu({ target, x: rect.left + 8, y: rect.bottom + 4 });
    };
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const groups = useMemo(
    () =>
      menu
        ? [[{ id: "customize", label: t("Customize appearance"), icon: "format_paint", shortcut: "Shift+F10", onSelect: () => setEditing(menu.target) }]]
        : [],
    [menu, t],
  );
  return (
    <>
      {menu && <Menu label={`${t("Element")}: ${t(menu.target.label)}`} groups={groups} anchor={{ x: menu.x, y: menu.y }} filterable={false} t={t} onClose={() => setMenu(null)} />}
      {editing && <AppearanceEditorDialog target={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
