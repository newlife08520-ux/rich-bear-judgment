import { Badge } from "@/components/ui/badge";
import type { ReportGrade } from "@shared/schema";

export function HistoryScoreBadge({ score, grade }: { score: number; grade: ReportGrade }) {
  const color =
    score >= 70
      ? "text-emerald-600 bg-emerald-500/10"
      : score >= 40
        ? "text-amber-600 bg-amber-500/10"
        : "text-red-600 bg-red-500/10";
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className={`${color} font-display text-sm font-bold tabular-nums`}>
        {score}
      </Badge>
      <span className="text-xs text-muted-foreground">{grade}</span>
    </div>
  );
}
