-- ========================================
-- 升級腳本 v15：超商條碼可選超商（7-11 / 全家 / 萊爾富）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v15.sql
-- 只需執行一次；必須在部署新程式「之前」先執行，否則客人選超商時會出錯
-- 全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================
ALTER TABLE orders ADD COLUMN store_brand TEXT;   -- NULL | seven | family | hilife（只有付款方式為超商條碼才有值）
