import type { Env, Product } from "./types";

/**
 * Tìm sản phẩm. Thứ tự nguồn: Shopify (daisanstore.com/products.json) -> Elasticsearch
 * -> dữ liệu mẫu. Đặt SHOPIFY_DOMAIN để bot gợi ý hàng THẬT từ store (kèm ảnh/giá).
 */

export interface SearchResult { products: Product[]; source: "shopify" | "elasticsearch" | "mock" }

export async function searchProducts(env: Env, query: string, limit = 8): Promise<SearchResult> {
  if (env.SHOPIFY_DOMAIN) {
    try {
      const all = await loadShopify(env);
      if (all.length) return { products: rank(all, query, limit), source: "shopify" };
    } catch { /* lỗi Shopify -> thử nguồn khác */ }
  }
  const url = (env.ES_URL || "").replace(/\/+$/, "");
  if (url) {
    try { return { products: await searchES(env, url, query, limit), source: "elasticsearch" }; } catch { /* fallback */ }
  }
  return { products: rank(MOCK_PRODUCTS, query, limit), source: "mock" };
}

/* ----------------------------- Shopify ----------------------------- */

let shopifyCache: { at: number; products: Product[] } | null = null;
const SHOPIFY_TTL = 10 * 60 * 1000; // cache 10 phút để khỏi tải lại mỗi câu hỏi

async function loadShopify(env: Env): Promise<Product[]> {
  if (shopifyCache && Date.now() - shopifyCache.at < SHOPIFY_TTL) return shopifyCache.products;
  const domain = (env.SHOPIFY_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const out: Product[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, { headers: { accept: "application/json" } });
    if (!res.ok) break;
    const data = (await res.json()) as { products?: Array<Record<string, unknown>> };
    const prods = data.products ?? [];
    if (!prods.length) break;
    for (const p of prods) {
      const variants = (p.variants as Array<Record<string, unknown>>) ?? [];
      const v = variants[0] ?? {};
      const images = (p.images as Array<{ src?: string }>) ?? [];
      const price = v.price ? Math.round(parseFloat(String(v.price))) : undefined;
      out.push({
        sku: String(v.sku || p.id || ""),
        name: String(p.title || "Sản phẩm"),
        category: String(p.product_type || ""),
        price: Number.isFinite(price as number) ? price : undefined,
        brand: p.vendor ? String(p.vendor) : undefined,
        desc: p.body_html ? stripHtml(String(p.body_html)).slice(0, 200) : undefined,
        image: images[0]?.src,
        url: p.handle ? `https://${domain}/products/${p.handle}` : undefined,
      });
    }
    if (prods.length < 250) break;
  }
  if (out.length) shopifyCache = { at: Date.now(), products: out }; // chỉ cache khi CÓ hàng (tránh kẹt rỗng 10 phút)
  return out;
}

function stripHtml(s: string): string { return s.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim(); }

/* ----------------------------- Elasticsearch ----------------------------- */

async function searchES(env: Env, base: string, query: string, limit: number): Promise<Product[]> {
  const index = env.ES_INDEX || "products";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.ES_API_KEY) headers.authorization = `ApiKey ${env.ES_API_KEY}`;
  const res = await fetch(`${base}/${index}/_search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ size: limit, query: { multi_match: { query, fields: ["name^3", "category", "description", "brand"], fuzziness: "AUTO" } } }),
  });
  if (!res.ok) throw new Error(`ES ${res.status}`);
  const data = (await res.json()) as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } };
  return (data.hits?.hits ?? []).map((h) => {
    const s = h._source ?? {};
    return {
      sku: String(s.sku ?? s.code ?? ""),
      name: String(s.name ?? s.title ?? "Sản phẩm"),
      category: String(s.category ?? ""),
      price: typeof s.price === "number" ? s.price : undefined,
      unit: s.unit ? String(s.unit) : undefined,
      brand: s.brand ? String(s.brand) : undefined,
      desc: s.description ? String(s.description) : undefined,
      image: s.image ? String(s.image) : s.image_url ? String(s.image_url) : s.thumbnail ? String(s.thumbnail) : undefined,
      url: s.url ? String(s.url) : undefined,
    } as Product;
  });
}

/* ----------------------------- Xếp hạng & dữ liệu mẫu ----------------------------- */

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

function rank(products: Product[], query: string, limit: number): Product[] {
  const q = norm(query).trim();
  if (!q) return products.slice(0, limit);
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = products
    .map((p) => {
      const hay = norm([p.name, p.category, p.brand, p.desc].filter(Boolean).join(" "));
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score++;
      if (hay.includes(q)) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return (scored.length ? scored.map((x) => x.p) : products).slice(0, limit);
}

const MOCK_PRODUCTS: Product[] = [
  { sku: "GACH-6060-TROANG", name: "Gạch ốp lát 60x60 men trắng", category: "Gạch ốp lát", price: 185000, unit: "m²", brand: "Daisan", desc: "Bề mặt bóng kiếng, chống trơn, hợp phòng khách." },
  { sku: "GACH-8080-VANGO", name: "Gạch lát 80x80 vân gỗ", category: "Gạch ốp lát", price: 320000, unit: "m²", brand: "Daisan", desc: "Vân gỗ tự nhiên, chống xước." },
  { sku: "SON-NUOC-NGOAI-18L", name: "Sơn nước ngoại thất 18L", category: "Sơn", price: 1250000, unit: "thùng", brand: "Daisan Paint", desc: "Chống thấm, bền màu, phủ rộng." },
  { sku: "XIMANG-PCB40", name: "Xi măng PCB40", category: "Xi măng", price: 92000, unit: "bao 50kg", brand: "Daisan", desc: "Đa dụng cho xây tô, đổ bê tông." },
  { sku: "THACH-CAO-TAM", name: "Tấm thạch cao chống ẩm", category: "Thạch cao", price: 165000, unit: "tấm", brand: "Daisan", desc: "Làm trần/vách, chống ẩm." },
];
