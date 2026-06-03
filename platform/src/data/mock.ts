// Mock data cho Daisan AI Platform (Phase 1). Sẽ thay bằng Supabase + Odoo ở phase sau.

/* ---------------- Phân quyền ---------------- */
export const ROLES = [
  "CEO", "BOD", "Director", "Branch Manager", "Department Manager",
  "Accountant", "HR", "Sales", "Warehouse", "IT", "Staff",
] as const;
export type Role = (typeof ROLES)[number];

export const DEPARTMENTS = [
  "Sales", "Marketing", "Accounting", "HR", "Warehouse",
  "Procurement", "IT", "Daisan.vn", "DaisanTiles", "Depot",
] as const;

export const BRANCHES = ["HN", "HCM", "Depot", "DaisanTiles", "Daisan.vn", "Khác"] as const;

export const SENSITIVITY = [
  "Public Internal", "Department", "Confidential", "Highly Confidential",
] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];

export const ACTIONS = [
  "view", "ask_ai", "export", "create_report", "create_task", "approve", "edit", "delete",
] as const;
export type Action = (typeof ACTIONS)[number];

export interface RolePolicy {
  role: Role;
  sensitivity: Sensitivity;      // mức nhạy cảm tối đa được xem
  actions: Action[];
  members: number;
}

// Ma trận quyền theo vai trò.
export const rolePolicies: RolePolicy[] = [
  { role: "CEO", sensitivity: "Highly Confidential", actions: [...ACTIONS], members: 1 },
  { role: "BOD", sensitivity: "Highly Confidential", actions: ["view", "ask_ai", "export", "create_report", "approve"], members: 4 },
  { role: "Director", sensitivity: "Confidential", actions: ["view", "ask_ai", "export", "create_report", "create_task", "approve"], members: 6 },
  { role: "Branch Manager", sensitivity: "Confidential", actions: ["view", "ask_ai", "export", "create_report", "create_task", "approve"], members: 5 },
  { role: "Department Manager", sensitivity: "Department", actions: ["view", "ask_ai", "export", "create_report", "create_task", "edit"], members: 10 },
  { role: "Accountant", sensitivity: "Confidential", actions: ["view", "ask_ai", "export", "create_report"], members: 8 },
  { role: "HR", sensitivity: "Confidential", actions: ["view", "ask_ai", "export", "create_report", "edit"], members: 5 },
  { role: "Sales", sensitivity: "Department", actions: ["view", "ask_ai", "export", "create_task"], members: 32 },
  { role: "Warehouse", sensitivity: "Department", actions: ["view", "ask_ai", "create_task"], members: 18 },
  { role: "IT", sensitivity: "Highly Confidential", actions: [...ACTIONS], members: 4 },
  { role: "Staff", sensitivity: "Public Internal", actions: ["view", "ask_ai"], members: 120 },
];

/* ---------------- Nguồn dữ liệu ---------------- */
export type SourceStatus = "connected" | "syncing" | "error" | "disconnected";
export interface DataSource {
  id: string; name: string; kind: string; status: SourceStatus;
  lastSync: number; admin: string; access: Sensitivity | string; records: number;
}
const m = (min: number) => Date.now() - min * 60_000;
export const dataSources: DataSource[] = [
  { id: "odoo", name: "Odoo ERP", kind: "Vận hành: bán hàng, kho, kế toán", status: "connected", lastSync: m(12), admin: "IT · Nguyễn Văn A", access: "Department", records: 184320 },
  { id: "gdrive", name: "Google Drive", kind: "Tài liệu, SOP, hợp đồng", status: "connected", lastSync: m(35), admin: "HR · Trần Thị B", access: "Public Internal", records: 5210 },
  { id: "gdocs", name: "Google Docs", kind: "Tài liệu soạn thảo", status: "connected", lastSync: m(50), admin: "HR · Trần Thị B", access: "Department", records: 1840 },
  { id: "gsheets", name: "Google Sheets", kind: "KPI, ngân sách, bảng tính", status: "syncing", lastSync: m(2), admin: "Kế toán · Lê C", access: "Confidential", records: 920 },
  { id: "daisanvn", name: "Daisan.vn", kind: "Website bán lẻ", status: "connected", lastSync: m(8), admin: "Marketing · Phạm D", access: "Public Internal", records: 12400 },
  { id: "b2b", name: "B2B.daisan.vn", kind: "Cổng đặt hàng B2B", status: "connected", lastSync: m(20), admin: "Sales · Hoàng E", access: "Department", records: 3120 },
  { id: "drupal", name: "Drupal News", kind: "Tin tức nội bộ", status: "connected", lastSync: m(180), admin: "Marketing · Phạm D", access: "Public Internal", records: 640 },
  { id: "elastic", name: "Elasticsearch", kind: "Tìm kiếm sản phẩm / log", status: "error", lastSync: m(1560), admin: "IT · Nguyễn Văn A", access: "Department", records: 0 },
  { id: "supabase", name: "Supabase", kind: "DB nền tảng: users, logs, quyền", status: "connected", lastSync: m(1), admin: "IT · Nguyễn Văn A", access: "Highly Confidential", records: 75200 },
  { id: "upload", name: "Tải file thủ công", kind: "PDF / Word / Excel rời", status: "connected", lastSync: m(300), admin: "Mỗi phòng ban", access: "Department", records: 410 },
];

