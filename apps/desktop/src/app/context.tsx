import React, { createContext, useContext } from "react";
import type { Profile } from "../api";
import type { SettingsController } from "../settings/store";
import type { createOperationRegistry } from "../workspace/model.mjs";
import type { LockStore } from "./locks";

export type Page = "profiles" | "launch" | "super-profiles" | "sync" | "servers" | "models" | "tools" | "settings";
export type Runtime = {
  profileId: string;
  pid: number;
  engine: string;
  effectiveMode: string;
  engineVersion: string;
  seenAt: number;
};
export type Status = {
  exists: boolean;
  unlocked: boolean;
  locked: boolean;
  vaultExists: boolean;
  liveSnapshotSupported?: boolean;
} | null;

export type AppContextValue = {
  t: (s: string) => string;
  prefs: SettingsController["preferences"];
  settings: SettingsController;
  narrator: any;
  displayName: string;
  status: Status;
  profiles: Profile[];
  runtimes: Runtime[];
  selected: string;
  setSelected: (id: string) => void;
  page: Page;
  navigate: (page: Page, options?: { profile?: string; section?: string; setting?: string }) => void;
  launchTarget: string;
  refresh: () => Promise<void>;
  refreshRuntime: () => Promise<void>;
  perform: (fn: () => Promise<any>, keys?: string[], label?: [string, string]) => Promise<any>;
  operations: ReturnType<typeof createOperationRegistry>;
  pending: string[];
  busy: boolean;
  conflicts: any[];
  loadConflicts: () => Promise<void>;
  openCreate: () => void;
  openPalette: (query?: string) => void;
  locks: LockStore;
  requireUnlock: (id: string, then: () => void) => void;
  snack: (message: string, action?: { label: string; run: () => void }) => void;
  now: number;
};

export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("App context missing");
  return value;
}

/** "42 min", "1 h 5 min": time since this window first observed the browser running. */
export function elapsed(since: number, now: number, t: (s: string) => string) {
  const minutes = Math.max(0, Math.floor((now - since) / 60000));
  if (minutes < 1) return t("just now");
  if (minutes < 60) return `${minutes} ${t("min")}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${t("h")} ${minutes % 60} ${t("min")}`;
}

export function ago(at: number | string | undefined, now: number, t: (s: string) => string) {
  if (at === undefined || at === null || at === "") return t("Unavailable");
  const value = typeof at === "number" ? (at < 1e12 ? at * 1000 : at) : Date.parse(at);
  if (!Number.isFinite(value)) return t("Unavailable");
  const minutes = Math.floor((now - value) / 60000);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return `${minutes} ${t("min ago")}`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} ${t("h ago")}`;
  return new Date(value).toLocaleDateString();
}

export function dateOf(at: number | string | undefined) {
  if (at === undefined || at === null || at === "") return "";
  const value = typeof at === "number" ? (at < 1e12 ? at * 1000 : at) : Date.parse(at);
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "";
}

export const engineLabel = (engine: string) =>
  engine === "chromium" ? "Chromium" : engine === "firefox" ? "Firefox" : engine;
export const automationLabel = (mode: string, t: (s: string) => string) =>
  mode === "selenium" ? "Selenium" : mode === "puppeteer" ? "Puppeteer" : t("No automation");

export function Provider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
