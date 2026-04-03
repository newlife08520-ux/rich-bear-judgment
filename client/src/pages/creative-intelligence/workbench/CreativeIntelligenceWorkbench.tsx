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
    <div className="space-y-4" data-testid="ci-workbench">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">商品篩選（標籤上下文）</span>
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
        <TabsContent value="dormant" data-testid="ci-dormant-operational-v7" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dormant／復活（與首頁／商品／FB 同批 action-center）</CardTitle>
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
        <TabsContent value="tags" className="space-y-4">
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
                  <p className="font-medium mb-1">hidden-diamond motifs</p>
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
              <CardTitle className="text-base">版本時間線（API）</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                請以 <code className="text-xs bg-muted px-1 rounded">GET /api/creative-intelligence/version/{"{assetVersionId}"}</code>{" "}
                取得 review／snapshot／link 合併之 <code>versionTimeline</code> 與{" "}
                <code>attribution</code>（why winning／losing、信心、歧義說明）。
              </p>
              <p className="text-xs">
                頁面層級時間線將以多版本輪詢為重載；營運單版本 drilldown 建議自素材頁或後續深連結開啟。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pareto">
          <ParetoEngineV2Card engineV2={props.paretoData?.engineV2} />
          <p className="text-xs text-muted-foreground mt-2" data-testid="ci-pareto-command-layer-hint">
            商品數（batch）：{props.paretoData?.productCount ?? "—"} · 共用營運層：{" "}
            <code className="bg-muted px-1 rounded">GET /api/pareto/command-layer</code>（7.6）
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
