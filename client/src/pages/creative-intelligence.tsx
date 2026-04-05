import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAppScope } from "@/hooks/use-app-scope";
import { useEmployee } from "@/lib/employee-context";
import type { ActionCenterData } from "@/pages/dashboard/dashboard-types";
import { VisibilityPolicyStrip } from "@/components/visibility/VisibilityPolicyStrip";
import { DormantGemsSurfaceSection } from "@/components/visibility/DormantGemsSurfaceSection";
import { DormantGemsWorkflowRibbon } from "@/components/visibility/DormantGemsWorkflowRibbon";
import { CreativeIntelligenceWorkbench } from "./creative-intelligence/workbench/CreativeIntelligenceWorkbench";
import type { EngineV2 } from "./creative-intelligence/workbench/ParetoEngineV2Card";
import { CreativeIntelligenceStrategicCallout } from "./creative-intelligence/CreativeIntelligenceStrategicCallout";
import { DormantActionStrip } from "@/components/strategic-panel";

export default function CreativeIntelligencePage() {
  const scope = useAppScope();
  const { employee } = useEmployee();
  const params = new URLSearchParams();
  if (scope.scopeKey) params.set("scope", scope.scopeKey);
  if (employee.assignedProducts?.length) params.set("scopeProducts", employee.assignedProducts.join(","));
  if (employee.assignedAccounts?.length) params.set("scopeAccountIds", employee.assignedAccounts.join(","));
  else if (scope.selectedAccountIds?.length) params.set("scopeAccountIds", scope.selectedAccountIds.join(","));
  const q = params.toString();

  const { data: actionCenterData } = useQuery<ActionCenterData>({
    queryKey: ["/api/dashboard/action-center", scope.scopeKey ?? "", q],
    queryFn: async () => {
      const res = await fetch(q ? `/api/dashboard/action-center?${q}` : "/api/dashboard/action-center", {
        credentials: "include",
      });
      if (!res.ok) {
        return {
          productLevel: [],
          creativeLeaderboard: [],
          hiddenGems: [],
          urgentStop: [],
          riskyCampaigns: [],
        } as ActionCenterData;
      }
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creative-intelligence/patterns", q],
    queryFn: async () => {
      const url = q ? `/api/creative-intelligence/patterns?${q}` : "/api/creative-intelligence/patterns";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const { data: paretoData, isLoading: paretoLoading } = useQuery({
    queryKey: ["/api/pareto/by-product", q],
    queryFn: async () => {
      const url = q ? `/api/pareto/by-product?${q}` : "/api/pareto/by-product";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("pareto failed");
      return (await res.json()) as {
        productCount: number;
        pareto: {
          top20PctIds: string[];
          bottom20PctIds: string[];
          hiddenDiamondCandidates: string[];
          dragCandidates: string[];
        };
        engineV2?: EngineV2;
      };
    },
  });

  useQuery({
    queryKey: ["/api/pareto/command-layer", q],
    queryFn: async () => {
      const url = q ? `/api/pareto/command-layer?${q}` : "/api/pareto/command-layer";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("command-layer");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b p-4 flex items-center gap-3">
        <SidebarTrigger />
        <h1 className="page-title" data-testid="creative-intelligence-title">
          創意智慧
        </h1>
      </header>
      <div className="p-4 md:p-6 space-y-6 page-container-fluid">
        <Alert
          variant="default"
          className="border-muted bg-muted/30"
          data-testid="ci-statistical-disclosure"
        >
          <AlertTitle className="text-sm">歸因與資料說明</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1">
            <p>
              注意：素材表現數據受歸因延遲影響，建議以 7 天以上數據為主要參考。
            </p>
            <p data-testid="ci-low-confidence-demotion-hint">
              若系統顯示分析降級，請將高分建議視為參考，並與實際投放結果交叉確認。
            </p>
            <p data-testid="ci-learning-phase-protected-hint" className="text-xs text-muted-foreground">
              Meta 學習期或投放狀態異常時，請勿僅憑單一指標立即大幅縮減預算。
            </p>
          </AlertDescription>
        </Alert>
        <div data-testid="ci-command-surface-v6" className="space-y-6">
          <div data-testid="ci-dormant-primary-workflow-v3" className="space-y-6">
            <DormantActionStrip data-testid="ci-dormant-primary-strip-v6">
              <DormantGemsWorkflowRibbon
                surface="creative-intelligence"
                candidates={actionCenterData?.dormantGemCandidates ?? []}
              />
              <DormantGemsSurfaceSection
                surface="creative-intelligence"
                candidates={actionCenterData?.dormantGemCandidates ?? []}
              />
            </DormantActionStrip>
          </div>
          <VisibilityPolicyStrip
            surface="creative-intelligence"
            dormantGemCandidates={actionCenterData?.dormantGemCandidates ?? []}
            noDeliveryCount={actionCenterData?.budgetActionNoDelivery?.length ?? 0}
            underSampleCount={actionCenterData?.budgetActionUnderSample?.length ?? 0}
            visibilityPolicyVersion={actionCenterData?.visibilityPolicyVersion}
          />
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> 載入模式彙總…
            </div>
          )}
          {data?.degraded === true && (
            <Card className="border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card" data-testid="ci-patterns-degraded-banner">
              <CardContent className="py-3 px-4 text-sm flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">模式 API 已降級（仍回 200）</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(data.degradedReason ?? "未知原因")} — 請稍後重試或聯繫管理員；下方介面仍可瀏覽。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {data && (
            <>
              <CreativeIntelligenceStrategicCallout patterns={data} />
              <Card data-testid="ci-queue">
                <CardHeader>
                  <CardTitle className="text-base">審判進度</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {(() => {
                    const rq = (data as { reviewQueue?: Record<string, number> }).reviewQueue ?? {
                      pending: 0,
                      running: 0,
                      failed: 0,
                      completed: 0,
                    };
                    return (
                      <p>
                        待處理：{rq.pending} · 執行中：{rq.running} · 失敗：{rq.failed} · 已完成（累計）：{rq.completed}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>
              <CreativeIntelligenceWorkbench
                patterns={data}
                paretoData={paretoData}
                dormantGemCandidates={actionCenterData?.dormantGemCandidates ?? []}
              />
            </>
          )}
        </div>
        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="ci-card-winners">
                <CardHeader>
                  <CardTitle className="text-base">Hook — 較常與贏家標籤共現（Top）</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {(data.hookTopWinners as { tag: string; count: number }[]).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Hook — 較常與落後標籤共現（Top）</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {(data.hookTopLosers as { tag: string; count: number }[]).map((x) => (
                    <div key={x.tag}>
                      {x.tag}：{x.count}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card data-testid="ci-card-meta">
              <CardHeader>
                <CardTitle className="text-base">摘要</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>審判筆數：{data.reviewCount}</p>
                <p>快照筆數：{data.snapshotCount}</p>
                <p>高分／低花費候選版本數：{(data.hiddenDiamondVersionIds as string[]).length}</p>
                <p>Lucky 候選版本數：{(data.luckyVersionIds as string[]).length}</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card data-testid="ci-card-pareto">
          <CardHeader>
            <CardTitle className="text-base">80／20（商品維度）</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {paretoLoading && (
              <p className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 計算 Pareto…
              </p>
            )}
            {paretoData && (
              <>
                <p>商品數：{paretoData.productCount}</p>
                <p className="text-xs">
                  貢獻前段（約 top 20% 商品）：{paretoData.pareto.top20PctIds.slice(0, 8).join("、") || "—"}
                </p>
                <p className="text-xs">
                  尾段壓力（約 bottom 20%）：{paretoData.pareto.bottom20PctIds.slice(0, 8).join("、") || "—"}
                </p>
                <p className="text-xs">
                  候選：隱鑽 {paretoData.pareto.hiddenDiamondCandidates.length} 個 · 待觀察{" "}
                  {paretoData.pareto.dragCandidates.length} 個
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
