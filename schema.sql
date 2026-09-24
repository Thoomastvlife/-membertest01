-- ========================================
-- 會員結帳系統 D1 資料庫結構 (Cloudflare Pages 版)
-- 全新安裝: wrangler d1 execute checkout_db --file=./schema.sql
-- 既有資料庫升級: 請改用 migrate_v2.sql（不要重跑本檔，避免覆蓋既有資料） 
-- ========================================

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account TEXT UNIQUE,          -- 會員帳號（選填，供未來會員登入使用）
  password_hash TEXT,           -- 會員密碼（加鹽雜湊儲存，選填）
  phone TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  member_id INTEGER,
  member_name_snapshot TEXT NOT NULL,
  payment_method TEXT,                 -- NULL | transfer | store_barcode | taiwan_pay
  status TEXT NOT NULL DEFAULT 'pending_method',
  -- pending_method -> awaiting_payment (transfer) / awaiting_barcode -> ready_to_pay -> paid
  -- 也可能是 expired / cancelled
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  barcode_image TEXT,                  -- base64 data URL, admin 上傳
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  method_selected_at TEXT,
  barcode_uploaded_at TEXT,
  paid_at TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);

-- 預設轉帳帳戶設定（可於後台「設定」頁修改）
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_name', '請於後台設定填入銀行名稱');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_number', '請於後台設定填入帳號');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_holder', '請於後台設定填入戶名');
