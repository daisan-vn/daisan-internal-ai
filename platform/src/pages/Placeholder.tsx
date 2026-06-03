import { PageHeader } from "@/components/PageHeader";
import { Construction } from "lucide-react";

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <PageHeader title={title} desc="Module nằm trong lộ trình Phase 2–3. Giao diện & dữ liệu sẽ được bổ sung." />
      <div className="grid place-items-center h-[58vh] text-center">
        <div className="space-y-3">
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-accent text-accent-foreground">
            <Construction size={30} />
          </div>
          <p className="text-muted-foreground max-w-sm">
            Sắp ra mắt. Ở Phase 1, các màn <b>Dashboard điều hành</b>, <b>Phân quyền</b>,
            <b> Quản trị nguồn dữ liệu</b> và <b>Trò chuyện AI</b> đã sẵn sàng để xem.
          </p>
        </div>
      </div>
    </div>
  );
}
