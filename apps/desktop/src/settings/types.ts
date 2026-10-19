export type Preferences = Record<string, any>;
export type SaveResult =
  | { ok: true; warning?: string }
  | { ok: false; message: string };
export type Revision = {
  id: string;
  at: string;
  action: string;
  keys: string[];
  preferences: Preferences;
  schedules: any[];
};
export type Notice = {
  id: string;
  at: string;
  kind: "info" | "success" | "warning" | "error";
  message: string;
  dismissed: boolean;
};
export type SettingsRecord = {
  schemaVersion: 1;
  revision: number;
  preferences: Preferences;
  writtenKeys: string[];
  schedules: any[];
  revisions: Revision[];
  undoStack: Array<{ preferences: Preferences; schedules: any[] }>;
  redoStack: Array<{ preferences: Preferences; schedules: any[] }>;
  notices: Notice[];
  section: string;
  snoozeUntil: number;
};
