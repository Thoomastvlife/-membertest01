-- ========================================
-- 升級腳本 v3：新增「訂單完成(結案)」標記 + 客人上傳付款證明
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v3.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE orders ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN completed_at TEXT;
ALTER TABLE orders ADD COLUMN proof_image TEXT;
ALTER TABLE orders ADD COLUMN proof_last_digits TEXT;
ALTER TABLE orders ADD COLUMN proof_uploaded_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON orders(is_completed);
