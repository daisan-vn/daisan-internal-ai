import type { ChatMessage, Env, ToolDef } from "./types";

const ANTHROPIC_DIRECT = "https://api.anthropic.com/v1/messages";

/**
 * Chọn endpoint gọi Claude.
 *  - MẶC ĐỊNH: qua AI Gateway daisan-gw. Gọi THẲNG Anthropic từ edge Cloudflare
 *    bị chặn 403 "Request not allowed", nên production buộc đi qua gateway.
 *  - LOCAL DEV: đặt ANTHROPIC_DIRECT=true trong .dev.vars để gọi thẳng Anthropic
 *    (IP máy dev được Anthropic cho phép) — tiện test khi chưa dựng gateway.
 *  - AI_GATEWAY_TOKEN: thêm vào khi daisan-gw bật Authenticated Gateway.
 */
function resolveEndpoint(env: Env): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (env.ANTHROPIC_DIRECT?.trim() === "true") {
    return { url: ANTHROPIC_DIRECT, headers };
  }
  if (env.AI_GATEWAY_TOKEN) {
    headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
  }
  return {
    url: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`,
    headers,
  };
}

/**
 * POST tới Claude (qua AI Gateway) và TỰ THỬ LẠI khi bị giới hạn tốc độ (429)
 * hoặc quá tải tạm thời (529/5xx) — với backoff lũy thừa, tôn trọng Retry-After.
 *
 * Mỗi câu hỏi có thể gọi Claude nhiều lượt (vòng lặp tool Odoo) nên rất dễ chạm
 * trần phút của Anthropic; thử lại nhẹ nhàng giúp nhân viên không bị "đứng" giữa chừng.
 */
async function postClaude(env: Env, body: Record<string, unknown>): Promise<Response> {
  const { url, headers } = resolveEndpoint(env);
  const MAX_ATTEMPTS = 4;
  let lastStatus = 0;
  let lastDetail = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.ok && res.body) return res;

    lastStatus = res.status;
    lastDetail = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status === 529 || (res.status >= 500 && res.status < 600);
    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1500 * 2 ** attempt, 8000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    break;
  }

  if (lastStatus === 429) {
    throw new Error(
      "Hệ thống đang có nhiều câu hỏi cùng lúc nên tạm thời quá tải (giới hạn tốc độ). " +
        "Bạn vui lòng đợi khoảng 30 giây rồi hỏi lại nhé.",
    );
  }
  throw new Error(`Claude API lỗi ${lastStatus}: ${lastDetail}`);
}

/**
 * Gọi Claude (Anthropic Messages API) ở chế độ streaming qua AI Gateway,
 * trả về async generator các đoạn text để Worker đẩy SSE về client.
 */
export async function* streamClaude(
  env: Env,
  system: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const res = await postClaude(env, {
    model: env.DEFAULT_MODEL,
    max_tokens: 1024,
    system,
    messages,
    stream: true,
  });

  // Đọc SSE của Anthropic, bóc các content_block_delta -> text.
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const event = JSON.parse(payload);
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text as string;
        }
      } catch {
        // bỏ qua dòng không phải JSON (event:, ping...)
      }
    }
  }
}

/* ------------------------- Vòng lặp tool-calling (agentic) ------------------------- */

/** Sự kiện trả về từ vòng lặp agent để Worker đẩy SSE về client. */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; phase: "start" | "done" | "error"; summary: string };

interface StreamBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  json?: string;
}

/**
 * Gọi Claude với công cụ (tools) và CHẠY VÒNG LẶP: Claude có thể yêu cầu gọi tool
 * (vd truy vấn Odoo), Worker thực thi rồi trả kết quả lại cho Claude, lặp đến khi
 * Claude đưa ra câu trả lời cuối. Văn bản được stream ngay khi có; mỗi lần gọi tool
 * phát ra sự kiện trạng thái để UI hiển thị "đang tra cứu…".
 *
 * runTool: nhận (name, input) -> trả chuỗi nội dung tool_result.
 * describe: mô tả ngắn truy vấn để hiển thị cho người dùng.
 */
export async function* streamClaudeAgent(
  env: Env,
  system: string,
  messages: ChatMessage[],
  tools: ToolDef[],
  runTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  describe: (name: string, input: Record<string, unknown>) => string,
  maxRounds = 8,
): AsyncGenerator<AgentEvent> {
  // Bản làm việc của hội thoại theo định dạng block của Anthropic.
  const convo: Array<{ role: string; content: unknown }> = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let round = 0; round < maxRounds; round++) {
    const res = await postClaude(env, {
      model: env.DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: convo,
      tools,
      stream: true,
    });

    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    const blocks: Record<number, StreamBlock> = {};
    const order: number[] = [];
    let stopReason = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        let ev: {
          type?: string;
          index?: number;
          content_block?: { type?: string; id?: string; name?: string };
          delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
        };
        try {
          ev = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (ev.type === "content_block_start" && ev.index != null) {
          const cb = ev.content_block || {};
          blocks[ev.index] =
            cb.type === "tool_use"
              ? { type: "tool_use", id: cb.id, name: cb.name, json: "" }
              : { type: "text", text: "" };
          order.push(ev.index);
        } else if (ev.type === "content_block_delta" && ev.index != null) {
          const b = blocks[ev.index];
          if (!b) continue;
          if (ev.delta?.type === "text_delta" && ev.delta.text) {
            b.text = (b.text || "") + ev.delta.text;
            yield { type: "text", text: ev.delta.text };
          } else if (ev.delta?.type === "input_json_delta") {
            b.json = (b.json || "") + (ev.delta.partial_json || "");
          }
        } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
          stopReason = ev.delta.stop_reason;
        }
      }
    }

    // Dựng nội dung lượt assistant + gom các tool_use.
    const assistantContent: unknown[] = [];
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    for (const idx of order) {
      const b = blocks[idx];
      if (b.type === "text" && b.text) {
        assistantContent.push({ type: "text", text: b.text });
      } else if (b.type === "tool_use" && b.id && b.name) {
        let input: Record<string, unknown> = {};
        try {
          input = b.json ? JSON.parse(b.json) : {};
        } catch {
          input = {};
        }
        assistantContent.push({ type: "tool_use", id: b.id, name: b.name, input });
        toolUses.push({ id: b.id, name: b.name, input });
      }
    }

    // Không còn yêu cầu tool -> câu trả lời cuối đã stream xong.
    if (stopReason !== "tool_use" || toolUses.length === 0) return;

    convo.push({ role: "assistant", content: assistantContent });

    // Thực thi từng tool, trả tool_result lại cho Claude.
    const results: unknown[] = [];
    for (const tu of toolUses) {
      const summary = describe(tu.name, tu.input);
      yield { type: "tool", name: tu.name, phase: "start", summary };
      try {
        const out = await runTool(tu.name, tu.input);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
        yield { type: "tool", name: tu.name, phase: "done", summary };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "lỗi không xác định";
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `Lỗi: ${msg}`, is_error: true });
        yield { type: "tool", name: tu.name, phase: "error", summary: msg };
      }
    }
    convo.push({ role: "user", content: results });
  }

  // Hết số vòng mà Claude vẫn muốn gọi tool -> KHÔNG cấp tool nữa, ép tổng hợp
  // câu trả lời từ dữ liệu đã thu thập (tránh dừng cụt, vẫn cho ra kết quả hữu ích).
  const finalRes = await postClaude(env, {
    model: env.DEFAULT_MODEL,
    max_tokens: 2048,
    system: `${system}\n\nĐÃ ĐỦ BƯỚC TRA CỨU. Hãy TỔNG HỢP và TRẢ LỜI NGAY dựa trên dữ liệu đã lấy ở trên; KHÔNG gọi thêm công cụ. Nếu dữ liệu chưa đủ để kết luận chắc chắn, nói rõ phần nào còn thiếu và gợi ý người dùng thu hẹp câu hỏi.`,
    messages: convo,
    stream: true,
  });
  const finalReader = finalRes.body!.pipeThrough(new TextDecoderStream()).getReader();
  let finalBuf = "";
  while (true) {
    const { value, done } = await finalReader.read();
    if (done) break;
    finalBuf += value;
    let nl: number;
    while ((nl = finalBuf.indexOf("\n")) !== -1) {
      const line = finalBuf.slice(0, nl).trim();
      finalBuf = finalBuf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          yield { type: "text", text: ev.delta.text as string };
        }
      } catch {
        // bỏ qua dòng không phải JSON
      }
    }
  }
}
