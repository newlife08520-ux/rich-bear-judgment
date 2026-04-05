import { Badge } from "@/components/ui/badge";
import type { RiskLevel, TriScore } from "@shared/schema";

export const aiLabelColors: Record<string, string> = {
  主力候選:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800/50",
  高潛力未放大:
    "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800/50",
  已疲勞:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800/50",
  先停再說: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800/50",
  會騙點不會轉:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800/50",
  再行銷限定:
    "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/50",
  冷流量不適合: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  建議重做前3秒:
    "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800/50",
  CTA太弱:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800/50",
  "CTA 太弱":
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800/50",
  角度太普通: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

export const statusLabels: Record<string, string> = {
  active: "投放中",
  paused: "已暫停",
  ended: "已結束",
};

export const statusColors: Record<string, string> = {
  active:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800/50",
  paused: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  ended: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800/50",
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
  1: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  2: "bg-rose-50 text-rose-700 border border-rose-200",
  3: "bg-amber-50 text-amber-700 border border-amber-200",
  7: "bg-amber-50 text-amber-700 border border-amber-200",
  100: "bg-slate-100 text-slate-600 border border-slate-200",
};

const riskLevelChip: Record<RiskLevel, string> = {
  danger: "bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50",
  warning: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  watch: "bg-amber-50 text-amber-700 border border-amber-200 dark:border-amber-800/50",
  stable: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50",
  potential: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50",
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
    { label: "健康", value: triScore.health, color: "bg-emerald-500" },
    { label: "急迫", value: triScore.urgency, color: "bg-amber-500" },
    { label: "潛力", value: triScore.scalePotential, color: "bg-indigo-500" },
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
