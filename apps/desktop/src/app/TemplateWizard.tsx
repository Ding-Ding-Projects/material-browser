import React, { useState } from "react";
import { request, type PasswordManager, type SuperProfile, type SuperProfileSettings } from "../api";
import { readSuperProfileDraft, superProfileResumeMetadata, switchSuperProfileBackend, persistSuperProfileConfiguration } from "../SuperProfiles.model.mjs";
import { buildGuestPasswordManager } from "../password-manager-model.mjs";
import { Btn, ButtonGroup, Dialog, Item, LinearProgress, Ms, SegList, Switch, TextField } from "../m3";
import { useApp } from "./context";

const KEY = "super-profile-draft-v1";
type Draft = { name: string; engine: string; settings: SuperProfileSettings; step: number };
const initial = (): Draft => ({ name: "", engine: "chromium", settings: { backend: "wsl2", launchMode: "terminal" }, step: 0 });
const TITLES = ["Template", "Environment", "Startup and files", "Review"];

function Lines({ label, value, onChange, supporting }: { label: string; value: string[]; onChange: (v: string[]) => void; supporting?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label className="tf" style={{ height: "auto", minHeight: 96, alignItems: "flex-start", padding: "16px" }}>
        <span className="lab">{label}</span>
        <textarea
          className="mono"
          rows={3}
          value={value.join("\n")}
          aria-label={label}
          onChange={(e) => onChange(e.target.value.split("\n").filter((line) => line.trim()))}
          style={{ flex: 1, border: 0, background: "transparent", color: "var(--on-surface)", font: "inherit", fontSize: 14, resize: "vertical", outline: "none", minHeight: 64 }}
        />
      </label>
      {supporting && <span className="tf-sup">{supporting}</span>}
    </div>
  );
}

