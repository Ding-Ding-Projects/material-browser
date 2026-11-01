/** Pure table and operation rules, independent of rendering and native transport. */
export function visibleProfiles(profiles, matchedIds, engine, sort) {
  const allowed = new Set(matchedIds);
  const direction = sort.direction === "desc" ? -1 : 1;
  return profiles
    .filter(
      (p) => allowed.has(p.id) && (engine === "all" || p.engine === engine),
    )
    .slice()
    .sort((a, b) => {
      const left = String(a[sort.key] || ""),
        right = String(b[sort.key] || "");
      return (
        direction *
          left.localeCompare(right, undefined, {
            numeric: true,
            sensitivity: "base",
          }) || a.id.localeCompare(b.id)
      );
    });
}
export function validSelection(profiles, selected) {
  return profiles.some((p) => p.id === selected) ? selected : "";
}
export function selectedTargets(profiles, checked) {
  const ids = new Set(checked);
  return profiles.filter((p) => ids.has(p.id));
}
export function observedRuntime(runtime) {
  if (!runtime) return "Unavailable";
  if (Number.isInteger(runtime.pid) && runtime.pid > 0) return "Running";
  if (typeof runtime.state === "string") return runtime.state;
  if (typeof runtime.running === "boolean")
    return runtime.running ? "Running" : "Stopped";
  return "Unavailable";
}
/** @param {(keys: string[]) => void} onChange */
export function createOperationRegistry(onChange = (_keys) => {}) {
  const pending = new Set();
  const blocked = (keys) =>
    pending.has("*") ||
    (keys.includes("*")
      ? pending.size > 0
      : keys.some((key) => pending.has(key)));
  return {
    async run(key, action) {
      return this.runMany([key], action);
    },
    async runMany(keys, action) {
      if (blocked(keys)) return { accepted: false };
      const owned = [...new Set(keys)];
      owned.forEach((key) => pending.add(key));
      onChange([...pending]);
      try {
        return { accepted: true, value: await action() };
      } finally {
        owned.forEach((key) => pending.delete(key));
        onChange([...pending]);
      }
    },
    has(key) {
      return pending.has("*") || pending.has(key);
    },
    blocked,
  };
}
export async function runTargets(targets, action, failure) {
  const results = [];
  for (const target of targets) {
    try {
      await action(target);
      results.push({
        id: target.id,
        name: target.name,
        ok: true,
        message: "Completed",
      });
    } catch (error) {
      results.push({
        id: target.id,
        name: target.name,
        ok: false,
        message: failure(error),
      });
    }
  }
  return results;
}
export function catalogDestinations(definitions, categories = []) {
  return [
    ...[
      ["profiles", "Profiles"],
      ["super-profiles", "Super Profiles"],
      ["sync", "Synchronization"],
      ["servers", "Minecraft servers"],
      ["models", "Local models"],
      ["tools", "Tools"],
      ["settings", "Settings"],
    ].map(([id, label]) => ({ id: `page:${id}`, label, page: id })),
    ...categories.map((category) => ({
      id: `category:${category[0]}`,
      label: `Settings: ${category[1]}`,
      page: "settings",
      section: category[0],
    })),
    { id: "action:setup", label: "Setup" },
    { id: "action:create", label: "Create profile" },
    { id: "action:lock", label: "Lock vault" },
    ...definitions.map((d) => ({
      id: `setting:${d.key}`,
      label: `Settings: ${d.label}`,
      page: "settings",
      section: d.category,
      setting: d.key,
    })),
  ];
}

export function timestampDate(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function inspectorWidth(value) {
  const width = Number(value);
  return Number.isFinite(width) ? Math.min(360, Math.max(320, width)) : 340;
}

export function profileOperationParams(
  method,
  profile,
  extra = {},
  copyLabel = "Copy",
) {
  return {
    id: profile.id,
    ...(method === "profiles.duplicate"
      ? { name: `${profile.name} (${copyLabel})` }
      : {}),
    ...extra,
  };
}
