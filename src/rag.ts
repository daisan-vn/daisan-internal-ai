import type { Env, RetrievedChunk } from "./types";

/**
 * Truy hồi tài liệu từ AutoRAG (AI Search) qua binding Workers AI.
 * Dùng `.search()` (chỉ retrieval) — phần sinh câu trả lời để Claude đảm nhiệm
 * qua AI Gateway, nhằm dùng chất lượng tiếng Việt + suy luận tốt nhất.
 *
 * Docs: https://developers.cloudflare.com/autorag/usage/workers-binding/
 */
export async function retrieve(
  env: Env,
  query: string,
  domain?: string,
): Promise<RetrievedChunk[]> {
  const topK = Number(env.RAG_TOP_K) || 8;
  const threshold = Number(env.RAG_SCORE_THRESHOLD) || 0;

  const options: Record<string, unknown> = {
    query,
    max_num_results: topK,
    ranking_options: { score_threshold: threshold },
    rewrite_query: true,
  };

  // Lọc theo phòng ban: tài liệu trong R2 đặt dưới /ketoan, /sop, /crm ...
  if (domain) {
    options.filters = {
      type: "eq",
      key: "folder",
      value: `${domain}/`,
    };
  }

  const result = await env.AI.autorag(env.AUTORAG_NAME).search(options as never);

  // Gộp các đoạn (chunk) theo từng tài liệu, giữ score cao nhất để hiển thị.
  const chunks: RetrievedChunk[] = [];
  for (const doc of result.data ?? []) {
    const text = (doc.content ?? [])
      .map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();
    if (!text) continue;
    chunks.push({
      filename: doc.filename ?? doc.attributes?.filename ?? "tài liệu",
      text,
      score: doc.score ?? 0,
    });
  }
  return chunks;
}
