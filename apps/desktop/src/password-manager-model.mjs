/** Pure rules for the optional KeePassXC pairing offered during profile creation. */
export const DEFAULT_PASSWORD_MANAGER_FORM = Object.freeze({
  enabled: false,
  source: "installed",
  databaseMode: "existing",
  databasePath: "",
  wslDistribution: "",
  extension: true,
  passkeys: true,
});
export function wslDistributions(detection) {
  const list = detection?.wslDistributions;
  return Array.isArray(list) ? list.filter((d) => typeof d === "string" && d) : [];
}
export function recommendedSource(detection) {
  if (!detection || typeof detection !== "object") return "none";
  if (detection.installed) return "installed";
  if (wslDistributions(detection).length > 0) return "wsl";
  return "none";
}
export function sourceOptions(detection) {
  const recommended = recommendedSource(detection);
  return [
    {
      value: "installed",
      label: "Installed KeePassXC",
      available: recommended === "installed",
      reason:
        recommended === "installed"
          ? ""
          : "No KeePassXC installation from the maintained lineage was detected.",
    },
    {
      value: "wsl",
      label: "KeePassXC inside a WSL distribution",
      available: wslDistributions(detection).length > 0,
      reason:
        wslDistributions(detection).length > 0
          ? "The distribution must already contain KeePassXC from the maintained lineage."
          : "No WSL distribution was detected on this computer.",
    },
  ];
}
export function databaseBasename(path) {
  const text = String(path || "");
  const index = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
  return index >= 0 ? text.slice(index + 1) : text;
}
export function buildPasswordManager(form) {
  if (!form || !form.enabled) return null;
  const path = String(form.databasePath || "").trim();
  if (!path) throw new Error("DATABASE_PATH_REQUIRED");
  if (!/\.kdbx$/i.test(path) || /[\u0000-\u001f\u007f]/.test(path))
    throw new Error("DATABASE_PATH_INVALID");
  if (!["installed", "wsl"].includes(form.source))
    throw new Error("PASSWORD_MANAGER_SOURCE_INVALID");
  const document = {
    provider: "keepassxc",
    source: form.source,
    database: {
      mode: form.databaseMode === "create" ? "create" : "existing",
      path,
    },
    extension: form.extension !== false,
    passkeys: form.passkeys !== false,
  };
  if (form.source === "wsl") {
    const distribution = String(form.wslDistribution || "").trim();
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(distribution))
      throw new Error("WSL_DISTRIBUTION_REQUIRED");
    document.wslDistribution = distribution;
  }
  return document;
}
/** Guest pairing for a Super Profile template: the guest itself hosts KeePassXC. */
export function buildGuestPasswordManager(form) {
  const document = buildPasswordManager(
    form ? { ...form, source: "wsl", wslDistribution: "guest" } : form,
  );
  return document;
}
/** Facts for the inspector; the full path never leaves the native host's answer unredacted. */
export function describePasswordManager(manager) {
  if (!manager || typeof manager !== "object") return [];
  return [
    ["Password manager", "KeePassXC"],
    [
      "Password manager source",
      manager.source !== "wsl"
        ? "Installed KeePassXC"
        : manager.wslDistribution === "guest"
          ? "WSL guest"
          : `WSL: ${manager.wslDistribution}`,
    ],
    ["Database", databaseBasename(manager.database?.path)],
    ["Browser extension", manager.extension ? "Enabled" : "Disabled"],
    ["Passkeys", manager.passkeys ? "Enabled" : "Disabled"],
  ];
}
