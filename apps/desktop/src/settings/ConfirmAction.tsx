import React, { useState, useRef } from "react";
import { Btn, Dialog, Ms, Slider } from "../m3";
import type { SaveResult } from "./types";

/** Super confirmation: turn both keys, then slide all the way. Emergency exit always works. */
export function ConfirmAction({
  title,
  description,
  t,
  onCancel,
  onConfirm,
  icon = "warning",
  confirmLabel = "Confirm",
}: {
  title: string;
  description: string;
  t: (s: string) => string;
  onCancel: () => void;
  onConfirm: () => Promise<SaveResult>;
  icon?: string;
  confirmLabel?: string;
}) {
  const [first, setFirst] = useState(false),
    [second, setSecond] = useState(false),
    [position, setPosition] = useState(0),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      const result = await onConfirm();
      if (!result.ok) {
        setError(result.message);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } catch {
      setError(
        "The change could not be saved. Your confirmation is retained; retry or exit.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const key = (on: boolean, label: string, turned: string, toggle: () => void) => (
    <Btn
      size="m"
      variant={on ? "error" : undefined}
      aria-pressed={on}
      onClick={toggle}
      style={{
        height: 72,
        borderRadius: 20,
        flexDirection: "column",
        gap: 2,
        ...(on ? {} : { background: "var(--surface-container-highest)", color: "var(--on-surface)" }),
      }}
    >
      <Ms name="key" fill={on} />
      {t(on ? turned : label)}
    </Btn>
  );
  const ready = first && second;
  return (
    <Dialog title={title} icon={icon} onClose={onCancel} width={400} className="super-confirm">
      <p>{description}</p>
      <p className="label-l">{t("Turn both keys")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {key(first, "Key one", "Key one turned", () => {
          setFirst(!first);
          setPosition(0);
        })}
        {key(second, "Key two", "Key two turned", () => {
          setSecond(!second);
          setPosition(0);
        })}
      </div>
      <p className="label-l on-sv">{t("Then slide all the way")}</p>
      <Slider
        label={ready ? t("Slide to authorize") : `${t("Slide to authorize")}, ${t("waiting for both keys")}`}
        value={position}
        min={0}
        max={100}
        step={1}
        stops={false}
        disabled={!ready}
        valueText={`${position}%`}
        onChange={setPosition}
      />
      <p className="body-s on-sv" role="status">{position}%</p>
      {error && (
        <p ref={errorRef} role="alert" tabIndex={-1} className="body-m c-error">
          {t(error)}
        </p>
      )}
      <div className="acts">
        <Btn variant="outlined" icon="logout" onClick={onCancel}>
          {t("Emergency exit")}
        </Btn>
        {ready && position === 100 && (
          <Btn variant="error" disabled={saving} onClick={confirm}>
            {t(
              saving
                ? "Saving preferences"
                : error
                  ? "Retry confirmation"
                  : confirmLabel,
            )}
          </Btn>
        )}
      </div>
    </Dialog>
  );
}
