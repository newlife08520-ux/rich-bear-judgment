import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import type {
  GA4PageMetrics,
  GA4PageMetricsDetailed,
  RefreshStatus,
  PageRecommendation,
} from "@shared/schema";
import { useGa4WorkbenchDataQueries } from "./useGa4WorkbenchDataQueries";
import type { AssetView, DetailedSortKey, SortKey, SortDir } from "./ga4-types";
import { assetViewPageGroups } from "./ga4-types";
import { formatNumber, formatPercent } from "./ga4-formatters";

export function useGa4Workbench() {
  const scope = useAppScope();
  const scopeQ = scope.scopeKey ? `scope=${encodeURIComponent(scope.scopeKey)}` : "";
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("funnel");
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<GA4PageMetrics | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [detailedSortKey, setDetailedSortKey] = useState<DetailedSortKey>("sessions");
  const [detailedSortDir, setDetailedSortDir] = useState<SortDir>("desc");
  const [pageGroupFilter, setPageGroupFilter] = useState<string>("all");
  const [compareSelectedPaths, setCompareSelectedPaths] = useState<Set<string>>(new Set());
  const [assetView, setAssetView] = useState<AssetView>("official_site");
  const [selectedPageGroupKey, setSelectedPageGroupKey] = useState<string | null>(null);
  const [drillDownPage, setDrillDownPage] = useState<GA4PageMetricsDetailed | null>(null);
  const { toast } = useToast();

  const { data: refreshStatusData } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
    refetchInterval: (query) => {
      const data = query.state.data as RefreshStatus | undefined;
      return data?.isRefreshing ? 2000 : false;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const body = scope.buildRefreshBody();
      const res = await apiRequest("POST", "/api/refresh", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refresh/status"] });
    },
    onError: (err: any) => {
      toast({ title: "資料更新失敗", description: err.message || "請稍後再試", variant: "destructive" });
    },
  });

  const isRefreshing = refreshMutation.isPending || refreshStatusData?.isRefreshing;

  const wasRefreshingRef = useRef(false);
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
        ["/api/ga4/product-funnel-stitch"],
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
  }, [refreshStatusData?.isRefreshing, refreshStatusData?.currentStep, toast]);

  const {
    directorSummary,
    directorLoading,
    funnelOverview,
    funnelLoading,
    pages,
    pagesLoading,
    funnelSegments,
    segmentsLoading,
    funnelDrillDown,
    priorityFixes,
    fixesLoading,
    dropPoints,
    dropsLoading,
    pageRanking,
    highRiskItems,
    highRiskLoading,
    pagesDetailedData,
    pagesDetailedLoading,
    productFunnelStitch,
    productFunnelStitchLoading,
  } = useGa4WorkbenchDataQueries(scope.scopeKey, scopeQ, search, scope.selectedAccountIds ?? []);

  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const toggleSegment = (idx: number) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const sortedPages = useMemo(() => {
    if (!pages) return [];
    const sorted = [...pages].sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [pages, sortKey, sortDir]);

  const pageRecommendationMap = useMemo(() => {
    const map = new Map<string, PageRecommendation>();
    if (pagesDetailedData?.pageRecommendations) {
      for (const { pagePath, recommendation } of pagesDetailedData.pageRecommendations) {
        map.set(pagePath, recommendation);
      }
    }
    return map;
  }, [pagesDetailedData?.pageRecommendations]);

  const [expandedDetailedRows, setExpandedDetailedRows] = useState<Set<string>>(new Set());

  const toggleDetailedRow = (path: string) => {
    setExpandedDetailedRows((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filteredDetailedPages = useMemo(() => {
    if (!pagesDetailedData?.pages) return [];
    let result = pagesDetailedData.pages;
    if (pageGroupFilter !== "all") {
      result = result.filter((p) => p.pageGroup === pageGroupFilter);
    }
    const sorted = [...result].sort((a, b) => {
      const aVal = a[detailedSortKey] as number;
      const bVal = b[detailedSortKey] as number;
      return detailedSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [pagesDetailedData?.pages, pageGroupFilter, detailedSortKey, detailedSortDir]);

  const currentAssetGroups = assetViewPageGroups[assetView];

  const assetGroupPageCounts = useMemo(() => {
    if (!pagesDetailedData?.pages) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const group of currentAssetGroups) {
      const count = pagesDetailedData.pages.filter((p) =>
        group.matchGroups.includes(p.pageGroup)
      ).length;
      counts.set(group.key, count);
    }
    return counts;
  }, [pagesDetailedData?.pages, currentAssetGroups]);

  const assetGroupFilteredPages = useMemo(() => {
    if (!pagesDetailedData?.pages || !selectedPageGroupKey) return [];
    const group = currentAssetGroups.find((g) => g.key === selectedPageGroupKey);
    if (!group) return [];
    let result = pagesDetailedData.pages.filter((p) =>
      group.matchGroups.includes(p.pageGroup)
    );
    if (assetView === "full_site" && selectedPageGroupKey === "anomaly") {
      result = result.filter(
        (p) => p.bounceRate > 70 || p.riskLevel === "danger" || p.riskLevel === "warning" ||
          (p.conversionRatePrev > 0 && p.conversionRate < p.conversionRatePrev * 0.6)
      );
    }
    return [...result].sort((a, b) => b.sessions - a.sessions);
  }, [pagesDetailedData?.pages, selectedPageGroupKey, currentAssetGroups, assetView]);

  const handleAssetViewChange = (view: AssetView) => {
    setAssetView(view);
    setSelectedPageGroupKey(null);
    setDrillDownPage(null);
  };

  const toggleDetailedSort = (key: DetailedSortKey) => {
    if (detailedSortKey === key) {
      setDetailedSortDir(detailedSortDir === "desc" ? "asc" : "desc");
    } else {
      setDetailedSortKey(key);
      setDetailedSortDir("desc");
    }
  };

  const toggleComparePath = (path: string) => {
    setCompareSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else if (next.size < 4) {
        next.add(path);
      }
      return next;
    });
  };

  const comparePageData = useMemo(() => {
    if (!pagesDetailedData?.pages) return [];
    return pagesDetailedData.pages.filter((p) => compareSelectedPaths.has(p.pagePath));
  }, [pagesDetailedData?.pages, compareSelectedPaths]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = (id: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedPageData = useMemo(() => {
    if (!pages) return [];
    return pages.filter((p) => selectedPages.has(p.id));
  }, [pages, selectedPages]);

  const comparisonMetrics: { key: keyof GA4PageMetrics; label: string; format: (v: number) => string; inverse?: boolean }[] = [
    { key: "sessions", label: "工作階段", format: formatNumber },
    { key: "avgDuration", label: "平均停留 (秒)", format: (v) => `${v}` },
    { key: "bounceRate", label: "跳出率", format: formatPercent, inverse: true },
    { key: "engagementRate", label: "參與率", format: formatPercent },
    { key: "productViewRate", label: "商品瀏覽率", format: formatPercent },
    { key: "addToCartRate", label: "加購率", format: formatPercent },
    { key: "checkoutRate", label: "結帳率", format: formatPercent },
    { key: "purchaseRate", label: "購買率", format: formatPercent },
    { key: "overallConversionRate", label: "整體導購率", format: formatPercent },
    { key: "judgmentScore", label: "判決分數", format: (v) => `${v}` },
    { key: "opportunityScore", label: "機會分數", format: (v) => `${v}` },
  ];

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
    productFunnelStitch,
    productFunnelStitchLoading,
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
