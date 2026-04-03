import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportMetaApiError } from "@/context/meta-api-error-context";
import { mapMetaOrNetworkErrorToActionability } from "@/lib/meta-error-actionability";
import { useAppScope } from "@/hooks/use-app-scope";
import type { RefreshStatus } from "@shared/schema";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import type { FbAdCreative, FbAccountOverview, FbAIDirectorSummary } from "@shared/schema";
import type { ActionCenterData } from "@/pages/dashboard/dashboard-types";

export function useFbAdsWorkbench() {
  const scope = useAppScope();
  const scopeQ = scope.scopeKey ? `scope=${encodeURIComponent(scope.scopeKey)}` : "";
  const goalPacingParams = useMemo(() => {
    const p = new URLSearchParams();
    if (scope.scopeKey) p.set("scope", scope.scopeKey);
    if (scope.selectedAccountIds?.length) p.set("scopeAccountIds", scope.selectedAccountIds.join(","));
    return p.toString();
  }, [scope.scopeKey, scope.selectedAccountIds]);

  const actionCenterParams = goalPacingParams;
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("creatives");
  const [detailCreative, setDetailCreative] = useState<FbAdCreative | null>(null);
  const { toast } = useToast();
  const reportMetaApiError = useReportMetaApiError();

  const { data: refreshStatusData } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
    refetchInterval: (query) => {
      const data = query.state.data as RefreshStatus | undefined;
      return data?.isRefreshing ? 2000 : false;
    },
  });

  const syncSelectedToBackend = useMutation({
    mutationFn: async (accountIds: string[]) => {
      const res = await apiRequest("POST", "/api/accounts/sync-selected", { platform: "meta", accountIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/synced"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (scope.selectedAccountIds.length > 0) {
        await syncSelectedToBackend.mutateAsync(scope.selectedAccountIds);
      }
      const body = scope.buildRefreshBody();
      const res = await apiRequest("POST", "/api/refresh", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refresh/status"] });
    },
    onError: (err: { message?: string }) => {
      const msg = err.message || "請稍後再試";
      reportMetaApiError(mapMetaOrNetworkErrorToActionability({ message: msg }));
      toast({ title: "資料更新失敗", description: msg, variant: "destructive" });
    },
  });

  const isRefreshing = refreshMutation.isPending || syncSelectedToBackend.isPending || refreshStatusData?.isRefreshing;

  const wasRefreshingRef = useRef(false);
  const scopeKeyForInvalidate = scope.scopeKey ?? "";
  useEffect(() => {
    if (wasRefreshingRef.current && !refreshStatusData?.isRefreshing) {
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/overview", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/creatives", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/director-summary", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/buried-gems", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/stop-list", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/campaign-structure", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/budget-recommendations", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/alerts", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/high-risk", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/meta-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/opportunities", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/campaigns-scored", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/goal-pacing", scopeKeyForInvalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/action-center", scopeKeyForInvalidate] });
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "Meta 廣告數據已重新分析" });
      }
    }
    wasRefreshingRef.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing, scopeKeyForInvalidate, refreshStatusData?.currentStep, toast]);

  const { data: directorSummary, isLoading: directorLoading } = useQuery<FbAIDirectorSummary>({
    queryKey: ["/api/fb-ads/director-summary", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/fb-ads/director-summary?${scopeQ}` : "/api/fb-ads/director-summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<FbAccountOverview>({
    queryKey: ["/api/fb-ads/overview", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scopeQ ? `/api/fb-ads/overview?${scopeQ}` : "/api/fb-ads/overview";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: goalPacingResp } = useQuery<{ goalPacingByProduct: Record<string, GoalPacingEvaluation> }>({
    queryKey: ["/api/workbench/goal-pacing", scope.scopeKey ?? "", goalPacingParams],
    queryFn: async () => {
      const url = goalPacingParams
        ? `/api/workbench/goal-pacing?${goalPacingParams}`
        : "/api/workbench/goal-pacing";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { goalPacingByProduct: {} };
      return res.json();
    },
  });

  const { data: creatives, isLoading: creativesLoading } = useQuery<FbAdCreative[]>({
    queryKey: ["/api/fb-ads/creatives", scope.scopeKey ?? "", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scope.scopeKey) params.set("scope", scope.scopeKey);
      if (search) params.set("search", search);
      const res = await fetch(`/api/fb-ads/creatives?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch creatives");
      return res.json();
    },
  });

  const { data: actionCenterData } = useQuery<ActionCenterData>({
    queryKey: ["/api/dashboard/action-center", scope.scopeKey ?? "", actionCenterParams],
    queryFn: async () => {
      const url = actionCenterParams
        ? `/api/dashboard/action-center?${actionCenterParams}`
        : "/api/dashboard/action-center";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        return {
          productLevel: [],
          creativeLeaderboard: [],
          hiddenGems: [],
          urgentStop: [],
          riskyCampaigns: [],
          failureRatesByTag: {},
        } satisfies ActionCenterData;
      }
      return res.json();
    },
  });

  return {
    actionCenterData,
    goalPacingByProduct: goalPacingResp?.goalPacingByProduct ?? {},
    scope,
    scopeQ,
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
  };
}
