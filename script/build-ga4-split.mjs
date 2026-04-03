import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "client/src/pages/ga4-analysis.tsx");
const t = fs.readFileSync(srcPath, "utf-8");
const lines = t.split("\n");

const hookStart = lines.findIndex((l) => l.includes("export default function GA4AnalysisPage()"));
const hookBodyStart = hookStart + 1; // after opening brace
const skeletonIdx = lines.findIndex((l, i) => i > hookStart && l.includes("if (directorLoading && funnelLoading && pagesLoading)"));

const beforeReturn = lines.slice(hookBodyStart, skeletonIdx).join("\n");

const invalidateOld = `  const wasRefreshingRef = useRef(false);
  useEffect(() => {
    if (wasRefreshingRef.current && !refreshStatusData?.isRefreshing) {
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/director-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-segments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/drop-points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/page-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/priority-fixes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/pages-detailed"] });
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "GA4 數據已重新分析" });
      }
    }
    wasRefreshingRef.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing]);`;

const invalidateNew = `  const wasRefreshingRef = useRef(false);
  useEffect(() => {
    if (wasRefreshingRef.current && !refreshStatusData?.isRefreshing) {
      const keys = [
        ["/api/ga4/director-summary"],
        ["/api/ga4/funnel-overview"],
        ["/api/ga4/pages"],
        ["/api/ga4/funnel-segments"],
        ["/api/ga4/funnel-drilldown"],
        ["/api/ga4/drop-points"],
        ["/api/ga4/page-ranking"],
        ["/api/ga4/priority-fixes"],
        ["/api/ga4/pages-detailed"],
        ["/api/dashboard/high-risk"],
      ] as const;
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [...key] });
      }
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "GA4 數據已重新分析" });
      }
    }
    wasRefreshingRef.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing, refreshStatusData?.currentStep, toast]);`;

if (!beforeReturn.includes("queryClient.invalidateQueries({ queryKey: [\"/api/ga4/director-summary\"] })")) {
  console.error("Pattern mismatch");
  process.exit(1);
}

let hookCore = beforeReturn.replace(invalidateOld, invalidateNew);

