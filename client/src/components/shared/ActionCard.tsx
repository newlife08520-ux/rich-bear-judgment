import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "./StatusDot";
import type { StatusSemantic } from "./status-colors";
import { statusClasses } from "./status-colors";

export function ActionCard({
  semantic,
  title,
  subtitle,
  metrics,
  confidenceLabel,
  children,
  className,
}: {
  semantic: StatusSemantic;
  title: string;
  subtitle?: string;
  metrics?: ReactNode;
  confidenceLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { leftStripe, badge } = statusClasses(semantic);
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 pl-4 shadow-sm hover:shadow-md transition-shadow border-l-4",
        leftStripe,
        className
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <StatusDot semantic={semantic} size="md" className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground tracking-tight leading-snug">{title}</p>
            {subtitle ? (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>
          {confidenceLabel ? (
            <Badge variant="outline" className={cn("shrink-0 rounded-md", badge)}>
              {confidenceLabel}
            </Badge>
          ) : null}
        </div>
        {metrics ? (
          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 tabular-nums flex flex-wrap gap-x-3 gap-y-1">
            {metrics}
          </div>
        ) : null}
        {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
      </div>
    </div>
  );
}
