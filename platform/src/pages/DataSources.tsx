import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { dataSources } from "@/data/mock";
import { fmtNum, timeAgo } from "@/lib/utils";
import { Database, RefreshCw, Plus } from "lucide-react";

const STATUS: Record<string, { label: string; variant: "success" | "default" | "danger" | "secondary"; dot: string }> = {
  connected: { label: "Đã kết nối", variant: "success", dot: "bg-success" },
  syncing: { label: "Đang đồng bộ", variant: "default", dot: "bg-primary animate-pulse" },
  error: { label: "Lỗi", variant: "danger", dot: "bg-danger" },
  disconnected: { label: "Ngắt", variant: "secondary", dot: "bg-muted-foreground" },
};

export default function DataSources() {
  const ok = dataSources.filter((d) => d.status === "connected").length;
  const err = dataSources.filter((d) => d.status === "error").length;
  const total = dataSources.reduce((s, d) => s + d.records, 0);
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Quản trị nguồn dữ liệu"
        desc="Trạng thái kết nối, đồng bộ, người quản trị và quyền truy cập của toàn bộ nguồn dữ liệu Daisan."
        actions={<>
          <Button size="sm" variant="outline"><RefreshCw size={15} /> Đồng bộ tất cả</Button>
          <Button size="sm"><Plus size={16} /> Thêm nguồn</Button>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Tổng nguồn</div><div className="text-2xl font-semibold mt-0.5">{dataSources.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Đang kết nối</div><div className="text-2xl font-semibold mt-0.5 text-success">{ok}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Đang lỗi</div><div className="text-2xl font-semibold mt-0.5 text-danger">{err}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Bản ghi (ước tính)</div><div className="text-2xl font-semibold mt-0.5">{fmtNum(total)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database size={17} className="text-primary" /> Danh sách nguồn dữ liệu</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-muted-foreground">
                  <th className="text-left font-medium px-5 py-3">Nguồn</th>
                  <th className="text-left font-medium px-3 py-3">Loại dữ liệu</th>
                  <th className="text-left font-medium px-3 py-3">Trạng thái</th>
                  <th className="text-left font-medium px-3 py-3">Đồng bộ cuối</th>
                  <th className="text-left font-medium px-3 py-3">Quản trị</th>
                  <th className="text-left font-medium px-3 py-3">Quyền truy cập</th>
                  <th className="text-right font-medium px-5 py-3">Bản ghi</th>
                </tr>
              </thead>
              <tbody>
                {dataSources.map((d) => {
                  const s = STATUS[d.status];
                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-3 font-medium whitespace-nowrap">{d.name}</td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[230px] truncate">{d.kind}</td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${s.dot}`} /><Badge variant={s.variant}>{s.label}</Badge></span></td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{timeAgo(d.lastSync)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{d.admin}</td>
                      <td className="px-3 py-3"><Badge variant="outline">{d.access}</Badge></td>
                      <td className="px-5 py-3 text-right tabular-nums">{d.records ? fmtNum(d.records) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
