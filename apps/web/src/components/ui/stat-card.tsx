import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
}: StatCardProps) {
  return (
    <div className={cn("card group", accent && "border-accent/30")}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-text-primary">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-status-success" : "text-status-danger"
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            accent
              ? "bg-accent/10 text-accent"
              : "bg-surface-3/50 text-text-tertiary"
          )}
        >
          <Icon className="h-4.5 w-4.5" size={18} />
        </div>
      </div>
    </div>
  );
}
