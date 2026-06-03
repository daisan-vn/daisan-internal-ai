import type { Env, ToolDef } from "./types";

/**
 * Client JSON-RPC Odoo — CHỈ ĐỌC (read-only).
 *
 * Chỉ cho phép các method đọc dữ liệu. Mọi method ghi (create, write, unlink,
 * action_...) đều bị chặn ở `odooExecute`, nên dù Claude có "muốn" sửa Odoo
 * cũng không thể. Đây là lớp an toàn quan trọng nhất của tích hợp này.
 *
 * Xác thực: dùng `common.authenticate(db, login, api_key)` để lấy uid rồi gọi
 * `object.execute_kw`. Nếu đã cấu hình ODOO_UID (vd 6) thì bỏ qua bước
 * authenticate cho nhanh. uid được cache theo isolate.
 *
 * Docs: https://www.odoo.com/documentation/18.0/developer/reference/external_api.html
 */

const READ_METHODS = new Set([
  "search_read",
  "search_count",
  "read_group",
  "fields_get",
  "name_search",
  "read",
  "search",
]);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_RESULT_CHARS = 14000; // cắt bớt payload để bảo vệ ngữ cảnh Claude

let cachedUid: number | null = null;

interface OdooError {
  code: number;
  message: string;
  data?: { message?: string; name?: string };
}

/** Đã cấu hình đủ để kết nối Odoo chưa? */
export function odooConfigured(env: Env): boolean {
  return Boolean(env.ODOO_URL && env.ODOO_DB && env.ODOO_API_KEY && (env.ODOO_UID || env.ODOO_LOGIN));
}

async function jsonRpc(
  env: Env,
  service: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const base = env.ODOO_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("Chưa cấu hình ODOO_URL.");
  const endpoint = `${base}/jsonrpc`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: OdooError };
  if (data.error) {
    const e = data.error;
    throw new Error(`Odoo: ${e.data?.message || e.message || "lỗi không xác định"}`);
  }
  return data.result;
}

async function getUid(env: Env): Promise<number> {
  if (cachedUid && cachedUid > 0) return cachedUid;
  const fixed = Number(env.ODOO_UID);
  if (fixed > 0) {
    cachedUid = fixed;
    return fixed;
  }
  const uid = await jsonRpc(env, "common", "authenticate", [
    env.ODOO_DB,
    env.ODOO_LOGIN,
    env.ODOO_API_KEY,
    {},
  ]);
  if (typeof uid !== "number" || uid <= 0) {
    throw new Error("Đăng nhập Odoo thất bại (kiểm tra DB / login / API key).");
  }
  cachedUid = uid;
  return uid;
}

/**
 * Gọi execute_kw với một method ĐỌC. Ném lỗi nếu method không nằm trong whitelist.
 */
export async function odooExecute(
  env: Env,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  if (!READ_METHODS.has(method)) {
    throw new Error(`Phương thức '${method}' không được phép (trợ lý chỉ được ĐỌC Odoo).`);
  }
  const uid = await getUid(env);
  return jsonRpc(env, "object", "execute_kw", [
    env.ODOO_DB,
    uid,
    env.ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ]);
}

function clip(s: string): string {
  return s.length > MAX_RESULT_CHARS
    ? `${s.slice(0, MAX_RESULT_CHARS)}\n…[kết quả quá dài, đã cắt bớt — hãy thu hẹp truy vấn (thêm domain/limit/fields)]`
    : s;
}

/* ----------------------------- Định nghĩa công cụ cho Claude ----------------------------- */

