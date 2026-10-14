-- ========================================
-- 升級腳本 v28：登入保護（連續失敗鎖定 + 管理員兩步驟驗證 TOTP）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v28.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- 沒執行這個檔案就先部署也不會壞：後台/會員登入照舊，只是不會鎖定、也不能啟用兩步驟驗證
-- （程式會自動偵測欄位不存在並略過，畫面上也會提示先執行這支腳本）
-- ========================================

-- 後台帳號（員工／管理員）
ALTER TABLE admins ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN locked_until TEXT;              -- 鎖定到期時間（UTC）；NULL 或已過期 = 沒被鎖
ALTER TABLE admins ADD COLUMN totp_secret TEXT;               -- 已啟用的 TOTP 密鑰（base32）；NULL = 未啟用
ALTER TABLE admins ADD COLUMN totp_pending_secret TEXT;       -- 啟用流程中暫存的密鑰，掃完 QR 並驗證成功才會正式生效
ALTER TABLE admins ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN totp_backup_codes TEXT;         -- JSON 陣列，備援碼的雜湊值（一次性使用，用掉就從陣列移除）

-- 會員帳號（只做連續失敗鎖定，沒有兩步驟驗證）
ALTER TABLE members ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN locked_until TEXT;
