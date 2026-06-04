import type { Env } from "./types";
import { odooExecute, odooCreate } from "./odoo";

/**
 * Nhập khách hàng -> tạo crm.lead trong Odoo, gán đúng "nhân sự phụ trách nhóm
 * sản phẩm" theo BẢNG ĐỊNH TUYẾN tự lập (D1: crm_routing). Gán user_id để Odoo
 * tự thông báo/email; thêm mail.activity (To-do) nhắc việc.
 */

let ensured = false;
export async function ensureCrmTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS crm_routing (
       group_name TEXT PRIMARY KEY,
       user_id    INTEGER NOT NULL,
       user_name  TEXT,
       created_at INTEGER NOT NULL
     )`,
  ).run();
  ensured = true;
}

export interface Routing { group_name: string; user_id: number; user_name: string | null }

export async function listRouting(env: Env): Promise<Routing[]> {
  await ensureCrmTable(env);
  const { results } = await env.DB.prepare(
    "SELECT group_name, user_id, user_name FROM crm_routing ORDER BY group_name",
  ).all<Routing>();
  return results ?? [];
}

export async function setRouting(env: Env, group: string, userId: number, userName?: string): Promise<void> {
  await ensureCrmTable(env);
  const g = (group || "").trim();
  if (!g || !userId) return;
  await env.DB.prepare(
    `INSERT INTO crm_routing (group_name, user_id, user_name, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(group_name) DO UPDATE SET user_id = excluded.user_id, user_name = excluded.user_name`,
  ).bind(g, Number(userId), userName || null, Date.now()).run();
}

export async function deleteRouting(env: Env, group: string): Promise<void> {
  await ensureCrmTable(env);
  await env.DB.prepare("DELETE FROM crm_routing WHERE group_name = ?").bind((group || "").trim()).run();
}

async function getResponsible(env: Env, group: string): Promise<{ user_id: number; user_name: string | null } | null> {
  await ensureCrmTable(env);
  return env.DB.prepare("SELECT user_id, user_name FROM crm_routing WHERE group_name = ?")
    .bind((group || "").trim())
    .first<{ user_id: number; user_name: string | null }>();
}

export async function listGroups(env: Env): Promise<string[]> {
  return (await listRouting(env)).map((r) => r.group_name);
}

export interface LeadInput {
  customerName?: string;
  company?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  group?: string;
  note?: string;
  createdBy?: string;
}

export async function createLead(env: Env, input: LeadInput): Promise<{ leadId: number; responsibleName: string | null; activityWarning?: string }> {
  const responsible = input.group ? await getResponsible(env, input.group) : null;

  const title = (input.customerName || input.company || input.contactName || "Khách hàng mới")
    + (input.group ? ` (${input.group})` : "");
  const vals: Record<string, unknown> = { name: title, type: "opportunity" };
  if (input.contactName) vals.contact_name = input.contactName;
  if (input.company) vals.partner_name = input.company;
  if (input.email) vals.email_from = input.email;
  if (input.phone) vals.phone = input.phone;
  if (responsible?.user_id) vals.user_id = responsible.user_id;

  const desc: string[] = [];
  if (input.group) desc.push("Nhóm sản phẩm: " + input.group);
  if (input.customerName) desc.push("Khách hàng: " + input.customerName);
  if (input.note) desc.push("Nhu cầu: " + input.note);
  if (input.createdBy) desc.push("Người nhập: " + input.createdBy);
  if (desc.length) vals.description = desc.join("\n");

  const leadId = await odooCreate(env, "crm.lead", vals);

  let activityWarning: string | undefined;
  if (responsible?.user_id) {
    try {
      await scheduleLeadActivity(env, leadId, responsible.user_id, title);
    } catch (e) {
      activityWarning = e instanceof Error ? e.message : String(e);
    }
  }
  return { leadId, responsibleName: responsible?.user_name ?? null, activityWarning };
}

async function scheduleLeadActivity(env: Env, leadId: number, userId: number, summary: string): Promise<void> {
  const models = (await odooExecute(env, "ir.model", "search_read", [[["model", "=", "crm.lead"]]], { fields: ["id"], limit: 1 })) as Array<{ id: number }>;
  const resModelId = models[0]?.id;
  if (!resModelId) throw new Error("Không tìm thấy model crm.lead.");
  const xml = (await odooExecute(env, "ir.model.data", "search_read", [[["module", "=", "mail"], ["name", "=", "mail_activity_data_todo"]]], { fields: ["res_id"], limit: 1 })) as Array<{ res_id: number }>;
  const vals: Record<string, unknown> = {
    res_model_id: resModelId,
    res_id: leadId,
    user_id: userId,
    summary: "Khách hàng mới: " + summary,
    date_deadline: new Date().toISOString().slice(0, 10),
  };
  if (xml[0]?.res_id) vals.activity_type_id = xml[0].res_id;
  await odooCreate(env, "mail.activity", vals);
}
