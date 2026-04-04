import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ParetoResult } from "@shared/pareto-engine";
import { useLocation } from "wouter";
import { deriveProductRow, applySavedViewToProducts, type SavedViewId } from "@/lib/decision-workbench";
import { useWorkbenchFilter, type SortKey } from "@/lib/workbench-filter-context";
import { useEmployee } from "@/lib/employee-context";
import { useAppScope } from "@/hooks/use-app-scope";
import { useProductViewScope } from "@/hooks/use-product-view-scope";
import { useToast } from "@/hooks/use-toast";
import { getProductNameFromUrl } from "./products-formatters";
import type { ProductBattleRow } from "./products-types";
import type { GoalPacingEvaluation } from "@shared/goal-pacing-engine";
import type { ActionCenterData } from "@/pages/dashboard/dashboard-types";

export function useProductsWorkbench() {
  const [location] = useLocation();
  const productNameFromUrl = getProductNameFromUrl(location);
  const scope = useAppScope();
  const { employee, employees, scopeAccountIds, scopeProducts } = useEmployee();
  const { filter, setProductFilter } = useWorkbenchFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createTaskRow, setCreateTaskRow] = useState<ProductBattleRow | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAction, setTaskAction] = useState("");
  const [taskReason, setTaskReason] = useState("");

  const { mode: productViewMode, setMode: setProductViewMode, scopeProductsForApi } = useProductViewScope();
  const effectiveScopeProducts =
    scopeProductsForApi ??
    (employee.assignedProducts?.length ? employee.assignedProducts : undefined);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (scope.scopeKey) p.set("scope", scope.scopeKey);
    if (effectiveScopeProducts?.length) p.set("scopeProducts", effectiveScopeProducts.join(","));
    if (employee.assignedAccounts?.length) p.set("scopeAccountIds", employee.assignedAccounts.join(","));
    return p;
  }, [scope.scopeKey, effectiveScopeProducts, employee.assignedAccounts]);

  const { data: ownerMap = {} } = useQuery({
    queryKey: ["/api/workbench/owners"],
    queryFn: async () => {
      const res = await fetch("/api/workbench/owners", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const patchOwner = useMutation({
    mutationFn: async ({ productName, patch }: { productName: string; patch: Record<string, string> }) => {
      const res = await fetch(`/api/workbench/owners/${encodeURIComponent(productName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) throw new Error("更新失敗");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workbench/owners"] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (body: { title: string; action: string; reason: string; productName?: string }) => {
      const res = await fetch("/api/workbench/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立失敗");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      setCreateTaskRow(null);
      toast({ title: "已建立任務", duration: 2000 });
    },
  });

  const confidenceParamsStr = params.toString();

  const { data: goalPacingResp } = useQuery<{
    goalPacingByProduct: Record<string, GoalPacingEvaluation>;
  }>({
    queryKey: ["/api/workbench/goal-pacing", scope.scopeKey ?? "", confidenceParamsStr],
    queryFn: async () => {
      const q = confidenceParamsStr;
      const url = q ? `/api/workbench/goal-pacing?${q}` : "/api/workbench/goal-pacing";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { goalPacingByProduct: {} };
      return res.json();
    },
  });
  const goalPacingByProduct = goalPacingResp?.goalPacingByProduct ?? {};

  const {
    data: actionData,
    isLoading: actionCenterLoading,
    isError: actionCenterIsError,
    error: actionCenterError,
    refetch: refetchActionCenter,
  } = useQuery<ActionCenterData>({
    queryKey: ["/api/dashboard/action-center", scope.scopeKey ?? "", confidenceParamsStr],
    queryFn: async () => {
      const q = confidenceParamsStr;
      const res = await fetch(q ? `/api/dashboard/action-center?${q}` : "/api/dashboard/action-center", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? "請重新登入" : `無法載入決策資料（${res.status}）`);
      }
      return res.json();
    },
  });

  const { data: paretoPayload } = useQuery<{ pareto?: ParetoResult } | null>({
    queryKey: ["/api/pareto/by-product", scope.scopeKey ?? "", confidenceParamsStr],
    queryFn: async () => {
      const q = confidenceParamsStr;
      const url = q ? `/api/pareto/by-product?${q}` : "/api/pareto/by-product";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const paretoMarkedIdSet = useMemo(() => {
    const p = paretoPayload?.pareto;
    if (!p) return null;
    return new Set([
      ...p.top20PctIds,
      ...p.bottom20PctIds,
      ...p.hiddenDiamondCandidates,
      ...p.dragCandidates,
    ]);
  }, [paretoPayload]);

  const paretoFlagsByProduct = useMemo(() => {
    const p = paretoPayload?.pareto;
    const m = new Map<string, { top20: boolean; hiddenDiamond: boolean; moneyPit: boolean }>();
    if (!p) return m;
    const top = new Set(p.top20PctIds);
    const hd = new Set(p.hiddenDiamondCandidates);
    const mp = new Set([...p.bottom20PctIds, ...p.dragCandidates]);
    for (const id of new Set([...top, ...hd, ...mp])) {
      m.set(id, { top20: top.has(id), hiddenDiamond: hd.has(id), moneyPit: mp.has(id) });
    }
    return m;
  }, [paretoPayload]);

  const getParetoFlagsForProduct = useCallback(
    (productName: string) => paretoFlagsByProduct.get(productName),
    [paretoFlagsByProduct]
  );

  const {
    data: crossAccountPayload,
    isLoading: crossAccountLoading,
    isError: crossAccountIsError,
    error: crossAccountError,
    refetch: refetchCrossAccount,
  } = useQuery<{
    dataStatus?: string;
  }>({
    queryKey: ["/api/dashboard/cross-account-summary", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey
        ? `/api/dashboard/cross-account-summary?scope=${encodeURIComponent(scope.scopeKey)}`
        : "/api/dashboard/cross-account-summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(res.status === 401 ? "請重新登入" : `無法載入摘要（${res.status}）`);
      }
      return res.json();
    },
  });

  const productsMainLoading = crossAccountLoading || actionCenterLoading;
  const productsMainError = crossAccountIsError ? crossAccountError : actionCenterIsError ? actionCenterError : null;
  const refetchProductsMain = () => {
    void refetchCrossAccount();
    void refetchActionCenter();
  };

  const { data: confidenceData } = useQuery<{
    products: Array<{
      productName: string;
      unmappedSpend: number;
      conflictCount: number;
      overrideHitRate: number;
      data_confidence: "high" | "medium" | "low";
    }>;
    batchUnmappedSpend: number;
  }>({
    queryKey: ["/api/dashboard/data-confidence", scope.scopeKey ?? "", confidenceParamsStr],
    queryFn: async () => {
      const q = confidenceParamsStr;
      const url = q ? `/api/dashboard/data-confidence?${q}` : "/api/dashboard/data-confidence";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { products: [], batchUnmappedSpend: 0 };
      return res.json();
    },
  });

  const productLevel = actionData?.productLevel ?? [];
  const productLevelMain = actionData?.productLevelMain ?? productLevel;
  const productLevelNoDelivery = actionData?.productLevelNoDelivery ?? [];
  const productLevelUnmapped = actionData?.productLevelUnmapped ?? [];
  const unmappedCount = actionData?.unmappedCount ?? 0;
  const creativeLeaderboard = actionData?.creativeLeaderboard ?? [];
  const failureRatesByTag = actionData?.failureRatesByTag ?? {};
  const tableRescue = actionData?.tableRescue ?? [];
  const tableScaleUp = actionData?.tableScaleUp ?? [];
  const dormantGemCandidates = actionData?.dormantGemCandidates ?? [];

  const dormantCountByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of dormantGemCandidates) {
      const n = c.productName ?? "";
      if (!n) continue;
      m.set(n, (m.get(n) ?? 0) + 1);
    }
    return m;
  }, [dormantGemCandidates]);

  /** 同商品多筆沉睡候選時取最高 revivalPriorityScore，供主表排序與次排序 */
  const dormantScoreByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of dormantGemCandidates) {
      const n = c.productName ?? "";
      if (!n) continue;
      const sc = typeof c.revivalPriorityScore === "number" ? c.revivalPriorityScore : 0;
      m.set(n, Math.max(m.get(n) ?? 0, sc));
    }
    return m;
  }, [dormantGemCandidates]);

  useEffect(() => {
    if (!productNameFromUrl || productLevelMain.length === 0) return;
    const exists = productLevelMain.some((p: { productName?: string }) => p.productName === productNameFromUrl);
    if (exists && (filter.productIds.length !== 1 || filter.productIds[0] !== productNameFromUrl)) {
      setProductFilter([productNameFromUrl]);
    }
  }, [productNameFromUrl, productLevelMain, setProductFilter, filter.productIds.length]);

  const confidenceByProduct = new Map((confidenceData?.products ?? []).map((p) => [p.productName, p]));

  const rows: ProductBattleRow[] = useMemo(() => {
    const battle = productLevel.filter(
      (p: { spend: number; productName?: string }) => p.spend > 0 && (p.productName ?? "") !== "未分類"
    );
    return battle.map(
      (p: {
        productName: string;
        spend: number;
        revenue: number;
        roas: number;
        impressions?: number;
        clicks?: number;
        conversions?: number;
        campaignCount?: number;
        hasRule?: boolean;
        costRuleStatus?: string;
        evidenceLevel?: string;
        breakEvenRoas?: number | null;
        targetRoas?: number | null;
        profitHeadroom?: number | null;
        aiSuggestion?: string;
        ruleTags?: string[];
      }) => {
        const derived = deriveProductRow({
          productName: p.productName,
          spend: p.spend,
          revenue: p.revenue,
          roas: p.roas,
          impressions: p.impressions ?? 0,
          clicks: p.clicks ?? 0,
          conversions: p.conversions ?? 0,
          campaignCount: p.campaignCount,
        });
        const creatives = creativeLeaderboard.filter(
          (c: { productName: string }) => c.productName === p.productName
        );
        const winnerCount = creatives.filter((c: { roas: number }) => c.roas >= 2).length;
        const fatigueCount = creatives.filter(
          (c: { materialStrategy?: string }) => (failureRatesByTag[c.materialStrategy ?? ""] ?? 0) > 0.8
        ).length;
        const conf = confidenceByProduct.get(p.productName);
        const hasRule = p.hasRule;
        return {
          ...p,
          ...derived,
          creativeCount: creatives.length,
          winnerCount,
          fatigueCount,
          data_confidence: conf?.data_confidence ?? "high",
          unmappedSpend: conf?.unmappedSpend ?? 0,
          conflictCount: conf?.conflictCount ?? 0,
          overrideHitRate: conf?.overrideHitRate ?? 0,
          hasRule,
          costRuleStatus: p.costRuleStatus ?? (hasRule ? "已設定" : "待補成本規則"),
          creatives,
          breakEvenRoas: p.breakEvenRoas ?? null,
          targetRoas: p.targetRoas ?? null,
          profitHeadroom: p.profitHeadroom ?? null,
        } as ProductBattleRow;
      }
    );
  }, [productLevel, creativeLeaderboard, failureRatesByTag, confidenceData]);

  const filtered = useMemo(() => {
    let f = rows.filter((r) => r.spend >= (filter.minSpend || 0));
    if (filter.paretoListMode === "needs_attention") {
      f = f.filter((r) => r.productStatus !== "watch");
    }
    if (filter.paretoListMode === "pareto_marked" && paretoMarkedIdSet && paretoMarkedIdSet.size > 0) {
      f = f.filter((r) => paretoMarkedIdSet.has(r.productName));
    }
    if (filter.statusFilter.length > 0) {
      f = f.filter((r) => filter.statusFilter.includes(r.productStatus));
    }
    if (filter.productIds.length > 0) {
      f = f.filter((r) => filter.productIds.includes(r.productName));
    }
    if (filter.ownerIds.length > 0) {
      f = f.filter((r) => {
        const o = ownerMap[r.productName] as { productOwnerId?: string; mediaOwnerId?: string; creativeOwnerId?: string } | undefined;
        if (!o) return false;
        return [o.productOwnerId, o.mediaOwnerId, o.creativeOwnerId].some(
          (id) => id != null && filter.ownerIds.includes(id)
        );
      });
    }
    if (filter.savedViewId) {
      f = applySavedViewToProducts(filter.savedViewId as SavedViewId, f);
    }
    const sortKey = filter.sortBy as SortKey;
    const desc = filter.sortDesc;
    return [...f].sort((a, b) => {
      /** 主指標並列時，仍讓高 revival 分數／多沉睡筆數的商品靠前（與 dormant 營運一致） */
      const dormantTieBreak = () => {
        const sa = dormantScoreByProduct.get(a.productName) ?? 0;
        const sb = dormantScoreByProduct.get(b.productName) ?? 0;
        if (sa !== sb) return sb - sa;
        const ca = dormantCountByProduct.get(a.productName) ?? 0;
        const cb = dormantCountByProduct.get(b.productName) ?? 0;
        if (ca !== cb) return cb - ca;
        return a.productName.localeCompare(b.productName, "zh-Hant");
      };

      if (sortKey === "dormant_priority" || sortKey === "revival_priority") {
        const sa = dormantScoreByProduct.get(a.productName) ?? 0;
        const sb = dormantScoreByProduct.get(b.productName) ?? 0;
        if (sa !== sb) return desc ? sb - sa : sa - sb;
        const da = dormantCountByProduct.get(a.productName) ?? 0;
        const db = dormantCountByProduct.get(b.productName) ?? 0;
        if (da !== db) return desc ? db - da : da - db;
        return desc ? b.spend - a.spend : a.spend - b.spend;
      }
      let va: number = 0;
      let vb = 0;
      if (sortKey === "spend") {
        va = a.spend;
        vb = b.spend;
      } else if (sortKey === "revenue") {
        va = a.revenue;
        vb = b.revenue;
      } else if (sortKey === "roas") {
        va = a.roas;
        vb = b.roas;
      } else if (sortKey === "ctr") {
        va = a.ctr;
        vb = b.ctr;
      } else if (sortKey === "cvr") {
        va = a.cvr;
        vb = b.cvr;
      } else {
        va = a.spend;
        vb = b.spend;
      }
      const primary = desc ? vb - va : va - vb;
      if (primary !== 0) return primary;
      return dormantTieBreak();
    });
  }, [rows, filter, ownerMap, dormantCountByProduct, dormantScoreByProduct]);

  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const openCreateTask = (r: ProductBattleRow) => {
    setCreateTaskRow(r);
    setTaskTitle(`${r.productName}：${r.aiSuggestion ?? ""}`);
    setTaskAction(r.aiSuggestion ?? "");
    setTaskReason((r.ruleTags ?? []).join("、") || "規則引擎建議");
  };

  const submitCreateTask = () => {
    if (!taskTitle.trim() || !taskAction.trim() || !taskReason.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle.trim(),
      action: taskAction.trim(),
      reason: taskReason.trim(),
      productName: createTaskRow?.productName,
    });
  };

  return {
    actionData,
    productViewMode,
    setProductViewMode,
    dashboardDataStatus: crossAccountPayload?.dataStatus,
    goalPacingByProduct,
    scopeAccountIds,
    scopeProducts,
    employees,
    productLevelMain,
    filtered,
    totalSpend,
    totalRevenue,
    avgRoas,
    productLevelNoDelivery,
    productLevelUnmapped,
    unmappedCount,
    failureRatesByTag,
    tableRescue,
    tableScaleUp,
    dormantGemCandidates,
    createTaskRow,
    setCreateTaskRow,
    taskTitle,
    setTaskTitle,
    taskAction,
    setTaskAction,
    taskReason,
    setTaskReason,
    createTaskMutation,
    openCreateTask,
    submitCreateTask,
    patchOwner,
    updateOwner: (productName: string, field: "productOwnerId" | "mediaOwnerId" | "creativeOwnerId" | "taskStatus", value: string) => {
      patchOwner.mutate({ productName, patch: { [field]: value } });
    },
    getParetoFlagsForProduct,
    productsMainLoading,
    productsMainError,
    refetchProductsMain,
  };
}

export type ProductsWorkbench = ReturnType<typeof useProductsWorkbench>;
