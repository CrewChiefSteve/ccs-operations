import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline";
}

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "badge",
        variant === "outline" && "border border-surface-4 bg-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  config: Record<string, { label: string; color: string }>;
}

export function StatusBadge({ status, config }: StatusBadgeProps) {
  const cfg = config[status] ?? {
    label: status,
    color: "bg-surface-3 text-text-secondary",
  };
  return <Badge className={cfg.color}>{cfg.label}</Badge>;
}
