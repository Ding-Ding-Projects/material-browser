/** Default KeePassXC pairing offered to new profiles. Saved on this computer only. */
export type ManagerDefaults = {
  enabled: boolean;
  source: "installed" | "wsl";
  wslDistribution: string;
  databaseMode: "existing" | "create";
  databasePath: string;
  extension: boolean;
  passkeys: boolean;
};
const KEY = "passwordManager.defaults.v1";
export const MANAGER_DEFAULTS: ManagerDefaults = {
  enabled: false,
  source: "installed",
  wslDistribution: "",
  databaseMode: "existing",
  databasePath: "",
  extension: true,
  passkeys: true,
};
export function readManagerDefaults(): ManagerDefaults {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      ...MANAGER_DEFAULTS,
      ...(value && typeof value === "object" ? value : {}),
    };
  } catch {
    return { ...MANAGER_DEFAULTS };
  }
}
export function writeManagerDefaults(value: ManagerDefaults) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new Event("manager-defaults"));
  } catch {}
}
