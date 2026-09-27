-- ========================================
-- 升級腳本 v8：修正 coupons.discount_percent 誤帶 NOT NULL 限制
-- 背景：coupons 表最早由 migrate_v6.sql 建立時，discount_percent 被設成 NOT NULL
-- （當時還沒有「直接折抵固定金額」這個類型）。後來 migrate_v7.sql 用 ALTER TABLE
-- ADD COLUMN 加入 discount_type / discount_amount，但 SQLite 的 ALTER TABLE
-- 沒辦法移除既有欄位的 NOT NULL 限制，導致新增 discount_type='fixed' 的優惠碼時
-- （這種類型 discount_percent 一定是 NULL）會撞到殘留的 NOT NULL 限制而報 500。
--
-- 這支腳本會整個重建 coupons 表（SQLite 修改欄位限制的標準做法），
-- 並把既有資料原封不動搬過去，不會遺失任何優惠碼資料。
-- 如果你的 coupons 表本來就沒有這個限制（例如全新安裝、直接用最新 schema.sql
-- 建立的），這支腳本重建完的結果也完全一樣，跑了不會有副作用。
--
-- 執行: wrangler d1 execute test2 --remote --file=./migrate_v8.sql
-- ========================================

PRAGMA foreign_keys=off;

CREATE TABLE coupons_v8_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_percent REAL,
  discount_amount REAL,
  max_discount_amount REAL,
  min_order_amount REAL NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO coupons_v8_new (
  id, code, discount_type, discount_percent, discount_amount, max_discount_amount,
  min_order_amount, usage_limit, used_count, expires_at, is_active, note, created_at
)
SELECT
  id, code, discount_type, discount_percent, discount_amount, max_discount_amount,
  min_order_amount, usage_limit, used_count, expires_at, is_active, note, created_at
FROM coupons;

DROP TABLE coupons;
ALTER TABLE coupons_v8_new RENAME TO coupons;

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

PRAGMA foreign_keys=on;
