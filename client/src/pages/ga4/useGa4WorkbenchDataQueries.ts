import { useQuery } from "@tanstack/react-query";
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
  PageRecommendation,
} from "@shared/schema";

export function useGa4WorkbenchDataQueries(
  scopeKey: string | undefined,
  scopeQ: string,
  search: string
) {
  const { data: directorSummary, isLoading: directorLoading } = useQuery<GA4AIDirectorSummary>({
    queryKey: ["/api/ga4/director-summary", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/director-summary?${scopeQ}` : "/api/ga4/director-summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: funnelOverview, isLoading: funnelLoading } = useQuery<GA4FunnelOverview>({
    queryKey: ["/api/ga4/funnel-overview", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/funnel-overview?${scopeQ}` : "/api/ga4/funnel-overview";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: pages, isLoading: pagesLoading } = useQuery<GA4PageMetrics[]>({
    queryKey: ["/api/ga4/pages", scopeKey ?? "", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scopeKey) params.set("scope", scopeKey);
      if (search) params.set("search", search);
      const res = await fetch(`/api/ga4/pages?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: funnelSegments, isLoading: segmentsLoading } = useQuery<GA4FunnelSegment[]>({
    queryKey: ["/api/ga4/funnel-segments", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/funnel-segments?${scopeQ}` : "/api/ga4/funnel-segments";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: funnelDrillDown } = useQuery<FunnelDrillDown[]>({
    queryKey: ["/api/ga4/funnel-drilldown", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/funnel-drilldown?${scopeQ}` : "/api/ga4/funnel-drilldown";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: priorityFixes, isLoading: fixesLoading } = useQuery<GA4PriorityFix[]>({
    queryKey: ["/api/ga4/priority-fixes", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/priority-fixes?${scopeQ}` : "/api/ga4/priority-fixes";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: dropPoints, isLoading: dropsLoading } = useQuery<GA4DropPoint[]>({
    queryKey: ["/api/ga4/drop-points", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/drop-points?${scopeQ}` : "/api/ga4/drop-points";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: pageRanking } = useQuery<GA4PageRanking[]>({
    queryKey: ["/api/ga4/page-ranking", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/page-ranking?${scopeQ}` : "/api/ga4/page-ranking";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: highRiskItems, isLoading: highRiskLoading } = useQuery<HighRiskItem[]>({
    queryKey: ["/api/dashboard/high-risk", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/dashboard/high-risk?${scopeQ}` : "/api/dashboard/high-risk";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: pagesDetailedData, isLoading: pagesDetailedLoading } = useQuery<{
    pages: GA4PageMetricsDetailed[];
    pageGroups: {
      group: string;
      count: number;
      totalSessions: number;
      totalRevenue: number;
      avgConversionRate: number;
      avgBounceRate: number;
    }[];
    pageRecommendations: { pagePath: string; recommendation: PageRecommendation }[];
  }>({
    queryKey: ["/api/ga4/pages-detailed", scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/ga4/pages-detailed?${scopeQ}` : "/api/ga4/pages-detailed";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return {
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
  };
}
