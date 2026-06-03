# Daisan Internal AI

Trợ lý AI nội bộ của **Daisan Group** — hỗ trợ nhân sự tra cứu nghiệp vụ về
**Odoo, kế toán Odoo, SOP, kinh doanh, CRM, mua hàng và kho**, trả lời **dựa
trên tài liệu nội bộ** (RAG) và **luôn trích dẫn nguồn**.

> Dự án này **tách hoàn toàn** với AI web-build (daisan.ai). Chỉ **chung hạ
> tầng** (AI Gateway `daisan-gw` + tài khoản Cloudflare), **riêng** codebase,
> repo, domain, deploy và quyền truy cập.

---

## Kiến trúc

```
Nhân viên ─▶ Cloudflare Access (chỉ email @daisan) ─▶ Worker (chat UI)
                                                          │
                              ┌───────────────────────────┤
                              ▼                           ▼
                     AutoRAG / AI Search          Claude qua daisan-gw (AI Gateway)
                     (R2 tài liệu → Vectorize)    → sinh câu trả lời tiếng Việt + trích dẫn
                              │
              R2 chia theo domain: /ketoan /sop /crm /mua /kho /odoo
```

| Tầng | Dùng gì | Vai trò |
| --- | --- | --- |
| Vỏ UI/Worker | Worker + chat UI (`public/`) | giao diện, điều phối |
| Não tri thức | **AutoRAG** (`env.AI.autorag`) | truy hồi tài liệu nội bộ |
| LLM sinh câu | **Claude** qua AI Gateway `daisan-gw` | trả lời tiếng Việt + trích dẫn |
| Đăng nhập | **Cloudflare Access** (Zero Trust) | chặn chỉ nhân viên Daisan |
| Kho tài liệu | **R2**, chia thư mục theo domain | lọc theo phòng ban |

Luồng xử lý: `src/index.ts` nhận câu hỏi → `src/rag.ts` truy hồi tài liệu →
`src/prompt.ts` dựng ngữ cảnh + system prompt → `src/llm.ts` stream Claude qua
AI Gateway → trả về UI kèm danh sách nguồn.

---

## Thiết lập

### 1. Cài đặt
```bash
npm install
```

### 2. Tạo AutoRAG (một lần, trên dashboard)
- Dashboard → **AI → AI Search (AutoRAG)** → tạo instance tên `daisan-internal-ai`.
- Trỏ vào một **R2 bucket** chứa tài liệu, sắp xếp theo thư mục domain:
  `ketoan/`, `sop/`, `crm/`, `mua/`, `kho/`, `odoo/`.
- AutoRAG tự chunk → embed → index, và **tự re-sync** khi file R2 đổi.

> ⚠️ **Kiểm chứng tiếng Việt sớm**: test chất lượng embedding với tài liệu
> tiếng Việt thật. Nếu kém → cấu hình Vectorize với model đa ngữ (vd `bge-m3`).

### 3. Cấu hình
- Sửa `wrangler.jsonc`: điền `CF_ACCOUNT_ID`, chỉnh `DEFAULT_MODEL` nếu cần.
- Tạo secret key Claude:
```bash
wrangler secret put ANTHROPIC_API_KEY
```
- Chạy local: copy `.dev.vars.example` → `.dev.vars` và điền key.

### 4. Chạy & deploy
```bash
npm run dev      # local
npm run deploy   # lên Cloudflare
```

### 5. Khóa truy cập (Cloudflare Access)
Sau khi deploy, bọc Worker bằng **Zero Trust → Access → Application**, policy
chỉ cho phép email thuộc domain Daisan. Không cần viết code.

---

## Lộ trình

| Giai đoạn | Trạng thái | Nội dung |
| --- | --- | --- |
| **1. MVP RAG** | 🟢 khung này | Worker + UI + AutoRAG + Claude + prompt tiếng Việt có trích dẫn |
| 2. Đủ domain + chất lượng | ⏳ | Thêm domain; chống bịa; lịch sử chat (D1); trang admin upload |
| 3. Nối Odoo "sống" | ⏳ | Tool-calling qua Odoo JSON-RPC (read-only): tồn kho, công nợ, trạng thái đơn |
| 4. Hoàn thiện & phổ biến | ⏳ | Analytics, eval chất lượng, đào tạo nhân sự |

### Việc cần chốt
- **Tài liệu đang ở đâu?** (Google Drive / trong Odoo / PDF rời) → cách bơm vào R2.
- **Odoo "sống" hay chỉ tài liệu?** Tài liệu/SOP làm trước; Odoo sống ở Phase 3.
- **SSO**: dùng Google Workspace cho Cloudflare Access?

---

## Cấu trúc

```
src/
  index.ts    # Worker entry: routing, /api/chat (SSE), static assets
  rag.ts      # Truy hồi tài liệu từ AutoRAG
  llm.ts      # Stream Claude qua AI Gateway daisan-gw
  prompt.ts   # System prompt tiếng Việt + dựng ngữ cảnh
  types.ts    # Env bindings & kiểu dữ liệu
public/
  index.html  # Giao diện chat
  chat.js     # Logic client: stream SSE, hiển thị nguồn
  styles.css
```
