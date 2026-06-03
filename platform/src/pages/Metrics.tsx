import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { bizMetrics, branchRevenue, revenueTrend, metricRows } from "@/data/mock";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, ShoppingCart, Wallet, Package, Percent, Users } from "lucide-react";

const ICONS: Record<string, typeof TrendingUp> = { TrendingUp, ShoppingCart, Wallet, Package, Percent, Users };

export default function Metrics() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Trung tâm số liệu" desc="Số liệu vận hành toàn tập đoàn từ Odoo & các nền tảng Daisan — theo chi nhánh, thời gian thực." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {bizMetrics.map((mt) => {
          const Icon = ICONS[mt.icon] ?? TrendingUp;
          return (
            <Card key={mt.label}><CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/10 text-primary"><Icon size={17} /></div>
                <span className={`text-xs inline-flex items-center gap-0.5 ${mt.delta > 0 ? "text-success" : mt.delta < 0 ? "text-danger" : "text-muted-foreground"}`}>
                  {mt.delta > 0 ? <TrendingUp size={12} /> : mt.delta < 0 ? <TrendingDown size={12} /> : null}{mt.delta > 0 ? "+" : ""}{mt.delta}%
                </span>
              </div>
              <div className="text-[13px] text-muted-foreground pt-1">{mt.label}</div>
              <div className="text-xl font-semibold">{mt.value}</div>
            </CardContent></Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Doanh thu theo chi nhánh (tỷ)</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={240}><BarChart data={branchRevenue} margin={{ left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="branch" tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "hsl(210 40% 96%)" }} contentStyle={{ borderRadius: 10, border: "1px solid hsl(214 32% 91%)", fontSize: 13 }} />
            <Bar dataKey="value" fill="hsl(221 83% 53%)" radius={[6, 6, 0, 0]} barSize={42} />
          </BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Xu hướng doanh thu (tỷ)</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={240}><LineChart data={revenueTrend} margin={{ left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="m" tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(214 32% 91%)", fontSize: 13 }} />
            <Line type="monotone" dataKey="value" stroke="hsl(221 83% 53%)" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart></ResponsiveContainer>
        </CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Số liệu theo chi nhánh</CardTitle></CardHeader><CardContent className="p-0">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b bg-secondary/40 text-muted-foreground">
            <th className="text-left font-medium px-5 py-3">Chi nhánh</th>
            <th className="text-right font-medium px-3 py-3">Doanh thu</th>
            <th className="text-right font-medium px-3 py-3">Đơn hàng</th>
            <th className="text-right font-medium px-3 py-3">Công nợ</th>
            <th className="text-right font-medium px-5 py-3">Biên LN</th>
          </tr></thead>
          <tbody>{metricRows.map((r) => (
            <tr key={r.branch} className="border-b last:border-0 hover:bg-secondary/30">
              <td className="px-5 py-3 font-medium">{r.branch}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.revenue}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.orders}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.debt}</td>
              <td className="px-5 py-3 text-right tabular-nums">{r.margin}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </CardContent></Card>
    </div>
  );
}
