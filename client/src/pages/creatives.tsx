/**
 * Phase 3 素材作戰台：每素材回答七件事（屬於哪個商品、幫還是拖、是否黑馬、是否疲乏、值不值得延伸、給投手一句話、給設計一句話）
 * 沿用首頁主次層級與語意色，非表格。
 */
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, TrendingDown, Zap, AlertTriangle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmployee } from "@/lib/employee-context";

function formatCurrency(value: number) {
  return `NT$ ${value.toLocaleString()}`;
}

type CreativeRow = {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  suggestedAction?: string;
  suggestedPct?: number | "關閉";
  budgetReason?: string;
  whyNotMore?: string;
  creativeEdge?: number;
  scaleReadinessScore?: number;
  evidenceLevel?: string;
};

const EVIDENCE_LABELS: Record<string, string> = {
  ads_only: "廣告層推測",
  rules_missing: "規則缺失",
  insufficient_sample: "樣本不足",
  no_delivery: "尚未投遞",
};

export default function CreativesPage() {
  const { employee } = useEmployee();
  const params = new URLSearchParams();
  if (employee.assignedProducts?.length) params.set("scopeProducts", employee.assignedProducts.join(","));
  if (employee.assignedAccounts?.length) params.set("scopeAccountIds", employee.assignedAccounts.join(","));

  const { data: actionData } = useQuery({
    queryKey: ["/api/dashboard/action-center", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/action-center?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return { creativeLeaderboard: [], tierHighPotentialCreatives: [], failureRatesByTag: {} };
      return res.json();
    },
  });

  const creativeLeaderboard = (actionData?.creativeLeaderboard ?? []).filter((c: { spend: number }) => c.spend > 0) as CreativeRow[];
  const tierHighPotential = actionData?.tierHighPotentialCreatives ?? [];
  const failureRatesByTag = actionData?.failureRatesByTag ?? {};
  const highPotentialSet = new Set(tierHighPotential.map((c: { productName: string; headlineSnippet: string }) => `${c.productName}|${c.headlineSnippet}`));

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center gap-3 p-4 border-b shrink-0">
        <SidebarTrigger />
        <h1 className="page-title flex items-center gap-2">
          <Zap className="w-5 h-5" />
          素材審判
        </h1>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <p className="text-sm text-muted-foreground">每張卡回答：屬於哪個商品、幫還是拖、是否黑馬、是否疲乏、值不值得延伸、給投手一句話、給設計一句話。</p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creativeLeaderboard.slice(0, 50).map((c, i) => {
            const isBlackHorse = highPotentialSet.has(`${c.productName}|${c.headlineSnippet}`);
            const fatigueRate = failureRatesByTag[c.materialStrategy] ?? 0;
            const isFatigue = fatigueRate > 0.8;
            const isHelp = c.roas >= 2;
            const isDrag = c.roas < 1 || isFatigue;
            const worthExtend = isBlackHorse && (c.creativeEdge ?? 0) >= 1.2;
            const cardVariant = isBlackHorse
              ? "border-slate-200 bg-white border-l-4 border-l-amber-500 dark:border-border dark:bg-card"
              : isDrag
                ? "border-slate-200 bg-white border-l-4 border-l-rose-500 dark:border-border dark:bg-card"
                : "border-border bg-card";

            const forBuyer = c.budgetReason
              ? `${c.suggestedAction ?? ""} ${c.suggestedPct === "關閉" ? "關閉" : c.suggestedPct != null ? c.suggestedPct + "%" : ""} — ${c.budgetReason}`
              : "可小步加預算觀察轉換，勿一次拉滿。";
            const forDesign = "維持此方向，可複製元素到其他素材測試。";

            return (
              <Card key={`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}-${i}`} className={cn("flex flex-col", cardVariant)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground truncate">{c.materialStrategy}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={c.headlineSnippet}>{c.headlineSnippet}</span>
                    {c.evidenceLevel && EVIDENCE_LABELS[c.evidenceLevel] && (
                      <Badge variant="outline" className="text-xs font-normal">{EVIDENCE_LABELS[c.evidenceLevel]}</Badge>
                    )}
                  </div>
                  <div className="grid gap-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><Package className="w-3 h-3" /> 屬於哪個商品</span>
                      <p className="mt-0.5">{c.productName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1">{isHelp ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-rose-600" />} 幫還是拖</span>
                      <p className="mt-0.5">{isHelp ? "幫" : isDrag ? "拖" : "觀察中"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><Zap className="w-3 h-3" /> 是不是黑馬</span>
                      <p className="mt-0.5">{isBlackHorse ? "是（高潛力可延伸）" : "否"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 是不是疲乏</span>
                      <p className="mt-0.5">{isFatigue ? `是（歷史陣亡率 ${(fatigueRate * 100).toFixed(0)}%）` : "否"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">值不值得延伸</span>
                      <p className="mt-0.5">{worthExtend ? "值得，可小步延伸" : isBlackHorse ? "可觀察" : "暫不建議"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium flex items-center gap-1"><MessageSquare className="w-3 h-3" /> 給投手一句話</span>
                      <p className="mt-0.5 text-xs">{forBuyer}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">給設計一句話</span>
                      <p className="mt-0.5 text-xs">{forDesign}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t text-xs text-muted-foreground">
                    <span>{formatCurrency(c.spend)}</span>
                    <span>ROAS {c.roas.toFixed(2)}</span>
                    {c.creativeEdge != null && <span>Edge {c.creativeEdge.toFixed(2)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {creativeLeaderboard.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">尚無有花費的素材資料，請先同步廣告資料。</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
