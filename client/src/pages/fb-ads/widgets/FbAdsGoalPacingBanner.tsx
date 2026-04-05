import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import { formatGoalPacingClarityLines, formatGoalPacingOneLiner } from "@/components/goal-pacing-ui";

export function FbAdsGoalPacingBanner({
  goalPacingByProduct,
}: {
  goalPacingByProduct: Record<string, GoalPacingEvaluation>;
}) {
  const entries = Object.entries(goalPacingByProduct).slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <div
      className="mx-4 mb-2 rounded-xl border border-dashed border-slate-300 bg-white border-l-4 border-l-indigo-500 px-3 py-2 text-xs dark:border-border dark:bg-card"
      data-testid="fb-ads-goal-pacing-banner"
    >
      <p className="font-medium text-foreground mb-1">目標／節奏摘要（前 4 個商品）</p>
      <ul className="space-y-0.5 text-muted-foreground">
        {entries.map(([name, p]) => (
          <li key={name}>
            <span className="font-medium text-foreground">{name}</span>：{formatGoalPacingOneLiner(p)}（今日已調 {p.todayAdjustCount} 次）
            <ul className="list-disc pl-4 mt-0.5 text-[11px] opacity-90">
              {formatGoalPacingClarityLines(p)
                .slice(0, 2)
                .map((line) => (
                  <li key={line.slice(0, 64)}>{line}</li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
