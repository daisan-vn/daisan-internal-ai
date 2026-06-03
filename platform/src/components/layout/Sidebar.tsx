import { NavLink } from "react-router-dom";
import { MODULES } from "@/data/mock";
import { cn } from "@/lib/utils";
import {
  MessagesSquare, Building2, LayoutDashboard, BarChart3, BookOpen,
  FileText, BellRing, Zap, Database, ShieldCheck, History, Sparkles,
} from "lucide-react";

const icons: Record<string, typeof LayoutDashboard> = {
  MessagesSquare, Building2, LayoutDashboard, BarChart3, BookOpen,
  FileText, BellRing, Zap, Database, ShieldCheck, History,
};
const GROUPS = ["Trợ lý", "Điều hành", "Tri thức", "Quản trị"];

export function Sidebar() {
  return (
    <aside className="w-[262px] shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/20">
          <Sparkles size={18} />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-white text-[15px]">Daisan AI</div>
          <div className="text-[11px] text-sidebar-foreground/55">Trợ lý điều hành nội bộ</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{g}</div>
            <div className="space-y-0.5">
              {MODULES.filter((mm) => mm.group === g).map((mm) => {
                const Icon = icons[mm.icon] ?? LayoutDashboard;
                return (
                  <NavLink
                    key={mm.id}
                    to={`/${mm.id}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors",
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
                      )
                    }
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="truncate">{mm.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="grid place-items-center w-8 h-8 rounded-full bg-white/10 text-white text-xs font-semibold">CE</div>
          <div className="leading-tight min-w-0">
            <div className="text-[13px] text-white truncate">ceo@daisan.vn</div>
            <div className="text-[11px] text-sidebar-foreground/50">CEO · BOD · HN</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
