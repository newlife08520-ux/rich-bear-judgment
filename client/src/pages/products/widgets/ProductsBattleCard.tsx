import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown, Zap, Shield, Calculator, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_STATUS } from "@/lib/decision-workbench";
import { EVIDENCE_LABELS, formatCurrency } from "../products-formatters";
import type { ProductBattleRow } from "../products-types";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import { formatGoalPacingClarityLines, formatGoalPacingOneLiner } from "@/components/goal-pacing-ui";

export function ProductsBattleCard({
  r,
  failureRatesByTag,
  tableRescue,
  tableScaleUp,
  onCreateTask,
  goalPacing,
  dormantGemCount = 0,
  dormantRevivalHint,
}: {
  r: ProductBattleRow;
  failureRatesByTag: Record<string, number>;
  tableRescue: Array<{ productName: string }>;
  tableScaleUp: Array<{ productName: string }>;
  onCreateTask: (row: ProductBattleRow) => void;
  goalPacing?: GoalPacingEvaluation;
  /** Batch 11.0：與沉睡復活候選同商品的筆數 */
  dormantGemCount?: number;
  /** Batch 12.4：主清單內嵌復活建議（來自 dormant 候選） */
  dormantRevivalHint?: string;
}) {
  const statusLabel = PRODUCT_STATUS[r.productStatus as keyof typeof PRODUCT_STATUS];
  const statusColor =
    r.productStatus === "scale"
      ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
      : r.productStatus === "stop"
        ? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
        : r.productStatus === "danger"
          ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-border bg-muted/20";
  const supporting = (r.creatives ?? [])
    .filter((c) => c.roas >= 2)
    .sort((a, b) => b.roas - a.roas);
  const dragging = (r.creatives ?? [])
    .filter((c) => c.roas < 1 || (failureRatesByTag[c.materialStrategy ?? ""] ?? 0) > 0.8)
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const supportingPreview = supporting.slice(0, 3);
  const draggingPreview = dragging.slice(0, 3);
  const rescueForProduct = tableRescue.filter((x) => x.productName === r.productName);
  const scaleUpForProduct = tableScaleUp.filter((x) => x.productName === r.productName);
  const nextStep =
    rescueForProduct.length > 0
      ? `先救 ${rescueForProduct.length} 檔`
      : scaleUpForProduct.length > 0
        ? `可加碼 ${scaleUpForProduct.length} 檔`
        : r.ruleTags?.join("、") || "—";
  const ev = r.evidenceLevel;

  return (
    <Card key={r.productName} className={cn("flex flex-col", statusColor)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{r.productName}</h3>
          {ev && EVIDENCE_LABELS[ev] && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {EVIDENCE_LABELS[ev]}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px]",
              r.productStatus === "scale" ? "text-emerald-700" : r.productStatus === "stop" ? "text-red-700" : ""
            )}
          >
            {statusLabel}
          </Badge>
          {dormantGemCount > 0 ? (
            <Badge
              variant="outline"
              className="text-[10px] border-violet-300 text-violet-800 dark:text-violet-200"
              data-testid="products-battle-card-dormant-hint"
            >
              沉睡復活 {dormantGemCount}
            </Badge>
          ) : null}
        </div>
        {dormantGemCount > 0 && dormantRevivalHint ? (
          <p
            className="text-xs rounded-md border border-violet-400/35 bg-violet-500/[0.06] px-2 py-1.5 text-violet-950 dark:text-violet-100 leading-snug"
            data-testid="products-inline-dormant-revival-v4"
          >
            <span className="font-semibold">復活建議 · </span>
            {dormantRevivalHint}{" "}
            <Link href="/tasks" className="underline font-medium text-violet-800 dark:text-violet-200">
              前往任務工作台
            </Link>
          </p>
        ) : null}
        <p className="text-sm font-medium text-foreground border-l-2 border-primary/50 pl-2 py-0.5" title={r.aiSuggestion}>
          總監判語：{r.aiSuggestion}
        </p>
        {goalPacing && (
          <div
            className="text-xs rounded border border-dashed border-primary/30 bg-primary/5 px-2 py-1.5 space-y-1"
            data-testid="product-goal-pacing"
          >
            <p className="font-medium text-foreground">目標／節奏建議</p>
            <p className="text-muted-foreground">{formatGoalPacingOneLiner(goalPacing)}</p>
            <p
              className="text-[11px] text-muted-foreground"
              data-testid="goal-pacing-observation-line"
            >
              今日已調 {goalPacing.todayAdjustCount} 次
              {goalPacing.observationWindowUntil
                ? ` · 觀察窗至 ${goalPacing.observationWindowUntil}`
                : ""}
            </p>
            <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-muted-foreground">
              {formatGoalPacingClarityLines(goalPacing).slice(0, 6).map((line) => (
                <li key={line.slice(0, 72)}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Target className="w-3 h-3" /> 值不值得砸
            </span>
            <p className="mt-0.5">
              {r.roas >= 2 ? "值得砸，ROAS 達標" : r.roas < 1 ? "不建議砸，先止血" : "觀察中"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">為什麼</span>
            <p className="mt-0.5 truncate" title={r.aiSuggestion}>
              {r.aiSuggestion}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 靠哪些素材撐
            </span>
            <p className="mt-0.5 text-xs">
              {supporting.length === 0
                ? "尚無高 ROAS 素材"
                : supportingPreview
                    .map(
                      (c) =>
                        `${c.materialStrategy ?? ""} ${(c.headlineSnippet ?? "").slice(0, 20)} ROAS ${c.roas.toFixed(1)}`
                    )
                    .join(" · ") + (supporting.length > 3 ? ` …共 ${supporting.length} 支` : "")}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> 被哪些素材拖
            </span>
            <p className="mt-0.5 text-xs">
              {dragging.length === 0
                ? "尚無明顯拖累"
                : draggingPreview
                    .map((c) => `${(c.materialStrategy ?? "").slice(0, 8)} ROAS ${c.roas.toFixed(1)}`)
                    .join(" · ") + (dragging.length > 3 ? ` …共 ${dragging.length} 支` : "")}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> 下一步做什麼
            </span>
            <p className="mt-0.5">{nextStep}</p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" /> 成本規則是否可信
            </span>
            <p className="mt-0.5">
              {r.costRuleStatus === "待補成本規則" ? (
                <Link href="/settings/profit-rules" className="text-amber-600 hover:underline inline-flex items-center gap-1">
                  <Calculator className="w-3 h-3" />
                  待補，點此設定
                </Link>
              ) : (
                "已設定，可依保本／目標判斷"
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">breakEven／target／headroom</span>
            <p className="mt-0.5 text-xs">
              {r.hasRule && r.breakEvenRoas != null && r.targetRoas != null
                ? `保本 ${Number(r.breakEvenRoas).toFixed(1)} · 目標 ${Number(r.targetRoas).toFixed(1)}${
                    r.profitHeadroom != null
                      ? ` · headroom ${Number(r.profitHeadroom) >= 0 ? "+" : ""}${(Number(r.profitHeadroom) * 100).toFixed(0)}%`
                      : ""
                  }`
                : "需先設定成本規則"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
          <span>{formatCurrency(r.spend)}</span>
          <span>ROAS {r.roas.toFixed(2)}</span>
          <span>
            在撐 {supporting.length} 支 · 在拖 {dragging.length} 支
          </span>
          <span className="ml-auto">
            <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => onCreateTask(r)}>
              <ListPlus className="w-3 h-3" /> 生成任務
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
