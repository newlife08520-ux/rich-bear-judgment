import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, TrendingUp, TrendingDown, Zap, Shield, Calculator, ListPlus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_STATUS } from "@/lib/decision-workbench";
import { EVIDENCE_LABELS, formatCurrency } from "../products-formatters";
import type { ProductBattleRow } from "../products-types";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import { formatGoalPacingClarityLines, formatGoalPacingOneLiner } from "@/components/goal-pacing-ui";
import { StatusDot } from "@/components/shared/StatusDot";
import { getProductStatus } from "@/components/shared/status-colors";

export function ProductsBattleCard({
  r,
  failureRatesByTag,
  tableRescue,
  tableScaleUp,
  onCreateTask,
  goalPacing,
  dormantGemCount = 0,
  dormantRevivalHint,
  paretoFlags,
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
  paretoFlags?: { top20: boolean; hiddenDiamond: boolean; moneyPit: boolean };
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [costPopoverOpen, setCostPopoverOpen] = useState(false);
  const [costRatioInput, setCostRatioInput] = useState("0.4");
  const [detailOpen, setDetailOpen] = useState(false);

  const pacingSummary = goalPacing
    ? `${
        goalPacing.pacingLabel === "UNDERSPENT_GOOD"
          ? "表現好但預算吃不滿"
          : goalPacing.pacingLabel === "HOLD_STABLE"
            ? "表現穩定可觀察"
            : goalPacing.pacingLabel === "FULLY_SPENT_DEGRADING"
              ? "預算燒完但效果下滑"
              : "建議觀察"
      }（${goalPacing.confidence} 信心）`
    : `花費 NT$${r.spend.toLocaleString()}，ROAS ${r.roas.toFixed(1)}`;

  const saveCostRatioMutation = useMutation({
    mutationFn: async (costRatio: number) => {
      await apiRequest("PUT", "/api/profit-rules", {
        productName: r.productName,
        costRatio,
        targetNetMargin: 0.15,
        minSpend: 100,
        minClicks: 30,
        minATC: 3,
        minPurchases: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profit-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/action-center"] });
      setCostPopoverOpen(false);
      toast({ title: "已儲存成本比", duration: 2000 });
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });
  const statusLabel = PRODUCT_STATUS[r.productStatus as keyof typeof PRODUCT_STATUS];
  const statusColor =
    r.productStatus === "scale"
      ? "border-slate-200 bg-white border-l-4 border-l-emerald-500 dark:border-border dark:bg-card"
      : r.productStatus === "stop"
        ? "border-slate-200 bg-white border-l-4 border-l-rose-500 dark:border-border dark:bg-card"
        : r.productStatus === "danger"
          ? "border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card"
          : "border-slate-200 bg-white dark:border-border dark:bg-card";
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
  const roasSemantic = getProductStatus(r.roas, r.breakEvenRoas ?? undefined, r.targetRoas ?? undefined);

  return (
    <Card
      key={r.productName}
      className={cn("flex flex-col rounded-2xl shadow-sm hover:shadow-md transition-shadow", statusColor)}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-start gap-2">
          <StatusDot semantic={roasSemantic} size="md" className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground leading-tight">{r.productName}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ev && EVIDENCE_LABELS[ev] ? (
                <Badge variant="outline" className="text-xs font-normal rounded-md">
                  {EVIDENCE_LABELS[ev]}
                </Badge>
              ) : null}
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs rounded-md",
                  r.productStatus === "scale" ? "text-emerald-700" : r.productStatus === "stop" ? "text-rose-700" : ""
                )}
              >
                {statusLabel}
              </Badge>
              {paretoFlags?.top20 ? (
                <Badge className="text-xs rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800/50">
                  Top 20%
                </Badge>
              ) : null}
              {paretoFlags?.hiddenDiamond ? (
                <Badge className="text-xs rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/50">
                  Hidden Diamond
                </Badge>
              ) : null}
              {paretoFlags?.moneyPit ? (
                <Badge className="text-xs rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:border-rose-800/50">
                  Money Pit
                </Badge>
              ) : null}
              {dormantGemCount > 0 ? (
                <Badge
                  variant="outline"
                  className="text-xs border-indigo-200 text-indigo-800 dark:border-indigo-800/50 dark:text-indigo-200 rounded-md"
                  data-testid="products-battle-card-dormant-hint"
                >
                  沉睡復活 {dormantGemCount}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center rounded-xl border border-border/50 bg-muted/20 p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">花費</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(r.spend)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">營收</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(r.revenue)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ROAS</p>
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                roasSemantic === "profit" && "text-emerald-600",
                roasSemantic === "loss" && "text-rose-600",
                roasSemantic === "watch" && "text-amber-600"
              )}
            >
              {r.roas.toFixed(2)}
            </p>
          </div>
        </div>
        {dormantGemCount > 0 && dormantRevivalHint ? (
          <p
            className="text-xs rounded-xl border border-slate-200 bg-white border-l-4 border-l-indigo-500 px-2 py-1.5 text-indigo-950 dark:text-indigo-100 leading-snug dark:border-border dark:bg-card"
            data-testid="products-inline-dormant-revival-v4"
          >
            <span className="font-semibold">復活建議 · </span>
            {dormantRevivalHint}{" "}
            <Link href="/tasks" className="underline font-medium text-indigo-700 dark:text-indigo-300">
              前往任務工作台
            </Link>
          </p>
        ) : null}
        <p className="text-sm text-foreground leading-snug border-l-4 border-l-indigo-500 pl-2 py-0.5">{pacingSummary}</p>
        <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              data-testid="products-battle-card-detail-toggle"
            >
              查看詳情（判語、節奏、素材明細）
              <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", detailOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-1">
            <p className="text-sm font-medium text-foreground border-l-4 border-l-slate-400 pl-2 py-0.5 dark:border-l-slate-500" title={r.aiSuggestion}>
              總監判語：{r.aiSuggestion}
            </p>
            {goalPacing && (
              <div
                className="text-xs rounded-xl border border-dashed border-slate-300 bg-white border-l-4 border-l-indigo-500 px-2 py-1.5 space-y-1 dark:border-border dark:bg-card"
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
            <p className="mt-0.5 flex flex-wrap items-center gap-2">
              {r.costRuleStatus === "待補成本規則" ? (
                <>
                  <Popover open={costPopoverOpen} onOpenChange={setCostPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-amber-600 hover:text-amber-700 hover:bg-transparent inline-flex items-center gap-1 text-sm"
                        data-testid="button-products-cost-ratio-popover"
                      >
                        <Calculator className="w-3 h-3" />
                        快速補成本比
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-3" align="start">
                      <p className="text-xs text-muted-foreground">
                        儲存後會寫入此商品的成本比；未填欄位沿用系統預設門檻。
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">成本比（0–0.95）</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={0.95}
                          value={costRatioInput}
                          onChange={(e) => setCostRatioInput(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={saveCostRatioMutation.isPending}
                        onClick={() => {
                          const n = Number(costRatioInput);
                          if (!Number.isFinite(n) || n < 0 || n >= 1) {
                            toast({ title: "請輸入有效成本比", variant: "destructive" });
                            return;
                          }
                          saveCostRatioMutation.mutate(n);
                        }}
                      >
                        儲存
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <Link href="/settings/profit-rules" className="text-xs text-muted-foreground hover:underline">
                    完整規則中心
                  </Link>
                </>
              ) : (
                "已設定，可依保本／目標判斷"
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground font-medium flex items-center gap-1">保本／目標／利潤空間</span>
            <p className="mt-0.5 text-xs">
              {r.hasRule && r.breakEvenRoas != null && r.targetRoas != null
                ? `保本 ROAS ${Number(r.breakEvenRoas).toFixed(1)} · 目標 ROAS ${Number(r.targetRoas).toFixed(1)}${
                    r.profitHeadroom != null
                      ? ` · 利潤空間 ${Number(r.profitHeadroom) >= 0 ? "+" : ""}${(Number(r.profitHeadroom) * 100).toFixed(0)}%`
                      : ""
                  }`
                : "需先設定成本規則"}
            </p>
          </div>
        </div>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs gap-2" asChild>
            <Link href="/fb-ads">查看活動</Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg text-xs gap-1" asChild>
            <Link href="/settings/profit-rules">設定成本比</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs ml-auto" onClick={() => onCreateTask(r)}>
            <ListPlus className="w-3 h-3" /> 生成任務
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
