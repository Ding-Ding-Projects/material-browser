// Strict parser rejects duplicate object keys before schema validation.
export function parseVocabulary(text) {
  if (new TextEncoder().encode(text).length > 262144)
    throw new Error("WORDING_TOO_LARGE");
  let i = 0;
  function ws() {
    while (/\s/.test(text[i] || "") && i < text.length) i++;
  }
  function str() {
    const start = i++;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i++] === '"') return JSON.parse(text.slice(start, i));
    }
    throw new Error("INVALID_WORDING");
  }
  function value(depth) {
    if (depth > 8) throw new Error("WORDING_DEPTH");
    ws();
    if (text[i] === '"') return str();
    if (text[i] === "{") {
      i++;
      const out = Object.create(null);
      const keys = new Set();
      ws();
      if (text[i] === "}") {
        i++;
        return out;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') throw new Error("INVALID_WORDING");
        const key = str();
        if (
          keys.has(key) ||
          ["__proto__", "constructor", "prototype"].includes(key)
        )
          throw new Error("INVALID_WORDING");
        keys.add(key);
        ws();
        if (text[i++] !== ":") throw new Error("INVALID_WORDING");
        out[key] = value(depth + 1);
        ws();
        const sep = text[i++];
        if (sep === "}") return out;
        if (sep !== ",") throw new Error("INVALID_WORDING");
      }
    }
    const match =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(i),
      );
    if (!match) throw new Error("INVALID_WORDING");
    i += match[0].length;
    return JSON.parse(match[0]);
  }
  const result = value(0);
  ws();
  if (
    i !== text.length ||
    !result ||
    typeof result !== "object" ||
    Object.keys(result).sort().join(",") !== "entries,schemaVersion" ||
    result.schemaVersion !== 1 ||
    !result.entries ||
    typeof result.entries !== "object" ||
    Array.isArray(result.entries)
  )
    throw new Error("INVALID_WORDING");
  for (const [key, val] of Object.entries(result.entries)) {
    if (
      !key.length ||
      [...key].length > 160 ||
      typeof val !== "string" ||
      [...val].length > 1000
    )
      throw new Error("INVALID_WORDING");
  }
  return result;
}
export function replaceLabel(text, entries) {
  return Object.prototype.hasOwnProperty.call(entries, text)
    ? entries[text]
    : text;
}
