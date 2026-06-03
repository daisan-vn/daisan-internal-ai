import type { Env, RetrievedChunk } from "./types";

/**
 * Truy hồi tài liệu từ AutoRAG (AI Search) qua binding Workers AI — chỉ retrieval,
 * phần sinh câu trả lời để Claude lo qua AI Gateway.
 *
 * Lọc theo phòng ban (domain) làm PHÍA CLIENT bằng tiền tố thư mục của filename
 * (vd "ketoan/..."), vì lọc metadata qua binding AutoRAG đang lỗi
 * `vectorize_filter_not_serializable` trên wrangler 3.x. Khi có domain, lấy nhiều
 * kết quả hơn rồi lọc — nếu phòng đó chưa có tài liệu thì fallback không lọc.
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
  const maxResults = domain ? Math.min(topK * 4, 30) : topK;

  const ar = env.AI.autorag(env.AUTORAG_NAME);
  const base = { query, max_num_results: maxResults, ranking_options: { score_threshold: threshold } };
  // rewrite_query cải thiện truy hồi nhưng cần model rewrite của AutoRAG hoạt động.
  // Nếu bước rewrite lỗi (5006: thiếu prompt/messages) -> truy hồi lại với query gốc.
  let result: Awaited<ReturnType<typeof ar.search>>;
  try {
    result = await ar.search({ ...base, rewrite_query: true } as never);
  } catch {
    result = await ar.search({ ...base, rewrite_query: false } as never);
  }

  let chunks: RetrievedChunk[] = [];
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

  // Lọc theo phòng ban (tiền tố thư mục). Rỗng -> giữ nguyên để vẫn hữu ích.
  if (domain) {
    const prefix = `${domain}/`;
    const filtered = chunks.filter((c) => c.filename.startsWith(prefix));
    if (filtered.length) chunks = filtered;
  }

  return chunks.slice(0, topK);
}
