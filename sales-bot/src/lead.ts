import type { Env } from "./types";

/**
 * Thu lead. Skeleton: lưu vào D1 nếu đã bật binding DB, đồng thời log; trả về mã
 * tham chiếu. BƯỚC SAU: chuyển thẳng sang Odoo CRM (crm.lead) + định tuyến theo
 * nhóm sản phẩm / cửa hàng gần nhất (tái dùng cơ chế đã làm cho trợ lý nội bộ).
 */

export interface LeadInput {
  name?: string;
  phone: string;
  email?: string;
  productInterest?: string;
  storeId?: string;
  province?: string;
  note?: string;
  site?: string;
}

export async function captureLead(env: Env, input: LeadInput): Promise<{ ref: string }> {
  const ref = "LEAD-" + Date.now().toString(36).toUpperCase();
  const row = { ref, ...input, created_at: Date.now() };

  // Lưu D1 nếu có (tùy chọn — xem wrangler.jsonc).
  if (env.DB) {
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS leads (ref TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
           product_interest TEXT, store_id TEXT, province TEXT, note TEXT, site TEXT, created_at INTEGER)`,
      ).run();
      await env.DB.prepare(
        `INSERT INTO leads (ref, name, phone, email, product_interest, store_id, province, note, site, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(ref, input.name ?? null, input.phone, input.email ?? null, input.productInterest ?? null,
        input.storeId ?? null, input.province ?? null, input.note ?? null, input.site ?? null, row.created_at).run();
    } catch (e) {
      console.error("Lưu lead D1 lỗi:", e);
    }
  }
  console.log("LEAD:", JSON.stringify(row));
  // TODO: tạo crm.lead trong Odoo + định tuyến tới cửa hàng/nhân sự phụ trách.
  return { ref };
}
