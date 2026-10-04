-- ========================================
-- 升級腳本 v16：顧客下單時可選「訂單完成寄信通知我」
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v16.sql
-- 只需執行一次；必須在部署新程式「之前」先執行
-- 全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================
ALTER TABLE orders ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 0;  -- 1 = 顧客下單時勾選了「訂單完成寄信通知我」
