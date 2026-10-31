import React, { useEffect, useState } from "react";
import { request, type PasswordManagerDetection } from "../api";
import { Avatar, Btn, LinearProgress, Ms, PasswordField, cx } from "../m3";
import { recommendedSource } from "../password-manager-model.mjs";
import { useApp } from "./context";
import { SupportTickets } from "./Safety";
import { readManagerDefaults, writeManagerDefaults } from "./manager-defaults";

export function VaultUnlock() {
  const { t, status, perform, refresh, busy } = useApp();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tickets, setTickets] = useState(false);
  const creating = !status?.exists;
  const mismatch = creating && confirm.length > 0 && confirm !== password;
  const submit = () => {
    if (!password || busy || (creating && confirm !== password)) return;
    const secret = password;
    setPassword("");
    setConfirm("");
    void perform(async () => {
      await request(creating ? "vault.create" : "vault.unlock", { password: secret });
      await refresh();
    }, ["*"], creating ? ["Vault created", "已建立保險庫"] : ["Vault unlocked", "保險庫已解鎖"]);
  };
  const join = () => {
    if (!password || busy) return;
    void perform(async () => {
      const chosen = await window.materialBrowser?.chooseDirectory();
      if (!chosen) return;
      const secret = password;
      setPassword("");
      await request("vault.join", { folder: chosen, password: secret });
      await refresh();
    }, ["*"], ["Joined the vault", "已加入保險庫"]);
  };
  return (
    <section className="pane" aria-labelledby="unlock-h" style={{ flex: "1 1 380px", maxWidth: 480, padding: "40px 32px 32px", display: "flex", flexDirection: "column", gap: 24, ["--tf-bg" as string]: "var(--surface)" }}>
      <Avatar name="" size="xl" tone="p" shape="shape-cookie" icon="lock" />
      <div>
        <h1 id="unlock-h" className="headline-l em">{t(creating ? "Create your vault" : "Unlock your vault")}</h1>
        <p className="body-l on-sv">
          {t(creating
            ? "Profiles are encrypted on this computer with a passphrase only you know. It is never saved."
            : "Your profiles are encrypted on this computer. Enter your vault passphrase to open them.")}
        </p>
      </div>
      <PasswordField label={t("Vault passphrase")} value={password} onChange={setPassword} autoFocus disabled={!status}
        showLabel={t("Show passphrase")} hideLabel={t("Hide passphrase")}
        onKeyDown={(e) => e.key === "Enter" && !creating && submit()} />
      {creating && (
        <PasswordField label={t("Repeat passphrase")} value={confirm} onChange={setConfirm} disabled={!status}
          error={mismatch ? t("The passphrases do not match") : undefined}
          showLabel={t("Show passphrase")} hideLabel={t("Hide passphrase")}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
      )}
      <Btn size="m" icon={creating ? "enhanced_encryption" : "lock_open"} disabled={!status || busy || !password || (creating && confirm !== password)} onClick={submit}>
        {t(creating ? "Create vault" : "Unlock")}
      </Btn>
      {!status && (
        <div className="card tint-e" role="alert" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <Ms name="error" />
          <p className="body-m" style={{ flex: 1 }}>{t("The native host is not connected. No profile data is simulated.")}</p>
          <Btn variant="text" onClick={() => void perform(refresh)}>{t("Retry")}</Btn>
        </div>
      )}
      <div className="div" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "0 -12px" }}>
        {creating && (
          <Btn variant="text" icon="devices" style={{ justifyContent: "flex-start" }} disabled={!password || busy || !status} onClick={join}
            title={t("Enter the shared vault passphrase first, then choose its sync folder")}>
            {t("Join a vault from another computer")}
          </Btn>
        )}
        <Btn variant="text" icon="confirmation_number" style={{ justifyContent: "flex-start" }} onClick={() => setTickets(true)}>
          {t("Locked out? Open Support Tickets")}
        </Btn>
      </div>
      {tickets && <SupportTickets about={t("my vault")} onClose={() => setTickets(false)} />}
    </section>
  );
}

const STEPS: [string, string, string][] = [
  ["Create the vault", "Encrypted with your passphrase", ""],
  ["Connect a password manager", "Optional · KeePassXC", ""],
  ["Add sync storage", "Optional · you can skip this", ""],
  ["Create your first profile", "Profiles opens when you finish", ""],
];

