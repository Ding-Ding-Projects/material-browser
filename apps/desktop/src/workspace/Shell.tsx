import React from "react";
import { APP_VERSION } from "../build-version";
import { Button } from "../components";
import { request } from "../api";
export function WorkspaceHeader({
  prefs,
  displayName,
  t,
  status,
  setPalette,
}: any) {
  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        {prefs.logoPreset === "profiles"
          ? "▤"
          : prefs.logoPreset === "compass"
            ? "◇"
            : "M"}
      </div>
      <div className="identity">
        <strong>{displayName || "Material Browser"}</strong>
        <small>
          {t("Version")} {APP_VERSION} · {t("Updated")}: {t("Unavailable")}
        </small>
      </div>
      <span className="connection">
        {t(
          status
            ? status.unlocked
              ? "Connected"
              : "Locked"
            : "Backend unavailable",
        )}
      </span>
      <Button secondary onClick={() => setPalette(true)}>
        {t("New tab")} <kbd>Ctrl Shift F</kbd>
      </Button>
    </header>
  );
}
export function WorkspaceNavigation({
  t,
  page,
  setPage,
  setShowSetup,
  status,
  busy,
  perform,
  refresh,
}: any) {
  return (
    <nav className="workspace-nav" aria-label={t("Workspace")}>
      {[
        ["profiles", "Profiles"],
        ["super-profiles", "Super Profiles"],
        ["sync", "Synchronization"],
        ["settings", "Settings"],
      ].map(([id, label]) => (
        <button
          key={id}
          className={page === id ? "active" : ""}
          onClick={() => {
            setPage(id);
            if (id === "settings") setShowSetup(false);
          }}
        >
          <span className="nav-icon" aria-hidden="true">
            {id === "profiles" ? "▤" : id === "sync" ? "⇄" : "⚙"}
          </span>
          {t(label)}
        </button>
      ))}
      <button onClick={() => setShowSetup(true)}>{t("Setup")}</button>
      <button
        disabled={!status?.unlocked || busy}
        onClick={() =>
          void perform(async () => {
            await request("vault.lock");
            await refresh();
          })
        }
      >
        {t("Lock vault")}
      </button>
    </nav>
  );
}
