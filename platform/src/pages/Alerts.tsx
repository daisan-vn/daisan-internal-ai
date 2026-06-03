import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { alertList } from "@/data/mock";
import { timeAgo } from "@/lib/utils";
import { Zap } from "lucide-react";

const SEV: Record<string, { label: string; variant: "danger" | "warning" | "secondary"; dot: string }> = {
  critical: { label: "Nghiêm trọng", variant: "danger", dot: "bg-danger" },
  warning: { label: "Cảnh báo", variant: "warning", dot: "bg-warning" },
  info: { label: "Thông tin", variant: "secondary", dot: "bg-primary" },
};
const FILTERS = [
  { k: "all", l: "Tất cả" }, { k: "critical", l: "Nghiêm trọng" },
  { k: "warning", l: "Cảnh báo" }, { k: "info", l: "Thông tin" },
];

export default function Alerts() {
  const [f, setF] = useState("all");
  const list = f === "all" ? alertList : alertList.filter((a) => a.severity === f);
  const count = (s: string) => alertList.filter((a) => a.severity === s).length;
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Trung tâm cảnh báo" desc="Theo dõi 13 loại cảnh báo vận hành — tài chính, kho, kinh doanh, nhân sự, hệ thống. AI gợi ý hành động xử lý." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Tổng cảnh báo</div><div className="text-2xl font-semibold mt-0.5">{alertList.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Nghiêm trọng</div><div className="text-2xl font-semibold mt-0.5 text-danger">{count("critical")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Cảnh báo</div><div className="text-2xl font-semibold mt-0.5 text-[hsl(32_90%_40%)]">{count("warning")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Thông tin</div><div className="text-2xl font-semibold mt-0.5 text-primary">{count("info")}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button key={x.k} onClick={() => setF(x.k)}
            className={`px-3.5 py-1.5 rounded-lg text-sm border transition ${f === x.k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"}`}>{x.l}</button>
        ))}
      </div>

      <Card><CardContent className="p-0">
        {list.map((a) => {
          const s = SEV[a.severity];
          return (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0 hover:bg-secondary/30">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center gap-2">{a.title} <Badge variant="outline">{a.type}</Badge></div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.scope} · {timeAgo(a.at)}</div>
              </div>
              <div className="text-sm font-medium text-right shrink-0 hidden sm:block">{a.value}</div>
              <Badge variant={s.variant}>{s.label}</Badge>
              <Button size="sm" variant="outline"><Zap size={14} /> Xử lý</Button>
            </div>
          );
        })}
      </CardContent></Card>
    </div>
  );
}
