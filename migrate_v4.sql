-- ========================================
-- 升級腳本 v4：後台瀏覽器推播通知（有會員自助下單時通知管理員）
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v4.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 預設抖幣費率（若後台已經存過費率，這行 INSERT OR IGNORE 不會覆蓋掉既有設定）
INSERT OR IGNORE INTO settings (key, value) VALUES ('rate_rules', '[{"min":0,"rate":2.5}]');
