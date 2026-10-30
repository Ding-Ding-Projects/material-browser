import { Disclosure, DisclosureTitle, MaterialInput } from "../MaterialPrimitives";
import { Icon } from "../Icon";
import { mdiArrowLeft, mdiArrowExpandHorizontal, mdiPlay } from "../icons";
import React, { useState, useId } from "react";
import { Profile } from "../api";
import { Button, Select, Tabs } from "../components";
import { Search } from "../Search";
import { observedRuntime } from "./model.mjs";
import { describePasswordManager } from "../password-manager-model.mjs";
type Props = {
  profile?: Profile;
  width: number;
  resize: (value: number) => void;
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
  width,
  resize,
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
  const panelPrefix = useId();
  const [automationMatches, setAutomationMatches] = useState<number[]>([0]);
  return (
    <section
      className="surface profile-inspector"
      aria-label={t("Profile details")}
    >
      {profile ? (
        <>
          <button className="back-to-list" onClick={() => setShowDetail(false)}>
            <Icon path={mdiArrowLeft} size={20} /> {t("Back to profiles")}
          </button>
          <div className="detail-heading">
            <span className="avatar" aria-hidden="true">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 className="detail-title" tabIndex={-1}>{profile.name}</h2>
              <p>
                {profile.engine} · {t(observedRuntime(runtime))}
              </p>
            </div>
            <Disclosure className="inspector-resize">
              <DisclosureTitle title={t("Inspector width")}>
                <Icon path={mdiArrowExpandHorizontal} size={20} />
                <span className="sr-only">{t("Inspector width")}</span>
              </DisclosureTitle>
              <label>
                {t("Inspector width")}
                <MaterialInput
                  type="range"
                  aria-label={t("Inspector width")}
                  min="320"
                  max="360"
                  step="4"
                  value={width}
                  onChange={(event) => resize(Number(event.target.value))}
                />
                <output>{width} px</output>
              </label>
            </Disclosure>
          </div>
          <Tabs
            panelPrefix={panelPrefix}
            items={[["overview", t("Details")], ["identity", t("Identity")], ["revisions", t("History")], ["automation", t("Automation")]]}
            value={tab}
            onChange={(value) => {
              setTab(value);
              if (value === "revisions") void loadRevisions();
            }}
          />
          <div role="tabpanel" id={`${panelPrefix}-${tab}`} aria-labelledby={`${panelPrefix}-tab-${tab}`}>
            {tab === "overview" ? (
              <>
                <dl className="profile-facts">
                  <dt>ID</dt><dd className="literal">{profile.id}</dd>
                  <dt>{t("Engine")}</dt><dd>{profile.engine}</dd>
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
                  {describePasswordManager(profile.passwordManager).map(
                    ([label, value]) => (
                      <React.Fragment key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{t(value)}</dd>
                      </React.Fragment>
                    ),
                  )}
                </dl>
                {profile.passwordManager && (
                  <div className="actions">
                    <Button
                      secondary
                      disabled={busy || !unlocked}
                      onClick={() =>
                        void execute("profiles.update", [profile], {
                          passwordManager: null,
                        })
                      }
                    >
                      {t("Remove password manager pairing")}
                    </Button>
                  </div>
                )}
                <div className="actions">
                  <Button
                    disabled={busy || !unlocked}
                    onClick={() => onLaunch({ ...profile })}
                  >
                    <Icon path={mdiPlay} size={18} /> {t("Launch")}
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
                <Disclosure>
                  <DisclosureTitle>{t("Profile identity")}</DisclosureTitle>
                  <dl>
                    <dt>ID</dt>
                    <dd className="literal">{profile.id}</dd>
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
                </Disclosure>
              </>
            ) : tab === "identity" ? (
              <><h3>{t("Profile identity")}</h3><p>{t("Stable browser identity is unavailable in this build.")}</p><dl><dt>ID</dt><dd className="literal">{profile.id}</dd>{Object.entries(profile.identity || {}).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></React.Fragment>)}</dl></>
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
                {revisions.length > 0 && !revisionKeys.length && <p>{t("No results")}</p>}
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