/* ---------------- Dashboard ---------------- */
export const dashboard = {
  kpis: {
    questionsToday: 342,
    questionsTodayDelta: 12,         // % so hôm qua
    openAlerts: 13,
    openAlertsCritical: 4,
    reportsPending: 5,
    odooLastSyncMin: 12,
    sourcesError: 1,
    activeUsers: 87,
  },
  questionsByDept: [
    { dept: "Sales", value: 96 },
    { dept: "Kế toán", value: 74 },
    { dept: "Kho", value: 58 },
    { dept: "Mua hàng", value: 41 },
    { dept: "HR", value: 33 },
    { dept: "Marketing", value: 25 },
    { dept: "IT", value: 15 },
  ],
  trend7d: [
    { day: "T2", value: 210 }, { day: "T3", value: 268 }, { day: "T4", value: 245 },
    { day: "T5", value: 312 }, { day: "T6", value: 298 }, { day: "T7", value: 180 }, { day: "CN", value: 342 },
  ],
  topIssues: [
    { issue: "Công nợ quá hạn tăng 18% ở chi nhánh HCM", severity: "Cao" },
    { issue: "Tồn kho gạch men vượt ngưỡng tại Depot", severity: "Trung bình" },
    { issue: "5 phiếu mua hàng chờ duyệt > 3 ngày", severity: "Trung bình" },
    { issue: "Doanh thu Daisan.vn giảm 7% so với tuần trước", severity: "Cao" },
    { issue: "Đồng bộ Elasticsearch lỗi 26 giờ", severity: "Cao" },
  ],
  topDocuments: [
    { doc: "SOP Quy trình bán hàng B2B.pdf", views: 142 },
    { doc: "Hướng dẫn kế toán Odoo - Hóa đơn.docx", views: 118 },
    { doc: "Chính sách công nợ 2026.pdf", views: 97 },
    { doc: "Quy trình nhập kho.pdf", views: 85 },
    { doc: "Bảng giá DaisanTiles Q2.xlsx", views: 73 },
  ],
  latestOdoo: [
    { metric: "Doanh thu hôm nay", value: "1,84 tỷ", trend: "up" },
    { metric: "Đơn hàng mới", value: "127", trend: "up" },
    { metric: "Công nợ phải thu", value: "12,4 tỷ", trend: "down" },
    { metric: "Giá trị tồn kho", value: "38,9 tỷ", trend: "flat" },
  ],
};

