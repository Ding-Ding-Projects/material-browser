import { MaterialInput } from "./MaterialPrimitives";
import React, { useEffect, useState } from "react";
import { Button, Field } from "./components";
export function Search({
  items,
  label,
  onResults,
  t,
  onState,
  itemKeys,
  onKeys,
}: {
  items: string[];
  label: string;
  onResults?: (ids: number[]) => void;
  itemKeys?: string[];
  onKeys?: (keys: string[]) => void;
  t: (s: string) => string;
  onState?: (state: { query: string; valid: boolean }) => void;
}) {
  const [query, setQuery] = useState(""),
    [regex, setRegex] = useState(false),
    [open, setOpen] = useState(false),
    [flags, setFlags] = useState("i"),
    [sample, setSample] = useState(""),
    [replacement, setReplacement] = useState(""),
    [result, setResult] = useState<any>(null);
  const serialized = JSON.stringify(items);
  const keySnapshot = JSON.stringify(itemKeys || []);
  useEffect(() => {
    const publish = (indices: number[]) => {
      onResults?.(indices);
      onKeys?.(
        indices
          .map((index) => itemKeys?.[index])
          .filter((key): key is string => typeof key === "string"),
      );
    };
    if (!regex) {
      onState?.({ query, valid: true });
      publish(
        items.flatMap((x, i) =>
          x.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? [i] : [],
        ),
      );
      return;
    }
    onState?.({ query, valid: false });
    if (query.length > 2048 || sample.length > 16384) {
      setResult({ error: "Pattern or sample exceeds limit" });
      publish([]);
      return;
    }
    const worker = new Worker(new URL("./regex.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(() => {
      worker.terminate();
      setResult({
        error: "Evaluation exceeded 150 ms; simplify the expression",
      });
      publish([]);
    }, 150);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      setResult(e.data);
      onState?.({ query, valid: !e.data.error });
      publish(
        e.data.values?.flatMap((yes: boolean, i: number) => (yes ? [i] : [])) ||
          [],
      );
      worker.terminate();
    };
    worker.postMessage({
      pattern: query,
      flags,
      sample,
      replacement,
      values: items,
    });
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [query, regex, flags, sample, replacement, serialized, keySnapshot]);
  return (
    <div
      className="search"
      onKeyDown={(event) => {
        if (event.key === "Escape" && query) {
          setQuery("");
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="search-line">
        <Field
          label={label}
          value={query}
          onChange={setQuery}
          clearLabel={`${t("Clear")} ${label}`}
        />
        <Button secondary onClick={() => setOpen(!open)}>
          {t("Regex builder")}
        </Button>
      </div>
      {open && (
        <section className="regex-panel">
          <label>
            <MaterialInput
              type="checkbox"
              aria-label={t("Use regular expression")}
              checked={regex}
              onChange={(e) => setRegex(e.target.checked)}
            />
            {t("Use regular expression")}
          </label>
          <Field label={t("Pattern")} value={query} onChange={setQuery} />
          <Field label={t("Flags")} value={flags} onChange={setFlags} />
          <p>
            ECMAScript RegExp, current Chromium engine. Flags: d g i m s u v y.
            Atomic groups, possessive quantifiers, conditionals, subroutines and
            execution traces are unavailable in this engine.
          </p>
          <div className="actions">
            {[
              "^",
              "$",
              "\\d+",
              "\\p{L}+",
              "[a-z]",
              "(?:word)",
              "(?<name>word)",
              "a|b",
              "(?=word)",
              "(?<=word)",
              "\\k<name>",
            ].map((x) => (
              <Button key={x} secondary onClick={() => setQuery(query + x)}>
                {x}
              </Button>
            ))}
          </div>
          <Field label={t("Test text")} value={sample} onChange={setSample} />
          <Field
            label="Replacement template ($1, $&amp;, $&lt;name&gt;)"
            value={replacement}
            onChange={setReplacement}
          />
          <p role="status">
            {result?.error ||
              `${result?.matches?.length || 0} matches · ${result?.ms?.toFixed(2) || 0} ms`}
          </p>
          <pre>{JSON.stringify(result?.matches || [], null, 2)}</pre>
          <p>{result?.replacement}</p>
          <p>
            Bounded worker evaluation terminates after 150 ms; at most 200
            matches. Nested quantifiers can backtrack heavily. Zero-width
            matches advance one code unit.
          </p>
          <Button
            secondary
            onClick={() => {
              setQuery("");
              setRegex(false);
              setFlags("i");
              setSample("");
            }}
          >
            Reset
          </Button>
        </section>
      )}
    </div>
  );
}
