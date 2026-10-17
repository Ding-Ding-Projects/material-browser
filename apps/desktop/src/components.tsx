import React, { useEffect, useRef } from "react";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/dialog/dialog.js";
import "@material/web/elevation/elevation.js";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
export function Button({
  children,
  onClick,
  disabled = false,
  secondary = false,
}: React.PropsWithChildren<{
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}>) {
  return React.createElement(
    secondary ? "md-outlined-button" : "md-filled-button",
    { onClick, disabled },
    children,
  );
}
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
}) {
  return React.createElement("md-outlined-text-field", {
    label,
    value,
    type,
    required,
    onInput: (e: Event) => onChange((e.target as HTMLInputElement).value),
  });
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: [string, string][];
}) {
  return React.createElement(
    "md-outlined-select",
    {
      label,
      value,
      onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
    },
    options.map(([v, l]) =>
      React.createElement(
        "md-select-option",
        { key: v, value: v, selected: value === v },
        React.createElement("div", { slot: "headline" }, l),
      ),
    ),
  );
}
export function Modal({
  title,
  children,
  onClose,
}: React.PropsWithChildren<{ title: string; onClose: () => void }>) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current as any;
    el?.show();
    const closed = () => onClose();
    el?.addEventListener("closed", closed);
    return () => el?.removeEventListener("closed", closed);
  }, []);
  return React.createElement(
    "md-dialog",
    { ref },
    React.createElement("div", { slot: "headline" }, title),
    React.createElement(
      "div",
      { slot: "content", className: "dialog-content" },
      children,
    ),
    React.createElement(
      "div",
      { slot: "actions" },
      <Button
        secondary
        onClick={() => {
          (ref.current as any)?.close();
        }}
      >
        Close
      </Button>,
    ),
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return React.createElement(
    "md-tabs",
    {
      className: "tabs",
      activeTabIndex: items.findIndex((x) => x[0] === value),
      onChange: (e: Event) => {
        const index = (e.target as any).activeTabIndex;
        if (items[index]) onChange(items[index][0]);
      },
    },
    items.map(([id, label]) =>
      React.createElement(
        "md-primary-tab",
        { key: id, "aria-controls": "panel-" + id },
        label,
      ),
    ),
  );
}
