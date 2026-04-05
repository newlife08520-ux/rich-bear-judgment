import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoringResult, V2Scores, DiagnosisType, RecommendedAction } from "@shared/schema";
import { DIAGNOSIS_LABELS, ACTION_LABELS } from "@shared/schema";

/** Phase 8 Badge 四色 + slate 中性，皆含 border */
const diagnosisChip: Record<DiagnosisType, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50",
  scaling_ready: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  creative_fatigue: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  roas_declining: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  roas_critical: "bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50",
  ctr_declining: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  cpc_spike: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  budget_waste: "bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50",
  audience_saturation: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  conversion_drop: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  funnel_leak: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  checkout_abandon: "bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50",
  page_bounce: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  insufficient_data: "bg-slate-100 text-slate-600 border border-slate-200 dark:border-border",
};

const actionChip: Record<RecommendedAction, string> = {
  maintain: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50",
  scale_budget: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  reduce_budget: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  pause: "bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50",
  refresh_creative: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  expand_audience: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  narrow_audience: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  ab_test: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  optimize_landing: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  simplify_checkout: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50",
  add_trust_signals: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  monitor: "bg-slate-100 text-slate-600 border border-slate-200 dark:border-border",
  restart: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
  investigate: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
};

export function DiagnosisBadge({ diagnosis, className }: { diagnosis: DiagnosisType; className?: string }) {
  const chip = diagnosisChip[diagnosis] || diagnosisChip.insufficient_data;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs px-1.5 py-0", chip, className)}
      data-testid={`badge-diagnosis-${diagnosis}`}
    >
      {DIAGNOSIS_LABELS[diagnosis]}
    </Badge>
  );
}

export function ActionBadge({ action, className }: { action: RecommendedAction; className?: string }) {
  const chip = actionChip[action] || actionChip.monitor;
  return (
    <Badge variant="outline" className={cn("text-xs px-1.5 py-0", chip, className)} data-testid={`badge-action-${action}`}>
      {ACTION_LABELS[action]}
    </Badge>
  );
}

export function V2ScoreMini({ scoring }: { scoring?: ScoringResult }) {
  if (!scoring) return null;
  const items = [
    { label: "健康", value: scoring.scores.health, color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "急迫", value: scoring.scores.urgency, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
    { label: "機會", value: scoring.scores.opportunity, color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
  ];
  return (
    <div className="flex items-center gap-2" data-testid="v2-score-mini">
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-center gap-0.5">
          {idx > 0 && <span className="text-xs text-muted-foreground/40 mr-0.5">/</span>}
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className={cn("text-[11px] font-semibold", item.textColor)}>{item.value}</span>
          <div className="w-6 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function V2ScoreBar({ scoring }: { scoring?: ScoringResult }) {
  if (!scoring) return null;
  const items = [
    { label: "健康", value: scoring.scores.health, color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "急迫", value: scoring.scores.urgency, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
    { label: "機會", value: scoring.scores.opportunity, color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
  ];
  return (
    <div className="flex gap-3" data-testid="v2-score-bar">
      {items.map((item) => (
        <div key={item.label} className="flex-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className={cn("text-xs font-semibold tabular-nums", item.textColor)}>{item.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScoringDetailTooltip({ scoring }: { scoring: ScoringResult }) {
  return (
    <div className="space-y-1.5 text-xs max-w-[280px]" data-testid="scoring-detail">
      <div className="flex items-center gap-2 mb-1">
        <DiagnosisBadge diagnosis={scoring.diagnosis} />
        <ActionBadge action={scoring.recommendedAction} />
      </div>
      <V2ScoreBar scoring={scoring} />
      {scoring.benchmarkBasis && (
        <p className="text-muted-foreground">
          <span className="font-medium">判斷依據：</span>
          {scoring.benchmarkBasis}
        </p>
      )}
      {scoring.timeWindowBasis && (
        <p className="text-muted-foreground">
          <span className="font-medium">時間窗口：</span>
          {scoring.timeWindowBasis}
        </p>
      )}
      {scoring.notes.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium">備註：</span>
          {scoring.notes.join("；")}
        </p>
      )}
    </div>
  );
}

export function ScoringInline({ scoring }: { scoring?: ScoringResult }) {
  if (!scoring) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-testid="scoring-inline">
      <DiagnosisBadge diagnosis={scoring.diagnosis} />
      <ActionBadge action={scoring.recommendedAction} />
    </div>
  );
}

export function BenchmarkInfo({ scoring }: { scoring?: ScoringResult }) {
  if (!scoring?.benchmarkBasis && !scoring?.timeWindowBasis) return null;
  return (
    <span className="text-xs text-muted-foreground" data-testid="benchmark-info">
      {scoring.benchmarkBasis && scoring.benchmarkBasis}
      {scoring.benchmarkBasis && scoring.timeWindowBasis && " / "}
      {scoring.timeWindowBasis && scoring.timeWindowBasis}
    </span>
  );
}
