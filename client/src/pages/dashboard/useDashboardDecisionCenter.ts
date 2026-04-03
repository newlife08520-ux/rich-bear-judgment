/**
 * 首頁決策中心：統一管理 scope、action-center、summary、refresh、derived 資料。
 */
import { useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReportMetaApiError } from "@/context/meta-api-error-context";
import { mapMetaOrNetworkErrorToActionability } from "@/lib/meta-error-actionability";
import { useAppScope } from "@/hooks/use-app-scope";
import { useEmployee } from "@/lib/employee-context";
import type { ActionCenterData, ProductLevelItem, BudgetActionRow, CreativeLeaderboardItem } from "./dashboard-types";
import type { CrossAccountSummary, AccountHealthScore, Anomaly, RefreshStatus } from "@shared/schema";

const emptyActionData: ActionCenterData = {
  productLevel: [],
  creativeLeaderboard: [],
  hiddenGems: [],
  urgentStop: [],
  riskyCampaigns: [],
};

/**
 * 商品分類（client 端 derived，規則見 START_PHASE 硬規則 B）
 * 賺錢: hasRule === true && spend > 0 && targetRoas != null && roas >= targetRoas
 * 賠錢: spend > 0 && ((hasRule === true && breakEvenRoas != null && roas < breakEvenRoas) || 出現在 tableRescue)
 * 觀察: spend > 0 且不屬於賺錢/賠錢
 * 待補規則: evidenceLevel === rules_missing 或 hasRule !== true
 */
export function deriveProductOverview(
  productLevel: ProductLevelItem[],
  tableRescue: BudgetActionRow[] = [],
  tableScaleUp: BudgetActionRow[] = []
) {
  const rescueProductNames = new Set(tableRescue.map((r) => r.productName));
  const totalSpend = productLevel.reduce((s, p) => s + p.spend, 0);
  const totalRevenue = productLevel.reduce((s, p) => s + p.revenue, 0);
  const weightedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  type Bucket = "profit" | "loss" | "watch" | "rules_missing";
  const buckets: Record<Bucket, ProductLevelItem[]> = { profit: [], loss: [], watch: [], rules_missing: [] };
  const zeroSpend: ProductLevelItem[] = [];

  for (const p of productLevel) {
    if (p.spend <= 0) {
      zeroSpend.push(p);
      continue;
    }
    const hasRule = p.hasRule === true;
    const targetRoas = p.targetRoas ?? null;
    const breakEvenRoas = p.breakEvenRoas ?? null;
    const inRescue = rescueProductNames.has(p.productName);
    const evidenceMissing = p.evidenceLevel === "rules_missing" || !hasRule;

    if (evidenceMissing) {
      buckets.rules_missing.push(p);
      continue;
    }
    if (hasRule && targetRoas != null && p.roas >= targetRoas) {
      buckets.profit.push(p);
      continue;
    }
    if (p.spend > 0 && ((hasRule && breakEvenRoas != null && p.roas < breakEvenRoas) || inRescue)) {
      buckets.loss.push(p);
      continue;
    }
    buckets.watch.push(p);
  }

  // Top 加碼：優先 tableScaleUp（活動維度）；Top 危險：tableRescue
  const topScaleUp = [...(tableScaleUp ?? [])].slice(0, 5);
  const topRescue = [...(tableRescue ?? [])].sort((a, b) => b.spend - a.spend).slice(0, 5);

  return {
    totalSpend,
    totalRevenue,
    weightedRoas,
    countProfit: buckets.profit.length,
    countLoss: buckets.loss.length,
    countWatch: buckets.watch.length,
    countRulesMissing: buckets.rules_missing.length,
    countZeroSpend: zeroSpend.length,
    zeroSpendProducts: zeroSpend,
    topScaleUp,
    topRescue,
    buckets,
  };
}

/**
 * 預算雷達：加碼(tableScaleUp)、下降(tableRescue 非關閉)、停止(關閉/urgentStop)
 */
export function deriveBudgetRadar(
  tableScaleUp: BudgetActionRow[] = [],
  tableRescue: BudgetActionRow[] = [],
  urgentStop: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; message: string }> = [],
  riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }> = []
) {
  const scaleUp = tableScaleUp.slice(0, 5);
  const scaleDown = tableRescue.filter((r) => r.suggestedPct !== "關閉").slice(0, 5);
  const stop = [
    ...tableRescue.filter((r) => r.suggestedPct === "關閉"),
    ...urgentStop.map((u) => ({ campaignId: u.campaignId, campaignName: u.campaignName, productName: "", spend: u.spend, reason: u.message, suggestedAction: "關閉", suggestedPct: "關閉" as const, impactAmount: 0, sampleStatus: "", trendABC: null })),
  ].slice(0, 5);
  return { scaleUp, scaleDown, stop, riskyCampaigns: riskyCampaigns.slice(0, 5) };
}

