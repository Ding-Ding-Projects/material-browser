// server.properties: lossless parse and serialize, plus typed descriptors for known keys.
// Unknown keys and comments survive a round trip unchanged; they are shown as gaps, never dropped.
function fail(code, detail) {
  return Object.assign(new Error(code), { code, detail });
}

/**
 * Each descriptor binds a key to a control. `control` is one of switch, choice, number, text.
 * `apply` is "restart" or "live". Bounds come from the server's own validation where it has
 * one; `bounds: null` means no source-backed bound is known and only the type is checked.
 */
const DESCRIPTORS = Object.freeze([
  {
    key: "motd",
    label: "Message of the day",
    control: "text",
    default: "A Minecraft Server",
    maxLength: 59,
    apply: "restart",
    help: "Shown under the server name in the multiplayer list.",
  },
  {
    key: "difficulty",
    label: "Difficulty",
    control: "choice",
    choices: ["peaceful", "easy", "normal", "hard"],
    default: "easy",
    apply: "live",
    help: "How hard the world is. Can be changed while running with the difficulty command.",
  },
  {
    key: "gamemode",
    label: "Default game mode",
    control: "choice",
    choices: ["survival", "creative", "adventure", "spectator"],
    default: "survival",
    apply: "restart",
    help: "The game mode new players start in.",
  },
  {
    key: "force-gamemode",
    label: "Force the default game mode on join",
    control: "switch",
    default: false,
    apply: "restart",
    help: "Puts every player back in the default game mode when they join.",
  },
  {
    key: "hardcore",
    label: "Hardcore",
    control: "switch",
    default: false,
    apply: "restart",
    help: "Players are banned on death. Usually set before the world is created.",
  },
  {
    key: "pvp",
    label: "Players can fight each other",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Allows player versus player damage.",
    until: "1.21.8",
    note: "Became a game rule in 1.21.9.",
  },
  {
    key: "max-players",
    label: "Maximum players",
    control: "number",
    default: 20,
    min: 0,
    max: 2147483647,
    step: 1,
    unit: "players",
    apply: "restart",
    help: "How many players can be online at once.",
  },
  {
    key: "view-distance",
    label: "View distance",
    control: "number",
    default: 10,
    min: 3,
    max: 32,
    step: 1,
    unit: "chunks",
    apply: "restart",
    help: "How far the server sends the world to players.",
  },
  {
    key: "simulation-distance",
    label: "Simulation distance",
    control: "number",
    default: 10,
    min: 3,
    max: 32,
    step: 1,
    unit: "chunks",
    apply: "restart",
    help: "How far from players the world keeps ticking.",
    since: "1.18",
  },
  {
    key: "spawn-protection",
    label: "Spawn protection radius",
    control: "number",
    default: 16,
    min: 0,
    max: 2147483647,
    step: 1,
    unit: "blocks",
    apply: "restart",
    help: "Non-operators cannot build this close to spawn.",
  },
  {
    key: "server-port",
    label: "Port",
    control: "number",
    default: 25565,
    min: 1,
    max: 65535,
    step: 1,
    unit: "TCP port",
    apply: "restart",
    help: "The TCP port players connect to.",
  },
  {
    key: "online-mode",
    label: "Check accounts with Minecraft services",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Turning this off lets anyone join with any name. Leave on unless you run a proxy.",
  },
  {
    key: "white-list",
    label: "Only allowlisted players can join",
    control: "switch",
    default: false,
    defaultsFrom: [["26.3", true]],
    apply: "live",
    help: "Use the Players tab to manage the allowlist. Defaults to on from 26.3.",
  },
  {
    key: "enforce-whitelist",
    label: "Kick players removed from the allowlist",
    control: "switch",
    default: false,
    apply: "live",
    help: "Removes online players who are no longer allowlisted.",
  },
  {
    key: "allow-flight",
    label: "Allow flight",
    control: "switch",
    default: false,
    apply: "restart",
    help: "Stops the server kicking players who fly with mods or plugins.",
  },
  {
    key: "spawn-monsters",
    label: "Spawn monsters",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Whether hostile mobs spawn.",
    until: "1.21.8",
    note: "Became a game rule in 1.21.9.",
  },
  {
    key: "allow-nether",
    label: "Allow the Nether",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Whether players can travel to the Nether.",
    until: "1.21.8",
    note: "Became a game rule in 1.21.9.",
  },
  {
    key: "enable-command-block",
    label: "Command blocks",
    control: "switch",
    default: false,
    apply: "restart",
    help: "Whether command blocks run.",
  },
  {
    key: "level-name",
    label: "World folder",
    control: "text",
    default: "world",
    maxLength: 80,
    pattern: "^[A-Za-z0-9 _-]+$",
    apply: "restart",
    help: "The folder the world is stored in.",
  },
  {
    key: "level-seed",
    label: "World seed",
    control: "text",
    default: "",
    maxLength: 32,
    apply: "restart",
    help: "Only used when a new world is generated.",
  },
  {
    key: "level-type",
    label: "World type",
    control: "choice",
    choices: [
      "minecraft:normal",
      "minecraft:flat",
      "minecraft:large_biomes",
      "minecraft:amplified",
      "minecraft:single_biome_surface",
    ],
    default: "minecraft:normal",
    apply: "restart",
    help: "Only used when a new world is generated.",
    since: "1.19",
  },
  {
    key: "generate-structures",
    label: "Generate structures",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Villages, temples and other structures in new chunks.",
  },
  {
    key: "player-idle-timeout",
    label: "Kick idle players after",
    control: "number",
    default: 0,
    min: 0,
    max: 2147483647,
    step: 1,
    unit: "minutes, 0 for never",
    apply: "live",
    help: "Idle players are kicked after this many minutes.",
  },
  {
    key: "enable-status",
    label: "Show in the server list",
    control: "switch",
    default: true,
    apply: "restart",
    help: "Whether the server answers server-list pings.",
  },
  {
    key: "enable-rcon",
    label: "Remote console (RCON)",
    control: "switch",
    default: false,
    apply: "restart",
    help: "Material Browser does not need RCON. Leave off unless another tool needs it.",
  },
  {
    key: "max-world-size",
    label: "Maximum world radius",
    control: "number",
    default: 29999984,
    min: 1,
    max: 29999984,
    step: 1,
    unit: "blocks",
    apply: "restart",
    help: "The world border cannot be larger than this.",
  },
]);

