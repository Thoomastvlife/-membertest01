-- 既有 D1 資料庫升級：操作紀錄加上「屬於哪張訂單」欄位，讓每張訂單可以查看完整的操作歷程
-- 跑法：wrangler d1 execute checkout_db --remote --file=./migrate_v25.sql
-- 全新安裝不需要跑這個，最新的 schema.sql 已經包含了。
-- 還沒跑這個升級時，系統會自動退回舊的寫法，操作紀錄不會壞，只是新的紀錄還不會帶訂單編號。
-- 舊的紀錄不用回填：查看訂單歷程時，會用訂單編號文字再比對一次舊紀錄。

ALTER TABLE admin_logs ADD COLUMN order_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_admin_logs_order ON admin_logs(order_id, id);