/* ---------------- Cảnh báo ---------------- */
export type Severity = "critical" | "warning" | "info";
export interface Alert {
  id: string; title: string; type: string; severity: Severity;
  scope: string; value: string; at: number;
}
export const alerts: Alert[] = [
  { id: "a1", title: "Công nợ quá hạn", type: "Tài chính", severity: "critical", scope: "CN HCM", value: "2,3 tỷ / 14 KH", at: m(40) },
  { id: "a2", title: "Tồn kho vượt ngưỡng", type: "Kho", severity: "warning", scope: "Depot", value: "Gạch men +120%", at: m(95) },
  { id: "a3", title: "Doanh thu giảm", type: "Kinh doanh", severity: "warning", scope: "Daisan.vn", value: "-7% tuần", at: m(160) },
  { id: "a4", title: "Phiếu mua hàng chưa duyệt", type: "Mua hàng", severity: "warning", scope: "Toàn cty", value: "5 phiếu > 3 ngày", at: m(220) },
  { id: "a5", title: "Đồng bộ dữ liệu lỗi", type: "Hệ thống", severity: "critical", scope: "Elasticsearch", value: "Lỗi 26 giờ", at: m(80) },
  { id: "a6", title: "Hợp đồng sắp hết hạn", type: "Pháp lý", severity: "info", scope: "3 NCC", value: "Hết hạn < 30 ngày", at: m(600) },
  { id: "a7", title: "KPI thấp", type: "Nhân sự", severity: "warning", scope: "Sales HN", value: "68% mục tiêu", at: m(300) },
];

/* ---------------- Báo cáo ---------------- */
export interface ReportItem { id: string; name: string; period: string; status: "submitted" | "pending" | "generating"; owner: string; }
export const reports: ReportItem[] = [
  { id: "r1", name: "Báo cáo doanh thu", period: "Tháng 5/2026", status: "submitted", owner: "Kế toán" },
  { id: "r2", name: "Báo cáo lợi nhuận gộp", period: "Tháng 5/2026", status: "pending", owner: "Kế toán" },
  { id: "r3", name: "Báo cáo công nợ", period: "Tuần 22", status: "submitted", owner: "Kế toán" },
  { id: "r4", name: "Báo cáo tồn kho", period: "Tháng 5/2026", status: "pending", owner: "Kho" },
  { id: "r5", name: "Báo cáo đơn hàng", period: "Tuần 22", status: "submitted", owner: "Sales" },
  { id: "r6", name: "Báo cáo KPI", period: "Tháng 5/2026", status: "generating", owner: "BOD" },
  { id: "r7", name: "Báo cáo nhân sự", period: "Tháng 5/2026", status: "pending", owner: "HR" },
  { id: "r8", name: "Báo cáo lương", period: "Tháng 5/2026", status: "pending", owner: "HR" },
  { id: "r9", name: "Báo cáo marketing", period: "Tuần 22", status: "submitted", owner: "Marketing" },
  { id: "r10", name: "Báo cáo rủi ro", period: "Quý 2/2026", status: "pending", owner: "BOD" },
];

/* ---------------- Hành động AI đề xuất ---------------- */
export interface AiAction { id: string; label: string; icon: string; }
export const aiActions: AiAction[] = [
  { id: "task", label: "Tạo nhiệm vụ", icon: "ListTodo" },
  { id: "assign", label: "Giao người phụ trách", icon: "UserPlus" },
  { id: "report", label: "Tạo báo cáo", icon: "FileText" },
  { id: "excel", label: "Xuất Excel", icon: "Sheet" },
  { id: "email", label: "Gửi email", icon: "Mail" },
  { id: "meeting", label: "Tạo lịch họp", icon: "CalendarPlus" },
  { id: "ticket", label: "Tạo ticket", icon: "Ticket" },
  { id: "dgos", label: "Đẩy sang DGOS", icon: "Send" },
];

