-- ========================================
-- 升級腳本 v12：會員新增「電子信箱」欄位
-- 執行: wrangler d1 execute checkout_db --file=./migrate_v12.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE members ADD COLUMN email TEXT;

-- 既有會員沒有信箱，維持 NULL 即可。
-- 「必填」只限制會員自助註冊（/member/register）；後台新增／編輯會員時，電話與信箱都可以不填。
