-- ========================================
-- 升級腳本 v24：管理員帳號新增「信箱」欄位（每日營運日報的收件人）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v24.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

-- 選填；NULL 或空字串 = 沒填。不加 UNIQUE（SQLite 的 ALTER ADD COLUMN 不能加 UNIQUE，
-- 而且同一個信箱本來就可能給多個帳號收信）。格式檢查與轉小寫由後端儲存時處理。
ALTER TABLE admins ADD COLUMN email TEXT;
