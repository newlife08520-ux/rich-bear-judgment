/**
 * 商品作戰室（P1）：主列表單位＝商品，Filter Bar + Saved Views + 狀態/規則/owner（API 持久化）
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/filter-bar";
import {
  deriveProductRow,
  applySavedViewToProducts,
  PRODUCT_STATUS,
  type SavedViewId,
} from "@/lib/decision-workbench";
import { useWorkbenchFilter, type SortKey } from "@/lib/workbench-filter-context";
import { useEmployee } from "@/lib/employee-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, ListPlus, ChevronRight, Target, TrendingUp, TrendingDown, Zap, Shield, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AccountExceptionsBlock } from "@/components/account-exceptions-block";
import { useLocation, Link } from "wouter";

function formatCurrency(value: number) {
  return `NT$ ${value.toLocaleString()}`;
}

const EVIDENCE_LABELS: Record<string, string> = {
  ads_only: "廣告層推測",
  ga_verified: "已有 GA 證據",
  rules_missing: "規則缺失",
  insufficient_sample: "樣本不足",
  no_delivery: "尚未投遞",
};

type ProductRow = ReturnType<typeof deriveProductRow> & {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  creativeCount: number;
  winnerCount: number;
  fatigueCount: number;
};

/** 從 location 解析 ?productName= */
function getProductNameFromUrl(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("productName")?.trim() || null;
}

