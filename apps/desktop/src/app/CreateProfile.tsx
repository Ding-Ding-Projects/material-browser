import React, { useEffect, useState } from "react";
import { request, type PasswordManagerDetection } from "../api";
import { Btn, ButtonGroup, Dialog, Dropdown, Item, Ms, SegList, Switch, TextField } from "../m3";
import { buildPasswordManager, databaseBasename, recommendedSource, wslDistributions } from "../password-manager-model.mjs";
import { useApp } from "./context";
import { readManagerDefaults } from "./manager-defaults";

export function CreateProfileDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t, perform, refresh, busy } = useApp();
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<"chromium" | "firefox">("chromium");
  const [form, setForm] = useState(() => readManagerDefaults());
  const [detection, setDetection] = useState<PasswordManagerDetection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!form.enabled || detection) return;
    request("passwordManager.detect")
      .then((value: PasswordManagerDetection) => {
        setDetection(value);
        const recommended = recommendedSource(value);
        setForm((f) => ({
          ...f,
          source: recommended === "none" ? f.source : recommended,
          wslDistribution: f.wslDistribution || wslDistributions(value)[0] || "",
        }));
      })
      .catch(() => setDetection(null));
  }, [form.enabled]);
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  let manager: unknown = null;
  let managerError = "";
  try {
    manager = buildPasswordManager(form);
  } catch (e) {
    managerError = (e as Error).message;
  }
  const valid = name.trim() && (!form.enabled || (!managerError && (form.source !== "wsl" || form.wslDistribution)));
  const create = () => {
    if (!valid || busy) return;
    setError("");
    void perform(async () => {
      const created = await request("profiles.create", { name: name.trim(), engine, ...(manager ? { passwordManager: manager } : {}) });
      await refresh();
      if (created?.id) onCreated(created.id);
      onClose();
    }, ["*"], ["Profile created", "已建立設定檔"]);
  };
  const distributions = wslDistributions(detection);
  return (
    <Dialog
      title={t("Create profile")}
      icon="person_add"
      width={520}
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" onClick={onClose}>{t("Cancel")}</Btn>
          <Btn disabled={!valid || busy} onClick={create}>{t("Create")}</Btn>
        </>
      }
    >
      <TextField label={t("Name")} value={name} onChange={setName} required autoFocus maxLength={120} onKeyDown={(e) => e.key === "Enter" && create()} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="label-l">{t("Browser engine")}</span>
        <ButtonGroup label={t("Browser engine")} value={engine} onChange={setEngine} options={[["chromium", "Chromium"], ["firefox", "Firefox"]]} />
        <span className="body-s on-sv">{t("The engine is fixed once the profile exists. Automation stays off until you choose it at launch.")}</span>
      </div>
      <SegList>
        <Item
          icon="key"
          title={t("Pair with KeePassXC")}
          support={t("The database password is never stored by this application.")}
          trailing={<Switch label={t("Pair with KeePassXC")} checked={form.enabled} onChange={(enabled) => update({ enabled })} />}
        />
        {form.enabled && (
          <>
            <div className="li" style={{ flexWrap: "wrap" }}>
              <Ms name="computer" />
              <div className="txt">
                <span>{t("KeePassXC source")}</span>
                <span className="sup">
                  {detection
                    ? t(detection.installed ? "Found on this computer" : distributions.length ? "Available inside WSL" : "Not found · install it first or choose WSL")
                    : t("Checking this computer…")}
                </span>
              </div>
              <ButtonGroup label={t("KeePassXC source")} value={form.source} onChange={(source) => update({ source })} options={[["installed", t("Installed")], ["wsl", "WSL"]]} />
            </div>
            {form.source === "wsl" && (
              <div className="li" style={{ ["--tf-bg" as string]: "var(--surface-container)" }}>
                <Ms name="terminal" />
                <div className="txt"><span>{t("WSL distribution")}</span><span className="sup">{t("Must already contain /usr/bin/keepassxc-proxy")}</span></div>
                <div style={{ width: 200 }}>
                  {distributions.length ? (
                    <Dropdown label={t("Distribution")} value={form.wslDistribution} onChange={(wslDistribution) => update({ wslDistribution })} options={distributions.map((d: string) => [d, d] as [string, string])} />
                  ) : (
                    <span className="body-s on-sv">{t("No distribution found")}</span>
                  )}
                </div>
              </div>
            )}
            <div className="li" style={{ flexWrap: "wrap" }}>
              <Ms name="database" />
              <div className="txt">
                <span>{t("Database")}</span>
                <span className="sup mono">{form.databasePath ? databaseBasename(form.databasePath) : t("No file chosen")}</span>
              </div>
              <ButtonGroup label={t("Database")} value={form.databaseMode} onChange={(databaseMode) => update({ databaseMode })} options={[["existing", t("Existing")], ["create", t("New")]]} />
              <Btn variant="text" onClick={() => void window.materialBrowser?.chooseDatabaseFile().then((path) => path && update({ databasePath: path }))}>{t("Choose")}</Btn>
            </div>
            <Item icon="extension" title={t("Browser extension")} support={t("Fills passwords inside this profile")}
              trailing={<Switch label={t("Install the KeePassXC browser extension")} checked={form.extension} onChange={(extension) => update({ extension })} />} />
            <Item icon="passkey" title={t("Passkeys")} support={t("Stored in KeePassXC, not in the browser")}
              trailing={<Switch label={t("Enable passkeys")} checked={form.passkeys} onChange={(passkeys) => update({ passkeys })} />} />
          </>
        )}
      </SegList>
      {form.enabled && managerError && form.databasePath && <p className="body-s c-error" role="alert">{t("Choose a .kdbx database file.")}</p>}
      {form.enabled && <p className="body-s on-sv">{t("The browser still asks once to enable the extension. Nothing is installed silently.")}</p>}
      {error && <p className="body-m c-error" role="alert">{error}</p>}
    </Dialog>
  );
}
