-- ========================================
-- 升級腳本 v19：直播下單（TikTok 直播留言「A201+1」解析成訂單）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v19.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

-- 會員的 TikTok 帳號（小寫、不含 @），同一個 TikTok 帳號只能綁一位會員
ALTER TABLE members ADD COLUMN tiktok_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_tiktok_id ON members(tiktok_id) WHERE tiktok_id IS NOT NULL;

-- 直播場次
CREATE TABLE IF NOT EXISTS live_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open（可貼留言）| closed（已結標）
  created_at TEXT DEFAULT (datetime('now'))
);

-- 場次內的商品（代號例如 A201）
CREATE TABLE IF NOT EXISTS live_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  code TEXT NOT NULL,                       -- 商品代號，大寫
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER,                            -- NULL 表示不限量
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (round_id, code)
);

-- 貼進來的留言（一則留言含多個商品會拆成多列）
CREATE TABLE IF NOT EXISTS live_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  tiktok_id TEXT,
  raw TEXT,
  item_code TEXT,
  qty INTEGER,
  member_id INTEGER,
  status TEXT NOT NULL,                     -- ok | guest | unbound | waitlist | invalid | ordered
  error TEXT,
  order_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_comments_round ON live_comments(round_id, id);
