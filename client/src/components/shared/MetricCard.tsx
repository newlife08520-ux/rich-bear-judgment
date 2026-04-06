import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export function MetricCard({
  label,
  value,
  trend,
  semanticClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  trend?: "up" | "down" | "flat";
  semanticClassName?: string;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow",
        semanticClassName,
        className
      )}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tabular-nums text-foreground leading-tight tracking-tight">{value}</p>
        {trend ? (
          <TrendIcon
            className={cn(
              "w-5 h-5 shrink-0 mb-1",
              trend === "up" && "text-[var(--status-profit)]",
              trend === "down" && "text-[var(--status-loss)]",
              trend === "flat" && "text-muted-foreground"
            )}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
