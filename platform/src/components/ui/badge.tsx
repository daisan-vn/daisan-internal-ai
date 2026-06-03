import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "danger" | "outline";
const styles: Record<Variant, string> = {
  default: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-[hsl(142_71%_32%)]",
  warning: "bg-warning/15 text-[hsl(32_90%_38%)]",
  danger: "bg-danger/10 text-danger",
  outline: "border text-muted-foreground",
};

export function Badge({
  className, variant = "default", ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", styles[variant], className)}
      {...props}
    />
  );
}
