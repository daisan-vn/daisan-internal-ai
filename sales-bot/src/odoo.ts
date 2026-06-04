import type { Env } from "./types";

/**
 * Kết nối Odoo cho bot bán hàng — CHỈ tạo crm.lead (không đọc/ghi gì khác).
 * Khuyến nghị dùng tài khoản Odoo API riêng cho bot, chỉ cấp quyền tạo lead.
 */

export function odooConfigured(env: Env): boolean {
  return Boolean(env.ODOO_URL && env.ODOO_DB && env.ODOO_API_KEY && (env.ODOO_LOGIN || env.ODOO_UID));
}

async function jsonRpc(env: Env, service: string, method: string, args: unknown[]): Promise<unknown> {
  const base = (env.ODOO_URL || "").replace(/\/+$/, "");
  const res = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: { data?: { message?: string }; message?: string } };
  if (data.error) throw new Error(`Odoo: ${data.error.data?.message || data.error.message || "lỗi"}`);
  return data.result;
}

let uidCache: number | null = null;
async function getUid(env: Env): Promise<number> {
  if (uidCache && uidCache > 0) return uidCache;
  if (env.ODOO_LOGIN) {
    const uid = await jsonRpc(env, "common", "authenticate", [env.ODOO_DB, env.ODOO_LOGIN, env.ODOO_API_KEY, {}]);
    if (typeof uid !== "number" || uid <= 0) throw new Error("Đăng nhập Odoo thất bại.");
    uidCache = uid;
    return uid;
  }
  const fixed = Number(env.ODOO_UID);
  if (fixed > 0) { uidCache = fixed; return fixed; }
  throw new Error("Chưa cấu hình ODOO_LOGIN hoặc ODOO_UID.");
}

/** Tạo cơ hội (crm.lead) trong Odoo. Trả về id. */
export async function createLead(env: Env, vals: Record<string, unknown>): Promise<number> {
  const uid = await getUid(env);
  const id = await jsonRpc(env, "object", "execute_kw", [env.ODOO_DB, uid, env.ODOO_API_KEY, "crm.lead", "create", [vals]]);
  if (typeof id !== "number") throw new Error("Tạo lead Odoo thất bại.");
  return id;
}

/** Kiểm tra kết nối: xác thực + đọc tên user (debug). */
export async function odooAuthCheck(env: Env): Promise<{ uid: number; name: string }> {
  uidCache = null;
  const uid = await getUid(env);
  const rows = (await jsonRpc(env, "object", "execute_kw", [env.ODOO_DB, uid, env.ODOO_API_KEY, "res.users", "read", [[uid], ["name", "login"]]])) as Array<{ name?: string; login?: string }>;
  return { uid, name: rows?.[0]?.name || rows?.[0]?.login || "?" };
}
