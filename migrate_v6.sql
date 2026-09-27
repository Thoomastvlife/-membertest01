-- ========================================
-- 升級腳本 v6：優惠碼功能
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v6.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  discount_percent REAL NOT NULL,
  max_discount_amount REAL,
  min_order_amount REAL NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE orders ADD COLUMN original_amount REAL;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN coupon_discount REAL;

-- 既有訂單沒有使用優惠碼，以上三個欄位維持 NULL 即可，不需要補值。
