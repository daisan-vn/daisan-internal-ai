import type { Env } from "./types";
import { odooExecute, odooCreate } from "./odoo";

/**
 * Giao việc -> tạo project.task trong Odoo (GHI có kiểm soát). Gán người phụ trách
 * (user_ids) để Odoo tự thông báo/email; tùy chọn tạo thêm mail.activity (To-do)
 * có hạn để nhắc việc mạnh hơn.
 */

export interface IdName { id: number; name: string }

export async function listProjects(env: Env): Promise<IdName[]> {
  return (await odooExecute(env, "project.project", "search_read", [[]], {
    fields: ["id", "name"], limit: 300, order: "name",
  })) as IdName[];
}

export async function listAssignees(env: Env): Promise<IdName[]> {
  return (await odooExecute(env, "res.users", "search_read", [[["share", "=", false], ["active", "=", true]]], {
    fields: ["id", "name"], limit: 500, order: "name",
  })) as IdName[];
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  projectId?: number;
  assigneeIds: number[];
  deadline?: string; // 'YYYY-MM-DD'
  withActivity?: boolean;
}

export async function createTask(env: Env, input: CreateTaskInput): Promise<{ taskId: number; activityWarning?: string }> {
  const vals: Record<string, unknown> = { name: input.name };
  if (input.description) vals.description = input.description;
  if (input.projectId) vals.project_id = Number(input.projectId);
  if (input.assigneeIds && input.assigneeIds.length) vals.user_ids = [[6, 0, input.assigneeIds.map(Number)]];
  if (input.deadline) vals.date_deadline = input.deadline;

  const taskId = await odooCreate(env, "project.task", vals);

  let activityWarning: string | undefined;
  if (input.withActivity && input.assigneeIds && input.assigneeIds.length) {
    try {
      await scheduleActivities(env, taskId, input.assigneeIds.map(Number), input.deadline, input.name);
    } catch (e) {
      activityWarning = e instanceof Error ? e.message : String(e);
    }
  }
  return { taskId, activityWarning };
}

/** Tạo "Hoạt động" (To-do) cho từng người được giao, có hạn chót. */
async function scheduleActivities(env: Env, taskId: number, userIds: number[], deadline: string | undefined, summary: string): Promise<void> {
  const models = (await odooExecute(env, "ir.model", "search_read", [[["model", "=", "project.task"]]], { fields: ["id"], limit: 1 })) as Array<{ id: number }>;
  const resModelId = models[0]?.id;
  if (!resModelId) throw new Error("Không tìm thấy model project.task.");

  // Loại hoạt động "To-Do" chuẩn của Odoo (xmlid mail.mail_activity_data_todo).
  const xml = (await odooExecute(env, "ir.model.data", "search_read", [[["module", "=", "mail"], ["name", "=", "mail_activity_data_todo"]]], { fields: ["res_id"], limit: 1 })) as Array<{ res_id: number }>;
  const todoTypeId = xml[0]?.res_id;
  const due = deadline || new Date().toISOString().slice(0, 10);

  for (const uid of userIds) {
    const vals: Record<string, unknown> = {
      res_model_id: resModelId,
      res_id: taskId,
      user_id: uid,
      summary: `Giao việc: ${summary}`,
      date_deadline: due,
    };
    if (todoTypeId) vals.activity_type_id = todoTypeId;
    await odooCreate(env, "mail.activity", vals);
  }
}