const BY_KEY = new Map(DESCRIPTORS.map((d) => [d.key, d]));

function compareVersions(a, b) {
  const pa = String(a)
    .split(/[.-]/)
    .map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = String(b)
    .split(/[.-]/)
    .map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0,
      y = pb[i] ?? 0;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else if (String(x) !== String(y)) return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/** Descriptors that apply to one release version; snapshots and unknown ids keep every key. */
function descriptorsFor(version) {
  const release = /^\d+(\.\d+)+$/.test(String(version || ""));
  return DESCRIPTORS.filter(
    (d) =>
      !release ||
      ((!d.since || compareVersions(version, d.since) >= 0) &&
        (!d.until || compareVersions(version, d.until) <= 0)),
  ).map((d) => ({
    ...d,
    available: release || ["motd", "server-port"].includes(d.key),
    versionApplicability: release ? "declared" : "unresolved",
    verification: "implemented-unverified",
    unavailableReason:
      release || ["motd", "server-port"].includes(d.key)
        ? null
        : "The selected snapshot, prerelease or historical identifier has no verified configuration schema",
  }));
}

function unescapeValue(raw) {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c) =>
    c[0] === "u" && c.length === 5
      ? String.fromCharCode(parseInt(c.slice(1), 16))
      : ({ n: "\n", t: "\t", r: "\r", f: "\f" }[c] ?? c),
  );
}

function escapeValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(
      /[^\x20-\x7e]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
}

/** Parse into ordered lines so comments, blanks and unknown keys survive. */
function parse(text) {
  if (
    typeof text !== "string" ||
    text.length > 1024 * 1024 ||
    text.includes("\0")
  )
    throw fail("INVALID_PROPERTIES");
  const physical = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g).filter(Boolean);
  const lines = [];
  for (let i = 0; i < physical.length; i++) {
    let raw = physical[i];
    let logical = raw.replace(/[\r\n]+$/, "");
    let eol = raw.slice(logical.length);
    if (!logical.trimStart() || /^[#!]/.test(logical.trimStart())) {
      lines.push({ raw, eol });
      continue;
    }
    while (
      (logical.match(/\\+$/)?.[0].length || 0) % 2 === 1 &&
      i + 1 < physical.length
    ) {
      logical = logical.slice(0, -1);
      const next = physical[++i];
      raw += next;
      const body = next.replace(/[\r\n]+$/, "");
      eol = next.slice(body.length);
      logical += body.replace(/^[ \t\f]+/, "");
    }
    logical = logical.replace(/^[ \t\f]+/, "");
    let separator = logical.length;
    let escaped = false;
    for (let j = 0; j < logical.length; j++) {
      const c = logical[j];
      if (!escaped && /[=: \t\f]/.test(c)) {
        separator = j;
        break;
      }
      if (c === "\\") escaped = !escaped;
      else escaped = false;
    }
    let offset = separator;
    while (/[ \t\f]/.test(logical[offset] || "!") && offset < logical.length)
      offset++;
    if (logical[offset] === "=" || logical[offset] === ":") offset++;
    while (/[ \t\f]/.test(logical[offset] || "!") && offset < logical.length)
      offset++;
    const key = unescapeValue(logical.slice(0, separator));
    const value = unescapeValue(logical.slice(offset));
    lines.push({
      raw,
      eol,
      key,
      value,
      originalKey: key,
      originalValue: value,
    });
  }
  return lines;
}
function toObject(lines) {
  const values = Object.create(null);
  for (const line of lines)
    if (line.key !== undefined) values[line.key] = line.value;
  return values;
}
function serialize(lines) {
  return lines
    .map((line, index) => {
      if (
        line.raw !== undefined &&
        (line.key === undefined ||
          (line.key === line.originalKey && line.value === line.originalValue))
      )
        return line.raw;
      const separator =
        index > 0 &&
        !/[\r\n]$/.test(lines[index - 1].raw || "") &&
        lines[index - 1].eol === ""
          ? "\n"
          : "";
      return (
        separator +
        escapeValue(line.key) +
        "=" +
        escapeValue(line.value) +
        (line.eol ?? "\n")
      );
    })
    .join("");
}

