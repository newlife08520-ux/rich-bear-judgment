import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoringResult, V2Scores, DiagnosisType, RecommendedAction } from "@shared/schema";
import { DIAGNOSIS_LABELS, ACTION_LABELS } from "@shared/schema";

const diagnosisColors: Record<DiagnosisType, { bg: string; text: string }> = {
  healthy: { bg: "bg-emerald-100", text: "text-emerald-700" },
  scaling_ready: { bg: "bg-blue-100", text: "text-blue-700" },
  creative_fatigue: { bg: "bg-amber-100", text: "text-amber-700" },
  roas_declining: { bg: "bg-orange-100", text: "text-orange-700" },
  roas_critical: { bg: "bg-red-100", text: "text-red-700" },
  ctr_declining: { bg: "bg-amber-100", text: "text-amber-700" },
  cpc_spike: { bg: "bg-orange-100", text: "text-orange-700" },
  budget_waste: { bg: "bg-red-100", text: "text-red-700" },
  audience_saturation: { bg: "bg-violet-100", text: "text-violet-700" },
  conversion_drop: { bg: "bg-amber-100", text: "text-amber-700" },
  funnel_leak: { bg: "bg-orange-100", text: "text-orange-700" },
  checkout_abandon: { bg: "bg-red-100", text: "text-red-700" },
  page_bounce: { bg: "bg-amber-100", text: "text-amber-700" },
  insufficient_data: { bg: "bg-gray-100", text: "text-gray-600" },
};

const actionColors: Record<RecommendedAction, { bg: string; text: string }> = {
  maintain: { bg: "bg-emerald-50", text: "text-emerald-700" },
  scale_budget: { bg: "bg-blue-50", text: "text-blue-700" },
  reduce_budget: { bg: "bg-amber-50", text: "text-amber-700" },
  pause: { bg: "bg-red-50", text: "text-red-700" },
  refresh_creative: { bg: "bg-violet-50", text: "text-violet-700" },
  expand_audience: { bg: "bg-sky-50", text: "text-sky-700" },
  narrow_audience: { bg: "bg-indigo-50", text: "text-indigo-700" },
  ab_test: { bg: "bg-cyan-50", text: "text-cyan-700" },
  optimize_landing: { bg: "bg-teal-50", text: "text-teal-700" },
  simplify_checkout: { bg: "bg-emerald-50", text: "text-emerald-700" },
  add_trust_signals: { bg: "bg-blue-50", text: "text-blue-700" },
  monitor: { bg: "bg-gray-50", text: "text-gray-700" },
  restart: { bg: "bg-sky-50", text: "text-sky-700" },
  investigate: { bg: "bg-amber-50", text: "text-amber-700" },
};

export function DiagnosisBadge({ diagnosis, className }: { diagnosis: DiagnosisType; className?: string }) {
  const colors = diagnosisColors[diagnosis] || diagnosisColors.insufficient_data;
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] px-1.5 py-0 border-transparent", colors.bg, colors.text, className)}
      data-testid={`badge-diagnosis-${diagnosis}`}
    >
      {DIAGNOSIS_LABELS[diagnosis]}
    </Badge>
  );
}

export function ActionBadge({ action, className }: { action: RecommendedAction; className?: string }) {
  const colors = actionColors[action] || actionColors.monitor;
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0", colors.bg, colors.text, className)}
      data-testid={`badge-action-${action}`}
    >
      {ACTION_LABELS[action]}
    </Badge>
  );
}

export function V2ScoreMini({ scoring }: { scoring?: ScoringResult }) {
  if (!scoring) return null;
  const items = [
    { label: "健康", value: scoring.scores.health, color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
    { label: "急迫", value: scoring.scores.urgency, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
    { label: "機會", value: scoring.scores.opportunity, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  ];
  return (
    <div className="flex items-center gap-2" data-testid="v2-score-mini">
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-center gap-0.5">
          {idx > 0 && <span className="text-[10px] text-muted-foreground/40 mr-0.5">/</span>}
          <span className="text-[10px] text-muted-foreground">{item.label}</span>
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
    { label: "機會", value: scoring.scores.opportunity, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  ];
  return (
    <div className="flex gap-3" data-testid="v2-score-bar">
      {items.map((item) => (
        <div key={item.label} className="flex-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
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
          <span className="font-medium">判斷依據：</span>{scoring.benchmarkBasis}
        </p>
      )}
      {scoring.timeWindowBasis && (
        <p className="text-muted-foreground">
          <span className="font-medium">時間窗口：</span>{scoring.timeWindowBasis}
        </p>
      )}
      {scoring.notes.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium">備註：</span>{scoring.notes.join("；")}
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
    <span className="text-[10px] text-muted-foreground" data-testid="benchmark-info">
      {scoring.benchmarkBasis && scoring.benchmarkBasis}
      {scoring.benchmarkBasis && scoring.timeWindowBasis && " / "}
      {scoring.timeWindowBasis && scoring.timeWindowBasis}
    </span>
  );
}
