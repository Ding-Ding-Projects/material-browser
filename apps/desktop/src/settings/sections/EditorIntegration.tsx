import React, { useState, useEffect } from "react";
import { Button } from "../../components";
import { Choice } from "../SettingControl";
import type { SettingsController } from "../store";
export function EditorIntegration({
  controller: c,
  t,
}: {
  controller: SettingsController;
  t: (s: string) => string;
}) {
  const [editors, setEditors] = useState<Array<{ id: string; name: string }>>(
      [],
    ),
    [selected, setSelected] = useState(
      () => localStorage.getItem("settings.editor-id") || "",
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function refresh() {
    setBusy(true);
    try {
      const result = await window.materialBrowser?.settingsService("editors");
      if (!result?.ok)
        throw Error(
          result?.error?.message || "Editor discovery is unavailable.",
        );
      setEditors(result.editors);
      if (!selected && result.editors.length) {
        setSelected(result.editors[0].id);
        localStorage.setItem("settings.editor-id", result.editors[0].id);
      }
      setMessage(
        result.editors.length
          ? "Installed editors are available."
          : "No supported editor was found. Choose an installed executable.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Editor discovery is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function choose() {
    setBusy(true);
    try {
      const result =
        await window.materialBrowser?.settingsService("choose-editor");
      if (!result?.ok)
        throw Error(result?.error?.message || "Editor selection failed.");
      if (result.state === "selected") {
        setSelected("selected");
        localStorage.setItem("settings.editor-id", "selected");
        await refresh();
      } else setMessage("Selection cancelled.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Editor selection failed.");
    } finally {
      setBusy(false);
    }
  }
  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.materialBrowser?.settingsService(
        "open-export",
        {
          editorId: selected,
          format: "json",
          preferences: c.record.preferences,
          schedules: c.record.schedules,
        },
      );
      if (!result?.ok)
        throw Error(
          result?.error?.message || "The editor could not be opened.",
        );
      setMessage(
        "The selected editor was launched with a validated preferences export.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "The editor could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="setting-card">
      <h2>{t("External editor")}</h2>
      <p>
        {t(
          "Choose an installed editor to open a preferences export. Passwords and private imports are excluded.",
        )}
      </p>
      <Choice
        label={t("Editor")}
        value={selected}
        options={editors.map((e) => [e.id, e.name])}
        onChange={(id) => {
          setSelected(id);
          localStorage.setItem("settings.editor-id", id);
        }}
        t={t}
      />
      <div className="actions">
        <Button disabled={busy} secondary onClick={() => void refresh()}>
          {t("Refresh")}
        </Button>
        <Button disabled={busy} secondary onClick={() => void choose()}>
          {t("Choose editor")}
        </Button>
        <Button
          disabled={busy || !editors.some((e) => e.id === selected)}
          onClick={() => void open()}
        >
          {t("Open exported preferences")}
        </Button>
      </div>
      <p role="status">{t(message)}</p>
    </section>
  );
}