/* ---------------- Lịch sử truy vấn / audit ---------------- */
export interface QueryLog { id: string; user: string; role: Role; query: string; source: string; permission: "allowed" | "denied"; at: number; }
export const queryLogs: QueryLog[] = [
  { id: "q1", user: "ceo@daisan.vn", role: "CEO", query: "Lợi nhuận gộp tháng 5 toàn tập đoàn?", source: "Odoo, Google Sheets", permission: "allowed", at: m(5) },
  { id: "q2", user: "sale.hn@daisan.vn", role: "Sales", query: "Công nợ khách hàng ABC còn bao nhiêu?", source: "Odoo", permission: "allowed", at: m(11) },
  { id: "q3", user: "staff@daisan.vn", role: "Staff", query: "Bảng lương phòng kế toán tháng 5?", source: "—", permission: "denied", at: m(18) },
  { id: "q4", user: "kho.depot@daisan.vn", role: "Warehouse", query: "Tồn kho gạch men 60x60 còn bao nhiêu?", source: "Odoo", permission: "allowed", at: m(26) },
  { id: "q5", user: "hr@daisan.vn", role: "HR", query: "Danh sách hợp đồng sắp hết hạn?", source: "Google Drive", permission: "allowed", at: m(44) },
  { id: "q6", user: "staff2@daisan.vn", role: "Staff", query: "Quy trình tạo hóa đơn trong Odoo?", source: "SOP - Google Drive", permission: "allowed", at: m(60) },
  { id: "q7", user: "director@daisan.vn", role: "Director", query: "Doanh thu HCM tuần này so tuần trước?", source: "Odoo", permission: "allowed", at: m(75) },
  { id: "q8", user: "sale2@daisan.vn", role: "Sales", query: "Lương của giám đốc kinh doanh?", source: "—", permission: "denied", at: m(88) },
  { id: "q9", user: "ketoan@daisan.vn", role: "Accountant", query: "Dòng tiền dự kiến tháng 6?", source: "Odoo, Google Sheets", permission: "allowed", at: m(102) },
  { id: "q10", user: "hr2@daisan.vn", role: "HR", query: "Báo cáo nhân sự nghỉ việc Q2?", source: "Google Drive", permission: "allowed", at: m(130) },
  { id: "q11", user: "staff3@daisan.vn", role: "Staff", query: "Lợi nhuận gộp toàn tập đoàn?", source: "—", permission: "denied", at: m(145) },
  { id: "q12", user: "it@daisan.vn", role: "IT", query: "Nhật ký đồng bộ Odoo 24h qua?", source: "Supabase", permission: "allowed", at: m(170) },
];

export interface UserRow { name: string; email: string; role: Role; dept: string; branch: string; }
export const users: UserRow[] = [
  { name: "Nguyễn Văn CEO", email: "ceo@daisan.vn", role: "CEO", dept: "BOD", branch: "HN" },
  { name: "Trần Director", email: "director@daisan.vn", role: "Director", dept: "Sales", branch: "HCM" },
  { name: "Lê Kế Toán", email: "ketoan@daisan.vn", role: "Accountant", dept: "Accounting", branch: "HN" },
  { name: "Phạm Sales", email: "sale.hn@daisan.vn", role: "Sales", dept: "Sales", branch: "HN" },
  { name: "Hoàng Kho", email: "kho.depot@daisan.vn", role: "Warehouse", dept: "Warehouse", branch: "Depot" },
];

export const MODULES = [
  { id: "chat", label: "Trò chuyện AI", icon: "MessagesSquare", group: "Trợ lý" },
  { id: "dept-ask", label: "Hỏi theo phòng ban", icon: "Building2", group: "Trợ lý" },
  { id: "dashboard", label: "Dashboard điều hành", icon: "LayoutDashboard", group: "Điều hành" },
  { id: "metrics", label: "Trung tâm số liệu", icon: "BarChart3", group: "Điều hành" },
  { id: "sop", label: "Trung tâm SOP", icon: "BookOpen", group: "Tri thức" },
  { id: "reports", label: "Trung tâm báo cáo", icon: "FileText", group: "Điều hành" },
  { id: "alerts", label: "Trung tâm cảnh báo", icon: "BellRing", group: "Điều hành" },
  { id: "actions", label: "Trung tâm hành động", icon: "Zap", group: "Điều hành" },
  { id: "sources", label: "Quản trị nguồn dữ liệu", icon: "Database", group: "Quản trị" },
  { id: "permissions", label: "Phân quyền", icon: "ShieldCheck", group: "Quản trị" },
  { id: "audit", label: "Lịch sử truy vấn", icon: "History", group: "Quản trị" },
] as const;

/* ===================== PHASE 2 ===================== */

