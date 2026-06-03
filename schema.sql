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

-- Lịch sử phiên đăng nhập (qua Cloudflare Access). Một phiên mới = không hoạt động > 30 phút.
CREATE TABLE IF NOT EXISTS access_sessions (
  id           TEXT PRIMARY KEY,
  user_email   TEXT NOT NULL,
  ip           TEXT,
  country      TEXT,
  user_agent   TEXT,
  started_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_access_email ON access_sessions (user_email, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_last ON access_sessions (last_seen_at DESC);
