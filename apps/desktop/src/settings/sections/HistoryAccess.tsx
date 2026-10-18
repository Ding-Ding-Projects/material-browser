import React, { useState } from "react";
import { Button, Field } from "../../components";
import type { ProtectedHistoryController } from "../protected-history";
export function HistoryAccess({
  history: h,
  t,
}: {
  history: ProtectedHistoryController;
  t: (value: string) => string;
}) {
  const [secret, setSecret] = useState(""),
    [confirm, setConfirm] = useState(""),
    [oldSecret, setOldSecret] = useState("");
  const configured = h.status?.configured;
  async function authorize() {
    if (
      !configured &&
      (secret.length < 6 || secret.length > 256 || secret !== confirm)
    ) {
      h.setError(
        "Use 6–256 characters and enter the same password or PIN twice.",
      );
      return;
    }
    try {
      await h.run(configured ? "history-unlock" : "history-setup", { secret });
    } finally {
      setSecret("");
      setConfirm("");
    }
  }
  async function changePassword() {
    if (secret.length < 6 || secret.length > 256 || secret !== confirm) {
      h.setError(
        "Use 6–256 characters and enter the same password or PIN twice.",
      );
      return;
    }
    try {
      await h.run("history-change-password", { oldSecret, newSecret: secret });
    } finally {
      setOldSecret("");
      setSecret("");
      setConfirm("");
    }
  }
  if (!h.status?.ok) return null;
  return (
    <section className="setting-card">
      <h3>{t("Independent history access")}</h3>
      <p>
        {t(
          "This password or PIN protects history access independently of the browser vault and computer sign-in. It is never saved in preferences or exports.",
        )}
      </p>
      {!h.status.unlocked ? (
        <>
          <Field
            type="password"
            disabled={h.busy}
            label={t(
              configured
                ? "History password or PIN"
                : "New history password or PIN",
            )}
            value={secret}
            onChange={setSecret}
          />
          {!configured && (
            <Field
              type="password"
              disabled={h.busy}
              label={t("Confirm history password or PIN")}
              value={confirm}
              onChange={setConfirm}
            />
          )}
          <Button disabled={h.busy || !secret} onClick={authorize}>
            {t(configured ? "Unlock history" : "Set up protected history")}
          </Button>
        </>
      ) : (
        <>
          <p>
            {t(
              "History access is active. Each operation rechecks access; sessions expire after ten minutes.",
            )}
          </p>
          <Button
            secondary
            disabled={h.busy}
            onClick={() => void h.run("history-lock")}
          >
            {t("Lock history")}
          </Button>
          <details>
            <summary>{t("Change history password or PIN")}</summary>
            <p>
              {t(
                "Changing this password revokes older sessions in other processes. It does not change the encryption key or computer sign-in.",
              )}
            </p>
            <Field
              type="password"
              disabled={h.busy}
              label={t("Current history password or PIN")}
              value={oldSecret}
              onChange={setOldSecret}
            />
            <Field
              type="password"
              disabled={h.busy}
              label={t("New history password or PIN")}
              value={secret}
              onChange={setSecret}
            />
            <Field
              type="password"
              disabled={h.busy}
              label={t("Confirm history password or PIN")}
              value={confirm}
              onChange={setConfirm}
            />
            <Button
              disabled={h.busy || !oldSecret || !secret}
              onClick={changePassword}
            >
              {t("Change history password or PIN")}
            </Button>
          </details>
        </>
      )}
    </section>
  );
}
