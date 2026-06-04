/** Bindings & biến môi trường của Worker bán hàng (khớp wrangler.jsonc). */
export interface Env {
  ASSETS: Fetcher;

  // secrets
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_DIRECT?: string;
  ES_API_KEY?: string;
  TURNSTILE_SECRET?: string;

  // vars
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_NAME: string;
  DEFAULT_MODEL: string;
  ALLOWED_ORIGINS?: string;
  ES_URL?: string;
  ES_INDEX?: string;
  // Shopify: lấy sản phẩm từ store công khai (vd "daisanstore.com") qua products.json.
  SHOPIFY_DOMAIN?: string;

  // --- Odoo CRM (CHỈ tạo lead) — xem src/odoo.ts ---
  // vars: ODOO_URL, ODOO_DB, ODOO_LOGIN (hoặc ODOO_UID). secret: ODOO_API_KEY.
  ODOO_URL?: string;
  ODOO_DB?: string;
  ODOO_LOGIN?: string;
  ODOO_UID?: string;
  ODOO_API_KEY?: string;

  // optional
  DB?: D1Database;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Body POST /api/chat. */
export interface ChatRequest {
  messages: ChatMessage[];
  site?: string; // daisanstore | b2b | daisan
}

/** Định nghĩa tool cho Claude (chuẩn Anthropic Messages API). */
export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  price?: number;
  unit?: string;
  brand?: string;
  desc?: string;
  image?: string;
  url?: string;
}

export interface Store {
  id: string;
  name: string;
  province: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  salesperson?: string;
  categories?: string[];
}