export function TemplateWizard({ profile, busy, onSave, onCancel }: { profile?: SuperProfile; busy: boolean; onSave: (draft: Omit<Draft, "step">) => Promise<void>; onCancel: () => void }) {
  const { t, snack } = useApp();
  const [draft, setDraft] = useState<Draft>(() => (profile ? { ...profile, step: 0 } : initial()));
  const [check, setCheck] = useState<{ backend: string; available: boolean; modes: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const update = (value: Partial<Draft>) => setDraft((d) => ({ ...d, ...value }));
  const setting = (value: Partial<SuperProfileSettings>) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...value } }));
  const s = draft.settings;
  const wsl = s.backend === "wsl2";
  const modes = s.backend === "windows-sandbox" ? ["browser"] : ["terminal", "browser", "desktop"];
  const finish = async () => {
    setError("");
    try {
      await onSave({ name: draft.name.trim(), engine: draft.engine, settings: persistSuperProfileConfiguration(draft.settings) });
      try {
        localStorage.removeItem(KEY);
      } catch {}
    } catch {
      setError(t("The template could not be saved. Check the fields and try again."));
    }
  };
  return (
    <Dialog
      title={t(profile ? "Edit template" : "New template")}
      icon="library_add"
      width={640}
      dismissible={!busy}
      onClose={onCancel}
      actions={
        <>
          {!profile && (
            <Btn variant="text" icon="bookmark" disabled={busy} onClick={() => {
              try {
                localStorage.setItem(KEY, JSON.stringify(superProfileResumeMetadata(draft)));
                snack(t("Progress saved. Paths and commands are not kept."));
              } catch {}
            }}>{t("Save progress")}</Btn>
          )}
          <span style={{ flex: 1 }} />
          <Btn variant="text" icon="arrow_back" disabled={busy || draft.step === 0} onClick={() => update({ step: draft.step - 1 })}>{t("Back")}</Btn>
          {draft.step < 3 ? (
            <Btn trailingIcon="arrow_forward" disabled={busy || !draft.name.trim()} onClick={() => update({ step: draft.step + 1 })}>{t("Next")}</Btn>
          ) : (
            <Btn icon="save" disabled={busy || !draft.name.trim()} onClick={() => void finish()}>{t(profile ? "Save template" : "Create template")}</Btn>
          )}
        </>
      }
    >
      <span className="label-l c-primary">{t("Step")} {draft.step + 1} {t("of")} 4 · {t(TITLES[draft.step])}</span>
      <LinearProgress thick value={(draft.step + 1) / 4} label={t("Template progress")} />
      {draft.step === 0 && (
        <>
          {!profile && (
            <Btn variant="tonal" size="xs" icon="restore" style={{ alignSelf: "flex-start" }} onClick={() => {
              try {
                setDraft(readSuperProfileDraft(localStorage.getItem(KEY)));
                snack(t("Draft restored"));
              } catch {
                snack(t("No saved draft"));
              }
            }}>{t("Resume draft")}</Btn>
          )}
          <TextField label={t("Name")} value={draft.name} onChange={(name) => update({ name })} required autoFocus maxLength={256} supporting={t("Avoid confidential names; the name may be saved with your progress.")} />
          <span className="label-l">{t("Environment")}</span>
          <ButtonGroup label={t("Environment")} value={s.backend} onChange={(backend) => {
            const settings = switchSuperProfileBackend({ ...draft.settings, engine: draft.engine }, backend);
            update({ settings, engine: backend === "windows-sandbox" ? "chromium" : draft.engine });
            setCheck(null);
          }} options={[["wsl2", "WSL 2"], ["windows-sandbox", "Windows Sandbox"]]} />
          <span className="label-l">{t("Browser engine")}</span>
          <ButtonGroup label={t("Browser engine")} value={draft.engine} onChange={(engine) => update({ engine })}
            options={wsl ? [["chromium", "Chromium"], ["firefox", "Firefox"]] : [["chromium", "Chromium"]]} />
        </>
      )}
      {draft.step === 1 && (
        <>
          <span className="label-l">{t("Opens as")}</span>
          <ButtonGroup label={t("Opens as")} value={s.launchMode} onChange={(launchMode) => setting({ launchMode: launchMode as SuperProfileSettings["launchMode"] })} options={modes.map((m) => [m, t(m)] as [string, string])} />
          {wsl && (
            <>
              <TextField label={t("Root filesystem archive path")} value={s.rootfsPath || ""} onChange={(rootfsPath) => setting({ rootfsPath })} mono supporting={t("Leave both empty to use the verified managed base.")} />
              <TextField label={t("Root filesystem SHA-256")} value={s.rootfsSha256 || ""} onChange={(rootfsSha256) => setting({ rootfsSha256 })} mono />
            </>
          )}
          <TextField label={t("Workspace folder path")} value={s.workspacePath || ""} onChange={(workspacePath) => setting({ workspacePath })} mono />
          <SegList>
            <Item icon="lan" title={t("Allow network access")} support={wsl ? t("WSL networking follows the host configuration") : undefined}
              trailing={<Switch label={t("Allow network access")} disabled={wsl} checked={s.networking !== false} onChange={(networking) => setting({ networking })} />} />
            <Item icon="content_paste" title={t("Clipboard sharing")} support={t("Not configurable in this build")}
              trailing={<Switch label={t("Clipboard sharing")} disabled checked={s.clipboard === true} onChange={() => {}} />} />
          </SegList>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="outlined" icon="memory" disabled={checking} onClick={() => {
              setChecking(true);
              setCheck(null);
              const backend = s.backend;
              void request("superProfiles.capabilities").then((c: any) => {
                const r = backend === "wsl2" ? c.wsl2 : c.windowsSandbox;
                setCheck({ backend, available: r?.available === true, modes: r?.modes || [] });
              }).catch(() => setCheck({ backend, available: false, modes: [] })).finally(() => setChecking(false));
            }}>{t("Check this computer")}</Btn>
            {check && (
              <span className="stat" role="status" style={{ color: check.available ? "var(--primary)" : "var(--error)" }}>
                <Ms name={check.available ? "check_circle" : "block"} fill />
                {t(check.available ? "Available" : "Unavailable")}{check.modes.length ? ` · ${check.modes.map(t).join(", ")}` : ""}
              </span>
            )}
          </div>
        </>
      )}
      {draft.step === 2 && (
        <>
          <Lines label={t("Installer paths, one per line")} value={s.installers || []} onChange={(installers) => setting({ installers })} />
          <Lines label={t("Setup commands, one per line")} value={s.setupCommands || []} onChange={(setupCommands) => setting({ setupCommands })} />
          <Lines label={t("Startup commands, one per line")} value={s.startupCommands || []} onChange={(startupCommands) => setting({ startupCommands })} supporting={t("Commands run inside the guest. Review each one and use trusted installers.")} />
          <SegList>
            <Item icon="key" title={t("KeePassXC inside the guest")} support={wsl ? t("The guest must provide /usr/bin/keepassxc-proxy") : t("Only for WSL 2")}
              trailing={<Switch label={t("Pair the guest browser with KeePassXC inside the guest")} disabled={!wsl} checked={!!s.passwordManager}
                onChange={(on) => setting({ passwordManager: on ? ({ provider: "keepassxc", source: "wsl", wslDistribution: "guest", database: { mode: "existing", path: "" }, extension: true, passkeys: true } as PasswordManager) : null })} />} />
          </SegList>
          {s.passwordManager && (
            <TextField label={t("Guest database path (.kdbx)")} value={s.passwordManager.database.path} mono onChange={(path) => {
              try {
                setting({ passwordManager: buildGuestPasswordManager({ enabled: true, databasePath: path, databaseMode: s.passwordManager!.database.mode, extension: s.passwordManager!.extension, passkeys: s.passwordManager!.passkeys }) as PasswordManager });
              } catch {
                setting({ passwordManager: { ...s.passwordManager!, database: { ...s.passwordManager!.database, path } } });
              }
            }} />
          )}
        </>
      )}
      {draft.step === 3 && (
        <>
          <SegList>
            <Item icon="badge" overline={t("Name")} title={draft.name} />
            <Item icon="dns" overline={t("Environment")} title={wsl ? "WSL 2" : "Windows Sandbox"} />
            <Item icon="open_in_browser" overline={t("Opens as")} title={t(s.launchMode)} />
            <Item icon="public" overline={t("Engine")} title={draft.engine === "firefox" ? "Firefox" : "Chromium"} />
            <Item icon="terminal" overline={t("Commands")} title={`${(s.setupCommands || []).length} ${t("setup")} · ${(s.startupCommands || []).length} ${t("startup")} · ${(s.installers || []).length} ${t("installers")}`} />
          </SegList>
          <p>{t("Saving a template does not install prerequisites or check that this environment can launch.")}</p>
        </>
      )}
      {error && <p role="alert" className="body-m c-error">{error}</p>}
    </Dialog>
  );
}
