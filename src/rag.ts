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

/**
 * Yêu cầu AutoRAG index lại kho tài liệu NGAY (thay vì chờ lịch tự động) — gọi sau
 * khi tải lên / đồng bộ Drive để tài liệu mới tìm được sớm.
 *
 * Cần secret CF_API_TOKEN (token có quyền sửa AutoRAG của tài khoản). Thiếu token
 * thì bỏ qua êm (tài liệu vẫn được index theo lịch mặc định của AutoRAG).
 * REST: POST /accounts/{account_id}/autorag/rags/{rag}/sync
 */
export async function reindexAutorag(env: Env): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!env.CF_API_TOKEN) return { ok: false, skipped: true, error: "Thiếu CF_API_TOKEN." };
  const acct = env.CF_ACCOUNT_ID;
  const rag = env.AUTORAG_NAME;
  if (!acct || !rag) return { ok: false, skipped: true, error: "Thiếu CF_ACCOUNT_ID/AUTORAG_NAME." };
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/autorag/rags/${rag}/sync`,
      { method: "PATCH", headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" } },
    );
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: Array<{ message?: string }> };
    if (!res.ok || data.success === false) {
      return { ok: false, error: data.errors?.[0]?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
