import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { actionItems, aiActions } from "@/data/mock";
import { ListTodo, UserPlus, FileText, Sheet, Mail, CalendarPlus, Ticket, Send } from "lucide-react";

const ICONS: Record<string, typeof ListTodo> = { ListTodo, UserPlus, FileText, Sheet, Mail, CalendarPlus, Ticket, Send };
const STATUS: Record<string, { label: string; variant: "default" | "warning" | "success" }> = {
  suggested: { label: "AI đề xuất", variant: "default" },
  in_progress: { label: "Đang xử lý", variant: "warning" },
  done: { label: "Hoàn thành", variant: "success" },
};

export default function Actions() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Trung tâm hành động" desc="Sau mỗi câu trả lời hoặc cảnh báo, AI đề xuất hành động — tạo việc, giao người, báo cáo, Excel, email, họp, ticket, đẩy DGOS." />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {aiActions.map((a) => {
          const Icon = ICONS[a.icon] ?? ListTodo;
          return (
            <button key={a.id} className="rounded-xl border bg-card p-3 hover:bg-secondary hover:-translate-y-0.5 transition flex flex-col items-center gap-2 text-center">
              <div className="grid place-items-center w-9 h-9 rounded-lg bg-primary/10 text-primary"><Icon size={17} /></div>
              <span className="text-xs font-medium leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hàng đợi hành động</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-muted-foreground">
                  <th className="text-left font-medium px-5 py-3">Hành động</th>
                  <th className="text-left font-medium px-3 py-3">Loại</th>
                  <th className="text-left font-medium px-3 py-3">Nguồn</th>
                  <th className="text-left font-medium px-3 py-3">Phụ trách</th>
                  <th className="text-left font-medium px-3 py-3">Hạn</th>
                  <th className="text-left font-medium px-3 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {actionItems.map((a) => {
                  const s = STATUS[a.status];
                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-3 font-medium">{a.title}</td>
                      <td className="px-3 py-3"><Badge variant="outline">{a.type}</Badge></td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{a.source}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{a.assignee}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{a.due}</td>
                      <td className="px-3 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
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
