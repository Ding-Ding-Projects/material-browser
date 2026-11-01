export type Model = { name: string; model?: string; size?: number; digest?: string; details?: Record<string, any>; capabilities?: string[]; installed?: boolean; running?: boolean; source?: string; localAvailable?: boolean };
export type ModelJob = { id: string; model: string; state: string; progress?: { status?: string; digest?: string; total?: number; completed?: number }; errorCode?: string; cancellationRequested?: boolean; updatedAt?: string };
export type ModelStatus = { state: string; version?: string; installed?: { found: boolean; version?: string }; reason?: string; checkedAt?: string; endpoint?: string };
export type ModelCatalogue = { models: Model[]; source?: string; retrievedAt?: string; complete: boolean; stale?: boolean; reason?: string; pageCount?: number };
export type ModelCapabilities = { actions?: string[]; reasons?: Record<string, string>; [key: string]: any };
export async function modelsRequest(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const bridge = window.materialBrowser as typeof window.materialBrowser & { localModels?: (action: string, params: Record<string, unknown>) => Promise<any> };
  if (!bridge?.localModels) throw new Error('Local model bridge unavailable');
  return bridge.localModels(action, params);
}
export const modelError = (e: unknown) => e instanceof Error ? e.message : 'Local model operation failed';
export function modelBytes(value: unknown, unknown: string) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${(value / 1024 ** 3).toFixed(2)} GiB` : unknown; }
