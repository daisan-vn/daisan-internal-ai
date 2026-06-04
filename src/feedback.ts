import type { Env } from "./types";

/**
 * Phản hồi 👍/👎 của nhân viên cho từng câu trả lời.
 * Bảng `feedback` được tạo lazy (CREATE TABLE IF NOT EXISTS) để không cần chạy
 * migration tay trên DB đang chạy. 1 dòng / message_id (bấm lại để đổi/bỏ vote).
 */

let ensured = false;

export async function ensureFeedbackTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS feedback (
       message_id      TEXT PRIMARY KEY,
       conversation_id TEXT,
       user_email      TEXT,
       value           INTEGER NOT NULL,
       created_at      INTEGER NOT NULL
     )`,
  ).run();
  ensured = true;
}

/** Đặt phản hồi cho một câu trả lời. value=1 (👍), -1 (👎), 0/khác -> gỡ phản hồi. */
export async function setFeedback(
  env: Env,
  messageId: string,
  email: string,
  value: number,
): Promise<void> {
  await ensureFeedbackTable(env);

  if (value !== 1 && value !== -1) {
    await env.DB.prepare("DELETE FROM feedback WHERE message_id = ?").bind(messageId).run();
    return;
  }

  const row = await env.DB.prepare("SELECT conversation_id FROM messages WHERE id = ?")
    .bind(messageId)
    .first<{ conversation_id: string }>();

  await env.DB.prepare(
    `INSERT INTO feedback (message_id, conversation_id, user_email, value, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET value = excluded.value, created_at = excluded.created_at`,
  ).bind(messageId, row?.conversation_id ?? null, email, value, Date.now()).run();
}
