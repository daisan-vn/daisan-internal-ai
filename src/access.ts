import type { Env } from "./types";
import { userEmail } from "./history";

/**
 * Theo dõi lịch sử đăng nhập của nhân viên/quản lý.
 *
 * troly.daisan.ai nằm sau Cloudflare Access nên mỗi request đã xác thực đều kèm
 * email người dùng + IP + quốc gia. Ta gộp các request gần nhau của một người
 * thành "phiên" (session): phiên mới được tính khi không hoạt động > 30 phút.
 * Bảng `access_sessions` lưu: email, IP, quốc gia, thiết bị (user-agent),
 * thời điểm bắt đầu, hoạt động cuối, số thao tác.
 */

const SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 phút không hoạt động -> phiên mới
const ONLINE_MS = 5 * 60 * 1000; // coi là "đang hoạt động" nếu hoạt động < 5 phút
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccessSession {
  id: string;
  user_email: string;
  ip: string | null;
  country: string | null;
  user_agent: string | null;
  started_at: number;
  last_seen_at: number;
  hits: number;
}

interface ClientInfo {
  email: string;
  ip: string;
  country: string;
  ua: string;
}

function clientInfo(request: Request): ClientInfo {
  return {
    email: userEmail(request), // header Cf-Access-Authenticated-User-Email (fallback dev@local)
    ip: request.headers.get("CF-Connecting-IP") || "",
    country: request.headers.get("CF-IPCountry") || "",
    ua: request.headers.get("User-Agent") || "",
  };
}

/** Danh sách email được phép xem trang quản trị (lịch sử đăng nhập). */
function adminList(env: Env): string[] {
  return (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Email này có quyền quản trị không? Chưa cấu hình ADMIN_EMAILS -> cho phép tất cả (giữ hành vi cũ). */
export function isAdmin(env: Env, email: string): boolean {
  const list = adminList(env);
  if (!list.length) return true;
  return list.includes((email || "").toLowerCase());
}

/**
 * Ghi nhận một lần truy cập. Gộp vào phiên gần nhất nếu còn trong cửa sổ 30 phút,
 * ngược lại mở phiên mới. Gọi qua ctx.waitUntil để không làm chậm response.
 */
export async function recordAccess(env: Env, request: Request): Promise<void> {
  const { email, ip, country, ua } = clientInfo(request);
  if (!email) return;
  const now = Date.now();
  try {
    const last = await env.DB.prepare(
      "SELECT id, last_seen_at FROM access_sessions WHERE user_email = ? ORDER BY last_seen_at DESC LIMIT 1",
    )
      .bind(email)
      .first<{ id: string; last_seen_at: number }>();

    if (last && now - last.last_seen_at < SESSION_WINDOW_MS) {
      await env.DB.prepare(
        "UPDATE access_sessions SET last_seen_at = ?, hits = hits + 1 WHERE id = ?",
      )
        .bind(now, last.id)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO access_sessions (id, user_email, ip, country, user_agent, started_at, last_seen_at, hits) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      )
        .bind(crypto.randomUUID(), email, ip, country, ua, now, now)
        .run();
    }
  } catch {
    // Logging không được phép làm hỏng request chính.
  }
}

export interface AccessStats {
  users: number;
  online: number;
  today: number;
  total: number;
}

/** Lấy danh sách phiên (trong N ngày, 0 = tất cả) + thống kê tổng quan. */
export async function listAccess(
  env: Env,
  days: number,
): Promise<{ sessions: AccessSession[]; stats: AccessStats }> {
  const now = Date.now();
  const listSql =
    days > 0
      ? "SELECT * FROM access_sessions WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 500"
      : "SELECT * FROM access_sessions ORDER BY last_seen_at DESC LIMIT 500";
  const listStmt =
    days > 0 ? env.DB.prepare(listSql).bind(now - days * DAY_MS) : env.DB.prepare(listSql);

  const [list, total, users, online, today] = await Promise.all([
    listStmt.all<AccessSession>(),
    env.DB.prepare("SELECT COUNT(*) AS c FROM access_sessions").first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(DISTINCT user_email) AS c FROM access_sessions").first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS c FROM access_sessions WHERE last_seen_at >= ?")
      .bind(now - ONLINE_MS)
      .first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS c FROM access_sessions WHERE started_at >= ?")
      .bind(now - DAY_MS)
      .first<{ c: number }>(),
  ]);

  return {
    sessions: list.results ?? [],
    stats: {
      total: total?.c ?? 0,
      users: users?.c ?? 0,
      online: online?.c ?? 0,
      today: today?.c ?? 0,
    },
  };
}
