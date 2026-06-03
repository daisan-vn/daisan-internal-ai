import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { dashboard, alerts } from "@/data/mock";
import { fmtNum, timeAgo } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";
import {
  MessageSquare, BellRing, FileWarning, RefreshCw, DatabaseZap, Users,
  TrendingUp, TrendingDown, Minus, AlertTriangle, FileText, ArrowUpRight,
} from "lucide-react";

function Stat({ icon, label, value, sub, tone = "primary" }: {
  icon: ReactNode; label: string; value: string; sub?: ReactNode;
  tone?: "primary" | "danger" | "warning" | "success";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/15 text-[hsl(32_90%_38%)]",
    success: "bg-success/15 text-[hsl(142_71%_32%)]",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`grid place-items-center w-10 h-10 rounded-lg ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[13px] text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight mt-0.5">{value}</div>
          {sub && <div className="text-xs mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const k = dashboard.kpis;
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard điều hành AI"
        desc="Tổng quan vận hành Daisan Group — câu hỏi, cảnh báo, số liệu Odoo và sức khỏe nguồn dữ liệu."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat icon={<MessageSquare size={20} />} label="Câu hỏi hôm nay" value={fmtNum(k.questionsToday)}
          sub={<span className="text-success inline-flex items-center gap-0.5"><TrendingUp size={13} /> +{k.questionsTodayDelta}%</span>} />
        <Stat icon={<BellRing size={20} />} label="Cảnh báo đang mở" value={String(k.openAlerts)} tone="danger"
          sub={<span className="text-danger">{k.openAlertsCritical} nghiêm trọng</span>} />
        <Stat icon={<FileWarning size={20} />} label="Báo cáo chưa nộp" value={String(k.reportsPending)} tone="warning" />
        <Stat icon={<RefreshCw size={20} />} label="Odoo đồng bộ" value={`${k.odooLastSyncMin}'`} tone="success"
          sub={<span className="text-muted-foreground">phút trước</span>} />
        <Stat icon={<DatabaseZap size={20} />} label="Nguồn lỗi" value={String(k.sourcesError)} tone="danger"
          sub={<span className="text-muted-foreground">Elasticsearch</span>} />
        <Stat icon={<Users size={20} />} label="Người dùng hoạt động" value={String(k.activeUsers)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Câu hỏi theo phòng ban</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dashboard.questionsByDept} margin={{ left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" />
                <XAxis dataKey="dept" tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "hsl(210 40% 96%)" }} contentStyle={{ borderRadius: 10, border: "1px solid hsl(214 32% 91%)", fontSize: 13 }} />
                <Bar dataKey="value" fill="hsl(221 83% 53%)" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Xu hướng câu hỏi 7 ngày</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dashboard.trend7d} margin={{ left: -18 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(214 32% 91%)", fontSize: 13 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(221 83% 53%)" strokeWidth={2.5} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Số liệu Odoo mới nhất</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboard.latestOdoo.map((o) => {
              const Icon = o.trend === "up" ? TrendingUp : o.trend === "down" ? TrendingDown : Minus;
              const c = o.trend === "up" ? "text-success" : o.trend === "down" ? "text-danger" : "text-muted-foreground";
              return (
                <div key={o.metric} className="rounded-lg border bg-secondary/40 p-4">
                  <div className="text-[13px] text-muted-foreground flex items-center justify-between">{o.metric} <Icon size={15} className={c} /></div>
                  <div className="text-xl font-semibold mt-1">{o.value}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={17} className="text-warning" /> Top vấn đề AI phát hiện</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {dashboard.topIssues.map((it, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-secondary text-xs font-medium shrink-0 mt-0.5">{i + 1}</span>
                <span className="flex-1">{it.issue}</span>
                <Badge variant={it.severity === "Cao" ? "danger" : "warning"}>{it.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText size={17} className="text-primary" /> Top tài liệu được tra cứu</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {dashboard.topDocuments.map((d, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-secondary text-xs font-medium shrink-0">{i + 1}</span>
                <span className="flex-1 truncate">{d.doc}</span>
                <span className="text-muted-foreground text-xs shrink-0">{d.views} lượt</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><BellRing size={17} className="text-danger" /> Cảnh báo đang mở</CardTitle>
          <a href="/alerts" className="text-sm text-primary inline-flex items-center gap-1">Xem tất cả <ArrowUpRight size={14} /></a>
        </CardHeader>
        <CardContent className="space-y-1">
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === "critical" ? "bg-danger" : a.severity === "warning" ? "bg-warning" : "bg-primary"}`} />
              <span className="font-medium w-44 shrink-0 truncate">{a.title}</span>
              <Badge variant="outline">{a.type}</Badge>
              <span className="text-muted-foreground hidden md:inline">{a.scope}</span>
              <span className="flex-1" />
              <span className="font-medium hidden sm:inline">{a.value}</span>
              <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{timeAgo(a.at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
