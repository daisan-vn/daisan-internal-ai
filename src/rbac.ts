import type { Env } from "./types";
import { isAdmin } from "./access";

/**
 * Phân quyền theo phòng ban (RBAC) cho TÀI LIỆU.
 *
 * Mô hình:
 *  - Phòng "mở" (không nằm trong RESTRICTED_DEPTS): mọi nhân viên xem được.
 *  - Phòng "hạn chế" (RESTRICTED_DEPTS): chỉ admin hoặc người được cấp quyền
 *    (bảng dept_grants, quản lý ở trang admin) mới xem tài liệu phòng đó.
 *
 * Thực thi ở tầng truy hồi (rag.ts) — lọc bỏ đoạn tài liệu thuộc phòng bị chặn,
 * nên dù người dùng có cố chọn phòng cấm cũng không nhận được nội dung.
 */

export const ALL_DEPTS = ["odoo", "ketoan", "sop", "crm", "mua", "kho"] as const;
export const DEPT_LABELS: Record<string, string> = {
  odoo: "Odoo",
  ketoan: "Kế toán",
  sop: "SOP / Quy trình",
  crm: "CRM / Kinh doanh",
  mua: "Mua hàng",
  kho: "Kho",
};

function isDept(d: string): boolean {
  return (ALL_DEPTS as readonly string[]).includes(d);
}

/**
 * Map model Odoo -> phòng ban, để chặn DỮ LIỆU SỐNG theo quyền.
 * Trả null nếu model thuộc loại chung (vd res.partner) -> không chặn.
 * (Chỉ phòng nằm trong RESTRICTED_DEPTS + chưa được cấp mới thực sự bị chặn.)
 */
const ODOO_DEPT_PREFIXES: Array<[string, string]> = [
  ["account.", "ketoan"],   // hóa đơn, bút toán, công nợ, thanh toán
  ["purchase.", "mua"],      // đơn mua, NCC
  ["crm.", "crm"],
  ["sale.", "crm"],          // đơn bán thuộc kinh doanh
  ["stock.", "kho"],         // tồn kho, phiếu kho
];
export function odooModelDept(model: string): string | null {
  const m = (model || "").toLowerCase();
  for (const [prefix, dept] of ODOO_DEPT_PREFIXES) if (m.startsWith(prefix)) return dept;
  return null;
}

/** Danh sách phòng ban nhạy cảm (đã chuẩn hóa, chỉ giữ phòng hợp lệ). */
export function restrictedDepts(env: Env): string[] {
  return (env.RESTRICTED_DEPTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((d) => d && isDept(d));
}

let ensured = false;
export async function ensureGrantsTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS dept_grants (
       user_email TEXT NOT NULL,
       dept       TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       PRIMARY KEY (user_email, dept)
     )`,
  ).run();
  ensured = true;
}

async function grantedDeptsFor(env: Env, email: string): Promise<Set<string>> {
  await ensureGrantsTable(env);
  const { results } = await env.DB.prepare("SELECT dept FROM dept_grants WHERE user_email = ?")
    .bind((email || "").toLowerCase())
    .all<{ dept: string }>();
  return new Set((results ?? []).map((r) => r.dept));
}

/** Phòng hạn chế mà user KHÔNG được xem (để lọc tài liệu). Admin -> rỗng. */
export async function blockedDeptsFor(env: Env, email: string): Promise<string[]> {
  const restricted = restrictedDepts(env);
  if (!restricted.length || isAdmin(env, email)) return [];
  const granted = await grantedDeptsFor(env, email);
  return restricted.filter((d) => !granted.has(d));
}

/** Danh sách phòng user ĐƯỢC xem (cho giao diện). Admin -> tất cả. */
export async function allowedDeptsFor(env: Env, email: string): Promise<string[]> {
  const blocked = new Set(await blockedDeptsFor(env, email));
  return (ALL_DEPTS as readonly string[]).filter((d) => !blocked.has(d));
}

/**
 * Có quyền giao việc (tạo task Odoo) không?
 * - Chưa cấu hình ASSIGNER_EMAILS (để trống) -> MỌI nhân viên đều giao việc được
 *   (app nằm sau Cloudflare Access nên ai vào được đều là người nội bộ).
 * - Có cấu hình -> chỉ admin hoặc email trong danh sách mới giao việc được.
 * (Cùng quy ước "danh sách rỗng = mở cho tất cả" như isAdmin/ADMIN_EMAILS.)
 */
export function canAssign(env: Env, email: string): boolean {
  const list = (env.ASSIGNER_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true; // mặc định: mọi nhân viên đều giao việc được
  if (isAdmin(env, email)) return true;
  return list.includes((email || "").toLowerCase());
}

/* ----------------------------- Quản trị ----------------------------- */

export interface GrantsView {
  restricted: string[];
  labels: Record<string, string>;
  grants: Array<{ user_email: string; depts: string[] }>;
}

export async function listGrants(env: Env): Promise<GrantsView> {
  await ensureGrantsTable(env);
  const { results } = await env.DB.prepare(
    "SELECT user_email, dept FROM dept_grants ORDER BY user_email, dept",
  ).all<{ user_email: string; dept: string }>();
  const map = new Map<string, string[]>();
  for (const r of results ?? []) {
    const arr = map.get(r.user_email) ?? [];
    arr.push(r.dept);
    map.set(r.user_email, arr);
  }
  return {
    restricted: restrictedDepts(env),
    labels: DEPT_LABELS,
    grants: [...map.entries()].map(([user_email, depts]) => ({ user_email, depts })),
  };
}

export async function setGrant(env: Env, email: string, dept: string, on: boolean): Promise<void> {
  await ensureGrantsTable(env);
  const e = (email || "").trim().toLowerCase();
  const d = (dept || "").trim().toLowerCase();
  if (!e || !isDept(d)) return;
  if (on) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO dept_grants (user_email, dept, created_at) VALUES (?, ?, ?)",
    ).bind(e, d, Date.now()).run();
  } else {
    await env.DB.prepare("DELETE FROM dept_grants WHERE user_email = ? AND dept = ?").bind(e, d).run();
  }
}
