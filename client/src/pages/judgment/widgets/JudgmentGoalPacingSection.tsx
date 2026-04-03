import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import { formatGoalPacingClarityLines, formatGoalPacingOneLiner } from "@/components/goal-pacing-ui";

export function JudgmentGoalPacingSection({
  goalPacingByProduct,
}: {
  goalPacingByProduct: Record<string, GoalPacingEvaluation>;
}) {
  const entries = Object.entries(goalPacingByProduct);
  if (entries.length === 0) {
    return null;
  }
  const top = entries.slice(0, 8);
  return (
    <section className="space-y-2" data-testid="section-goal-pacing">
      <h2 className="text-sm font-semibold text-muted-foreground">目標成果／節奏（商品維度）</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {top.map(([name, p]) => (
          <Card key={name}>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-medium">{name}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1 px-3 pb-3">
              <p className="text-foreground">{formatGoalPacingOneLiner(p)}</p>
              <p>
                今日已調 {p.todayAdjustCount} 次
                {p.observationWindowUntil ? ` · 觀察窗至 ${p.observationWindowUntil}` : ""}
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {formatGoalPacingClarityLines(p).slice(0, 7).map((line) => (
                  <li key={line.slice(0, 80)}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
