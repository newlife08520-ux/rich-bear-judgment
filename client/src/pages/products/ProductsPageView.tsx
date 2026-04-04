import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/filter-bar";
import { AccountExceptionsBlock } from "@/components/account-exceptions-block";
import type { ProductsWorkbench } from "./useProductsWorkbench";
import { ProductsHeader } from "./widgets/ProductsHeader";
import { ProductsOverviewBoard } from "./widgets/ProductsOverviewBoard";
import { ProductsBattleCard } from "./widgets/ProductsBattleCard";
import { ProductsNoDeliveryPanel } from "./widgets/ProductsNoDeliveryPanel";
import { ProductCreateTaskDialog } from "./widgets/ProductCreateTaskDialog";
import { ProductsOwnersTable } from "./widgets/ProductsOwnersTable";
import { ParetoCommandLayerStrip } from "@/components/pareto/ParetoCommandLayerStrip";
import { VisibilityPolicyStrip } from "@/components/visibility/VisibilityPolicyStrip";
import { DormantGemsSurfaceSection } from "@/components/visibility/DormantGemsSurfaceSection";
import { DormantGemsWorkflowRibbon } from "@/components/visibility/DormantGemsWorkflowRibbon";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
import { DormantActionStrip } from "@/components/strategic-panel";
import { ExternalMetaDriftBanner } from "@/components/sync/ExternalMetaDriftBanner";
import { DataTruthScopeBanner } from "@/components/data-truth/DataTruthScopeBanner";
import { ProductScopeToggle } from "@/components/shared/ProductScopeToggle";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { PageQueryError } from "@/components/shared/PageQueryError";

export function ProductsPageView({ wb }: { wb: ProductsWorkbench }) {
  const noBatchData =
    wb.dashboardDataStatus === "no_sync" ||
    wb.dashboardDataStatus === "synced_no_data" ||
    (!wb.actionData?.sourceMeta?.batchId &&
      (wb.productLevelMain?.length ?? 0) === 0 &&
      (wb.actionData?.creativeLeaderboard?.length ?? 0) === 0);

  return (
    <div className="flex flex-col min-h-full">
      <ProductsHeader
        trailing={
          <ProductScopeToggle mode={wb.productViewMode} onModeChange={wb.setProductViewMode} />
        }
      />
      <ExternalMetaDriftBanner surface="products" />
      <div className="px-4 pt-2 space-y-2">
        <DataTruthScopeBanner dataStatus={wb.dashboardDataStatus} />
      </div>
      <div className="px-4 pt-1">
        <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
          <Link href="/execution-history" data-testid="link-products-to-execution-audit">
            <ClipboardList className="w-3 h-3 mr-1" />
            全域執行稽核
          </Link>
        </Button>
      </div>
      {wb.productsMainLoading ? (
        <PageLoading />
      ) : wb.productsMainError ? (
        <div className="px-4 md:p-6 page-container-fluid">
          <PageQueryError
            message={wb.productsMainError instanceof Error ? wb.productsMainError.message : "載入失敗"}
            onRetry={wb.refetchProductsMain}
          />
        </div>
      ) : noBatchData ? (
        <div className="px-4 md:p-6 py-8 page-container-fluid">
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
      <div className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <AccountExceptionsBlock scopeAccountIds={wb.scopeAccountIds} scopeProducts={wb.scopeProducts} compact />
        <div data-testid="products-command-primary-v6" className="space-y-3">
          <DormantActionStrip data-testid="products-dormant-primary-strip-v6">
            <DormantGemsWorkflowRibbon
              surface="products"
              candidates={(wb.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
            />
            <DormantGemsSurfaceSection
              surface="products"
              candidates={(wb.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
            />
          </DormantActionStrip>
        </div>
        <div data-testid="products-dormant-primary-workflow-v3" className="space-y-6">
          <div data-testid="products-dormant-operationalization-v6" className="space-y-6">
            <div data-testid="products-dormant-operationalization-v4" className="space-y-6">
            <FilterBar
              productOptions={wb.productLevelMain.map((p: { productName: string }) => p.productName)}
              ownerOptions={wb.employees.map((e) => ({ id: e.id, name: e.name }))}
              showSavedViews
              showStatusFilter
              showMinSpend
              showSort
            />
          </div>
          </div>
        </div>
        <ProductsOwnersTable />
        <ProductsOverviewBoard
          count={wb.filtered.length}
          totalSpend={wb.totalSpend}
          totalRevenue={wb.totalRevenue}
          avgRoas={wb.avgRoas}
        />
        <ParetoCommandLayerStrip />
        <VisibilityPolicyStrip
          surface="products"
          dormantGemCandidates={(wb.dormantGemCandidates ?? []) as DormantGemCandidateItem[]}
          noDeliveryCount={wb.productLevelNoDelivery?.length ?? 0}
          underSampleCount={wb.actionData?.budgetActionUnderSample?.length ?? 0}
          visibilityPolicyVersion={wb.actionData?.visibilityPolicyVersion}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wb.filtered.map((r) => {
            const gems = (wb.dormantGemCandidates ?? []).filter((c) => c.productName === r.productName);
            const topGem = gems.sort((a, b) => (b.revivalPriorityScore ?? 0) - (a.revivalPriorityScore ?? 0))[0];
            return (
            <ProductsBattleCard
              key={r.productName}
              r={r}
              failureRatesByTag={wb.failureRatesByTag}
              tableRescue={wb.tableRescue}
              tableScaleUp={wb.tableScaleUp}
              onCreateTask={wb.openCreateTask}
              goalPacing={wb.goalPacingByProduct[r.productName]}
              dormantGemCount={gems.length}
              dormantRevivalHint={topGem?.reviveRecommendation}
              paretoFlags={wb.getParetoFlagsForProduct(r.productName)}
            />
            );
          })}
        </div>
        {wb.filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">無符合條件的商品，請放寬篩選或更新資料。</CardContent>
          </Card>
        )}
        <ProductsNoDeliveryPanel
          unmappedCount={wb.unmappedCount}
          productLevelNoDelivery={wb.productLevelNoDelivery}
          productLevelUnmapped={wb.productLevelUnmapped}
        />
        <ProductCreateTaskDialog
          open={!!wb.createTaskRow}
          onOpenChange={(o) => !o && wb.setCreateTaskRow(null)}
          taskTitle={wb.taskTitle}
          setTaskTitle={wb.setTaskTitle}
          taskAction={wb.taskAction}
          setTaskAction={wb.setTaskAction}
          taskReason={wb.taskReason}
          setTaskReason={wb.setTaskReason}
          onSubmit={wb.submitCreateTask}
          pending={wb.createTaskMutation.isPending}
        />
      </div>
      )}
    </div>
  );
}
