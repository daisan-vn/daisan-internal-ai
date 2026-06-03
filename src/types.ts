/** Bindings & biến môi trường của Worker. Khớp với wrangler.jsonc. */
export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  DB: D1Database;

  // vars
  AUTORAG_NAME: string;
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_NAME: string;
  DEFAULT_MODEL: string;
  RAG_TOP_K: string;
  RAG_SCORE_THRESHOLD: string;

  // secrets
  ANTHROPIC_API_KEY: string;
  AI_GATEWAY_TOKEN?: string;

  // Cờ chỉ dùng cho local dev (.dev.vars): "true" -> gọi thẳng Anthropic,
  // bỏ qua AI Gateway (xem llm.ts). Production để trống.
  ANTHROPIC_DIRECT?: string;
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
