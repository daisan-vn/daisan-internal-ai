/** Bindings & biến môi trường của Worker. Khớp với wrangler.jsonc. */
export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  DB: D1Database;
  DOCS: R2Bucket;

  // vars
  AUTORAG_NAME: string;
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_NAME: string;
  DEFAULT_MODEL: string;
  RAG_TOP_K: string;
  RAG_SCORE_THRESHOLD: string;
  // Danh sách email quản trị (phân tách bằng dấu phẩy) được xem trang admin/lịch sử
  // đăng nhập. Để trống = mọi user qua Access đều xem được (hành vi cũ).
  ADMIN_EMAILS?: string;
  // Phòng ban nhạy cảm (phân tách bằng dấu phẩy): chỉ admin/người được cấp mới xem
  // tài liệu. Để trống = mọi phòng đều mở. Xem src/rbac.ts.
  RESTRICTED_DEPTS?: string;

  // secrets
  ANTHROPIC_API_KEY: string;
  AI_GATEWAY_TOKEN?: string;

  // Cờ chỉ dùng cho local dev (.dev.vars): "true" -> gọi thẳng Anthropic,
  // bỏ qua AI Gateway (xem llm.ts). Production để trống.
  ANTHROPIC_DIRECT?: string;

  // --- Odoo (CHỈ ĐỌC) — xem src/odoo.ts ---
  // vars (wrangler.jsonc): URL, DB, UID. secrets: ODOO_API_KEY, ODOO_LOGIN.
  ODOO_URL?: string;
  ODOO_DB?: string;
  ODOO_UID?: string;
  ODOO_LOGIN?: string;
  ODOO_API_KEY?: string;

  // --- Google Drive sync (CHỈ ĐỌC) — xem src/gdrive.ts ---
  // var: GDRIVE_FOLDER_ID (ID thư mục, nhiều thì cách nhau dấu phẩy).
  // secret: GDRIVE_SA_JSON (toàn bộ JSON khóa service account).
  GDRIVE_FOLDER_ID?: string;
  GDRIVE_SA_JSON?: string;
}

/** Định nghĩa một công cụ (tool) gửi cho Claude theo chuẩn Anthropic Messages API. */
export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Một lượt hội thoại gửi từ client. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Body của POST /api/chat. */
export interface ChatRequest {
  messages: ChatMessage[];
  /** Lọc theo domain (phòng ban): ketoan | sop | crm | mua | kho | odoo ... */
  domain?: string;
  /** ID cuộc trò chuyện đang tiếp tục (rỗng/không hợp lệ = tạo mới). */
  conversationId?: string;
}

/** Một đoạn tài liệu lấy về từ AutoRAG, dùng để dựng ngữ cảnh + trích dẫn. */
export interface RetrievedChunk {
  filename: string;
  text: string;
  score: number;
}
