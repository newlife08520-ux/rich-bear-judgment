import { Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScorePill, OpportunityScoreBadge, OpportunityBreakdownDisplay } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import { aiLabelColors, recommendationPageLabels, recommendationPageColors } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4PageDetailDialog(w: Pick<
  Ga4Workbench,
  "selectedDetail" | "setSelectedDetail" | "rankingForPage"
>) {
  const { selectedDetail, setSelectedDetail, rankingForPage } = w;
  return (
      <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-page-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap" data-testid="text-detail-title">
              {selectedDetail?.pageName}
              {selectedDetail && (
                <Badge
                  variant="secondary"
                  className={`no-default-hover-elevate no-default-active-elevate ${aiLabelColors[selectedDetail.aiLabel] || ""}`}
                >
                  {selectedDetail.aiLabel}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.path}</DialogDescription>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <ScorePill score={selectedDetail.judgmentScore} label="判決分數" />
                <OpportunityScoreBadge score={selectedDetail.opportunityScore} size="md" />
                <RecommendationLevelBadge level={selectedDetail.recommendationLevel} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "工作階段", value: formatNumber(selectedDetail.sessions) },
                  { label: "使用者", value: formatNumber(selectedDetail.users) },
                  { label: "平均停留", value: `${selectedDetail.avgDuration} 秒` },
                  { label: "跳出率", value: formatPercent(selectedDetail.bounceRate) },
                  { label: "商品瀏覽率", value: formatPercent(selectedDetail.productViewRate) },
                  { label: "加購率", value: formatPercent(selectedDetail.addToCartRate) },
                  { label: "結帳率", value: formatPercent(selectedDetail.checkoutRate) },
                  { label: "購買率", value: formatPercent(selectedDetail.purchaseRate) },
                  { label: "參與率", value: formatPercent(selectedDetail.engagementRate) },
                  { label: "整體導購率", value: formatPercent(selectedDetail.overallConversionRate) },
                ].map((m, idx) => (
                  <div key={idx} className="p-3 rounded-md bg-muted/40" data-testid={`detail-metric-${idx}`}>
                    <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">AI 評估</h4>
                <p className="text-sm leading-relaxed" data-testid="text-detail-ai-comment">{selectedDetail.aiComment}</p>
              </div>

              {selectedDetail.scoring && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">V2 評分</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <DiagnosisBadge diagnosis={selectedDetail.scoring.diagnosis} />
                    <ActionBadge action={selectedDetail.scoring.recommendedAction} />
                  </div>
                  <V2ScoreBar scoring={selectedDetail.scoring} />
                  <BenchmarkInfo scoring={selectedDetail.scoring} />
                </div>
              )}

              {selectedDetail.opportunityBreakdown && <OpportunityBreakdownDisplay breakdown={selectedDetail.opportunityBreakdown} />}

              {selectedDetail.suggestedAction && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30">
                  <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">建議動作</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed" data-testid="text-detail-suggested-action">{selectedDetail.suggestedAction}</p>
                  </div>
                </div>
              )}

              {selectedDetail.estimatedImpact && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50/50 dark:bg-blue-950/30">
                  <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed" data-testid="text-detail-estimated-impact">{selectedDetail.estimatedImpact}</p>
                </div>
              )}

              {(() => {
                const ranking = rankingForPage(selectedDetail.path);
                if (!ranking) return null;
                return (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">頁面排名建議</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className={`no-default-hover-elevate no-default-active-elevate ${recommendationPageColors[ranking.recommendation] || ""}`}
                        data-testid="badge-detail-recommendation"
                      >
                        {recommendationPageLabels[ranking.recommendation] || ranking.recommendation}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-detail-ranking-reason">{ranking.reason}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
