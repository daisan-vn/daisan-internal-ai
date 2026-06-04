import type { ChatRequest, Env, ToolDef } from "./types";
import { SALES_SYSTEM_PROMPT } from "./prompt";
import { streamSalesAgent } from "./llm";
import { searchProducts } from "./search";
import { findNearestStores } from "./stores";
import { captureLead } from "./lead";

const TOOLS: ToolDef[] = [
  {
    name: "search_products",
    description: "Tìm sản phẩm VLXD trong kho dữ liệu Daisan theo nhu cầu khách. Trả về danh sách sản phẩm (tên, ngành hàng, giá tham khảo nếu có).",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Từ khoá/nhu cầu của khách, vd 'gạch ốp lát 60x60'." } }, required: ["query"] },
  },
  {
    name: "find_nearest_store",
    description: "Tìm cửa hàng/điểm bán Daisan gần khách nhất. Truyền tỉnh/thành (province) khách cung cấp; hoặc lat/lng nếu có định vị. category để ưu tiên cửa hàng có ngành hàng đó.",
    input_schema: { type: "object", properties: { province: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, category: { type: "string" } } },
  },
  {
    name: "capture_lead",
    description: "Ghi nhận thông tin liên hệ của khách để nhân viên gọi lại. Chỉ gọi khi đã có SỐ ĐIỆN THOẠI của khách.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
        productInterest: { type: "string", description: "Sản phẩm/nhu cầu khách quan tâm." },
        storeId: { type: "string", description: "Mã cửa hàng gần nhất (từ find_nearest_store) nếu có." },
        province: { type: "string" }, note: { type: "string" },
      },
      required: ["phone"],
    },
  },
];

function describeTool(name: string): string {
  if (name === "search_products") return "tìm sản phẩm";
  if (name === "find_nearest_store") return "tìm cửa hàng gần bạn";
  if (name === "capture_lead") return "ghi nhận liên hệ";
  return name;
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allow = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
  const allowed = allow.includes("*") ? "*" : allow.includes(origin) ? origin : allow[0] || "";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/api/health") return Response.json({ ok: true, service: "daisan-sales-bot" }, { headers: cors });

    // Chẩn đoán nguồn Shopify: mở thẳng trên trình duyệt để xem products.json trả về gì.
    if (url.pathname === "/api/debug/shopify") {
      const domain = (env.SHOPIFY_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const u = `https://${domain}/products.json?limit=5`;
      try {
        const r = await fetch(u, { headers: { accept: "application/json", "user-agent": "DaisanSalesBot/1.0" } });
        const ct = r.headers.get("content-type") || "";
        const text = await r.text();
        let count = 0; let sample: string | null = null; let parseErr: string | null = null;
        try { const d = JSON.parse(text); count = (d.products || []).length; sample = (d.products || [])[0]?.title ?? null; }
        catch (e) { parseErr = e instanceof Error ? e.message : String(e); }
        return Response.json({ domain, url: u, status: r.status, contentType: ct, count, sample, parseErr, bodyPreview: text.slice(0, 400) }, { headers: cors });
      } catch (e) {
        return Response.json({ domain, url: u, fetchError: e instanceof Error ? e.message : String(e) }, { headers: cors });
      }
    }

    // Chẩn đoán đường dẫn tìm kiếm: nguồn nào (shopify/mock) + vài sản phẩm mẫu.
    if (url.pathname === "/api/debug/search") {
      const q = url.searchParams.get("q") || "gạch";
      const r = await searchProducts(env, q, 6);
      return Response.json({ q, source: r.source, count: r.products.length, names: r.products.map((p) => p.name), sample: r.products[0] }, { headers: cors });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") return handleChat(request, env, cors);
    if (url.pathname === "/api/lead" && request.method === "POST") return handleLead(request, env, cors);

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: ChatRequest;
  try { body = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400, headers: cors }); }
  const messages = body.messages ?? [];
  if (!messages.length) return Response.json({ error: "Thiếu nội dung" }, { status: 400, headers: cors });
  const site = body.site || "daisanstore";

  const runTool = async (name: string, input: Record<string, unknown>): Promise<string> => {
    if (name === "search_products") {
      const r = await searchProducts(env, String(input.query || ""), 60);
      return JSON.stringify({ source: r.source, products: r.products });
    }
    if (name === "find_nearest_store") {
      const stores = await findNearestStores(env, {
        province: input.province ? String(input.province) : undefined,
        lat: typeof input.lat === "number" ? input.lat : undefined,
        lng: typeof input.lng === "number" ? input.lng : undefined,
        category: input.category ? String(input.category) : undefined,
      });
      return JSON.stringify({ stores });
    }
    if (name === "capture_lead") {
      if (!input.phone) return JSON.stringify({ ok: false, error: "Thiếu số điện thoại." });
      const r = await captureLead(env, {
        phone: String(input.phone),
        name: input.name ? String(input.name) : undefined,
        email: input.email ? String(input.email) : undefined,
        productInterest: input.productInterest ? String(input.productInterest) : undefined,
        storeId: input.storeId ? String(input.storeId) : undefined,
        province: input.province ? String(input.province) : undefined,
        note: input.note ? String(input.note) : undefined,
        site,
      });
      return JSON.stringify({ ok: true, ref: r.ref });
    }
    return JSON.stringify({ error: "tool không tồn tại" });
  };

  const system = `${SALES_SYSTEM_PROMPT}\n\n(Khách đang truy cập từ site: ${site}.)`;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        for await (const ev of streamSalesAgent(env, system, messages, TOOLS, runTool, describeTool)) {
          if (ev.type === "text") { send({ text: ev.text }); continue; }
          send({ tool: { name: ev.name, phase: ev.phase, summary: ev.summary } });
          // Đẩy dữ liệu có cấu trúc ra UI để vẽ thẻ sản phẩm / cửa hàng (kiểu Tiki).
          if (ev.phase === "done" && ev.result) {
            try {
              const parsed = JSON.parse(ev.result);
              if (Array.isArray(parsed.products) && parsed.products.length) send({ products: parsed.products });
              if (Array.isArray(parsed.stores) && parsed.stores.length) send({ stores: parsed.stores });
            } catch { /* bỏ qua */ }
          }
        }
        send({ done: true });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "Lỗi không xác định" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...cors, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });
}

async function handleLead(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let b: { phone?: string; name?: string; email?: string; productInterest?: string; province?: string; note?: string; site?: string };
  try { b = await request.json(); } catch { return Response.json({ error: "JSON không hợp lệ" }, { status: 400, headers: cors }); }
  if (!b.phone) return Response.json({ error: "Thiếu số điện thoại" }, { status: 400, headers: cors });
  const r = await captureLead(env, { phone: b.phone, name: b.name, email: b.email, productInterest: b.productInterest, province: b.province, note: b.note, site: b.site });
  return Response.json({ ok: true, ref: r.ref }, { headers: cors });
}
