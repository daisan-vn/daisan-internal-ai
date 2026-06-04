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
Nhân viên ─▶ Cloudflare Access (email được duyệt) ─▶ troly.daisan.ai · Worker (chat UI)
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
| Đăng nhập | **Cloudflare Access** (Zero Trust) | chỉ email được duyệt (allowlist) |
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

Bọc Worker bằng **Zero Trust → Access** để chỉ nhân sự được duyệt mới vào
`troly.daisan.ai`. Không cần viết code.

> ⚠️ **KHÔNG** dùng selector "Emails ending in @gmail.com" — nó cho **cả thế
> giới** vào. Với Gmail phải **liệt kê từng email cụ thể** (hoặc dùng list).

**Bước 1 — Gắn domain cho Worker**
Dashboard → Workers → `daisan-internal-ai` → Settings → Domains & Routes →
thêm custom domain `troly.daisan.ai`.

**Bước 2 — Tạo Access Application**
Zero Trust → **Access → Applications → Add an application → Self-hosted**
- Application domain: `troly.daisan.ai`
- Session duration: tùy (vd 24h)

**Bước 3 — Cách đăng nhập**

| Cách | Setup | Trải nghiệm |
| --- | --- | --- |
| **One-time PIN** (khuyên dùng để bắt đầu) | Bật sẵn, 0 cấu hình | Nhập email → nhận mã 6 số qua mail → vào |
| **Google login** | Cần nối Google làm Identity Provider | Bấm "Đăng nhập bằng Google" |

One-time PIN hợp với các Gmail rời rạc — không cần dựng IdP.

**Bước 4 — Policy: Allow + liệt kê email**
Trong app → Policies → Add → Action = **Allow**:
- Selector **Emails** → dán danh sách:
  ```
  nhamphongdaijsc@gmail.com
  nhanvien2@gmail.com
  nhanvien3@gmail.com
  ```

**Mẹo quản lý khi nhiều người (nên làm sớm)**
Thay vì sửa policy mỗi lần thêm người, tạo **danh sách dùng lại**:
Zero Trust → **My Team → Lists** → tạo list `troly-users` (kiểu Emails) →
thêm tất cả email. Trong policy chọn selector **"Emails in list" → troly-users**.
→ Sau này thêm/bớt người chỉ cần sửa list, không đụng policy.

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
