import { useApp } from '../context';
export const modelsZh: Record<string, string> = {
  'Previous page':'上一頁', 'Next page':'下一頁', 'matching tags':'個符合標籤',
  'Cloud-only variants cannot be queued for local use. Choose a local variant.':'雲端專用版本唔可以加入本機下載佇列，請選擇本機版本。',
  interrupted:'已中斷', reconciled:'已核對本機狀態',

  'Cancel catalogue refresh':'取消目錄更新', 'Destination already exists. Choose a new tag.':'目的標籤已存在，請選擇新標籤。',
  'Request returned. Refresh status to verify the result.':'要求已返回，請更新狀態以驗證結果。',

  'Local models':'本機模型', 'Model store':'模型商店', Installed:'已安裝', Chat:'對話', 'Runtime and help':'運行環境同說明', 'Pull queue':'下載佇列',
  'Search models and tags':'搜尋模型同標籤', 'Search installed models':'搜尋已安裝模型', 'All models':'所有模型', 'Installed only':'只限已安裝', 'Running only':'只限運行中',
  'Model family':'模型系列', 'All families':'所有系列', Quantization:'量化', 'All quantizations':'所有量化', Capability:'能力', 'All capabilities':'所有能力',
  'Sort models':'排列模型', Name:'名稱', 'Size ascending':'容量由細至大', 'Size descending':'容量由大至細', 'Queue pull':'加入下載佇列',
  'Inspect model':'查看模型', 'No matching models':'冇符合嘅模型', 'Refresh catalogue':'更新目錄', 'Refresh status':'更新狀態', 'Unknown':'未知',
  'Hardware fit':'硬件適配', 'Fit is unknown because verified hardware and model requirements are unavailable.':'未有經驗證嘅硬件同模型需求，硬件適配未知。',
  'Catalogue completeness':'目錄完整性', Complete:'完整', Incomplete:'未完整', 'Stale snapshot':'舊快照', 'Retrieved':'取得時間', Source:'來源', 'Pages':'頁數',
  'No catalogue snapshot is available. Installed models remain accessible when the local service responds.':'未有目錄快照；本機服務有回應時仍可查看已安裝模型。',
  'No installed inventory has been verified yet.':'未驗證已安裝模型清單。', 'Last successful installed inventory':'上次成功讀取嘅安裝清單',
  'Model details':'模型詳情', 'Exact tag':'完整標籤', 'Size':'容量', 'Parameters':'參數量', 'Capabilities':'能力', 'Digest':'摘要',
  'Model metadata has not been loaded. Select Inspect model for an installed model.':'未載入模型資料，請對已安裝模型選擇查看模型。',
  'Copy model':'複製模型', 'Remove model':'移除模型', 'Destination tag':'目的標籤', 'Confirm removal':'確認移除',
  'Type the exact model tag to confirm removal from the local model store. Other models are not removed.':'輸入完整模型標籤以確認從本機儲存移除，唔會移除其他模型。',
  'Copy preserves the source model. Choose a distinct valid destination tag.':'複製會保留來源模型，請選擇另一個有效目的標籤。',
  'Free model transfers only. This queue does not involve payment.':'只限免費模型傳輸，此佇列唔涉及付款。',
  'Queue is empty':'佇列暫時空白', 'Known download total':'已知下載總量', 'Unknown sizes':'未知容量項目',
  'Additional storage and free destination space are unverified. Download size is not a promise of total installed storage.':'額外儲存需要同目的地可用空間未驗證，下載容量唔代表安裝後總容量。',
  'Pulls contact the official model registry through the local runtime. Review each exact tag before starting.':'下載會經本機運行環境連接官方模型儲存服務，開始前請核對完整標籤。',
  'Start selected pulls':'開始所選下載', 'Cancel pull':'取消下載', 'Retry pull':'重試下載', 'Remove from queue':'移出佇列', 'Refresh operations':'更新操作狀態',
  'No operation has been accepted yet.':'未有操作獲接納。', 'Operation accepted; completion is reported by the service.':'操作已接納，完成狀態由服務回報。',
  'The queue could not be saved locally.':'無法喺本機保存佇列。', 'A queued tag is absent from the current verified inventory. Refresh the catalogue before pulling it.':'佇列標籤唔喺目前已驗證清單，下載前請更新目錄。',
  'Runtime status':'運行環境狀態', 'Installed runtime':'已安裝運行環境', 'Service health':'服務健康狀態', 'Checked':'檢查時間',
  'Install Ollama':'安裝 Ollama', 'Review managed installation':'查看受管理安裝', 'Start runtime':'啟動運行環境', 'Stop owned runtime':'停止受管理運行環境',
  'Installation and startup are separate actions. Existing installations and models must be preserved.':'安裝同啟動係分開操作，必須保留現有安裝同模型。',
  'Managed installation plan':'受管理安裝計劃', 'Architecture':'架構', 'Version':'版本', 'Expected bytes':'預期位元組', 'SHA-256':'SHA-256',
  'Install verified payload':'安裝經驗證檔案', 'Managed installation is unavailable until the native admission checks pass.':'原生認可檢查通過前，受管理安裝無法使用。',
  'No arbitrary download address or shell command is accepted here.':'此處唔接受任意下載地址或 shell 指令。',
  'Refresh status first. If the service is stopped, use Start runtime when available. If installation is missing, review the managed installation plan.':'請先更新狀態；服務停止時可用啟動操作，未安裝時可查看受管理安裝計劃。',
  'Unsupported actions remain disabled until the native service supplies their capability and verification.':'原生服務提供能力同驗證之前，未支援操作保持停用。',
  'Local chat is not available from this service yet. No prompt or attachment is sent.':'此服務尚未提供本機對話，唔會傳送提示或附件。',
  'Registered launch profiles, snapshots and restore are not available from this service yet. No arbitrary program can be launched here.':'此服務尚未提供已登記啟動設定、快照同還原，此處唔會啟動任意程式。',
  'Open runtime help':'開啟運行環境說明', 'Local model bridge unavailable':'本機模型橋接無法使用', 'Local model operation failed':'本機模型操作失敗',
  'The service is not healthy. Open Runtime and help, refresh status and complete the available recovery action.':'服務未健康，請開啟運行環境同說明，更新狀態並完成可用復原操作。',
  'This action is not provided by the native service.':'原生服務未提供此操作。', 'Model operation completed':'模型操作已完成', 'Model operation failed':'模型操作失敗',
  'Running':'運行中', 'Not running':'未運行', 'Not installed':'未安裝', healthy:'健康', stopped:'已停止', unhealthy:'不健康', missing:'未安裝',
  queued:'等候中', running:'進行中', completed:'已完成', failed:'失敗', cancelled:'已取消', cancelling:'取消中', pulling:'下載中',
  'Observed bytes':'已回報位元組', 'Total bytes':'總位元組', 'Retry failed or cancelled operations only.':'只重試失敗或已取消操作。',
};
export function useModelsText() {
  const app = useApp();
  return (text: string) => {
    const zh = modelsZh[text];
    if (!zh) return app.t(text);
    return app.t(app.prefs.language === 'yue' ? zh : app.prefs.language === 'both' ? `${text} · ${zh}` : text);
  };
}
