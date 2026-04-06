import { Badge } from "@/components/ui/badge";
import type { ReportGrade } from "@shared/schema";

export function HistoryScoreBadge({ score, grade }: { score: number; grade: ReportGrade }) {
  const color =
    score >= 70
      ? "text-[var(--status-profit)] bg-[var(--status-profit-surface)] border border-[var(--status-profit-light)]"
      : score >= 40
        ? "text-amber-700 bg-amber-50 border border-amber-200 dark:border-amber-800/50"
        : "text-rose-700 bg-rose-50 border border-rose-200 dark:border-rose-800/50";
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`${color} font-display text-sm font-bold tabular-nums`}>
        {score}
      </Badge>
      <span className="text-xs text-muted-foreground">{grade}</span>
    </div>
  );
}
