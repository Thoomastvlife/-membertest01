-- ========================================
-- 升級腳本 v27：員工可以自選要收哪些推播類型
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v27.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- 沒執行這個檔案就先部署也不會壞：推播照舊全部收，只是「通知類型」設定存不起來（畫面會提示先執行）。
-- ========================================

-- JSON，例如 {"new_order":false,"need_verify":true,"need_barcode":true}；NULL 或沒列出的類型 = 收
ALTER TABLE admins ADD COLUMN push_prefs TEXT;
