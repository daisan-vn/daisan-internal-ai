import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { queryLogs } from "@/data/mock";
import { timeAgo } from "@/lib/utils";
import { Check, X } from "lucide-react";

const FILTERS = [{ k: "all", l: "Tất cả" }, { k: "allowed", l: "Được phép" }, { k: "denied", l: "Bị chặn" }];

export default function Audit() {
  const [f, setF] = useState("all");
  const list = f === "all" ? queryLogs : queryLogs.filter((q) => q.permission === f);
  const allowed = queryLogs.filter((q) => q.permission === "allowed").length;
  const denied = queryLogs.filter((q) => q.permission === "denied").length;
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Lịch sử truy vấn & Audit log" desc="Ghi lại mọi câu hỏi, nguồn dữ liệu và kết quả kiểm tra quyền. Truy vấn vượt quyền bị chặn và đánh dấu rõ." />

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Truy vấn (hôm nay)</div><div className="text-2xl font-semibold mt-0.5">{queryLogs.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Được phép</div><div className="text-2xl font-semibold mt-0.5 text-success">{allowed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[13px] text-muted-foreground">Bị chặn (vượt quyền)</div><div className="text-2xl font-semibold mt-0.5 text-danger">{denied}</div></CardContent></Card>
      </div>

      <div className="flex gap-2">{FILTERS.map((x) => (
        <button key={x.k} onClick={() => setF(x.k)} className={`px-3.5 py-1.5 rounded-lg text-sm border transition ${f === x.k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"}`}>{x.l}</button>
      ))}</div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-secondary/40 text-muted-foreground">
          <th className="text-left font-medium px-5 py-3">Người dùng</th>
          <th className="text-left font-medium px-3 py-3">Vai trò</th>
          <th className="text-left font-medium px-3 py-3">Câu hỏi</th>
          <th className="text-left font-medium px-3 py-3">Nguồn</th>
          <th className="text-left font-medium px-3 py-3">Quyền</th>
          <th className="text-right font-medium px-5 py-3">Thời gian</th>
        </tr></thead>
        <tbody>{list.map((q) => (
          <tr key={q.id} className="border-b last:border-0 hover:bg-secondary/30">
            <td className="px-5 py-3 whitespace-nowrap">{q.user}</td>
            <td className="px-3 py-3"><Badge variant="secondary">{q.role}</Badge></td>
            <td className="px-3 py-3 max-w-[280px] truncate">{q.query}</td>
            <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{q.source}</td>
            <td className="px-3 py-3">{q.permission === "allowed"
              ? <Badge variant="success"><Check size={11} /> Được phép</Badge>
              : <Badge variant="danger"><X size={11} /> Bị chặn</Badge>}</td>
            <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap">{timeAgo(q.at)}</td>
          </tr>
        ))}</tbody>
      </table></div></CardContent></Card>
    </div>
  );
}
