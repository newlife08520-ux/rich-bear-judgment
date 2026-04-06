import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoringResult, V2Scores, DiagnosisType, RecommendedAction } from "@shared/schema";
import { DIAGNOSIS_LABELS, ACTION_LABELS } from "@shared/schema";

const CHIP_BASE =
  "border px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none";

const chipProfit = `bg-[var(--status-profit-surface)] text-[var(--status-profit)] border-[var(--status-profit-light)] ${CHIP_BASE}`;
const chipLoss = `bg-[var(--status-loss-surface)] text-[var(--status-loss)] border-[var(--status-loss-light)] ${CHIP_BASE}`;
const chipWatch = `bg-[var(--status-watch-surface)] text-[var(--status-watch)] border-[var(--status-watch-light)] ${CHIP_BASE}`;
const chipDormant = `bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border-[var(--status-dormant-light)] ${CHIP_BASE}`;
const chipNeutral =
  "bg-muted/30 text-muted-foreground border border-border px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-none";

/** 奈米晶片徽章：對齊 var(--status-*) */
const diagnosisChip: Record<DiagnosisType, string> = {
  healthy: chipProfit,
  scaling_ready: chipDormant,
  creative_fatigue: chipWatch,
  roas_declining: chipWatch,
  roas_critical: chipLoss,
  ctr_declining: chipWatch,
  cpc_spike: chipWatch,
  budget_waste: chipLoss,
  audience_saturation: chipDormant,
  conversion_drop: chipWatch,
  funnel_leak: chipWatch,
  checkout_abandon: chipLoss,
  page_bounce: chipWatch,
  insufficient_data: chipNeutral,
};

const actionChip: Record<RecommendedAction, string> = {
  maintain: chipProfit,
  scale_budget: chipDormant,
  reduce_budget: chipWatch,
  pause: chipLoss,
  refresh_creative: chipDormant,
  expand_audience: chipDormant,
  narrow_audience: chipDormant,
  ab_test: chipDormant,
  optimize_landing: chipWatch,
  simplify_checkout: chipProfit,
  add_trust_signals: chipDormant,
  monitor: chipNeutral,
  restart: chipDormant,
  investigate: chipWatch,
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
    { label: "健康", value: scoring.scores.health, color: "bg-[var(--status-profit)]", textColor: "text-[var(--status-profit)]" },
    { label: "急迫", value: scoring.scores.urgency, color: "bg-[var(--status-watch)]", textColor: "text-[var(--status-watch)]" },
    { label: "機會", value: scoring.scores.opportunity, color: "bg-[var(--status-dormant)]", textColor: "text-[var(--status-dormant)]" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-[var(--status-dormant)]", textColor: "text-[var(--status-dormant)]" },
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
    { label: "健康", value: scoring.scores.health, color: "bg-[var(--status-profit)]", textColor: "text-[var(--status-profit)]" },
    { label: "急迫", value: scoring.scores.urgency, color: "bg-[var(--status-watch)]", textColor: "text-[var(--status-watch)]" },
    { label: "機會", value: scoring.scores.opportunity, color: "bg-[var(--status-dormant)]", textColor: "text-[var(--status-dormant)]" },
    { label: "信心", value: scoring.scores.confidence, color: "bg-[var(--status-dormant)]", textColor: "text-[var(--status-dormant)]" },
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
