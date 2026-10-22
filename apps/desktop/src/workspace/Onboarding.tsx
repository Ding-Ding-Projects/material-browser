import React from "react";
import { Button, Field } from "../components";
import { request } from "../api";
export function Onboarding({
  t,
  setup,
  setSetup,
  status,
  password,
  setPassword,
  busy,
  perform,
  refresh,
  setFolder,
  profileForm,
  profiles,
  folder,
  chooseFolder,
  setShowSetup,
  setPage,
}: any) {
  return (
    <section className="surface wizard">
      <div className="eyebrow">
        {t("Setup progress")} {setup + 1}/4
      </div>
      <h1>
        {t(
          [
            "Create vault",
            "Create profile",
            "Optional synchronization",
            "Workspace ready",
          ][setup],
        )}
      </h1>
      <progress max={4} value={setup + 1} aria-label={t("Setup progress")} />
      {setup === 0 && (
        <>
          {status?.unlocked ? (
            <p>{t("Connected")}</p>
          ) : (
            <>
              <p>
                {t(
                  "Create an encrypted vault or unlock the existing vault. Passwords are never saved by this interface.",
                )}
              </p>
              <Field
                label={t("Password")}
                value={password}
                onChange={setPassword}
                type="password"
              />
              <Button
                disabled={busy || !status || !password}
                onClick={() =>
                  void perform(async () => {
                    const secret = password;
                    setPassword("");
                    await request(
                      status?.exists ? "vault.unlock" : "vault.create",
                      { password: secret },
                    );
                    await refresh();
                  })
                }
              >
                {t(status?.exists ? "Unlock vault" : "Create vault")}
              </Button>
              {!status?.exists && (
                <Button
                  secondary
                  disabled={busy || !password || !status}
                  onClick={() =>
                    void perform(async () => {
                      const chosen =
                        await window.materialBrowser?.chooseDirectory();
                      if (chosen) {
                        const secret = password;
                        setPassword("");
                        await request("vault.join", {
                          folder: chosen,
                          password: secret,
                        });
                        setFolder(chosen);
                        await refresh();
                      }
                    })
                  }
                >
                  {t("Join existing shared vault")}
                </Button>
              )}
            </>
          )}
        </>
      )}
      {setup === 1 && (
        <>
          {profileForm}
          <p>{profiles.length} profiles</p>
        </>
      )}
      {setup === 2 && (
        <>
          <p>
            {t(
              "Choose a shared folder to exchange encrypted snapshots. This step is optional.",
            )}
          </p>
          <p className="literal">{folder}</p>
          <Button disabled={busy} onClick={() => void perform(chooseFolder)}>
            {t("Choose folder")}
          </Button>
        </>
      )}
      {setup === 3 && (
        <p>
          {t(
            "Vault is unlocked and your profile workspace is ready. Managed browser launch remains subject to actual installed engine capabilities.",
          )}
        </p>
      )}
      <div className="actions">
        <Button
          secondary
          disabled={setup === 0 || busy}
          onClick={() => setSetup(setup - 1)}
        >
          {t("Back")}
        </Button>
        {setup === 2 && (
          <Button secondary onClick={() => setSetup(3)}>
            {t("Skip")}
          </Button>
        )}
        <Button
          disabled={
            busy || !status?.unlocked || (setup >= 1 && !profiles.length)
          }
          onClick={() => {
            if (setup === 3) {
              localStorage.setItem("setupComplete", "true");
              setShowSetup(false);
              setPage("profiles");
            } else setSetup(setup + 1);
          }}
        >
          {t(setup === 3 ? "Finish" : "Next")}
        </Button>
      </div>
    </section>
  );
}
