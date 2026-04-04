import { MetricCard } from "@/components/shared/MetricCard";
import { formatCurrency } from "../dashboard-formatters";

export function HomepageCommandMetrics({
  totalSpend,
  totalRevenue,
  weightedRoas,
  pendingCount,
}: {
  totalSpend: number;
  totalRevenue: number;
  weightedRoas: number;
  pendingCount: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="grid-homepage-command-metrics">
      <MetricCard label="總花費" value={formatCurrency(totalSpend)} />
      <MetricCard label="營收" value={formatCurrency(totalRevenue)} />
      <MetricCard
        label="整體 ROAS"
        value={totalSpend > 0 ? weightedRoas.toFixed(2) : "—"}
        trend={totalSpend > 0 ? (weightedRoas >= 2 ? "up" : weightedRoas < 1 ? "down" : "flat") : undefined}
      />
      <MetricCard label="需處理（今日指令）" value={pendingCount} semanticClassName="border-l-4 border-l-amber-500/50" />
    </div>
  );
}
