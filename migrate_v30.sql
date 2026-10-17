-- ========================================
-- 升級腳本 v30：記錄顧客「同意服務條款／隱私權政策」的時間與版本
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v30.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- 沒執行就先部署也不會壞：註冊、下單、選付款方式都照常運作，只是不會留下同意紀錄
-- ========================================
-- 會員：註冊時勾選同意的時間與條款版本
ALTER TABLE members ADD COLUMN agreed_terms_at TEXT;
ALTER TABLE members ADD COLUMN terms_version TEXT;
-- 訂單：下單（會員自助下單）或選付款方式（後台建單的付款連結）時勾選同意的時間與條款版本
ALTER TABLE orders ADD COLUMN agreed_terms_at TEXT;
ALTER TABLE orders ADD COLUMN terms_version TEXT;
