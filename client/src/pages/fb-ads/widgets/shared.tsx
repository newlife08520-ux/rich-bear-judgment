import { Badge } from "@/components/ui/badge";
import type { RiskLevel, TriScore } from "@shared/schema";

export const aiLabelColors: Record<string, string> = {
  "主力候選": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "高潛力未放大": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "已疲勞": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "先停再說": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "會騙點不會轉": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "再行銷限定": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "冷流量不適合": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "建議重做前3秒": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "CTA太弱": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "CTA 太弱": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "角度太普通": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export const statusLabels: Record<string, string> = {
  active: "投放中",
  paused: "已暫停",
  ended: "已結束",
};

export const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  paused: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
  return aiLabelColors[label] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
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
  1: "bg-emerald-100 text-emerald-800",
  2: "bg-red-100 text-red-800",
  3: "bg-orange-100 text-orange-800",
  7: "bg-yellow-100 text-yellow-800",
  100: "bg-gray-100 text-gray-700",
};

const riskLevelConfig: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  danger: { bg: "bg-red-100", text: "text-red-700", label: "危險" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", label: "警告" },
  watch: { bg: "bg-yellow-100", text: "text-yellow-700", label: "觀察" },
  stable: { bg: "bg-green-100", text: "text-green-700", label: "穩定" },
  potential: { bg: "bg-blue-100", text: "text-blue-700", label: "潛力" },
};

export function FbRiskLevelBadge({ level }: { level?: RiskLevel }) {
  if (!level) return null;
  const config = riskLevelConfig[level];
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 border-transparent ${config.bg} ${config.text}`} data-testid={`badge-risk-${level}`}>
      {config.label}
    </Badge>
  );
}

export function FbTriScoreMini({ triScore }: { triScore?: TriScore }) {
  if (!triScore) return null;
  const items = [
    { label: "健康", value: triScore.health, color: "bg-emerald-500" },
    { label: "急迫", value: triScore.urgency, color: "bg-amber-500" },
    { label: "潛力", value: triScore.scalePotential, color: "bg-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1.5" data-testid="tri-score-mini">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-0.5" title={`${item.label}: ${item.value}`}>
          <div className="w-1.5 h-4 rounded-sm bg-muted overflow-hidden flex flex-col-reverse">
            <div className={`w-full rounded-sm ${item.color}`} style={{ height: `${item.value}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
