export type Profile = {
  id: string;
  name: string;
  engine: string;
  automation: string;
  identity?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  sync?: unknown;
};
export type Bridge = {
  request: (method: string, params?: Record<string, unknown>) => Promise<any>;
  chooseDirectory: () => Promise<string | null>;
  settingsService: (
    operation: string,
    params?: Record<string, unknown>,
  ) => Promise<any>;
  onEvent: (listener: (event: unknown) => void) => () => void;
};
declare global {
  interface Window {
    materialBrowser?: Bridge;
  }
}
export async function request(
  method: string,
  params: Record<string, unknown> = {},
) {
  if (!window.materialBrowser) throw new Error("BACKEND_UNAVAILABLE");
  return window.materialBrowser.request(method, params);
}

export type SuperProfileSettings = {
  backend: 'wsl2' | 'windows-sandbox';
  launchMode: 'terminal' | 'browser' | 'desktop';
  configurations?: Partial<Record<'wsl2'|'windows-sandbox', Omit<SuperProfileSettings,'configurations'|'backend'>>>;
  rootfsPath?: string;
  rootfsSha256?: string;
  workspacePath?: string;
  setupCommands?: string[];
  startupCommands?: string[];
  installers?: string[];
  networking?: boolean;
  clipboard?: boolean;
  memoryMb?: number;
  [key: string]: unknown;
};
export type SuperProfile = {
  id: string; name: string; engine: string; settings: SuperProfileSettings;
  revisionId: string; createdAt: number; updatedAt: number;
};
export type SuperRevision = {
  id: string; superProfileId: string; parentId?: string; createdAt: number;
  name: string; engine: string; settings: SuperProfileSettings; archiveBytes: number;
};
