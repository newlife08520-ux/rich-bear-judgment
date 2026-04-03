import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DecisionCardBlock } from "@shared/decision-cards-engine";
import { useToast } from "@/hooks/use-toast";

export function JudgmentDecisionCardsSection({
  decisionCards,
}: {
  decisionCards: DecisionCardBlock[];
}) {
  const { toast } = useToast();
  return (
    <section className="space-y-3" data-testid="section-decision-cards">
      <h2 className="text-sm font-semibold text-gray-700">決策卡（規則引擎產出）</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {decisionCards.length === 0 ? (
          <Card className="bg-white border border-gray-200 col-span-full">
            <CardContent className="p-4 text-sm text-gray-600">
              載入中或尚無廣告資料，請先同步廣告資料後重新整理。
            </CardContent>
          </Card>
        ) : (
          decisionCards.map((block) => (
            <Card key={block.key} className="bg-white border border-gray-200">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">{block.label}</p>
                  <span className="text-[10px] text-muted-foreground">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
