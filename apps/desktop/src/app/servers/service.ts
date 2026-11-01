export type Server = {
  id: string; name: string; edition: string; version: string; target: string; flavour: string;
  status: string; memoryMb: number; port: number; pid?: number;
  integrity?: { sha1?: string; size?: number; source?: string };
  runtime?: { javaMajor?: number }; properties?: Record<string, string>;
};
export type Capability = { id: string; available: boolean; reason?: string };
export type Capabilities = { targets: Capability[]; editions: Capability[]; flavours: string[]; actions: string[] };
export type Version = { id: string; type: string; releaseTime: string; serverDistribution?: string };
export const targetNames: Record<string, string> = { 'local-process': 'This PC', 'local-docker': 'Docker here', 'ssh-process': 'SSH host', 'ssh-docker': 'Docker over SSH' };
export async function serverRequest(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const bridge = window.materialBrowser as (typeof window.materialBrowser & { gameServers?: (action: string, params: Record<string, unknown>) => Promise<any> });
  if (!bridge?.gameServers) throw new Error('Server service unavailable');
  return bridge.gameServers(action, params);
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Server operation failed';
}
