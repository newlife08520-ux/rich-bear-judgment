import {
  ArrowLeft, ChevronRight, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type { GA4PageMetricsDetailed } from "@shared/schema";
import { pageGroupLabels, assetViewConfig, priorityColors, type AssetView } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import {
  RiskLevelBadge, TriScoreDisplay, PageRecommendationCard, ChangeIndicator,
} from "./shared";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4AssetDimensionCard(w: Pick<
  Ga4Workbench,
  | "assetView"
  | "handleAssetViewChange"
  | "drillDownPage"
  | "setDrillDownPage"
  | "selectedPageGroupKey"
  | "setSelectedPageGroupKey"
  | "currentAssetGroups"
  | "pagesDetailedLoading"
  | "assetGroupFilteredPages"
  | "pageRecommendationMap"
  | "assetGroupPageCounts"
>) {
  const {
    assetView, handleAssetViewChange, drillDownPage, setDrillDownPage,
    selectedPageGroupKey, setSelectedPageGroupKey, currentAssetGroups,
    pagesDetailedLoading, assetGroupFilteredPages, pageRecommendationMap, assetGroupPageCounts,
  } = w;
  return (
        <Card data-testid="card-asset-switcher">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h3 className="section-title">依不同維度檢視</h3>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="pills-asset-view">
              {(Object.entries(assetViewConfig) as [AssetView, typeof assetViewConfig[AssetView]][]).map(([key, config]) => {
                const Icon = config.icon;
                const isActive = assetView === key;
                return (
                  <Button
                    key={key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAssetViewChange(key)}
                    data-testid={`button-asset-${key}`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {config.label}
                  </Button>
                );
              })}
              <span className="text-xs text-muted-foreground ml-2">
                {assetViewConfig[assetView].description}
              </span>
            </div>

            {drillDownPage ? (
              <div className="space-y-4" data-testid="drilldown-single-page">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrillDownPage(null)}
                    data-testid="button-back-to-list"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回列表
                  </Button>
                  {selectedPageGroupKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDrillDownPage(null); setSelectedPageGroupKey(null); }}
                      data-testid="button-back-to-groups"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      返回分組
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold" data-testid="text-drilldown-title">{drillDownPage.pageTitle || drillDownPage.pagePath}</h4>
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      {pageGroupLabels[drillDownPage.pageGroup]}
                    </Badge>
                    {drillDownPage.scoring ? <DiagnosisBadge diagnosis={drillDownPage.scoring.diagnosis} /> : <RiskLevelBadge level={drillDownPage.riskLevel} />}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-drilldown-path">{drillDownPage.pagePath}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "工作階段", value: formatNumber(drillDownPage.sessions), prev: drillDownPage.sessionsPrev },
                      { label: "瀏覽量", value: formatNumber(drillDownPage.pageviews) },
                      { label: "轉換率", value: formatPercent(drillDownPage.conversionRate), prev: drillDownPage.conversionRatePrev },
                      { label: "營收", value: `$${drillDownPage.revenue.toLocaleString()}`, prev: drillDownPage.revenuePrev },
                      { label: "跳出率", value: formatPercent(drillDownPage.bounceRate), prev: drillDownPage.bounceRatePrev, inverse: true },
                      { label: "平均互動時間", value: `${drillDownPage.avgEngagementTime.toFixed(1)} 秒` },
                      { label: "加入購物車", value: formatNumber(drillDownPage.addToCart) },
                      { label: "購買次數", value: formatNumber(drillDownPage.purchases) },
                    ].map((m, idx) => (
                      <div key={idx} className="p-3 rounded-md bg-muted/40" data-testid={`drilldown-metric-${idx}`}>
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold">{m.value}</p>
                          {m.prev !== undefined && m.prev > 0 && (
                            <ChangeIndicator current={parseFloat(m.value.replace(/[^0-9.-]/g, "")) || 0} previous={m.prev} inverse={m.inverse} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {drillDownPage.scoring && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">V2 評分</h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DiagnosisBadge diagnosis={drillDownPage.scoring.diagnosis} />
                        <ActionBadge action={drillDownPage.scoring.recommendedAction} />
                      </div>
                      <V2ScoreBar scoring={drillDownPage.scoring} />
                      <BenchmarkInfo scoring={drillDownPage.scoring} />
                    </div>
                  )}

                  {!drillDownPage.scoring && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">三維評分</h4>
                      <TriScoreDisplay triScore={drillDownPage.triScore} />
                    </div>
                  )}

                  {(() => {
                    const rec = pageRecommendationMap.get(drillDownPage.pagePath);
                    if (!rec) return null;
                    return <PageRecommendationCard recommendation={rec} />;
                  })()}
                </div>
              </div>
            ) : selectedPageGroupKey ? (
              <div className="space-y-3" data-testid="drilldown-page-list">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPageGroupKey(null)}
                    data-testid="button-back-to-groups-from-list"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回分組
                  </Button>
                  <h4 className="text-sm font-semibold" data-testid="text-group-title">
                    {currentAssetGroups.find((g) => g.key === selectedPageGroupKey)?.label}
                  </h4>
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                    {assetGroupFilteredPages.length} 個頁面
                  </Badge>
                </div>

                {pagesDetailedLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : assetGroupFilteredPages.length > 0 ? (
                  <div className="space-y-2">
                    {assetGroupFilteredPages.map((page, idx) => {
                      const rec = pageRecommendationMap.get(page.pagePath);
                      return (
                        <div
                          key={page.pagePath}
                          className="p-4 rounded-md bg-muted/30 cursor-pointer hover-elevate"
                          onClick={() => setDrillDownPage(page)}
                          data-testid={`card-group-page-${idx}`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold" data-testid={`text-group-page-title-${idx}`}>
                                  {page.pageTitle || page.pagePath}
                                </span>
                                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                                  {pageGroupLabels[page.pageGroup]}
                                </Badge>
                                {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate" data-testid={`text-group-page-path-${idx}`}>{page.pagePath}</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 flex-wrap">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">工作階段</p>
                                <p className="text-sm font-semibold">{formatNumber(page.sessions)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">轉換率</p>
                                <p className="text-sm font-semibold">{formatPercent(page.conversionRate)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">跳出率</p>
                                <p className="text-sm font-semibold">{formatPercent(page.bounceRate)}</p>
                              </div>
                              {rec && (
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">建議</p>
                                  <Badge
                                    variant="secondary"
                                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${priorityColors[rec.priority]}`}
                                  >
                                    {rec.diagnosis}
                                  </Badge>
                                </div>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-group-empty">
                    此分組目前沒有頁面資料
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="grid-page-groups">
                {currentAssetGroups.map((group) => {
                  const count = assetGroupPageCounts.get(group.key) || 0;
                  return (
                    <div
                      key={group.key}
                      className="p-4 rounded-md bg-muted/30 cursor-pointer hover-elevate"
                      onClick={() => setSelectedPageGroupKey(group.key)}
                      data-testid={`card-page-group-${group.key}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold mb-1">{group.label}</h4>
                          <p className="text-xs text-muted-foreground">{group.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                            {count}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
  );
}