/** Validate one value against its descriptor and return the stored string. */
function coerce(descriptor, value) {
  switch (descriptor.control) {
    case "switch":
      if (typeof value !== "boolean")
        throw fail("INVALID_VALUE", descriptor.key);
      return value ? "true" : "false";
    case "choice":
      if (!descriptor.choices.includes(value))
        throw fail("INVALID_VALUE", descriptor.key);
      return value;
    case "number": {
      if (
        !Number.isInteger(value) ||
        value < descriptor.min ||
        value > descriptor.max
      )
        throw fail("INVALID_VALUE", descriptor.key);
      return String(value);
    }
    case "text": {
      if (
        typeof value !== "string" ||
        value.length > descriptor.maxLength ||
        /[\r\n\0]/.test(value)
      )
        throw fail("INVALID_VALUE", descriptor.key);
      if (
        descriptor.pattern &&
        value &&
        !new RegExp(descriptor.pattern).test(value)
      )
        throw fail("INVALID_VALUE", descriptor.key);
      return value;
    }
    default:
      throw fail("NO_CONTROL_FOR_KEY", descriptor.key);
  }
}

function defaultFor(descriptor, version) {
  let value = descriptor.default;
  const release = /^\d+(\.\d+)+$/.test(String(version || ""));
  if (!release) return null;
  for (const [from, v] of descriptor.defaultsFrom || [])
    if (release && compareVersions(version, from) >= 0) value = v;
  return value;
}

/** Read typed values for the UI: known keys typed, unknown keys listed separately. */
function typedView(text, version) {
  const lines = parse(text);
  const values = toObject(lines);
  const descriptors = descriptorsFor(version);
  const known = new Set(descriptors.map((d) => d.key));
  const typed = descriptors.map((d) => {
    const raw = Object.hasOwn(values, d.key) ? values[d.key] : undefined;
    let value = defaultFor(d, version);
    let valid = true;
    if (raw !== undefined) {
      if (d.control === "switch") {
        valid = raw === "true" || raw === "false";
        value = valid ? raw === "true" : null;
      } else if (d.control === "number") {
        valid =
          /^-?\d+$/.test(raw) &&
          Number.isSafeInteger(Number(raw)) &&
          Number(raw) >= d.min &&
          Number(raw) <= d.max;
        value = valid ? Number(raw) : null;
      } else {
        value = raw;
        if (d.control === "choice") valid = d.choices.includes(raw);
      }
    }
    return {
      ...d,
      value,
      present: raw !== undefined,
      valid,
      rawValue: raw,
      validationMessage: valid
        ? null
        : "Stored value does not satisfy this descriptor; the original text remains unchanged",
      defaultKnown: /^\d+(\.\d+)+$/.test(String(version || "")),
    };
  });
  const unknown = Object.entries(values)
    .filter(([k]) => !known.has(k))
    .map(([key, value]) => ({
      key,
      value,
      reason: "No typed control for this key yet; it is kept unchanged.",
    }));
  return { typed, unknown };
}

/** Apply typed changes. Keys without a descriptor are refused, so nothing bypasses the controls. */
function applyChanges(text, version, changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    throw fail("INVALID_REQUEST");
  const available = new Map(descriptorsFor(version).map((d) => [d.key, d]));
  const lines = parse(text);
  const restart = [];
  for (const [key, value] of Object.entries(changes)) {
    const descriptor = available.get(key);
    if (!descriptor || descriptor.available === false)
      throw fail("NO_CONTROL_FOR_KEY", key);
    const stored = coerce(descriptor, value);
    const matches = lines.filter((line) => line.key === key);
    if (matches.length) for (const line of matches) line.value = stored;
    else lines.push({ key, value: stored });
    if (descriptor.apply === "restart") restart.push(key);
  }
  return { text: serialize(lines), restart };
}

module.exports = {
  DESCRIPTORS,
  defaultFor,
  BY_KEY,
  descriptorsFor,
  compareVersions,
  parse,
  serialize,
  toObject,
  coerce,
  typedView,
  applyChanges,
};
