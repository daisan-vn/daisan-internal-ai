import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { reportTypes } from "@/data/mock";
import { Sparkles, TrendingUp, TrendingDown, FileText, AlertTriangle, ArrowRight } from "lucide-react";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
  submitted: { label: "Đã nộp", variant: "success" },
  pending: { label: "Chưa nộp", variant: "warning" },
  generating: { label: "AI đang tạo", variant: "default" },
};

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Trung tâm báo cáo"
        desc="AI tạo báo cáo, tóm tắt, so sánh kỳ trước, chỉ ra bất thường và đề xuất hành động."
        actions={<Button size="sm"><Sparkles size={16} /> Tạo báo cáo bằng AI</Button>}
      />

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles size={17} className="text-primary" /> AI tóm tắt — Báo cáo doanh thu tháng 5/2026</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Doanh thu tháng 5 đạt <b>48,2 tỷ</b> (+8% so tháng 4). Tăng trưởng chủ yếu từ <b>kênh B2B (+15%)</b> và <b>DaisanTiles (+11%)</b>.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">So kỳ trước</div><div className="font-semibold text-success flex items-center gap-1"><TrendingUp size={15} /> +8%</div></div>
            <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Bất thường</div><div className="font-semibold text-danger flex items-center gap-1"><AlertTriangle size={15} /> Daisan.vn −7%</div></div>
            <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">AI đề xuất</div><div className="font-semibold">Đẩy KM kênh online</div></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline">So sánh kỳ trước</Button>
            <Button size="sm" variant="outline">Phân tích bất thường</Button>
            <Button size="sm" variant="outline">Tạo nhiệm vụ <ArrowRight size={14} /></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {reportTypes.map((r) => {
          const s = STATUS[r.status];
          return (
            <Card key={r.id} className="hover:shadow-md transition cursor-pointer">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/10 text-primary"><FileText size={17} /></div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.period}</div>
                <div className="flex items-end justify-between pt-1">
                  <div className="text-lg font-semibold">{r.value}</div>
                  <span className={`text-xs inline-flex items-center gap-0.5 ${r.delta > 0 ? "text-success" : r.delta < 0 ? "text-danger" : "text-muted-foreground"}`}>
                    {r.delta > 0 ? <TrendingUp size={12} /> : r.delta < 0 ? <TrendingDown size={12} /> : null}{r.delta > 0 ? "+" : ""}{r.delta}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
