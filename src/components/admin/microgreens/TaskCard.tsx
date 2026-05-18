import { cn } from "@/lib/utils";

export function TaskCard({
  title, subtitle, action, tone = "default", warning,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "overdue" | "warning";
  warning?: string;
}) {
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      tone === "default" && "border-farm-muted/20 bg-white",
      tone === "overdue" && "border-red-400 bg-red-50",
      tone === "warning" && "border-amber-400 bg-amber-50",
    )}>
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-sm text-farm-muted mt-1">{subtitle}</div>}
      {warning && <div className="text-xs text-amber-800 mt-2">⚠ {warning}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