export const ODOO_TOOLS: ToolDef[] = [
  {
    name: "odoo_search_read",
    description:
      "Đọc bản ghi từ Odoo ERP (CHỈ ĐỌC). Dùng cho hầu hết câu hỏi dữ liệu: đơn bán, khách hàng, sản phẩm, hóa đơn, công nợ, tồn kho… " +
      "Một số model thông dụng: 'sale.order' (đơn bán), 'purchase.order' (đơn mua), 'res.partner' (khách hàng/NCC), 'product.template'/'product.product' (sản phẩm), " +
      "'account.move' (hóa đơn/bút toán, lọc move_type: out_invoice=HĐ bán, in_invoice=HĐ mua), 'account.move.line' (chi tiết bút toán/công nợ), 'stock.quant' (tồn kho theo vị trí), 'stock.picking' (phiếu kho), 'crm.lead' (cơ hội), 'hr.employee' (nhân viên). " +
      "LUÔN chỉ định 'fields' cần lấy để tránh dữ liệu thừa. Để tra tên field chưa rõ, dùng odoo_fields_get trước.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Tên kỹ thuật của model Odoo, vd 'sale.order'." },
        domain: {
          type: "array",
          description:
            "Bộ lọc Odoo domain (mảng điều kiện). Mỗi điều kiện là [field, toán_tử, giá_trị], vd [[\"state\",\"=\",\"sale\"],[\"amount_total\",\">\",1000000]]. " +
            "Toán tử: =, !=, >, >=, <, <=, like, ilike, in, not in, child_of. Mặc định nối bằng AND; muốn OR thì chèn \"|\" phía trước 2 điều kiện. Mảng rỗng = tất cả.",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Danh sách field cần lấy, vd [\"name\",\"amount_total\",\"partner_id\",\"date_order\",\"state\"].",
        },
        limit: { type: "integer", description: `Số bản ghi tối đa (mặc định ${DEFAULT_LIMIT}, tối đa ${MAX_LIMIT}).` },
        order: { type: "string", description: "Sắp xếp, vd 'date_order desc' hoặc 'amount_total desc'." },
      },
      required: ["model"],
    },
  },
  {
    name: "odoo_search_count",
    description:
      "Đếm số bản ghi khớp domain trong Odoo (CHỈ ĐỌC). Dùng khi chỉ cần SỐ LƯỢNG (vd 'có bao nhiêu đơn hàng tháng này', 'bao nhiêu khách hàng đang nợ').",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Tên model Odoo, vd 'sale.order'." },
        domain: { type: "array", description: "Bộ lọc domain (như odoo_search_read). Rỗng = đếm tất cả." },
      },
      required: ["model"],
    },
  },
  {
    name: "odoo_read_group",
    description:
      "Tổng hợp / nhóm dữ liệu Odoo (CHỈ ĐỌC) — giống SQL GROUP BY. Dùng cho: tổng doanh thu theo tháng/khách/sản phẩm, tổng công nợ theo khách hàng, số đơn theo trạng thái… " +
      "'fields' dùng dạng tổng hợp như [\"amount_total:sum\"]; 'groupby' như [\"partner_id\"] hoặc [\"date_order:month\"]. Kết quả gồm giá trị tổng hợp + số bản ghi (__count) mỗi nhóm.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Tên model Odoo, vd 'sale.order'." },
        domain: { type: "array", description: "Bộ lọc domain trước khi nhóm. Rỗng = tất cả." },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Field tổng hợp, vd [\"amount_total:sum\",\"id:count\"].",
        },
        groupby: {
          type: "array",
          items: { type: "string" },
          description: "Tiêu chí nhóm, vd [\"partner_id\"] hoặc [\"date_order:month\"].",
        },
        limit: { type: "integer", description: `Số nhóm tối đa (tối đa ${MAX_LIMIT}).` },
        order: { type: "string", description: "Sắp xếp nhóm, vd 'amount_total desc'." },
      },
      required: ["model", "fields", "groupby"],
    },
  },
  {
    name: "odoo_fields_get",
    description:
      "Liệt kê các field của một model Odoo (CHỈ ĐỌC) — dùng khi chưa chắc tên/kiểu field trước khi truy vấn. Trả về { field: { string (nhãn), type, relation } }.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Tên model Odoo cần xem cấu trúc, vd 'account.move'." },
      },
      required: ["model"],
    },
  },
];

/** Mô tả ngắn gọn truy vấn để hiển thị trạng thái cho người dùng. */
export function describeOdooTool(name: string, input: Record<string, unknown>): string {
  const model = typeof input.model === "string" ? input.model : "";
  switch (name) {
    case "odoo_search_read":
      return `đọc ${model}`;
    case "odoo_search_count":
      return `đếm ${model}`;
    case "odoo_read_group":
      return `tổng hợp ${model}`;
    case "odoo_fields_get":
      return `xem cấu trúc ${model}`;
    default:
      return model || name;
  }
}

/**
 * Thực thi một công cụ Odoo do Claude yêu cầu. Trả về chuỗi (nội dung tool_result).
 */
export async function runOdooTool(
  env: Env,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const model = String(input.model || "");
  if (!model) throw new Error("Thiếu 'model'.");
  const domain = Array.isArray(input.domain) ? (input.domain as unknown[]) : [];

  switch (name) {
    case "odoo_search_read": {
      const kwargs: Record<string, unknown> = {
        limit: Math.min(Number(input.limit) || DEFAULT_LIMIT, MAX_LIMIT),
      };
      if (Array.isArray(input.fields) && input.fields.length) kwargs.fields = input.fields;
      if (input.order) kwargs.order = String(input.order);
      const rows = await odooExecute(env, model, "search_read", [domain], kwargs);
      const count = Array.isArray(rows) ? rows.length : 0;
      return clip(JSON.stringify({ model, count, rows }));
    }
    case "odoo_search_count": {
      const count = await odooExecute(env, model, "search_count", [domain]);
      return JSON.stringify({ model, count });
    }
    case "odoo_read_group": {
      const fields = Array.isArray(input.fields) ? input.fields : [];
      const groupby = Array.isArray(input.groupby) ? input.groupby : [];
      const kwargs: Record<string, unknown> = { lazy: false };
      if (input.limit) kwargs.limit = Math.min(Number(input.limit), MAX_LIMIT);
      if (input.order) kwargs.orderby = String(input.order);
      const groups = await odooExecute(env, model, "read_group", [domain, fields, groupby], kwargs);
      return clip(JSON.stringify({ model, groups }));
    }
    case "odoo_fields_get": {
      const fields = await odooExecute(env, model, "fields_get", [], {
        attributes: ["string", "type", "relation"],
      });
      return clip(JSON.stringify({ model, fields }));
    }
    default:
      throw new Error(`Công cụ Odoo không tồn tại: ${name}`);
  }
}
