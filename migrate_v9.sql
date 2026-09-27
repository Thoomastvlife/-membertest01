-- ========================================
-- 升級腳本 v9：新增「儲值平台」欄位
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v9.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE orders ADD COLUMN platform TEXT;

-- 既有訂單沒有記錄過儲值平台，platform 欄位維持 NULL（畫面上會顯示「未指定」）即可，
-- 不需要補值。允許的值為：tiktok / kuaishou / xiaohongshu / douyin。
