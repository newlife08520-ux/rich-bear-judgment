/**
 * 第三層：流程管理引擎 — 素材生命週期中心
 * 規格見 shared/lifecycle-spec.ts（1.0 狀態流：待初審→待驗證→第一次決策點→存活池→拉升池→死亡池→靈感池）。
 * 目前以 ROI 漏斗標籤呈現；未來每支承載 Scale Readiness、預算建議、借鑑點、whyNotMore。
 * 支援 /creative-lifecycle?creativeId= 深連結。
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Wallet, Archive, ListPlus, Filter, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type LifecycleItem = { id: string; name: string; roas: number; spend: number; reason: string };

type LifecycleLabel = "Lucky" | "Winner" | "Underfunded" | "FunnelWeak" | "Retired" | "NEEDS_MORE_DATA" | "STABLE";
type LifecycleCardItem = LifecycleItem & {
  atc: number;
  purchase: number;
  atc_rate: number;
  purchase_rate: number;
  atcRateBaseline: number;
  purchaseRateBaseline: number;
  confidenceLevel: string;
  label: LifecycleLabel;
  qualityScore: number;
  priority?: number;
  baseline_scope?: string;
  stage?: string;
  scaleReadinessScore?: number;
  suggestedAction?: string;
  suggestedPct?: number | "關閉";
  whyNotMore?: string;
  firstReviewVerdict?: string;
  battleVerdict?: string;
  forBuyer?: string;
  forDesign?: string;
};

type InspirationItem = {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  creativeEdge: number;
  winReason: string;
  extendDirection: string;
  designTakeaway: string;
};

function Column({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ElementType;
  items: LifecycleItem[];
  variant: "success" | "underfunded" | "retired";
}) {
  const bg = variant === "success" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200" : variant === "underfunded" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200" : "bg-slate-100 dark:bg-slate-800/50 border-slate-200";
  return (
    <Card className={`border ${bg}`}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-3 pb-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">尚無</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="rounded border bg-background/80 p-2">
                <div className="font-medium truncate" title={i.name}>{i.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ROAS {i.roas.toFixed(1)} · 花費 NT${i.spend.toLocaleString()}
                </div>
                {i.reason && <div className="text-xs text-muted-foreground mt-1 border-t pt-1">{i.reason}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部階段" },
  { value: "待初審", label: "待初審" },
  { value: "待驗證", label: "待驗證" },
  { value: "第一次決策點", label: "第一次決策點" },
  { value: "存活池", label: "存活池" },
  { value: "拉升池", label: "拉升池" },
  { value: "死亡池", label: "死亡池" },
];

const LABEL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "Winner", label: "Winner" },
  { value: "Underfunded", label: "Underfunded" },
  { value: "Lucky", label: "Lucky（運氣單）" },
  { value: "NEEDS_MORE_DATA", label: "NeedsMoreData" },
  { value: "STABLE", label: "Stable" },
  { value: "FunnelWeak", label: "FunnelWeak" },
  { value: "Retired", label: "Retired" },
];

const LABEL_DISPLAY: Record<string, string> = {
  Winner: "Winner",
  Underfunded: "Underfunded",
  Lucky: "Lucky",
  NeedsMoreData: "NeedsMoreData",
  NEEDS_MORE_DATA: "NeedsMoreData",
  STABLE: "Stable",
  Stable: "Stable",
  FunnelWeak: "FunnelWeak",
  Retired: "Retired",
};

function LabelBadge({ label }: { label: LifecycleLabel }) {
  const normalized = String(label);
  const display = LABEL_DISPLAY[normalized] ?? normalized;
  const variant =
    display === "Winner" ? "default" :
    display === "Underfunded" ? "secondary" :
    display === "Lucky" ? "destructive" :
    "outline";
  return <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"}>{display}</Badge>;
}

/** 從 location 解析 ?creativeId= 或 ?campaignId=（統一主鍵，見 docs/creative-identity.md） */
function getCreativeKeyFromUrl(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("creativeId")?.trim() || params.get("campaignId")?.trim() || null;
}

