import { useState } from "react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import { useWorkbenchFilter } from "@/lib/workbench-filter-context";
import { Loader2, RefreshCw, Search, ListChecks, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import { ExecutionGateDialog } from "@/components/ExecutionGateDialog";
import { ExecutionLogDialog } from "@/components/ExecutionLogDialog";
import {
  AccountManagerPanel,
  OperationalSummarySection,
  DirectorSummarySection,
  HighRiskAccountsSection,
  OpportunityBoardSection,
  StopLossSection,
  CreativeOpportunityBoard,
  CreativeTable,
  BuriedGemsSection,
  StopListSection,
  CampaignStructureTab,
  BudgetRecommendationsTab,
  AlertsTab,
  CreativeDetailDialog,
  FbAdsGoalPacingBanner,
} from "./widgets";
import type { useFbAdsWorkbench } from "./useFbAdsWorkbench";
import { useMetaExecutionGate } from "./useMetaExecutionGate";
import { VisibilityPolicyStrip } from "@/components/visibility/VisibilityPolicyStrip";
import { DormantGemsSurfaceSection } from "@/components/visibility/DormantGemsSurfaceSection";
import { DormantGemsWorkflowRibbon } from "@/components/visibility/DormantGemsWorkflowRibbon";
import { DormantActionStrip } from "@/components/strategic-panel";
import { ExternalMetaDriftBanner } from "@/components/sync/ExternalMetaDriftBanner";
import { DataTruthScopeBanner } from "@/components/data-truth/DataTruthScopeBanner";
import { ProductScopeToggle } from "@/components/shared/ProductScopeToggle";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
import { PageLoading } from "@/components/shared/PageLoading";
import { PageQueryError } from "@/components/shared/PageQueryError";

type Workbench = ReturnType<typeof useFbAdsWorkbench>;

export function FbAdsPageView(w: Workbench) {
  const [execLogOpen, setExecLogOpen] = useState(false);
  const { filter, setParetoListMode } = useWorkbenchFilter();
  const metaGate = useMetaExecutionGate();
  const {
    scope,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    detailCreative,
    setDetailCreative,
    refreshStatusData,
    refreshMutation,
    isRefreshing,
    directorSummary,
    directorLoading,
    overview,
    overviewLoading,
    creatives,
    creativesLoading,
    goalPacingByProduct,
    actionCenterData,
    dashboardDataStatus,
    productViewMode,
    setProductViewMode,
    paretoPayload,
    fbMainLoading,
    fbMainError,
    refetchFbMain,
  } = w;

  const noBatchData =
    dashboardDataStatus === "no_sync" ||
    dashboardDataStatus === "synced_no_data" ||
    (!actionCenterData?.sourceMeta?.batchId &&
      (actionCenterData?.productLevel?.length ?? 0) === 0 &&
      (actionCenterData?.creativeLeaderboard?.length ?? 0) === 0);

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <h1 className="page-title" data-testid="text-page-title">
              預算控制
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <ProductScopeToggle mode={productViewMode} onModeChange={setProductViewMode} />
            <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExecLogOpen(true)}
              data-testid="button-exec-log-fb"
            >
              <ListChecks className="w-4 h-4 mr-1.5" />
              執行紀錄
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="link-fbads-to-execution-audit">
              <Link href="/execution-history">
                <ClipboardList className="w-4 h-4 mr-1.5" />
                全域稽核
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={isRefreshing}
              data-testid="button-refresh-fb"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              {isRefreshing ? (refreshStatusData?.currentStep || "更新中...") : "更新資料"}
            </Button>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋素材..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 pb-4 space-y-2">
          <AccountManagerPanel
            selectedAccountIds={scope.selectedAccountIds}
            onSelectionChange={scope.setSelectedAccounts}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">清單視角</Label>
              <div
                className="inline-flex rounded-lg bg-muted/50 p-1 gap-1"
                data-testid="select-fbads-pareto-list-mode"
              >
                <Button
                  type="button"
                  variant={filter.paretoListMode === "needs_attention" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-md text-xs h-8 px-3"
                  onClick={() => setParetoListMode("needs_attention")}
                >
                  需處理
                </Button>
                <Button
                  type="button"
                  variant={filter.paretoListMode === "pareto_marked" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-md text-xs h-8 px-3"
                  onClick={() => setParetoListMode("pareto_marked")}
                >
                  重點 Top 20%
                </Button>
                <Button
                  type="button"
                  variant={filter.paretoListMode === "all" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-md text-xs h-8 px-3"
                  onClick={() => setParetoListMode("all")}
                >
                  全部
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ExternalMetaDriftBanner surface="fb-ads" />

      {fbMainLoading ? (
        <PageLoading />
      ) : fbMainError ? (
        <div className="px-4 md:px-6 py-4 page-container-fluid">
          <PageQueryError
            message={fbMainError instanceof Error ? fbMainError.message : "載入失敗"}
            onRetry={refetchFbMain}
          />
        </div>
      ) : noBatchData ? (
        <div className="px-4 md:px-6 py-8 page-container-fluid">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                尚無廣告／商品資料。請先到設定頁連結 Meta 帳戶並同步資料。
              </p>
              <Button variant="default" size="sm" asChild>
                <Link href="/settings">前往設定</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
      <div className="px-4 pt-2">
        <DataTruthScopeBanner dataStatus={dashboardDataStatus} />
      </div>

      <FbAdsGoalPacingBanner goalPacingByProduct={goalPacingByProduct} />

      <div className="px-4 md:px-6 pt-2 space-y-6" data-testid="fb-dormant-operational-v7">
        <div data-testid="fbads-dormant-primary-workflow-v3" className="space-y-2">
          <DormantActionStrip data-testid="fbads-dormant-primary-strip-v6">
            <DormantGemsWorkflowRibbon
              surface="fb-ads"
              candidates={(actionCenterData?.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
            />
            <DormantGemsSurfaceSection
              surface="fb-ads"
              candidates={(actionCenterData?.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
            />
          </DormantActionStrip>
        </div>
        <VisibilityPolicyStrip
          surface="fb-ads"
          dormantGemCandidates={actionCenterData?.dormantGemCandidates ?? []}
          noDeliveryCount={actionCenterData?.budgetActionNoDelivery?.length ?? 0}
          underSampleCount={actionCenterData?.budgetActionUnderSample?.length ?? 0}
          visibilityPolicyVersion={actionCenterData?.visibilityPolicyVersion}
        />
      </div>

      <main className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <OperationalSummarySection data={overview} isLoading={overviewLoading} />

        {!directorLoading && !directorSummary && (
          <Card className="border-dashed border-primary/30 bg-primary/5 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">預算控制 — 使用步驟</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground mb-4">
                <li>
                  在<strong className="text-foreground">設定中心</strong>綁定 FB Access Token（離開欄位會自動儲存），並點「立即同步帳號」。
                </li>
                <li>
                  在上方選擇要分析的廣告帳號後，點<strong className="text-foreground">「更新資料」</strong>取得廣告與素材數據。
                </li>
                <li>若仍無資料，請至設定中心檢查 FB 連線與權限。</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings">前往設定中心</a>
              </Button>
            </CardContent>
          </Card>
        )}
        <DirectorSummarySection data={directorSummary} isLoading={directorLoading} />

        <HighRiskAccountsSection />

        <OpportunityBoardSection />

        <StopLossSection />

        <CreativeOpportunityBoard creatives={creatives} isLoading={creativesLoading} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="creatives" data-testid="tab-creatives">
              素材排行
            </TabsTrigger>
            <TabsTrigger value="structure" data-testid="tab-structure">
              結構分析
            </TabsTrigger>
            <TabsTrigger value="budget" data-testid="tab-budget">
              預算建議
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              警示與機會
            </TabsTrigger>
          </TabsList>
          <div
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground py-1"
            data-testid="fbads-dormant-tab-hints-v3"
          >
            <span data-testid="fbads-dormant-hint-creatives">素材排行：沉睡復活價值與今日決策中心採相同排序邏輯。</span>
            <span data-testid="fbads-dormant-hint-structure">結構分析：先對齊 ribbon Top3，再下鑽帳戶結構。</span>
            <span data-testid="fbads-dormant-hint-budget">預算建議：高潛 dormant 與 budget 風險分開判讀。</span>
            <span data-testid="fbads-dormant-hint-alerts">警示：與沉睡捷徑並讀，不停留在單一 tab。</span>
          </div>

          <TabsContent value="creatives">
            <div className="space-y-6">
              <CreativeTable
                creatives={creatives}
                isLoading={creativesLoading}
                onViewDetail={(c) => setDetailCreative(c)}
                dormantGemCandidates={(actionCenterData?.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
                pareto={paretoPayload?.pareto}
                productLevelNames={(actionCenterData?.productLevel ?? [])
                  .map((p) => p.productName)
                  .filter(Boolean) as string[]}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BuriedGemsSection isLoading={creativesLoading} />
                <StopListSection isLoading={creativesLoading} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="structure">
            <CampaignStructureTab
              onRequestPause={metaGate.requestPause}
              onRequestResume={metaGate.requestResume}
              execBusy={metaGate.execBusy}
            />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetRecommendationsTab
              onRequestBudgetUpdate={metaGate.requestBudgetUpdate}
              execBusy={metaGate.execBusy}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </main>
        </>
      )}

      <CreativeDetailDialog
        creative={detailCreative}
        open={detailCreative !== null}
        onClose={() => setDetailCreative(null)}
      />

      <ExecutionLogDialog open={execLogOpen} onOpenChange={setExecLogOpen} />

      <ExecutionGateDialog
        open={metaGate.execGateOpen}
        onOpenChange={metaGate.onExecGateOpenChange}
        gate={metaGate.execGate}
        onConfirm={metaGate.confirmMetaExecution}
        confirming={metaGate.execGateConfirming}
        error={metaGate.execConfirmError}
        title="Meta 操作確認"
        intro="請確認以下預覽步驟無誤後勾選並核准，系統將透過 execution layer 寫入 Meta。"
        checkboxLabel="我已知悉並同意執行上述 Meta 操作"
      />
    </div>
  );
}
