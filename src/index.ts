import type { ChatRequest, Env } from "./types";
import { retrieve, reindexAutorag } from "./rag";
import { streamClaude, streamClaudeAgent } from "./llm";
import { SYSTEM_PROMPT, buildContext, odooSystemNote } from "./prompt";
import { ODOO_TOOLS, runOdooTool, describeOdooTool, odooConfigured, odooDiagnose } from "./odoo";
import { recordAccess, isAdmin, listAccess } from "./access";
import { gdriveConfigured, runSyncWithStatus, readSyncStatus } from "./gdrive";
import { getStats } from "./stats";
import { setFeedback } from "./feedback";
import { blockedDeptsFor, allowedDeptsFor, listGrants, setGrant, odooModelDept, DEPT_LABELS, canAssign } from "./rbac";
import { listProjects, listAssignees, createTask } from "./tasks";
import { listGroups, listRouting, setRouting, deleteRouting, createLead } from "./crm";
import { generateReport, listReports, getReport } from "./reports";
import { runAlerts, getAlertsView } from "./alerts";
import { emailConfigured, sendEmail, alertHtml, alertSubject, alertsHaveIssues, reportHtml } from "./email";
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
      return Response.json({
        email,
        isAdmin: isAdmin(env, email),
        departments: await allowedDeptsFor(env, email),
        canAssign: canAssign(env, email),
      });
    }

    // Giao việc: tùy chọn (dự án + người nhận) và tạo task. Cần quyền giao việc.
    if (path === "/api/assign/options" && request.method === "GET") {
      if (!canAssign(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền giao việc." }, { status: 403 });
      if (!odooConfigured(env)) return Response.json({ error: "Chưa kết nối Odoo." }, { status: 400 });
      const out: { projects: unknown[]; assignees: unknown[]; errors: string[] } = { projects: [], assignees: [], errors: [] };
      try { out.projects = await listProjects(env); } catch (e) { out.errors.push("Dự án: " + (e instanceof Error ? e.message : String(e))); }
      try { out.assignees = await listAssignees(env); } catch (e) { out.errors.push("Người nhận: " + (e instanceof Error ? e.message : String(e))); }
      return Response.json(out);
    }

    // CRM: mọi nhân viên nhập khách hàng -> tạo crm.lead, định tuyến theo nhóm sản phẩm.
    if (path === "/api/crm/groups" && request.method === "GET") {
      if (!odooConfigured(env)) return Response.json({ groups: [] });
      return Response.json({ groups: await listGroups(env) });
    }
    if (path === "/api/crm/lead" && request.method === "POST") {
      if (!odooConfigured(env)) return Response.json({ error: "Chưa kết nối Odoo." }, { status: 400 });
      let b: { customerName?: string; company?: string; contactName?: string; phone?: string; email?: string; group?: string; note?: string };
      try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
      if (!(b.customerName || b.company || b.contactName)) return Response.json({ error: "Nhập tên khách hàng hoặc công ty hoặc người liên hệ." }, { status: 400 });
      try {
        const r = await createLead(env, { ...b, createdBy: hist.userEmail(request) });
        return Response.json({ ok: true, leadId: r.leadId, responsibleName: r.responsibleName, activityWarning: r.activityWarning });
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
      }
    }

    // Quản lý bảng định tuyến CRM (chỉ admin).
    if (path === "/api/admin/crm-routing" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      let salespeople: unknown[] = [];
      try { salespeople = await listAssignees(env); } catch { /* Odoo có thể chưa nối */ }
      return Response.json({ routing: await listRouting(env), salespeople });
    }
    if (path === "/api/admin/crm-routing" && request.method === "POST") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      let b: { group?: string; userId?: number; userName?: string };
      try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
      if (!b.group || !b.userId) return Response.json({ error: "Thiếu nhóm hoặc nhân sự" }, { status: 400 });
      await setRouting(env, b.group, Number(b.userId), b.userName);
      return Response.json({ ok: true });
    }
    if (path === "/api/admin/crm-routing" && request.method === "DELETE") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      const group = url.searchParams.get("group");
      if (!group) return Response.json({ error: "Thiếu group" }, { status: 400 });
      await deleteRouting(env, group);
      return Response.json({ ok: true });
    }
    if (path === "/api/assign" && request.method === "POST") {
      if (!canAssign(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền giao việc." }, { status: 403 });
      let b: { name?: string; description?: string; projectId?: number; assigneeIds?: number[]; deadline?: string };
      try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
      if (!b.name || !b.name.trim()) return Response.json({ error: "Thiếu tiêu đề công việc" }, { status: 400 });
      if (!b.assigneeIds || !b.assigneeIds.length) return Response.json({ error: "Chọn ít nhất một người nhận" }, { status: 400 });
      try {
        const r = await createTask(env, {
          name: b.name.trim(),
          description: b.description,
          projectId: b.projectId,
          assigneeIds: b.assigneeIds,
          deadline: b.deadline,
          withActivity: true,
        });
        return Response.json({ ok: true, taskId: r.taskId, activityWarning: r.activityWarning });
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
      }
    }

    // Phân quyền phòng ban (chỉ admin). GET xem cấu hình, POST cấp/gỡ 1 quyền.
    if (path === "/api/admin/grants") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      }
      if (request.method === "GET") return Response.json(await listGrants(env));
      if (request.method === "POST") {
        let b: { email?: string; dept?: string; on?: boolean };
        try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
        if (!b.email || !b.dept) return Response.json({ error: "Thiếu email/dept" }, { status: 400 });
        await setGrant(env, b.email, b.dept, !!b.on);
        return Response.json({ ok: true });
      }
    }

    // Lịch sử đăng nhập (chỉ quản trị viên). days=0 -> tất cả.
    if (path === "/api/admin/access" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền xem mục này." }, { status: 403 });
      }
      const days = Number(url.searchParams.get("days")) || 0;
      return Response.json(await listAccess(env, days));
    }

    // Thống kê sử dụng (chỉ admin): câu hỏi, người dùng, câu "chưa trả lời được" (gap).
    if (path === "/api/admin/stats" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      }
      const days = Number(url.searchParams.get("days")) || 0;
      return Response.json(await getStats(env, days));
    }

    // Báo cáo tự động (chỉ admin): liệt kê / xem 1 báo cáo / tạo ngay.
    if (path === "/api/admin/reports" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      return Response.json({ reports: await listReports(env) });
    }
    if (path === "/api/admin/reports" && request.method === "POST") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      ctx.waitUntil(generateReport(env, "manual"));
      return Response.json({ started: true });
    }
    const reportMatch = path.match(/^\/api\/admin\/reports\/([A-Za-z0-9-]+)$/);
    if (reportMatch && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      const r = await getReport(env, reportMatch[1]);
      return r ? Response.json(r) : Response.json({ error: "Không tìm thấy" }, { status: 404 });
    }

    // Cảnh báo công nợ quá hạn / tồn kho âm / quỹ chưa đối chiếu (chỉ admin).
    if (path === "/api/admin/alerts" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      return Response.json(await getAlertsView(env));
    }
    if (path === "/api/admin/alerts" && request.method === "POST") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      return Response.json({ result: await runAlerts(env) });
    }

    // Gửi email thử (chỉ admin) để kiểm tra cấu hình Resend.
    if (path === "/api/admin/email-test" && request.method === "POST") {
      if (!isAdmin(env, hist.userEmail(request))) return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      if (!emailConfigured(env)) return Response.json({ ok: false, error: "Chưa cấu hình email (RESEND_API_KEY / EMAIL_FROM / ALERT_EMAIL_TO)." });
      try {
        await sendEmail(env, "✅ Email thử từ Trợ lý AI Daisan", reportHtml("Email thử nghiệm", "Nếu bạn nhận được email này, cấu hình email cảnh báo/báo cáo **đã hoạt động**."));
        return Response.json({ ok: true });
      } catch (e) {
        return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Đồng bộ Google Drive -> kho tài liệu (chỉ admin). GET xem trạng thái, POST chạy.
    if (path === "/api/admin/sync-drive") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      }
      if (request.method === "GET") {
        return Response.json({ configured: gdriveConfigured(env), status: await readSyncStatus(env) });
      }
      if (request.method === "POST") {
        if (!gdriveConfigured(env)) {
          return Response.json(
            { error: "Chưa cấu hình Google Drive (cần GDRIVE_SA_JSON + GDRIVE_FOLDER_ID)." },
            { status: 400 },
          );
        }
        ctx.waitUntil(runSyncWithStatus(env));
        return Response.json({ started: true });
      }
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
      const list = await env.DOCS.list({ limit: 1000, include: ["customMetadata"] } as R2ListOptions);
      return Response.json({
        objects: list.objects.map((o) => ({
          key: o.key,
          size: o.size,
          uploaded: o.uploaded?.getTime?.() ?? 0,
          source: o.customMetadata?.source === "gdrive" ? "drive" : "upload",
        })),
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
      // Kích hoạt AutoRAG index lại để tài liệu mới tìm được sớm (không chặn phản hồi).
      ctx.waitUntil(reindexAutorag(env).then(() => undefined));
      return Response.json({ ok: true, key });
    }

    // Admin: yêu cầu AutoRAG index lại kho tài liệu ngay.
    if (path === "/api/admin/reindex" && request.method === "POST") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      }
      const r = await reindexAutorag(env);
      return Response.json(r, { status: r.ok ? 200 : 400, headers: { "cache-control": "no-store" } });
    }

    // Chẩn đoán kết nối Odoo (chỉ admin). Mở thẳng trên trình duyệt để xem JSON.
    if (path === "/api/admin/odoo-check" && request.method === "GET") {
      if (!isAdmin(env, hist.userEmail(request))) {
        return Response.json({ error: "Bạn không có quyền." }, { status: 403 });
      }
      return Response.json(await odooDiagnose(env), {
        headers: { "cache-control": "no-store" },
      });
    }

    // Phản hồi 👍/👎 cho một câu trả lời (mọi người dùng đã qua Access).
    if (path === "/api/feedback" && request.method === "POST") {
      let b: { messageId?: string; value?: number };
      try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400 }); }
      if (!b.messageId) return Response.json({ error: "Thiếu messageId" }, { status: 400 });
      await setFeedback(env, b.messageId, hist.userEmail(request), Number(b.value) || 0);
      return Response.json({ ok: true });
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }

    // Mọi đường dẫn khác -> file tĩnh (UI chat) trong /public.
    return env.ASSETS.fetch(request);
  },

  // Cron (xem triggers trong wrangler.jsonc):
  //  - "0 1 * * 1" (sáng thứ 2): tạo báo cáo kinh doanh tuần.
  //  - còn lại (hằng ngày): đồng bộ Google Drive -> kho tài liệu.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "0 1 * * 1") {
      // Báo cáo tuần -> gửi email (nếu đã cấu hình).
      ctx.waitUntil(
        generateReport(env, "weekly").then(async (r) => {
          if (emailConfigured(env)) {
            try { await sendEmail(env, r.title, reportHtml(r.title, r.content)); } catch (e) { console.error("Gửi email báo cáo lỗi:", e); }
          }
        }),
      );
    } else if (event.cron === "0 23 * * *") {
      // Cảnh báo hằng ngày -> chỉ gửi email khi CÓ vấn đề (tránh làm phiền).
      ctx.waitUntil(
        runAlerts(env).then(async (result) => {
          if (emailConfigured(env) && alertsHaveIssues(result)) {
            try { await sendEmail(env, alertSubject(result), alertHtml(result)); } catch (e) { console.error("Gửi email cảnh báo lỗi:", e); }
          }
        }),
      );
    } else if (gdriveConfigured(env)) {
      ctx.waitUntil(runSyncWithStatus(env));
    }
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

  // 1) Truy hồi tài liệu nội bộ liên quan (áp dụng phân quyền phòng ban).
  const blocked = await blockedDeptsFor(env, email);
  // Nếu người dùng chọn đúng phòng họ không được phép -> bỏ lựa chọn đó (sẽ bị chặn dưới).
  const domain = body.domain && blocked.includes(body.domain) ? undefined : body.domain;
  const chunks = await retrieve(env, lastUser.content, domain, blocked);
  const context = buildContext(chunks);
  const useOdoo = odooConfigured(env);
  const today = new Date().toISOString().slice(0, 10);
  let system = useOdoo
    ? `${SYSTEM_PROMPT}\n\n${odooSystemNote(today)}\n\n${context}`
    : `${SYSTEM_PROMPT}\n\n${context}`;
  // Phân quyền dữ liệu Odoo sống: báo cho Claude các phòng người dùng không được xem.
  if (useOdoo && blocked.length) {
    const labels = blocked.map((d) => DEPT_LABELS[d] || d).join(", ");
    system += `\n\nPHÂN QUYỀN: Người dùng KHÔNG được phép xem dữ liệu Odoo thuộc phòng: ${labels}. ` +
      `Nếu câu hỏi cần dữ liệu các phòng này (vd account.* = kế toán/công nợ/hóa đơn, purchase.* = mua hàng), ` +
      `hãy TỪ CHỐI lịch sự và đề nghị liên hệ quản trị để được cấp quyền — KHÔNG gọi công cụ cho các model đó.`;
  }

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
            (name, input) => {
              // Chặn cứng theo phân quyền: nếu model thuộc phòng bị chặn -> không cho gọi.
              const dept = odooModelDept(typeof input.model === "string" ? input.model : "");
              if (dept && blocked.includes(dept)) {
                throw new Error(
                  `Bạn không có quyền xem dữ liệu phòng ${DEPT_LABELS[dept] || dept} trong Odoo. Vui lòng liên hệ quản trị để được cấp quyền.`,
                );
              }
              return runOdooTool(env, name, input);
            },
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
        let messageId: string | null = null;
        if (answer) {
          messageId = await hist.addMessageRow(env, convId, "assistant", answer, sources);
          await hist.touchConversation(env, convId);
        }
        send({ done: true, sources, conversationId: convId, messageId });
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
