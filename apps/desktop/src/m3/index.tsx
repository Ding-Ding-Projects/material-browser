/* Material 3 Expressive primitives that render the exact anatomy of design/m3.css.
   Every control is a real, keyboard-operable element with an accessible name. */
import React, { useEffect, useId, useRef, useState } from "react";

type Children = { children?: React.ReactNode };
const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Ms({
  name,
  fill,
  size,
  className,
  label,
  style,
}: {
  name: string;
  fill?: boolean;
  size?: 16 | 18 | 20 | 28 | 32 | 40;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cx("ms", fill && "fill", size && `s${size}`, className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      style={style}
    >
      {name}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "filled"
    | "tonal"
    | "outlined"
    | "text"
    | "elevated"
    | "error"
    | "error-tonal"
    | "tertiary";
  size?: "xs" | "m";
  icon?: string;
  trailingIcon?: string;
  square?: boolean;
};
export const Btn = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Btn(
    { variant = "filled", size, icon, trailingIcon, square, className, children, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type || "button"}
        className={cx("btn", variant, size, square && "sq", "sl", className)}
        {...rest}
      >
        {icon && <Ms name={icon} />}
        {children}
        {trailingIcon && <Ms name={trailingIcon} />}
      </button>
    );
  },
);

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  variant?: "filled" | "tonal" | "outlined";
  size?: "sm" | "m" | "wide";
  fill?: boolean;
  badge?: number | "dot";
  on?: boolean;
};
export const IconBtn = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconBtn(
    { icon, label, variant, size, fill, badge, on, className, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type || "button"}
        aria-label={label}
        title={label}
        className={cx("ib", variant, size, on && "on", "sl", className)}
        {...rest}
      >
        <Ms name={icon} fill={fill} />
        {badge === "dot" ? (
          <span className="badge dot" aria-hidden="true" />
        ) : badge ? (
          <span className="badge" aria-hidden="true">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </button>
    );
  },
);

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      className="sw"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>{checked && <Ms name="check" />}</span>
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onChange: (value: boolean, event: React.MouseEvent) => void;
  label: string;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      className="cbt sl"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => onChange(!checked, event)}
    >
      <span
        className="cb"
        style={
          indeterminate
            ? { background: "var(--primary)", borderColor: "var(--primary)" }
            : undefined
        }
      >
        {checked && <Ms name="check" />}
        {indeterminate && !checked && <Ms name="remove" />}
      </span>
    </button>
  );
}

export function Radio({ on }: { on: boolean }) {
  return (
    <span className={cx("rb", on && "on")} aria-hidden="true">
      {on && <span />}
    </span>
  );
}

/** Radio list: each row is a real radio with arrow-key movement. */
export function RadioList<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  options: {
    value: T;
    title: React.ReactNode;
    support?: React.ReactNode;
    overline?: React.ReactNode;
    icon?: string;
    trailing?: React.ReactNode;
    disabled?: boolean;
  }[];
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  const move = (from: number, step: number) => {
    if (!enabled.length) return;
    const position = enabled.findIndex((o) => o.value === options[from].value);
    const next = enabled[(position + step + enabled.length) % enabled.length];
    const index = options.indexOf(next);
    onChange(next.value);
    refs.current[index]?.focus();
  };
  return (
    <div className="seglist" role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!options.some((o) => o.value === value) && index === 0) ? 0 : -1}
            disabled={disabled || option.disabled}
            className={cx("li tall sl", on && "sel")}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              }
            }}
          >
            <Radio on={on} />
            {option.icon && <Ms name={option.icon} />}
            <span className="txt">
              {option.overline && <span className="ov">{option.overline}</span>}
              <span>{option.title}</span>
              {option.support && <span className="sup">{option.support}</span>}
            </span>
            {option.trailing}
          </button>
        );
      })}
    </div>
  );
}

