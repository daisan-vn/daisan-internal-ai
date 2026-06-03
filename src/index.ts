import type { ChatRequest, Env } from "./types";
import { retrieve } from "./rag";
import { streamClaude } from "./llm";
import { SYSTEM_PROMPT, buildContext } from "./prompt";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "daisan-internal-ai" });
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

  // 1) Truy hồi tài liệu nội bộ liên quan.
  const chunks = await retrieve(env, lastUser.content, body.domain);
  const context = buildContext(chunks);
  const system = `${SYSTEM_PROMPT}\n\n${context}`;

  // 2) Sinh câu trả lời bằng Claude, stream về client kèm danh sách nguồn.
  const sources = [...new Set(chunks.map((c) => c.filename))];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const text of streamClaude(env, system, messages)) {
          send({ text });
        }
        send({ done: true, sources });
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