/* --- Cảnh báo: đủ 13 loại --- */
export const alertList: Alert[] = [
  { id: "al1", title: "Công nợ quá hạn", type: "Tài chính", severity: "critical", scope: "CN HCM", value: "2,3 tỷ · 14 KH", at: m(40) },
  { id: "al2", title: "Tồn kho vượt ngưỡng", type: "Kho", severity: "warning", scope: "Depot", value: "Gạch men +120%", at: m(95) },
  { id: "al3", title: "Doanh thu giảm", type: "Kinh doanh", severity: "warning", scope: "Daisan.vn", value: "-7% tuần", at: m(160) },
  { id: "al4", title: "Đơn hàng chưa xử lý", type: "Kinh doanh", severity: "warning", scope: "B2B", value: "23 đơn > 48h", at: m(120) },
  { id: "al5", title: "Phiếu mua hàng chưa duyệt", type: "Mua hàng", severity: "warning", scope: "Toàn cty", value: "5 phiếu > 3 ngày", at: m(220) },
  { id: "al6", title: "Lương chưa chốt", type: "Nhân sự", severity: "info", scope: "Tháng 5", value: "Hạn 25/5", at: m(700) },
  { id: "al7", title: "Báo cáo chưa nộp", type: "Quản trị", severity: "warning", scope: "5 báo cáo", value: "Quá hạn 2 ngày", at: m(260) },
  { id: "al8", title: "KPI thấp", type: "Nhân sự", severity: "warning", scope: "Sales HN", value: "68% mục tiêu", at: m(300) },
  { id: "al9", title: "Chi phí vượt ngân sách", type: "Tài chính", severity: "critical", scope: "Marketing", value: "+14% ngân sách", at: m(180) },
  { id: "al10", title: "Hợp đồng sắp hết hạn", type: "Pháp lý", severity: "info", scope: "3 NCC", value: "< 30 ngày", at: m(600) },
  { id: "al11", title: "Khoản vay đến hạn", type: "Tài chính", severity: "warning", scope: "Vietcombank", value: "1,5 tỷ · 10 ngày", at: m(900) },
  { id: "al12", title: "Tài sản chưa kiểm kê", type: "Kho", severity: "info", scope: "DaisanTiles", value: "32 mục", at: m(1200) },
  { id: "al13", title: "Dữ liệu đồng bộ lỗi", type: "Hệ thống", severity: "critical", scope: "Elasticsearch", value: "Lỗi 26 giờ", at: m(80) },
];

/* --- Báo cáo: 10 loại --- */
export interface ReportType {
  id: string; name: string; period: string;
  status: "submitted" | "pending" | "generating"; value: string; delta: number;
}
export const reportTypes: ReportType[] = [
  { id: "revenue", name: "Doanh thu", period: "Tháng 5/2026", status: "submitted", value: "48,2 tỷ", delta: 8 },
  { id: "gross", name: "Lợi nhuận gộp", period: "Tháng 5/2026", status: "pending", value: "14,6 tỷ", delta: -3 },
  { id: "debt", name: "Công nợ", period: "Tuần 22", status: "submitted", value: "12,4 tỷ", delta: 18 },
  { id: "inventory", name: "Tồn kho", period: "Tháng 5/2026", status: "pending", value: "38,9 tỷ", delta: 5 },
  { id: "orders", name: "Đơn hàng", period: "Tuần 22", status: "submitted", value: "1.284", delta: 12 },
  { id: "kpi", name: "KPI", period: "Tháng 5/2026", status: "generating", value: "82%", delta: 4 },
  { id: "hr", name: "Nhân sự", period: "Tháng 5/2026", status: "pending", value: "214 NV", delta: 2 },
  { id: "payroll", name: "Lương", period: "Tháng 5/2026", status: "pending", value: "4,1 tỷ", delta: 1 },
  { id: "marketing", name: "Marketing", period: "Tuần 22", status: "submitted", value: "ROI 3,2x", delta: 15 },
  { id: "risk", name: "Rủi ro", period: "Quý 2/2026", status: "pending", value: "6 mục", delta: 0 },
];

