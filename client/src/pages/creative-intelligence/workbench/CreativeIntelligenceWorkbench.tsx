import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagFamilyWorkbenchPanel } from "./TagFamilyWorkbenchPanel";
import { HiddenDiamondEvidencePanel } from "./HiddenDiamondEvidencePanel";
import { ParetoEngineV2Card, type EngineV2 } from "./ParetoEngineV2Card";
import { AttributionVersionProbe } from "./AttributionVersionProbe";

type PatternsPayload = {
  hookTopWinners?: { tag: string; count: number }[];
  hookTopLosers?: { tag: string; count: number }[];
  workbenchProducts?: string[];
  tagFamilies?: Record<string, { winners: { key: string; count: number }[]; losers: { key: string; count: number }[] }>;
  tagFamilyOrder?: string[];
  hiddenDiamondEvidence?: Array<{
    assetVersionId: string;
    roas: number;
    spend: number;
    lifecycleLabel?: string | null;
    ambiguousAttribution?: boolean;
    evidenceSnippet?: string;
  }>;
};

export function CreativeIntelligenceWorkbench(props: {
  patterns: PatternsPayload | undefined;
  paretoData: { engineV2?: EngineV2; productCount?: number } | undefined;
  dormantGemCandidates?: DormantGemCandidateItem[];
}) {
  const products = props.patterns?.workbenchProducts ?? [];
  const [productFilter, setProductFilter] = useState<string>("all");

  const dormantSorted = useMemo(() => {
    const d = props.dormantGemCandidates ?? [];
    return [...d].sort((a, b) => (b.revivalPriorityScore ?? 0) - (a.revivalPriorityScore ?? 0));
  }, [props.dormantGemCandidates]);

  const filteredWinners = useMemo(() => {
    const w = props.patterns?.hookTopWinners ?? [];
    if (productFilter === "all") return w;
    return w.filter((x) => x.tag.includes(productFilter));
  }, [props.patterns?.hookTopWinners, productFilter]);

  const { data: perf } = useQuery({
    queryKey: ["/api/creative-intelligence/product/pattern-performance", productFilter],
    enabled: productFilter !== "all",
    queryFn: async () => {
      const res = await fetch(
        `/api/creative-intelligence/product/${encodeURIComponent(productFilter)}/pattern-performance`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("pattern-performance");
      return (await res.json()) as {
        winningHooks?: { tag: string; count: number }[];
        losingHooks?: { tag: string; count: number }[];
        hiddenDiamondMotifs?: { tag: string; count: number }[];
      };
    },
  });

  return (
    <div className="space-y-6" data-testid="ci-workbench">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">商品篩選</span>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[220px]" data-testid="ci-workbench-product-filter">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部商品</SelectItem>
            {products.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="dormant">
        <TabsList>
          <TabsTrigger value="dormant" data-testid="ci-tab-dormant-main-lens-v6">
            沉睡主鏡頭
          </TabsTrigger>
          <TabsTrigger value="tags">標籤工作台</TabsTrigger>
          <TabsTrigger value="timeline">版本時間線</TabsTrigger>
          <TabsTrigger value="pareto">Pareto v2</TabsTrigger>
        </TabsList>
        <TabsContent value="dormant" data-testid="ci-dormant-operational-v7" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">沉睡復活候選</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {dormantSorted.length === 0 ? (
                <p className="text-muted-foreground text-xs">目前無沉睡候選；仍可到「標籤工作台」繼續 pattern 分析。</p>
              ) : (
                <ul className="space-y-2">
                  {dormantSorted.map((c) => (
                    <li
                      key={`${c.campaignId}-${c.productName}`}
                      className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                      data-testid={`ci-dormant-lens-row-${c.campaignId}`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium truncate">{c.campaignName}</p>
                        <p className="text-xs text-muted-foreground">{c.productName}</p>
                        <p className="text-[11px] text-muted-foreground">{c.reviveRecommendation ?? c.reasonSummary ?? "—"}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/tasks">任務</Link>
                        </Button>
                        <Button size="sm" variant="secondary" asChild>
                          <Link href="/fb-ads">預算控制</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tags" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <TagFamilyWorkbenchPanel
              tagFamilies={props.patterns?.tagFamilies}
              tagFamilyOrder={props.patterns?.tagFamilyOrder}
            />
            <Card data-testid="ci-winners-losers-filtered">
              <CardHeader>
                <CardTitle className="text-base">Hook — 依篩選之贏家／落後（摘要）</CardTitle>
              </CardHeader>
              <CardContent className="text-sm grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">贏家側</p>
                  {filteredWinners.map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">落後側</p>
                  {(props.patterns?.hookTopLosers ?? []).slice(0, 10).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <HiddenDiamondEvidencePanel items={props.patterns?.hiddenDiamondEvidence} />
          {productFilter !== "all" && perf ? (
            <Card data-testid="ci-product-pattern-performance">
              <CardHeader>
                <CardTitle className="text-base">商品 pattern 摘要（{productFilter}）</CardTitle>
              </CardHeader>
              <CardContent className="text-xs grid md:grid-cols-3 gap-3">
                <div>
                  <p className="font-medium mb-1">常勝 hook</p>
                  {(perf.winningHooks ?? []).slice(0, 6).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">常敗 hook</p>
                  {(perf.losingHooks ?? []).slice(0, 6).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">隱鑽主題</p>
                  {(perf.hiddenDiamondMotifs ?? []).slice(0, 6).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="timeline">
          <Card data-testid="ci-version-timeline">
            <CardHeader>
              <CardTitle className="text-base">版本時間線</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>單一素材版本可從「素材中心」開啟，檢視審判紀錄、成效快照與歸因說明。</p>
              <p className="text-xs">此處為總覽；若需細節請至對應素材頁查看。</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pareto">
          <ParetoEngineV2Card engineV2={props.paretoData?.engineV2} />
          <p className="text-xs text-muted-foreground mt-2" data-testid="ci-pareto-command-layer-hint">
            納入分析之商品數：{props.paretoData?.productCount ?? "—"}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
