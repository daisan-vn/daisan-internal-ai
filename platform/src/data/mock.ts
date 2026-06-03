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
