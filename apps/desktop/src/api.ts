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
