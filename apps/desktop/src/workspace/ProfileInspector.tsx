import React, { useState } from "react";
import { Profile } from "../api";
import { Button, Select, Tabs } from "../components";
import { Search } from "../Search";
import { observedRuntime } from "./model.mjs";
type Props = {
  profile?: Profile;
  runtime: any;
  tab: string;
  revisions: any[];
  revisionKeys: string[];
  draftAutomation: string;
  busy: boolean;
  unlocked: boolean;
  t: (s: string) => string;
  setShowDetail: (value: boolean) => void;
  setTab: (value: string) => void;
  loadRevisions: () => Promise<void>;
  date: (value?: number | string) => string;
  onLaunch: (profile: Profile) => void;
  act: (method: string, label: string, targets: Profile[]) => void;
  setDraftName: (value: string) => void;
  setEditing: (value: boolean) => void;
  setRevisionKeys: (keys: string[]) => void;
  setReview: (value: any) => void;
  setDraftAutomation: (value: string) => void;
  execute: (
    method: string,
    targets: Profile[],
    extra?: Record<string, unknown>,
  ) => Promise<boolean>;
};
export function ProfileInspector({
  profile,
  runtime,
  tab,
  revisions,
  revisionKeys,
  draftAutomation,
  busy,
  unlocked,
  t,
  setShowDetail,
  setTab,
  loadRevisions,
  date,
  onLaunch,
  act,
  setDraftName,
  setEditing,
  setRevisionKeys,
  setReview,
  setDraftAutomation,
  execute,
}: Props) {
  const [automationMatches, setAutomationMatches] = useState<number[]>([0]);
  return (
    <section
      className="surface profile-inspector"
      aria-label={t("Profile details")}
    >
      {profile ? (
        <>
          <button className="back-to-list" onClick={() => setShowDetail(false)}>
            ← {t("Back to profiles")}
          </button>
          <div className="detail-heading">
            <span className="avatar" aria-hidden="true">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{profile.name}</h2>
              <p>
                {profile.engine} · {t(observedRuntime(runtime))}
              </p>
            </div>
          </div>
          <Tabs
            panelPrefix="profile-panel"
            items={["overview", "revisions", "automation"].map((key) => [
              key,
              t(key[0].toUpperCase() + key.slice(1)),
            ])}
            value={tab}
            onChange={(value) => {
              setTab(value);
              if (value === "revisions") void loadRevisions();
            }}
          />
          <div role="tabpanel" id={`profile-panel-${tab}`}>
            {tab === "overview" ? (
              <>
                <dl className="profile-facts">
                  <dt>{t("Updated")}</dt>
                  <dd>{date(profile.updatedAt)}</dd>
                  <dt>{t("Created")}</dt>
                  <dd>{date(profile.createdAt)}</dd>
                  <dt>{t("Saved preference")}</dt>
                  <dd>{profile.automation}</dd>
                  <dt>{t("Runtime")}</dt>
                  <dd>{t(observedRuntime(runtime))}</dd>
                  <dt>{t("Effective mode")}</dt>
                  <dd>{runtime?.effectiveMode || t("Unavailable")}</dd>
                </dl>
                <div className="actions">
                  <Button
                    disabled={busy || !unlocked}
                    onClick={() => onLaunch({ ...profile })}
                  >
                    {t("Launch")}
                  </Button>
                  {[
                    ["profiles.focus", "Focus"],
                    ["profiles.stop", "Stop"],
                    ["profiles.duplicate", "Duplicate"],
                    ["profiles.snapshot", "Snapshot"],
                  ].map(([method, label]) => (
                    <Button
                      key={method}
                      secondary
                      disabled={busy || !unlocked}
                      onClick={() => act(method, label, [profile])}
                    >
                      {t(label)}
                    </Button>
                  ))}
                  <Button
                    secondary
                    disabled={busy || !unlocked}
                    onClick={() => {
                      setDraftName(profile.name);
                      setEditing(true);
                    }}
                  >
                    {t("Edit name")}
                  </Button>
                  <Button
                    secondary
                    disabled={busy || !unlocked}
                    onClick={() => act("profiles.remove", "Remove", [profile])}
                  >
                    {t("Remove")}
                  </Button>
                </div>
                <p className="help">
                  {t(
                    "Actions depend on native host capabilities. An unavailable action reports its actual reason.",
                  )}
                </p>
                <details>
                  <summary>{t("Profile identity")}</summary>
                  <dl>
                    <dt>ID</dt>
                    <dd>{profile.id}</dd>
                    {Object.entries(profile.identity || {}).map(
                      ([key, value]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd>
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </dd>
                        </React.Fragment>
                      ),
                    )}
                  </dl>
                </details>
              </>
            ) : tab === "revisions" ? (
              <>
                <Search
                  label={t("Search revisions")}
                  items={revisions.map((r) => `${r.id} ${r.createdAt}`)}
                  itemKeys={revisions.map((r) => r.id)}
                  onKeys={setRevisionKeys}
                  t={t}
                />
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void loadRevisions()}
                >
                  {t("Refresh")}
                </Button>
                {!revisions.length && <p>{t("No revisions")}</p>}
                {revisions
                  .filter((r) => revisionKeys.includes(r.id))
                  .map((r) => (
                    <article className="record" key={r.id}>
                      <strong className="literal">{r.id}</strong>
                      <p>{date(r.createdAt)}</p>
                      <Button
                        secondary
                        disabled={busy || !unlocked}
                        onClick={() =>
                          setReview({
                            method: "revisions.restore",
                            label: "Restore",
                            targets: [profile],
                            revisionId: r.id,
                          })
                        }
                      >
                        {t("Restore")}
                      </Button>
                    </article>
                  ))}
              </>
            ) : (
              <>
                <Search
                  label={t("Search automation")}
                  items={["Off Selenium Puppeteer saved effective restart"]}
                  onResults={setAutomationMatches}
                  t={t}
                />
                <div hidden={automationMatches.length === 0}>
                  <dl>
                    <dt>{t("Saved preference")}</dt>
                    <dd>{profile.automation}</dd>
                    <dt>{t("Effective mode")}</dt>
                    <dd>{runtime?.effectiveMode || t("Unavailable")}</dd>
                  </dl>
                  {runtime?.effectiveMode &&
                    runtime.effectiveMode !== profile.automation && (
                      <p role="status">{t("Restart required")}</p>
                    )}
                  <Select
                    label={t("Automation")}
                    value={draftAutomation}
                    onChange={setDraftAutomation}
                    options={["off", "selenium", "puppeteer"].map((value) => [
                      value,
                      value === "off" ? t("Off") : value,
                    ])}
                  />
                  <p>
                    {t(
                      "Saving changes the preference. Running profiles keep their effective mode until restarted.",
                    )}
                  </p>
                  <Button
                    disabled={
                      busy ||
                      !unlocked ||
                      draftAutomation === profile.automation
                    }
                    onClick={() =>
                      void execute("profiles.update", [profile], {
                        automation: draftAutomation,
                      })
                    }
                  >
                    {t("Save preference")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="empty">
          <h2>{t("Select a profile")}</h2>
          <p>{t("Choose a row to view its data and available actions.")}</p>
        </div>
      )}
    </section>
  );
}
