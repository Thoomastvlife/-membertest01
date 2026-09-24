-- ========================================
-- 既有資料庫升級腳本（從舊版 Workers 系統升級為 Pages 版）
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v2.sql
-- 只需執行一次；已是新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE members ADD COLUMN account TEXT;
ALTER TABLE members ADD COLUMN password_hash TEXT;

-- account 欄位建立唯一索引（SQLite/D1 不能在 ALTER TABLE 時直接加 UNIQUE 約束，改用唯一索引達成同樣效果）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_account ON members(account);

CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
