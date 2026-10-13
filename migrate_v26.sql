-- ========================================
-- 升級腳本 v26：會員詳細頁（標籤、備註紀錄、封鎖下單）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v26.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- 沒執行這個檔案就先部署也不會壞：會員詳細頁可以看，但標籤、備註、封鎖下單要等執行後才能使用。
-- ========================================

ALTER TABLE members ADD COLUMN tags TEXT;                                -- 標籤（JSON 陣列，例如 ["VIP","老客戶"]）
ALTER TABLE members ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;    -- 1 = 封鎖下單
ALTER TABLE members ADD COLUMN blocked_reason TEXT;                      -- 封鎖原因（只有後台看得到）
ALTER TABLE members ADD COLUMN blocked_at TEXT;                          -- 封鎖時間（UTC）
ALTER TABLE members ADD COLUMN blocked_by TEXT;                          -- 誰封鎖的（帳號名稱）

-- 備註紀錄：一位會員可以有多則備註，每則記錄時間與是誰寫的
CREATE TABLE IF NOT EXISTS member_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  admin_username TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_member_notes_member ON member_notes(member_id, id);