/** Connected button group: single choice of two to four. */
export function ButtonGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  showLabel,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="cbg" role="radiogroup" aria-label={label}>
      {showLabel && <span className="label-l on-sv">{label}</span>}
      {options.map(([key, text], index) => {
        const on = key === value;
        return (
          <button
            key={key}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!options.some(([k]) => k === value) && index === 0) ? 0 : -1}
            disabled={disabled}
            className={cx("sl", on && "on")}
            onClick={() => onChange(key)}
            onKeyDown={(event) => {
              const step =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!step) return;
              event.preventDefault();
              const next = (index + step + options.length) % options.length;
              onChange(options[next][0]);
              refs.current[next]?.focus();
            }}
          >
            {on && <Ms name="check" />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  on,
  icon,
  trailingIcon,
  children,
  assist,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  on?: boolean;
  icon?: string;
  trailingIcon?: string;
  assist?: boolean;
}) {
  const filter = on !== undefined;
  return (
    <button
      type="button"
      aria-pressed={filter ? on : undefined}
      className={cx("chip", on && "on", assist && "assist", icon && !on && "lead", "sl", className)}
      {...rest}
    >
      {on ? <Ms name="check" /> : icon ? <Ms name={icon} fill={assist} /> : null}
      {children}
      {trailingIcon && <Ms name={trailingIcon} />}
    </button>
  );
}

