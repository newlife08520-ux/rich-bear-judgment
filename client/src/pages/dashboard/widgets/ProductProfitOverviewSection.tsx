/**
 * 區塊 2：商品賺賠總覽。client 端分類：賺錢/賠錢/觀察/待補規則；Top 加碼、Top 危險。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Trophy, TrendingDown } from "lucide-react";
import { formatCurrency } from "../dashboard-formatters";
import type { BudgetActionRow, ProductLevelItem } from "../dashboard-types";

interface ProductOverviewDerived {
  totalSpend: number;
  totalRevenue: number;
  weightedRoas: number;
  countProfit: number;
  countLoss: number;
  countWatch: number;
  countRulesMissing: number;
  countZeroSpend?: number;
  zeroSpendProducts?: ProductLevelItem[];
  /** Top 加碼：優先 tableScaleUp（活動維度） */
  topScaleUp: BudgetActionRow[];
  topRescue: BudgetActionRow[];
}

export function ProductProfitOverviewSection({ overview }: { overview: ProductOverviewDerived }) {
  const {
    totalSpend,
    totalRevenue,
    weightedRoas,
    countProfit,
    countLoss,
    countWatch,
    countRulesMissing,
    countZeroSpend = 0,
    zeroSpendProducts = [],
    topScaleUp,
    topRescue,
  } = overview;
  const zeroSample = zeroSpendProducts.slice(0, 8);

  return (
    <section data-testid="section-product-profit-overview">
      <Card className="border-border/80 hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--status-profit)] shrink-0" />
              商品賺賠總覽
            </h2>
            <Link href="/products" className="text-xs text-muted-foreground hover:text-primary shrink-0">
              前往商品中心 →
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            總花費 / 營收 / 加權 ROAS；賺·賠·觀察·待補規則件數。
            <span className="block mt-1 text-amber-800/90 dark:text-amber-200/80">
              零花費商品另列於下方「獨立區」，不併入賺賠主分類，也不塞進加碼／救援桶。
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm mb-4">
            <span>
              總花費 <strong className="text-lg">{formatCurrency(totalSpend)}</strong>
            </span>
            <span>
              營收 <strong className="text-lg text-[var(--status-profit)] font-black tabular-nums">{formatCurrency(totalRevenue)}</strong>
            </span>
            <span>
              加權 ROAS <strong className="text-lg">{weightedRoas.toFixed(2)}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm mb-4">
            <span className="text-[var(--status-profit)]">賺錢 {countProfit}</span>
            <span className="text-[var(--status-loss)]">賠錢 {countLoss}</span>
            <span className="text-muted-foreground">觀察 {countWatch}</span>
            <span className="text-[var(--status-watch)]">待補規則 {countRulesMissing}</span>
            {countZeroSpend > 0 && (
              <span className="text-[var(--status-dormant)] border border-[var(--status-dormant-light)] rounded px-2 py-0.5 text-xs">
                零花費（另區） {countZeroSpend}
              </span>
            )}
          </div>
          {countZeroSpend > 0 && (
            <div
              className="mb-4 rounded-xl border border-slate-200 bg-white border-l-4 border-l-indigo-500 px-3 py-2.5 dark:border-border dark:bg-card"
              data-testid="strip-zero-spend-products"
            >
              <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100 mb-1.5">
                本資料窗為 $0 花費之商品（未與賺賠列混排）
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-indigo-900/85 dark:text-indigo-100/85">
                {zeroSample.map((p) => (
                  <li key={p.productName}>
                    <Link href="/products" className="hover:underline font-medium">
                      {p.productName}
                    </Link>
                  </li>
                ))}
                {countZeroSpend > zeroSample.length && (
                  <li className="text-muted-foreground">…等共 {countZeroSpend} 筆</li>
                )}
              </ul>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Top 加碼</h3>
              {topScaleUp.length > 0 ? (
                <ul className="space-y-1.5">
                  {topScaleUp.map((r) => (
                    <li key={r.campaignId} className="rounded-lg border border-border/60 bg-muted/20 p-2">
                      <Link href="/products" className="font-medium text-foreground hover:underline">
                        {r.productName}{r.campaignName ? ` · ${r.campaignName}` : ""}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        花費 {formatCurrency(r.spend)} · ROAS {r.roas.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">尚無</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                Top 危險
              </h3>
              {topRescue.length > 0 ? (
                <ul className="space-y-1.5">
                  {topRescue.slice(0, 5).map((r) => (
                    <li key={r.campaignId} className="rounded-lg border-l-4 border-rose-500 bg-muted/20 p-2 pl-3">
                      <span className="font-medium text-foreground truncate block">
                        {r.productName} · {r.campaignName}
                      </span>
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                        花費 {formatCurrency(r.spend)} · 建議 {r.suggestedAction}{" "}
                        {r.suggestedPct === "關閉" ? "關閉" : `${r.suggestedPct}%`}
                      </p>
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