/** 素材列最小欄位（API tierHighPotentialCreatives 等可能無 conversions/cpa） */
type CreativeRowMinimal = Pick<CreativeLeaderboardItem, "productName" | "materialStrategy" | "headlineSnippet" | "spend" | "revenue" | "roas">;

/**
 * 素材分類（client 端 derived，優先順序：疲勞 > 待換 > 勝出 > 續測）
 * 勝出: roas >= 2 || creativeEdge >= 1.2
 * 待換: roas < 1 && spend > 0
 * 疲勞: failureRatesByTag[materialStrategy] >= 0.8
 * 續測: creativeLeaderboardUnderSample 或樣本不足
 */
export function deriveCreativeStatus(
  creativeLeaderboard: CreativeLeaderboardItem[] = [],
  creativeLeaderboardUnderSample: CreativeRowMinimal[] = [],
  failureRatesByTag: Record<string, number> = {},
  tierHighPotentialCreatives: CreativeRowMinimal[] = []
) {
  const underSampleSet = new Set(
    creativeLeaderboardUnderSample.map((c) => `${c.productName}|${c.materialStrategy}|${c.headlineSnippet}`)
  );
  const fatigueRateThreshold = 0.8;

  type Bucket = "replace" | "fatigue" | "win" | "retest";
  const replace: CreativeLeaderboardItem[] = [];
  const fatigue: CreativeLeaderboardItem[] = [];
  const win: CreativeLeaderboardItem[] = [];
  const retest: CreativeLeaderboardItem[] = [];

  for (const c of creativeLeaderboard) {
    if (c.spend <= 0) continue;
    const key = `${c.productName}|${c.materialStrategy}|${c.headlineSnippet}`;
    const isUnderSample = underSampleSet.has(key);
    const failRate = failureRatesByTag[c.materialStrategy] ?? 0;
    const isFatigue = failRate >= fatigueRateThreshold;
    const isReplace = c.roas < 1 && c.spend > 0;
    const isWin = (c.roas >= 2 || (c.creativeEdge ?? 0) >= 1.2);

    if (isFatigue) fatigue.push(c);
    else if (isReplace) replace.push(c);
    else if (isWin) win.push(c);
    else if (isUnderSample) retest.push(c);
    else retest.push(c);
  }

  return {
    countReplace: replace.length,
    countFatigue: fatigue.length,
    countWin: win.length,
    countRetest: retest.length,
    sampleReplace: replace.slice(0, 3),
    sampleFatigue: fatigue.slice(0, 3),
    sampleWin: win.slice(0, 3),
    sampleRetest: retest.slice(0, 3),
    tierHighPotential: tierHighPotentialCreatives?.slice(0, 5) ?? [],
  };
}

