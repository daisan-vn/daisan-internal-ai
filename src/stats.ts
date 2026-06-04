import type { Env } from "./types";
import { ensureFeedbackTable } from "./feedback";

/**
 * Thống kê sử dụng trợ lý — phục vụ trang admin:
 *  - Tổng quan: số câu hỏi, số người dùng, số cuộc trò chuyện, số câu "chưa trả lời được".
 *  - GAP (quan trọng nhất): những câu AI KHÔNG tìm thấy trong tài liệu nội bộ
 *    -> đây chính là danh sách "cần bổ sung tài liệu gì".
 *  - Câu hỏi phổ biến: gộp theo nội dung để biết nhân viên hay hỏi gì.
 *
 * "Chưa trả lời được" nhận diện qua câu mở đầu mà system prompt yêu cầu AI nói khi
 * thiếu thông tin (xem prompt.ts): báo không có trong tài liệu nội bộ.
 */

const DAY = 86400000;

const UNKNOWN_LIKE =
  "(content LIKE '%thông tin này trong tài liệu%' " +
  "OR content LIKE '%chưa tìm thấy thông tin%' " +
  "OR content LIKE '%không tìm thấy thông tin%' " +
  "OR content LIKE '%chưa có thông tin%trong tài liệu%')";

export interface StatsResult {
  stats: { questions: number; conversations: number; users: number; unknown: number; up: number; down: number };
  gaps: Array<{ question: string; user_email: string; created_at: number }>;
  top: Array<{ question: string; count: number; last: number }>;
  disliked: Array<{ question: string; answer: string; user_email: string; created_at: number }>;
}

export async function getStats(env: Env, days: number): Promise<StatsResult> {
  await ensureFeedbackTable(env);
  const since = days > 0 ? Date.now() - days * DAY : 0;
  // since là số do server tính (không phải input người dùng) -> nội suy an toàn.
  const w = (col: string) => (since ? ` AND ${col} >= ${since}` : "");

  const [questions, conversations, users, unknown] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS c FROM messages WHERE role='user'${w("created_at")}`).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM conversations WHERE 1=1${w("created_at")}`).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(DISTINCT user_email) AS c FROM conversations WHERE 1=1${w("created_at")}`).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM messages WHERE role='assistant' AND ${UNKNOWN_LIKE}${w("created_at")}`).first<{ c: number }>(),
  ]);

  // GAP: câu hỏi của user ngay TRƯỚC một câu trả lời "không biết" (cùng cuộc trò chuyện).
  const gapsRes = await env.DB.prepare(
    `SELECT a.created_at AS created_at, c.user_email AS user_email,
            (SELECT u.content FROM messages u
               WHERE u.conversation_id = a.conversation_id AND u.role='user' AND u.created_at <= a.created_at
               ORDER BY u.created_at DESC LIMIT 1) AS question
       FROM messages a JOIN conversations c ON c.id = a.conversation_id
      WHERE a.role='assistant' AND ${UNKNOWN_LIKE}${w("a.created_at")}
      ORDER BY a.created_at DESC LIMIT 100`,
  ).all<{ created_at: number; user_email: string; question: string | null }>();

  const gaps = (gapsRes.results ?? [])
    .filter((g) => g.question)
    .map((g) => ({ question: g.question as string, user_email: g.user_email, created_at: g.created_at }));

  // Câu hỏi phổ biến: gộp theo nội dung chuẩn hóa (bỏ phân biệt hoa/thường + khoảng trắng đầu/cuối).
  const topRes = await env.DB.prepare(
    `SELECT content AS question, COUNT(*) AS count, MAX(created_at) AS last
       FROM messages WHERE role='user'${w("created_at")}
      GROUP BY LOWER(TRIM(content)) ORDER BY count DESC, last DESC LIMIT 30`,
  ).all<{ question: string; count: number; last: number }>();

  // Đếm 👍 / 👎.
  const fb = await env.DB.prepare(
    `SELECT SUM(CASE WHEN value=1 THEN 1 ELSE 0 END) AS up,
            SUM(CASE WHEN value=-1 THEN 1 ELSE 0 END) AS down
       FROM feedback WHERE 1=1${w("created_at")}`,
  ).first<{ up: number | null; down: number | null }>();

  // Danh sách câu trả lời bị 👎 (kèm câu hỏi tương ứng) -> cần xem & cải thiện.
  const dislikedRes = await env.DB.prepare(
    `SELECT f.created_at AS created_at, c.user_email AS user_email,
            substr(a.content, 1, 280) AS answer,
            (SELECT u.content FROM messages u
               WHERE u.conversation_id = a.conversation_id AND u.role='user' AND u.created_at <= a.created_at
               ORDER BY u.created_at DESC LIMIT 1) AS question
       FROM feedback f
       JOIN messages a ON a.id = f.message_id
       JOIN conversations c ON c.id = a.conversation_id
      WHERE f.value = -1${w("f.created_at")}
      ORDER BY f.created_at DESC LIMIT 100`,
  ).all<{ created_at: number; user_email: string; answer: string; question: string | null }>();

  const disliked = (dislikedRes.results ?? []).map((d) => ({
    question: d.question ?? "(không rõ câu hỏi)",
    answer: d.answer ?? "",
    user_email: d.user_email,
    created_at: d.created_at,
  }));

  return {
    stats: {
      questions: questions?.c ?? 0,
      conversations: conversations?.c ?? 0,
      users: users?.c ?? 0,
      unknown: unknown?.c ?? 0,
      up: fb?.up ?? 0,
      down: fb?.down ?? 0,
    },
    gaps,
    top: topRes.results ?? [],
    disliked,
  };
}