// Remove SortableHead / DetailedSortableHead block (keep rankingForPage out - we'll add at end)
const sortBlock = /  const DetailedSortableHead = \{[\s\S]*?  const rankingForPage = \(path: string\) => pageRanking\?\.find\(\(r\) => r\.path === path\);\n\n/;
hookCore = hookCore.replace(sortBlock, "\n");

const hookFile = `import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import type {
  GA4PageMetrics,
  GA4PageMetricsDetailed,
  GA4FunnelOverview,
  GA4FunnelSegment,
  FunnelDrillDown,
  GA4DropPoint,
  GA4PageRanking,
  GA4AIDirectorSummary,
  GA4PriorityFix,
  HighRiskItem,
  RefreshStatus,
  PageRecommendation,
} from "@shared/schema";
import type { AssetView, DetailedSortKey, SortKey, SortDir } from "./ga4-types";
import { assetViewPageGroups } from "./ga4-types";
import { formatNumber, formatPercent } from "./ga4-formatters";

export function useGa4Workbench() {
${hookCore}
  const rankingForPage = (path: string) => pageRanking?.find((r) => r.path === path);

  return {
    scope,
    scopeQ,
    search,
    setSearch,
    activeTab,
    setActiveTab,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    expandedRows,
    setExpandedRows,
    selectedDetail,
    setSelectedDetail,
    selectedPages,
    setSelectedPages,
    detailedSortKey,
    setDetailedSortKey,
    detailedSortDir,
    setDetailedSortDir,
    pageGroupFilter,
    setPageGroupFilter,
    compareSelectedPaths,
    setCompareSelectedPaths,
    assetView,
    setAssetView,
    selectedPageGroupKey,
    setSelectedPageGroupKey,
    drillDownPage,
    setDrillDownPage,
    refreshStatusData,
    refreshMutation,
    isRefreshing,
    directorSummary,
    directorLoading,
    funnelOverview,
    funnelLoading,
    pages,
    pagesLoading,
    funnelSegments,
    segmentsLoading,
    funnelDrillDown,
    expandedSegments,
    toggleSegment,
    priorityFixes,
    fixesLoading,
    dropPoints,
    dropsLoading,
    pageRanking,
    highRiskItems,
    highRiskLoading,
    pagesDetailedData,
    pagesDetailedLoading,
    sortedPages,
    pageRecommendationMap,
    expandedDetailedRows,
    toggleDetailedRow,
    filteredDetailedPages,
    currentAssetGroups,
    assetGroupPageCounts,
    assetGroupFilteredPages,
    handleAssetViewChange,
    toggleDetailedSort,
    toggleComparePath,
    comparePageData,
    toggleSort,
    toggleRow,
    togglePageSelection,
    selectedPageData,
    comparisonMetrics,
    rankingForPage,
    initialSkeleton: directorLoading && funnelLoading && pagesLoading,
  };
}

export type Ga4Workbench = ReturnType<typeof useGa4Workbench>;
`;

const ga4Dir = path.join(root, "client/src/pages/ga4");
fs.mkdirSync(path.join(ga4Dir, "widgets"), { recursive: true });
fs.writeFileSync(path.join(ga4Dir, "useGa4Workbench.ts"), hookFile);
console.log("Wrote useGa4Workbench.ts");

// Ga4PageView: lines skeletonIdx to end-2 (before closing brace of component)
const viewStart = skeletonIdx;
const viewEnd = lines.length - 2; // before final });
const viewLines = lines.slice(viewStart, viewEnd);
// Replace first line if (directorLoading...) with initialSkeleton
viewLines[0] = "  if (w.initialSkeleton) {";
viewLines[1] = "    return <PageSkeleton />;";
// viewLines[2] is "  }" - keep

const viewFile = `import { Fragment } from "react";
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight,
  ArrowRight, ArrowLeft, AlertTriangle, Lightbulb, Eye, Activity, Users,
  Clock, Percent, ShoppingCart, CreditCard, TrendingUp, BarChart3, Star,
  RefreshCw, Loader2, Globe, FileText, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreBadge, ScorePill, OpportunityScoreBadge, OpportunityBreakdownDisplay } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import { AccountSelector } from "@/components/shared/account-selector";
import { V2ScoreMini, V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import type { PageGroup, GA4PageMetricsDetailed } from "@shared/schema";
import {
  aiLabelColors, recommendationPageLabels, recommendationPageColors,
  pageGroupLabels, assetViewConfig, priorityColors,
} from "./ga4-types";
import { formatNumber, formatPercent } from "./ga4-formatters";
import {
  RiskLevelBadge, TriScoreDisplay, PageRecommendationCard, ChangeIndicator, PageSkeleton,
} from "./widgets/shared";
import type { Ga4Workbench } from "./useGa4Workbench";

export function Ga4PageView(w: Ga4Workbench) {
  const {
    scope, search, setSearch, activeTab, setActiveTab,
    directorLoading, directorSummary, highRiskItems, highRiskLoading,
    funnelLoading, funnelOverview, assetView, handleAssetViewChange,
    drillDownPage, setDrillDownPage, selectedPageGroupKey, setSelectedPageGroupKey,
    currentAssetGroups, pagesDetailedLoading, assetGroupFilteredPages, pageRecommendationMap,
    assetGroupPageCounts, funnelSegments, segmentsLoading, funnelDrillDown,
    expandedSegments, toggleSegment, pageGroupFilter, setPageGroupFilter,
    filteredDetailedPages, expandedDetailedRows, toggleDetailedRow, pagesDetailedData,
    compareSelectedPaths, toggleComparePath, comparePageData, selectedDetail, setSelectedDetail,
    rankingForPage, refreshMutation, isRefreshing, refreshStatusData,
    detailedSortKey, detailedSortDir, toggleDetailedSort,
  } = w;

  const DetailedSortableHead = ({ label, sortKeyName }: { label: string; sortKeyName: import("./ga4-types").DetailedSortKey }) => (
    <TableHead>
      <button
        className="flex items-center gap-1 cursor-pointer text-xs"
        onClick={() => toggleDetailedSort(sortKeyName)}
        data-testid={\`button-sort-detailed-\${sortKeyName}\`}
      >
        {label}
        {detailedSortKey === sortKeyName ? (
          detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

${viewLines.join("\n")}
`;

fs.writeFileSync(path.join(ga4Dir, "Ga4PageView.tsx"), viewFile);
console.log("Wrote Ga4PageView.tsx");
