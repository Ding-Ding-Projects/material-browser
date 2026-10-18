import React, { useEffect, useRef, useState } from "react";
import { Button, Modal } from "../components";
import { SettingControl } from "./SettingControl";
import { definitions, timeWindowMatches } from "./model.mjs";
import type { SettingsController } from "./store";
export function AccessibilityTools({
  controller: c,
  t,
  narrator,
}: {
  controller: SettingsController;
  t: (s: string) => string;
  narrator: any;
}) {
  const [open, setOpen] = useState(false),
    [hide, setHide] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true),
      hideRequest = () => setHide(true);
    window.addEventListener("settings-accessibility", show);
    window.addEventListener("settings-hide-accessibility", hideRequest);
    return () => {
      window.removeEventListener("settings-accessibility", show);
      window.removeEventListener("settings-hide-accessibility", hideRequest);
    };
  }, []);
  useEffect(() => {
    if (hide)
      requestAnimationFrame(() =>
        document.getElementById("accessibility-cancel")?.focus(),
      );
  }, [hide]);
  return (
    <>
      {c.preferences.accessibilityVisible && (
        <div className="accessibility-entry">
          <Button secondary onClick={() => setOpen(true)}>
            {t("Accessibility")}
          </Button>
        </div>
      )}
      {open && (
        <Modal title={t("Accessibility")} onClose={() => setOpen(false)}>
          <p>
            {t(
              "Tab moves focus. Enter or Space activates. Escape closes an open panel. Ctrl+Shift+F opens commands.",
            )}
          </p>
          <div className="accessibility-controls">
            {definitions
              .filter((d) =>
                [
                  "textScale",
                  "highContrast",
                  "strongFocus",
                  "largeTargets",
                  "motion",
                ].includes(d.key),
              )
              .map((d) => (
                <SettingControl
                  key={d.key}
                  definition={d}
                  controller={c}
                  t={t}
                />
              ))}
          </div>
          <div className="actions">
            <Button
              secondary
              onClick={() =>
                narrator.speak(
                  "Accessibility controls are available. Use Tab to move between controls.",
                  "無障礙控制可供使用。請用 Tab 在控制項之間移動。",
                  "accessibility",
                  true,
                )
              }
            >
              {t("Read keyboard help")}
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
            <Button secondary onClick={() => setHide(true)}>
              {t("Hide accessibility button")}
            </Button>
          </div>
        </Modal>
      )}
      {hide && (
        <Modal
          title={t("Hide accessibility button")}
          onClose={() => setHide(false)}
        >
          <p>
            {t(
              "Restore from Settings → Accessibility. Your preferences are kept.",
            )}
          </p>
          <div className="actions">
            {React.createElement(
              "md-outlined-button",
              { id: "accessibility-cancel", onClick: () => setHide(false) },
              t("Cancel"),
            )}
            <Button
              onClick={() => {
                c.update("accessibilityVisible", false);
                setHide(false);
                setOpen(false);
              }}
            >
              {t("Hide")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function AttentionStatus({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const started = useRef(Date.now()),
    last = useRef(Date.now()),
    [elapsed, setElapsed] = useState(0),
    [idle, setIdle] = useState(false);
  const prefs = c.preferences;
  useEffect(() => {
    const activity = () => {
      last.current = Date.now();
      setIdle(false);
    };
    window.addEventListener("keydown", activity);
    window.addEventListener("pointerdown", activity);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started.current) / 1000));
      if (
        prefs.momentum &&
        Date.now() - last.current >= prefs.idleMinutes * 60000 &&
        Date.now() > c.record.snoozeUntil
      )
        setIdle(true);
    }, 1000);
    return () => {
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pointerdown", activity);
      clearInterval(timer);
    };
  }, [prefs.momentum, prefs.idleMinutes, c.record.snoozeUntil]);
  return (
    <>
      {(prefs.timeAwareness || prefs.oneThing) && (
        <aside className="attention-status" aria-label={t("Focus and time")}>
          {prefs.timeAwareness && (
            <span>
              {t("Session elapsed")}: {Math.floor(elapsed / 60)}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
          )}
          {prefs.oneThing && (
            <span>
              {prefs.nextAction || t("Choose your next action in Settings.")}
            </span>
          )}
        </aside>
      )}
      {idle && (
        <aside className="idle-notice" role="status">
          <p>
            {t("No keyboard or pointer activity for")} {prefs.idleMinutes}{" "}
            {t("minutes")}.
          </p>
          <Button
            secondary
            onClick={() => {
              c.persist((old) => ({
                ...old,
                snoozeUntil: Date.now() + prefs.snoozeMinutes * 60000,
              }));
              setIdle(false);
            }}
          >
            {t("Not now")} ({prefs.snoozeMinutes} {t("minutes")})
          </Button>
        </aside>
      )}
    </>
  );
}
export function Toasts({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const p = c.preferences,
    d = new Date(clock),
    quiet =
      p.quietEnabled &&
      timeWindowMatches(
        p.quietStart,
        p.quietEnd,
        d.getHours() * 60 + d.getMinutes(),
      );
  const visible = c.record.notices
    .filter(
      (n) =>
        !n.dismissed &&
        (["warning", "error"].includes(n.kind) ||
          (!quiet &&
            !p.lowStimulation &&
            clock - Date.parse(n.at) < p.toastSeconds * 1000)),
    )
    .slice(-3);
  return (
    <div className="toast-stack" aria-label={t("Notifications")}>
      {visible.map((n) => (
        <div
          className={`toast ${n.kind}`}
          key={n.id}
          role={n.kind === "error" ? "alert" : "status"}
        >
          <p>{n.message}</p>
          <Button secondary onClick={() => c.dismiss([n.id])}>
            {t("Dismiss")}
          </Button>
        </div>
      ))}
    </div>
  );
}
