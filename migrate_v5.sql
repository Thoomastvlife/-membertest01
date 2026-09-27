-- ========================================
-- 升級腳本 v5：會員推薦碼 + 隱藏連結自行註冊
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v5.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE members ADD COLUMN referral_code TEXT;
ALTER TABLE members ADD COLUMN referred_by INTEGER REFERENCES members(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);

-- 既有會員的推薦碼會在第一次讀取（後台會員列表 / 會員自助頁）時自動產生並補上，
-- 不需要在這裡手動填值。
