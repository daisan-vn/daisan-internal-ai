import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { sopDocs, sopCategories } from "@/data/mock";
import { timeAgo } from "@/lib/utils";
import { Search, Upload, FileText } from "lucide-react";

export default function Sop() {
  const [cat, setCat] = useState("Tất cả");
  const [q, setQ] = useState("");
  const list = sopDocs.filter(
    (doc) => (cat === "Tất cả" || doc.dept === cat) && doc.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Trung tâm SOP"
        desc="Thư viện quy trình chuẩn (SOP) toàn tập đoàn — phân theo phòng ban, có phiên bản và lượt tra cứu."
        actions={<Button size="sm"><Upload size={16} /> Tải SOP lên</Button>}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm SOP…"
            className="w-full pl-9 pr-3 h-9 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring/25" />
        </div>
        <div className="flex flex-wrap gap-2">
          {sopCategories.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border transition ${cat === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((doc) => (
          <Card key={doc.id} className="hover:shadow-md transition cursor-pointer">
            <CardContent className="p-4 flex gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0"><FileText size={18} /></div>
              <div className="min-w-0">
                <div className="font-medium leading-snug">{doc.title}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{doc.dept}</Badge><span>{doc.version}</span>·<span>{doc.views} lượt</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Cập nhật {timeAgo(doc.updated)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {list.length === 0 && <div className="text-center text-muted-foreground py-12">Không tìm thấy SOP phù hợp.</div>}
    </div>
  );
}
