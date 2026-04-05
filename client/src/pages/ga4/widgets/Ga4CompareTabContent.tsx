import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { V2ScoreMini, V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type { GA4PageMetricsDetailed } from "@shared/schema";
import { pageGroupLabels } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import { RiskLevelBadge, TriScoreDisplay } from "./shared";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4CompareTabContent(w: Ga4Workbench) {
  const {
    pagesDetailedData, compareSelectedPaths, toggleComparePath, comparePageData,
  } = w;

  return (
    <Card data-testid="card-page-comparator-detailed">
      <CardContent className="p-5">
        <h3 className="section-title mb-1">頁面比較分析</h3>
        <p className="text-xs text-muted-foreground mb-4">選擇 2-4 個頁面進行深度比較</p>

        {pagesDetailedData?.pages && pagesDetailedData.pages.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {pagesDetailedData.pages.map((page, idx) => {
                const isSelected = compareSelectedPaths.has(page.pagePath);
                return (
                  <label
                    key={page.pagePath}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                      isSelected ? "bg-slate-100 border-l-4 border-l-emerald-500 dark:bg-muted/40" : "bg-muted/20"
                    }`}
                    data-testid={`checkbox-compare-${idx}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleComparePath(page.pagePath)}
                      disabled={!isSelected && compareSelectedPaths.size >= 4}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{page.pageTitle || page.pagePath}</span>
                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                          {pageGroupLabels[page.pageGroup]}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{page.pagePath}</span>
                    </div>
                    {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                  </label>
                );
              })}
            </div>

            {comparePageData.length >= 2 ? (
              <div className="space-y-4">
                <div className="table-scroll-container rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold bg-muted/30">指標</TableHead>
                        {comparePageData.map((p) => (
                          <TableHead key={p.pagePath} className="text-xs bg-muted/30">
                            <div className="space-y-1">
                              <span className="font-semibold">{p.pageTitle || p.pagePath}</span>
                              <div className="flex items-center gap-1.5">
                                {p.scoring ? <DiagnosisBadge diagnosis={p.scoring.diagnosis} /> : <RiskLevelBadge level={p.riskLevel} />}
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {([
                        { key: "sessions" as const, label: "工作階段", format: formatNumber },
                        { key: "pageviews" as const, label: "瀏覽量", format: formatNumber },
                        { key: "avgEngagementTime" as const, label: "平均互動時間 (秒)", format: (v: number) => `${v.toFixed(1)}` },
                        { key: "bounceRate" as const, label: "跳出率", format: formatPercent, inverse: true },
                        { key: "addToCart" as const, label: "加入購物車", format: formatNumber },
                        { key: "beginCheckout" as const, label: "開始結帳", format: formatNumber },
                        { key: "purchases" as const, label: "購買次數", format: formatNumber },
                        { key: "revenue" as const, label: "營收", format: (v: number) => `$${v.toLocaleString()}` },
                        { key: "conversionRate" as const, label: "轉換率", format: formatPercent },
                      ] as { key: keyof GA4PageMetricsDetailed; label: string; format: (v: number) => string; inverse?: boolean }[]).map((metric) => {
                        const values = comparePageData.map((p) => p[metric.key] as number);
                        const isInverse = metric.inverse === true;
                        const bestVal = isInverse ? Math.min(...values) : Math.max(...values);
                        const worstVal = isInverse ? Math.max(...values) : Math.min(...values);
                        return (
                          <TableRow key={metric.key as string} data-testid={`row-compare-detailed-${metric.key as string}`}>
                            <TableCell className="text-sm font-medium text-muted-foreground">{metric.label}</TableCell>
                            {comparePageData.map((p) => {
                              const val = p[metric.key] as number;
                              let cellClass = "";
                              if (values.length > 1 && val === bestVal)
                                cellClass = "bg-slate-50 border-l-2 border-l-emerald-500 dark:bg-muted/30";
                              if (values.length > 1 && val === worstVal) cellClass = "bg-rose-50/50 dark:bg-rose-950/30";
                              const isBest = values.length > 1 && val === bestVal;
                              const isWorst = values.length > 1 && val === worstVal;
                              return (
                                <TableCell
                                  key={p.pagePath}
                                  className={`text-sm ${cellClass}`}
                                  data-testid={`cell-compare-detailed-${metric.key as string}-${p.pagePath}`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={isBest ? "font-bold text-emerald-600 dark:text-emerald-400" : isWorst ? "font-bold text-rose-600 dark:text-rose-400" : ""}>
                                      {metric.format(val)}
                                    </span>
                                    {isBest && <Star className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      <TableRow data-testid="row-compare-detailed-triscore">
                        <TableCell className="text-sm font-medium text-muted-foreground">三維評分</TableCell>
                        {comparePageData.map((p) => (
                          <TableCell key={p.pagePath}>
                            {p.scoring ? <V2ScoreMini scoring={p.scoring} /> : <TriScoreDisplay triScore={p.triScore} />}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow data-testid="row-compare-detailed-risk">
                        <TableCell className="text-sm font-medium text-muted-foreground">風險等級</TableCell>
                        {comparePageData.map((p) => (
                          <TableCell key={p.pagePath}>
                            {p.scoring ? <DiagnosisBadge diagnosis={p.scoring.diagnosis} /> : <RiskLevelBadge level={p.riskLevel} />}
                          </TableCell>
                        ))}
                      </TableRow>
                      {comparePageData.some((p) => p.scoring) && (
                        <TableRow data-testid="row-compare-detailed-v2-detail">
                          <TableCell className="text-sm font-medium text-muted-foreground">V2 詳細</TableCell>
                          {comparePageData.map((p) => (
                            <TableCell key={p.pagePath}>
                              {p.scoring && (
                                <div className="space-y-1.5">
                                  <V2ScoreBar scoring={p.scoring} />
                                  <ActionBadge action={p.scoring.recommendedAction} />
                                  <BenchmarkInfo scoring={p.scoring} />
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-compare-detailed-empty">
                請至少選擇 2 個頁面進行比較（最多 4 個）
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-compare-no-data">
            尚無頁面資料，請先更新資料
          </div>
        )}
      </CardContent>
    </Card>
  );
}