export default function ProductsPage() {
  const [location] = useLocation();
  const productNameFromUrl = getProductNameFromUrl(location);
  const { employee, employees, scopeAccountIds, scopeProducts } = useEmployee();
  const { filter, setProductFilter } = useWorkbenchFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createTaskRow, setCreateTaskRow] = useState<ProductRow | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAction, setTaskAction] = useState("");
  const [taskReason, setTaskReason] = useState("");

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/owners"] });
    },
  });

  const updateOwner = (productName: string, field: "productOwnerId" | "mediaOwnerId" | "creativeOwnerId" | "taskStatus", value: string) => {
    patchOwner.mutate({ productName, patch: { [field]: value } });
  };

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

  const openCreateTask = (r: { productName: string; aiSuggestion: string; ruleTags: string[] }) => {
    setCreateTaskRow(r as ProductRow);
    setTaskTitle(`${r.productName}：${r.aiSuggestion}`);
    setTaskAction(r.aiSuggestion);
    setTaskReason(r.ruleTags.join("、") || "規則引擎建議");
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

  const params = new URLSearchParams();
  if (employee.assignedProducts?.length) params.set("scopeProducts", employee.assignedProducts.join(","));
  if (employee.assignedAccounts?.length) params.set("scopeAccountIds", employee.assignedAccounts.join(","));

  const { data: actionData } = useQuery({
    queryKey: ["/api/dashboard/action-center", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/action-center?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return { productLevel: [], creativeLeaderboard: [], failureRatesByTag: {} };
      return res.json();
    },
  });

  const productLevel = actionData?.productLevel ?? [];
  /** 核心排行用：僅花費>0 且非未分類；無則退回 productLevel */
  const productLevelMain = actionData?.productLevelMain ?? productLevel;
  const productLevelNoDelivery = actionData?.productLevelNoDelivery ?? [];
  const productLevelUnmapped = actionData?.productLevelUnmapped ?? [];
  const unmappedCount = actionData?.unmappedCount ?? 0;
  const creativeLeaderboard = actionData?.creativeLeaderboard ?? [];
  const failureRatesByTag = actionData?.failureRatesByTag ?? {};
  const tableRescue = actionData?.tableRescue ?? [];
  const tableScaleUp = actionData?.tableScaleUp ?? [];
  const tierHighPotentialCreatives = actionData?.tierHighPotentialCreatives ?? [];

  useEffect(() => {
    if (!productNameFromUrl || productLevelMain.length === 0) return;
    const exists = productLevelMain.some((p: { productName?: string }) => p.productName === productNameFromUrl);
    if (exists && (filter.productIds.length !== 1 || filter.productIds[0] !== productNameFromUrl)) {
      setProductFilter([productNameFromUrl]);
    }
  }, [productNameFromUrl, productLevelMain, setProductFilter]);

  const { data: confidenceData } = useQuery<{ products: Array<{ productName: string; unmappedSpend: number; conflictCount: number; overrideHitRate: number; data_confidence: "high" | "medium" | "low" }>; batchUnmappedSpend: number }>({
    queryKey: ["/api/dashboard/data-confidence"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/data-confidence", { credentials: "include" });
      if (!res.ok) return { products: [], batchUnmappedSpend: 0 };
      return res.json();
    },
  });
  const confidenceByProduct = new Map((confidenceData?.products ?? []).map((p) => [p.productName, p]));
  const batchUnmappedSpend = confidenceData?.batchUnmappedSpend ?? 0;

  /** Phase 3 商品主戰場：以有花費且非未分類之商品為單位，含 breakEven/target/headroom */
  const productLevelBattle = productLevel.filter(
    (p: { spend: number; productName?: string }) => p.spend > 0 && (p.productName ?? "") !== "未分類"
  );
  const rows = productLevelBattle.map((p: {
    productName: string; spend: number; revenue: number; roas: number; impressions?: number; clicks?: number; conversions?: number; campaignCount?: number;
    hasRule?: boolean; costRuleStatus?: string; evidenceLevel?: string; breakEvenRoas?: number | null; targetRoas?: number | null; profitHeadroom?: number | null;
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
    const creatives = creativeLeaderboard.filter((c) => c.productName === p.productName);
    const winnerCount = creatives.filter((c) => c.roas >= 2).length;
    const fatigueCount = creatives.filter((c) => (failureRatesByTag[(c as { materialStrategy?: string }).materialStrategy] ?? 0) > 0.8).length;
    const conf = confidenceByProduct.get(p.productName);
    const hasRule = p.hasRule;
    const costRuleStatus = p.costRuleStatus ?? (hasRule ? "已設定" : "待補成本規則");
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
      costRuleStatus,
      creatives,
      breakEvenRoas: p.breakEvenRoas ?? null,
      targetRoas: p.targetRoas ?? null,
      profitHeadroom: p.profitHeadroom ?? null,
    };
  });

  let filtered = rows.filter((r) => r.spend >= (filter.minSpend || 0));
  if (filter.statusFilter.length > 0) {
    filtered = filtered.filter((r) => filter.statusFilter.includes(r.productStatus));
  }
  if (filter.productIds.length > 0) {
    filtered = filtered.filter((r) => filter.productIds.includes(r.productName));
  }
  if (filter.ownerIds.length > 0) {
    filtered = filtered.filter((r) => {
      const o = ownerMap[r.productName];
      if (!o) return false;
      return [o.productOwnerId, o.mediaOwnerId, o.creativeOwnerId].some((id) => filter.ownerIds.includes(id));
    });
  }
  if (filter.savedViewId) {
    filtered = applySavedViewToProducts(filter.savedViewId as SavedViewId, filtered);
  }
  const sortKey = filter.sortBy as SortKey;
  const desc = filter.sortDesc;
  filtered = [...filtered].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    if (sortKey === "spend") { va = a.spend; vb = b.spend; }
    else if (sortKey === "revenue") { va = a.revenue; vb = b.revenue; }
    else if (sortKey === "roas") { va = a.roas; vb = b.roas; }
    else if (sortKey === "ctr") { va = a.ctr; vb = b.ctr; }
    else if (sortKey === "cvr") { va = a.cvr; vb = b.cvr; }
    else { va = a.spend; vb = b.spend; }
    if (typeof va === "number" && typeof vb === "number") return desc ? vb - va : va - vb;
    return 0;
  });

  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="page-title flex items-center gap-2">
            <Package className="w-5 h-5" />
            商品主戰場
          </h1>
        </div>
      </header>

      <div className="min-h-full p-4 md:p-6 space-y-4 page-container-fluid">
        <AccountExceptionsBlock scopeAccountIds={scopeAccountIds} scopeProducts={scopeProducts} compact />
        <FilterBar
          productOptions={productLevelMain.map((p) => p.productName)}
          ownerOptions={employees.map((e) => ({ id: e.id, name: e.name }))}
          showSavedViews
          showStatusFilter
          showMinSpend
          showSort
        />

        <Card className="border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span>商品數 <strong>{filtered.length}</strong></span>
              <span>總花費 <strong>{formatCurrency(totalSpend)}</strong></span>
              <span>總營收 <strong>{formatCurrency(totalRevenue)}</strong></span>
              <span>平均 ROAS <strong>{avgRoas.toFixed(2)}</strong></span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">每張卡回答七件事：值不值得砸、為什麼、靠哪些素材撐、被哪些素材拖、下一步、成本規則、breakEven／target／headroom。</p>
          </CardContent>
        </Card>

        {/* Phase 3A 商品主戰場：主卡樣式、七件事、在撐/在拖數、總監判語、語意色 */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const statusLabel = PRODUCT_STATUS[r.productStatus];
            const statusColor = r.productStatus === "scale" ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" :
              r.productStatus === "stop" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" :
              r.productStatus === "danger" ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-muted/20";
            const supporting = (r.creatives ?? []).filter((c: { roas: number }) => c.roas >= 2).sort((a: { roas: number }, b: { roas: number }) => b.roas - a.roas);
            const dragging = (r.creatives ?? []).filter((c: { roas: number; materialStrategy?: string }) => c.roas < 1 || (failureRatesByTag[c.materialStrategy ?? ""] ?? 0) > 0.8).sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend);
            const supportingCount = supporting.length;
            const draggingCount = dragging.length;
            const supportingPreview = supporting.slice(0, 3);
            const draggingPreview = dragging.slice(0, 3);
            const rescueForProduct = tableRescue.filter((x: { productName: string }) => x.productName === r.productName);
            const scaleUpForProduct = tableScaleUp.filter((x: { productName: string }) => x.productName === r.productName);
            const nextStep = rescueForProduct.length > 0 ? `先救 ${rescueForProduct.length} 檔` : scaleUpForProduct.length > 0 ? `可加碼 ${scaleUpForProduct.length} 檔` : r.ruleTags?.join("、") || "—";
            return (
              <Card key={r.productName} className={cn("flex flex-col", statusColor)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{r.productName}</h3>
                    {(r as { evidenceLevel?: string }).evidenceLevel && EVIDENCE_LABELS[(r as { evidenceLevel?: string }).evidenceLevel!] && (
                      <Badge variant="outline" className="text-[10px] font-normal">{EVIDENCE_LABELS[(r as { evidenceLevel?: string }).evidenceLevel!]}</Badge>
                    )}
                    <Badge variant="secondary" className={cn("text-[10px]", r.productStatus === "scale" ? "text-emerald-700" : r.productStatus === "stop" ? "text-red-700" : "")}>{statusLabel}</Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground border-l-2 border-primary/50 pl-2 py-0.5" title={r.aiSuggestion}>總監判語：{r.aiSuggestion}</p>
                  <div className="grid gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><Target className="w-3 h-3" /> 值不值得砸</span>
                      <p className="mt-0.5">{r.roas >= 2 ? "值得砸，ROAS 達標" : r.roas < 1 ? "不建議砸，先止血" : "觀察中"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1">為什麼</span>
                      <p className="mt-0.5 truncate" title={r.aiSuggestion}>{r.aiSuggestion}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 靠哪些素材撐</span>
                      <p className="mt-0.5 text-xs">{supportingCount === 0 ? "尚無高 ROAS 素材" : supportingPreview.map((c: { materialStrategy?: string; headlineSnippet?: string; roas: number }) => `${c.materialStrategy ?? ""} ${(c.headlineSnippet ?? "").slice(0, 20)} ROAS ${c.roas.toFixed(1)}`).join(" · ") + (supportingCount > 3 ? ` …共 ${supportingCount} 支` : "")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3" /> 被哪些素材拖</span>
                      <p className="mt-0.5 text-xs">{draggingCount === 0 ? "尚無明顯拖累" : draggingPreview.map((c: { materialStrategy?: string; headlineSnippet?: string; roas: number }) => `${(c.materialStrategy ?? "").slice(0, 8)} ROAS ${c.roas.toFixed(1)}`).join(" · ") + (draggingCount > 3 ? ` …共 ${draggingCount} 支` : "")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><Zap className="w-3 h-3" /> 下一步做什麼</span>
                      <p className="mt-0.5">{nextStep}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><Shield className="w-3 h-3" /> 成本規則是否可信</span>
                      <p className="mt-0.5">
                        {r.costRuleStatus === "待補成本規則" ? (
                          <Link href="/settings/profit-rules" className="text-amber-600 hover:underline inline-flex items-center gap-1"><Calculator className="w-3 h-3" />待補，點此設定</Link>
                        ) : (
                          "已設定，可依保本／目標判斷"
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1">breakEven／target／headroom</span>
                      <p className="mt-0.5 text-xs">
                        {r.hasRule && r.breakEvenRoas != null && r.targetRoas != null
                          ? `保本 ${(r.breakEvenRoas as number).toFixed(1)} · 目標 ${(r.targetRoas as number).toFixed(1)}${r.profitHeadroom != null ? ` · headroom ${(r.profitHeadroom as number) >= 0 ? "+" : ""}${((r.profitHeadroom as number) * 100).toFixed(0)}%` : ""}`
                          : "需先設定成本規則"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
                    <span>{formatCurrency(r.spend)}</span>
                    <span>ROAS {r.roas.toFixed(2)}</span>
                    <span>在撐 {supportingCount} 支 · 在拖 {draggingCount} 支</span>
                    <span className="ml-auto">
                      <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => openCreateTask(r)}>
                        <ListPlus className="w-3 h-3" /> 生成任務
                      </Button>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">無符合條件的商品，請放寬篩選或更新資料。</CardContent>
          </Card>
        )}

        {(unmappedCount > 0 || productLevelNoDelivery.length > 0) && (
          <Collapsible>
            <Card className="border-amber-200 dark:border-amber-800">
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 rounded-t-lg">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    未投遞／未映射：{productLevelNoDelivery.length} 商品無花費 · {unmappedCount} 活動未映射
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">建議修正活動命名或至「獲利規則中心」建立商品映射。</p>
                  {productLevelUnmapped.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">未映射活動：</span>
                      {productLevelUnmapped.slice(0, 10).map((p) => p.productName).join("、")}
                      {productLevelUnmapped.length > 10 && ` …共 ${productLevelUnmapped.length} 筆`}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        <Dialog open={!!createTaskRow} onOpenChange={(open) => !open && setCreateTaskRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>一鍵生成任務</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>標題</Label>
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="任務標題" />
              </div>
              <div>
                <Label>建議動作</Label>
                <Input value={taskAction} onChange={(e) => setTaskAction(e.target.value)} placeholder="動作" />
              </div>
              <div>
                <Label>理由</Label>
                <Textarea value={taskReason} onChange={(e) => setTaskReason(e.target.value)} placeholder="理由" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateTaskRow(null)}>取消</Button>
              <Button onClick={submitCreateTask} disabled={!taskTitle.trim() || !taskAction.trim() || !taskReason.trim() || createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "建立中…" : "建立任務"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
