-- ========================================
-- 升級腳本 v20：直播留言自動抓取（監聽程式送進來的留言去重用）
-- 執行: wrangler d1 execute <你的資料庫名稱> --remote --file=./migrate_v20.sql
-- 只需執行一次；全新安裝（用最新 schema.sql 建立）者不需要跑這個檔案
-- ========================================

ALTER TABLE live_comments ADD COLUMN source_id TEXT;   -- 監聽程式送來的留言編號（msgId:第幾個商品），同一則留言重送時不會重複寫入
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_comments_source ON live_comments(round_id, source_id) WHERE source_id IS NOT NULL;
