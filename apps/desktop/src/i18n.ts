import { workspaceZh } from "./workspace/locale";
import { superProfilesZh } from "./SuperProfiles.locale";
import { settingsZh } from "./settings/locale.mjs";
import { appZh } from "./app/locale";
import { serversZh } from "./app/Servers.locale";
import { ollamaZh } from "./app/Ollama.locale";
import { toolboxZh } from "./app/Toolbox.locale";
export type Language = "en" | "yue" | "both";
export const zh: Record<string, string> = {
  Profiles: "設定檔",
  Synchronization: "同步",
  Sync: "同步",
  "No matches": "冇符合項目",
  Settings: "設定",
  Search: "搜尋",
  "Regex builder": "正則表達式編輯器",
  "Create profile": "建立設定檔",
  Name: "名稱",
  Engine: "瀏覽器引擎",
  Create: "建立",
  Cancel: "取消",
  Overview: "概覽",
  Revisions: "版本",
  Automation: "自動化",
  Launch: "啟動",
  "Launch profile": "啟動設定檔",
  "Launch with standard identity": "使用標準識別資料啟動",
  "Stable browser identity is unavailable in this build.":
    "呢個版本未支援穩定瀏覽器識別資料。",
  "The saved profile identity is not enforced, so websites may recognize a different browser identity.":
    "已儲存嘅設定檔識別資料唔會被強制套用，網站可能會識別到另一個瀏覽器身份。",
  "Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.":
    "標準啟動會使用引擎本身嘅識別資料，唔提供識別資料偽裝、跨裝置穩定識別資料或可攜瀏覽器登入憑證。",
  "Continue only if this standard identity behavior is suitable for this profile. This choice applies to this launch only.":
    "只有當標準識別資料適合呢個設定檔先繼續。呢個選擇只適用於今次啟動。",
  Stop: "停止",
  Duplicate: "複製",
  Snapshot: "建立快照",
  Refresh: "重新整理",
  Restore: "還原",
  Appearance: "外觀",
  "Personal wording": "個人用語",
  Language: "語言",
  Theme: "主題",
  Density: "密度",
  Accent: "主色",
  Light: "淺色",
  Dark: "深色",
  Comfortable: "舒適",
  Compact: "緊密",
  Upload: "上載",
  Clear: "清除",
  Save: "儲存",
  Off: "關閉",
  Password: "密碼",
  "Create vault": "建立保管庫",
  "Unlock vault": "解鎖保管庫",
  Back: "上一步",
  Next: "下一步",
  Skip: "略過",
  Finish: "完成",
  "Choose folder": "選擇資料夾",
  "Upload changes": "上載更改",
  "Download changes": "下載更改",
  Conflicts: "衝突",
  "Keep local": "保留本機版本",
  "Keep remote": "保留遠端版本",
  "No profiles yet": "尚未有設定檔",
  "Select a profile": "選擇設定檔",
  "Backend unavailable": "後端未能連接",
  "Retry connection": "重試連接",
  Setup: "初次設定",
  Connected: "已連接",
  Locked: "已鎖定",
  "No personal wording loaded": "尚未載入個人用語",
  "Personal wording loaded": "已載入個人用語",
  "Personal wording applied": "已套用個人用語",
  "Invalid personal wording file": "個人用語檔案無效",
  Pattern: "模式",
  Flags: "旗標",
  "Use regular expression": "使用正則表達式",
  "Test text": "測試文字",
  "No results": "沒有結果",
  "Command palette": "指令面板",
  Close: "關閉",
  "Save preference": "儲存偏好",
  "Saved preference": "已儲存偏好",
  "Effective mode": "實際模式",
  "Restart required": "需要重新啟動",
  Unavailable: "未能提供",
  "Lock vault": "鎖定保管庫",
  Working: "處理中",
  Completed: "已完成",
  "Optional synchronization": "選填同步設定",
  "Workspace ready": "工作區已就緒",
  "Profile identity": "設定檔識別資料",
  Updated: "更新時間",
  Version: "版本",
  "Local settings": "本機設定",
  "No revisions": "尚未有版本",
  "No conflicts": "沒有衝突",
  Folder: "資料夾",
  Configuration: "設定內容",
  "Setup progress": "設定進度",
};
Object.assign(zh, settingsZh, superProfilesZh, workspaceZh);
// Reviewed earlier wording wins over the redesign table where both exist.
for (const [key, value] of Object.entries(appZh)) if (!Object.hasOwn(zh, key)) zh[key] = value;
for (const table of [serversZh, ollamaZh, toolboxZh]) for (const [key, value] of Object.entries(table)) if (!Object.hasOwn(zh, key)) zh[key] = value;
export function translate(s: string, l: Language) {
  return l === "en"
    ? s
    : l === "yue"
      ? zh[s] || s
      : zh[s]
        ? `${s} · ${zh[s]}`
        : s;
}
