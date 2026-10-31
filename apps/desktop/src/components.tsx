/* Compatibility layer: the long-standing section components (schedules, history,
   notification centre, editor integration) render through the design's Material 3
   anatomy so every surface shares one look. */
import React from "react";
import { Btn, Dialog, Dropdown, IconBtn, Tabs as M3Tabs, TextField } from "./m3";

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
  return (
    <Btn variant={secondary ? "outlined" : "filled"} disabled={disabled} onClick={onClick}>
      {children}
    </Btn>
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
  const mode = typeof document !== "undefined" ? document.documentElement.dataset.language : "en";
  const clear = mode === "yue" ? "清除" : mode === "both" ? "Clear · 清除" : "Clear";
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      type={type}
      required={required}
      disabled={disabled}
      inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
      trailing={
        value ? (
          <IconBtn icon="close" label={clearLabel || `${clear} ${label}`} disabled={disabled} onClick={() => onChange("")} />
        ) : undefined
      }
    />
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
  return <Dropdown label={label} value={value} onChange={onChange} options={options} />;
}

export function Modal({
  title,
  children,
  onClose,
  closeLabel = "Close",
  actions,
}: React.PropsWithChildren<{
  title: string;
  onClose: () => void;
  closeLabel?: string;
  accessibilityLabel?: string;
  actions?: React.ReactNode;
}>) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={560}
      actions={
        <>
          <Btn variant="text" onClick={onClose}>{closeLabel}</Btn>
          {actions}
        </>
      }
    >
      {children}
    </Dialog>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  panelPrefix = "panel",
}: {
  panelPrefix?: string;
  items: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return <M3Tabs label="Sections" idPrefix={panelPrefix} value={value} onChange={onChange} tabs={items} />;
}
