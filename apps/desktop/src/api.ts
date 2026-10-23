export type Profile = {
  id: string;
  name: string;
  engine: string;
  automation: string;
  identity?: Record<string, unknown>;
  createdAt?: number | string;
  updatedAt?: number | string;
  sync?: unknown;
  passwordManager?: PasswordManager | null;
};
export type PasswordManager = {
  provider: "keepassxc";
  source: "installed" | "wsl";
  database: { mode: "existing" | "create"; path: string };
  extension: boolean;
  passkeys: boolean;
  wslDistribution?: string;
};
export type PasswordManagerDetection = {
  provider: "keepassxc";
  installed: { root: string; executable: string; proxy: string } | null;
  wslAvailable: boolean;
  wslDistributions: string[];
  recommendedSource: "installed" | "wsl" | "none";
  sourceRelease: string;
  wslRuntimeVerified: false;
  limits: string[];
};
export type Bridge = {
  request: (method: string, params?: Record<string, unknown>) => Promise<any>;
  chooseDirectory: () => Promise<string | null>;
  chooseDatabaseFile: () => Promise<string | null>;
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
  backend: "wsl2" | "windows-sandbox";
  launchMode: "terminal" | "browser" | "desktop";
  configurations?: Partial<
    Record<
      "wsl2" | "windows-sandbox",
      Omit<SuperProfileSettings, "configurations" | "backend">
    >
  >;
  rootfsPath?: string;
  rootfsSha256?: string;
  workspacePath?: string;
  setupCommands?: string[];
  startupCommands?: string[];
  installers?: string[];
  passwordManager?: PasswordManager | null;
  networking?: boolean;
  clipboard?: boolean;
  memoryMb?: number;
  [key: string]: unknown;
};
export type SuperProfile = {
  id: string;
  name: string;
  engine: string;
  settings: SuperProfileSettings;
  revisionId: string;
  createdAt: number;
  updatedAt: number;
};
export type SuperRevision = {
  id: string;
  superProfileId: string;
  parentId?: string;
  createdAt: number;
  name: string;
  engine: string;
  settings: SuperProfileSettings;
  archiveBytes: number;
};

export type SuperSession = {
  id: string;
  operationId?: string;
  profileId?: string;
  revisionId?: string;
  distribution?: string;
  backend: "wsl2" | "windows-sandbox";
  mode: "terminal" | "browser" | "desktop";
  state: string;
  phase?: string;
  message?: string;
  savedRevisionId?: string;
  saveConfirmationRequired?: boolean;
  guestRemoved?: boolean;
  saved?: boolean;
  cleanupPending?: boolean;
  events?: {
    sequence: number;
    timestampMs: number;
    phase: string;
    message: string;
  }[];
  health?: {
    status: string;
    observedAt?: number | null;
    sequence: number;
    source: string;
    visualVerified: false;
    detail: string;
  } | null;
};
type SuperCapability = {
  available: boolean;
  modes: string[];
  reason: string;
  runtimeVerified: boolean;
};
export type SuperCapabilities = {
  wsl2: SuperCapability;
  windowsSandbox: SuperCapability;
  stableIdentity: false;
};
export type SuperSavePreview = {
  sessionId: string;
  categories: { id: string; included: boolean; description: string }[];
  excluded: string[];
  stopped: boolean;
};
type RevisionTarget = { id: string; expectedRevisionId: string };
type SessionTarget = { sessionId: string };
type SuperProfileDraft = {
  name: string;
  engine: string;
  settings: SuperProfileSettings;
};
type SuperProfileMethods = {
  "superProfiles.list": {
    params: Record<string, never>;
    result: SuperProfile[];
  };
  "superProfiles.create": { params: SuperProfileDraft; result: SuperProfile };
  "superProfiles.update": {
    params: RevisionTarget & Partial<SuperProfileDraft>;
    result: SuperProfile;
  };
  "superProfiles.duplicate": {
    params: { id: string; name?: string };
    result: SuperProfile;
  };
  "superProfiles.remove": {
    params: RevisionTarget;
    result: { removed: boolean };
  };
  "superProfiles.revisions.list": {
    params: { id: string };
    result: SuperRevision[];
  };
  "superProfiles.revisions.restore": {
    params: RevisionTarget & { revisionId: string };
    result: SuperProfile;
  };
  "superProfiles.capabilities": {
    params: Record<string, never>;
    result: SuperCapabilities;
  };
  "superProfiles.sessions.launch": {
    params: { profileId: string; requireStableIdentity: false };
    result: SuperSession;
  };
  "superProfiles.sessions.status": {
    params: Record<string, never>;
    result: SuperSession[];
  };
  "superProfiles.sessions.stop": {
    params: SessionTarget;
    result: SuperSession;
  };
  "superProfiles.sessions.discard": {
    params: SessionTarget;
    result: SuperSession;
  };
  "superProfiles.sessions.preview": {
    params: SessionTarget;
    result: SuperSavePreview;
  };
  "superProfiles.sessions.save": {
    params: SessionTarget & {
      expectedRevisionId: string;
      categories: string[];
      closeAfterSave: boolean;
    };
    result: SuperSession;
  };
  "superProfiles.sessions.finalizeSave": {
    params: SessionTarget & {
      operationId: string;
      expectedRevisionId: string;
      confirmAfterUnlock: true;
    };
    result: {
      saved: true;
      revisionId: string;
      sessionId: string;
      operationId: string;
      cleanupPending: boolean;
    };
  };
};
export function requestSuperProfile<M extends keyof SuperProfileMethods>(
  method: M,
  ...args: Record<string, never> extends SuperProfileMethods[M]["params"]
    ? [params?: SuperProfileMethods[M]["params"]]
    : [params: SuperProfileMethods[M]["params"]]
): Promise<SuperProfileMethods[M]["result"]> {
  return request(method, args[0]);
}
