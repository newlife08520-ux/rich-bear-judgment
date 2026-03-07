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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AccountExceptionsBlock } from "@/components/account-exceptions-block";
import { useLocation } from "wouter";

function formatCurrency(value: number) {
  return `NT$ ${value.toLocaleString()}`;
}

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
  const creativeLeaderboard = actionData?.creativeLeaderboard ?? [];
  const failureRatesByTag = actionData?.failureRatesByTag ?? {};

  useEffect(() => {
    if (!productNameFromUrl || productLevel.length === 0) return;
    const exists = productLevel.some((p: { productName?: string }) => p.productName === productNameFromUrl);
    if (exists && (filter.productIds.length !== 1 || filter.productIds[0] !== productNameFromUrl)) {
      setProductFilter([productNameFromUrl]);
    }
  }, [productNameFromUrl, productLevel, setProductFilter]);

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

  const rows = productLevel.map((p) => {
    const derived = deriveProductRow({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      impressions: p.impressions,
      clicks: p.clicks,
      conversions: p.conversions,
      campaignCount: p.campaignCount,
    });
    const creatives = creativeLeaderboard.filter((c) => c.productName === p.productName);
    const winnerCount = creatives.filter((c) => c.roas >= 2).length;
    const fatigueCount = creatives.filter((c) => (failureRatesByTag[c.materialStrategy] ?? 0) > 0.8).length;
    const conf = confidenceByProduct.get(p.productName);
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
            商品作戰室
          </h1>
        </div>
      </header>

      <div className="min-h-full p-4 md:p-6 space-y-4 page-container-fluid">
        <AccountExceptionsBlock scopeAccountIds={scopeAccountIds} scopeProducts={scopeProducts} compact />
        <FilterBar
          productOptions={productLevel.map((p) => p.productName)}
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="table-scroll-container overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 sticky left-0 bg-muted/50 z-10">商品</th>
                    <th className="text-left p-2">商品 owner</th>
                    <th className="text-left p-2">投手 owner</th>
                    <th className="text-left p-2">素材 owner</th>
                    <th className="text-right p-2">花費</th>
                    <th className="text-right p-2">營收</th>
                    <th className="text-right p-2">ROAS</th>
                    <th className="text-right p-2">CTR%</th>
                    <th className="text-right p-2">CVR%</th>
                    <th className="text-right p-2">CPC</th>
                    <th className="text-right p-2">CPA</th>
                    <th className="text-center p-2">素材數/勝出/疲勞</th>
                    <th className="text-center p-2">狀態</th>
                    <th className="text-left p-2">AI 建議</th>
                    <th className="text-center p-2" title="資料可信度：未映射花費、衝突數、override 占比">可信度</th>
                    <th className="text-left p-2">下一步</th>
                    <th className="text-center p-2">指派狀態</th>
                    <th className="text-center p-2">動作</th>
                    <th className="text-right p-2">最後更新</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const owners = ownerMap[r.productName] || { productOwnerId: "", mediaOwnerId: "", creativeOwnerId: "", taskStatus: "unassigned" };
                    const statusLabel = PRODUCT_STATUS[r.productStatus];
                    const statusColor = r.productStatus === "scale" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300" :
                      r.productStatus === "stop" ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                      r.productStatus === "danger" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" : "bg-muted text-muted-foreground";
                    return (
                      <tr key={r.productName} className="border-b hover:bg-muted/30">
                        <td className="p-2 sticky left-0 bg-background z-10 font-medium">{r.productName}</td>
                        <td className="p-2">
                          <Select value={owners.productOwnerId || "_"} onValueChange={(v) => updateOwner(r.productName, "productOwnerId", v === "_" ? "" : v)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_">—</SelectItem>
                              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={owners.mediaOwnerId || "_"} onValueChange={(v) => updateOwner(r.productName, "mediaOwnerId", v === "_" ? "" : v)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_">—</SelectItem>
                              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={owners.creativeOwnerId || "_"} onValueChange={(v) => updateOwner(r.productName, "creativeOwnerId", v === "_" ? "" : v)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_">—</SelectItem>
                              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(r.spend)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(r.revenue)}</td>
                        <td className={cn("p-2 text-right font-medium", r.roas >= 2 ? "text-emerald-600" : r.roas < 1 ? "text-red-600" : "")}>{r.roas.toFixed(2)}</td>
                        <td className="p-2 text-right">{r.ctr.toFixed(2)}%</td>
                        <td className="p-2 text-right">{r.cvr.toFixed(2)}%</td>
                        <td className="p-2 text-right">{r.cpc.toFixed(0)}</td>
                        <td className="p-2 text-right">{r.cpa > 0 ? formatCurrency(r.cpa) : "—"}</td>
                        <td className="p-2 text-center">{r.creativeCount} / {r.winnerCount} / {r.fatigueCount}</td>
                        <td className="p-2">
                          <Badge variant="secondary" className={cn("text-[10px]", statusColor)}>{statusLabel}</Badge>
                        </td>
                        <td className="p-2 max-w-[140px] truncate" title={r.aiSuggestion}>{r.aiSuggestion}</td>
                        <td className="p-2 text-center" title={`未映射花費 NT$${batchUnmappedSpend.toLocaleString()} · 衝突 ${r.conflictCount} · override ${(r.overrideHitRate * 100).toFixed(0)}%`}>
                          <Badge variant={r.data_confidence === "high" ? "secondary" : r.data_confidence === "medium" ? "outline" : "destructive"} className="text-[10px]">
                            {r.data_confidence === "high" ? "高" : r.data_confidence === "medium" ? "中" : "低"}
                          </Badge>
                        </td>
                        <td className="p-2 max-w-[120px] truncate">{r.ruleTags.join("、") || "—"}</td>
                        <td className="p-2">
                          <Select value={owners.taskStatus} onValueChange={(v) => updateOwner(r.productName, "taskStatus", v)}>
                            <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">未指派</SelectItem>
                              <SelectItem value="assigned">已指派</SelectItem>
                              <SelectItem value="in_progress">進行中</SelectItem>
                              <SelectItem value="done">已完成</SelectItem>
                              <SelectItem value="pending_confirm">待確認</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openCreateTask(r)}>
                            <ListPlus className="w-3 h-3" /> 生成任務
                          </Button>
                        </td>
                        <td className="p-2 text-right text-muted-foreground text-xs">—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">無符合條件的商品，請放寬篩選或更新資料。</div>
            )}
          </CardContent>
        </Card>

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
