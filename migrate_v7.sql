-- ========================================
-- 升級腳本 v7：優惠碼支援「直接折抵固定金額」
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v7.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE coupons ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE coupons ADD COLUMN discount_amount REAL;

-- 既有優惠碼原本都是百分比折扣，discount_type 預設補成 'percent' 即可，
-- discount_percent 欄位維持原值不需要動，不需要再手動補值。
