-- 既有 D1 資料庫升級：新增「後台操作紀錄」所需資料表
-- 跑法：wrangler d1 execute checkout_db --file=./migrate_v21.sql
-- 全新安裝不需要跑這個，最新的 schema.sql 已經包含這張表了。

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id, created_at);
