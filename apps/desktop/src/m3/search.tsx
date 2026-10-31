/* Search bar with the bounded regex builder from the design (Palette artboard). */
import React, { useEffect, useRef, useState } from "react";
import { Chip, IconBtn, Menu, Ms, cx } from "./index";

export type RegexState = { regex: boolean; flags: string };
export type MatchStatus = { valid: boolean; error?: string; count: number; slow?: boolean };

/** Filters items by plain text or a bounded regex evaluated in a worker that stops after 150 ms. */
export function useMatches(items: string[], query: string, state: RegexState) {
  const [result, setResult] = useState<{ indices: number[]; status: MatchStatus }>({
    indices: items.map((_, i) => i),
    status: { valid: true, count: items.length },
  });
  const serialized = JSON.stringify(items);
  useEffect(() => {
    if (!query) {
      setResult({ indices: items.map((_, i) => i), status: { valid: true, count: items.length } });
      return;
    }
    if (!state.regex) {
      const needle = query.toLocaleLowerCase();
      const indices = items.flatMap((x, i) => (x.toLocaleLowerCase().includes(needle) ? [i] : []));
      setResult({ indices, status: { valid: true, count: indices.length } });
      return;
    }
    if (query.length > 2048) {
      setResult({ indices: [], status: { valid: false, error: "Pattern exceeds limit", count: 0 } });
      return;
    }
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../regex.worker.ts", import.meta.url), { type: "module" });
    } catch {
      setResult({ indices: [], status: { valid: false, error: "Regex worker unavailable", count: 0 } });
      return;
    }
    const timer = setTimeout(() => {
      worker?.terminate();
      setResult({ indices: [], status: { valid: false, slow: true, error: "Stopped a slow pattern after 150 ms", count: 0 } });
    }, 150);
    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker?.terminate();
      if (event.data.error) {
        setResult({ indices: [], status: { valid: false, error: "Invalid pattern", count: 0 } });
        return;
      }
      const indices = (event.data.values || []).flatMap((yes: boolean, i: number) => (yes ? [i] : []));
      setResult({ indices, status: { valid: true, count: indices.length } });
    };
    worker.postMessage({ pattern: query, flags: state.flags, sample: "", replacement: "", values: items });
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [query, state.regex, state.flags, serialized]);
  return result;
}

type Part = { kind: "start" | "end" | "group" | "or" | "class" | "literal"; text: string };
/** Splits a pattern into the readable parts shown as chips. */
export function patternParts(pattern: string): Part[] {
  const parts: Part[] = [];
  let literal = "";
  const flush = () => {
    if (literal) parts.push({ kind: "literal", text: literal });
    literal = "";
  };
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      const named: Record<string, string> = { d: "digit", w: "word letter", s: "space", b: "word edge", D: "not digit", W: "not word", S: "not space" };
      if (named[next]) {
        flush();
        let text = named[next];
        if (pattern[i + 2] === "+") {
          text += "s";
          i++;
        }
        parts.push({ kind: "class", text });
      } else literal += next;
      i++;
    } else if (c === "^") {
      flush();
      parts.push({ kind: "start", text: "Start" });
    } else if (c === "$") {
      flush();
      parts.push({ kind: "end", text: "End" });
    } else if (c === "(") {
      flush();
      if (pattern.slice(i, i + 3) === "(?:") i += 2;
      parts.push({ kind: "group", text: "Group" });
    } else if (c === ")") flush();
    else if (c === "|") {
      flush();
      parts.push({ kind: "or", text: "or" });
    } else if ("[.*+?{}".includes(c)) {
      flush();
      let j = i;
      if (c === "[") while (j < pattern.length && pattern[j] !== "]") j++;
      parts.push({ kind: "class", text: pattern.slice(i, j + 1) });
      i = j;
    } else literal += c;
  }
  flush();
  return parts;
}

