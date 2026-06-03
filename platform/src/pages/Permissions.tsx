import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { rolePolicies, DEPARTMENTS, BRANCHES, SENSITIVITY, ACTIONS } from "@/data/mock";
import { ShieldCheck, Check, Plus } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  view: "Xem", ask_ai: "Hỏi AI", export: "Xuất", create_report: "Tạo BC",
  create_task: "Tạo việc", approve: "Duyệt", edit: "Sửa", delete: "Xóa",
};
const SENS_VARIANT: Record<string, "secondary" | "default" | "warning" | "danger"> = {
  "Public Internal": "secondary", Department: "default",
  Confidential: "warning", "Highly Confidential": "danger",
};

export default function Permissions() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Trung tâm phân quyền"
        desc="Kiểm soát truy cập theo vai trò × phòng ban × chi nhánh × mức nhạy cảm × hành động. Mọi câu hỏi đều kiểm tra quyền trước khi trả lời."
        actions={<Button size="sm"><Plus size={16} /> Thêm vai trò</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vai trò", value: rolePolicies.length },
          { label: "Phòng ban", value: DEPARTMENTS.length },
          { label: "Chi nhánh", value: BRANCHES.length },
          { label: "Mức nhạy cảm", value: SENSITIVITY.length },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-[13px] text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold mt-0.5">{s.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={17} className="text-primary" /> Ma trận quyền theo vai trò</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-muted-foreground">
                  <th className="text-left font-medium px-5 py-3">Vai trò</th>
                  <th className="text-left font-medium px-3 py-3">Người</th>
                  <th className="text-left font-medium px-3 py-3">Mức nhạy cảm tối đa</th>
                  <th className="text-left font-medium px-3 py-3">Hành động được phép</th>
                </tr>
              </thead>
              <tbody>
                {rolePolicies.map((r) => (
                  <tr key={r.role} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-3 font-medium whitespace-nowrap">{r.role}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.members}</td>
                    <td className="px-3 py-3"><Badge variant={SENS_VARIANT[r.sensitivity]}>{r.sensitivity}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ACTIONS.map((a) => (
                          <span key={a} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] ${r.actions.includes(a) ? "bg-success/15 text-[hsl(142_71%_30%)]" : "bg-secondary text-muted-foreground/50 line-through"}`}>
                            {r.actions.includes(a) && <Check size={10} />}{ACTION_LABEL[a]}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Phòng ban</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{DEPARTMENTS.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Chi nhánh</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{BRANCHES.map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Mức nhạy cảm dữ liệu</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{SENSITIVITY.map((s) => <Badge key={s} variant={SENS_VARIANT[s]}>{s}</Badge>)}</CardContent></Card>
      </div>
    </div>
  );
}
