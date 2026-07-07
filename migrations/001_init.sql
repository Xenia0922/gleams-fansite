CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '匿名骑士',
  message TEXT NOT NULL,
  member TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
