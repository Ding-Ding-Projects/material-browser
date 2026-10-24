# Action sounds and quiet controls

Short, original musical tones complement visible desktop results. A soft ascending chord acknowledges a completed operation; a lower two-note cue marks a failed operation. These cues use local Web Audio synthesis with no downloaded recordings, external services or network requests.

## Choose your sound preferences

Open **Settings → Notifications** and search for **Action sounds**. Turn the switch off to silence action feedback. **Action sound volume** adjusts the level from 0 to 100 percent in steps of 5; the initial level is 35 percent. Zero is silent. Use **Preview action sound** to hear the completion cue under the current preferences.

The switch and volume use the validated native preference store, with the same reset, history, schedule and transfer mechanisms as other presentation preferences. A failed preference save remains visible. Disabling sounds stops any active or scheduled notes immediately.

## When tones play

Success and failure notifications from completed desktop operations request a cue only after their notification record has been saved. For example, a completed profile action can produce a success tone; a failed native operation can produce a failure tone. Informational notices, page navigation, initial data loading and restored notification history are silent. Rapid results do not stack audio or create a playback queue.

Audio initializes after a pointer or keyboard gesture. If audio is unsupported, blocked or unavailable, the operation and its visible result continue normally. Quiet hours, low stimulation, application narration and explicit screen-reader mode suppress every cue, including preview and failure tones. Preview never bypasses these choices. Sounds always supplement the visible result.

## 廣東話操作指南

開啟 **設定 → 通知**，搜尋 **操作音效**。關閉開關就會停止音效；**操作音效音量** 可設定為百分之零至一百，預設為百分之三十五。零即靜音。按 **試聽操作音效** 可試聽完成提示。

操作完成或失敗並儲存通知後，程式先會播放音效。載入資料、切換頁面及讀取舊通知都唔會發聲。安靜時段、減少刺激、程式朗讀及螢幕閱讀器模式會將所有音效靜音，試聽亦會遵從設定。關閉音效會即時停止播放。即使音訊無法使用，操作結果仍然會以文字顯示。

## Verification boundary

Automated tests cover gesture initialization, silent hydration, overlap suppression, current preference gates, cancellation during preview initialization, unavailable audio, schema validation and settings transfer. These tests use an audio test double; they do not establish subjective listening quality, physical speaker output or native restart acceptance.
