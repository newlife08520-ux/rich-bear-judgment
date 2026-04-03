import {
  ArrowDown, ArrowRight, ChevronDown, ChevronRight, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPercent } from "../ga4-formatters";
import type { Ga4Workbench } from "../useGa4Workbench";
import { Ga4RankingTabContent } from "./Ga4RankingTabContent";
import { Ga4CompareTabContent } from "./Ga4CompareTabContent";

export function Ga4MainTabs(w: Ga4Workbench) {
  const {
    activeTab, setActiveTab, segmentsLoading, funnelSegments, funnelDrillDown,
    expandedSegments, toggleSegment,
  } = w;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList data-testid="tabs-main">
        <TabsTrigger value="funnel" data-testid="tab-funnel">漏斗分析</TabsTrigger>
        <TabsTrigger value="ranking" data-testid="tab-ranking">頁面排行</TabsTrigger>
        <TabsTrigger value="compare" data-testid="tab-compare">頁面比較</TabsTrigger>
      </TabsList>

      <TabsContent value="funnel">
        {segmentsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-28" /></CardContent></Card>
            ))}
          </div>
        ) : funnelSegments && funnelSegments.length > 0 ? (
          <div className="space-y-3" data-testid="funnel-segments">
            {funnelSegments.map((seg, idx) => {
              const stageKey = `${seg.from} → ${seg.to}`;
              const drillData = funnelDrillDown?.find((d) => d.stage === stageKey);
              const hasDrill = !!drillData?.topPages?.length;
              return (
              <div key={idx} className="relative" data-testid={`card-segment-${idx}`}>
                {idx > 0 && (
                  <div className="flex justify-center -mt-1 mb-1">
                    <ArrowDown className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-base" data-testid={`text-segment-title-${idx}`}>
                            {seg.from} <ArrowRight className="inline w-4 h-4 mx-0.5 align-text-bottom" /> {seg.to}
                          </h3>
                          <Badge variant="outline" className="text-xs">轉換 {formatPercent(seg.conversionRate)}</Badge>
                          <Badge variant="outline" className="text-xs">流失 {formatPercent(seg.dropRate)}</Badge>
                          {seg.benchmark != null && (
                            <Badge variant="secondary" className="text-xs">基準 {formatPercent(seg.benchmark)}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-segment-desc-${idx}`}>{seg.aiVerdict}</p>
                        <Badge variant="secondary" className="text-xs mt-1">{seg.problemType}</Badge>
                      </div>
                      {hasDrill && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 shrink-0"
                          onClick={() => toggleSegment(idx)}
                          data-testid={`button-expand-segment-${idx}`}
                        >
                          {expandedSegments.has(idx) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                    {hasDrill && expandedSegments.has(idx) && (
                        <div className="mt-2 space-y-2" data-testid={`drilldown-${idx}`}>
                          {drillData!.topPages.map((pg, pgIdx) => (
                            <div key={pgIdx} className="p-3 rounded-md bg-muted/30 border border-border/30" data-testid={`drilldown-page-${idx}-${pgIdx}`}>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-xs font-medium line-clamp-1">{pg.pageTitle || pg.pagePath}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{pg.sessions} 工作階段</span>
                              </div>
                              <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">{pg.reason}</p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">建議: {pg.fix}</p>
                            </div>
                          ))}
                        </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-sm text-muted-foreground" data-testid="text-funnel-empty">尚無漏斗分析資料，請先更新資料</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="ranking">
        <Ga4RankingTabContent {...w} />
      </TabsContent>

      <TabsContent value="compare">
        <Ga4CompareTabContent {...w} />
      </TabsContent>
    </Tabs>
  );
}
