import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp } from "lucide-react";
import type { ReportGrade, OpportunityBreakdown } from "@shared/schema";
import { getOpportunityIndexLabel } from "@shared/schema";

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  let colorClass = "text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300";
  if (score < 40) colorClass = "text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300";
  else if (score < 60) colorClass = "text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300";
  else if (score < 75) colorClass = "text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${colorClass}`} data-testid="badge-score">
      {label && <span>{label}</span>}
      <span className="font-bold">{score}</span>
    </div>
  );
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-50 dark:bg-emerald-950";
  if (score >= 60) return "bg-blue-50 dark:bg-blue-950";
  if (score >= 40) return "bg-amber-50 dark:bg-amber-950";
  return "bg-red-50 dark:bg-red-950";
}

export function ScorePill({ score, label }: { score: number; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${scoreBgColor(score)}`} data-testid="pill-score">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

export function OpportunityScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const color =
    score >= 21
      ? "text-red-700 bg-red-50 border-red-200"
      : score >= 14
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : score >= 8
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-gray-600 bg-gray-50 border-gray-200";
  const sizeClass = size === "md" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0";
  return (
    <Badge variant="outline" className={`${color} ${sizeClass} font-bold tabular-nums`} data-testid="badge-opportunity-score">
      <Sparkles className={size === "md" ? "w-3 h-3 mr-1" : "w-2.5 h-2.5 mr-0.5"} />
      +{score}
    </Badge>
  );
}

export function OpportunityIndexDisplay({ index, compact = false }: { index: number; compact?: boolean }) {
  const color =
    index >= 61
      ? "text-red-700"
      : index >= 41
      ? "text-amber-700"
      : index >= 21
      ? "text-blue-700"
      : "text-gray-600";
  const bgColor =
    index >= 61
      ? "bg-red-50 border-red-200"
      : index >= 41
      ? "bg-amber-50 border-amber-200"
      : index >= 21
      ? "bg-blue-50 border-blue-200"
      : "bg-gray-50 border-gray-200";

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${bgColor}`} data-testid="display-opportunity-index">
        <TrendingUp className={`w-3 h-3 ${color}`} />
        <span className={`text-xs font-bold ${color}`}>{index}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bgColor}`} data-testid="display-opportunity-index">
      <TrendingUp className={`w-4 h-4 ${color}`} />
      <div>
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-bold font-display ${color}`}>{index}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{getOpportunityIndexLabel(index)}</span>
      </div>
    </div>
  );
}

export function OpportunityBreakdownDisplay({ breakdown }: { breakdown: OpportunityBreakdown }) {
  const dims = [
    { key: "revenueImpact", label: "營收影響", value: breakdown.revenueImpact },
    { key: "severity", label: "嚴重程度", value: breakdown.severity },
    { key: "ease", label: "執行容易度", value: breakdown.ease },
    { key: "timeSensitivity", label: "時間緊迫性", value: breakdown.timeSensitivity },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="display-opportunity-breakdown">
      {dims.map((d) => (
        <div key={d.key} className="flex items-center justify-between px-2 py-1 rounded bg-muted/50">
          <span className="text-[11px] text-muted-foreground">{d.label}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < d.value ? "bg-amber-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GradeBadge({ grade }: { grade: ReportGrade }) {
  const gradeLabelsLocal: Record<ReportGrade, string> = {
    S: "頂尖水準",
    A: "表現優秀",
    B: "合格",
    C: "需改善",
    D: "問題嚴重",
    F: "不合格",
  };
  const colors: Record<ReportGrade, string> = {
    S: "bg-emerald-100 text-emerald-800 border-emerald-300",
    A: "bg-blue-100 text-blue-800 border-blue-300",
    B: "bg-sky-100 text-sky-800 border-sky-300",
    C: "bg-amber-100 text-amber-800 border-amber-300",
    D: "bg-orange-100 text-orange-800 border-orange-300",
    F: "bg-red-100 text-red-800 border-red-300",
  };
  return (
    <Badge variant="outline" className={`${colors[grade]} text-lg font-display font-bold px-3 py-1`} data-testid="badge-grade">
      {grade} - {gradeLabelsLocal[grade]}
    </Badge>
  );
}