export function useDashboardDecisionCenter() {
  const scope = useAppScope();
  const { toast } = useToast();
  const reportMetaApiError = useReportMetaApiError();
  const { employee } = useEmployee();
  const autoRefreshed = useRef(false);

  const actionCenterParams = new URLSearchParams();
  if (scope.scopeKey) actionCenterParams.set("scope", scope.scopeKey);
  if (employee.assignedProducts?.length) actionCenterParams.set("scopeProducts", employee.assignedProducts.join(","));
  if (employee.assignedAccounts?.length) actionCenterParams.set("scopeAccountIds", employee.assignedAccounts.join(","));
  const actionCenterQueryKey = ["/api/dashboard/action-center", scope.scopeKey ?? "", actionCenterParams.toString()];

  const { data: actionData = emptyActionData } = useQuery<ActionCenterData>({
    queryKey: actionCenterQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/action-center?${actionCenterParams.toString()}`, { credentials: "include" });
      if (!res.ok) return emptyActionData;
      return res.json();
    },
  });

  const scopeQuerySuffix = scope.scopeKey ?? "";
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    hasSummary: boolean;
    summary?: CrossAccountSummary;
    dataStatus?: "no_sync" | "synced_no_data" | "has_data" | "partial_data";
    homepageDataTruth?: "summary_ok" | "partial_decision" | "no_decision";
    hasDecisionSignals?: boolean;
    message?: string;
    coverageNote?: string | null;
    batchValidity?: "valid" | "legacy" | "insufficient";
    batchValidityReason?: string;
  }>({
    queryKey: ["/api/dashboard/cross-account-summary", scopeQuerySuffix],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/dashboard/cross-account-summary?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/dashboard/cross-account-summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { hasSummary: false };
      return res.json();
    },
  });

  const { data: rankingData, isLoading: rankingLoading } = useQuery<{ accounts: AccountHealthScore[] }>({
    queryKey: ["/api/dashboard/account-ranking", scopeQuerySuffix],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/dashboard/account-ranking?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/dashboard/account-ranking";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
  });

  const { data: anomalyData, isLoading: anomalyLoading } = useQuery<{ anomalies: Anomaly[] }>({
    queryKey: ["/api/dashboard/anomaly-summary", scopeQuerySuffix],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/dashboard/anomaly-summary?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/dashboard/anomaly-summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { anomalies: [] };
      return res.json();
    },
  });

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
    onError: (err: unknown) => {
      toast({ title: "資料更新失敗", description: (err as { message?: string })?.message || "請稍後再試", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (opts?: { runRefreshAfterSync?: boolean }) => {
      const res = await apiRequest("POST", "/api/accounts/sync", {});
      return res.json();
    },
    onSuccess: (_data: unknown, variables?: { runRefreshAfterSync?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/synced"] });
      const data = _data as { syncedAccounts?: unknown[] };
      const count = data.syncedAccounts?.length ?? 0;
      toast({ title: "帳號同步完成", description: `已同步 ${count} 個帳號` });
      if (variables?.runRefreshAfterSync) refreshMutation.mutate();
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || "帳號同步失敗";
      reportMetaApiError(mapMetaOrNetworkErrorToActionability({ message: msg }));
      toast({ title: "帳號同步失敗", description: msg, variant: "destructive" });
    },
  });

  const summary = summaryData?.summary;
  const accounts = rankingData?.accounts ?? [];
  const anomalies = anomalyData?.anomalies ?? [];
  const isRefreshing = refreshMutation.isPending || (refreshStatusData?.isRefreshing ?? false);

  const derived = {
    todayActions: actionData.todayActions ?? [],
    productOverview: deriveProductOverview(
      actionData.productLevel ?? [],
      actionData.tableRescue ?? [],
      actionData.tableScaleUp ?? []
    ),
    budgetRadar: deriveBudgetRadar(
      actionData.tableScaleUp ?? [],
      actionData.tableRescue ?? [],
      actionData.urgentStop ?? [],
      actionData.riskyCampaigns ?? []
    ),
    creativeStatus: deriveCreativeStatus(
      actionData.creativeLeaderboard ?? [],
      actionData.creativeLeaderboardUnderSample ?? [],
      actionData.failureRatesByTag ?? {},
      actionData.tierHighPotentialCreatives ?? []
    ),
    dataHealth: {
      lastRefreshedAt: refreshStatusData?.lastRefreshedAt ?? null,
      batchValidity: actionData.batchValidity ?? summaryData?.batchValidity,
      batchValidityReason: actionData.batchValidityReason ?? summaryData?.batchValidityReason,
      sourceMeta: actionData.sourceMeta,
      scopeMismatch: actionData.sourceMeta?.scopeKey != null && scope.scopeKey !== actionData.sourceMeta.scopeKey,
      noDeliveryCount: actionData.budgetActionNoDelivery?.length ?? 0,
      underSampleCount: actionData.budgetActionUnderSample?.length ?? 0,
      unmappedCount: actionData.unmappedCount ?? actionData.sourceMeta?.unmappedCount ?? 0,
      funnelEvidence: actionData.funnelEvidence,
      dormantGemCount: actionData.dormantGemCandidates?.length ?? 0,
      homepagePartial:
        summaryData?.dataStatus === "partial_data" || summaryData?.homepageDataTruth === "partial_decision",
      homepageCoverageNote: summaryData?.coverageNote ?? null,
    },
  };

  return {
    scope,
    isRefreshing,
    refreshStatusData,
    summary,
    summaryData,
    summaryLoading,
    actionData,
    accounts,
    rankingLoading,
    anomalies,
    anomalyLoading,
    derived,
    refreshMutation,
    syncMutation,
    hasSummary: summaryData?.hasSummary,
    homepageDataTruth: summaryData?.homepageDataTruth,
    hasDecisionSignals: summaryData?.hasDecisionSignals,
    summaryMessage: summaryData?.message,
    coverageNote: summaryData?.coverageNote ?? null,
    dataStatus: summaryData?.dataStatus,
  };
}
