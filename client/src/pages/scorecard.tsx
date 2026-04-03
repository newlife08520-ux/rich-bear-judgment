/**
 * 第三層：流程管理引擎 — 素材工廠效率與團隊命中率儀表板
 *
 * 定位：不是首頁決策主表，而是回答三類問題：
 * A. 素材工廠效率（本週上線、第一次決策點、存活率、拉升率、主力化率、延伸成功率）
 * B. 團隊命中率（商品線／素材類型／設計・企劃誰命中高、誰一直出死亡素材）
 * C. 知識回流（最近死亡原因、存活原因、有效鉤子／畫面／結構）
 *
 * 現有欄位保留：本月上線、成功數、成功率、按商品/按人、Lucky 率、漏斗通過率、淘汰原因。
 * 新增區塊 A/C 待 API 支援本週與第一次決策點、知識彙總後補上。
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployee } from "@/lib/employee-context";
import { BarChart3, Factory, Target, Lightbulb } from "lucide-react";

type ScorecardItem = {
  name: string;
  launchedCount: number;
  successCount: number;
  successRate: number;
  avgDaysToTarget: string;
  retirementReasons: Array<{ reason: string; count: number }>;
  luckyRate?: number;
  funnelPassRate?: number;
  avgQualityScore?: number;
};

function ScorecardTable({ items, nameToLabel, title }: { items: ScorecardItem[]; nameToLabel: (name: string) => string; title?: string }) {
  return (
    <div className="space-y-4">
      {title && <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>}
      {items.map((item) => (
        <Card key={item.name}>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-base">{nameToLabel(item.name)}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <span className="text-muted-foreground">本月上線</span>
                <p className="font-medium">{item.launchedCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">成功數</span>
                <p className="font-medium">{item.successCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">成功率</span>
                <p className="font-medium">{(item.successRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">平均達標天數</span>
                <p className="font-medium">{item.avgDaysToTarget}</p>
              </div>
              {item.luckyRate != null && (
                <div>
                  <span className="text-muted-foreground">Lucky 率</span>
                  <p className="font-medium">{(item.luckyRate * 100).toFixed(1)}%</p>
                </div>
              )}
              {item.funnelPassRate != null && (
                <div>
                  <span className="text-muted-foreground">漏斗通過率</span>
                  <p className="font-medium">{(item.funnelPassRate * 100).toFixed(1)}%</p>
                </div>
              )}
              {item.avgQualityScore != null && (
                <div>
                  <span className="text-muted-foreground">平均品質分</span>
                  <p className="font-medium">{item.avgQualityScore.toFixed(1)}</p>
                </div>
              )}
            </div>
            {item.retirementReasons.length > 0 && (
              <div>
                <span className="text-muted-foreground">淘汰原因分布</span>
                <ul className="mt-1 space-y-0.5">
                  {item.retirementReasons.map((r, i) => (
                    <li key={i}>
                      {r.reason.slice(0, 60)}{r.reason.length > 60 ? "…" : ""} × {r.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ScorecardPage() {
  const { employees } = useEmployee();
  const [groupBy, setGroupBy] = useState<"product" | "person">("product");

  const { data, isLoading } = useQuery<{
    items?: ScorecardItem[];
    groupBy: string;
    itemsByBuyer?: ScorecardItem[];
    itemsByCreative?: ScorecardItem[];
  }>({
    queryKey: ["/api/dashboard/scorecard", groupBy],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/scorecard?groupBy=${groupBy}`, { credentials: "include" });
      if (!res.ok) return { groupBy };
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const itemsByBuyer = data?.itemsByBuyer ?? [];
  const itemsByCreative = data?.itemsByCreative ?? [];
  const nameToLabel = (name: string) => {
    if (groupBy !== "person") return name;
    const emp = employees.find((e) => e.id === name);
    return emp ? emp.name : name;
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          素材工廠效率與團隊命中率儀表板
        </h1>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">定位說明</p>
            <p className="mb-2">此頁屬於「流程管理引擎」，回答：A 素材工廠效率、B 團隊命中率、C 知識回流。非首頁決策主表。</p>
            <p className="font-medium text-foreground mb-1">KPI 定義</p>
            <ul className="space-y-0.5 text-xs">
              <li><strong>成功率</strong> = Winner 數／本月上線數（ROI 漏斗引擎判定為 Winner：達 minSpend/minClicks/minPurchases 且 ROAS 達標、漏斗健康）。</li>
              <li><strong>Lucky 率</strong> = Lucky 數／本月上線數。Lucky：花費低於門檻但有轉換，需補量後再評估。</li>
              <li><strong>漏斗通過率</strong> = 漏斗健康達標數／本月上線數。</li>
              <li><strong>平均品質分</strong> = 各筆 ROI + 漏斗 + 置信度綜合分數的平均。</li>
            </ul>
            <p className="text-amber-700 dark:text-amber-400 mt-2 text-xs font-medium">若多數為 0%：可能本月尚無上線、或門檻未達、或「上線」定義與資料源尚未對齊。此頁為輔助儀表板，勿單獨作為核心考核依據。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-4 h-4" />
              A. 素材工廠效率
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
            <p>本週上線素材數、達第一次決策點比例、存活率、拉升率、主力化率、延伸成功率 — 待 API 支援「本週」與「第一次決策點」定義後顯示。</p>
            <p className="mt-2 text-xs">目前下方「按商品／按人」表為本月上線與成功率，可視為工廠效率的現有指標。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              B. 團隊命中率
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground mb-3">哪些商品線／素材類型／設計・企劃命中率高、誰最近最容易做出 Winner、誰一直出死亡素材。</p>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "product" | "person")}>
              <TabsList>
                <TabsTrigger value="product">按商品</TabsTrigger>
                <TabsTrigger value="person">按人（Buyer／Creative）</TabsTrigger>
              </TabsList>
              <TabsContent value={groupBy} className="mt-4">
                {isLoading ? (
                  <p className="text-muted-foreground">載入中…</p>
                ) : groupBy === "person" ? (
                  (itemsByBuyer.length === 0 && itemsByCreative.length === 0) ? (
                    <p className="text-muted-foreground">尚無資料，請先執行數據分析。</p>
                  ) : (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-base font-semibold mb-1">Buyer 成績</h3>
                        <p className="text-sm text-muted-foreground mb-3">依廣告買手（主責投放）統計本月上線與成功率。</p>
                        <ScorecardTable items={itemsByBuyer} nameToLabel={nameToLabel} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold mb-1">Creative 成績</h3>
                        <p className="text-sm text-muted-foreground mb-3">依素材負責人統計本月上線與成功率。</p>
                        <ScorecardTable items={itemsByCreative} nameToLabel={nameToLabel} />
                      </div>
                    </div>
                  )
                ) : items.length === 0 ? (
                  <p className="text-muted-foreground">尚無資料，請先執行數據分析。</p>
                ) : (
                  <ScorecardTable items={items} nameToLabel={nameToLabel} />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              C. 知識回流
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
            <p>最近 7/14 天最常見死亡原因、最常見存活原因、最近最有效的鉤子／畫面／結構類型 — 待審判結果與生命週期彙總管線完成後顯示。</p>
            <p className="mt-2 text-xs">目前「淘汰原因分布」已出現在各商品/人卡片中，可視為死亡原因的現有來源。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
