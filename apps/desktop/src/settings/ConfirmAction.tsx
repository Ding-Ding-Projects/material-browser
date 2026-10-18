import React, { useState } from "react";
import { Button, Modal } from "../components";
export function ConfirmAction({
  title,
  description,
  t,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  t: (s: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [first, setFirst] = useState(false),
    [second, setSecond] = useState(false),
    [position, setPosition] = useState(0);
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{description}</p>
      <div className="confirmation-keys">
        <label>
          {React.createElement("md-switch", {
            "aria-label": t("Confirm affected data"),
            selected: first,
            onChange: (e: any) => {
              setFirst(e.target.selected);
              setPosition(0);
            },
          })}
          {t("Confirm affected data")}
        </label>
        <label>
          {React.createElement("md-switch", {
            "aria-label": t("Confirm this action"),
            selected: second,
            onChange: (e: any) => {
              setSecond(e.target.selected);
              setPosition(0);
            },
          })}
          {t("Confirm this action")}
        </label>
      </div>
      {React.createElement("md-slider", {
        min: 0,
        max: 100,
        step: 1,
        value: position,
        disabled: !first || !second,
        "aria-label": t("Slide to authorize"),
        onInput: (e: any) => setPosition(Number(e.target.value)),
      })}
      <p role="status">{position}%</p>
      <div className="actions">
        <Button secondary onClick={onCancel}>
          {t("Emergency exit")}
        </Button>
        <Button
          disabled={!first || !second || position !== 100}
          onClick={onConfirm}
        >
          {t("Confirm")}
        </Button>
      </div>
    </Modal>
  );
}
