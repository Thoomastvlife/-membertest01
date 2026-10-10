-- ========================================
-- 升級腳本 v22：後台員工權限（只有管理員能新增員工、設定權限）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v22.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'staff';   -- owner（管理員）| staff（員工）
ALTER TABLE admins ADD COLUMN permissions TEXT;                      -- 員工可用的功能（JSON 陣列）；NULL = 還沒設定過，維持升級前的行為

-- 帳號名稱是 admin 的設為管理員
UPDATE admins SET role='owner' WHERE username='admin';
-- 如果沒有叫 admin 的帳號，就把最早建立的那個帳號設為管理員，避免沒人能管理員工
UPDATE admins SET role='owner'
  WHERE id=(SELECT MIN(id) FROM admins)
    AND NOT EXISTS (SELECT 1 FROM admins WHERE role='owner');

-- 想要升級後「現有員工」立刻改成只能用「首頁＋結帳櫃檯／訂單列表」，再執行下面這行（預設不執行）：
-- UPDATE admins SET permissions='["dashboard","orders"]' WHERE role='staff' AND permissions IS NULL;
