import { useState, useRef, useEffect } from "react";
import { Sparkles, Send } from "lucide-react";
import { aiActions } from "@/data/mock";
import { Badge } from "@/components/ui/badge";

interface Msg { role: "user" | "assistant"; content: string; sources?: string[]; actions?: boolean }

const EXAMPLES = [
  "Công nợ quá hạn của chi nhánh HCM hiện tại?",
  "Tồn kho gạch men 60x60 còn bao nhiêu?",
  "Quy trình tạo hóa đơn bán hàng trong Odoo?",
  "So sánh doanh thu tháng này với tháng trước?",
];

// Phase 1: mô phỏng phản hồi RAG. Phase sau nối /api/chat thật (Odoo + tài liệu + kiểm quyền).
function mockAnswer(q: string): Msg {
  return {
    role: "assistant",
    content:
      `Dựa trên dữ liệu nội bộ Daisan, đây là phản hồi cho câu hỏi: “${q}”.\n\n` +
      `• Tổng hợp từ Odoo và tài liệu SOP liên quan.\n` +
      `• Đây là bản prototype — số liệu mô phỏng, sẽ nối Odoo/Supabase thật ở phase sau.\n\n` +
      `Bạn có muốn mình tạo báo cáo, giao việc hay xuất Excel từ kết quả này không?`,
    sources: ["Odoo · Sales", "SOP · Google Drive"],
    actions: true,
  };
}

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  function send(q: string) {
    const text = q.trim();
    if (!text) return;
    setMsgs((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setTimeout(() => setMsgs((prev) => [...prev, mockAnswer(text)]), 450);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {msgs.length === 0 ? (
            <div className="text-center pt-[7vh] space-y-3">
              <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white"><Sparkles size={28} /></div>
              <h2 className="text-2xl font-semibold">Trợ lý AI nội bộ Daisan</h2>
              <p className="text-muted-foreground max-w-md mx-auto">Hỏi về số liệu Odoo, tài liệu, SOP, công nợ, tồn kho… AI trả lời theo quyền của bạn và luôn kèm nguồn.</p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-4">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} className="text-left text-[13.5px] rounded-xl border bg-card p-3.5 hover:bg-secondary hover:-translate-y-0.5 transition">{e}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {msgs.map((mm, i) => (
                <div key={i} className={mm.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {mm.role === "assistant" && <div className="grid place-items-center w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white"><Sparkles size={16} /></div>}
                  <div className={mm.role === "user" ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5" : "flex-1 min-w-0"}>
                    <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{mm.content}</div>
                    {mm.sources && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        Nguồn: {mm.sources.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                      </div>
                    )}
                    {mm.actions && (
                      <div className="mt-4 rounded-xl border bg-accent/40 p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">⚡ Trung tâm hành động — AI đề xuất:</div>
                        <div className="flex flex-wrap gap-2">
                          {aiActions.map((a) => (
                            <button key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-[13px] hover:bg-secondary">{a.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border bg-background p-2 pl-4 focus-within:ring-2 focus-within:ring-ring/25">
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder="Hỏi về Odoo, công nợ, tồn kho, tài liệu…"
            className="flex-1 resize-none bg-transparent outline-none text-[15px] py-2 max-h-40"
          />
          <button type="submit" disabled={!input.trim()}
            className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"><Send size={17} /></button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-2">Prototype — phản hồi mô phỏng. Phase sau: kiểm tra quyền + ghi audit log + nối Odoo/tài liệu thật.</p>
      </div>
    </div>
  );
}
