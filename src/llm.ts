import type { ChatMessage, Env } from "./types";

/** Endpoint Claude qua AI Gateway daisan-gw (billing/analytics gộp một chỗ). */
function gatewayUrl(env: Env): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`;
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
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (env.AI_GATEWAY_TOKEN) {
    headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
  }

  const res = await fetch(gatewayUrl(env), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: env.DEFAULT_MODEL,
      max_tokens: 1024,
      system,
      messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API lỗi ${res.status}: ${detail}`);
  }

  // Đọc SSE của Anthropic, bóc các content_block_delta -> text.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
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
