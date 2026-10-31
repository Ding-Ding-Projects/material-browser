/* Compatibility primitives mapped onto the design's Material 3 anatomy. */
import React, { useId, useRef, useState } from "react";
import { Btn, Checkbox, LinearProgress as M3Progress, Ms, Slider } from "./m3";

export function MaterialInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { type, onChange, checked, disabled, min, max, step, value } = props;
  const label = props["aria-label"] || "";
  const emit = (next: unknown) => {
    const target = { checked: next, value: String(next) } as unknown as HTMLInputElement;
    onChange?.({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} } as unknown as React.ChangeEvent<HTMLInputElement>);
  };
  if (type === "checkbox" || type === "radio")
    return <Checkbox checked={checked === true} disabled={disabled} label={label} onChange={(v) => emit(v)} />;
  return (
    <Slider
      label={label}
      value={Number(value) || 0}
      min={Number(min) || 0}
      max={Number(max) || 100}
      step={Number(step) || 1}
      disabled={disabled}
      onChange={(v) => {
        emit(v);
        props.onInput?.({ target: { value: String(v) } } as unknown as React.FormEvent<HTMLInputElement>);
      }}
    />
  );
}

export function DisclosureTitle({ children }: React.PropsWithChildren<{ title?: string }>) {
  return <>{children}</>;
}

export function Disclosure({ children, open, onToggle, className = "", ...rest }: any) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const shown = open === undefined ? expanded : open;
  const nodes = React.Children.toArray(children);
  const title = nodes.find((node) => React.isValidElement(node) && node.type === DisclosureTitle);
  return (
    <section {...rest} className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Btn
        variant="text"
        aria-expanded={shown}
        aria-controls={id}
        style={{ alignSelf: "flex-start" }}
        onClick={() => {
          setExpanded(!shown);
          onToggle?.({ currentTarget: { open: !shown } });
        }}
      >
        <Ms name={shown ? "expand_less" : "expand_more"} />
        {title}
      </Btn>
      <div id={id} hidden={!shown} style={{ display: shown ? "flex" : "none", flexDirection: "column", gap: 12 }}>
        {nodes.filter((node) => node !== title)}
      </div>
    </section>
  );
}

export function LinearProgress({ value, max = 1, label }: { value: number; max?: number; label: string }) {
  return <M3Progress value={Math.max(0, Math.min(1, value / max))} label={label} />;
}

export function PlatformPicker(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  const language = typeof document !== "undefined" ? document.documentElement.dataset.language : "en";
  const title = props["aria-label"] || (language === "yue" ? "選擇檔案" : language === "both" ? "Choose file · 選擇檔案" : "Choose file");
  return (
    <span>
      <input {...props} ref={input} hidden tabIndex={-1} />
      <Btn variant="outlined" icon="upload_file" disabled={props.disabled} onClick={() => input.current?.click()}>
        {title}
      </Btn>
    </span>
  );
}
