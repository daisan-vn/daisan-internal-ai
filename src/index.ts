import type { ChatRequest, Env } from "./types";
import { retrieve } from "./rag";
import { streamClaude } from "./llm";
import { SYSTEM_PROMPT, buildContext } from "./prompt";
import * as hist from "./history";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") {
      return Response.json({ ok: true, service: "daisan-internal-ai" });
    }

    // Email người dùng hiện tại (từ Cloudflare Access) — để UI hiển thị.
    if (path === "/api/me") {
      return Response.json({ email: hist.userEmail(request) });
    }

    // Danh sách hội thoại của riêng người dùng.
    if (path === "/api/conversations" && request.method === "GET") {
      const rows = await hist.listConversations(env, hist.userEmail(request));
      return Response.json({ conversations: rows });
    }

    // Thao tác trên 1 hội thoại: lấy nội dung / xóa (luôn theo đúng user).
    const convMatch = path.match(/^\/api\/conversations\/([A-Za-z0-9-]+)$/);
    if (convMatch) {
      const id = convMatch[1];
      const email = hist.userEmail(request);
      if (request.method === "GET") {
        const conv = await hist.getConversation(env, email, id);
        return conv
          ? Response.json(conv)
          : Response.json({ error: "Không tìm thấy cuộc trò chuyện" }, { status: 404 });
      }
      if (request.method === "DELETE") {
        const ok = await hist.deleteConversation(env, email, id);
        return Response.json({ ok }, { status: ok ? 200 : 404 });
      }
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    // Mọi đường dẫn khác -> file tĩnh (UI chat) trong /public.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json({ error: "Thiếu câu hỏi của người dùng" }, { status: 400 });
  }

  const email = hist.userEmail(request);

  // Đảm bảo có conversation hợp lệ thuộc về user; chưa có thì tạo mới (tiêu đề từ câu hỏi đầu).
  let conversationId = body.conversationId;
  if (!conversationId || !(await hist.ownsConversation(env, email, conversationId))) {
    conversationId = await hist.createConversation(env, email, lastUser.content);
  }
  await hist.addMessageRow(env, conversationId, "user", lastUser.content);

  // 1) Truy hồi tài liệu nội bộ liên quan.
  const chunks = await retrieve(env, lastUser.content, body.domain);
  const context = buildContext(chunks);
  const system = `${SYSTEM_PROMPT}\n\n${context}`;

  // 2) Sinh câu trả lời bằng Claude, stream về client; lưu lại khi xong.
  const sources = [...new Set(chunks.map((c) => c.filename))];
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let answer = "";
      try {
        for await (const text of streamClaude(env, system, messages)) {
          answer += text;
          send({ text });
        }
        if (answer) {
          await hist.addMessageRow(env, convId, "assistant", answer, sources);
          await hist.touchConversation(env, convId);
        }
        send({ done: true, sources, conversationId: convId });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "Lỗi không xác định" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
