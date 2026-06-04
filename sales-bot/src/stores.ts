import type { Env, Store } from "./types";

/**
 * Danh bạ cửa hàng + tìm gần khách nhất. Hiện dùng DỮ LIỆU MẪU. Khi có danh sách
 * cửa hàng thật (tên, địa chỉ, lat/lng, ngành hàng), thay MOCK_STORES bằng nguồn
 * thật (Odoo/D1/feed) — hàm findNearestStores giữ nguyên.
 */

// 13 cửa hàng Daisan. Toạ độ hiện là TRUNG TÂM tỉnh/thành (đủ để định tuyến đúng
// khu vực); thay bằng lat/lng chính xác của từng cửa hàng khi có địa chỉ.
// categories để trống = không lọc theo ngành hàng (mọi cửa hàng đều được gợi ý).
const HOTLINE = "1900989836";
const MOCK_STORES: Store[] = [
  { id: "ha-noi", name: "Daisan Hà Nội", province: "Hà Nội", address: "Hà Nội", lat: 21.0278, lng: 105.8342, phone: HOTLINE },
  { id: "dong-anh", name: "Daisan Đông Anh", province: "Hà Nội", address: "Đông Anh, Hà Nội", lat: 21.1389, lng: 105.8500, phone: HOTLINE },
  { id: "hai-phong", name: "Daisan Hải Phòng", province: "Hải Phòng", address: "Hải Phòng", lat: 20.8449, lng: 106.6881, phone: HOTLINE },
  { id: "quang-ninh", name: "Daisan Quảng Ninh", province: "Quảng Ninh", address: "Hạ Long, Quảng Ninh", lat: 20.9590, lng: 107.0470, phone: HOTLINE },
  { id: "bac-ninh", name: "Daisan Bắc Ninh", province: "Bắc Ninh", address: "Bắc Ninh", lat: 21.1861, lng: 106.0763, phone: HOTLINE },
  { id: "thai-nguyen", name: "Daisan Thái Nguyên", province: "Thái Nguyên", address: "Thái Nguyên", lat: 21.5942, lng: 105.8480, phone: HOTLINE },
  { id: "ha-nam", name: "Daisan Hà Nam", province: "Hà Nam", address: "Phủ Lý, Hà Nam", lat: 20.5411, lng: 105.9139, phone: HOTLINE },
  { id: "nghe-an", name: "Daisan Nghệ An", province: "Nghệ An", address: "Vinh, Nghệ An", lat: 18.6790, lng: 105.6814, phone: HOTLINE },
  { id: "da-nang", name: "Daisan Đà Nẵng", province: "Đà Nẵng", address: "Đà Nẵng", lat: 16.0544, lng: 108.2022, phone: HOTLINE },
  { id: "khanh-hoa", name: "Daisan Khánh Hòa", province: "Khánh Hòa", address: "Nha Trang, Khánh Hòa", lat: 12.2388, lng: 109.1967, phone: HOTLINE },
  { id: "hcm", name: "Daisan HCM", province: "Hồ Chí Minh", address: "TP.HCM", lat: 10.7769, lng: 106.7009, phone: HOTLINE },
  { id: "binh-tan", name: "Daisan Bình Tân", province: "Hồ Chí Minh", address: "Bình Tân, TP.HCM", lat: 10.7652, lng: 106.6039, phone: HOTLINE },
  { id: "can-tho", name: "Daisan Cần Thơ", province: "Cần Thơ", address: "Cần Thơ", lat: 10.0452, lng: 105.7469, phone: HOTLINE },
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