/* --- Hành động: hàng đợi --- */
export interface ActionItem {
  id: string; title: string; type: string;
  status: "suggested" | "in_progress" | "done"; assignee: string; source: string; due: string;
}
export const actionItems: ActionItem[] = [
  { id: "ac1", title: "Thu hồi công nợ quá hạn KH ABC (HCM)", type: "Tạo nhiệm vụ", status: "in_progress", assignee: "Sales HCM", source: "Cảnh báo công nợ", due: "Hôm nay" },
  { id: "ac2", title: "Lập báo cáo lợi nhuận gộp tháng 5", type: "Tạo báo cáo", status: "suggested", assignee: "—", source: "AI Dashboard", due: "25/5" },
  { id: "ac3", title: "Xuất Excel tồn kho Depot vượt ngưỡng", type: "Xuất Excel", status: "done", assignee: "Kho Depot", source: "Cảnh báo tồn kho", due: "Đã xong" },
  { id: "ac4", title: "Gửi email nhắc 5 phiếu mua chờ duyệt", type: "Gửi email", status: "suggested", assignee: "Mua hàng", source: "AI phát hiện", due: "Hôm nay" },
  { id: "ac5", title: "Tạo lịch họp review doanh thu Daisan.vn", type: "Tạo lịch họp", status: "in_progress", assignee: "Marketing", source: "Cảnh báo doanh thu", due: "Ngày mai" },
  { id: "ac6", title: "Tạo ticket sửa đồng bộ Elasticsearch", type: "Tạo ticket", status: "in_progress", assignee: "IT", source: "Cảnh báo hệ thống", due: "Hôm nay" },
  { id: "ac7", title: "Đẩy yêu cầu kiểm kê tài sản sang DGOS", type: "Đẩy DGOS", status: "suggested", assignee: "—", source: "AI phát hiện", due: "Tuần này" },
  { id: "ac8", title: "Giao chỉ tiêu KPI Sales HN cho Trưởng phòng", type: "Giao người", status: "suggested", assignee: "—", source: "Cảnh báo KPI", due: "—" },
];

/* --- SOP: thư viện quy trình --- */
export const sopCategories = ["Tất cả", "Bán hàng", "Kế toán", "Kho", "Mua hàng", "HR", "IT"];
export interface SopDoc { id: string; title: string; dept: string; version: string; updated: number; views: number; }
const d = (days: number) => Date.now() - days * 86_400_000;
export const sopDocs: SopDoc[] = [
  { id: "s1", title: "Quy trình bán hàng B2B", dept: "Bán hàng", version: "v2.1", updated: d(2), views: 142 },
  { id: "s2", title: "Hướng dẫn lập hóa đơn trên Odoo", dept: "Kế toán", version: "v1.4", updated: d(5), views: 118 },
  { id: "s3", title: "Chính sách công nợ 2026", dept: "Kế toán", version: "v3.0", updated: d(10), views: 97 },
  { id: "s4", title: "Quy trình nhập kho", dept: "Kho", version: "v1.2", updated: d(7), views: 85 },
  { id: "s5", title: "Quy trình xuất kho & giao hàng", dept: "Kho", version: "v1.1", updated: d(12), views: 64 },
  { id: "s6", title: "Quy trình duyệt đơn mua hàng", dept: "Mua hàng", version: "v2.0", updated: d(4), views: 73 },
  { id: "s7", title: "Quy trình tuyển dụng", dept: "HR", version: "v1.3", updated: d(20), views: 41 },
  { id: "s8", title: "Quy trình chấm công & tính lương", dept: "HR", version: "v2.2", updated: d(8), views: 56 },
  { id: "s9", title: "Chính sách bảo mật & phân quyền IT", dept: "IT", version: "v1.0", updated: d(30), views: 38 },
  { id: "s10", title: "Quy trình chăm sóc khách hàng", dept: "Bán hàng", version: "v1.5", updated: d(6), views: 88 },
  { id: "s11", title: "Hướng dẫn dùng cổng B2B.daisan.vn", dept: "Bán hàng", version: "v1.0", updated: d(15), views: 52 },
  { id: "s12", title: "Quy trình kiểm kê tài sản", dept: "Kho", version: "v1.1", updated: d(25), views: 29 },
];

