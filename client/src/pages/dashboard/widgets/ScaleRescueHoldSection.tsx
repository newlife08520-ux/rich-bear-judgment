/**
 * 首頁戰略三桶：加碼 / 救援（含縮減與關閉建議）/ 觀察 Hold。
 * 資料來源：action-center tableScaleUp、tableRescue、商品觀察桶（有花費且非賺非賠）。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Scale, HeartPulse, Hand } from "lucide-react";
import { formatCurrency } from "../dashboard-formatters";
import type { BudgetActionRow, ProductLevelItem } from "../dashboard-types";

export function ScaleRescueHoldSection({
  scaleUp,
  rescue,
  holdWatch,
}: {
  scaleUp: BudgetActionRow[];
  rescue: BudgetActionRow[];
  holdWatch: ProductLevelItem[];
}) {
  const rescueTune = rescue.filter((r) => r.suggestedPct !== "關閉").slice(0, 5);
  const rescueStop = rescue.filter((r) => r.suggestedPct === "關閉").slice(0, 4);
  const hold = holdWatch.slice(0, 6);

  return (
    <section data-testid="section-scale-rescue-hold" aria-label="戰略三桶">
      <Card className="border-slate-200 bg-white border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow dark:border-border dark:bg-card">
        <CardContent className="p-5 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-[var(--status-profit)] shrink-0" />
              戰略三桶：加碼 · 救援 · 觀察（Hold）
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              由決策引擎與活動列驅動；零花費商品不列於此（見「賺賠總覽」旁之獨立區）。與未投遞／樣本不足診斷分離。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--status-profit)] flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" />
                加碼（Scale）
              </h3>
              {scaleUp.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {scaleUp.map((r) => (
                    <li key={r.campaignId} className="rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="font-medium line-clamp-2">
                        {r.productName}
                        {r.campaignName ? ` · ${r.campaignName}` : ""}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        花費 {formatCurrency(r.spend)} · ROAS {r.roas.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">目前無加碼建議列。</p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5" />
                救援（Rescue）
              </h3>
              {rescueTune.length + rescueStop.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {rescueTune.map((r) => (
                    <li key={`t-${r.campaignId}`} className="rounded-md border-l-2 border-amber-500/80 pl-2 py-1">
                      <span className="font-medium line-clamp-2">{r.campaignName}</span>
                      <p className="text-[11px] text-muted-foreground">
                        {r.suggestedAction} {r.suggestedPct === "關閉" ? "" : `${r.suggestedPct}%`}
                      </p>
                    </li>
                  ))}
                  {rescueStop.map((r) => (
                    <li key={`s-${r.campaignId}`} className="rounded-md border-l-2 border-rose-500/70 pl-2 py-1">
                      <span className="font-medium line-clamp-2">{r.campaignName}</span>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">建議關閉</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">目前無救援列。</p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Hand className="w-3.5 h-3.5" />
                觀察（Hold）
              </h3>
              {hold.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {hold.map((p) => (
                    <li key={p.productName} className="flex justify-between gap-2 text-xs">
                      <Link href="/products" className="font-medium hover:underline truncate">
                        {p.productName}
                      </Link>
                      <span className="text-muted-foreground shrink-0">ROAS {p.roas.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">觀察桶目前為空。</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
