/**
 * Batch 10.3：首頁第一屏「今日最值得放大／最需要止血」焦點列（完整三桶在次級摺疊）。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { TrendingUp, Siren } from "lucide-react";
import { formatCurrency } from "../dashboard-formatters";
import type { BudgetActionRow } from "../dashboard-types";

export function HomepageScaleRescueSpotlightsSection({
  scaleUp,
  rescue,
}: {
  scaleUp: BudgetActionRow[];
  rescue: BudgetActionRow[];
}) {
  const topScale = scaleUp.slice(0, 4);
  const rescueOrdered = [
    ...rescue.filter((r) => r.suggestedPct === "關閉"),
    ...rescue.filter((r) => r.suggestedPct !== "關閉"),
  ].slice(0, 4);

  return (
    <section data-testid="section-homepage-scale-rescue-spotlights" aria-label="今日放大與止血焦點">
      <Card className="border-slate-200 bg-white border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow dark:border-border dark:bg-card">
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-foreground mb-3">指揮焦點 · 放大與止血（精簡列；完整三桶見下方「營運細節」）</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-emerald-500 p-3 space-y-2 dark:border-border dark:bg-card"
              data-testid="homepage-scale-spotlight"
            >
              <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                今日最值得放大
              </h3>
              {topScale.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {topScale.map((r) => (
                    <li key={r.campaignId} className="rounded-md bg-muted/40 px-2 py-1.5">
                      <span className="font-medium line-clamp-2 text-foreground">
                        {r.productName}
                        {r.campaignName ? ` · ${r.campaignName}` : ""}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        花費 {formatCurrency(r.spend)} · ROAS {r.roas.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">目前無加碼焦點列。</p>
              )}
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-rose-500 p-3 space-y-2 dark:border-border dark:bg-card"
              data-testid="homepage-rescue-spotlight"
            >
              <h3 className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <Siren className="w-3.5 h-3.5 shrink-0" />
                今日最需要止血
              </h3>
              {rescueOrdered.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {rescueOrdered.map((r) => (
                    <li
                      key={r.campaignId}
                      className={`rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 border-l-4 dark:border-border dark:bg-muted/20 ${
                        r.suggestedPct === "關閉" ? "border-l-rose-500" : "border-l-amber-500"
                      }`}
                    >
                      <span className="font-medium line-clamp-2">{r.campaignName}</span>
                      <p className="text-[11px] text-muted-foreground">
                        {r.suggestedPct === "關閉" ? (
                          <span className="text-rose-700 dark:text-rose-300">建議關閉</span>
                        ) : (
                          <>
                            {r.suggestedAction} {r.suggestedPct}%
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">目前無救援焦點列。</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            零花費診斷與「沉睡／暫停高潛」分桶—見{" "}
            <Link href="/fb-ads" className="text-primary underline-offset-2 hover:underline">
              預算控制
            </Link>{" "}
            與本頁復活區塊。
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
