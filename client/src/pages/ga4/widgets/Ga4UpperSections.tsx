import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Eye, ShoppingCart, CreditCard, TrendingUp, BarChart3, Clock, Percent,
} from "lucide-react";
import type { GA4FunnelOverview, GA4AIDirectorSummary } from "@shared/schema";
import type { HighRiskItem } from "@shared/schema";
import { formatNumber, formatPercent } from "../ga4-formatters";
import { ChangeIndicator, HighRiskSection } from "./shared";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4UpperSections({
  directorLoading,
  directorSummary,
  highRiskItems,
  highRiskLoading,
  funnelLoading,
  funnelOverview,
}: Pick<
  Ga4Workbench,
  | "directorLoading"
  | "directorSummary"
  | "highRiskItems"
  | "highRiskLoading"
  | "funnelLoading"
  | "funnelOverview"
>) {
  return (
    <>
        {!directorLoading && !directorSummary && (
          <Card className="border-dashed border-slate-300 bg-white border-l-4 border-l-indigo-500 dark:border-border dark:bg-card">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">漏斗 / 站內證據 — 使用步驟</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground mb-4">
                <li>在<strong className="text-foreground">設定中心</strong>串接 GA4 Property（離開欄位會自動儲存）。</li>
                <li>在上方選擇 GA4 資產後，點<strong className="text-foreground">「更新資料」</strong>取得最新漏斗與頁面數據。</li>
                <li>若仍無資料，請至<strong className="text-foreground">設定中心</strong>檢查 GA4 連線與權限。</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings">前往設定中心</a>
              </Button>
            </CardContent>
          </Card>
        )}
        {directorLoading ? (
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-20 mb-3" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </CardContent>
          </Card>
        ) : directorSummary ? (
          <Card className="border-emerald-200 dark:border-emerald-800" data-testid="card-director-summary">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="section-title text-muted-foreground" data-testid="text-director-title">漏斗整體判斷</h3>
              </div>
              <p className="text-base font-bold leading-relaxed mb-4" data-testid="text-director-verdict">
                {directorSummary.verdict}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">最大殺手</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-biggest-killer">{directorSummary.biggestKiller}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">最該先修</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-fix-first">{directorSummary.fixFirst}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">該修頁面還是加流量</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-fix-or-traffic">{directorSummary.fixOrTraffic}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <HighRiskSection items={highRiskItems} isLoading={highRiskLoading} />

        {funnelLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
              ))}
            </div>
            <Skeleton className="h-24" />
          </div>
        ) : funnelOverview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="grid-kpis">
              {[
                { label: "工作階段", value: formatNumber(funnelOverview.sessions), change: funnelOverview.sessions - funnelOverview.prevPeriod.sessions, prev: funnelOverview.prevPeriod.sessions, icon: Users },
                { label: "使用者", value: formatNumber(funnelOverview.users), change: 0, prev: 0, icon: Users },
                { label: "商品瀏覽率", value: formatPercent(funnelOverview.productViewRate), change: funnelOverview.productViewRate - funnelOverview.prevPeriod.productViewRate, prev: funnelOverview.prevPeriod.productViewRate, icon: Eye },
                { label: "加購率", value: formatPercent(funnelOverview.addToCartRate), change: funnelOverview.addToCartRate - funnelOverview.prevPeriod.addToCartRate, prev: funnelOverview.prevPeriod.addToCartRate, icon: ShoppingCart },
                { label: "結帳率", value: formatPercent(funnelOverview.checkoutRate), change: funnelOverview.checkoutRate - funnelOverview.prevPeriod.checkoutRate, prev: funnelOverview.prevPeriod.checkoutRate, icon: CreditCard },
                { label: "購買率", value: formatPercent(funnelOverview.purchaseRate), change: funnelOverview.purchaseRate - funnelOverview.prevPeriod.purchaseRate, prev: funnelOverview.prevPeriod.purchaseRate, icon: TrendingUp },
                { label: "整體導購率", value: formatPercent(funnelOverview.overallConversionRate), change: funnelOverview.overallConversionRate - funnelOverview.prevPeriod.overallConversionRate, prev: funnelOverview.prevPeriod.overallConversionRate, icon: BarChart3 },
                { label: "平均停留", value: `${funnelOverview.avgDuration} 秒`, change: 0, prev: 0, icon: Clock },
                { label: "跳出率", value: formatPercent(funnelOverview.bounceRate), change: 0, prev: 0, icon: Percent, inverse: true },
                { label: "參與率", value: formatPercent(funnelOverview.engagementRate), change: 0, prev: 0, icon: Activity },
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <Card key={idx} data-testid={`kpi-card-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {kpi.prev !== 0 && (
                          <ChangeIndicator current={kpi.change + kpi.prev} previous={kpi.prev} inverse={kpi.inverse} />
                        )}
                      </div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{kpi.label}</p>
                      <p className="text-lg font-bold" data-testid={`kpi-value-${idx}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card data-testid="card-funnel-visual">
              <CardContent className="p-5">
                <h3 className="section-title mb-4">各階段轉換表現</h3>
                <div className="flex items-end gap-2">
                  {[
                    { label: "著陸頁瀏覽", count: funnelOverview.landingPageViews, rate: 100 },
                    { label: "商品瀏覽", count: funnelOverview.productViews, rate: Math.min(100, funnelOverview.productViewRate) },
                    { label: "加入購物車", count: funnelOverview.addToCartCount, rate: Math.min(100, funnelOverview.addToCartRate) },
                    { label: "開始結帳", count: funnelOverview.checkoutStartCount, rate: Math.min(100, funnelOverview.checkoutRate) },
                    { label: "完成購買", count: funnelOverview.purchases, rate: Math.min(100, funnelOverview.purchaseRate) },
                  ].map((stage, idx, arr) => {
                    const maxCount = arr[0].count || 1;
                    const heightPercent = Math.max((stage.count / maxCount) * 100, 15);
                    const funnelColors = [
                      "bg-emerald-500",
                      "bg-emerald-400",
                      "bg-emerald-300",
                      "bg-amber-400",
                      "bg-rose-400",
                    ];
                    const rawDrop = idx > 0 && arr[idx - 1].count > 0 ? ((arr[idx - 1].count - stage.count) / arr[idx - 1].count) * 100 : 0;
                    const dropRate = idx > 0 ? Math.max(0, rawDrop).toFixed(2) : null;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1" data-testid={`funnel-stage-${idx}`}>
                        <span className="text-xs font-medium">{formatNumber(stage.count)}</span>
                        <span className="text-xs text-muted-foreground">{stage.rate.toFixed(2)}%</span>
                        <div
                          className={`w-full ${funnelColors[idx]} rounded-md transition-all`}
                          style={{ height: `${heightPercent}px`, minHeight: "12px" }}
                        />
                        <span className="text-xs text-muted-foreground text-center mt-1">{stage.label}</span>
                        {dropRate && (
                          <span className="text-xs text-rose-500">
                            -{dropRate}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
    </>
  );
}
