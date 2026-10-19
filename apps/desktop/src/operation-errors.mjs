const explanations = {
  IDENTITY_UNAVAILABLE: [
    'Stable browser identity is unavailable in this engine. No browser was launched.',
    '呢個引擎未支援穩定瀏覽器識別資料，瀏覽器未有啟動。',
  ],
  ENGINE_UNAVAILABLE: [
    'No verified managed engine is installed for this profile. A supported engine bundle is required before launch.',
    '呢個設定檔未有已驗證嘅受管理引擎。啟動前需要支援嘅引擎套件。',
  ],
  AUTOMATION_UNAVAILABLE: [
    'The installed engine does not support the selected automation mode. Review this profile’s automation setting.',
    '已安裝嘅引擎未支援所選自動化模式，請檢查呢個設定檔嘅自動化設定。',
  ],
  PROFILE_ACTIVE: ['This profile already has an active browser process.', '呢個設定檔已經有運行中嘅瀏覽器程序。'],
  PROFILE_NOT_FOUND: ['This profile is no longer available. Select a current profile and try again.', '呢個設定檔已經唔存在，請選擇現有設定檔再試。'],
  VAULT_LOCKED: ['Unlock the vault before using this action.', '請先解鎖保管庫再使用呢個操作。'],
  BACKEND_UNAVAILABLE: ['The native host is unavailable. Reconnect before trying again.', '原生主程式未能連接，請重新連接後再試。'],
};
const fallback = ['The action could not be completed. Try again after checking the profile and native host.', '未能完成操作，請檢查設定檔同原生主程式後再試。'];

// Electron wraps rejected IPC errors. Only a recognized terminal code may select
// shipped copy; reflected exception text never enters notifications or narration.
export function operationFailure(error) {
  const message = error instanceof Error ? error.message : '';
  const code = message.match(/^(?:Error invoking remote method 'material:request': (?:Error: )?)?([A-Z][A-Z0-9_]{2,63})$/)?.[1];
  return code && Object.hasOwn(explanations, code) ? explanations[code] : fallback;
}
