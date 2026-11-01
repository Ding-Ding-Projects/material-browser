/* Typed bridge to the main-process Ollama service on channel "material:ollama". */

export type OllamaState = "running" | "stopped" | "missing" | "unhealthy";
export type OllamaStatus = { state: OllamaState; version?: string; executable: string | null; reason?: string; startTimedOut?: boolean };
export type InstalledModel = {
  name: string;
  size: number | null;
  digest: string | null;
  modifiedAt: string | null;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
  loaded: boolean;
};
export type CatalogueTag = { tag: string; digest: string | null; size: number | null; context: string | null };
export type CatalogueModel = { name: string; description: string; capabilities: string[]; tags: CatalogueTag[] };
export type Catalogue = {
  available: boolean;
  origin: "network" | "cache";
  refreshFailed?: "offline" | "unparseable";
  retrievedAt?: number;
  ageMs?: number;
  pageCount?: number;
  modelCount?: number;
  tagCount?: number;
  complete?: boolean;
  failures?: { name: string; error: string }[];
  models?: CatalogueModel[];
};
export type Gpu = { name: string; vram: number | null; capped: boolean };
export type Hardware = {
  ramBytes: number;
  freeRamBytes: number;
  modelsPath: string;
  freeDiskBytes: number | null;
  gpus: Gpu[] | null;
  gpuMethod: string;
  vramBytes: number | null;
  vramLowerBound: boolean;
};
export type FitVerdict = "well" | "limits" | "unlikely" | "unknown";
export type Fit = { verdict: FitVerdict; reasons: string[]; needBytes?: number };
export type StoreRow = {
  name: string;
  model: string;
  tag: string;
  size: number | null;
  quant: string | null;
  context: string | null;
  capabilities: string[];
  installed: boolean;
  source: "catalogue" | "installed";
  fit: Fit;
};
export type Store = { catalogue: Omit<Catalogue, "models">; hardware: Hardware; rows: StoreRow[] };
export type QueueState = "queued" | "pulling" | "done" | "failed" | "cancelled";
export type QueueItem = { id: string; name: string; state: QueueState; completed: number; total: number; status: string; error: string | null; sizeHint: number | null };
export type Queue = { parallelism: number; running: boolean; items: QueueItem[] };
export type InstallerPlan = { version: string; url: string; size: number; sha256: string | null; hashSource: string | null; integrity: string | null };
export type InstallerResult = { ready: boolean; size: number; sha256: string; integrity: "verified" | "unverified"; version: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type OllamaEvent =
  | ({ type: "ollama.queue" } & Queue)
  | { type: "ollama.chat"; chatId: string; delta?: string; done?: boolean; stopped?: boolean; error?: string | null; stats?: { evalCount: number; totalDuration: number } | null }
  | { type: "ollama.installer"; phase: "downloading" | "ready" | "failed" | "cancelled"; received?: number; total?: number; integrity?: string; error?: string }
  | { type: "ollama.catalogue"; phase: "fetching"; done: number; total: number };

type Operations = {
  status: [{}, OllamaStatus];
  start: [{}, OllamaStatus];
  installed: [{}, { models: InstalledModel[] }];
  show: [{ name: string }, { details: Record<string, unknown> | null; capabilities: string[]; license: string | null }];
  delete: [{ name: string; confirmed: true }, { ok: true }];
  hardware: [{ force?: boolean }, Hardware];
  fit: [{ size: number; installed?: boolean }, Fit];
  store: [{ refresh?: boolean }, Store];
  "catalogue.get": [{}, Catalogue];
  "catalogue.refresh": [{}, Catalogue];
  "installer.check": [{}, InstallerPlan];
  "installer.download": [{}, InstallerResult];
  "installer.cancel": [{}, { ok: true }];
  "installer.run": [{ confirmed: true }, { launched: true; integrity: string }];
  "queue.list": [{}, Queue];
  "queue.add": [{ names: string[]; sizes?: Record<string, number | null> }, Queue];
  "queue.start": [{}, Queue];
  "queue.cancel": [{ id: string }, Queue];
  "queue.remove": [{ id: string }, Queue];
  "queue.clear": [{}, Queue];
  "queue.configure": [{ parallelism: number }, Queue];
  "chat.send": [{ chatId: string; model: string; messages: ChatMessage[] }, { chatId: string; started: true }];
  "chat.stop": [{ chatId: string }, { ok: true }];
};

export const ollamaAvailable = () => typeof (window as any).materialBrowser?.ollama === "function";

export async function ollama<K extends keyof Operations>(operation: K, params: Operations[K][0] = {} as Operations[K][0]): Promise<Operations[K][1]> {
  const bridge = (window as any).materialBrowser;
  if (!bridge || typeof bridge.ollama !== "function") throw new Error("BACKEND_UNAVAILABLE");
  return bridge.ollama(operation, params);
}

export function onOllamaEvent(listener: (event: OllamaEvent) => void): () => void {
  const bridge = (window as any).materialBrowser;
  if (!bridge || typeof bridge.onEvent !== "function") return () => {};
  return bridge.onEvent((event: any) => {
    if (event && typeof event.type === "string" && event.type.startsWith("ollama.")) listener(event as OllamaEvent);
  });
}

/** Strips the "Error invoking remote method ..." prefix Electron adds to rejected invokes. */
export function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}
