import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DecisionCardBlock } from "@shared/decision-cards-engine";
import { useToast } from "@/hooks/use-toast";
import { mapSuggestedActionToExecution } from "@/lib/map-suggested-action-to-execution";
import { cn } from "@/lib/utils";

export type DecisionCardExecutionProps = {
  metaWritesAllowed: boolean;
  guardMessage: string | null;
  busy: boolean;
  onExecuteCard: (block: DecisionCardBlock) => void | Promise<void>;
};

function isRulesMissingSignal(block: DecisionCardBlock): boolean {
  const t = `${block.conclusion}\n${block.suggestedAction}\n${block.evidenceMetrics}\n${block.triggerRule}`;
  return /規則缺失|待補成本|尚未設定成本|未設定成本|缺少成本|無成本規則|rules?\s*missing/i.test(t);
}

export function JudgmentDecisionCardsSection({
  decisionCards,
  execution,
}: {
  decisionCards: DecisionCardBlock[];
  execution?: DecisionCardExecutionProps | null;
}) {
  const { toast } = useToast();
  return (
    <section className="space-y-3" data-testid="section-decision-cards">
      <h2 className="text-sm font-semibold text-foreground">決策卡（規則引擎產出）</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {decisionCards.length === 0 ? (
          <Card className="bg-card border border-border col-span-full">
            <CardContent className="p-4 text-sm text-muted-foreground">
              載入中或尚無廣告資料，請先同步廣告資料後重新整理。
            </CardContent>
          </Card>
        ) : (
          decisionCards.map((block) => {
            const plan = execution ? mapSuggestedActionToExecution(block) : null;
            const showExec = !!plan && execution;
            const rulesMissing = isRulesMissingSignal(block);
            return (
              <Card
                key={block.key}
                className={cn(
                  "bg-card border border-border",
                  rulesMissing && "border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card"
                )}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">{block.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {block.confidence === "high"
                        ? "高"
                        : block.confidence === "medium"
                          ? "中"
                          : block.confidence === "data_insufficient"
                            ? "資料不足"
                            : "低"}
                    </span>
                    {block.copyableText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(block.copyableText!);
                          toast({ title: "已複製到剪貼簿", duration: 2000 });
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {rulesMissing ? (
                    <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 rounded border border-amber-400/50 bg-amber-100/80 dark:bg-amber-950/40 px-2 py-1">
                      成本／規則資料不足：請先至獲利規則中心補齊，避免誤判。
                    </p>
                  ) : null}
                  <p className="text-sm font-medium whitespace-pre-wrap">{block.conclusion}</p>
                  <div className="text-xs space-y-1 border-t pt-2 text-muted-foreground">
                    <p>
                      <span className="font-medium">觸發規則：</span>
                      {block.triggerRule}
                    </p>
                    <p>
                      <span className="font-medium">證據指標：</span>
                      {block.evidenceMetrics}
                    </p>
                    <p>
                      <span className="font-medium">建議動作：</span>
                      {block.suggestedAction}
                    </p>
                    <p>
                      <span className="font-medium">影響金額：</span>
                      {block.impactAmount}
                    </p>
                  </div>
                  {showExec ? (
                    <div className="flex flex-col gap-1 pt-1 border-t">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        disabled={!execution!.metaWritesAllowed || execution!.busy}
                        onClick={() => void execution!.onExecuteCard(block)}
                        data-testid="button-decision-card-execute-meta"
                      >
                        {execution!.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        執行建議（Meta）
                      </Button>
                      {!execution!.metaWritesAllowed && execution!.guardMessage ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">{execution!.guardMessage}</p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
