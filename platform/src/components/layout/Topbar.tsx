import { Bell, Search, ChevronDown } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-16 shrink-0 border-b bg-card flex items-center gap-4 px-6">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Tìm tài liệu, số liệu, báo cáo…"
          className="w-full pl-9 pr-3 h-9 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/25"
        />
      </div>
      <button className="relative grid place-items-center w-9 h-9 rounded-lg hover:bg-secondary" aria-label="Thông báo">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-card" />
      </button>
      <button className="flex items-center gap-2 h-9 px-2.5 rounded-lg border hover:bg-secondary text-sm">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">CE</span>
        <span className="font-medium">CEO</span>
        <ChevronDown size={15} className="text-muted-foreground" />
      </button>
    </header>
  );
}
