-- Lịch sử chat theo từng người (Phase 2). user_email lấy từ Cloudflare Access.
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations (user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,         -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  sources         TEXT,                  -- JSON array tên file nguồn (nếu có)
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, created_at);
