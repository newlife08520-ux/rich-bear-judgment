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
  const { bar } = statusClasses(semantic);
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden pl-5",
        className
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl", bar)} />
      <div className="pl-1 space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <StatusDot semantic={semantic} size="md" className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
            {subtitle ? <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p> : null}
          </div>
          {confidenceLabel ? (
            <Badge variant="outline" className="text-xs shrink-0 rounded-md">
              {confidenceLabel}
            </Badge>
          ) : null}
        </div>
        {metrics ? <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">{metrics}</div> : null}
        {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
      </div>
    </div>
  );
}
