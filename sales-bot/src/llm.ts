import type { ChatMessage, Env, ToolDef } from "./types";

const ANTHROPIC_DIRECT = "https://api.anthropic.com/v1/messages";

function endpoint(env: Env): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (env.ANTHROPIC_DIRECT?.trim() === "true") return { url: ANTHROPIC_DIRECT, headers };
  return {
    url: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`,
    headers,
  };
}

async function postClaude(env: Env, body: Record<string, unknown>): Promise<Response> {
  const { url, headers } = endpoint(env);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.ok && res.body) return res;
    const retryable = res.status === 429 || res.status === 529 || (res.status >= 500 && res.status < 600);
    const detail = await res.text().catch(() => "");
    if (retryable && attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.min(1500 * 2 ** attempt, 8000)));
      continue;
    }
    if (res.status === 429) throw new Error("Hệ thống đang bận, bạn thử lại sau giây lát nhé.");
    throw new Error(`Claude API lỗi ${res.status}: ${detail}`);
  }
  throw new Error("Claude API lỗi sau nhiều lần thử.");
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; phase: "start" | "done" | "error"; summary: string };

interface Block { type: "text" | "tool_use"; text?: string; id?: string; name?: string; json?: string }

/** Vòng lặp tool-calling cho bot bán hàng: Claude gọi công cụ (tìm SP / cửa hàng /
 *  thu lead), Worker thực thi rồi trả lại, lặp đến khi có câu trả lời cuối. */
export async function* streamSalesAgent(
  env: Env,
  system: string,
  messages: ChatMessage[],
  tools: ToolDef[],
  runTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  describe: (name: string, input: Record<string, unknown>) => string,
  maxRounds = 6,
): AsyncGenerator<AgentEvent> {
  const convo: Array<{ role: string; content: unknown }> = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < maxRounds; round++) {
    const res = await postClaude(env, {
      model: env.DEFAULT_MODEL,
      max_tokens: 1536,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: convo,
      tools,
      stream: true,
    });

    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    const blocks: Record<number, Block> = {};
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
          type?: string; index?: number;
          content_block?: { type?: string; id?: string; name?: string };
          delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
        };
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.type === "content_block_start" && ev.index != null) {
          const cb = ev.content_block || {};
          blocks[ev.index] = cb.type === "tool_use"
            ? { type: "tool_use", id: cb.id, name: cb.name, json: "" }
            : { type: "text", text: "" };
          order.push(ev.index);
        } else if (ev.type === "content_block_delta" && ev.index != null) {
          const b = blocks[ev.index];
          if (!b) continue;
          if (ev.delta?.type === "text_delta" && ev.delta.text) { b.text = (b.text || "") + ev.delta.text; yield { type: "text", text: ev.delta.text }; }
          else if (ev.delta?.type === "input_json_delta") b.json = (b.json || "") + (ev.delta.partial_json || "");
        } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
          stopReason = ev.delta.stop_reason;
        }
      }
    }

    const assistantContent: unknown[] = [];
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    for (const idx of order) {
      const b = blocks[idx];
      if (b.type === "text" && b.text) assistantContent.push({ type: "text", text: b.text });
      else if (b.type === "tool_use" && b.id && b.name) {
        let input: Record<string, unknown> = {};
        try { input = b.json ? JSON.parse(b.json) : {}; } catch { input = {}; }
        assistantContent.push({ type: "tool_use", id: b.id, name: b.name, input });
        toolUses.push({ id: b.id, name: b.name, input });
      }
    }

    if (stopReason !== "tool_use" || toolUses.length === 0) return;

    convo.push({ role: "assistant", content: assistantContent });
    const results: unknown[] = [];
    for (const tu of toolUses) {
      const summary = describe(tu.name, tu.input);
      yield { type: "tool", name: tu.name, phase: "start", summary };
      try {
        const out = await runTool(tu.name, tu.input);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
        yield { type: "tool", name: tu.name, phase: "done", summary };
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `Lỗi: ${err instanceof Error ? err.message : err}`, is_error: true });
        yield { type: "tool", name: tu.name, phase: "error", summary };
      }
    }
    convo.push({ role: "user", content: results });
  }

  // Hết vòng -> ép trả lời gọn, không cấp tool.
  const final = await postClaude(env, {
    model: env.DEFAULT_MODEL, max_tokens: 1024,
    system: [{ type: "text", text: system }],
    messages: [...convo, { role: "user", content: "Hãy chốt lại ngắn gọn và mời khách để lại số điện thoại nếu cần tư vấn thêm." }],
    stream: true,
  });
  const reader = final.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") yield { type: "text", text: ev.delta.text as string };
      } catch { /* ignore */ }
    }
  }
}
