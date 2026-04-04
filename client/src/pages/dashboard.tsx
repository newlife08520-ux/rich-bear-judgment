/** 今日決策中心（首頁）；資料與邏輯見 dashboard/*。 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Clock, RefreshCw, AlertTriangle, ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useEmployee, getDepartmentLabel } from "@/lib/employee-context";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDashboardDecisionCenter } from "./dashboard/useDashboardDecisionCenter";
import { formatTimestamp } from "./dashboard/dashboard-formatters";
import {
  HomepageDataTruthSection,
  HomepageCommandPanelV12Chrome,
  HomepageCommandMetrics,
  HomepageCommandDigest,
  TodayActionsSection,
  ProductProfitOverviewSection,
  BudgetRadarSection,
  CreativeStatusSection,
  DataHealthSection,
  ParetoSummaryCard,
  ScaleRescueHoldSection,
  HomepageScaleRescueSpotlightsSection,
  StrategicDiagnosticsCollapsible,
} from "./dashboard/widgets";
import { VisibilityPolicyStrip } from "@/components/visibility/VisibilityPolicyStrip";
import { DormantGemsSurfaceSection } from "@/components/visibility/DormantGemsSurfaceSection";
import { CommandBand, TrustBand, SpotlightRail, DormantActionStrip } from "@/components/strategic-panel";
import { ExternalMetaDriftBanner } from "@/components/sync/ExternalMetaDriftBanner";
import { ProductScopeToggle } from "@/components/shared/ProductScopeToggle";
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UserSettings } from "@shared/schema";
import { PageLoading } from "@/components/shared/PageLoading";
import { PageQueryError } from "@/components/shared/PageQueryError";
import { DashboardWelcomeEmpty } from "./dashboard/widgets/DashboardWelcomeEmpty";
import { useMetaExecutionGate } from "@/pages/fb-ads/useMetaExecutionGate";
import { useMetaPublishGuard } from "@/hooks/use-meta-publish-guard";
import { createTodayActionExecutor } from "@/lib/run-today-action-execution";
import { ExecutionGateDialog } from "@/components/ExecutionGateDialog";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { employee, employees, setEmployeeById } = useEmployee();
  const {
    scope,
    isRefreshing,
    refreshStatusData,
    actionData,
    derived,
    refreshMutation,
    syncMutation,
    summaryData,
    homepageDataTruth,
    hasDecisionSignals,
    summaryMessage,
    coverageNote,
    dataStatus,
    productViewMode,
    setProductViewMode,
    dashboardLoading,
    dashboardError,
    refetchDashboard,
  } = useDashboardDecisionCenter();

  const { data: settingsData, isLoading: settingsLoading } = useQuery<UserSettings | null>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
  const scopeMismatch = actionData?.sourceMeta?.scopeKey != null && scope.scopeKey !== actionData.sourceMeta.scopeKey;
  const partialHomepage = dataStatus === "partial_data" || homepageDataTruth === "partial_decision";
  const batchWeak =
    !partialHomepage &&
    (actionData?.batchValidity === "legacy" ||
      actionData?.batchValidity === "insufficient" ||
      summaryData?.batchValidity === "legacy" ||
      summaryData?.batchValidity === "insufficient");

  const diagnosticsAttentionCount =
    (scopeMismatch ? 1 : 0) +
    (dataStatus === "partial_data" && summaryMessage ? 1 : 0) +
    (batchWeak ? 1 : 0) +
    ((dataStatus === "has_data" || dataStatus === "partial_data") && coverageNote ? 1 : 0);
  const diagnosticsHint =
    diagnosticsAttentionCount > 0 ? `${diagnosticsAttentionCount} 項需注意` : "可展開檢視政策與範圍";
  const diagnosticsDefaultOpen = partialHomepage || scopeMismatch || batchWeak;

  const strategicTodayActions = derived.todayActions.filter((a) => a.type !== "規則缺失待補");

  const { toast } = useToast();
  const { data: guardData } = useMetaPublishGuard();
  const metaGate = useMetaExecutionGate();
  const runTodayExecution = useMemo(
    () => createTodayActionExecutor(metaGate, toast),
    [metaGate, toast]
  );
  const handleExecuteTodayRow = useCallback(
    (row: (typeof strategicTodayActions)[number]) => {
      void runTodayExecution(row);
    },
    [runTodayExecution]
  );
  const todayExecution = {
    metaWritesAllowed: guardData?.metaWritesAllowed === true,
    guardMessage: guardData?.metaWritesAllowed ? null : (guardData?.message ?? "Meta 寫入未啟用"),
    busy: metaGate.execBusy,
    onExecuteRow: handleExecuteTodayRow,
  };

  const showWelcomeEmpty =
    dataStatus === "no_sync" ||
    dataStatus === "synced_no_data" ||
    (!actionData?.sourceMeta?.batchId &&
      (actionData?.productLevel?.length ?? 0) === 0 &&
      (actionData?.creativeLeaderboard?.length ?? 0) === 0);

  const hasGeminiKey = Boolean(settingsData?.aiApiKey?.trim());
  const hasMetaToken = Boolean(settingsData?.fbAccessToken?.trim());
  const hasBatchData = Boolean(
    actionData?.sourceMeta?.batchId &&
      ((actionData?.productLevel?.length ?? 0) > 0 || (actionData?.creativeLeaderboard?.length ?? 0) > 0)
  );

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            今日決策中心
          </h1>
          {isDev && (
            <Select value={employee.id} onValueChange={setEmployeeById} data-testid="select-mock-employee">
              <SelectTrigger className="w-[220px] border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/30">
                <SelectValue placeholder="模擬登入者 (dev)" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    [{getDepartmentLabel(emp.department)}] {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {refreshStatusData?.lastRefreshedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-refreshed">
              <Clock className="w-3 h-3" />
              資料更新: {formatTimestamp(refreshStatusData.lastRefreshedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/execution-history" data-testid="link-dashboard-to-execution-audit">
              <ClipboardList className="w-4 h-4" />
              執行稽核
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate({ runRefreshAfterSync: true })}
            disabled={!!isRefreshing}
            className="gap-2"
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? (refreshStatusData?.currentStep || "更新中...") : "更新資料"}
          </Button>
          <ProductScopeToggle mode={productViewMode} onModeChange={setProductViewMode} />
          <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />
        </div>
      </header>

      <ExternalMetaDriftBanner surface="dashboard" />

      {dashboardLoading ? (
        <PageLoading />
      ) : dashboardError ? (
        <div className="p-4 md:p-6 page-container-fluid">
          <PageQueryError
            message={dashboardError instanceof Error ? dashboardError.message : "載入失敗"}
            onRetry={refetchDashboard}
          />
        </div>
      ) : showWelcomeEmpty ? (
        settingsLoading ? (
          <PageLoading />
        ) : (
          <DashboardWelcomeEmpty
            hasGeminiKey={hasGeminiKey}
            hasMetaToken={hasMetaToken}
            hasBatchData={hasBatchData}
          />
        )
      ) : (
      <div className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <section className="space-y-6" aria-label="戰略指揮面板">
          <HomepageCommandPanelV12Chrome partialHomepage={partialHomepage}>
            <HomepageCommandMetrics
              totalSpend={derived.productOverview.totalSpend}
              totalRevenue={derived.productOverview.totalRevenue}
              weightedRoas={derived.productOverview.weightedRoas}
              pendingCount={strategicTodayActions.length}
            />
            <CommandBand data-testid="rail-homepage-top3-command-v12">
              <TodayActionsSection todayActions={strategicTodayActions.slice(0, 3)} execution={todayExecution} />
            </CommandBand>
            {partialHomepage ? (
              <div
                role="status"
                className="rounded-lg border-2 border-sky-600 bg-sky-100/95 dark:bg-sky-950/50 px-3 py-3.5 text-sm text-sky-950 dark:text-sky-50 leading-snug space-y-3 shadow-lg shadow-sky-500/20"
                data-testid="banner-partial-first-screen-actionability-v12"
              >
                <p>
                  目前為<strong>部分資料</strong>：仍可依「今日戰略指令」與下方「資料狀態」行動；摘要若較晚出現，不阻擋數值決策。
                </p>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]"
                  data-testid="grid-partial-data-usability-v11"
                >
                  <div className="rounded-md border border-emerald-400/50 bg-emerald-50/80 dark:bg-emerald-950/30 px-2.5 py-2">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">此刻可用（主決策）</p>
                    <p className="text-muted-foreground mt-1">
                      今日戰略指令、五大決策區數值、加碼／救援焦點、沉睡復活名單（同一資料範圍）。
                    </p>
                  </div>
                  <div className="rounded-md border border-amber-400/50 bg-amber-50/70 dark:bg-amber-950/25 px-2.5 py-2">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">僅供參考／易變</p>
                    <p className="text-muted-foreground mt-1">
                      跨帳摘要與營運敘事—若與數字牴觸，以左欄數值為準。
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <TrustBand data-testid="band-homepage-data-truth-v11">
              <HomepageDataTruthSection
                dataStatus={dataStatus}
                homepageDataTruth={homepageDataTruth}
                hasDecisionSignals={hasDecisionSignals}
                summaryMessage={summaryMessage}
                summarySource={summaryData?.summary?.summarySource}
                coverageNote={coverageNote}
                partialHomepage={partialHomepage}
                scopeMismatch={scopeMismatch}
                batchWeak={batchWeak}
              />
            </TrustBand>
            <div data-testid="block-homepage-command-digest-wrap-v11" className="border-l-2 border-l-muted-foreground/25 pl-2">
              <HomepageCommandDigest />
            </div>
            <SpotlightRail data-testid="rail-homepage-scale-rescue-spotlights-v12">
              <HomepageScaleRescueSpotlightsSection
                scaleUp={actionData?.tableScaleUp ?? []}
                rescue={actionData?.tableRescue ?? []}
              />
            </SpotlightRail>
            <DormantActionStrip data-testid="strip-homepage-dormant-revive-v12">
              <DormantGemsSurfaceSection surface="dashboard" candidates={actionData?.dormantGemCandidates ?? []} />
            </DormantActionStrip>
          </HomepageCommandPanelV12Chrome>
          <Collapsible defaultOpen={false} data-testid="collapsible-homepage-secondary-ops">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground text-sm px-0">
                <span className="font-medium">
                  營運細節（次級）：戰略三桶完整列／賺賠總覽／Pareto／雷達／素材／資料健康
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-3">
              <p className="text-xs text-muted-foreground px-0.5 -mt-1">
                以下非第一優先，用於排查與細節；主決策請以上方第一屏為準。
              </p>
              <ScaleRescueHoldSection
                scaleUp={actionData?.tableScaleUp ?? []}
                rescue={actionData?.tableRescue ?? []}
                holdWatch={derived.productOverview.buckets.watch}
              />
              <ProductProfitOverviewSection overview={derived.productOverview} />
              <ParetoSummaryCard />
              <BudgetRadarSection radar={derived.budgetRadar} />
              <CreativeStatusSection status={derived.creativeStatus} />
              <DataHealthSection health={derived.dataHealth} />
            </CollapsibleContent>
          </Collapsible>
        </section>

        <StrategicDiagnosticsCollapsible defaultOpen={diagnosticsDefaultOpen} triggerHint={diagnosticsHint}>
          <VisibilityPolicyStrip
            surface="dashboard"
            dormantGemCandidates={actionData?.dormantGemCandidates ?? []}
            noDeliveryCount={actionData?.budgetActionNoDelivery?.length ?? 0}
            underSampleCount={actionData?.budgetActionUnderSample?.length ?? 0}
            visibilityPolicyVersion={actionData?.visibilityPolicyVersion}
          />
          {scopeMismatch && (
            <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30">
              <CardContent className="py-3 px-4 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                目前查看範圍與資料範圍不一致，請點「更新資料」取得正確範圍的決策。
              </CardContent>
            </Card>
          )}
          {dataStatus === "partial_data" && summaryMessage ? (
            <p className="text-xs text-muted-foreground px-1" data-testid="banner-homepage-partial-data">
              部分資料說明請見上方「資料狀態」；此處為政策與範圍細節。
            </p>
          ) : null}
          {batchWeak && (
            <Card
              className={cn(
                actionData?.batchValidity === "insufficient" || summaryData?.batchValidity === "insufficient"
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30"
                  : "border-muted bg-muted/30"
              )}
            >
              <CardContent className="py-3 px-4 text-sm">
                {actionData?.batchValidity === "insufficient" || summaryData?.batchValidity === "insufficient"
                  ? "資料不足，請先更新資料後再依決策區建議操作。"
                  : "目前為舊版資料僅供參考，核心決策請以「今日戰略指令」與戰略三桶為準。"}
                {(actionData?.batchValidityReason || summaryData?.batchValidityReason) && (
                  <span className="text-muted-foreground ml-1">
                    （{actionData?.batchValidityReason || summaryData?.batchValidityReason}）
                  </span>
                )}
              </CardContent>
            </Card>
          )}
        </StrategicDiagnosticsCollapsible>

        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground text-sm">
              <span className="font-medium">舊版報表（次級）</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              完整報表請至「商品中心」「預算控制」「素材審判」查看。
            </p>
            {actionData?.sourceMeta?.generatedAt ? (
              <p className="text-xs text-muted-foreground">
                資料彙整時間：{actionData.sourceMeta.generatedAt}
                {actionData.sourceMeta.campaignCountUsed != null
                  ? ` · 納入廣告組合數：${actionData.sourceMeta.campaignCountUsed}`
                  : ""}
              </p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </div>
      )}

      <ExecutionGateDialog
        open={metaGate.execGateOpen}
        onOpenChange={metaGate.onExecGateOpenChange}
        gate={metaGate.execGate}
        onConfirm={metaGate.confirmMetaExecution}
        confirming={metaGate.execGateConfirming}
        error={metaGate.execConfirmError}
        title="Meta 操作確認"
        intro="請確認以下預覽步驟無誤後勾選並核准，系統將寫入 Meta。"
        checkboxLabel="我已知悉並同意執行上述 Meta 操作"
      />
    </div>
  );
}
