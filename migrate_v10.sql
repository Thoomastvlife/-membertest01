-- ========================================
-- 升級腳本 v10：新增「儲值平台帳號/密碼」欄位
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v10.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE orders ADD COLUMN platform_account TEXT;
ALTER TABLE orders ADD COLUMN platform_password TEXT;

-- 既有訂單沒有記錄過這兩個欄位，維持 NULL 即可，不需要補值。
-- 注意：這裡儲存的是客人「要儲值的平台」帳號密碼（例如 TikTok 帳密），
-- 目的是讓店家可以直接登入該帳號完成儲值，跟會員自己登入本系統用的
-- members.password_hash 是完全不同的東西，請勿混淆。
