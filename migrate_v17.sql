-- ========================================
-- 升級腳本 v17：訂單完成通知信可指定「這筆訂單」專用信箱
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v17.sql
-- 只需執行一次；必須在部署新程式「之前」先執行
-- （若還沒執行過 migrate_v16.sql，請先執行 v16 再執行 v17）
-- 全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================
ALTER TABLE orders ADD COLUMN notify_email_addr TEXT;  -- 顧客為這筆訂單指定的通知信箱；NULL = 用會員資料中的信箱
