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
