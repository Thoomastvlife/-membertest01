-- ========================================
-- 升級腳本 v13：信箱驗證碼（自助註冊用）
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v13.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE members ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_send_log_email ON email_send_log(email, created_at);
CREATE INDEX IF NOT EXISTS idx_email_send_log_ip ON email_send_log(ip, created_at);

-- 既有會員的 email_verified_at 維持 NULL（代表「未經驗證」），不影響登入與下單。