/* --- Số liệu vận hành (Metrics) --- */
export const bizMetrics = [
  { label: "Doanh thu tháng", value: "48,2 tỷ", delta: 8, icon: "TrendingUp" },
  { label: "Đơn hàng tháng", value: "1.284", delta: 12, icon: "ShoppingCart" },
  { label: "Công nợ phải thu", value: "12,4 tỷ", delta: 18, icon: "Wallet" },
  { label: "Giá trị tồn kho", value: "38,9 tỷ", delta: 5, icon: "Package" },
  { label: "Biên LN gộp", value: "30,3%", delta: -1, icon: "Percent" },
  { label: "Khách hàng mới", value: "186", delta: 9, icon: "Users" },
];
export const branchRevenue = [
  { branch: "HN", value: 18.2 }, { branch: "HCM", value: 15.6 }, { branch: "Depot", value: 6.4 },
  { branch: "DaisanTiles", value: 5.1 }, { branch: "Daisan.vn", value: 2.9 },
];
export const revenueTrend = [
  { m: "T1", value: 38 }, { m: "T2", value: 41 }, { m: "T3", value: 44 },
  { m: "T4", value: 44.6 }, { m: "T5", value: 48.2 },
];
export interface MetricRow { branch: string; revenue: string; orders: number; debt: string; margin: string; }
export const metricRows: MetricRow[] = [
  { branch: "HN", revenue: "18,2 tỷ", orders: 486, debt: "4,1 tỷ", margin: "31%" },
  { branch: "HCM", revenue: "15,6 tỷ", orders: 412, debt: "5,2 tỷ", margin: "29%" },
  { branch: "Depot", revenue: "6,4 tỷ", orders: 198, debt: "1,4 tỷ", margin: "33%" },
  { branch: "DaisanTiles", revenue: "5,1 tỷ", orders: 142, debt: "1,1 tỷ", margin: "28%" },
  { branch: "Daisan.vn", revenue: "2,9 tỷ", orders: 246, debt: "0,6 tỷ", margin: "26%" },
];

/* --- Hỏi theo phòng ban --- */
export interface DeptInfo { id: string; name: string; icon: string; desc: string; sources: string[]; questions: string[]; }
export const deptInfo: DeptInfo[] = [
  { id: "sales", name: "Sales / Kinh doanh", icon: "ShoppingCart", desc: "Doanh thu, đơn hàng, công nợ, khách hàng, KPI bán hàng.", sources: ["Odoo", "B2B.daisan.vn", "Daisan.vn"], questions: ["Doanh thu hôm nay theo chi nhánh?", "Khách hàng nào công nợ quá hạn?", "Top sản phẩm bán chạy tuần này?"] },
  { id: "accounting", name: "Kế toán", icon: "Wallet", desc: "Hóa đơn, công nợ, dòng tiền, lợi nhuận, báo cáo tài chính.", sources: ["Odoo", "Google Sheets"], questions: ["Lợi nhuận gộp tháng 5?", "Công nợ phải thu hiện tại?", "Quy trình lập hóa đơn Odoo?"] },
  { id: "warehouse", name: "Kho", icon: "Package", desc: "Tồn kho, nhập/xuất, kiểm kê, ngưỡng cảnh báo.", sources: ["Odoo"], questions: ["Tồn kho gạch men 60x60?", "Mặt hàng nào sắp hết?", "Quy trình nhập kho?"] },
  { id: "procurement", name: "Mua hàng", icon: "ShoppingBag", desc: "Phiếu mua, nhà cung cấp, duyệt đơn, giá nhập.", sources: ["Odoo"], questions: ["Phiếu mua nào chờ duyệt?", "NCC nào giao trễ?", "Quy trình duyệt đơn mua?"] },
  { id: "hr", name: "HR / Nhân sự", icon: "UsersRound", desc: "Nhân sự, chấm công, lương, hợp đồng, tuyển dụng.", sources: ["Google Drive", "Odoo"], questions: ["Hợp đồng nào sắp hết hạn?", "Quy trình chấm công?", "Số nhân sự theo phòng ban?"] },
  { id: "marketing", name: "Marketing", icon: "Megaphone", desc: "Chiến dịch, ROI, traffic web, tin tức.", sources: ["Daisan.vn", "Drupal News"], questions: ["ROI chiến dịch tháng này?", "Traffic Daisan.vn tuần qua?"] },
  { id: "it", name: "IT", icon: "Server", desc: "Hệ thống, đồng bộ dữ liệu, phân quyền, ticket.", sources: ["Supabase", "Elasticsearch"], questions: ["Nguồn dữ liệu nào đang lỗi?", "Ticket nào chưa xử lý?"] },
];
