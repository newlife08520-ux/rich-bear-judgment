import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getCreativeKeyFromUrl } from "./getCreativeKeyFromUrl";
import type { LifecycleApiData, LifecycleCardItem } from "./lifecycle-types";

export function useCreativeLifecycleWorkbench() {
  const [location] = useLocation();
  const creativeKeyFromUrl = getCreativeKeyFromUrl(location);
  const [stageFilter, setStageFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const highlightCardRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<LifecycleApiData>({
    queryKey: ["/api/dashboard/creative-lifecycle", stageFilter, labelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stageFilter) params.set("stage", stageFilter);
      if (labelFilter) params.set("label", labelFilter);
      const qs = params.toString();
      const url = qs ? `/api/dashboard/creative-lifecycle?${qs}` : "/api/dashboard/creative-lifecycle";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { items: [], success: [], underfunded: [], retired: [], inspirationPool: [], stages: [] };
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const success = data?.success ?? [];
  const underfunded = data?.underfunded ?? [];
  const retired = data?.retired ?? [];
  const inspirationPool = data?.inspirationPool ?? [];
  const firstDecisionMin = data?.firstDecisionSpendMin ?? 750;
  const firstDecisionMax = data?.firstDecisionSpendMax ?? 1000;

  const displayItems: LifecycleCardItem[] =
    creativeKeyFromUrl && items.length > 0
      ? items.filter(
          (i) =>
            i.id === creativeKeyFromUrl ||
            i.name.toLowerCase().includes(creativeKeyFromUrl!.toLowerCase())
        )
      : items;
  const hasCreativeKeyFilter = !!creativeKeyFromUrl && items.length > 0;
  const highlightId = hasCreativeKeyFilter && displayItems.length > 0 ? displayItems[0].id : null;

  useEffect(() => {
    if (!highlightId || !highlightCardRef.current) return;
    highlightCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, displayItems.length]);

  const { data: suggestionsData } = useQuery<{
    suggestions: Array<{ type: string; productName?: string; campaignName: string; suggestion: string; action: string; reason: string }>;
  }>({
    queryKey: ["/api/dashboard/replacement-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/replacement-suggestions", { credentials: "include" });
      if (!res.ok) return { suggestions: [] };
      return res.json();
    },
  });
  const suggestions = suggestionsData?.suggestions ?? [];

  const createTasksMutation = useMutation({
    mutationFn: async () => {
      const batchItems = suggestions.slice(0, 20).map((s) => ({
        title: `${s.productName || "素材"}：${s.suggestion}`,
        action: s.action,
        reason: s.reason,
        productName: s.productName,
      }));
      const res = await fetch("/api/workbench/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: batchItems }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立失敗");
      return res.json();
    },
    onSuccess: (d: { count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({ title: `已建立 ${d.count} 筆任務`, duration: 2000 });
    },
    onError: () => toast({ title: "建立任務失敗", variant: "destructive" }),
  });

  const luckyCount = items.filter((i) => i.label === "Lucky").length;
  const createLuckyTasksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dashboard/lucky-tasks/batch", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("建立失敗");
      return res.json();
    },
    onSuccess: (d: { count: number; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({
        title: `已建立 ${d.count} 筆 Lucky 補量任務；${d.message ?? "完成後於下次資料刷新時會自動重新分類"}`,
        duration: 4000,
      });
    },
    onError: () => toast({ title: "建立 Lucky 任務失敗", variant: "destructive" }),
  });

  const invalidateLifecycle = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/creative-lifecycle"] });

  return {
    stageFilter,
    setStageFilter,
    labelFilter,
    setLabelFilter,
    highlightCardRef,
    isLoading,
    items,
    displayItems,
    hasCreativeKeyFilter,
    creativeKeyFromUrl,
    highlightId,
    success,
    underfunded,
    retired,
    inspirationPool,
    firstDecisionMin,
    firstDecisionMax,
    suggestions,
    createTasksMutation,
    luckyCount,
    createLuckyTasksMutation,
    invalidateLifecycle,
  };
}

export type CreativeLifecycleWorkbench = ReturnType<typeof useCreativeLifecycleWorkbench>;
