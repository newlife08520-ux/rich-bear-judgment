import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp } from "lucide-react";
import type { ReportGrade, OpportunityBreakdown } from "@shared/schema";
import { getOpportunityIndexLabel } from "@shared/schema";

const CHIP_PROFIT =
  "bg-[var(--status-profit-surface)] text-[var(--status-profit)] border border-[var(--status-profit-light)]";
const CHIP_LOSS =
  "bg-[var(--status-loss-surface)] text-[var(--status-loss)] border border-[var(--status-loss-light)]";
const CHIP_WATCH =
  "bg-[var(--status-watch-surface)] text-[var(--status-watch)] border border-[var(--status-watch-light)]";
const CHIP_DORMANT =
  "bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border border-[var(--status-dormant-light)]";

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  let colorClass = CHIP_PROFIT;
  if (score < 40) colorClass = CHIP_LOSS;
  else if (score < 60) colorClass = CHIP_WATCH;
  else if (score < 75) colorClass = CHIP_DORMANT;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${colorClass}`} data-testid="badge-score">
      {label && <span>{label}</span>}
      <span className="font-bold">{score}</span>
    </div>
  );
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--status-profit)]";
  if (score >= 60) return "text-[var(--status-dormant)]";
  if (score >= 40) return "text-[var(--status-watch)]";
  return "text-[var(--status-loss)]";
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-[var(--status-profit-surface)]";
  if (score >= 60) return "bg-[var(--status-dormant-surface)]";
  if (score >= 40) return "bg-[var(--status-watch-surface)]";
  return "bg-[var(--status-loss-surface)]";
}

export function ScorePill({ score, label }: { score: number; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 dark:border-border ${scoreBgColor(score)}`} data-testid="pill-score">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

export function OpportunityScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const color =
    score >= 21
      ? CHIP_LOSS
      : score >= 14
        ? CHIP_WATCH
        : score >= 8
          ? CHIP_DORMANT
          : "text-muted-foreground bg-muted/50 border border-border";
  const sizeClass = size === "md" ? "text-xs px-2 py-0.5" : "text-xs px-1.5 py-0";
  return (
    <Badge variant="outline" className={`${color} ${sizeClass} font-bold tabular-nums`} data-testid="badge-opportunity-score">
      <Sparkles className={size === "md" ? "w-3 h-3 mr-1" : "w-2.5 h-2.5 mr-0.5"} />+{score}
    </Badge>
  );
}

export function OpportunityIndexDisplay({ index, compact = false }: { index: number; compact?: boolean }) {
  const color =
    index >= 61
      ? "text-[var(--status-loss)]"
      : index >= 41
        ? "text-[var(--status-watch)]"
        : index >= 21
          ? "text-[var(--status-dormant)]"
          : "text-muted-foreground";
  const bgColor =
    index >= 61
      ? "bg-[var(--status-loss-surface)] border border-[var(--status-loss-light)]"
      : index >= 41
        ? "bg-[var(--status-watch-surface)] border border-[var(--status-watch-light)]"
        : index >= 21
          ? "bg-[var(--status-dormant-surface)] border border-[var(--status-dormant-light)]"
          : "bg-muted/50 border border-border";

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${bgColor}`} data-testid="display-opportunity-index">
        <TrendingUp className={`w-3 h-3 ${color}`} />
        <span className={`text-xs font-bold ${color}`}>{index}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor}`} data-testid="display-opportunity-index">
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
                className={`w-2 h-2 rounded-full ${i < d.value ? "bg-[var(--status-watch)]" : "bg-slate-200 dark:bg-slate-700"}`}
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
    S: CHIP_PROFIT,
    A: CHIP_DORMANT,
    B: CHIP_DORMANT,
    C: CHIP_WATCH,
    D: CHIP_WATCH,
    F: CHIP_LOSS,
  };
  return (
    <Badge variant="outline" className={`${colors[grade]} text-lg font-display font-bold px-3 py-1`} data-testid="badge-grade">
      {grade} - {gradeLabelsLocal[grade]}
    </Badge>
  );
}
