import type { Env } from "./types";
import { odooConfigured, createLead } from "./odoo";

/**
 * Thu lead. Ưu tiên tạo crm.lead trong Odoo (nếu đã cấu hình) để sales nhận ngay;
 * đồng thời lưu D1 (nếu bật) + log. Trả về mã tham chiếu hiển thị cho khách.
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

  // 1) Tạo lead trong Odoo CRM (nếu đã cấu hình).
  if (odooConfigured(env)) {
    try {
      const title = `[Web ${input.site || "salesbot"}] ` + (input.productInterest || input.name || "Khách hàng mới");
      const desc = [
        input.productInterest ? "Quan tâm: " + input.productInterest : "",
        input.name ? "Tên: " + input.name : "",
        input.province ? "Khu vực: " + input.province : "",
        input.storeId ? "Cửa hàng gần nhất: " + input.storeId : "",
        input.note ? "Ghi chú: " + input.note : "",
        "Nguồn: chatbot " + (input.site || "salesbot"),
      ].filter(Boolean).join("\n");
      const vals: Record<string, unknown> = {
        name: title,
        type: "opportunity",
        phone: input.phone,
        description: desc,
      };
      if (input.name) vals.contact_name = input.name;
      if (input.email) vals.email_from = input.email;
      const id = await createLead(env, vals);
      console.log("LEAD->Odoo crm.lead #" + id, input.phone);
      return { ref: "#" + id };
    } catch (e) {
      console.error("Tạo lead Odoo lỗi:", e); // rơi xuống lưu D1/log
    }
  }

  // 2) Dự phòng: lưu D1 (nếu bật) + log.
  const row = { ref, ...input, created_at: Date.now() };
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
  return { ref };
}

