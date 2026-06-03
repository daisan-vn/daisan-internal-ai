import type { ChatRequest, Env } from "./types";
import { retrieve } from "./rag";
import { streamClaude, streamClaudeAgent } from "./llm";
import { SYSTEM_PROMPT, buildContext, odooSystemNote } from "./prompt";
import { ODOO_TOOLS, runOdooTool, describeOdooTool, odooConfigured } from "./odoo";
import { recordAccess, isAdmin, listAccess } from "./access";
import * as hist from "./history";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") {
      return Response.json({ ok: true, service: "daisan-internal-ai" });
    }

    // Email người dùng hiện tại (từ Cloudflare Access) — để UI hiển thị.
    // Đồng thời ghi nhận một lần đăng nhập/truy cập (không chặn response).
    if (path === "/api/me") {
      const email = hist.userEmail(request);
      ctx.waitUntil(recordAccess(env, request));
      return Response.json({ email, isAdmin: isAdmin(env, email) });
    }

    // Lịch sử đăng nhập (chỉ quản trị viên). days=0 -> tất cả.
    if (path === "/api/admin/access" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền xem mục này." }, { status: 403 });
      }
      const days = Number(url.searchParams.get("days")) || 0;
      return Response.json(await listAccess(env, days));
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
      if (request.method === "PATCH") {
        let b: { title?: string };
        try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
        const ok = await hist.renameConversation(env, email, id, (b.title || "").trim());
        return Response.json({ ok }, { status: ok ? 200 : 404 });
      }
    }

    // --- Admin: quản trị tài liệu trong R2 (sau Access; có thể siết theo role sau) ---
    if (path === "/api/admin/docs" && request.method === "GET") {
      const list = await env.DOCS.list({ limit: 1000 });
      return Response.json({
        objects: list.objects.map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded?.getTime?.() ?? 0 })),
      });
    }
    if (path === "/api/admin/docs" && request.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return Response.json({ error: "Thiếu key" }, { status: 400 });
      await env.DOCS.delete(key);
      return Response.json({ ok: true });
    }
    if (path === "/api/admin/upload" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file") as unknown as
        | { name?: string; type?: string; arrayBuffer: () => Promise<ArrayBuffer> }
        | null;
      if (!file || typeof file.arrayBuffer !== "function" || !file.name) {
        return Response.json({ error: "Thiếu file" }, { status: 400 });
      }
      const VALID = ["ketoan", "sop", "crm", "mua", "kho", "odoo"];
      let folder = (form.get("folder") || "").toString().trim().toLowerCase();
      if (!VALID.includes(folder)) folder = "khac";
      const safe = file.name.replace(/[\\/]+/g, "_").replace(/\s+/g, "_");
      const key = `${folder}/${safe}`;
      await env.DOCS.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
        customMetadata: { uploadedBy: hist.userEmail(request) },
      });
      return Response.json({ ok: true, key });
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }

    // Mọi đường dẫn khác -> file tĩnh (UI chat) trong /public.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  ctx.waitUntil(recordAccess(env, request));

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
  const useOdoo = odooConfigured(env);
  const today = new Date().toISOString().slice(0, 10);
  const system = useOdoo
    ? `${SYSTEM_PROMPT}\n\n${odooSystemNote(today)}\n\n${context}`
    : `${SYSTEM_PROMPT}\n\n${context}`;

  // 2) Sinh câu trả lời bằng Claude, stream về client; lưu lại khi xong.
  //    Nếu đã nối Odoo -> dùng vòng lặp tool-calling để Claude tra cứu dữ liệu sống.
  const docSources = [...new Set(chunks.map((c) => c.filename))];
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let answer = "";
      let usedOdoo = false;
      try {
        if (useOdoo) {
          for await (const ev of streamClaudeAgent(
            env,
            system,
            messages,
            ODOO_TOOLS,
            (name, input) => runOdooTool(env, name, input),
            describeOdooTool,
          )) {
            if (ev.type === "text") {
              answer += ev.text;
              send({ text: ev.text });
            } else {
              if (ev.phase === "start") usedOdoo = true;
              send({ tool: { name: ev.name, phase: ev.phase, summary: ev.summary } });
            }
          }
        } else {
          for await (const text of streamClaude(env, system, messages)) {
            answer += text;
            send({ text });
          }
        }
        const sources = usedOdoo ? [...docSources, "Odoo (dữ liệu trực tiếp)"] : docSources;
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
