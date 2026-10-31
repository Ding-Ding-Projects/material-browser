import React, { useEffect, useRef, useState } from "react";
import { operationFailure } from "../operation-errors.mjs";
import { request } from "../api";
import { Avatar, Btn, ButtonGroup, Checkbox, IconBtn, Ms, Radio, cx } from "../m3";
import { useApp, elapsed, engineLabel, automationLabel } from "./context";
import { appearanceFor } from "./appearance";

const AUTOMATION_HELP: Record<string, string> = {
  off: "No driver is attached. The browser behaves like an ordinary window.",
  selenium: "Selenium attaches a WebDriver session you can script from your own tools.",
  puppeteer: "Puppeteer attaches a DevTools session you can script from your own tools.",
};

export function LaunchPage() {
  const app = useApp();
  const { t, profiles, launchTarget, navigate, runtimes, now, operations, refresh, refreshRuntime, settings, narrator, pending } = app;
  const profile = profiles.find((p) => p.id === launchTarget);
  const [automation, setAutomation] = useState(profile?.automation || "off");
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [engines, setEngines] = useState<any[]>([]);
  const [error, setError] = useState("");
  const launching = useRef(false);
  useEffect(() => {
    setAutomation(profile?.automation || "off");
    setReviews({});
    setError("");
  }, [profile?.id]);
  useEffect(() => {
    request("engines.list")
      .then((value) => setEngines(Array.isArray(value) ? value : value?.engines || []))
      .catch(() => setEngines([]));
  }, []);
  if (!profile) return null;
  const look = appearanceFor(profile.id);
  const required: [string, string][] = [
    ["identity", "Stable browser identity is unavailable, so this launch uses the engine’s standard identity."],
    ...(automation !== "off"
      ? ([
          ["control", "Automation can read and control pages in this profile while it runs."],
          ["local", "The driver listens on this computer only (127.0.0.1)."],
        ] as [string, string][])
      : []),
  ];
  const left = required.filter(([key]) => !reviews[key]).length;
  const versionOf = (engine: string) => {
    const found = engines.find((e) => e?.engine === engine || e?.kind === engine || e?.id === engine);
    return found?.version ? `${found.version} · ${t("bundled with the app")}` : t("Bundled engine is verified when it starts");
  };
  const busy = pending.includes(profile.id) || pending.includes("*");
  const running = runtimes.some((r) => r.profileId === profile.id);
  const launch = async () => {
    if (launching.current || left > 0) return;
    launching.current = true;
    setError("");
    const reservation = await operations.runMany([profile.id], async () => {
      try {
        if (automation !== profile.automation) await request("profiles.update", { id: profile.id, automation });
        await request("profiles.launch", { id: profile.id, requireStableIdentity: false });
        try {
          localStorage.setItem(`launch.reviewed.${profile.id}`, JSON.stringify({ automation, at: Date.now() }));
        } catch {}
        await refresh();
        await refreshRuntime();
        const message = `${profile.name} ${t("is running")}`;
        void settings.notify(message, "success");
        narrator.speak(`${profile.name} is running`, `${profile.name} 已經啟動`, "success");
        navigate("profiles", { profile: profile.id });
      } catch (e) {
        const [english, cantonese] = operationFailure(e);
        setError(t(english));
        void settings.notify(english, "error");
        narrator.speak(english, cantonese, "error");
      }
    });
    if (!reservation.accepted) setError(t("Another action for this profile is still running."));
    launching.current = false;
  };
  const steps = [
    `${t("The vault decrypts")} ${profile.name} ${t("into a private working folder.")}`,
    automation === "off"
      ? `${engineLabel(profile.engine)} ${t("starts without automation.")}`
      : `${engineLabel(profile.engine)} ${t("starts with the")} ${automationLabel(automation, t)} ${t("driver attached.")}`,
    t("When you stop, changes are encrypted back and the folder is removed."),
  ];
  return (
    <>
      <section className="pane scroll" aria-labelledby="launch-h" style={{ flex: 1, padding: "16px 32px 32px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: -12 }}>
          <IconBtn icon="arrow_back" label={t("Back to Profiles")} onClick={() => navigate("profiles")} />
          <span className="label-l on-sv">{t("Profiles")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <Avatar name={profile.name} seed={profile.id} size="xl" shape={look.shape} tone={look.tone} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 id="launch-h" className="display-s em">{t("Launch")} {profile.name}</h1>
            <p className="body-l on-sv">{t("Choose how this profile opens. Your choice is remembered.")}</p>
          </div>
        </div>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="engine-h">
          <h2 id="engine-h" className="title-m">{t("Browser engine")}</h2>
          <div className="seglist" role="radiogroup" aria-labelledby="engine-h">
            {["chromium", "firefox"].map((engine) => {
              const on = engine === profile.engine;
              return (
                <button
                  key={engine}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-disabled={!on}
                  tabIndex={on ? 0 : -1}
                  className={cx("li tall sl", on && "sel")}
                  style={on ? undefined : { cursor: "default" }}
                >
                  <Radio on={on} />
                  <Ms name={engine === "chromium" ? "public" : "travel_explore"} />
                  <span className="txt">
                    <span>{engineLabel(engine)}</span>
                    <span className="sup">{on ? versionOf(engine) : t("Fixed when the profile was created. Create a new profile to use it.")}</span>
                  </span>
                  {on && <span className="trail">{t("This profile")}</span>}
                </button>
              );
            })}
          </div>
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="auto-h">
          <h2 id="auto-h" className="title-m">{t("Automation")}</h2>
          <ButtonGroup
            label={t("Automation")}
            value={automation}
            onChange={(value) => {
              setAutomation(value);
              setReviews((r) => ({ identity: r.identity }));
            }}
            options={[["off", t("Off")], ["selenium", "Selenium"], ["puppeteer", "Puppeteer"]]}
          />
          <p className="body-m on-sv">{t(AUTOMATION_HELP[automation])}</p>
        </section>
        <section className="card tint-t" style={{ padding: "20px 20px 12px", borderRadius: 24, display: "flex", flexDirection: "column", gap: 4 }} aria-labelledby="review-h">
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 8 }}>
            <Ms name="fact_check" />
            <h2 id="review-h" className="title-m">{t("Review before launch")}</h2>
          </div>
          {required.map(([key, text]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
              <Checkbox checked={!!reviews[key]} label={t(text)} onChange={(value) => setReviews({ ...reviews, [key]: value })} />
              <span className="body-m" aria-hidden="true">{t(text)}</span>
            </div>
          ))}
        </section>
        {error && (
          <div className="card tint-e" role="alert" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}>
            <Ms name="error" />
            <p className="body-m">{error}</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Btn size="m" icon="rocket_launch" disabled={left > 0 || busy || running} onClick={() => void launch()}>
            {t("Launch")} {engineLabel(profile.engine)}
          </Btn>
          <Btn variant="text" onClick={() => navigate("profiles")}>{t("Cancel")}</Btn>
          <span className="body-s on-sv" role="status">
            {running
              ? t("Already running")
              : busy
                ? t("Starting…")
                : left === 0
                  ? t("Ready to launch")
                  : left === 1
                    ? t("One review left to confirm")
                    : `${left} ${t("reviews left to confirm")}`}
          </span>
        </div>
      </section>
      <aside className="pane scroll hide-s" aria-label={t("About launching")} style={{ width: 380, flexShrink: 0, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="title-l">{t("What happens")}</h2>
          <ol className="seglist">
            {steps.map((step, index) => (
              <li key={index} className="li tall">
                <div className="av s" aria-hidden="true">{index + 1}</div>
                <span className="txt body-m">{step}</span>
              </li>
            ))}
          </ol>
        </section>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="title-l">{t("Running now")}</h2>
          {runtimes.length === 0 ? (
            <p className="body-m on-sv">{t("No browsers are running.")}</p>
          ) : (
            <div className="seglist">
              {runtimes.map((runtime) => {
                const p = profiles.find((x) => x.id === runtime.profileId);
                if (!p) return null;
                const pl = appearanceFor(p.id);
                return (
                  <div key={runtime.profileId} className="li">
                    <Avatar name={p.name} seed={p.id} shape={pl.shape} tone={pl.tone} />
                    <span className="txt">
                      <span>{p.name}</span>
                      <span className="sup">
                        {runtime.effectiveMode === "off" ? engineLabel(p.engine) : automationLabel(runtime.effectiveMode, t)} · {elapsed(runtime.seenAt, now, t)}
                      </span>
                    </span>
                    <Btn variant="text" disabled={pending.includes(p.id)} onClick={() => app.requireUnlock(p.id, () =>
                      void app.perform(async () => {
                        await request("profiles.stop", { id: p.id });
                        await refreshRuntime();
                      }, [p.id], ["Stopped", "已停止"]))}>
                      {t("Stop")}
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </aside>
    </>
  );
}
