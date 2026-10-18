# 錯誤碼與錯誤訊息對照表

> 這份文件整理本系統（Cloudflare Pages + D1）所有會出現的錯誤，以及遇到時怎麼排查。
> 前半是「看到什麼 → 原因 → 怎麼辦」的快速排查，後半是從原始碼自動整理出的完整訊息索引。

## 目錄

1. [錯誤是怎麼顯示的](#1-錯誤是怎麼顯示的)
2. [HTTP 狀態碼對照](#2-http-狀態碼對照)
3. [快速排查](#3-快速排查)
4. [資料庫升級腳本對照](#4-資料庫升級腳本對照)
5. [非 HTTP 的特殊代碼](#5-非-http-的特殊代碼)
6. [完整訊息索引](#6-完整訊息索引)
7. [回報問題時請附上這些資訊](#7-回報問題時請附上這些資訊)

## 1. 錯誤是怎麼顯示的

本系統**沒有另外編的錯誤編號**，用的是「HTTP 狀態碼 ＋ 中文訊息」：

- 後端出錯時回傳 JSON：`{"error": "中文訊息"}`，同時帶一個 HTTP 狀態碼。後台與前台畫面會直接把這段中文訊息顯示出來（紅字）。
- 如果回應不是 JSON、或沒有 `error` 欄位（例如 Cloudflare 自己回的錯誤頁），畫面會顯示 **`錯誤: 狀態碼`**，例如 `錯誤: 500`。這種情況沒有具體訊息，要看 Cloudflare 的紀錄（見第 7 節）。
- 沒有被各功能特別處理的例外，會統一變成 **500** 加 `系統錯誤: <原始錯誤訊息>`，例如 `系統錯誤: getBankAccounts is not defined`。看到 `is not defined` 或 `Cannot read properties of undefined` 這類英文，幾乎都是**程式本身的 bug**（漏掉匯入、改壞變數），不是操作問題。

## 2. HTTP 狀態碼對照

| 狀態碼 | 在本系統的意思 | 第一步要做什麼 |
|---|---|---|
| 400 | 送出的內容有問題，或操作當下不允許（必填沒填、格式不對、狀態不符、資料庫還沒升級） | 照畫面上的中文訊息修正；訊息寫「請先執行 migrate_vXX.sql」就是資料庫還沒升級（見第 4 節） |
| 401 | 沒登入、登入過期、帳號或密碼錯誤、驗證碼或金鑰不正確 | 重新登入；日報／直播監聽的 401 是金鑰不一致（見第 3 節） |
| 403 | 已登入但沒有這項權限，或人機驗證（Turnstile）沒通過、會員被封鎖下單 | 員工帳號請管理員開權限；人機驗證請重新整理頁面再試 |
| 404 | 找不到資料（訂單、會員、品項…被刪掉或網址、ID 錯誤），或網址路徑不存在（`Not found`） | 重新整理列表確認資料還在 |
| 405 | 用了不對的請求方法（例如日報 API 必須用 POST） | 改用正確的方法 |
| 409 | 衝突：會員被封鎖下單、直播目前沒有開標中的場次 | 先處理衝突原因（解除封鎖、開啟場次） |
| 410 | 付款連結已失效（超過 `LINK_HARD_EXPIRE_HOURS`，預設 24 小時） | 請店家重新開一張訂單 |
| 413 | 一次送的資料太大（備份還原） | 重新整理頁面後再試 |
| 429 | 嘗試太頻繁：登入連續失敗被鎖定、驗證信寄太多次 | 等訊息寫的時間再試；後台帳號可由管理員手動解鎖 |
| 500 | 伺服器內部錯誤：程式 bug、資料庫錯誤、設定缺漏 | 看訊息：`系統錯誤: …` 把整句貼給開發者；`寄信服務尚未設定完成` 見第 3 節 |
| 502 | 對外服務失敗（寄信的 Resend 回報失敗） | 看訊息後面的原因，例如網域未驗證、金鑰錯誤 |
| 503 | 人機驗證服務（Cloudflare Turnstile）暫時無法使用 | 稍後再試 |

## 3. 快速排查

### 3.1 看到「錯誤: 500」或「系統錯誤: …」

| 畫面訊息 | 可能原因 | 怎麼辦 |
|---|---|---|
| `系統錯誤: xxx is not defined` | 程式漏掉匯入或函式名稱打錯（例如曾經發生過：`getBankAccounts is not defined`，因為 `[[path]].js` 沒有匯入 `_lib/banks.js`） | 程式 bug。把整句訊息貼給開發者；修法通常是補上 `import` |
| `系統錯誤: no such column: xxx` / `no such table: xxx` | 資料庫還沒執行對應的 `migrate_vXX.sql` | 見第 4 節，用 `wrangler d1 execute … --remote --file=./migrate_vXX.sql` 升級 |
| `系統錯誤: D1_ERROR …` | 資料庫查詢失敗（欄位型態、限制式、語法） | 把整句貼給開發者；同時確認剛剛有沒有升級資料庫 |
| 只顯示 `錯誤: 500`（沒有後面的文字） | 回應不是本系統的 JSON，通常是 Cloudflare 本身的錯誤（部署中、Worker 逾時、記憶體超限） | 等部署完成再試；到 Cloudflare Pages → Deployments → 該次部署 → Functions 看即時紀錄 |
| `寄信服務尚未設定完成，請聯絡店家` | 缺少 `RESEND_API_KEY` 或 `EMAIL_FROM` | Cloudflare Pages → Settings → Variables and Secrets 補上，補完要**重新部署** |

### 3.2 每日日報、金鑰（GitHub Actions 排程）

| 訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 401 `網站還沒有讀到 CRON_SECRET…` | Cloudflare **Production** 環境沒有 `CRON_SECRET`，或新增後還沒重新部署 | 在 Production 新增 Secret `CRON_SECRET`，然後 Retry deployment |
| 401 `金鑰不正確（網站上的：長度N/指紋xxxxxx；GitHub 送來的：長度N/指紋xxxxxx）` | 兩邊的 `CRON_SECRET` 值不一樣 | 比對兩組「長度／指紋」；不同的那一邊重新貼上。64 字元金鑰長度應為 64。前後空白與換行會被自動忽略 |
| 400 `沒有收件人：…` | 沒有管理員填信箱，`DAILY_REPORT_TO` 也沒設定 | 後台 → 員工帳號 → 管理員那列「設定信箱」 |
| 400 `你的帳號還沒有設定信箱…`（後台「寄測試日報」） | 目前登入的帳號沒填信箱 | 先替自己的帳號「設定信箱」 |
| 400 `寄信服務還沒設定好：需要 RESEND_API_KEY…` | 缺 Resend 設定 | 補 `RESEND_API_KEY`（Secret）與 `EMAIL_FROM`（或 `EMAIL_FROM_REPORT`） |
| 502 `寄信失敗：403:…` / `寄信全部失敗` | Resend 拒絕：寄件網域沒驗證、金鑰錯誤、額度用完 | 到 Resend 後台看網域狀態與 API Key；訊息後面的英文就是 Resend 回的原因 |
| 405 `請用 POST` | 用瀏覽器直接開網址（GET） | 用 `curl -X POST` 或 GitHub Actions |
| 200 `已經寄過` | 同一天只寄一次（正常） | 要重寄加 `?force=1` |
| Actions 顯示 `Process completed with exit code 1` | 只是「那一步失敗」的通用說法，**不是原因** | 點開「呼叫日報 API」那一步，看最後一行 `{"error":"…"}` |

### 3.3 登入與鎖定

| 訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 401 `帳號或密碼錯誤` | 帳密不對（為了安全，不會說是哪一個錯） | 重新輸入；連續錯誤會被鎖定 |
| 429 `登入失敗次數過多，帳號已暫時鎖定，請 N 分鐘後再試` | 連續失敗達門檻（預設 5 次、鎖 15 分鐘；可用環境變數 `LOGIN_MAX_ATTEMPTS`、`LOGIN_LOCKOUT_MINUTES` 調整） | 等時間到自動解鎖；後台帳號可請管理員在「員工帳號」頁手動解鎖 |
| 401 `請輸入驗證器 App 顯示的 6 位數驗證碼`（回應帶 `need_totp: true`） | 這個帳號有啟用兩步驟驗證 | 輸入驗證器 App 的 6 位數，或備援碼 |
| 401 `驗證碼不正確` | 驗證碼錯、手機時間不準 | 確認手機時間為自動校時；或改用備援碼 |
| 手機弄丟、備援碼也沒了 | 自己無法登入 | 請管理員到「員工帳號」對該帳號按「重設兩步驟驗證」 |
| 400 `資料庫還沒升級，請先執行 migrate_v28.sql…` | 還沒升級登入保護 | 執行 `migrate_v28.sql` |
| 401 `登入已失效（帳號被登出所有裝置，或密碼已重設），請重新登入` | 在別的裝置按了「登出所有裝置」，或管理員重設了你的密碼 | 重新登入；詳見 3.6 |

### 3.4 人機驗證（Cloudflare Turnstile）

| 訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 403 `缺少人機驗證，請重新整理頁面後再試` | 送出時沒有帶驗證結果（頁面太舊、被擋） | 重新整理頁面 |
| 403 `人機驗證未通過，請重新整理頁面後再試` | 驗證失敗或逾時，回應會附 Cloudflare 的 `error-codes` | 重新整理；若一直失敗，確認 Turnstile 小工具的網域有加入目前網址 |
| 503 `人機驗證服務暫時無法使用，請稍後再試` | 連不到 Cloudflare 驗證服務 | 稍後再試 |
| 500 `missing_secret` | 人機驗證端點找不到 `TURNSTILE_SECRET`（`TURNSTILE_SITE_KEY` 與 `TURNSTILE_SECRET` 要兩個都設定才會啟用保護） | 補上 Secret 並重新部署 |

### 3.5 直播留言監聽

| 訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 401 `金鑰不正確`（直播留言接收網址） | 監聽程式送的 `X-Ingest-Key`（環境變數 `INGEST_KEY`）跟網站上的不一致，或網站還沒產生金鑰 | 後台「直播下單」→ 展開接收設定，複製「接收網址」與「金鑰」，填進監聽程式的 `INGEST_URL`、`INGEST_KEY`（用法見 `listener/README.md`） |
| 409 `目前沒有開標中的場次，請先在後台建立並開啟場次` | 沒有開標中的直播場次 | 後台「直播下單」先建立並開啟場次 |

### 3.6 新裝置登入通知與「登出所有裝置」

**運作方式**（v80 起，需要執行 `migrate_v31.sql`）：

- 後台帳號登入成功後，系統會看瀏覽器有沒有帶這個帳號「認得的裝置 cookie」（`admin_device`，HttpOnly、有效 1 年）。**沒有，或這個帳號沒看過 → 視為新裝置**，記錄下來並寄通知信到該帳號的信箱；看過的裝置只更新最後登入時間。
- **換瀏覽器、清除瀏覽器資料、使用無痕視窗，都會被當成新裝置**（做法和多數服務一樣）。
- 密碼錯、沒輸入驗證碼、驗證碼錯都**不算登入成功**，不會記錄裝置也不會寄信；有啟用兩步驟驗證的帳號，要驗證碼也通過才會寄。
- 升級後，每個帳號在**常用的瀏覽器第一次登入時會收到一封**（那時還沒有裝置紀錄），之後就不會再寄。
- 通知信、或登入後的「操作紀錄」（類別「登入／登出／註冊」）都會留下結果：`偵測到新裝置登入：…，已寄通知信到 xx@…`，或註明沒寄的原因。
- 「登出所有裝置」是把帳號的「登入版本號」+1，**所有舊的登入憑證立刻失效**。管理員重設某帳號的密碼時也會順便登出該帳號所有裝置。

| 情況 | 原因 | 怎麼辦 |
|---|---|---|
| 收到「新裝置登入通知」，但**不是你** | 有人拿到你的密碼，或你同事共用帳號 | 按信裡的「立即登出所有裝置」（7 天內有效、只能用一次），然後登入後台改密碼、啟用兩步驟驗證 |
| 登入後**沒收到**通知信 | ① 這個帳號沒設定信箱 ② 這個瀏覽器已經被記住 ③ 寄信服務沒設定或寄信失敗 ④ 信進了垃圾信匣 | 到「操作紀錄」看最新一筆 `偵測到新裝置登入…` 會寫原因；沒信箱請管理員在「員工帳號」頁「設定信箱」；寄信設定見 3.2 的 Resend 項目 |
| 400 `資料庫還沒升級，請先執行 migrate_v31.sql` | 按了「登出所有裝置」，但資料庫還沒升級 | 執行 `wrangler d1 execute <資料庫名稱> --remote --file=./migrate_v31.sql` |
| 帳號安全視窗顯示「資料庫還沒升級（需執行 migrate_v31.sql）」 | 同上 | 同上 |
| 400 `這個連結已經使用過或已失效…` | 信裡的連結只能用一次；或在連結之後已經登出過所有裝置、重設過密碼 | 已經安全了；如果還是擔心，直接登入後台修改密碼 |
| 400 `這個連結無效或已經過期（有效期限 7 天）…` | 連結超過 7 天、被截斷或複製不完整 | 直接登入後台，按右上角 🔐「帳號安全」→「登出所有裝置」 |
| 登入後馬上被登出、顯示「登入已失效」 | 你在另一台按了「登出所有裝置」，或管理員重設了你的密碼 | 重新登入即可 |
| 員工離職、懷疑員工帳號外洩 | — | 管理員到「員工帳號」，那一列按「登出所有裝置」（刪除帳號也會讓他立刻無法使用） |
| 想只登出別台、保留目前這台 | — | 🔐「帳號安全」→「登出其他所有裝置」 |

## 4. 資料庫升級腳本對照

訊息出現「**請先執行 migrate_vXX.sql**」、「**資料庫尚未升級**」，或 `no such column / no such table`，代表資料庫缺少新欄位。執行方式：

```bash
wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_vXX.sql
```

- 每支腳本只需執行**一次**；重複執行會出現 `duplicate column name`（欄位已存在，代表已經升級過，可以忽略）。
- 全新安裝（直接用最新的 `schema.sql` 建立）**不需要**跑任何 migrate。
- 沒執行就先部署：有些功能會自動偵測並略過（例如 v24、v28），需要新欄位的功能會提示先升級；也有功能會直接報 500，所以**建議先升級資料庫再部署**。

| 版本 | 檔案 | 內容 |
|---|---|---|
| v2 | `migrate_v2.sql` | （見檔案內說明） |
| v3 | `migrate_v3.sql` | 新增「訂單完成(結案)」標記 + 客人上傳付款證明 |
| v4 | `migrate_v4.sql` | 後台瀏覽器推播通知（有會員自助下單時通知管理員） |
| v5 | `migrate_v5.sql` | 會員推薦碼 + 隱藏連結自行註冊 |
| v6 | `migrate_v6.sql` | 優惠碼功能 |
| v7 | `migrate_v7.sql` | 優惠碼支援「直接折抵固定金額」 |
| v8 | `migrate_v8.sql` | 修正 coupons.discount_percent 誤帶 NOT NULL 限制 |
| v9 | `migrate_v9.sql` | 新增「儲值平台」欄位 |
| v10 | `migrate_v10.sql` | 新增「儲值平台帳號/密碼」欄位 |
| v11 | `migrate_v11.sql` | 新增「預計獲得幣數」欄位 |
| v12 | `migrate_v12.sql` | 會員新增「電子信箱」欄位 |
| v13 | `migrate_v13.sql` | 信箱驗證碼（自助註冊用） |
| v14 | `migrate_v14.sql` | 點數系統（累積 / 折抵 / 點數商城） |
| v15 | `migrate_v15.sql` | 超商條碼可選超商（7-11 / 全家 / 萊爾富） |
| v16 | `migrate_v16.sql` | 顧客下單時可選「訂單完成寄信通知我」 |
| v17 | `migrate_v17.sql` | 訂單完成通知信可指定「這筆訂單」專用信箱 |
| v18 | `migrate_v18.sql` | 訂單新增「內部備註」欄位 |
| v19 | `migrate_v19.sql` | 直播下單（TikTok 直播留言「A201+1」解析成訂單） |
| v20 | `migrate_v20.sql` | 直播留言自動抓取（監聽程式送進來的留言去重用） |
| v21 | `migrate_v21.sql` | 既有 D1 資料庫升級：新增「後台操作紀錄」所需資料表 |
| v22 | `migrate_v22.sql` | 後台員工權限（只有管理員能新增員工、設定權限） |
| v23 | `migrate_v23.sql` | 訂單明細項目（品名、數量、單價、交貨狀態） |
| v24 | `migrate_v24.sql` | 管理員帳號新增「信箱」欄位（每日營運日報的收件人） |
| v25 | `migrate_v25.sql` | 既有 D1 資料庫升級：操作紀錄加上「屬於哪張訂單」欄位，讓每張訂單可以查看完整的操作歷程 |
| v26 | `migrate_v26.sql` | 會員詳細頁（標籤、備註紀錄、封鎖下單） |
| v27 | `migrate_v27.sql` | 員工可以自選要收哪些推播類型 |
| v28 | `migrate_v28.sql` | 登入保護（連續失敗鎖定 + 管理員兩步驟驗證 TOTP） |
| v29 | `migrate_v29.sql` | 品項「寄送序號」（出貨時一併寄給顧客） |
| v30 | `migrate_v30.sql` | 記錄顧客「同意服務條款／隱私權政策」的時間與版本 |
| v31 | `migrate_v31.sql` | 後台「新裝置登入通知」與「登出所有裝置」（`admins.session_version`、`admin_devices` 資料表） |

## 5. 非 HTTP 的特殊代碼

這些不是 HTTP 狀態碼，而是出現在錯誤訊息或回應欄位裡的代碼：

| 代碼 | 出現在 | 意思 |
|---|---|---|
| `EMAIL_NOT_CONFIGURED` | 寄信函式丟出的例外 | 缺少 `RESEND_API_KEY` 或寄件人（`EMAIL_FROM` 系列）。畫面通常轉成「寄信服務尚未設定完成」 |
| `EMAIL_SEND_FAILED:<狀態碼>:<原因>` | 寄信函式丟出的例外 | Resend 回報失敗。例如 `EMAIL_SEND_FAILED:403:…domain is not verified` = 寄件網域未驗證；`401` = API Key 錯誤；`429` = 超過額度或速率 |
| `need_totp: true` | 後台登入回應欄位 | 這個帳號需要輸入兩步驟驗證碼，前端會跳出驗證碼欄位 |
| `code: "member_blocked"` | 建立訂單的 409／403 回應欄位 | 會員被標記「封鎖下單」，前端據此顯示專屬提示 |
| `error-codes` | 人機驗證失敗的回應 | Cloudflare Turnstile 回傳的原因代碼（例如 `invalid-input-response`、`timeout-or-duplicate`） |
| `missing_secret` / `missing_token` / `bad_json` / `method_not_allowed` | 人機驗證中介層 | 設定缺漏、前端沒帶 token、請求格式錯、請求方法錯 |
| `no such column` / `no such table` | D1（SQLite）錯誤訊息 | 資料庫還沒升級，見第 4 節 |
| `duplicate column name` | 執行 migrate 時 | 這支腳本已經執行過，可以忽略 |

## 6. 完整訊息索引

以下由原始碼（`functions/` 底下所有 `json({ error: … }, 狀態碼)`）自動整理。訊息中的 `…` 代表程式在那個位置會帶入變數（例如分鐘數、剩餘次數、品名）。
同一則訊息若在同一功能出現多次只列一次。部分訊息是由檢查函式組出來的（依欄位而異），沒有列在表中。

### 通用（所有 API 共用）

| HTTP | 訊息 | 說明 |
|---|---|---|
| 401 | 未登入或登入已過期 | 所有需要登入的 API |
| 401 | 此帳號已被移除，請重新登入 | 後台權限檢查（帳號已被刪除，會順便清掉登入 cookie） |
| 401 | 登入已失效（帳號被登出所有裝置，或密碼已重設），請重新登入 | 後台每個請求都會比對「登入版本號」；在別的裝置按了「登出所有裝置」、管理員替你重設了密碼，舊的登入就會收到這則（並清掉 cookie），重新登入即可 |
| 403 | 只有管理員可以使用這個功能 | 員工帳號呼叫了「僅限管理員」的功能（新增／刪除員工、設定權限、重設密碼、備份還原等），以及沒有列入權限清單的後台路徑（預設拒絕） |
| 403 | 你沒有這項功能的權限，請聯絡管理員 | 員工帳號沒有被勾選這項功能（管理員到「員工帳號」→「設定權限」開啟） |
| 401 | 請先登入會員，才能查看費率 | `/api/rates` |
| 404 | Not found | 網址路徑不存在，或請求方法不對 |
| 500 | 系統錯誤: … | 最外層的 try/catch：任何沒被各功能處理的例外都會變成這個，`…` 是原始錯誤訊息 |

### 登入與帳號安全

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 已經啟用兩步驟驗證了 | `handleTotpConfirm` |
| 400 | 已經啟用兩步驟驗證，請先關閉後再重新設定 | `handleTotpSetup` |
| 400 | 本來就沒有啟用兩步驟驗證 | `handleTotpDisable` |
| 400 | 管理員帳號已存在，請直接登入 | `handleSetupAdmin` |
| 400 | 請先啟用兩步驟驗證 | `handleTotpRegenerateBackupCodes` |
| 400 | 請先產生 QR code（重新整理這個畫面再試一次） | `handleTotpConfirm` |
| 400 | 請提供帳號，密碼至少 6 碼 | `handleSetupAdmin` |
| 400 | 請輸入帳號與密碼 | `handleMemberLogin` |
| 400 | 資料庫還沒升級，請先執行 migrate_v28.sql 再使用兩步驟驗證 | `getSelf` |
| 400 | 資料庫還沒升級，請先執行 migrate_v31.sql | `handleLogoutAllSelf` |
| 400 | 這個連結已經使用過或已失效（可能已經登出過所有裝置，或密碼已重設）。如果還是擔心，請直接登入後台修改密碼 | `handleRevokeByLink` |
| 400 | 這個連結無效或已經過期（有效期限 7 天）。請直接登入後台，按右上角 🔐「帳號安全」→「登出所有裝置」 | `handleRevokeByLink` |
| 400 | 驗證碼不正確，請確認手機時間正確，或重新整理 QR code | `handleTotpConfirm` |
| 401 | 密碼不正確 | `handleTotpDisable` |
| 401 | 帳號或密碼錯誤 | `handleLogin` |
| 401 | 帳號或密碼錯誤，或此帳號尚未開通登入功能，請洽店家 | `handleMemberLogin` |
| 401 | 會員不存在，請重新登入 | `handleMemberMe` |
| 401 | 請輸入驗證器 App 顯示的 6 位數驗證碼 | `handleLogin` |
| 401 | 驗證碼不正確 | `handleLogin` |
| 404 | …不存在 | `handleUnlockLogin` |
| 404 | 帳號不存在 | `handleTotpSetup` |
| 404 | 找不到這個帳號 | `handleLogoutAllStaff` |
| 429 | 登入失敗次數過多，帳號已暫時鎖定，請 … 分鐘後再試 | `handleLogin` |
| 429 | 登入失敗次數過多，請 … 分鐘後再試 | `handleMemberLogin` |

### 後台：員工帳號與每日日報

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 你的帳號還沒有設定信箱：請先在「帳號列表」按自己那一列的「設定信箱」，再寄測試日報 | `handleDailyReportTest` |
| 400 | 信箱格式不正確 | `handleSetStaffEmail` |
| 400 | 寄信服務還沒設定好：需要 RESEND_API_KEY（secret）和 EMAIL_FROM（或 EMAIL_FROM_REPORT） | `handleDailyReportTest` |
| 400 | 密碼至少需要 6 碼 | `handleAddStaff` |
| 400 | 權限格式錯誤 | `handleSetStaffPermissions` |
| 400 | 此帳號已被使用，請換一個 | `handleAddStaff` |
| 400 | 沒有收件人：請到後台「員工帳號」替管理員帳號設定信箱（或設定 DAILY_REPORT_TO 環境變數） | `handleDailyReportCron` |
| 400 | 無法刪除目前登入中的自己帳號，請改用其他帳號登入後再刪除 | `handleDeleteStaff` |
| 400 | 管理員帳號不能刪除 | `handleDeleteStaff` |
| 400 | 管理員帳號擁有全部權限，不需要也不能設定 | `handleSetStaffPermissions` |
| 400 | 至少要保留一組管理員帳號，無法全部刪除 | `handleDeleteStaff` |
| 400 | 請輸入帳號 | `handleAddStaff` |
| 400 | 資料庫尚未升級，請先執行 migrate_v22.sql 再新增員工 | `handleAddStaff` |
| 400 | 資料庫尚未升級，請先執行 migrate_v24.sql | `handleSetStaffEmail` |
| 401 | 網站還沒有讀到 CRON_SECRET：請確認 Cloudflare Pages 的 Production 已新增這個 Secret，並且新增後重新部署過 | `handleDailyReportCron` |
| 401 | 金鑰不正確（網站上的：…；GitHub 送來的：…）。兩邊要一模一樣 | `handleDailyReportCron` |
| 404 | 找不到這個帳號 | `handleSetStaffPermissions` |
| 405 | 請用 POST | `handleDailyReportCron` |
| 502 | 寄信全部失敗 | `handleDailyReportCron` |
| 502 | 寄信失敗：… | `handleDailyReportTest` |

### 後台：訂單與品項

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 付款方式不正確 | `handleCreateOrder` |
| 400 | 儲值平台不正確 | `handleCreateOrder` |
| 400 | 只有已完成付款的訂單才能標記為訂單完成 | `handleCompleteOrder` |
| 400 | 品名不能為空 | `handleAddOrderItem` |
| 400 | 品項合計必須大於 0（折扣加總後不能是 0 或負數） | `handleCreateOrder` |
| 400 | 單價不正確 | `handleAddOrderItem` |
| 400 | 已取消的訂單無法更正 | `handleCorrectOrder` |
| 400 | 找不到指定會員 | `handleCreateOrder` |
| 400 | 會員 ID 錯誤 | `handleMonthlyMemberOrders` |
| 400 | 月份格式錯誤 | `handleMonthlyMemberOrders` |
| 400 | 此訂單付款方式不需要上傳條碼 | `handleUploadBarcode` |
| 400 | 此訂單已結案，請先取消結案才能更正 | `handleCorrectOrder` |
| 400 | 沒有要更正的內容 | `handleCorrectOrder` |
| 400 | 請上傳有效的圖片 | `handleUploadBarcode` |
| 400 | 請至少填寫一個品項，或改用手動輸入金額 | `handleCreateOrder` |
| 400 | 超商條碼單筆上限 $…，超過請分筆訂單 | `handleCreateOrder` |
| 400 | 超商條碼單筆上限 $…，超過請分筆訂單或改用其他付款方式 | `handleCorrectOrder` |
| 400 | 超商選擇不正確 | `handleCreateOrder` |
| 400 | 金額不正確 | `handleCouponPreview` |
| 404 | 找不到品項 | `handleUpdateOrderItem` |
| 404 | 找不到訂單 | `handleOrderHistory` |
| 409 | 會員「…」已被封鎖下單（原因：…） | `handleCreateOrder` |

### 後台：會員管理

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | TikTok 帳號格式不正確（只能英文、數字、底線、句點） | `handleAddMember` |
| 400 | 備註最多…字 | `handleMemberAddNote` |
| 400 | 姓名不可為空白 | `handleUpdateMember` |
| 400 | 密碼至少需要 6 碼 | `handleAddMember` |
| 400 | 標籤格式錯誤 | `handleMemberSetTags` |
| 400 | 此 TikTok 帳號已綁定其他會員 | `handleAddMember` |
| 400 | 此帳號已被使用，請換一個 | `handleAddMember` |
| 400 | 請輸入備註內容 | `handleMemberAddNote` |
| 400 | 請輸入姓名 | `handleAddMember` |
| 400 | 電子信箱格式不正確 | `handleAddMember` |
| 404 | 找不到此會員 | `handleUpdateMember` |
| 404 | 找不到這則備註 | `handleMemberDeleteNote` |
| 500 | 建立會員失敗，請再試一次 | `handleAddMember` |

### 後台：平台、銀行、費率、優惠碼、公告

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 使用次數上限不正確 | `handleCreateCoupon` |
| 400 | 優惠碼不可為空白 | `handleUpdateCoupon` |
| 400 | 儲存失敗 | `handleAdminSaveBanks` |
| 400 | 內建平台不能刪除，可以改成「不開放」 | `handleAdminDeletePlatform` |
| 400 | 公告內容不能空白 | `handleSaveAnnouncement` |
| 400 | 到期時間格式不正確 | `handleCreateCoupon` |
| 400 | 已有 … 筆訂單使用「…」，不能刪除（刪除後舊訂單會看不到平台名稱）。請改成「不開放」。 | `handleAdminDeletePlatform` |
| 400 | 已經有同名的平台 | `handleAdminAddPlatform` |
| 400 | 平台最多 30 個 | `handleAdminAddPlatform` |
| 400 | 找不到這組費率（該平台可能沒有開啟「獨立費率」） | `handleSaveRates` |
| 400 | 折扣百分比需介於 0~100 之間 | `handleCreateCoupon` |
| 400 | 折抵金額需大於 0 | `handleCreateCoupon` |
| 400 | 最低訂單金額不正確 | `handleCreateCoupon` |
| 400 | 最高優惠金額不正確 | `handleCreateCoupon` |
| 400 | 此優惠碼已存在，請換一個代碼 | `handleCreateCoupon` |
| 400 | 每筆費率需包含 min（數字）與 rate（數字） | `handleSaveRates` |
| 400 | 沒有要更新的內容 | `handleUpdateCoupon` |
| 400 | 請至少上傳一張公告圖片 | `handleSaveAnnouncement` |
| 400 | 請輸入優惠碼 | `handleCreateCoupon` |
| 400 | 請輸入平台名稱 | `handleAdminAddPlatform` |
| 400 | 費率格式錯誤，需為陣列 | `handleSaveRates` |
| 404 | 找不到此優惠碼 | `handleUpdateCoupon` |
| 404 | 找不到此平台 | `handleAdminUpdatePlatform` |

### 後台：點數與點數商城

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 單次調整點數過大 | `handleAdminPointsAdjust` |
| 400 | 找不到此兌換單，或已經處理過了 | `handleAdminProcessRedemption` |
| 400 | 沒有要更新的內容 | `handleAdminUpdatePointItem` |
| 400 | 缺少會員 | `handleAdminPointsLedger` |
| 400 | 該會員點數不足，無法扣除這麼多 | `handleAdminPointsAdjust` |
| 400 | 請填寫調整原因 | `handleAdminPointsAdjust` |
| 400 | 請輸入要加或扣的點數（不可為 0） | `handleAdminPointsAdjust` |
| 400 | 請選擇會員 | `handleAdminPointsAdjust` |
| 404 | 找不到此商品 | `handleAdminUpdatePointItem` |
| 404 | 找不到此會員 | `handleAdminPointsAdjust` |

### 後台：推播通知

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 缺少 endpoint | `handlePushUnsubscribe` |
| 400 | 訂閱資料不正確 | `handlePushSubscribe` |
| 400 | 請先執行 migrate_v27.sql（資料庫升級）才能儲存 | `handlePushPrefsSave` |

### 後台：直播下單

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 一次最多…則，請分批送 | `handleLiveIngest` |
| 400 | 一次貼上的內容太多，請分批 | `handleLiveAddComments` |
| 400 | 只有「候補」的留言可以改為正式 | `handleLivePromoteComment` |
| 400 | 只有「未綁定」的留言可以改成非會員 | `handleLiveGuestComment` |
| 400 | 場次名稱不可為空白 | `handleLiveUpdateRound` |
| 400 | 已有留言使用此代號，不能修改代號；請新增另一個商品 | `handleLiveUpdateItem` |
| 400 | 已有留言使用此商品，不能刪除；可以改成「停用」 | `handleLiveDeleteItem` |
| 400 | 找不到指定會員 | `handleLiveBindComment` |
| 400 | 格式錯誤：需要 comments 陣列 | `handleLiveIngest` |
| 400 | 此 TikTok 帳號已綁定其他會員 | `handleLiveBindComment` |
| 400 | 此場次已有相同的商品代號 | `handleLiveAddItem` |
| 400 | 此場次已結標，請先重新開啟 | `handleLiveAddComments` |
| 400 | 此會員已綁定另一個 TikTok 帳號（@…），請先到會員管理修改 | `handleLiveBindComment` |
| 400 | 此會員已被封鎖下單，不能改為正式 | `handleLivePromoteComment` |
| 400 | 此留言已建立訂單 | `handleLiveBindComment` |
| 400 | 此留言已建立訂單，請到訂單列表處理 | `handleLiveDeleteComment` |
| 400 | 沒有可以建立訂單的留言 | `handleLiveCreateOrders` |
| 400 | 狀態不正確 | `handleLiveUpdateRound` |
| 400 | 請貼上留言內容 | `handleLiveAddComments` |
| 400 | 請輸入場次名稱 | `handleLiveCreateRound` |
| 401 | 金鑰不正確 | `handleLiveIngest` |
| 404 | 找不到此商品 | `handleLiveUpdateItem` |
| 404 | 找不到此場次 | `handleLiveUpdateRound` |
| 404 | 找不到此留言 | `handleLiveBindComment` |
| 409 | 目前沒有開標中的場次，請先在後台建立並開啟場次 | `handleLiveIngest` |

### 後台：資料備份與還原

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 「…」不允許清空 | `handleBackupClear` |
| 400 | 一次最多還原…筆 | `handleBackupRestore` |
| 400 | 備份檔的欄位「…」在目前的資料表（…）裡不存在，可能是來自較新的版本，請先升級資料庫 | `handleBackupRestore` |
| 400 | 有資料列的欄位數量跟 columns 不一致 | `handleBackupRestore` |
| 400 | 欄位數量不正確 | `handleBackupRestore` |
| 400 | 欄位重複 | `handleBackupRestore` |
| 400 | 沒有這張資料表，或這張資料表不提供備份 | `handleBackupRows` |
| 400 | 資料列裡有不支援的值（只接受文字、數字、空值） | `handleBackupRestore` |
| 400 | 資料格式不正確 | `handleBackupRestore` |
| 400 | 資料表不存在或不提供還原：… | `handleBackupRestore` |
| 400 | 資料表不存在：… | `handleBackupClear` |
| 413 | 這一批資料太大，請重新整理頁面後再試 | `handleBackupRestore` |
| 500 | 寫入「…」失敗：… | `handleBackupRestore` |

### 客人付款頁

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | 付款方式不正確 | `handleSelectMethod` |
| 400 | 已選擇過付款方式，無法變更 | `handleSelectMethod` |
| 400 | 此付款方式不需要上傳付款證明 | `handleUploadProof` |
| 400 | 此付款方式目前未開放，請選擇其他付款方式，或聯繫客服 | `handleSelectMethod` |
| 400 | 此訂單已取消 | `handleUploadProof` |
| 400 | 此訂單無法選擇付款方式 | `handleSelectMethod` |
| 400 | 此超商目前未開放，請選擇其他超商或付款方式 | `handleSelectMethod` |
| 400 | 此連結已過期 | `handleSelectMethod` |
| 400 | 請上傳截圖或填寫帳號末幾碼 | `handleUploadProof` |
| 400 | 請先選擇超商（7-11、全家或萊爾富） | `handleSelectMethod` |
| 400 | 金額超過 $…，無法使用超商條碼，請分筆訂單 | `handleSelectMethod` |
| 404 | 找不到此訂單 | `handleSelectMethod` |
| 404 | 找不到此訂單，連結可能有誤 | `handleGetOrderPublic` |
| 410 | 此付款連結已失效，請洽店家重新開立 | `handleGetOrderPublic` |

### 會員前台（註冊、資料、下單、兌換）

| HTTP | 訊息 | 出處（函式） |
|---|---|---|
| 400 | TikTok 帳號格式不正確（只能英文、數字、底線、句點） | `handleMemberBindTiktok` |
| 400 | 你已綁定 @…，如需更換請聯絡店家 | `handleMemberBindTiktok` |
| 400 | 你已綁定 TikTok 帳號，如需更換請聯絡店家 | `handleMemberBindTiktok` |
| 400 | 密碼至少需要 6 碼 | `handleMemberRegister` |
| 400 | 推薦碼不正確，請確認後再試 | `handleSendEmailCode` |
| 400 | 此 TikTok 帳號已被其他會員綁定，如有疑問請聯絡店家 | `handleMemberBindTiktok` |
| 400 | 此商品已下架 | `handleMemberRedeem` |
| 400 | 此商品已兌換完畢 | `handleMemberRedeem` |
| 400 | 此帳號已被使用，請換一個 | `handleMemberRegister` |
| 400 | 此訂單最多可使用 … 點（折抵上限 …%） | `handleMemberCreateOrder` |
| 400 | 沒有任何變更 | `handleMemberUpdateProfile` |
| 400 | 目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等） | `handleSendEmailCode` |
| 400 | 目前僅接受常見信箱（Gmail、Outlook、Hotmail、Yahoo、iCloud 等），請改用這類信箱註冊 | `handleMemberRegister` |
| 400 | 目前未啟用信箱驗證 | `handleSendEmailCode` |
| 400 | 目前未開放點數兌換 | `handleMemberRedeem` |
| 400 | 目前未開放點數折抵 | `handleMemberCreateOrder` |
| 400 | 訂單金額不可低於 … 元 | `handleMemberCreateOrder` |
| 400 | 請先填寫推薦碼 | `handleSendEmailCode` |
| 400 | 請先按「寄送驗證碼」取得驗證碼 | `handleMemberRegister` |
| 400 | 請填寫要接收通知的電子信箱 | `handleMemberCreateOrder` |
| 400 | 請輸入 6 位數的信箱驗證碼 | `handleMemberRegister` |
| 400 | 請輸入 TikTok 帳號 | `handleMemberBindTiktok` |
| 400 | 請輸入姓名 | `handleMemberRegister` |
| 400 | 請輸入密碼 | `handleMemberCreateOrder` |
| 400 | 請輸入帳號 | `handleMemberRegister` |
| 400 | 請輸入帳號/ID | `handleMemberCreateOrder` |
| 400 | 請輸入手機號碼 | `handleMemberRegister` |
| 400 | 請輸入推薦碼 | `handleMemberRegister` |
| 400 | 請輸入正確的台灣手機號碼（09 開頭共 10 碼） | `handleMemberRegister` |
| 400 | 請輸入正確的電子信箱格式 | `handleSendEmailCode` |
| 400 | 請輸入電子信箱 | `handleMemberRegister` |
| 400 | 請選擇要儲值的平台 | `handleMemberCreateOrder` |
| 400 | 請選擇要兌換的商品 | `handleMemberRedeem` |
| 400 | 這已經是你目前使用的信箱 | `handleMemberProfileSendCode` |
| 400 | 通知信箱格式不正確 | `handleMemberCreateOrder` |
| 400 | 金額不正確 | `handleMemberCreateOrder` |
| 400 | 錯誤次數過多，請重新寄送驗證碼 | `handleMemberRegister` |
| 400 | 驗證碼不正確（還可以再試 … 次） | `handleMemberRegister` |
| 400 | 驗證碼已過期，請重新寄送 | `handleMemberRegister` |
| 400 | 驗證碼錯誤次數過多，請重新寄送驗證碼 | `handleMemberRegister` |
| 400 | 點數不足（目前餘額 … 點） | `handleMemberCreateOrder` |
| 400 | 點數不足（需要 … 點，目前 … 點） | `handleMemberRedeem` |
| 400 | 點數不足，請重新整理後再試 | `handleMemberCreateOrder` |
| 401 | 會員不存在，請重新登入 | `handleMemberProfileSendCode` |
| 403 | 您的帳號目前無法下單，如有疑問請聯絡客服 | `handleMemberCreateOrder` |
| 404 | 會員不存在，請重新登入 | `handleMemberCreateOrder` |
| 429 | 寄送次數過多，請稍後再試 | `issueEmailCode` |
| 429 | 請稍候 … 秒後再重新寄送 | `issueEmailCode` |
| 429 | 這個信箱寄送次數過多，請 1 小時後再試 | `issueEmailCode` |
| 500 | 寄信服務尚未設定完成，請聯絡店家 | `issueEmailCode` |
| 500 | 註冊失敗，請再試一次 | `handleMemberRegister` |
| 502 | 驗證信寄送失敗，請稍後再試或聯絡店家 | `issueEmailCode` |

## 7. 回報問題時請附上這些資訊

要請人幫忙看錯誤時，請盡量提供：

1. **完整的錯誤訊息**（整句複製，含英文，不要只說「壞了」）。
2. **在哪個畫面、按了哪個按鈕**，以及大約幾點（台灣時間）。
3. 如果是 GitHub Actions：打開失敗的那一次 → 點開失敗的步驟 → 複製最後幾行。
4. 如果只有 `錯誤: 500`：到 Cloudflare → Workers & Pages → 你的專案 → Deployments → 最新部署 → **Functions** 的即時日誌（Real-time Logs），重現一次，複製紅色的那幾行。
5. 最近有沒有**部署新版本**或**執行資料庫升級**（migrate）。

---

### 同意條款相關（v74 新增）

| 看到的訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 請先閱讀並同意服務條款及隱私權政策 | 註冊時沒有勾選同意（伺服器端也會檢查） | 勾選註冊頁的同意框後再送出 |
| 請先勾選同意服務條款及隱私權政策（若沒看到勾選框，請重新整理頁面） | 顧客在付款頁選付款方式時沒有勾同意；或頁面是舊版快取，沒有勾選框 | 請顧客勾選；舊頁面請重新整理 |
| 後台品項面板顯示「ℹ️ 沒有顧客同意紀錄」 | 舊訂單、訂單還沒選付款方式，或還沒執行 `migrate_v30.sql` | 舊訂單屬正常；新訂單都沒有紀錄請確認有執行 migrate_v30.sql |

> 沒執行 `migrate_v30.sql` 時，註冊、下單、選付款方式都會照常運作，只是不會留下同意時間與條款版本（Worker 紀錄會出現 `recordConsent failed`）。

### 會員等級相關（v79 新增）

| 看到的訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 此優惠碼為「○○」以上會員專屬，累積儲值達 $○ 即可使用 | 會員的累積儲值還沒到該等級，使用了等級專屬優惠碼 | 正常提示；店家要幫客人用的話，請在後台建單時輸入優惠碼（後台不受限制） |
| 此優惠碼為會員等級專屬，請先登入會員 | 沒登入會員就試算專屬優惠碼 | 請登入會員後再試 |
| 找不到優惠碼：○○（請先到「優惠碼」分頁建立） | 後台儲存等級時，專屬優惠碼欄位填了不存在的碼（多半是打錯字） | 先到「優惠碼」分頁建立，或改正拼字 |
| 優惠碼「○○」重複了（同一組優惠碼只能屬於一個等級） | 同一組優惠碼填進兩個等級 | 一組優惠碼只填在一個等級 |
| ○○和○○的門檻金額相同／門檻必須是 1 以上的整數／點數倍率必須在 1.0～10 倍之間／等級名稱重複 | 後台儲存等級時欄位不符規則 | 依訊息修正後重新儲存 |

*本文件的第 6 節由原始碼自動整理；新增或修改錯誤訊息後，記得同步更新第 3、4、5 節的排查說明。*
