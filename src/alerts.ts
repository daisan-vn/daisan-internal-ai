import type { Env } from "./types";
import { odooExecute, odooConfigured } from "./odoo";

/**
 * Cảnh báo tự động (giám sát Odoo). Truy vấn TRỰC TIẾP qua JSON-RPC (không qua
 * Claude) để số liệu chính xác, nhanh, rẻ. Mỗi mục bọc try/catch riêng: một mục
 * lỗi (vd model/field khác phiên bản Odoo) không làm hỏng cả lần kiểm tra.
 *
 * 3 mục:
 *  1. Công nợ phải thu QUÁ HẠN (account.move.line, đến hạn < hôm nay, còn dư nợ).
 *  2. Tồn kho ÂM (stock.quant < 0 ở kho nội bộ).
 *  3. Quỹ tiền/ngân hàng CHƯA đối chiếu (account.bank.statement.line is_reconciled=false).
 */

let ensured = false;
export async function ensureAlertsTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS alert_runs (
       id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, result TEXT NOT NULL
     )`,
  ).run();
  ensured = true;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const nameOf = (v: unknown): string => (Array.isArray(v) && v.length > 1 ? String(v[1]) : "—");

export interface AlertResult {
  generated_at: number;
  receivable: { ok: boolean; error?: string; count?: number; total?: number; top?: Array<{ partner: string; amount: number }> };
  negativeStock: { ok: boolean; error?: string; count?: number; items?: Array<{ product: string; location: string; qty: number }> };
  unreconciled: { ok: boolean; error?: string; count?: number; total?: number; items?: Array<{ date: string; ref: string; amount: number; journal: string }> };
}

async function checkReceivable(env: Env): Promise<AlertResult["receivable"]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const domain = [
      ["account_type", "=", "asset_receivable"],
      ["parent_state", "=", "posted"],
      ["amount_residual", ">", 0],
      ["date_maturity", "!=", false],
      ["date_maturity", "<", today],
    ];
    const count = (await odooExecute(env, "account.move.line", "search_count", [domain])) as number;
    const groups = (await odooExecute(env, "account.move.line", "read_group", [domain, ["amount_residual:sum"], ["partner_id"]], { lazy: false })) as Array<{ partner_id: unknown; amount_residual: number }>;
    const top = (groups || [])
      .map((g) => ({ partner: nameOf(g.partner_id), amount: g.amount_residual || 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    const total = (groups || []).reduce((s, g) => s + (g.amount_residual || 0), 0);
    return { ok: true, count, total, top };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function checkNegativeStock(env: Env): Promise<AlertResult["negativeStock"]> {
  try {
    const domain = [["quantity", "<", 0], ["location_id.usage", "=", "internal"]];
    const count = (await odooExecute(env, "stock.quant", "search_count", [domain])) as number;
    const rows = (await odooExecute(env, "stock.quant", "search_read", [domain], {
      fields: ["product_id", "location_id", "quantity"],
      limit: 50,
      order: "quantity asc",
    })) as Array<{ product_id: unknown; location_id: unknown; quantity: number }>;
    const items = (rows || []).map((r) => ({ product: nameOf(r.product_id), location: nameOf(r.location_id), qty: r.quantity }));
    return { ok: true, count, items };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function checkUnreconciled(env: Env): Promise<AlertResult["unreconciled"]> {
  try {
    const domain = [["is_reconciled", "=", false]];
    const count = (await odooExecute(env, "account.bank.statement.line", "search_count", [domain])) as number;
    const rows = (await odooExecute(env, "account.bank.statement.line", "search_read", [domain], {
      fields: ["date", "payment_ref", "amount", "journal_id"],
      limit: 50,
      order: "date desc",
    })) as Array<{ date: string; payment_ref: string; amount: number; journal_id: unknown }>;
    const items = (rows || []).map((r) => ({ date: r.date, ref: r.payment_ref || "—", amount: r.amount || 0, journal: nameOf(r.journal_id) }));
    const total = items.reduce((s, r) => s + (r.amount || 0), 0);
    return { ok: true, count, total, items };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Chạy kiểm tra 3 mục, lưu kết quả vào D1, trả về kết quả. */
export async function runAlerts(env: Env): Promise<AlertResult> {
  await ensureAlertsTable(env);
  const now = Date.now();
  let result: AlertResult;

  if (!odooConfigured(env)) {
    const e = "Chưa kết nối Odoo.";
    result = { generated_at: now, receivable: { ok: false, error: e }, negativeStock: { ok: false, error: e }, unreconciled: { ok: false, error: e } };
  } else {
    const [receivable, negativeStock, unreconciled] = await Promise.all([
      checkReceivable(env),
      checkNegativeStock(env),
      checkUnreconciled(env),
    ]);
    result = { generated_at: now, receivable, negativeStock, unreconciled };
  }

  await env.DB.prepare("INSERT INTO alert_runs (id, created_at, result) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), now, JSON.stringify(result))
    .run();
  return result;
}

/** Lấy kết quả mới nhất + danh sách thời điểm các lần kiểm tra gần đây. */
export async function getAlertsView(env: Env): Promise<{ latest: AlertResult | null; history: Array<{ id: string; created_at: number }> }> {
  await ensureAlertsTable(env);
  const latest = await env.DB.prepare("SELECT result FROM alert_runs ORDER BY created_at DESC LIMIT 1").first<{ result: string }>();
  const { results } = await env.DB.prepare("SELECT id, created_at FROM alert_runs ORDER BY created_at DESC LIMIT 30").all<{ id: string; created_at: number }>();
  return {
    latest: latest ? (JSON.parse(latest.result) as AlertResult) : null,
    history: results ?? [],
  };
}
