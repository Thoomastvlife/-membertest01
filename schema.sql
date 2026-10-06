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
  email TEXT,                   -- 電子信箱（自助註冊必填；後台建立可留空）
  email_verified_at TEXT,       -- 通過信箱驗證碼的時間；NULL 表示未驗證（後台手動建立／舊會員）
  tiktok_id TEXT,               -- TikTok 帳號（小寫、不含 @），直播下單用來辨識會員；同一帳號只能綁一位會員
  note TEXT,
  referral_code TEXT UNIQUE,    -- 專屬推薦碼，供他人透過隱藏註冊連結自行加入時填寫
  referred_by INTEGER,          -- 透過哪位會員的推薦碼註冊（自行註冊才會有值）
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (referred_by) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  member_id INTEGER,
  member_name_snapshot TEXT NOT NULL,
  payment_method TEXT,                 -- NULL | transfer | store_barcode | taiwan_pay
  store_brand TEXT,                    -- 超商條碼所選超商：NULL | seven | family | hilife
  notify_email INTEGER NOT NULL DEFAULT 0,  -- 1 = 顧客下單時勾選了「訂單完成寄信通知我」
  notify_email_addr TEXT,                   -- 顧客為這筆訂單指定的通知信箱；NULL = 用會員資料中的信箱
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
  is_completed INTEGER NOT NULL DEFAULT 0,   -- 「訂單完成/結案」標記，只是方便篩選，不影響金流，需先 paid 才能標記
  completed_at TEXT,
  proof_image TEXT,                    -- 客人上傳的轉帳/繳費證明截圖 (base64 data URL)
  proof_last_digits TEXT,              -- 客人填寫的帳號末幾碼，方便店家核對
  proof_uploaded_at TEXT,
  original_amount REAL,                -- 套用優惠碼前的原始金額；未使用優惠碼則為 NULL
  coupon_code TEXT,                    -- 使用的優惠碼（快照，不受之後優惠碼變更/刪除影響）
  coupon_discount REAL,                -- 此筆訂單實際折抵的金額；未使用優惠碼則為 NULL
  platform TEXT,                       -- 儲值平台：tiktok | kuaishou | xiaohongshu | douyin，NULL 表示未指定
  platform_account TEXT,               -- 客人填寫的儲值平台帳號/ID，供店家登入該帳號進行儲值
  platform_password TEXT,              -- 客人填寫的儲值平台密碼（明碼儲存，供店家實際登入儲值使用，非會員登入密碼）
  points_used INTEGER NOT NULL DEFAULT 0,   -- 這筆訂單使用的點數
  points_discount REAL,                -- 點數折抵的金額
  coins REAL,                          -- 依下單當下的費率試算出的預計獲得幣數（以優惠碼折抵前的金額計算），NULL 表示未計算（例如未指定平台或金額不在範圍）
  admin_note TEXT,                     -- 後台內部備註，不會顯示給客人看，單純方便店家自己記錄
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 優惠碼（僅支援百分比折扣，可設定折扣上限、最低訂單金額門檻、使用次數上限、到期時間）
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',  -- percent（百分比折扣） | fixed（直接折抵固定金額）
  discount_percent REAL,               -- discount_type='percent' 時使用，例如 10 代表折抵 10%
  discount_amount REAL,                -- discount_type='fixed' 時使用，直接折抵這個固定金額
  max_discount_amount REAL,            -- 僅 percent 類型適用：折抵金額不會超過此上限，NULL 表示不限
  min_order_amount REAL NOT NULL DEFAULT 0,  -- 最低訂單金額門檻，訂單金額需達到此金額才可使用
  usage_limit INTEGER,                 -- 總使用次數上限，NULL 表示不限
  used_count INTEGER NOT NULL DEFAULT 0,     -- 已使用次數
  expires_at TEXT,                     -- 到期時間，NULL 表示不過期
  is_active INTEGER NOT NULL DEFAULT 1,      -- 是否啟用（可手動停用而不刪除）
  note TEXT,                           -- 備註
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 後台裝置的瀏覽器推播訂閱資訊（Web Push）。每個管理員在每台裝置/瀏覽器訂閱一次會有一筆。
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- 自助註冊的信箱驗證碼（只存雜湊，10 分鐘有效，錯誤 5 次作廢）
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- 寄信紀錄，用來限制頻率（同信箱 60 秒一封、每小時 5 封；同 IP 每小時 10 封）
CREATE TABLE IF NOT EXISTS email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_send_log_email ON email_send_log(email, created_at);
CREATE INDEX IF NOT EXISTS idx_email_send_log_ip ON email_send_log(ip, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON orders(is_completed);

-- 預設轉帳帳戶設定（可於後台「設定」頁修改）
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_name', '請於後台設定填入銀行名稱');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_number', '請於後台設定填入帳號');
INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_account_holder', '請於後台設定填入戶名');
INSERT OR IGNORE INTO settings (key, value) VALUES ('rate_rules', '[{"min":0,"rate":2.5}]');

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

-- ===== v19：直播下單 =====
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
