import type { Env, Product } from "./types";

/**
 * Tìm sản phẩm. Nếu đã cấu hình Elasticsearch (ES_URL) -> truy vấn ES thật;
 * nếu chưa -> trả về DỮ LIỆU MẪU để skeleton chạy được ngay. Khi có ES, chỉ cần
 * điền ES_URL/ES_INDEX (+ secret ES_API_KEY) là tự chuyển sang dữ liệu thật.
 */

const MOCK_PRODUCTS: Product[] = [
  { sku: "GACH-6060-TROANG", name: "Gạch ốp lát 60x60 men trắng", category: "Gạch ốp lát", price: 185000, unit: "m²", brand: "Daisan", desc: "Bề mặt bóng kiếng, chống trơn, hợp phòng khách." },
  { sku: "GACH-8080-VANGO", name: "Gạch lát 80x80 vân gỗ", category: "Gạch ốp lát", price: 320000, unit: "m²", brand: "Daisan", desc: "Vân gỗ tự nhiên, chống xước." },
  { sku: "SON-NUOC-NGOAI-18L", name: "Sơn nước ngoại thất 18L", category: "Sơn", price: 1250000, unit: "thùng", brand: "Daisan Paint", desc: "Chống thấm, bền màu, phủ rộng." },
  { sku: "XIMANG-PCB40", name: "Xi măng PCB40", category: "Xi măng", price: 92000, unit: "bao 50kg", brand: "Daisan", desc: "Đa dụng cho xây tô, đổ bê tông." },
  { sku: "THACH-CAO-TAM", name: "Tấm thạch cao chống ẩm", category: "Thạch cao", price: 165000, unit: "tấm", brand: "Daisan", desc: "Làm trần/vách, chống ẩm." },
];

export interface SearchResult { products: Product[]; source: "elasticsearch" | "mock" }

export async function searchProducts(env: Env, query: string, limit = 6): Promise<SearchResult> {
  const url = (env.ES_URL || "").replace(/\/+$/, "");
  if (url) {
    try {
      const products = await searchES(env, url, query, limit);
      return { products, source: "elasticsearch" };
    } catch {
      // ES lỗi -> fallback dữ liệu mẫu để không gãy hội thoại.
    }
  }
  return { products: filterMock(query, limit), source: "mock" };
}

function filterMock(query: string, limit: number): Product[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return MOCK_PRODUCTS.slice(0, limit);
  const hit = MOCK_PRODUCTS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q),
  );
  return (hit.length ? hit : MOCK_PRODUCTS).slice(0, limit);
}

/**
 * Truy vấn Elasticsearch. CHỈNH map trường ở đây cho khớp index thật của Daisan
 * khi có (tên trường: name/category/price/unit/brand…).
 */
async function searchES(env: Env, base: string, query: string, limit: number): Promise<Product[]> {
  const index = env.ES_INDEX || "products";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.ES_API_KEY) headers.authorization = `ApiKey ${env.ES_API_KEY}`;
  const res = await fetch(`${base}/${index}/_search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      size: limit,
      query: { multi_match: { query, fields: ["name^3", "category", "description", "brand"], fuzziness: "AUTO" } },
    }),
  });
  if (!res.ok) throw new Error(`ES ${res.status}`);
  const data = (await res.json()) as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } };
  const hits = data.hits?.hits ?? [];
  return hits.map((h) => {
    const s = h._source ?? {};
    return {
      sku: String(s.sku ?? s.code ?? ""),
      name: String(s.name ?? s.title ?? "Sản phẩm"),
      category: String(s.category ?? ""),
      price: typeof s.price === "number" ? s.price : undefined,
      unit: s.unit ? String(s.unit) : undefined,
      brand: s.brand ? String(s.brand) : undefined,
      desc: s.description ? String(s.description) : undefined,
    } as Product;
  });
}
