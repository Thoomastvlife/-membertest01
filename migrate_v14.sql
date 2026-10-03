-- ========================================
-- 升級腳本 v14：點數系統（累積 / 折抵 / 點數商城）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v14.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

-- 訂單：記錄這筆訂單使用了多少點數、折抵多少金額
ALTER TABLE orders ADD COLUMN points_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_discount REAL;

-- 點數異動紀錄（餘額 = 該會員所有 delta 加總，不另外存餘額，避免對不上）
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,            -- 正數＝獲得，負數＝扣除
  type TEXT NOT NULL,                -- earn（付款回饋）| spend（訂單折抵）| redeem（商城兌換）| refund（兌換退回）| admin（後台調整）
  order_id INTEGER,
  ref_id INTEGER,                    -- 兌換單 id
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_member ON points_ledger(member_id, id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_order ON points_ledger(order_id);

-- 點數商城商品
CREATE TABLE IF NOT EXISTS points_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,             -- 需要幾點
  stock INTEGER,                     -- 剩餘數量，NULL 表示不限
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 兌換單
CREATE TABLE IF NOT EXISTS points_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  item_id INTEGER,
  item_name TEXT NOT NULL,           -- 兌換當下的商品名稱快照
  cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending（待處理）| fulfilled（已完成）| rejected（已拒絕並退點）
  member_note TEXT,
  admin_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_member ON points_redemptions(member_id, id);
CREATE INDEX IF NOT EXISTS idx_points_redemptions_status ON points_redemptions(status);
