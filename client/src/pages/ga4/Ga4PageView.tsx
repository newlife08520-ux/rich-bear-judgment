import { Search, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import { AccountSelector } from "@/components/shared/account-selector";
import type { Ga4Workbench } from "./useGa4Workbench";
import { PageSkeleton } from "./widgets/shared";
import { Ga4UpperSections } from "./widgets/Ga4UpperSections";
import { Ga4AssetDimensionCard } from "./widgets/Ga4AssetDimensionCard";
import { Ga4MainTabs } from "./widgets/Ga4MainTabs";
import { Ga4PageDetailDialog } from "./widgets/Ga4PageDetailDialog";

export function Ga4PageView(w: Ga4Workbench) {
  const {
    scope, search, setSearch, refreshMutation, isRefreshing, refreshStatusData,
  } = w;

  if (w.initialSkeleton) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            漏斗 / 站內證據
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AccountSelector
            platform="ga4"
            value={scope.selectedPropertyIds[0] || ""}
            onChange={(id: string) => scope.setSelectedProperties(id && id !== "all" ? [id] : [])}
            placeholder="選擇 GA4 資產"
            showAllOption
            allOptionLabel="全部資產"
            data-testid="select-property"
          />
          <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={isRefreshing}
            data-testid="button-refresh-ga4"
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
              placeholder="搜尋頁面..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search"
            />
          </div>
        </div>
      </header>

      <div className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <Ga4UpperSections
          directorLoading={w.directorLoading}
          directorSummary={w.directorSummary}
          highRiskItems={w.highRiskItems}
          highRiskLoading={w.highRiskLoading}
          funnelLoading={w.funnelLoading}
          funnelOverview={w.funnelOverview}
        />
        <Ga4AssetDimensionCard {...w} />
        <Ga4MainTabs {...w} />
      </div>
      <Ga4PageDetailDialog
        selectedDetail={w.selectedDetail}
        setSelectedDetail={w.setSelectedDetail}
        rankingForPage={w.rankingForPage}
      />
    </div>
  );
}