const PART_STYLE: Record<string, React.CSSProperties> = {
  start: { background: "var(--primary-container)", color: "var(--on-primary-container)", borderColor: "transparent" },
  end: { background: "var(--primary-container)", color: "var(--on-primary-container)", borderColor: "transparent" },
  group: { background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", borderColor: "transparent" },
  or: { background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", borderColor: "transparent" },
  class: { background: "var(--secondary-container)", color: "var(--on-secondary-container)", borderColor: "transparent" },
};

export function RegexBuilder({
  query,
  setQuery,
  state,
  setState,
  status,
  t,
}: {
  query: string;
  setQuery: (value: string) => void;
  state: RegexState;
  setState: (value: RegexState) => void;
  status: MatchStatus;
  t: (s: string) => string;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const toggle = (flag: string) =>
    setState({ ...state, flags: state.flags.includes(flag) ? state.flags.replace(flag, "") : state.flags + flag });
  const parts = patternParts(query);
  const add = (text: string) => setQuery(query + text);
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-container)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="label-l" style={{ flex: 1 }}>{t("Regex builder · this search only")}</span>
        <Chip on={state.flags.includes("i")} onClick={() => toggle("i")}>{t("Ignore case")}</Chip>
        <Chip on={state.flags.includes("m")} onClick={() => toggle("m")}>{t("Multiline")}</Chip>
        <Chip on={state.flags.includes("u")} onClick={() => toggle("u")}>{t("Unicode")}</Chip>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} aria-label={t("Pattern parts")} role="group">
        {parts.map((part, index) => (
          <span key={index} className={cx("chip", part.kind === "literal" && "mono")} style={PART_STYLE[part.kind]}>
            {part.kind === "start" && <Ms name="first_page" />}
            {part.kind === "end" && <Ms name="last_page" />}
            {part.kind === "literal" ? part.text : t(part.text)}
          </span>
        ))}
        <Chip icon="add" onClick={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4 });
        }}>{t("Add part")}</Chip>
        {query && <Chip icon="backspace" onClick={() => setQuery("")}>{t("Clear")}</Chip>}
      </div>
      <p className="body-s on-sv" role="status" style={!status.valid ? { color: "var(--error)" } : undefined}>
        {status.valid
          ? `${t("Valid pattern")} · ${status.count} ${t(status.count === 1 ? "result" : "results")} · ${t("slow patterns stop on their own")}`
          : t(status.error || "Invalid pattern")}
      </p>
      {menu && (
        <Menu
          label={t("Add part")}
          anchor={menu}
          filterable={false}
          t={t}
          onClose={() => setMenu(null)}
          groups={[
            [
              { id: "start", label: t("Start"), icon: "first_page", onSelect: () => add("^") },
              { id: "end", label: t("End"), icon: "last_page", onSelect: () => add("$") },
            ],
            [
              { id: "group", label: t("Group"), icon: "data_array", onSelect: () => add("(?:)") },
              { id: "or", label: t("or"), icon: "call_split", onSelect: () => add("|") },
            ],
            [
              { id: "digits", label: t("Digits"), icon: "pin", onSelect: () => add("\\d+") },
              { id: "letters", label: t("Letters"), icon: "abc", onSelect: () => add("\\p{L}+") },
              { id: "any", label: t("Anything"), icon: "more_horiz", onSelect: () => add(".*") },
            ],
          ]}
        />
      )}
    </div>
  );
}

/** The design's search bar: leading icon, input, regex builder toggle; builder opens below. */
export function SearchBar({
  label,
  placeholder,
  query,
  setQuery,
  state,
  setState,
  status,
  t,
  small,
  kbd,
  inputRef,
  onFocus,
  onKeyDown,
  style,
}: {
  label: string;
  placeholder?: string;
  query: string;
  setQuery: (value: string) => void;
  state: RegexState;
  setState: (value: RegexState) => void;
  status: MatchStatus;
  t: (s: string) => string;
  small?: boolean;
  kbd?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onFocus?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  style?: React.CSSProperties;
}) {
  const [builder, setBuilder] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      <label className={cx("search", small && "sm")}>
        <Ms name="search" />
        <input
          ref={inputRef}
          aria-label={label}
          placeholder={placeholder ?? label}
          value={query}
          className={state.regex ? "mono" : undefined}
          onFocus={onFocus}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
            onKeyDown?.(event);
          }}
        />
        {kbd && <span className="kbd">{kbd}</span>}
        <IconBtn
          icon="regular_expression"
          label={`${t("Regex builder")}${state.regex ? `, ${t("on")}` : ""}`}
          aria-pressed={state.regex}
          variant={state.regex ? "tonal" : undefined}
          onClick={() => {
            const next = !state.regex;
            setState({ ...state, regex: next });
            setBuilder(next);
          }}
        />
      </label>
      {state.regex && builder && (
        <div style={{ borderRadius: 20, overflow: "hidden" }}>
          <RegexBuilder {...{ query, setQuery, state, setState, status, t }} />
        </div>
      )}
      {query && !status.valid && !builder && (
        <span className="body-s" role="status" style={{ color: "var(--error)", paddingLeft: 16 }}>{t(status.error || "Invalid pattern")}</span>
      )}
    </div>
  );
}

export function useSearch(items: string[], initialFlags = "i") {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<RegexState>({ regex: false, flags: initialFlags });
  const { indices, status } = useMatches(items, query, state);
  return { query, setQuery, state, setState, indices, status };
}
