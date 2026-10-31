import React, { useEffect, useRef, useState } from "react";
import { definitions, timeWindowMatches } from "../settings/model.mjs";
import { Btn, Dialog, IconBtn, Ms, Slider, Snackbar, Switch, ButtonGroup, cx } from "../m3";
import { useApp, ago } from "./context";
import { DIM_SUM } from "./locks-model.mjs";

const KIND_ICON: Record<string, [string, string]> = {
  success: ["task_alt", ""],
  error: ["error", "t"],
  warning: ["warning", "t"],
  info: ["info", "s"],
};

export function NotificationsPanel({ onClose, onOpenAll }: { onClose: () => void; onOpenAll: () => void }) {
  const { t, settings, now } = useApp();
  const ref = useRef<HTMLElement>(null);
  const notices = settings.record.notices.slice().reverse().slice(0, 30);
  const unread = notices.filter((n) => !n.dismissed);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("button")?.focus());
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", away), 0);
    return () => {
      document.removeEventListener("mousedown", away);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <section
      ref={ref}
      aria-labelledby="notif-h"
      className="m3-panel m3-popover"
      style={{ padding: "20px 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 12px" }}>
        <h2 id="notif-h" className="title-l" style={{ flex: 1 }}>{t("Notifications")}</h2>
        <Btn variant="text" disabled={!unread.length} onClick={() => void settings.dismiss(unread.map((n) => n.id))}>{t("Mark all read")}</Btn>
      </div>
      {notices.length === 0 ? (
        <p className="body-m on-sv" style={{ padding: "8px 12px 16px" }}>{t("Nothing yet. Outcomes of your actions appear here.")}</p>
      ) : (
        <div className="seglist" role="list">
          {notices.map((n) => {
            const [icon, tone] = KIND_ICON[n.kind] || KIND_ICON.info;
            return (
              <div key={n.id} role="listitem" className="li tall">
                <div className={cx("av", tone)} aria-hidden="true"><Ms name={icon} /></div>
                <span className="txt">
                  <span style={{ overflowWrap: "anywhere" }}>{n.message}</span>
                  <span className="sup">{ago(n.at, now, t)}</span>
                </span>
                {!n.dismissed && (
                  <button type="button" className="ib sm sl" aria-label={`${t("Mark read")}: ${n.message}`} onClick={() => void settings.dismiss([n.id])}>
                    <span className="badge dot" style={{ position: "static" }} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Btn variant="text" icon="open_in_new" style={{ alignSelf: "flex-start" }} onClick={() => { onClose(); onOpenAll(); }}>
        {t("Search, select and export notifications")}
      </Btn>
    </section>
  );
}

/** Toasts for fresh outcomes, the undo snackbar and the occasional dim sum surprise. */
export function LiveLayer({ snackbar, clearSnack }: { snackbar: { id: number; message: string; action?: { label: string; run: () => void } } | null; clearSnack: () => void }) {
  const { t, settings, prefs, now } = useApp();
  const [dimSum, setDimSum] = useState<(typeof DIM_SUM)[number] | null>(null);
  const seen = useRef(new Set<string>());
  const surprised = useRef(false);
  const d = new Date(now);
  const quiet = prefs.quietEnabled && timeWindowMatches(prefs.quietStart, prefs.quietEnd, d.getHours() * 60 + d.getMinutes());
  const visible = settings.record.notices
    .filter((n) => !n.dismissed && (["warning", "error"].includes(n.kind) ? now - Date.parse(n.at) < 60000 * 5 : !quiet && !prefs.lowStimulation && now - Date.parse(n.at) < prefs.toastSeconds * 1000))
    .slice(-3);
  const funny = prefs.language === "yue" ? prefs.funnyCantonese : prefs.funnyEnglish;
  useEffect(() => {
    for (const n of visible) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.kind === "success" && !surprised.current && funny >= 4 && !prefs.lowStimulation && !prefs.focus && !quiet && Math.random() < 0.25) {
        surprised.current = true;
        setDimSum(DIM_SUM[Math.floor(Math.random() * DIM_SUM.length)]);
      }
    }
  }, [visible.map((n) => n.id).join()]);
  useEffect(() => {
    if (!dimSum) return;
    const timer = setTimeout(() => setDimSum(null), 8000);
    return () => clearTimeout(timer);
  }, [dimSum]);
  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(clearSnack, Math.max(4, prefs.toastSeconds) * 1000);
    return () => clearTimeout(timer);
  }, [snackbar?.id]);
  return (
    <div className="m3-toasts" aria-label={t("Notifications")}>
      {visible.map((n) => (
        <div key={n.id} className="snack" role={n.kind === "error" ? "alert" : "status"}
          style={n.kind === "error" ? { background: "var(--error-container)", color: "var(--on-error-container)" } : undefined}>
          <Ms name={(KIND_ICON[n.kind] || KIND_ICON.info)[0]} size={20} />
          <span style={{ flex: 1, padding: "14px 0", overflowWrap: "anywhere" }}>{n.message}</span>
          <IconBtn icon="close" label={t("Dismiss")} style={n.kind === "error" ? { color: "inherit" } : undefined} onClick={() => void settings.dismiss([n.id])} />
        </div>
      ))}
      {dimSum && (
        <div role="status" aria-label={`${t("Dim sum surprise")}: ${dimSum[0]}`} className="card" style={{ borderRadius: 24, display: "flex", gap: 16, padding: 12, alignItems: "center", boxShadow: "var(--e3)" }}>
          <div role="img" aria-label={dimSum[2]} className="shape-sunny" style={{ width: 72, height: 72, background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Ms name="ramen_dining" size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <p className="title-m">{dimSum[0]} · {dimSum[1]}</p>
            <p className="body-s on-sv">{t("A dim sum surprise. Closes by itself.")} {t("Photo unavailable offline.")}</p>
          </div>
          <IconBtn icon="close" label={t("Dismiss")} onClick={() => setDimSum(null)} />
        </div>
      )}
      {snackbar && (
        <Snackbar
          message={snackbar.message}
          action={snackbar.action?.label}
          onAction={() => {
            snackbar.action?.run();
            clearSnack();
          }}
          onClose={clearSnack}
          closeLabel={t("Close")}
        />
      )}
    </div>
  );
}

export function AccessibilityPanel({ onClose }: { onClose: () => void }) {
  const { t, settings, prefs, narrator } = useApp();
  const [hide, setHide] = useState(false);
  const def = (key: string) => (definitions as any[]).find((d) => d.key === key);
  return (
    <Dialog
      title={t("Accessibility tools")}
      icon="accessibility_new"
      width={480}
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" onClick={() => setHide(true)}>{t("Hide this button")}</Btn>
          <Btn onClick={onClose}>{t("Done")}</Btn>
        </>
      }
    >
      <p>{t("Tab moves focus. Enter or Space activates. Escape closes an open panel. Ctrl+Shift+F opens commands.")}</p>
      <div className="seglist">
        <div className="li" style={{ flexWrap: "wrap" }}>
          <Ms name="format_size" />
          <div className="txt"><span>{t("Text size")}</span><span className="sup">{Math.round(prefs.textScale * 100)}%</span></div>
          <div style={{ flex: "1 1 160px" }}>
            <Slider label={t("Text size")} value={prefs.textScale} min={def("textScale")?.min ?? 0.8} max={def("textScale")?.max ?? 2} step={def("textScale")?.step ?? 0.1}
              valueText={`${Math.round(prefs.textScale * 100)}%`} onChange={(v) => void settings.update("textScale", Number(v.toFixed(2)))} />
          </div>
        </div>
        {(["highContrast", "strongFocus", "largeTargets"] as const).map((key) => (
          <div key={key} className="li">
            <Ms name={key === "highContrast" ? "contrast" : key === "strongFocus" ? "center_focus_strong" : "touch_app"} />
            <div className="txt"><span>{t(def(key)?.label || key)}</span></div>
            <Switch label={t(def(key)?.label || key)} checked={prefs[key] === true} onChange={(v) => void settings.update(key, v)} />
          </div>
        ))}
        <div className="li" style={{ flexWrap: "wrap" }}>
          <Ms name="animation" />
          <div className="txt"><span>{t("Motion")}</span></div>
          <ButtonGroup label={t("Motion")} value={prefs.motion} onChange={(v) => void settings.update("motion", v)} options={(def("motion")?.options || [["system", "System"], ["reduce", "Reduce"]]).map(([k, v]: [string, string]) => [k, t(v)])} />
        </div>
        <div className="li" style={{ flexWrap: "wrap" }}>
          <Ms name="record_voice_over" />
          <div className="txt"><span>{t("Speech")}</span><span className="sup">{narrator.speechStatus || t("Reads the keyboard help aloud")}</span></div>
          <IconBtn icon="play_arrow" label={t("Read keyboard help")} onClick={() => narrator.speak("Tab moves focus. Enter or Space activates. Escape closes an open panel.", "Tab 移動焦點，Enter 或空白鍵啟動，Escape 關閉面板。", "accessibility", true)} />
          <IconBtn icon="pause" label={t("Pause speech")} onClick={() => narrator.pause?.()} />
          <IconBtn icon="stop" label={t("Stop speech")} onClick={() => narrator.stop?.()} />
        </div>
      </div>
      {hide && (
        <div className="card tint-t" role="alertdialog" aria-label={t("Hide the accessibility button?")} style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="body-m">{t("The button leaves the title bar. You can bring it back from Settings, Accessibility and focus.")}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="text" data-autofocus autoFocus onClick={() => setHide(false)}>{t("Cancel")}</Btn>
            <Btn variant="tonal" onClick={() => { void settings.update("accessibilityVisible", false); onClose(); }}>{t("Hide")}</Btn>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function AttentionBar() {
  const { t, settings, prefs } = useApp();
  const started = useRef(Date.now());
  const last = useRef(Date.now());
  const [tick, setTick] = useState(0);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const activity = () => {
      last.current = Date.now();
      setIdle(false);
    };
    window.addEventListener("keydown", activity);
    window.addEventListener("pointerdown", activity);
    const timer = setInterval(() => {
      setTick((x) => x + 1);
      if (prefs.momentum && Date.now() - last.current >= prefs.idleMinutes * 60000 && Date.now() > (settings.record.snoozeUntil || 0)) setIdle(true);
    }, 1000);
    return () => {
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pointerdown", activity);
      clearInterval(timer);
    };
  }, [prefs.momentum, prefs.idleMinutes, settings.record.snoozeUntil]);
  const seconds = Math.floor((Date.now() - started.current) / 1000);
  if (!prefs.timeAwareness && !prefs.oneThing && !idle) return null;
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 40, zIndex: 44, display: "flex", gap: 8, alignItems: "center" }} data-tick={tick}>
      {(prefs.timeAwareness || prefs.oneThing) && (
        <div className="ftb" role="status" aria-label={t("Focus and time")} style={{ padding: "4px 16px", gap: 12 }}>
          {prefs.timeAwareness && <span className="stat"><Ms name="timer" />{t("Session")} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}
          {prefs.oneThing && <span className="stat"><Ms name="filter_1" />{prefs.nextAction || t("Choose your next action in Settings")}</span>}
        </div>
      )}
      {idle && (
        <div className="snack" role="status">
          <span style={{ padding: "14px 0" }}>{t("No keyboard or pointer activity for")} {prefs.idleMinutes} {t("minutes")}.</span>
          <Btn variant="text" onClick={() => {
            void settings.persist((old) => ({ ...old, snoozeUntil: Date.now() + prefs.snoozeMinutes * 60000 }));
            setIdle(false);
          }}>{t("Not now")}</Btn>
        </div>
      )}
    </div>
  );
}
