# Storage administration and setup

The optional storage service keeps encrypted chunks and revisions. Its administration console never accepts a vault password or decrypts stored content. Counts and capacity come from the service API. It cannot display decrypted profile names, preview profile contents, or prove another machine can restore a profile.

## Pair a browser

Open the host's verified LAN address. Read the HTTP warning, acknowledge the network limitation, and enter the one-use administration pairing code chosen on the host. The code is sent only to the same origin and is cleared after submission. A successful pairing creates an eight-hour HttpOnly, SameSite Strict session cookie. The page retains the CSRF value only in memory and recovers it through the authenticated session endpoint after reload. Sign out revokes the session.

HTTP traffic is not confidential or server-authenticated. Another device on the network may intercept administration traffic or modify the page. Client-side encryption of stored content does not protect the administration session or prevent page tampering. Use a trusted isolated LAN. Do not enter a vault password into this console. HTTPS deployment is not supplied by this version.

## Inspect capacity and sessions

Overview reads actual used bytes, quota, chunk count, revision count and maximum chunk size. Refresh reads the service again. If a refresh fails, prior values are explicitly stale. A healthy HTTP response proves only current reachability, not backup integrity, restoration, or deployment completeness.

Sessions lists actual administration sessions. Revoking a session requires an explicit confirmation. Revoking the current session returns to pairing. Expired or restarted-service sessions require a newly generated host pairing code. No browser fingerprint, geolocation, or invented device label is shown.

## Run the portable setup companion

The Windows setup companion checks Docker Desktop and Compose, accepts a host port and storage directory, and collects the one-use pairing code in a protected field. The code goes over the child process's standard input, never command arguments or environment variables. The companion invokes the bundled supported host script, pulls the published image, starts the tracked Compose service and reports actual health and LAN-address results. Existing data is preserved. Changing an existing data location is refused by the host script rather than silently migrating it.

Cancellation stops the owned launcher but does not remove containers, images, configuration or data. An already-started container may remain running; the result says so. Closing during setup requires the explicit cancel action first. The companion does not approve UAC or change host power, sign-in, firewall or security settings. Missing runtime is reported honestly.

Build from the repository root with `build.bat -Component HostingWizard`; packaging is routed through `build-installer.bat -Component HostingWizard`. The `apps/hosting-wizard` package uses a single portable executable target. Its source validation and resource staging are not native installation proof.

## Local preferences and guidance

Language, theme, density, reduced-motion preference and guide progress remain in this browser's local storage. Clearing browser storage resets those preferences. No pairing code, cookie, CSRF value or decrypted vault material is stored there. Guide checkboxes record the visitor's own progress and do not claim commands executed.

## Verification limits

`build.bat -Component StorageWeb` builds the dashboard without claiming a container build. `Storage` and `HostingWizard` build that same pinned local Material Web bundle before their own production step. The setup companion also bundles registered Material Web controls; it never loads scripts or fonts from a CDN. The renderer consumes only allowlisted structured progress states, not raw child output. Oversized output lines are discarded in full.

On resume the companion first checks runtime readiness and reads only the bounded, non-secret host settings file. Existing host port and storage-directory choices replace stale wizard preferences. Protected pairing configuration is never read into the renderer. Stored step progress never skips the readiness check and never restores a pairing code.

The focused service suite passed six cases, including the restrictive script policy plus separate worker allowance. Removing that worker allowance made the focused policy test fail; restoration passed. The root `HostingWizard` build completed source bundling and resource staging.

At source `815045eb1394addce3e96c5c8c857f82078c388d`, `build-installer.bat -Component HostingWizard` produced a 100,321,184-byte portable executable with SHA-256 `6fc54a8137bdb14fe469944a256cc27011a9ccc8e383defc3e9d6158d492b1a5`. Native Authenticode inspection reported `NotSigned`. The actual portable executable launched on an isolated hidden desktop. Full process-ancestry and exact single-page checks preceded renderer interaction. The unavailable Docker/Compose result and blocked Next action were observed on the actual host. A fresh process using the same isolated profile restored bilingual/light preferences and required a new runtime check. Both owned launch processes and hidden desktops were verified absent after closing.

The 720 × 600 CSS viewport at 1.5 scale had no horizontal document overflow. Genuine captures were inspected, but formal image promotion remains pending because a contemporaneous build-timing receipt was not collected. This narrow observation is not the complete layout matrix. The local Docker daemon was unavailable, so successful configuration, Back/Next after readiness, invalid configuration, service start, cancellation and LAN deployment remain unverified. No readiness result was mocked to reach those later states. Native pointer and keyboard interaction were not established by DOM-action checks.

The current preference search supports plain text and an isolated regular-expression workbench with pattern, flags, escaping and whole-query anchoring. Evaluation is bounded by a worker timeout. This is not a claim that the complete universal visual expression-builder inventory is implemented. Other universal features not represented by this bounded storage interface remain explicit product follow-up work, not silently accepted exceptions.

The implementation owner must record API integration, failed pairing, expired session, revoke, logout, stale data, cancellation, persistence and narrow-layout evidence against the actual built source. Source inspection does not establish native setup success, LAN reachability, release availability or full required-feature compliance. The complete screenshot matrix remains pending until inspected captures are recorded.

## 廣東話操作摘要

儲存服務只保存加密資料塊同版本，管理畫面唔會要求保管庫密碼，亦唔會解密內容。開啟主機已驗證嘅區域網絡網址，先閱讀 HTTP 風險，再輸入主機設定嘅一次性管理配對碼。HTTP 無法保障管理流量私隱，網絡上其他裝置可能攔截工作階段或修改網頁；加密儲存內容唔代表管理連線安全。

總覽顯示服務實際回傳嘅容量同數量。更新失敗時，舊數據會清楚標示。工作階段頁面可確認後撤銷存取權；撤銷目前工作階段就會返回配對畫面。設定精靈會實際檢查 Docker 同 Compose，透過標準輸入傳送受保護配對碼，再啟動服務同驗證健康狀態。取消唔會刪除既有資料，已啟動嘅容器可能繼續運作。操作指引嘅進度只係使用者自行記錄，唔代表任何指令已經執行。
