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
  blocked: string[] = [],
): Promise<RetrievedChunk[]> {
  const topK = Number(env.RAG_TOP_K) || 8;
  const threshold = Number(env.RAG_SCORE_THRESHOLD) || 0;
  // Lấy dư khi cần lọc (theo phòng ban hoặc loại bỏ phòng bị chặn) để vẫn đủ kết quả.
  const maxResults = domain || blocked.length ? Math.min(topK * 2, 16) : topK;

  const ar = env.AI.autorag(env.AUTORAG_NAME);
  // rewrite_query=false: bỏ bước AutoRAG gọi thêm 1 lượt model để viết lại câu hỏi
  // -> nhanh hơn rõ rệt mỗi truy vấn. Với câu tiếng Việt nhiều từ khóa, truy hồi
  // theo query gốc thường đã đủ tốt.
  const result = await ar.search({
    query,
    max_num_results: maxResults,
    ranking_options: { score_threshold: threshold },
    rewrite_query: false,
  } as never);

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

  // Phân quyền: loại bỏ tài liệu thuộc phòng bị chặn (BẮT BUỘC, không nhân nhượng).
  if (blocked.length) {
    const block = new Set(blocked);
    chunks = chunks.filter((c) => !block.has(c.filename.split("/")[0]));
  }

  // Lọc theo phòng ban người dùng chọn (tiền tố thư mục). Rỗng -> giữ nguyên.
  if (domain) {
    const prefix = `${domain}/`;
    const filtered = chunks.filter((c) => c.filename.startsWith(prefix));
    if (filtered.length) chunks = filtered;
  }

  return chunks.slice(0, topK);
}
