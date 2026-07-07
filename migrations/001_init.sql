-- D1 数据库初始化
-- 运行: wrangler d1 execute gleams-db --file=./migrations/001_init.sql

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '匿名骑士',
  message TEXT NOT NULL,
  member TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
