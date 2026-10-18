-- ========================================
-- 升級腳本 v31：後台「新裝置登入通知」與「登出所有裝置」
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v31.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- 沒執行就先部署也不會壞：登入照常運作，只是不會偵測新裝置、不會寄通知信，
-- 「登出所有裝置」會提示先執行本檔案
-- ========================================

-- 登出所有裝置：每個後台帳號一個「登入版本號」。登入時寫進登入憑證，每次請求都和這裡比對；
-- 按「登出所有裝置」就把這裡 +1，所有舊的登入憑證立刻失效（重設密碼時也會 +1）。
ALTER TABLE admins ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

-- 登入過的裝置：用瀏覽器裡的一組隨機代碼（cookie）辨識，資料庫只存它的雜湊值，不存原值。
-- 同一個帳號在沒見過的裝置（沒有這組 cookie、或換瀏覽器／清除 cookie／無痕視窗）登入，就算新裝置。
CREATE TABLE IF NOT EXISTS admin_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  device_hash TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  UNIQUE (admin_id, device_hash)
);
CREATE INDEX IF NOT EXISTS idx_admin_devices_admin ON admin_devices(admin_id, last_seen);
