/** Typed bridge to the Minecraft server manager in the main process. */
export type TargetId = "local" | "docker" | "ssh" | "ssh-docker";
export type Flavour = "vanilla" | "paper" | "fabric";
export type SshHost = { hostname: string; user: string; port: number };
export type ServerState = "running" | "stopped" | "disconnected" | "not-owned";
export type Server = {
  id: string;
  name: string;
  target: TargetId;
  ssh?: SshHost;
  folder: string;
  edition: "java";
  version: string;
  flavour: Flavour;
  memoryMb: number;
  port: number;
  javaMajor: number | null;
  eulaAccepted: boolean;
  jar?: { sha256: string; source: string; verifiedBy: string[]; integrityKnown: boolean };
  runtime?: { image: string; javaMajor: number; exact: boolean; digest: string | null };
  status: { state: ServerState; pid?: number | null; container?: string | null; reason?: string };
};
export type CatalogueVersion = { id: string; channel: "release" | "snapshot" | "old_beta" | "old_alpha"; releaseTime: string };
export type Catalogue = {
  source: string;
  retrievedAt: string;
  complete: boolean;
  count: number;
  stale: boolean;
  latest: { release: string; snapshot: string };
  versions: CatalogueVersion[];
};
export type VersionDetail = { id: string; server: { size: number } | null; unavailableReason: string | null; javaMajor: number | null; javaNote: string | null };
export type Descriptor = {
  key: string;
  label: string;
  control: "switch" | "choice" | "number" | "text";
  value: any;
  default: any;
  choices?: string[];
  min?: number;
  max?: number;
  unit?: string;
  maxLength?: number;
  apply: "live" | "restart";
  help: string;
  present: boolean;
};
export type ConfigView = { typed: Descriptor[]; unknown: { key: string; value: string; reason: string }[] };
export type Player = { uuid: string; name: string; allowlisted: boolean; operator: boolean; level: number; banned: boolean };
export type Plugin = { file: string; enabled: boolean; managed: boolean };
export type PluginHit = { id: string; title: string; description: string; license: string; downloads: number };
export type Backup = { folder: string; createdAt: string; label: string; worlds: string[]; files: number; sha256: string; damaged?: boolean };
export type CreatePlan = {
  target: TargetId;
  ssh?: SshHost;
  edition: "java";
  flavour: Flavour;
  name: string;
  version: string;
  port: number;
  memoryMb: number;
  folder: string;
  eulaAccepted: boolean;
};
export type CreateStep = { key: string; state: "running" | "done" | "failed"; detail?: string };

export function minecraft<T = any>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const bridge = (window as any).materialBrowser;
  if (!bridge?.minecraft) return Promise.reject(new Error("BACKEND_UNAVAILABLE"));
  return bridge.minecraft(operation, params);
}

export function onMinecraftEvent(listener: (event: any) => void): () => void {
  const bridge = (window as any).materialBrowser;
  if (!bridge?.onEvent) return () => {};
  return bridge.onEvent((event: any) => {
    if (event && typeof event.type === "string" && event.type.startsWith("minecraft.")) listener(event);
  });
}

/** Plain-language explanation of a failure code from the service. */
export function explain(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const code = text.replace(/^Error invoking remote method '[^']+': (Error: )?/, "").split(":")[0];
  const known: Record<string, string> = {
    EULA_NOT_ACCEPTED: "Accept the Minecraft EULA for this server before starting it.",
    PORT_IN_USE: "Another program is already using this port. Choose a different port in Configuration.",
    JAVA_MISSING: "No Java runtime was found on this PC.",
    JAVA_TOO_OLD: "The Java runtime on this host is older than this version needs.",
    SSH_DISCONNECTED: "The SSH host could not be reached. The server may still be running there.",
    SSH_HOST_NOT_APPROVED: "This host's key is not in your known hosts. Connect once with ssh to approve it, then try again.",
    SSH_CLIENT_MISSING: "The OpenSSH client is not installed on this PC.",
    DOCKER_MISSING: "Docker is not installed on this PC.",
    STOP_TIMEOUT: "The server did not stop within 90 seconds. It is still running; nothing was forced.",
    STOP_SERVER_FIRST: "Stop the server before restoring a backup.",
    NO_SERVER_DOWNLOAD: "The official catalogue has no server download for this version.",
    EDITION_UNAVAILABLE: "Bedrock servers cannot be created in this build.",
    DOWNLOAD_INTEGRITY_FAILED: "The download did not match its published checksum and was discarded.",
    JAR_INTEGRITY_FAILED: "The server runtime failed verification and was not executed. Rejected cache files are retained separately. Retry to acquire verified bytes.",
    JAR_QUARANTINE_FAILED: "The rejected cache file could not be retained safely. Review storage access before retrying.",
    UNSAFE_JAR_PATH: "The runtime cache path is linked, shared or changed. Review the managed cache location before retrying.",
    NO_PLUGIN_SUPPORT: "Vanilla servers do not load plugins. Use Paper for plugins or Fabric for mods.",
    PLAYER_NOT_FOUND: "No Minecraft account has that name.",
    WORLD_PRESET_UNSUPPORTED: "This preset is present in the selected version, but its generator is not implemented by the world customization builder.",
    BACKEND_UNAVAILABLE: "The server manager is not available in this window.",
  };
  return known[code] || text;
}
