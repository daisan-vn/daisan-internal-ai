import type { Env, Store } from "./types";

/**
 * Danh bạ cửa hàng + tìm gần khách nhất. Hiện dùng DỮ LIỆU MẪU. Khi có danh sách
 * cửa hàng thật (tên, địa chỉ, lat/lng, ngành hàng), thay MOCK_STORES bằng nguồn
 * thật (Odoo/D1/feed) — hàm findNearestStores giữ nguyên.
 */

const MOCK_STORES: Store[] = [
  { id: "hn-caugiay", name: "Daisan Cầu Giấy", province: "Hà Nội", address: "Cầu Giấy, Hà Nội", lat: 21.0313, lng: 105.7872, phone: "1900989836", salesperson: "NV Hà Nội", categories: ["Gạch ốp lát", "Sơn", "Xi măng", "Thạch cao"] },
  { id: "hn-hadong", name: "Daisan Hà Đông", province: "Hà Nội", address: "Hà Đông, Hà Nội", lat: 20.9710, lng: 105.7788, phone: "1800646498", salesperson: "NV Hà Nội", categories: ["Gạch ốp lát", "Xi măng"] },
  { id: "hcm-q7", name: "Daisan Quận 7", province: "Hồ Chí Minh", address: "Quận 7, TP.HCM", lat: 10.7340, lng: 106.7215, phone: "0986258282", salesperson: "NV HCM", categories: ["Gạch ốp lát", "Sơn", "Thạch cao"] },
  { id: "hcm-thuduc", name: "Daisan Thủ Đức", province: "Hồ Chí Minh", address: "TP Thủ Đức, TP.HCM", lat: 10.8499, lng: 106.7537, phone: "0986258282", salesperson: "NV HCM", categories: ["Gạch ốp lát", "Xi măng", "Sơn"] },
  { id: "dn-haichau", name: "Daisan Hải Châu", province: "Đà Nẵng", address: "Hải Châu, Đà Nẵng", lat: 16.0544, lng: 108.2022, phone: "0986258282", salesperson: "NV Đà Nẵng", categories: ["Gạch ốp lát", "Sơn"] },
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();

export interface NearestInput { province?: string; lat?: number; lng?: number; category?: string; limit?: number }

/** Trả về cửa hàng gần khách nhất (theo toạ độ nếu có, không thì lọc theo tỉnh). */
export async function findNearestStores(_env: Env, input: NearestInput): Promise<Array<Store & { distanceKm?: number }>> {
  const limit = input.limit ?? 3;
  let list: Store[] = MOCK_STORES;

  // Lọc theo ngành hàng nếu có.
  if (input.category) {
    const c = norm(input.category);
    const f = list.filter((s) => (s.categories || []).some((x) => norm(x).includes(c) || c.includes(norm(x))));
    if (f.length) list = f;
  }

  // Có toạ độ -> sắp theo khoảng cách.
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const here = { lat: input.lat, lng: input.lng };
    return list
      .map((s) => ({ ...s, distanceKm: Math.round(haversineKm(here, s) * 10) / 10 }))
      .sort((a, b) => (a.distanceKm! - b.distanceKm!))
      .slice(0, limit);
  }

  // Chỉ có tỉnh/thành -> lọc theo tên tỉnh.
  if (input.province) {
    const p = norm(input.province);
    const f = list.filter((s) => norm(s.province).includes(p) || p.includes(norm(s.province)));
    if (f.length) return f.slice(0, limit);
  }

  return list.slice(0, limit);
}