/** Expressive slider: 16dp track, bar handle, gap and stop indicators. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  valueText,
  stops,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  valueText?: string;
  stops?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Math.round((n - min) / step) * step + min));
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const count = Math.round((max - min) / step);
  const showStops = stops ?? count <= 10;
  const fromPointer = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    onChange(clamp(min + ((clientX - rect.left) / rect.width) * (max - min)));
  };
  const dots = (from: number, to: number) =>
    showStops
      ? Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => (
          <span key={i} className="stop" />
        ))
      : [<span key="a" />, <span key="b" className="stop" />];
  const index = Math.round(ratio * count);
  return (
    <div
      ref={track}
      className="slider"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.38 : 1, touchAction: "none" }}
      onPointerDown={(event) => {
        if (disabled) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        fromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!disabled && event.buttons === 1) fromPointer(event.clientX);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        const big = Math.max(step, (max - min) / 10);
        const next =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? value + step
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? value - step
              : event.key === "PageUp"
                ? value + big
                : event.key === "PageDown"
                  ? value - big
                  : event.key === "Home"
                    ? min
                    : event.key === "End"
                      ? max
                      : null;
        if (next === null) return;
        event.preventDefault();
        onChange(clamp(next));
      }}
    >
      {ratio >= 1 ? (
        <>
          <span className="act full">{dots(0, count)}</span>
          <span className="handle" />
        </>
      ) : (
        <>
          <span
            className="act"
            style={{ width: `calc(${ratio * 100}% - ${ratio === 0 ? 0 : 8}px)`, padding: ratio === 0 ? 0 : undefined }}
          >
            {ratio > 0 && dots(0, index - 1)}
          </span>
          <span className="handle" />
          <span className="ina">{dots(index + 1, count)}</span>
        </>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  supporting,
  error,
  icon,
  trailing,
  mono,
  required,
  disabled,
  autoFocus,
  inputRef,
  onKeyDown,
  placeholder,
  name,
  inputMode,
  maxLength,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  supporting?: React.ReactNode;
  error?: string;
  icon?: string;
  trailing?: React.ReactNode;
  mono?: boolean;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  name?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  id?: string;
}) {
  const generated = useId();
  const fieldId = id || generated;
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", opacity: disabled ? 0.38 : 1 }}>
      <label
        className={cx("tf", focus && !error && "focus", error && "error")}
        htmlFor={fieldId}
      >
        <span className="lab" id={`${fieldId}-label`}>
          {label}
          {required ? " *" : ""}
        </span>
        {icon && <Ms name={icon} />}
        <input
          id={fieldId}
          ref={inputRef}
          className={mono ? "mono" : undefined}
          type={type}
          value={value}
          name={name}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-labelledby={`${fieldId}-label`}
          aria-invalid={error ? true : undefined}
          aria-describedby={supporting || error ? `${fieldId}-sup` : undefined}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {trailing}
      </label>
      {(supporting || error) && (
        <span
          id={`${fieldId}-sup`}
          className="tf-sup"
          style={error ? { color: "var(--error)" } : undefined}
        >
          {error || supporting}
        </span>
      )}
    </div>
  );
}

export function PasswordField(
  props: Omit<React.ComponentProps<typeof TextField>, "type" | "trailing"> & {
    showLabel?: string;
    hideLabel?: string;
  },
) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const { showLabel = "Show password", hideLabel = "Hide password", supporting, ...rest } = props;
  return (
    <TextField
      {...rest}
      type={shown ? "text" : "password"}
      supporting={supporting ?? (caps ? "Caps Lock is on" : undefined)}
      onKeyDown={(event) => {
        setCaps(event.getModifierState?.("CapsLock") === true);
        props.onKeyDown?.(event);
      }}
      trailing={
        <IconBtn
          icon={shown ? "visibility_off" : "visibility"}
          label={shown ? hideLabel : showLabel}
          onClick={() => setShown(!shown)}
        />
      }
    />
  );
}

/** Outlined exposed dropdown text field, built as a Material menu button. */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find(([k]) => k === value);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!list.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>("[role=option]")[active]?.focus());
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = (index: number) => {
    onChange(options[index][0]);
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        ref={button}
        type="button"
        className={cx("tf", open && "focus")}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel || `${label}: ${current?.[1] ?? value}`}
        style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.38 : 1 }}
        onClick={() => {
          setActive(Math.max(0, options.findIndex(([k]) => k === value)));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(Math.max(0, options.findIndex(([k]) => k === value)));
            setOpen(true);
          }
        }}
      >
        <span className="lab" style={{ ["--tf-bg" as string]: "inherit" }}>{label}</span>
        <span className="val">{current?.[1] ?? value}</span>
        <Ms name={open ? "arrow_drop_up" : "arrow_drop_down"} />
      </button>
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          className="menu m3-popover"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40 }}
          onKeyDown={(event) => {
            const items = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=option]") || []);
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              button.current?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next = (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              items[event.key === "Home" ? 0 : items.length - 1]?.focus();
            } else if (event.key === "Tab") setOpen(false);
          }}
        >
          <div className="mg" style={{ maxHeight: 320, overflow: "auto" }}>
            {options.map(([key, text], index) => (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={key === value}
                tabIndex={-1}
                className={cx("mi sl", key === value && "sel")}
                onClick={() => pick(index)}
              >
                {text}
                {key === value && <Ms name="check" className="k" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
  idPrefix,
  secondary,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: [T, string][];
  idPrefix: string;
  secondary?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={cx("tabs", secondary && "sec")} role="tablist" aria-label={label}>
      {tabs.map(([key, text], index) => (
        <button
          key={key}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${key}`}
          aria-controls={`${idPrefix}-panel-${key}`}
          aria-selected={key === value}
          tabIndex={key === value ? 0 : -1}
          className={cx("tab sl", key === value && "on")}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            const edge = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
            if (!step && edge < 0) return;
            event.preventDefault();
            const next = edge >= 0 ? edge : (index + step + tabs.length) % tabs.length;
            onChange(tabs[next][0]);
            refs.current[next]?.focus();
          }}
        >
          <span className="tl">{text}</span>
        </button>
      ))}
    </div>
  );
}

export function SegList({
  children,
  style,
  label,
  role,
}: Children & { style?: React.CSSProperties; label?: string; role?: string }) {
  return (
    <div className="seglist" style={style} aria-label={label} role={role}>
      {children}
    </div>
  );
}

export function Item({
  icon,
  iconFill,
  leading,
  overline,
  title,
  support,
  trailing,
  tall,
  selected,
  className,
  style,
  mono,
}: {
  icon?: string;
  iconFill?: boolean;
  leading?: React.ReactNode;
  overline?: React.ReactNode;
  title: React.ReactNode;
  support?: React.ReactNode;
  trailing?: React.ReactNode;
  tall?: boolean;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  mono?: boolean;
}) {
  return (
    <div className={cx("li", tall && "tall", selected && "sel", className)} style={style}>
      {leading}
      {icon && <Ms name={icon} fill={iconFill} />}
      <div className="txt">
        {overline && <span className="ov">{overline}</span>}
        <span className={mono ? "mono" : undefined} style={mono ? { fontSize: 14 } : undefined}>
          {title}
        </span>
        {support && <span className="sup">{support}</span>}
      </div>
      {trailing}
    </div>
  );
}

const AVATAR_SHAPES = ["shape-cookie", "shape-sunny", "shape-sq", "shape-arch", "shape-pill"];
const AVATAR_TONES = ["p", "t", "p", "t"];
export function avatarStyle(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    shape: AVATAR_SHAPES[hash % AVATAR_SHAPES.length],
    tone: AVATAR_TONES[(hash >> 3) % AVATAR_TONES.length],
  };
}
export function Avatar({
  name,
  seed,
  size,
  shape,
  tone,
  icon,
}: {
  name: string;
  seed?: string;
  size?: "l" | "xl";
  shape?: string;
  tone?: string;
  icon?: string;
}) {
  const auto = avatarStyle(seed || name);
  const initial = Array.from(name.trim())[0]?.toUpperCase() || "?";
  return (
    <div
      className={cx("av", size, tone ?? auto.tone, shape ?? auto.shape)}
      aria-hidden="true"
    >
      {icon ? <Ms name={icon} /> : initial}
    </div>
  );
}

export function LinearProgress({
  value,
  label,
  thick,
}: {
  value: number;
  label: string;
  thick?: boolean;
}) {
  const ratio = Math.min(1, Math.max(0, value));
  return (
    <div
      className={cx("lp", thick && "thick")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <span className="act" style={{ width: `${ratio * 100}%` }} />
      {ratio < 1 && <span className="ina" />}
    </div>
  );
}

export function WavyProgress({
  value,
  label,
  indeterminate,
}: {
  value: number;
  label: string;
  indeterminate?: boolean;
}) {
  const ratio = Math.min(1, Math.max(0, value));
  const width = 240 * ratio;
  const waves = Math.max(1, Math.round(width / 16));
  let d = "M2 7";
  for (let i = 0; i < waves; i++) {
    const x = 2 + (i * (width - 4)) / waves;
    const w = (width - 4) / waves;
    d += ` Q${x + w / 4} ${i % 2 ? 12 : 2} ${x + w / 2} 7 T${x + w} 7`;
  }
  return (
    <div
      className="wavy"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(ratio * 100)}
    >
      {ratio > 0 && (
        <svg viewBox={`0 0 ${Math.max(width, 4)} 14`} width={`${ratio * 100}%`} preserveAspectRatio="none" className={indeterminate ? "wavy-move" : undefined} aria-hidden="true">
          <path d={d} />
        </svg>
      )}
      {ratio < 1 && <span className="ina" />}
    </div>
  );
}

export function Loading({ label, plain }: { label: string; plain?: boolean }) {
  return (
    <span className={cx("loading", plain && "plain")} role="status" aria-label={label}>
      <span className="loading-shape" />
    </span>
  );
}

let openDialogs = 0;
/** Basic or full-height dialog with scrim, focus containment, Escape and focus return. */
export function Dialog({
  title,
  icon,
  onClose,
  children,
  actions,
  width = 420,
  dismissible = true,
  label,
  className,
}: Children & {
  title?: React.ReactNode;
  icon?: string;
  onClose: () => void;
  actions?: React.ReactNode;
  width?: number | string;
  dismissible?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const opener = useRef<Element | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    opener.current = document.activeElement;
    openDialogs++;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(
      "[data-autofocus], input:not([disabled]), button:not([disabled]), [tabindex='0']",
    );
    requestAnimationFrame(() => (first || node)?.focus());
    return () => {
      openDialogs--;
      const back = opener.current as HTMLElement | null;
      if (back?.isConnected) requestAnimationFrame(() => back.focus());
    };
  }, []);
  return (
    <div className="m3-overlay" onMouseDown={(event) => {
      if (dismissible && event.target === event.currentTarget) close.current();
    }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={cx("dialog m3-dialog", className)}
        style={{ width, maxWidth: "calc(100vw - 32px)" }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && dismissible) {
            event.stopPropagation();
            close.current();
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled]), input:not([disabled]), [tabindex='0'], a[href], textarea:not([disabled])",
            ) || [],
          ).filter((el) => el.offsetParent !== null);
          if (!focusable.length) return;
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {icon && <Ms name={icon} size={28} className="hero" />}
        {title && (
          <h2 id={titleId} className="headline-s" style={{ textAlign: icon ? "center" : undefined }}>
            {title}
          </h2>
        )}
        <div className="m3-dialog-body">{children}</div>
        {actions && <div className="acts">{actions}</div>}
      </div>
    </div>
  );
}
export const dialogsOpen = () => openDialogs > 0;

/** Expressive vertical menu with segmented groups, an optional filter and shortcuts. */
export type MenuEntry = {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};
export function Menu({
  label,
  groups,
  onClose,
  anchor,
  filterable = true,
  t = (s: string) => s,
}: {
  label: string;
  groups: MenuEntry[][];
  onClose: () => void;
  anchor: { x: number; y: number };
  filterable?: boolean;
  t?: (s: string) => string;
}) {
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const shown = groups
    .map((group) => group.filter((entry) => entry.label.toLowerCase().includes(filter.toLowerCase())))
    .filter((group) => group.length);
  const count = shown.reduce((sum, group) => sum + group.length, 0);
  useEffect(() => {
    opener.current = document.activeElement;
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(filterable ? "input" : "[role=menuitem]")?.focus());
    const away = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("mousedown", away);
      const back = opener.current as HTMLElement | null;
      if (back?.isConnected) requestAnimationFrame(() => back.focus());
    };
  }, []);
  const [position, setPosition] = useState(anchor);
  useEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: Math.max(8, Math.min(anchor.x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(anchor.y, window.innerHeight - rect.height - 8)),
    });
  }, [anchor.x, anchor.y, count]);
  return (
    <div
      ref={ref}
      className="menu m3-popover"
      role="menu"
      aria-label={label}
      style={{ position: "fixed", left: position.x, top: position.y, zIndex: 60, width: 320 }}
      onKeyDown={(event) => {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") || []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (filter) setFilter("");
          else onClose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        } else if (event.key === "Tab") onClose();
      }}
    >
      {filterable && (
        <div className="mg" style={{ padding: 4 }}>
          <label className="search sm" style={{ background: "var(--surface-container-highest)" }}>
            <Ms name="filter_list" size={20} />
            <input aria-label={t("Filter")} placeholder={t("Filter")} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
        </div>
      )}
      {shown.map((group, index) => (
        <div className="mg" key={index} role="group">
          {group.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={entry.disabled}
              className={cx("mi sl", entry.danger && "danger")}
              style={entry.disabled ? { opacity: 0.38 } : undefined}
              onClick={() => {
                onClose();
                entry.onSelect();
              }}
            >
              {entry.icon && <Ms name={entry.icon} />}
              {entry.label}
              {entry.shortcut && <span className="k">{entry.shortcut}</span>}
            </button>
          ))}
        </div>
      ))}
      <span className="label-s on-sv" role="status" style={{ padding: "6px 16px" }}>
        {count} {t(count === 1 ? "item" : "items")}
      </span>
    </div>
  );
}

export function Snackbar({
  message,
  action,
  onAction,
  onClose,
  closeLabel = "Close",
}: {
  message: string;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="snack" role="status" aria-live="polite">
      <span style={{ flex: 1, padding: "14px 0" }}>{message}</span>
      {action && onAction && (
        <Btn variant="text" onClick={onAction}>
          {action}
        </Btn>
      )}
      <IconBtn icon="close" label={closeLabel} onClick={onClose} />
    </div>
  );
}

export { cx };
