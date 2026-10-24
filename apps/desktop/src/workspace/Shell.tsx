import React, { useRef, useState } from "react";
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
} from "@mdi/js";
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
}: any) {
  return (
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">
        {prefs.logoPreset === "profiles" ? (
          <Icon path={mdiAccountMultipleOutline} />
        ) : prefs.logoPreset === "compass" ? (
          <Icon path={mdiCompassOutline} />
        ) : (
          "M"
        )}
      </div>
      <div className="identity">
        <strong>{displayName || "Material Browser"}</strong>
        <small>
          {t("Version")} {APP_VERSION} · {t("Updated")}: {t("Unavailable")}
        </small>
      </div>
      <span className="connection" data-connected={status?.unlocked === true}>
        <span className="connection-dot" aria-hidden="true" />
        {t(
          status
            ? status.unlocked
              ? "Connected"
              : "Locked"
            : "Backend unavailable",
        )}
      </span>
      <Button secondary onClick={() => setPalette(true)}>
        <Icon path={mdiTabPlus} size={20} /> {t("New tab")}{" "}
        <kbd>Ctrl Shift F</kbd>
      </Button>
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
