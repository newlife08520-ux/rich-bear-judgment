/**
 * 區塊 1：War room — 今日最優先（首頁僅傳入 Top N，通常 3 筆）。資料來源：actionData.todayActions
 */
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ListChecks, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, getEvidenceLabel } from "../dashboard-formatters";
import type { TodayActionRow } from "../dashboard-types";

export function TodayActionsSection({ todayActions }: { todayActions: TodayActionRow[] }) {
  return (
    <section data-testid="section-today-actions">
      <Card className="border-primary/30 bg-gradient-to-b from-primary/8 to-transparent shadow-md ring-1 ring-primary/10">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 sm:text-xl" data-testid="heading-war-room-top-actions">
              <ListChecks className="w-5 h-5 text-primary shrink-0" />
              今日先打這三件（War room）
            </h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              第一屏只留最高優先；其餘動作與「指揮語 digest」在真相列之後。政策／partial／批次細節收合於下方「資料信任與政策」。
            </p>
          </div>
          {todayActions.length > 0 ? (
            <ul className="space-y-4">
              {todayActions.map((a, i) => (
                <li
                  key={`${a.type}-${a.productName}-${a.campaignId ?? a.campaignName ?? i}`}
                  className="rounded-xl border border-border/80 bg-background p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium",
                        a.type === "止血" && "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                        a.type === "放大" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                        a.type === "不要誤殺" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                        a.type === "值得延伸" && "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
                        a.type === "規則缺失待補" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {a.type}
                    </span>
                    <span className="inline-flex items-center rounded border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      影響面：{a.objectType}
                    </span>
                    <span className="font-medium text-sm text-foreground">
                      {a.productName}
                      {a.campaignName ? ` · ${a.campaignName}` : ""}
                    </span>
                    {a.evidenceLevel && getEvidenceLabel(a.evidenceLevel) && (
                      <span className="text-[11px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                        {getEvidenceLabel(a.evidenceLevel)}
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] sm:text-base leading-relaxed text-foreground mt-1 font-medium" data-testid="director-verdict">
                    {a.directorVerdict}
                  </p>
                  {a.reason ? (
                    <p className="text-xs text-muted-foreground mt-2 border-l-2 border-primary/30 pl-2" data-testid="today-action-why">
                      <span className="font-medium text-foreground/80">為何現在：</span>
                      {a.reason}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                    <span>花費 {formatCurrency(a.spend)}</span>
                    <span>ROAS {a.roas.toFixed(2)}</span>
                    {a.breakEvenRoas != null && <span>保本 {a.breakEvenRoas.toFixed(2)}</span>}
                    {a.targetRoas != null && <span>目標 {a.targetRoas.toFixed(2)}</span>}
                    <span>
                      {a.suggestedAction} {a.suggestedPct === "關閉" ? "關閉" : `${a.suggestedPct}%`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              本批尚無決策就緒項目。請先至{" "}
              <Link href="/settings/profit-rules" className="text-primary hover:underline inline-flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                獲利規則中心
              </Link>{" "}
              設定各商品成本比與目標 ROAS，並同步資料。
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
