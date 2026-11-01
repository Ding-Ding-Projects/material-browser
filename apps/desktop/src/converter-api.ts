/* Typed bridge to the local file converter in the Electron main process.
   Only file paths and options cross the bridge; file contents never leave the main process. */

export type ConverterCategoryId = "image" | "document" | "data" | "media";
export type ConverterTarget = "png" | "jpeg" | "json" | "csv" | "json-pretty" | "json-minified";

export type ConverterCategory = {
  id: ConverterCategoryId;
  label: string;
  available: boolean;
  reason: string | null;
  inputs: string[];
  targets: ConverterTarget[];
};
export type ConverterCapabilities = { categories: ConverterCategory[]; limits: { image: number; data: number } };

export type InspectedFile = {
  path: string;
  name: string;
  category: ConverterCategoryId | null;
  available: boolean;
  reason: string | null;
  targets: ConverterTarget[];
  defaultTarget: ConverterTarget | null;
};

export type JobState = "queued" | "running" | "done" | "failed" | "canceled" | "unavailable";
export type ConverterJob = {
  id: string;
  input: string;
  name: string;
  category: ConverterCategoryId | null;
  target: ConverterTarget | string | null;
  state: JobState;
  stage: "" | "reading" | "converting" | "writing" | "checking";
  progress: number;
  output: string | null;
  bytes: number | null;
  error: string | null;
  detail: string | null;
  folder: string | null;
};
export type ConverterStatus = { outputFolder: string | null; busy: boolean; jobs: ConverterJob[] };
export type EnqueueItem = { path: string; target?: ConverterTarget; width?: number };

type Operations = {
  capabilities: [Record<string, never>, ConverterCapabilities];
  status: [Record<string, never>, ConverterStatus];
  "choose-files": [{ category?: ConverterCategoryId }, InspectedFile[]];
  inspect: [{ paths: string[] }, InspectedFile[]];
  "choose-folder": [Record<string, never>, { outputFolder: string | null }];
  enqueue: [{ items: EnqueueItem[] }, { ids: string[] }];
  cancel: [{ id: string }, { ok: boolean }];
  clear: [Record<string, never>, { ok: boolean }];
  reveal: [{ id: string }, { ok: boolean }];
};
export type ConverterOperation = keyof Operations;

/** True when the converter bridge is present (the Electron build, not a plain browser preview). */
export function converterAvailable() {
  return typeof (window as any).materialBrowser?.converter === "function";
}

export function converter<K extends ConverterOperation>(
  operation: K,
  params: Operations[K][0] = {} as Operations[K][0],
): Promise<Operations[K][1]> {
  const bridge = (window as any).materialBrowser;
  if (typeof bridge?.converter !== "function") return Promise.reject(new Error("BACKEND_UNAVAILABLE"));
  return bridge.converter(operation, params);
}

/**
 * Absolute path of a file dropped onto the page. Electron 32 and later remove File.path,
 * so this uses webUtils.getPathForFile when the preload exposes it. Returns "" when
 * neither is available.
 */
export function pathOfDroppedFile(file: File): string {
  const bridge = (window as any).materialBrowser;
  try {
    if (typeof bridge?.pathForFile === "function") return String(bridge.pathForFile(file) || "");
  } catch {}
  const legacy = (file as File & { path?: string }).path;
  return typeof legacy === "string" ? legacy : "";
}
