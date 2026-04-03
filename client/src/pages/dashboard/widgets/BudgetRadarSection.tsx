/**
 * 區塊 3：預算雷達。建議加碼 / 下降 / 停止；資料來自 tableScaleUp、tableRescue、urgentStop。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Rocket, TrendingDown, StopCircle } from "lucide-react";
import { formatCurrency } from "../dashboard-formatters";
import type { BudgetActionRow } from "../dashboard-types";

interface BudgetRadarDerived {
  scaleUp: BudgetActionRow[];
  scaleDown: BudgetActionRow[];
  stop: Array<{ campaignId: string; campaignName: string; productName: string; spend: number; reason: string; suggestedAction: string; suggestedPct: number | "關閉" }>;
}

export function BudgetRadarSection({ radar }: { radar: BudgetRadarDerived }) {
  const { scaleUp, scaleDown, stop } = radar;

  return (
    <section data-testid="section-budget-radar">
      <Card className="border-border/80">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">預算雷達</h2>
            <Link href="/fb-ads" className="text-xs text-muted-foreground hover:text-primary shrink-0">
              前往預算控制 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <h3 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                <Rocket className="w-3.5 h-3.5" />
                建議加碼
              </h3>
              {scaleUp.length > 0 ? (
                <ul className="space-y-2">
                  {scaleUp.map((r) => (
                    <li key={r.campaignId} className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 p-2 text-sm">
                      <span className="font-medium truncate block">{r.productName} · {r.campaignName}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(r.spend)} · ROAS {r.roas.toFixed(2)} · {r.suggestedAction}{" "}
                        {r.suggestedPct === "關閉" ? "關閉" : `+${r.suggestedPct}%`}
                      </p>
                      {r.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={r.reason}>{r.reason}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">尚無</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                建議下降
              </h3>
              {scaleDown.length > 0 ? (
                <ul className="space-y-2">
                  {scaleDown.map((r) => (
                    <li key={r.campaignId} className="rounded-lg border border-amber-200/60 dark:border-amber-800/40 p-2 text-sm">
                      <span className="font-medium truncate block">{r.productName} · {r.campaignName}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(r.spend)} · {r.suggestedAction} {r.suggestedPct === "關閉" ? "關閉" : `${r.suggestedPct}%`}
                      </p>
                      {r.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={r.reason}>{r.reason}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">尚無</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                <StopCircle className="w-3.5 h-3.5" />
                建議停止
              </h3>
              {stop.length > 0 ? (
                <ul className="space-y-2">
                  {stop.map((s, i) => (
                    <li key={s.campaignId || i} className="rounded-lg border border-red-200/60 dark:border-red-800/40 p-2 text-sm">
                      <span className="font-medium truncate block">{s.productName ? `${s.productName} · ` : ""}{s.campaignName}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(s.spend)} · {s.suggestedAction}
                      </p>
                      {s.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={s.reason}>{s.reason}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">尚無</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
