import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { deptInfo } from "@/data/mock";
import { ShoppingCart, Wallet, Package, ShoppingBag, UsersRound, Megaphone, Server, Send, Sparkles } from "lucide-react";

const ICONS: Record<string, typeof ShoppingCart> = { ShoppingCart, Wallet, Package, ShoppingBag, UsersRound, Megaphone, Server };

export default function DeptAsk() {
  const [sel, setSel] = useState(deptInfo[0]);
  const Icon = ICONS[sel.icon] ?? ShoppingCart;
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Hỏi theo phòng ban" desc="Chọn phòng ban để hỏi AI trong phạm vi dữ liệu & quyền của phòng đó — câu trả lời chính xác hơn, đúng nguồn." />
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <div className="space-y-1.5">
          {deptInfo.map((dp) => {
            const I = ICONS[dp.icon] ?? ShoppingCart;
            return (
              <button key={dp.id} onClick={() => setSel(dp)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition ${sel.id === dp.id ? "bg-primary/5 border-primary/40" : "bg-card hover:bg-secondary"}`}>
                <div className={`grid place-items-center w-9 h-9 rounded-lg ${sel.id === dp.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}><I size={17} /></div>
                <span className="font-medium text-sm">{dp.name}</span>
              </button>
            );
          })}
        </div>

        <Card><CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white"><Icon size={22} /></div>
            <div><div className="text-lg font-semibold">{sel.name}</div><div className="text-sm text-muted-foreground">{sel.desc}</div></div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">NGUỒN DỮ LIỆU</div>
            <div className="flex flex-wrap gap-2">{sel.sources.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Sparkles size={13} /> CÂU HỎI GỢI Ý</div>
            <div className="space-y-2">{sel.questions.map((q) => (
              <button key={q} className="w-full text-left rounded-lg border bg-background px-4 py-2.5 text-sm hover:bg-secondary transition">{q}</button>
            ))}</div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border bg-background p-2 pl-4">
            <input placeholder={`Hỏi AI về ${sel.name}…`} className="flex-1 bg-transparent outline-none text-sm py-2" />
            <button className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-primary-foreground"><Send size={16} /></button>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
