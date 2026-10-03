Turnstile 保護（舊網址導向 + 新站登入/註冊）
============================================
只需要一個檔案（取代上一版同名檔案）：

  functions/_middleware.js

安裝
1. 放進專案 functions/ 資料夾（與 [[path]].js 同層），commit 並 push 到 main。
2. Cloudflare Turnstile 小工具的網域加入：
     coffee1688.pages.dev
     member.ytgp168.com
     www.member.ytgp168.com
3. Pages > 設定 > 變數和密碼：
     TURNSTILE_SITE_KEY = Site key （一般變數）
     TURNSTILE_SECRET   = Secret key（Secret）
   修改後需重新部署。

受保護範圍
- POST /api/member/login、/api/member/send-email-code、/api/member/register、/api/admin/login
  → 後端沒有有效 token 一律回 403。
- 前端：/member、/member/register、/admin 頁面自動注入驗證腳本，送出時才驗證
  （平常不顯示，必要時才跳出勾選框）。

行為
- 兩個金鑰任一沒設定 → 新站保護不啟用（不會把自己鎖在外面）。
- 舊網址 coffee1688.pages.dev：首頁顯示更新通知，其他路徑轉到新網址同路徑。

部署後請依序測試：會員登入、註冊（含寄驗證碼）、/admin 登入。
若出問題，刪掉 TURNSTILE_SECRET 重新部署即可關閉保護。


==================== v23：點數系統 ====================
【升級步驟】
1. 先在 D1 執行一次資料庫升級（全新安裝用最新 schema.sql 則不需要）：
   wrangler d1 execute <資料庫名稱> --remote --file=./migrate_v14.sql
   （本專案 wrangler.toml 的資料庫名稱是 test2）
2. 重新部署整個專案（functions/ 與 public/ 一起上傳）。
3. 登入後台 → 新的「點數系統」分頁，確認規則後按儲存。

【點數功能可個別開關】後台「點數規則」分成三塊，各自獨立：付款回饋（發點）、訂單折抵、點數商城。
只想開其中幾個就只勾那幾個；關閉的功能，對應欄位填什麼都不影響。

【預設規則（後台可改）】
- 訂單標記「已付款」時，依實付金額每 100 元給 1 點（無條件捨去）。
- 1 點折抵 1 元；單筆訂單最多可用點數折抵 50%。
- 訂單取消、刪除、改會員或更正金額時，回饋點數自動扣回／調整；
  訂單取消或過期時，已折抵的點數自動退回。

【會員端】會員頁新增「我的點數」：餘額、點數商城兌換、兌換紀錄、點數明細；
自助下單時可輸入要使用的點數（「最多可用」按鈕可一鍵填入）。

【後台】點數系統分頁：規則設定、兌換單處理（標記完成／拒絕並退點）、
商城商品管理、會員點數列表與手動加減點（必填原因）。
