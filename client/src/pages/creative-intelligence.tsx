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
          Creative Intelligence
        </h1>
      </header>
      <div className="p-4 md:p-6 space-y-4 page-container-fluid">
        <Alert
          variant="default"
          className="border-muted bg-muted/30"
          data-testid="ci-statistical-disclosure"
        >
          <AlertTitle className="text-sm">統計與歸因限制（常駐揭露）</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1">
            <p>
              Creative Intelligence 之標籤／Pareto／實驗連結受 <strong>歸因延遲</strong>、
              <strong>樣本量</strong> 與 <strong>跨平台 ID 對齊</strong> 影響；樣本稀疏時建議視為低信心，不宜當唯一真理。
            </p>
            <p data-testid="ci-low-confidence-demotion-hint">
              當模式 API 降級或後端回傳 degraded 時，下方高分卡與建議應降權解讀，並以實際投放批次與 execution 稽核交叉驗證。
            </p>
            <p data-testid="ci-learning-phase-protected-hint" className="text-xs text-muted-foreground">
              Meta 學習期／投放狀態異常時，系統會以 <code className="text-[10px]">learningPhaseProtected</code> 降權節奏敘事；請勿將 CI 高分解讀為可立即 pause／縮減預算的唯一依據。
            </p>
          </AlertDescription>
        </Alert>
        <div data-testid="ci-command-surface-v6" className="space-y-3">
          <div data-testid="ci-dormant-primary-workflow-v3" className="space-y-3">
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
            <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20" data-testid="ci-patterns-degraded-banner">
              <CardContent className="py-3 px-4 text-sm flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">模式 API 已降級（仍回 200）</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(data.degradedReason ?? "未知原因")} — 請確認資料庫 migration 與 Prisma schema 一致；下方為空架構以利繼續操作。
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
                  <CardTitle className="text-base">審判佇列（背景工作）</CardTitle>
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
                  <p className="text-xs">
                    {(data as { attributionNote?: string }).attributionNote ??
                      "Experiment link：僅 primary 且 active 承載主要 Meta 歸因。"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    商品 drilldown（JSON）：GET /api/creative-intelligence/product/{"{productName}"}
                  </p>
                </CardContent>
              </Card>
              <p className="text-sm text-muted-foreground">
                可加 <code className="text-xs bg-muted px-1 rounded">?syncSnapshots=1</code> 以目前 batch 同步 outcome 快照（需先有 experiment link）。
              </p>
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
            <CardTitle className="text-base">80／20（商品維度 · 含 v2 主引擎）</CardTitle>
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
                  候選：hidden diamond {paretoData.pareto.hiddenDiamondCandidates.length} 個 · drag{" "}
                  {paretoData.pareto.dragCandidates.length} 個
                </p>
                {paretoData.engineV2?.legacyPrecedenceNote ? (
                  <p className="text-[11px] border-t pt-2 mt-2">{paretoData.engineV2.legacyPrecedenceNote}</p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
