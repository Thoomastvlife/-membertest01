-- v23: 訂單明細項目（品名、數量、單價、交貨狀態）
-- 一張訂單可以有多個品項，用於詳細結帳 / 發票明細 / 賒帳追蹤
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  name TEXT NOT NULL,                  -- 品名 / 項目描述
  qty REAL NOT NULL DEFAULT 1,         -- 數量
  unit_price REAL NOT NULL DEFAULT 0,  -- 單價
  is_delivered INTEGER NOT NULL DEFAULT 0,  -- 0 = 未交貨, 1 = 已交貨
  delivered_at TEXT,                   -- 標記已交貨的時間
  note TEXT,                           -- 備註
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
