import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const viewPath = path.join(root, "client/src/pages/ga4/Ga4PageView.tsx");
const lines = fs.readFileSync(viewPath, "utf-8").split("\n");

const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const upper = slice(129, 276);
const asset = slice(278, 505);
const tabs = slice(507, 916);
const dialog = slice(919, 1022);

const header = slice(79, 127);

const upperFile = `import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Eye, ShoppingCart, CreditCard, TrendingUp, BarChart3, Clock, Percent,
} from "lucide-react";
import type { GA4FunnelOverview, GA4AIDirectorSummary } from "@shared/schema";
import type { HighRiskItem } from "@shared/schema";
import { formatNumber, formatPercent } from "../ga4-formatters";
import { ChangeIndicator, HighRiskSection } from "./shared";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4UpperSections({
  directorLoading,
  directorSummary,
  highRiskItems,
  highRiskLoading,
  funnelLoading,
  funnelOverview,
}: Pick<
  Ga4Workbench,
  | "directorLoading"
  | "directorSummary"
  | "highRiskItems"
  | "highRiskLoading"
  | "funnelLoading"
  | "funnelOverview"
>) {
${upper}
}
`;

const assetFile = `import {
  ArrowLeft, ChevronRight, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type { GA4PageMetricsDetailed } from "@shared/schema";
import { pageGroupLabels, assetViewConfig, priorityColors, type AssetView } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import {
  RiskLevelBadge, TriScoreDisplay, PageRecommendationCard, ChangeIndicator,
} from "./shared";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4AssetDimensionCard(w: Pick<
  Ga4Workbench,
  | "assetView"
  | "handleAssetViewChange"
  | "drillDownPage"
  | "setDrillDownPage"
  | "selectedPageGroupKey"
  | "setSelectedPageGroupKey"
  | "currentAssetGroups"
  | "pagesDetailedLoading"
  | "assetGroupFilteredPages"
  | "pageRecommendationMap"
  | "assetGroupPageCounts"
>) {
  const {
    assetView, handleAssetViewChange, drillDownPage, setDrillDownPage,
    selectedPageGroupKey, setSelectedPageGroupKey, currentAssetGroups,
    pagesDetailedLoading, assetGroupFilteredPages, pageRecommendationMap, assetGroupPageCounts,
  } = w;
${asset}
}
`;

const tabsFile = `import { Fragment } from "react";
import {
  ArrowDown, ArrowRight, ChevronDown, ChevronRight, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SeverityBadge, severityStyles } from "@/components/shared/severity-badge";
import { V2ScoreMini, V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type { PageGroup, GA4PageMetricsDetailed } from "@shared/schema";
import { pageGroupLabels } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import {
  RiskLevelBadge, TriScoreDisplay, PageRecommendationCard, ChangeIndicator,
} from "./shared";
import type { DetailedSortKey } from "../ga4-types";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4MainTabs(w: Ga4Workbench) {
  const {
    activeTab, setActiveTab, segmentsLoading, funnelSegments, funnelDrillDown,
    expandedSegments, toggleSegment, pageGroupFilter, setPageGroupFilter,
    filteredDetailedPages, pagesDetailedLoading, pageRecommendationMap,
    expandedDetailedRows, toggleDetailedRow, pagesDetailedData,
    compareSelectedPaths, toggleComparePath, comparePageData,
    detailedSortKey, detailedSortDir, toggleDetailedSort,
  } = w;

  const DetailedSortableHead = ({ label, sortKeyName }: { label: string; sortKeyName: DetailedSortKey }) => (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer text-xs"
        onClick={() => toggleDetailedSort(sortKeyName)}
        data-testid={\`button-sort-detailed-\${sortKeyName}\`}
      >
        {label}
        {detailedSortKey === sortKeyName ? (
          detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 rotate-180" />
        ) : (
          <span className="inline-flex"><ArrowDown className="w-3 h-3 opacity-40 rotate-180" /><ArrowDown className="w-3 h-3 opacity-40 -ml-1" /></span>
        )}
      </button>
    </TableHead>
  );

${tabs}
}
`;

// Fix DetailedSortableHead - use ArrowUp - need import ArrowUp
const tabsFileFixed = tabsFile
  .replace(
    `detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 rotate-180" />
        ) : (
          <span className="inline-flex"><ArrowDown className="w-3 h-3 opacity-40 rotate-180" /><ArrowDown className="w-3 h-3 opacity-40 -ml-1" /></span>`,
    `detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 rotate-180" />
        ) : (
          <ArrowDown className="w-3 h-3 opacity-40" />`
  );
// Still wrong - original used ArrowUp and ArrowUpDown. Add ArrowUp, ArrowUpDown to import
const tabsFile2 = tabsFile.replace(
  "ArrowDown, ArrowRight, ChevronDown, ChevronRight, Star",
  "ArrowUp, ArrowDown, ArrowUpDown, ArrowRight, ChevronDown, ChevronRight, Star"
).replace(
  `detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowDown className="w-3 h-3 rotate-180" />
        ) : (
          <ArrowDown className="w-3 h-3 opacity-40" />`,
  `detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />`
);

const dialogFile = `import { Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScorePill, OpportunityScoreBadge, OpportunityBreakdownDisplay } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import { aiLabelColors, recommendationPageLabels, recommendationPageColors } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4PageDetailDialog(w: Pick<
  Ga4Workbench,
  "selectedDetail" | "setSelectedDetail" | "rankingForPage"
>) {
  const { selectedDetail, setSelectedDetail, rankingForPage } = w;
${dialog}
}
`;

const wdir = path.join(root, "client/src/pages/ga4/widgets");
fs.writeFileSync(path.join(wdir, "Ga4UpperSections.tsx"), upperFile);
fs.writeFileSync(path.join(wdir, "Ga4AssetDimensionCard.tsx"), assetFile);
fs.writeFileSync(path.join(wdir, "Ga4MainTabs.tsx"), tabsFile2);
fs.writeFileSync(path.join(wdir, "Ga4PageDetailDialog.tsx"), dialogFile);

const newView = `import { Search, RefreshCw, Loader2 } from "lucide-react";
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

      <div className="min-h-full p-4 md:p-6 space-y-4 page-container-fluid">
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
`;

fs.writeFileSync(viewPath, newView);
console.log("split ga4 view done");