export function FirstRun({ step, setStep, onFinish }: { step: number; setStep: (n: number) => void; onFinish: () => void }) {
  const { t, status, profiles, perform, busy, openCreate } = useApp();
  const unlocked = status?.unlocked === true;
  const current = unlocked ? Math.max(1, step) : 0;
  const [detection, setDetection] = useState<PasswordManagerDetection | null>(null);
  const [folder, setFolder] = useState("");
  const defaults = readManagerDefaults();
  useEffect(() => {
    if (current === 1 && !detection)
      request("passwordManager.detect").then(setDetection).catch(() => setDetection(null));
  }, [current]);
  const done = (index: number) =>
    index === 0 ? !!status?.exists : index === 1 ? defaults.enabled : index === 2 ? !!folder : profiles.length > 0;
  const support = (index: number) => {
    if (index === 0) return t(status?.exists ? "Encrypted with your passphrase" : "Choose a passphrase on the left");
    if (index === 1)
      return detection
        ? t(detection.installed ? "KeePassXC found on this computer" : detection.wslAvailable ? "KeePassXC can come from WSL" : "KeePassXC was not found · you can skip this")
        : t(STEPS[1][1]);
    if (index === 2) return folder ? folder : t(STEPS[2][1]);
    return profiles.length ? `${profiles.length} ${t(profiles.length === 1 ? "profile ready" : "profiles ready")}` : t(STEPS[3][1]);
  };
  const action = (index: number) => {
    if (index !== current || !unlocked) return null;
    if (index === 1)
      return (
        <Btn disabled={busy || !detection || recommendedSource(detection) === "none"} onClick={() => {
          writeManagerDefaults({ ...defaults, enabled: true, source: recommendedSource(detection) === "wsl" ? "wsl" : "installed" });
          setStep(2);
        }}>{t("Connect")}</Btn>
      );
    if (index === 2)
      return (
        <Btn disabled={busy} onClick={() => void perform(async () => {
          const chosen = await window.materialBrowser?.chooseDirectory();
          if (!chosen) return;
          await request("sync.configure", { folder: chosen });
          setFolder(chosen);
          setStep(3);
        }, ["*"], ["Sync storage added", "已加入同步儲存位置"])}>{t("Choose folder")}</Btn>
      );
    if (index === 3) return <Btn disabled={busy} onClick={openCreate}>{t("Create")}</Btn>;
    return null;
  };
  return (
    <section className="pane" aria-labelledby="setup-h" style={{ flex: "1 1 440px", maxWidth: 600, padding: "40px 32px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
      <span className="label-l c-primary">{t("First run")} · {t("step")} {current + 1} {t("of")} 4</span>
      <LinearProgress thick value={(current + 1) / 4} label={t("Setup progress")} />
      <h2 id="setup-h" className="headline-m em">{t("Set up in four steps")}</h2>
      <ol className="seglist">
        {STEPS.map(([title], index) => (
          <li key={title} className={cx("li tall", index === current && "sel")} aria-current={index === current ? "step" : undefined}>
            {done(index) && index !== current ? (
              <Avatar name="" tone="p" shape="shape-pill" icon="check" />
            ) : (
              <div className={cx("av", index === current ? "t shape-sunny" : "s")} aria-hidden="true">{index + 1}</div>
            )}
            <span className="txt">
              <span>{t(title)}</span>
              <span className="sup">{support(index)}</span>
            </span>
            {action(index) || (done(index) && index !== current ? <span className="trail">{t("Done")}</span> : null)}
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn variant="text" icon="arrow_back" disabled={!unlocked || current <= 1} onClick={() => setStep(current - 1)}>{t("Back")}</Btn>
        <span style={{ flex: 1 }} />
        <Btn variant="outlined" disabled={!unlocked || current === 0} onClick={() => (current >= 3 ? onFinish() : setStep(current + 1))}>
          {t(current >= 3 ? "Finish later" : "Skip this step")}
        </Btn>
        <Btn trailingIcon="arrow_forward" disabled={!unlocked || (current === 3 && !profiles.length)} onClick={() => (current >= 3 ? onFinish() : setStep(current + 1))}>
          {t(current >= 3 ? "Finish" : "Next")}
        </Btn>
      </div>
      <p className="body-s on-sv">{t("Progress is saved. You can close the app and continue later.")}</p>
    </section>
  );
}
