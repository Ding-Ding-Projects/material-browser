/** Local, non-sensitive presentation preferences. Credentials and imported wording are excluded. */
export const SCHEMA_VERSION = 1;
export const categories = [
  ["language", "Language and voice"],
  ["appearance", "Appearance"],
  ["accessibility", "Accessibility"],
  ["focus", "Focus and time"],
  ["notifications", "Notifications"],
  ["schedules", "Schedules"],
  ["history", "History and transfer"],
  ["privacy", "Privacy and access"],
  ["tools", "Tools and integrations"],
  ["about", "About and coverage"],
];
const select = (key, category, label, initial, options, help) => ({
  key,
  category,
  label,
  initial,
  type: "select",
  options,
  help,
});
const toggle = (key, category, label, initial, help) => ({
  key,
  category,
  label,
  initial,
  type: "boolean",
  help,
});
const range = (key, category, label, initial, min, max, step, help) => ({
  key,
  category,
  label,
  initial,
  type: "number",
  min,
  max,
  step,
  help,
});
export const definitions = [
  select(
    "language",
    "language",
    "Language",
    "en",
    [
      ["en", "English"],
      ["yue", "廣東話"],
      ["both", "English · 廣東話"],
    ],
    "Choose the language used throughout the workspace. Technical values and stored records are not translated.",
  ),
  range(
    "funnyEnglish",
    "language",
    "English message style",
    5,
    1,
    5,
    1,
    "Level 1 is direct and serious. Level 5 adds playful context. Actions, counts and errors retain the same facts.",
  ),
  range(
    "funnyCantonese",
    "language",
    "Cantonese message style",
    5,
    1,
    5,
    1,
    "This controls Cantonese messages independently from English. Both style levels start at 5.",
  ),
  toggle(
    "dialogEmoji",
    "language",
    "Show dialog decorations",
    true,
    "Add one relevant decorative symbol to dialog messages. Action labels and accessible names stay factual.",
  ),
  toggle(
    "narration",
    "language",
    "Narrate application messages",
    false,
    "Speak non-sensitive application status messages only after you enable this. Passwords and imported wording are never read aloud.",
  ),
  select(
    "narratorLanguage",
    "language",
    "Narration language",
    "en",
    [
      ["en", "English"],
      ["yue", "廣東話"],
      ["both", "English then Cantonese"],
    ],
    "Both languages are spoken in order, never simultaneously. Missing voices are reported rather than substituted with an unrelated language.",
  ),
  {
    key: "voiceEnglish",
    category: "language",
    label: "English voice",
    initial: "",
    type: "voice",
    help: "Choose a voice reported by this computer. Automatic selection uses an available local English voice when possible.",
  },
  {
    key: "voiceCantonese",
    category: "language",
    label: "Cantonese voice",
    initial: "",
    type: "voice",
    help: "Choose a Hong Kong Cantonese voice reported by this computer. A saved but missing voice remains selected and its fallback is stated.",
  },
  range(
    "speechRate",
    "language",
    "Speech rate",
    1,
    0.1,
    2,
    0.1,
    "Adjust the platform speech rate. One is normal delivery; unavailable speech synthesis remains explicitly unavailable.",
  ),
  range(
    "speechPitch",
    "language",
    "Speech pitch",
    1,
    0,
    2,
    0.1,
    "Adjust the platform speech pitch between zero and two. One is the normal voice pitch.",
  ),
  toggle(
    "screenReaderMode",
    "language",
    "Yield narration to a screen reader",
    false,
    "Suppress automatic application narration while using assistive speech. Browser rendering cannot reliably detect every screen reader, so this explicit choice is preserved.",
  ),
  select(
    "theme",
    "appearance",
    "Theme",
    "light",
    [
      ["light", "Light"],
      ["dark", "Dark"],
    ],
    "Apply a light or dark palette immediately. A matching schedule can temporarily override this base choice.",
  ),
  select(
    "density",
    "appearance",
    "Density",
    "comfortable",
    [
      ["comfortable", "Comfortable"],
      ["compact", "Compact"],
    ],
    "Change spacing without removing controls. Larger accessibility targets still take precedence.",
  ),
  {
    key: "accent",
    category: "appearance",
    label: "Accent",
    initial: "#475f99",
    type: "color",
    help: "Choose the primary accent with the continuous native color selector or exact hexadecimal entry. Full multi-space color conversion remains incomplete.",
  },
  select(
    "fontFamily",
    "appearance",
    "Interface font",
    "system",
    [
      ["system", "System interface"],
      ["sans-serif", "Generic sans-serif"],
      ["serif", "Generic serif"],
      ["monospace", "Generic monospace"],
    ],
    "Select a platform font family with a CJK-safe fallback. Installed-font enumeration and variable-axis editing are not yet available.",
  ),
  range(
    "fontScale",
    "appearance",
    "Interface text scale",
    1,
    0.8,
    1.6,
    0.05,
    "Scale interface typography immediately. Accessibility text scaling combines with this value.",
  ),
  range(
    "fontWeight",
    "appearance",
    "Interface font weight",
    400,
    300,
    700,
    100,
    "Choose the standard interface weight. A font without the exact weight uses its platform-supported nearest weight.",
  ),
  select(
    "motion",
    "appearance",
    "Motion preference",
    "system",
    [
      ["system", "Follow operating system"],
      ["reduced", "Reduced motion"],
    ],
    "Reduced motion suppresses nonessential animation. The operating system preference is always respected, even when this choice follows the system.",
  ),
  select(
    "logoPreset",
    "appearance",
    "Workspace mark",
    "monogram",
    [
      ["monogram", "Letter mark"],
      ["profiles", "Profile stack"],
      ["compass", "Navigation mark"],
    ],
    "Choose a built-in presentation mark. This never changes the executable, data directory or installed identity. Custom-image processing remains unavailable.",
  ),
  toggle(
    "accessibilityVisible",
    "accessibility",
    "Show accessibility button",
    true,
    "Keep accessibility controls reachable in the persistent shell. Hiding requires a separate confirmation and does not reset preferences.",
  ),
  range(
    "textScale",
    "accessibility",
    "Accessibility text scale",
    1,
    1,
    2,
    0.1,
    "Increase readable interface text while preserving the base appearance scale. The layout must remain scrollable at larger values.",
  ),
  toggle(
    "highContrast",
    "accessibility",
    "Higher contrast",
    false,
    "Strengthen text, panel boundaries and control outlines in the current theme. This changes the live workspace immediately.",
  ),
  toggle(
    "strongFocus",
    "accessibility",
    "Stronger keyboard focus",
    false,
    "Increase the visible focus outline for keyboard navigation. It does not move focus or change tab order.",
  ),
  toggle(
    "largeTargets",
    "accessibility",
    "Larger interaction targets",
    false,
    "Increase minimum control hit areas and spacing. Compact density never overrides the accessible target size.",
  ),
  toggle(
    "focus",
    "focus",
    "Focus on the active workspace",
    false,
    "Dim inactive navigation while keeping it visible and immediately usable. Focused or hovered navigation returns to full emphasis.",
  ),
  toggle(
    "lowStimulation",
    "focus",
    "Low stimulation",
    false,
    "Remove nonessential animation and suppress routine transient messages. Warnings and errors remain visible.",
  ),
  toggle(
    "timeAwareness",
    "focus",
    "Show elapsed session time",
    false,
    "Display elapsed time in the workspace. This is a factual timer without a score, deadline or productivity judgement.",
  ),
  toggle(
    "oneThing",
    "focus",
    "Keep one next action visible",
    false,
    "Show the action you enter below in the workspace so it survives navigation and restart. The application never chooses it for you.",
  ),
  {
    key: "nextAction",
    category: "focus",
    label: "Your next action",
    initial: "",
    type: "text",
    maxLength: 300,
    help: "Write a short action you want to keep in view. Empty text shows an honest prompt to choose an action. It is local personal content.",
  },
  toggle(
    "momentum",
    "focus",
    "Offer an idle reminder",
    false,
    "Offer one dismissible reminder after the chosen idle interval. Not now suppresses further reminders for the stated snooze period.",
  ),
  range(
    "idleMinutes",
    "focus",
    "Idle interval in minutes",
    40,
    5,
    180,
    5,
    "Count time since the last pointer or keyboard activity. The reminder says only what happened and never grades your work.",
  ),
  range(
    "snoozeMinutes",
    "focus",
    "Reminder snooze in minutes",
    30,
    5,
    180,
    5,
    "Not now keeps the reminder quiet for this interval. The deadline persists across a reload.",
  ),
  range(
    "toastSeconds",
    "notifications",
    "Routine notification duration",
    6,
    3,
    30,
    1,
    "Routine messages auto-dismiss after this many seconds. Warnings and errors remain until explicitly dismissed.",
  ),
  toggle(
    "quietEnabled",
    "notifications",
    "Quiet hours",
    false,
    "During the local time window, suppress routine narration and transient messages. Errors remain available and all messages remain in the centre.",
  ),
  {
    key: "quietStart",
    category: "notifications",
    label: "Quiet hours start",
    initial: "22:00",
    type: "time",
    help: "Start quiet hours in this computer’s local timezone. A window may cross midnight.",
  },
  {
    key: "quietEnd",
    category: "notifications",
    label: "Quiet hours end",
    initial: "08:00",
    type: "time",
    help: "End quiet hours in local time. Equal start and end means quiet all day.",
  },
  select(
    "paletteSize",
    "appearance",
    "Command palette size",
    "card",
    [
      ["card", "Bounded card"],
      ["full", "Full window"],
    ],
    "Choose the presentation of the command palette opened with Ctrl+Shift+F. Its search state remains independent.",
  ),
];
export const defaults = Object.freeze(
  Object.fromEntries(definitions.map((d) => [d.key, d.initial])),
);
const byKey = new Map(definitions.map((d) => [d.key, d]));
export function validateValue(key, value) {
  const d = byKey.get(key);
  if (!d) throw new Error("Unknown setting");
  if (d.type === "boolean" && typeof value !== "boolean")
    throw new Error("Choose on or off");
  if (
    d.type === "number" &&
    (typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < d.min ||
      value > d.max ||
      Math.abs(
        (value - d.min) / d.step - Math.round((value - d.min) / d.step),
      ) > 1e-6)
  )
    throw new Error(`Use a value from ${d.min} to ${d.max}, step ${d.step}`);
  if (d.type === "select" && !d.options.some(([v]) => v === value))
    throw new Error("Choose an available option");
  if (
    ["text", "voice", "time", "color"].includes(d.type) &&
    (typeof value !== "string" ||
      value.length > (d.maxLength || 512) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
  )
    throw new Error("Text is invalid or too long");
  if (d.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Use a complete local time");
  if (d.type === "color" && !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error("Use a six-digit hexadecimal color");
  return value;
}
export function validatePreferences(value, { partial = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Settings must be an object");
  const result = partial ? {} : { ...defaults };
  for (const [k, v] of Object.entries(value)) {
    if (!Object.hasOwn(defaults, k)) throw new Error("Unknown setting");
    result[k] = validateValue(k, v);
  }
  return result;
}
export function migrateAppearance(legacy) {
  const out = { ...defaults };
  if (legacy && typeof legacy === "object")
    for (const key of ["language", "theme", "density", "accent"])
      if (Object.hasOwn(legacy, key)) {
        try {
          out[key] = validateValue(key, legacy[key]);
        } catch {}
      }
  return out;
}
export function validateSchedule(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule))
    throw new Error("Invalid schedule");
  const allowed = [
    "id",
    "label",
    "enabled",
    "priority",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "weekdays",
    "values",
    "source",
  ];
  if (Object.keys(rule).some((k) => !allowed.includes(k)))
    throw new Error("Unknown schedule field");
  if (
    typeof rule.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(rule.id) ||
    typeof rule.label !== "string" ||
    !rule.label.trim() ||
    rule.label.length > 120 ||
    typeof rule.enabled !== "boolean" ||
    !Number.isInteger(rule.priority) ||
    rule.priority < 0 ||
    rule.priority > 100
  )
    throw new Error("Invalid schedule identity or priority");
  if (rule.source !== "local")
    throw new Error("External schedule services are not available");
  for (const key of ["startTime", "endTime"])
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule[key]))
      throw new Error("Complete start and end times are required");
  for (const key of ["startDate", "endDate"])
    if (
      rule[key] !== "" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(rule[key]) ||
        new Date(rule[key] + "T00:00:00Z").toISOString().slice(0, 10) !==
          rule[key])
    )
      throw new Error("Invalid date");
  if (rule.startDate && rule.endDate && rule.startDate > rule.endDate)
    throw new Error("End date must not precede start date");
  if (
    !Array.isArray(rule.weekdays) ||
    !rule.weekdays.length ||
    rule.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6) ||
    new Set(rule.weekdays).size !== rule.weekdays.length
  )
    throw new Error("Choose at least one distinct weekday");
  const values = validatePreferences(rule.values, { partial: true });
  if (!Object.keys(values).length)
    throw new Error("Choose a setting to schedule");
  return { ...rule, label: rule.label.trim(), values };
}
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function timeWindowMatches(start, end, minute) {
  const s = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)),
    e = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  return s === e || s < e
    ? s === e || (minute >= s && minute < e)
    : minute >= s || minute < e;
}
export function scheduleMatches(rule, now) {
  if (!rule.enabled) return false;
  const minute = now.getHours() * 60 + now.getMinutes(),
    s =
      Number(rule.startTime.slice(0, 2)) * 60 + Number(rule.startTime.slice(3)),
    e = Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3));
  if (!timeWindowMatches(rule.startTime, rule.endTime, minute)) return false;
  const owner = new Date(now);
  if (s > e && minute < e) owner.setDate(owner.getDate() - 1);
  const day = dateKey(owner);
  return (
    rule.weekdays.includes(owner.getDay()) &&
    (!rule.startDate || day >= rule.startDate) &&
    (!rule.endDate || day <= rule.endDate)
  );
}
export function effectivePreferences(base, rules, now = new Date()) {
  let result = { ...base };
  const active = [];
  rules
    .map((r, index) => ({ r, index }))
    .sort((a, b) => a.r.priority - b.r.priority || a.index - b.index)
    .forEach(({ r }) => {
      if (scheduleMatches(r, now)) {
        result = { ...result, ...r.values };
        active.push(r.label);
      }
    });
  return { preferences: result, active };
}
export function exportPreferences(preferences, schedules = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    encoding: "UTF-8",
    lineEndings: "LF",
    omitted: [
      "Personal wording and file metadata",
      "Custom image bytes",
      "Credentials and vault data",
      "Device paths",
    ],
    preferences: validatePreferences(preferences),
    schedules: schedules.map(validateSchedule),
  };
}
export function parseImport(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > 262144
  )
    throw new Error("Import exceeds 256 KiB");
  const data = JSON.parse(text);
  if (
    !data ||
    data.schemaVersion !== SCHEMA_VERSION ||
    Object.keys(data).some(
      (k) =>
        ![
          "schemaVersion",
          "encoding",
          "lineEndings",
          "omitted",
          "preferences",
          "schedules",
        ].includes(k),
    )
  )
    throw new Error("Unsupported settings format");
  if (!Array.isArray(data.schedules) || data.schedules.length > 200)
    throw new Error("Invalid schedule collection");
  const schedules = data.schedules.map(validateSchedule);
  if (new Set(schedules.map((x) => x.id)).size !== schedules.length)
    throw new Error("Duplicate schedule identity");
  return { preferences: validatePreferences(data.preferences), schedules };
}
export function formatExport(value, format) {
  const rows = Object.entries(value.preferences).map(([setting, current]) => ({
    setting,
    value: current,
  }));
  const escape = (v) => '"' + String(v).replaceAll('"', '""') + '"';
  if (format === "json") return JSON.stringify(value, null, 2) + "\n";
  if (format === "jsonl")
    return (
      [
        JSON.stringify({
          type: "metadata",
          schemaVersion: 1,
          omitted: value.omitted,
        }),
        ...rows.map((r) => JSON.stringify({ type: "setting", ...r })),
        ...value.schedules.map((r) =>
          JSON.stringify({ type: "schedule", ...r }),
        ),
      ].join("\n") + "\n"
    );
  if (format === "csv" || format === "tsv") {
    const sep = format === "csv" ? "," : "\t";
    return (
      [
        ["type", "key", "value"],
        ["metadata", "omitted", JSON.stringify(value.omitted)],
        ...rows.map((r) => ["setting", r.setting, JSON.stringify(r.value)]),
        ...value.schedules.map((r) => ["schedule", r.id, JSON.stringify(r)]),
      ]
        .map((row) => row.map(escape).join(sep))
        .join("\n") + "\n"
    );
  }
  if (format === "md")
    return (
      "# Presentation preferences\n\nEncoding: UTF-8; line endings: LF; schema: 1.\n\nOmitted: " +
      value.omitted.join("; ") +
      ".\n\n```json\n" +
      JSON.stringify(value, null, 2) +
      "\n```\n"
    );
  throw new Error("Unsupported export format");
}