export default function CreativeLifecyclePage() {
  const [location] = useLocation();
  const creativeKeyFromUrl = getCreativeKeyFromUrl(location);
  const [stageFilter, setStageFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const highlightCardRef = useRef<HTMLDivElement | null>(null);
  const { data, isLoading } = useQuery<{
    items: LifecycleCardItem[];
    success: LifecycleItem[];
    underfunded: LifecycleItem[];
    retired: LifecycleItem[];
    inspirationPool: InspirationItem[];
    stages: string[];
    firstDecisionSpendMin?: number;
    firstDecisionSpendMax?: number;
  }>({
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

  const displayItems =
    creativeKeyFromUrl && items.length > 0
      ? items.filter((i) => i.id === creativeKeyFromUrl || i.name.toLowerCase().includes(creativeKeyFromUrl!.toLowerCase()))
      : items;
  const hasCreativeKeyFilter = !!creativeKeyFromUrl && items.length > 0;
  const highlightId = hasCreativeKeyFilter && displayItems.length > 0 ? displayItems[0].id : null;

  useEffect(() => {
    if (!highlightId || !highlightCardRef.current) return;
    highlightCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, displayItems.length]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: suggestionsData } = useQuery<{ suggestions: Array<{ type: string; productName?: string; campaignName: string; suggestion: string; action: string; reason: string }> }>({
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
      const items = suggestions.slice(0, 20).map((s) => ({
        title: `${s.productName || "素材"}：${s.suggestion}`,
        action: s.action,
        reason: s.reason,
        productName: s.productName,
      }));
      const res = await fetch("/api/workbench/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("建立失敗");
      return res.json();
    },
    onSuccess: (data: { count: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({ title: `已建立 ${data.count} 筆任務`, duration: 2000 });
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
    onSuccess: (data: { count: number; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workbench/tasks"] });
      toast({ title: `已建立 ${data.count} 筆 Lucky 補量任務；${data.message ?? "完成後於下次資料刷新時會自動重新分類"}`, duration: 4000 });
    },
    onError: () => toast({ title: "建立 Lucky 任務失敗", variant: "destructive" }),
  });

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <h1 className="page-title">素材生命週期中心 1.0</h1>
          <p className="text-sm text-muted-foreground mt-0.5">7 階段：待初審 → 待驗證 → 第一次決策點（花費 {firstDecisionMin}–{firstDecisionMax}）→ 存活池 → 拉升池 → 死亡池 → 靈感池。</p>
        </div>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* 全部素材卡片：ROAS、Spend、ATC、Purchase、rate、baseline、confidence、label */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">素材清單（7 階段 + 完整判決欄位）</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {luckyCount > 0 && (
                <Button size="sm" variant="secondary" onClick={() => createLuckyTasksMutation.mutate()} disabled={createLuckyTasksMutation.isPending}>
                  Lucky 一鍵生成補量任務 ({luckyCount})
                </Button>
              )}
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={stageFilter || "all"} onValueChange={(v) => setStageFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="依階段" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={labelFilter || "all"} onValueChange={(v) => setLabelFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="依 ROI label" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">載入中…</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center space-y-4">
                <p className="text-sm font-medium text-muted-foreground">尚無素材或尚未達門檻</p>
                <p className="text-xs text-muted-foreground">請先上傳素材、建立投放草稿或同步廣告與轉換資料，達門檻後會在此顯示。</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/assets">前往素材中心上傳</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/publish">前往投放中心建立草稿</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/settings">前往設定中心同步資料</a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {hasCreativeKeyFilter && displayItems.length === 0 && (
                  <p className="text-sm text-amber-600 mb-3">未找到 campaignId/ID 或名稱含「{creativeKeyFromUrl}」的素材，顯示全部。</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayItems.map((i) => (
                    <Card
                      key={i.id}
                      ref={i.id === highlightId ? highlightCardRef : undefined}
                      className={cn("border bg-card", i.id === highlightId && "ring-2 ring-primary bg-primary/5")}
                    >
                    <CardContent className="p-3 text-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium truncate" title={i.name}>{i.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {i.stage && <Badge variant="outline" className="text-[10px]">{i.stage}</Badge>}
                          <LabelBadge label={i.label} />
                        </div>
                      </div>
                      {i.stage === "第一次決策點" && (
                        <div className="rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2 text-xs">
                          <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">第一次決策點（花費 {firstDecisionMin}–{firstDecisionMax}）</p>
                          <p>建議：<strong>{i.suggestedAction}</strong> {i.suggestedPct === "關閉" ? "關閉" : typeof i.suggestedPct === "number" ? (i.suggestedPct > 0 ? `+${i.suggestedPct}%` : `${i.suggestedPct}%`) : ""}</p>
                          <p className="text-muted-foreground mt-0.5">可選：開 / 拉高 / 維持 / 關閉 / 進延伸池</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>ROAS {i.roas.toFixed(2)}</span>
                        <span>Spend NT${i.spend.toLocaleString()}</span>
                        {i.scaleReadinessScore != null && <span className="col-span-2">Scale Readiness {i.scaleReadinessScore}</span>}
                        {i.suggestedAction != null && <span className="col-span-2">建議動作 {i.suggestedAction} {i.suggestedPct != null && i.suggestedPct !== "關閉" ? `${i.suggestedPct}%` : i.suggestedPct === "關閉" ? "關閉" : ""}</span>}
                        <span>ATC {i.atc}</span>
                        <span>Purchase {i.purchase}</span>
                      </div>
                      {i.whyNotMore && <p className="text-xs border-t pt-1.5 text-muted-foreground"><span className="font-medium">為什麼不是更大或更小：</span>{i.whyNotMore}</p>}
                      {i.forBuyer && <p className="text-xs border-t pt-1.5 text-muted-foreground"><span className="font-medium">給投手：</span>{i.forBuyer}</p>}
                      {i.forDesign && <p className="text-xs border-t pt-1.5 text-muted-foreground"><span className="font-medium">給設計：</span>{i.forDesign}</p>}
                      {i.firstReviewVerdict && i.firstReviewVerdict !== "—" && <p className="text-xs text-muted-foreground">初審判決：{i.firstReviewVerdict}</p>}
                      {i.battleVerdict && <p className="text-xs text-muted-foreground">實戰判決：{i.battleVerdict}</p>}
                      {i.reason && <p className="text-xs border-t pt-1.5 text-muted-foreground">{i.reason}</p>}
                    </CardContent>
                  </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!isLoading && inspirationPool.length > 0 && (
          <Card className="border-violet-200 dark:border-violet-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-violet-600" />
                靈感池（設計可用的延伸素材）
              </CardTitle>
              <p className="text-sm text-muted-foreground">高 Creative Edge、漏斗不差、花費仍低，供設計與投手優先延伸。</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {inspirationPool.slice(0, 15).map((c, idx) => (
                  <li key={idx} className="rounded-lg border p-3 text-sm space-y-1.5">
                    <div className="font-medium">{c.productName} · {c.materialStrategy}</div>
                    <div className="text-xs text-muted-foreground">Spend NT${c.spend.toLocaleString()} · ROAS {c.roas.toFixed(2)} · Edge {c.creativeEdge.toFixed(2)}</div>
                    <p className="text-xs"><span className="font-medium">贏在哪：</span>{c.winReason}</p>
                    <p className="text-xs"><span className="font-medium">建議延伸：</span>{c.extendDirection}</p>
                    <p className="text-xs"><span className="font-medium">設計可借：</span>{c.designTakeaway}</p>
                  </li>
                ))}
                {inspirationPool.length > 15 && <li className="text-muted-foreground text-sm">…共 {inspirationPool.length} 筆</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Column title="成功／穩定 (Winner)" icon={TrendingUp} items={success} variant="success" />
            <Column title="預算不足 (Underfunded)" icon={Wallet} items={underfunded} variant="underfunded" />
            <Column title="已疲勞／Lucky／建議停" icon={Archive} items={retired} variant="retired" />
          </div>
        )}

        {suggestions.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListPlus className="w-4 h-4" />
                汰換建議（加碼／淘汰／補素材）
              </CardTitle>
              <Button size="sm" onClick={() => createTasksMutation.mutate()} disabled={createTasksMutation.isPending}>
                一鍵生成任務
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                {suggestions.slice(0, 15).map((s, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{s.campaignName}</span>
                    <span className="text-muted-foreground shrink-0">{s.suggestion} · {s.action}</span>
                  </li>
                ))}
                {suggestions.length > 15 && <li className="text-muted-foreground">…共 {suggestions.length} 筆</li>}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
