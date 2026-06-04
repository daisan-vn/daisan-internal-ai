import type { Env, ChatMessage } from "./types";
import { streamClaudeAgent } from "./llm";
import { ODOO_TOOLS, runOdooTool, describeOdooTool, odooConfigured } from "./odoo";
import { SYSTEM_PROMPT, odooSystemNote } from "./prompt";

/**
 * Báo cáo tự động: dùng Claude + công cụ Odoo (toàn quyền, vì chạy ở cấp hệ thống)
 * để tạo báo cáo kinh doanh, lưu vào D1 để xem lại trong trang admin.
 */

let ensured = false;
export async function ensureReportsTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS reports (
       id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT, content TEXT NOT NULL, created_at INTEGER NOT NULL
     )`,
  ).run();
  ensured = true;
}

const REPORT_PROMPT = `Hãy tạo BÁO CÁO KINH DOANH TUẦN cho Daisan Group dựa trên DỮ LIỆU ODOO THẬT (dùng công cụ để truy vấn, đừng đoán số). Phạm vi: 7 ngày gần nhất. Bao gồm các mục nếu có dữ liệu:
- Tổng số đơn bán & doanh thu trong tuần (sale.order, lọc theo date_order).
- Top 5 khách hàng theo doanh thu tuần.
- Tổng công nợ phải thu hiện tại (account.move / account.move.line).
- Số đơn mua & tổng giá trị mua trong tuần (purchase.order).
Yêu cầu trình bày: Markdown tiếng Việt, NGẮN GỌN, có tiêu đề và vài mục rõ ràng, dùng bảng khi cần, tiền tệ VND có phân tách hàng nghìn. Là hệ thống ĐA CÔNG TY — nêu rõ là tổng hợp toàn tập đoàn. Cuối báo cáo ghi mốc thời gian. Phần nào thiếu dữ liệu/không truy được thì ghi "không có dữ liệu", KHÔNG bịa.`;

/** Tạo một báo cáo và lưu vào D1. kind: 'weekly' (cron) hoặc 'manual' (bấm tay). */
export async function generateReport(env: Env, kind = "weekly"): Promise<void> {
  await ensureReportsTable(env);
  const now = Date.now();
  let content = "";

  if (!odooConfigured(env)) {
    content = "⚠️ Chưa kết nối Odoo nên không tạo được báo cáo số liệu. Hãy cấu hình Odoo rồi thử lại.";
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const system = `${SYSTEM_PROMPT}\n\n${odooSystemNote(today)}`;
    const messages: ChatMessage[] = [{ role: "user", content: REPORT_PROMPT }];
    try {
      for await (const ev of streamClaudeAgent(
        env,
        system,
        messages,
        ODOO_TOOLS,
        (name, input) => runOdooTool(env, name, input),
        describeOdooTool,
        10,
      )) {
        if (ev.type === "text") content += ev.text;
      }
    } catch (e) {
      content = `Lỗi khi tạo báo cáo: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  if (!content.trim()) content = "(Không tạo được nội dung báo cáo.)";

  const title = `Báo cáo ${kind === "weekly" ? "kinh doanh tuần" : "theo yêu cầu"} — ${new Date(now).toLocaleString("vi-VN")}`;
  await env.DB.prepare(
    "INSERT INTO reports (id, kind, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), kind, title, content, now).run();
}

export async function listReports(env: Env) {
  await ensureReportsTable(env);
  const { results } = await env.DB.prepare(
    "SELECT id, kind, title, created_at FROM reports ORDER BY created_at DESC LIMIT 50",
  ).all<{ id: string; kind: string; title: string; created_at: number }>();
  return results ?? [];
}

export async function getReport(env: Env, id: string) {
  await ensureReportsTable(env);
  return env.DB.prepare("SELECT id, kind, title, content, created_at FROM reports WHERE id = ?")
    .bind(id)
    .first<{ id: string; kind: string; title: string; content: string; created_at: number }>();
}
