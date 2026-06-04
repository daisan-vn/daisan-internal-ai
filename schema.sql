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

-- Phản hồi 👍/👎 của nhân viên cho từng câu trả lời (1 dòng / message_id).
CREATE TABLE IF NOT EXISTS feedback (
  message_id      TEXT PRIMARY KEY,      -- id của message assistant
  conversation_id TEXT,
  user_email      TEXT,
  value           INTEGER NOT NULL,      -- 1 = 👍, -1 = 👎
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_val ON feedback (value, created_at DESC);

-- Phân quyền phòng ban: user_email được cấp xem tài liệu phòng hạn chế nào.
CREATE TABLE IF NOT EXISTS dept_grants (
  user_email TEXT NOT NULL,
  dept       TEXT NOT NULL,         -- ketoan | mua | ... (phòng nằm trong RESTRICTED_DEPTS)
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_email, dept)
);

-- Báo cáo tự động (vd báo cáo kinh doanh tuần) do cron sinh ra, lưu để xem lại.
CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,         -- weekly | manual | ...
  title      TEXT,
  content    TEXT NOT NULL,         -- nội dung Markdown
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at DESC);

-- Trạng thái đồng bộ Google Drive -> R2 (1 dòng id='drive').
CREATE TABLE IF NOT EXISTS sync_status (
  id          TEXT PRIMARY KEY,
  state       TEXT,                  -- idle | running | done | error
  started_at  INTEGER,
  finished_at INTEGER,
  summary     TEXT,                  -- JSON SyncSummary
  error       TEXT
);
