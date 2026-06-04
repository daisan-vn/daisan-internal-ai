# Daisan Sales Bot (chatbot bán hàng công khai)

Chatbot **công khai** nhúng trên website (daisanstore / b2b / daisan.vn): tìm sản
phẩm (Elasticsearch), gợi ý **cửa hàng gần khách nhất**, và **thu lead** cho sales.

> ⚠️ **Tách hoàn toàn** với trợ lý nội bộ (`daisan-internal-ai`): **Worker riêng,
> secret riêng, deploy riêng**, KHÔNG có quyền đọc Odoo nội bộ. Chỉ dùng dữ liệu
> công khai. Đặt trong thư mục `sales-bot/` của repo chung cho tiện; sau có thể
> tách ra repo riêng chỉ bằng cách copy thư mục này.

## Kiến trúc
```
Website ──<script widget.js>── Worker (public, CORS) ──┬─ Elasticsearch (tìm SP)
                                                        ├─ Danh bạ cửa hàng + geo (gần nhất)
                                                        ├─ Claude qua AI Gateway daisan-gw (tool-calling)
                                                        └─ Thu lead (-> Odoo CRM ở bước sau)
```
Claude điều phối bằng 3 công cụ: `search_products` · `find_nearest_store` · `capture_lead`.

## Trạng thái skeleton
- ✅ Widget nhúng + UI chat + hội thoại bán hàng (tool-calling) chạy được ngay.
- 🟡 **Sản phẩm**: dùng **dữ liệu mẫu** (`src/search.ts`) cho tới khi điền `ES_URL`/`ES_INDEX` (+ secret `ES_API_KEY`).
- 🟡 **Cửa hàng**: dùng **danh sách mẫu** (`src/stores.ts`) cho tới khi thay bằng danh bạ thật (có lat/lng).
- 🟡 **Lead**: hiện log + lưu D1 (nếu bật). Bước sau: tạo `crm.lead` Odoo + định tuyến cửa hàng/nhân sự.

## Chạy & deploy
```bash
cd sales-bot
npm install
wrangler secret put ANTHROPIC_API_KEY   # bắt buộc để chat hoạt động
npm run dev       # local
npm run deploy    # lên Cloudflare (Worker daisan-sales-bot, có URL *.workers.dev)
```
Tự động: workflow `.github/workflows/deploy-sales-bot.yml` (ở gốc repo) deploy khi
có thay đổi trong `sales-bot/**` trên nhánh `main`.

## Nhúng vào website
```html
<script src="https://<worker-url>/widget.js" data-site="daisanstore" defer></script>
```
Xem thử: mở `https://<worker-url>/embed-demo.html`.

## Cắm dữ liệu thật (khi có)
1. **Elasticsearch**: điền `ES_URL`, `ES_INDEX` trong `wrangler.jsonc`, đặt secret `ES_API_KEY`; chỉnh map trường trong `src/search.ts` cho khớp index.
2. **Cửa hàng**: thay `MOCK_STORES` trong `src/stores.ts` bằng danh bạ thật (tên, địa chỉ, **lat/lng**, ngành hàng, sales).
3. **Lead → Odoo**: nối `src/lead.ts` tới Odoo `crm.lead` + định tuyến.

## Bảo mật
- Public → cần bật **Turnstile** + rate-limit trước khi lên thật (chống spam/đốt chi phí).
- Chỉ trả thông tin công khai; không lộ tồn kho chính xác/giá vốn/dữ liệu nội bộ.
- Khoá `ALLOWED_ORIGINS` về đúng các domain Daisan khi lên production.
