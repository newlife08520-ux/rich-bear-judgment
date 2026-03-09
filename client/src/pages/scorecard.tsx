/**
 * P4-1 新品/素材成功率成績單：按人、按商品。本月上線、成功數、成功率、平均達標天數、淘汰原因分布
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployee } from "@/lib/employee-context";
import { BarChart3 } from "lucide-react";

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
          成功率成績單
        </h1>
      </header>
      <div className="flex-1 p-4 md:p-6 space-y-4">
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">KPI 定義與計算來源</p>
            <ul className="space-y-0.5 text-xs">
              <li><strong>成功率</strong> = Winner 數／本月上線數。成功定義：ROI 漏斗引擎判定為 Winner（達 minSpend/minClicks/minPurchases 且 ROAS 達標、漏斗健康）。</li>
              <li><strong>Lucky 率</strong> = Lucky 數／本月上線數。Lucky：花費低於門檻但有轉換，可能是運氣，需補量到門檻後再評估。</li>
              <li><strong>漏斗通過率</strong> = 漏斗健康達標數／本月上線數（ATC／購買轉換符合設定基準）。</li>
              <li><strong>平均品質分</strong> = 各筆 ROI + 漏斗 + 置信度綜合分數的平均。</li>
            </ul>
            <p className="text-amber-700 dark:text-amber-400 mt-2 text-xs font-medium">若多數為 0%：可能本月尚無上線、或門檻未達。此頁為輔助指標，定義與資料源成熟前請勿單獨作為核心考核依據。</p>
          </CardContent>
        </Card>
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "product" | "person")}>
          <TabsList>
            <TabsTrigger value="product">按商品</TabsTrigger>
            <TabsTrigger value="person">按人（Buyer／Creative 兩張表）</TabsTrigger>
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
      </div>
    </div>
  );
}
