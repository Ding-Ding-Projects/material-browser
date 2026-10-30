import React, { useId, useRef, useState } from "react";
import "@material/web/checkbox/checkbox.js";
import "@material/web/radio/radio.js";
import "@material/web/slider/slider.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/chips/chip-set.js";
import "@material/web/chips/filter-chip.js";
import { Button } from "./components";
export function MaterialInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { type, onChange, onInput, ...rest } = props;
  const tag = type === "checkbox" ? "md-checkbox" : type === "radio" ? "md-radio" : "md-slider";
  const forward = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const converted = { ...event, target, currentTarget: target, nativeEvent: event, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() };
    onChange?.(converted as unknown as React.ChangeEvent<HTMLInputElement>);
  };
  return React.createElement(tag, { ...rest, onChange: type === "range" ? undefined : forward, onInput: type === "range" ? (event: Event) => { forward(event); onInput?.(event as unknown as React.FormEvent<HTMLInputElement>); } : onInput });
}
export function DisclosureTitle({ children }: React.PropsWithChildren<{ title?: string }>) { return <>{children}</>; }
export function Disclosure({ children, open, onToggle, className = "", ...rest }: any) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const shown = open === undefined ? expanded : open;
  const nodes = React.Children.toArray(children);
  const title = nodes.find((node) => React.isValidElement(node) && node.type === DisclosureTitle);
  return <section {...rest} className={`material-disclosure ${className}`}>
    {React.createElement("md-outlined-button", { "aria-expanded": shown, "aria-controls": id, onClick: () => { setExpanded(!shown); onToggle?.({ currentTarget: { open: !shown } }); } }, title)}
    <div id={id} hidden={!shown}>{nodes.filter((node) => node !== title)}</div>
  </section>;
}
export function LinearProgress({ value, max = 1, label }: { value: number; max?: number; label: string }) {
  return React.createElement("md-linear-progress", { value: Math.max(0, Math.min(1, value / max)), "aria-label": label });
}

export function PlatformPicker(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  const language = document.documentElement.dataset.language;
  const title = props["aria-label"] || (language === "yue" ? "選擇檔案" : language === "both" ? "Choose file · 選擇檔案" : "Choose file");
  return <span className="platform-picker"><input {...props} ref={input} hidden tabIndex={-1}/><Button secondary disabled={props.disabled} onClick={() => input.current?.click()}>{props.type === "color" && <span className="color-swatch" style={{ backgroundColor: String(props.value) }} aria-hidden="true"/>}{title}</Button></span>;
}
