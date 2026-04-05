/**
 * 區塊 1：今日最優先動作（首頁僅傳入 Top N，通常 3 筆）。資料來源：actionData.todayActions
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ListChecks, Calculator, Loader2 } from "lucide-react";
import { formatCurrency, getEvidenceLabel } from "../dashboard-formatters";
import type { TodayActionRow } from "../dashboard-types";
import { mapTodayActionToExecution } from "@/lib/map-suggested-action-to-execution";
import { ActionCard } from "@/components/shared/ActionCard";
import type { StatusSemantic } from "@/components/shared/status-colors";

function todayTypeToSemantic(t: string): StatusSemantic {
  if (t === "止血") return "loss";
  if (t === "放大") return "profit";
  if (t === "不要誤殺") return "watch";
  if (t === "值得延伸") return "info";
  return "neutral";
}

export type TodayActionsExecutionProps = {
  metaWritesAllowed: boolean;
  guardMessage: string | null;
  busy: boolean;
  onExecuteRow: (row: TodayActionRow) => void | Promise<void>;
};

export function TodayActionsSection({
  todayActions,
  execution,
}: {
  todayActions: TodayActionRow[];
  execution?: TodayActionsExecutionProps | null;
}) {
  return (
    <section data-testid="section-today-actions">
      <Card className="border-slate-200 bg-white shadow-md border-l-4 border-l-indigo-500 dark:border-border dark:bg-card">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 sm:text-xl" data-testid="heading-today-top-actions">
              <ListChecks className="w-5 h-5 text-primary shrink-0" />
              今日優先三件事
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-snug">
              先看結論與建議動作；細節在下方「資料狀態」與各主戰場。
            </p>
          </div>
          {todayActions.length > 0 ? (
            <ul className="space-y-4">
              {todayActions.map((a, i) => {
                const plan = execution ? mapTodayActionToExecution(a) : null;
                const showExec = !!plan && execution;
                const title = `${a.type} · ${a.productName}${a.campaignName ? ` · ${a.campaignName}` : ""}`;
                const subtitle = `影響面：${a.objectType}`;
                return (
                  <li key={`${a.type}-${a.productName}-${a.campaignId ?? a.campaignName ?? i}`}>
                    <ActionCard
                      semantic={todayTypeToSemantic(a.type)}
                      title={title}
                      subtitle={subtitle}
                      metrics={
                        <>
                          <span>花費 {formatCurrency(a.spend)}</span>
                          <span>ROAS {a.roas.toFixed(2)}</span>
                          <span>
                            建議：{a.suggestedAction}{" "}
                            {a.suggestedPct === "關閉" ? "關閉" : `${a.suggestedPct}%`}
                          </span>
                        </>
                      }
                    >
                      <p className="text-base font-semibold text-foreground w-full" data-testid="director-verdict">
                        {a.directorVerdict}
                      </p>
                      {showExec ? (
                        <div className="flex flex-col gap-1 w-full sm:flex-row sm:items-center sm:flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-lg w-full sm:w-auto"
                            disabled={!execution!.metaWritesAllowed || execution!.busy}
                            onClick={() => void execution!.onExecuteRow(a)}
                            data-testid="button-today-action-execute"
                          >
                            {execution!.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            執行建議
                          </Button>
                          {!execution!.metaWritesAllowed && execution!.guardMessage ? (
                            <p className="text-xs text-amber-700 dark:text-amber-300 max-w-xs">{execution!.guardMessage}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {a.evidenceLevel && getEvidenceLabel(a.evidenceLevel) ? (
                        <p className="text-xs text-muted-foreground w-full">信號：{getEvidenceLabel(a.evidenceLevel)}</p>
                      ) : null}
                    </ActionCard>
                  </li>
                );
              })}
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
