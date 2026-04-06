import { Badge } from "@/components/ui/badge";
import type { RiskLevel, TriScore } from "@shared/schema";

const SEM_PROFIT =
  "bg-[var(--status-profit-surface)] text-[var(--status-profit)] border border-[var(--status-profit-light)]";
const SEM_LOSS =
  "bg-[var(--status-loss-surface)] text-[var(--status-loss)] border border-[var(--status-loss-light)]";
const SEM_WATCH =
  "bg-[var(--status-watch-surface)] text-[var(--status-watch)] border border-[var(--status-watch-light)]";
const SEM_DORMANT =
  "bg-[var(--status-dormant-surface)] text-[var(--status-dormant)] border border-[var(--status-dormant-light)]";

export const aiLabelColors: Record<string, string> = {
  主力候選: SEM_PROFIT,
  高潛力未放大: SEM_DORMANT,
  已疲勞: SEM_WATCH,
  先停再說: SEM_LOSS,
  會騙點不會轉: SEM_WATCH,
  再行銷限定: SEM_DORMANT,
  冷流量不適合: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  建議重做前3秒: SEM_LOSS,
  CTA太弱: SEM_WATCH,
  "CTA 太弱": SEM_WATCH,
  角度太普通: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export const statusLabels: Record<string, string> = {
  active: "投放中",
  paused: "已暫停",
  ended: "已結束",
};

export const statusColors: Record<string, string> = {
  active: SEM_PROFIT,
  paused: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  ended: SEM_LOSS,
};

export function formatCurrency(v: number): string {
  return `NT$ ${v.toLocaleString()}`;
}

export function formatKPIValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "decimal":
      return value.toFixed(2);
    case "number":
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

export function getAiLabelClass(label: string): string {
  return aiLabelColors[label] || "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border";
}

export type SortField =
  | "spend"
  | "ctr"
  | "cpc"
  | "cpm"
  | "roas"
  | "frequency"
  | "judgmentScore"
  | "opportunityScore"
  | "dormant_revival";
export type SortDir = "asc" | "desc";
export type AccountFilter = "all" | "active" | "favorites";

export const metaAccountStatusColors: Record<number, string> = {
  1: SEM_PROFIT,
  2: SEM_LOSS,
  3: SEM_WATCH,
  7: SEM_WATCH,
  100: "bg-slate-100 text-slate-600 border border-slate-200",
};

const riskLevelChip: Record<RiskLevel, string> = {
  danger: SEM_LOSS,
  warning: SEM_WATCH,
  watch: SEM_WATCH,
  stable: SEM_PROFIT,
  potential: SEM_DORMANT,
};

const riskLevelLabels: Record<RiskLevel, string> = {
  danger: "危險",
  warning: "警告",
  watch: "觀察",
  stable: "穩定",
  potential: "潛力",
};

export function FbRiskLevelBadge({ level }: { level?: RiskLevel }) {
  if (!level) return null;
  return (
    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${riskLevelChip[level]}`} data-testid={`badge-risk-${level}`}>
      {riskLevelLabels[level]}
    </Badge>
  );
}

export function FbTriScoreMini({ triScore }: { triScore?: TriScore }) {
  if (!triScore) return null;
  const items = [
    { label: "健康", value: triScore.health, color: "bg-[var(--status-profit)]" },
    { label: "急迫", value: triScore.urgency, color: "bg-[var(--status-watch)]" },
    { label: "潛力", value: triScore.scalePotential, color: "bg-[var(--status-dormant)]" },
  ];
  return (
    <div className="flex items-center gap-1.5" data-testid="tri-score-mini">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-0.5" title={`${item.label}: ${item.value}`}>
          <div className="w-1.5 h-4 rounded-sm bg-muted overflow-hidden flex flex-col-reverse">
            <div className={`w-full rounded-sm ${item.color}`} style={{ height: `${item.value}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
