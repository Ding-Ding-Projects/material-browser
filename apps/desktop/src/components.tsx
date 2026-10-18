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
import "@material/web/iconbutton/icon-button.js";
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
  clearLabel,
  inputMode,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
  clearLabel?: string;
  inputMode?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const mode = document.documentElement.dataset.language;
  const clear =
    mode === "yue" ? "清除" : mode === "both" ? "Clear · 清除" : "Clear";
  return React.createElement(
    "md-outlined-text-field",
    {
      ref,
      label,
      value,
      type,
      required,
      inputMode,
      disabled,
      onInput: (e: Event) => {
        if (!disabled) onChange((e.target as HTMLInputElement).value);
      },
    },
    React.createElement(
      "md-icon-button",
      {
        slot: "trailing-icon",
        "aria-label": clearLabel || `${clear} ${label}`,
        title: clearLabel || `${clear} ${label}`,
        disabled,
        onClick: () => {
          if (disabled) return;
          onChange("");
          ref.current?.focus();
        },
      },
      React.createElement(
        "svg",
        { viewBox: "0 0 24 24", width: 24, height: 24, "aria-hidden": true },
        React.createElement("path", {
          fill: "currentColor",
          d: "M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4l-6.3 6.3-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z",
        }),
      ),
    ),
  );
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
    React.createElement(
      "div",
      { slot: "headline" },
      document.documentElement.dataset.dialogEmoji === "true"
        ? React.createElement("span", { "aria-hidden": true }, "ℹ️ ")
        : null,
      title,
    ),
    React.createElement(
      "div",
      { slot: "content", className: "dialog-content" },
      children,
    ),
    React.createElement(
      "div",
      { slot: "actions" },
      document.documentElement.dataset.accessibilityVisible !== "false" && (
        <Button
          secondary
          onClick={() =>
            window.dispatchEvent(new Event("settings-accessibility"))
          }
        >
          Accessibility
        </Button>
      ),
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
