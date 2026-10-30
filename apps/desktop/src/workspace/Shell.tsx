import React, { useEffect, useRef, useState } from "react";
import {
  mdiAccountMultipleOutline,
  mdiLayersTripleOutline,
  mdiSync,
  mdiCogOutline,
  mdiTuneVariant,
  mdiLockOutline,
  mdiCompassOutline,
  mdiTabPlus,
  mdiMenu,
  mdiChevronDown,
  mdiMagnify,
  mdiBellOutline,
  mdiHuman,
  mdiShieldLockOutline,
  mdiPlus,
  mdiMinus,
  mdiWindowMaximize,
  mdiWindowRestore,
  mdiClose,
} from "../icons";
import { APP_VERSION } from "../build-version";
import { Button } from "../components";
import { Icon } from "../Icon";
import { request } from "../api";

export function WorkspaceHeader({
  prefs,
  displayName,
  t,
  status,
  setPalette,
  onNotifications,
}: any) {
  const [maximized, setMaximized] = useState(false);
  const [windowError, setWindowError] = useState(false);
  useEffect(() => window.materialBrowser?.onEvent((event: any) => { if (event?.type === "window-state") setMaximized(event.maximized === true); }), []);
  const windowAction = async (action: "minimize" | "maximize" | "restore" | "close") => {
    try { const state = await window.materialBrowser?.windowAction?.(action); if (state) setMaximized(state.maximized); else setWindowError(true); } catch { setWindowError(true); }
  };
  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        {prefs.logoPreset === "profiles" ? (
          <Icon path={mdiAccountMultipleOutline} />
        ) : prefs.logoPreset === "compass" ? (
          <Icon path={mdiCompassOutline} />
        ) : (
          <Icon path={mdiShieldLockOutline} />
        )}
      </div>
      <div className="identity">
        <strong>{displayName || "Material Browser"}</strong>
        <small>
          {t("Version")} {APP_VERSION} · {t("Updated")}: {t("Unavailable")}
        </small>
      </div>
      <button className="global-search" onClick={() => setPalette(true)}>
        <Icon path={mdiMagnify} size={21} /><span>{t("Search destinations and settings")}</span><kbd>Ctrl+Shift+F</kbd>
      </button>
      <span className="connection" data-connected={status?.unlocked === true}>
        <span className="connection-dot" aria-hidden="true" />{t(status ? status.unlocked ? "Vault unlocked" : "Locked" : "Backend unavailable")}
      </span>
      <button className="icon-control" aria-label={t("Notifications")} title={t("Notifications")} onClick={onNotifications}><Icon path={mdiBellOutline} size={22} /></button>
      {prefs.accessibilityVisible && <button className="icon-control" aria-label={t("Accessibility")} title={t("Accessibility")} onClick={() => window.dispatchEvent(new Event("settings-accessibility"))}><Icon path={mdiHuman} size={22} /></button>}
      {window.materialBrowser?.windowAction && <div className="window-controls">
        <button aria-label={t("Minimize")} title={t("Minimize")} onClick={() => void windowAction("minimize")}><Icon path={mdiMinus} size={20}/></button>
        <button aria-label={t(maximized ? "Restore window" : "Maximize")} title={t(maximized ? "Restore window" : "Maximize")} onClick={() => void windowAction(maximized ? "restore" : "maximize")}><Icon path={maximized ? mdiWindowRestore : mdiWindowMaximize} size={18}/></button>
        <button aria-label={t("Close window")} title={t("Close window")} onClick={() => void windowAction("close")}><Icon path={mdiClose} size={20}/></button>
      </div>}
      {windowError && <span role="alert">{t("Window action unavailable")}</span>}
    </header>
  );
}

export function WorkspaceNavigation({
  t,
  page,
  showSetup,
  setPage,
  setShowSetup,
  status,
  busy,
  perform,
  refresh,
  onCreate,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const disclosure = useRef<HTMLButtonElement>(null);
  const closeDisclosure = () => {
    if (expanded) {
      setExpanded(false);
      disclosure.current?.focus();
    }
  };
  const destinations = [
    ["profiles", "Profiles", "Profiles", mdiAccountMultipleOutline],
    [
      "super-profiles",
      "Super Profiles",
      "Super Profiles",
      mdiLayersTripleOutline,
    ],
    ["sync", "Synchronization", "Sync", mdiSync],
    ["settings", "Settings", "Settings", mdiCogOutline],
  ];
  return (
    <nav
      className={`workspace-nav${expanded ? " is-expanded" : ""}`}
      aria-label={t("Workspace")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          event.stopPropagation();
          closeDisclosure();
        }
      }}
    >
      <button
        ref={disclosure}
        className="workspace-disclosure"
        aria-expanded={expanded}
        aria-controls="workspace-destinations"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon path={mdiMenu} size={22} />
        <span>{t("Workspace")}</span>
        <Icon path={mdiChevronDown} size={20} />
      </button>
      <button className="rail-create" aria-label={t("Create profile")} title={t("Create profile")} disabled={!status?.unlocked || busy} onClick={onCreate}><Icon path={mdiPlus} size={24} /></button>
      <div id="workspace-destinations" className="workspace-destinations">
        <div className="workspace-primary">
          {destinations.map(([id, label, shortLabel, icon]) => (
            <button
              key={id}
              className={`rail-destination${page === id && !showSetup ? " active" : ""}`}
              aria-current={page === id && !showSetup ? "page" : undefined}
              aria-label={t(label)}
              title={t(label)}
              onClick={() => {
                setPage(id);
                setShowSetup(false);
                closeDisclosure();
              }}
            >
              <span className="nav-icon">
                <Icon path={icon} size={22} />
              </span>
              <span className="nav-label">{t(shortLabel)}</span>
            </button>
          ))}
        </div>
        <div className="workspace-utilities">
          <button
            className={`rail-destination${showSetup ? " active" : ""}`}
            aria-current={showSetup ? "page" : undefined}
            title={t("Setup")}
            onClick={() => {
              setShowSetup(true);
              closeDisclosure();
            }}
          >
            <span className="nav-icon">
              <Icon path={mdiTuneVariant} size={22} />
            </span>
            <span className="nav-label">{t("Setup")}</span>
          </button>
          <button
            className="rail-destination"
            disabled={!status?.unlocked || busy}
            title={t("Lock vault")}
            onClick={() => {
              closeDisclosure();
              void perform(async () => {
                await request("vault.lock");
                await refresh();
              });
            }}
          >
            <span className="nav-icon">
              <Icon path={mdiLockOutline} size={22} />
            </span>
            <span className="nav-label">{t("Lock vault")}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
