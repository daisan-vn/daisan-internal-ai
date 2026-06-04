import type { Env } from "./types";

/**
 * Lịch sử chat theo từng người. Danh tính lấy từ header Cloudflare Access đặt
 * sau khi xác thực (worker chỉ truy cập được qua troly.daisan.ai sau Access nên
 * header này tin cậy được). Local dev không có Access -> fallback dev@local.
 */
export function userEmail(request: Request): string {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  return (email || "dev@local").toLowerCase();
}

export interface ConvRow {
  id: string;
  title: string;
  updated_at: number;
}

export async function listConversations(env: Env, email: string): Promise<ConvRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, title, updated_at FROM conversations WHERE user_email = ? ORDER BY updated_at DESC LIMIT 100",
  ).bind(email).all<ConvRow>();
  return results ?? [];
}

export async function getConversation(env: Env, email: string, id: string) {
  const conv = await env.DB.prepare(
    "SELECT id, title FROM conversations WHERE id = ? AND user_email = ?",
  ).bind(id, email).first<{ id: string; title: string }>();
  if (!conv) return null;

  // LEFT JOIN feedback để khôi phục trạng thái 👍/👎 khi mở lại hội thoại cũ.
  // (Bảng feedback tạo lazy nên có thể chưa tồn tại -> bọc try/catch, fallback không có feedback.)
  let results: Array<{ id: string; role: string; content: string; sources: string | null; feedback: number | null }> = [];
  try {
    const r = await env.DB.prepare(
      "SELECT m.id, m.role, m.content, m.sources, f.value AS feedback FROM messages m " +
        "LEFT JOIN feedback f ON f.message_id = m.id WHERE m.conversation_id = ? ORDER BY m.created_at",
    ).bind(id).all<{ id: string; role: string; content: string; sources: string | null; feedback: number | null }>();
    results = r.results ?? [];
  } catch {
    const r = await env.DB.prepare(
      "SELECT id, role, content, sources, NULL AS feedback FROM messages WHERE conversation_id = ? ORDER BY created_at",
    ).bind(id).all<{ id: string; role: string; content: string; sources: string | null; feedback: number | null }>();
    results = r.results ?? [];
  }

  const messages = results.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    sources: m.sources ? (JSON.parse(m.sources) as string[]) : [],
    feedback: m.feedback ?? 0,
  }));
  return { id: conv.id, title: conv.title, messages };
}

export async function ownsConversation(env: Env, email: string, id: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS x FROM conversations WHERE id = ? AND user_email = ?",
  ).bind(id, email).first();
  return !!row;
}

export async function createConversation(env: Env, email: string, firstMessage: string): Promise<string> {
  const id = crypto.randomUUID();
  const ts = Date.now();
  const title = (firstMessage.trim().slice(0, 80) || "Cuộc trò chuyện mới").replace(/\s+/g, " ");
  await env.DB.prepare(
    "INSERT INTO conversations (id, user_email, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, email, title, ts, ts).run();
  return id;
}

/** Lưu một message, trả về id của message (dùng để gắn phản hồi 👍/👎). */
export async function addMessageRow(
  env: Env,
  conversationId: string,
  role: string,
  content: string,
  sources?: string[],
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(
    id,
    conversationId,
    role,
    content,
    sources && sources.length ? JSON.stringify(sources) : null,
    Date.now(),
  ).run();
  return id;
}

export async function renameConversation(env: Env, email: string, id: string, title: string): Promise<boolean> {
  if (!title) return false;
  const res = await env.DB.prepare(
    "UPDATE conversations SET title = ? WHERE id = ? AND user_email = ?",
  ).bind(title.slice(0, 80), id, email).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function touchConversation(env: Env, id: string): Promise<void> {
  await env.DB.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").bind(Date.now(), id).run();
}

export async function deleteConversation(env: Env, email: string, id: string): Promise<boolean> {
  const res = await env.DB.prepare(
    "DELETE FROM conversations WHERE id = ? AND user_email = ?",
  ).bind(id, email).run();
  const changed = (res.meta?.changes ?? 0) > 0;
  if (changed) {
    await env.DB.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id).run();
  }
  return changed;
}
