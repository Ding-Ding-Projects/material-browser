# WorldLens desktop design

Material Browser uses WorldLens's Material Design 3 color roles, typography, shapes, elevation, state layers and motion in its existing React and Material Web desktop interface. The reference is pinned to WorldLens commit `aaf1063e1ad7826591fa4dd6f504d086451e645b`. The desktop keeps its own branding and profile-management workflows.

## Appearance and navigation

A compact icon-and-label rail opens Profiles, Super Profiles, Synchronization and Settings. Setup and vault locking remain available. A labelled disclosure replaces the rail when space is limited. Open workspace tabs and the `Ctrl+Shift+F` catalog retain their existing destinations.

The interface uses locally bundled Roboto and Roboto Mono, blue selection colors, pill-shaped actions, 12 px fields, 16 px contained sections and 28 px dialogs. Profile tables and inspectors share the same surface hierarchy. Narrow layouts move the selected record into a full-width detail view with a Back action; wide tables scroll within their own region.

Fresh installations start in dark mode. Saved appearance choices remain authoritative. High contrast takes precedence over custom accents. Language, density, font, text scaling and reduced-motion preferences continue to apply through Settings.

## Actions and sound

Visual changes preserve the native host boundary, per-profile operation reservations, explicit browser-identity consent, revision checks and protected settings persistence. Unsupported engine or guest capabilities remain visible as unavailable. The interface does not seed example profiles.

[Action sounds](action-sounds.md) provide short local completion and failure cues. Settings → Notifications includes an on/off switch, volume and preview. Quiet hours and accessibility preferences can suppress them; sounds never replace visible results.

## Source and verification

The target-owned [design reference](../../../design/desktop/REFERENCE.md), [state inventory](../../../design/desktop/STATES.md) and [implementation handoff](../../../design/desktop/worldlens-handoff.md) document the adaptation. The checked-in design-system provenance records the upstream license and exact source hashes; the synchronization script checks the pinned source rather than silently following a moving branch.

Runtime evidence must identify its source, built bytes, viewport, language, theme and actual interface zoom. Linux Electron captures establish Linux rendered behavior only. They do not establish Windows installer, physical display scaling, guest-environment or speaker-output acceptance. Earlier desktop screenshots retain their original source identity and are historical after this remake.

## 廣東話

桌面介面沿用 WorldLens 嘅 Material Design 3 藍色色系、字款、圓角、陰影同動態規格，保留 Material Browser 自己嘅名稱及設定檔工作流程。側邊導覽列用圖示加文字；空間不足時改用有標籤嘅選單。設定檔表格同詳細資料用一致層次，窄視窗可開啟全寬詳細資料，再按返回。

全新安裝預設用深色模式，已儲存嘅外觀選擇會保留；高對比優先於自訂重點色。字款隨程式附帶，唔需要網絡下載。語言、字體大小、密度同減少動態設定繼續生效。

操作同意、原生主程式驗證、版本檢查及設定儲存機制保持有效。設定 → 通知可關閉操作音效、調整音量及試聽；安靜時段同無障礙設定會按需要靜音。Linux 畫面驗證唔代表已完成 Windows 安裝程式、訪客環境或實體喇叭驗證。
