import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pause,
  FlaskConical,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Eye,
  ShieldAlert,
  TrendingUp,
  Star,
  X,
  Check,
  Loader2,
  RefreshCw,
  Building2,
  Globe,
  CircleDot,
  Target,
  StopCircle,
  Rocket,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import type { RefreshStatus } from "@shared/schema";
import type {
  FbAdCreative,
  FbAccountOverview,
  FbAIDirectorSummary,
  FbCampaignStructure,
  FbBudgetRecommendation,
  FbAlert,
  HighRiskItem,
  RecommendationLevel,
  MetaAdAccount,
  MetaAccountsResponse,
  TriScore,
  RiskLevel,
  OpportunityCandidate,
  CampaignMetrics,
  StopLossResult,
} from "@shared/schema";
import { dateRangeOptions } from "@shared/schema";
import { ScoreBadge, OpportunityScoreBadge, OpportunityIndexDisplay, OpportunityBreakdownDisplay } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { SeverityBadge, severityStyles } from "@/components/shared/severity-badge";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import { V2ScoreMini, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import {
  formatCurrency,
  formatKPIValue,
  getAiLabelClass,
  statusLabels,
  statusColors,
  metaAccountStatusColors,
  FbRiskLevelBadge,
  FbTriScoreMini,
  type SortField,
  type SortDir,
  type AccountFilter,
} from "./shared";

export function OpportunityBoardSection() {
  const scope = useAppScope();
  const { data: oppData, isLoading } = useQuery<{ opportunities: OpportunityCandidate[] }>({
    queryKey: ["/api/fb-ads/opportunities", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/opportunities?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/opportunities";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-opportunity-board">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const opportunities = oppData?.opportunities || [];
  if (opportunities.length === 0) return null;

  const grouped: Record<string, { typeLabel: string; items: OpportunityCandidate[] }> = {};
  for (const opp of opportunities) {
    if (!grouped[opp.type]) {
      grouped[opp.type] = { typeLabel: opp.typeLabel, items: [] };
    }
    grouped[opp.type].items.push(opp);
  }

  const typeIcons: Record<string, typeof Target> = {
    low_spend_high_efficiency: Target,
    stable_scalable: TrendingUp,
    new_potential: Rocket,
    restartable: RefreshCw,
  };

  return (
    <Card data-testid="card-opportunity-board">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold" data-testid="text-opportunity-board-title">機會看板</h3>
          <Badge variant="secondary" className="text-xs ml-auto">{opportunities.length} 個機會</Badge>
        </div>

        {Object.entries(grouped).map(([type, group]) => {
          const Icon = typeIcons[type] || Target;
          return (
            <div key={type} className="mb-5 last:mb-0" data-testid={`section-opp-type-${type}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground">{group.typeLabel}</h4>
                <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((opp) => (
                  <Card key={`${opp.campaignId}-${opp.type}`} data-testid={`card-opp-${opp.campaignId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate max-w-[220px]" data-testid={`text-opp-campaign-${opp.campaignId}`}>{opp.campaignName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{opp.accountName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {opp.scoring ? <DiagnosisBadge diagnosis={opp.scoring.diagnosis} /> : <FbRiskLevelBadge level={opp.riskLevel} />}
                        </div>
                      </div>

                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        {opp.scoring ? (
                          <>
                            <V2ScoreMini scoring={opp.scoring} />
                            <ActionBadge action={opp.scoring.recommendedAction} />
                          </>
                        ) : (
                          <FbTriScoreMini triScore={opp.triScore} />
                        )}
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>放大潛力</span>
                          <span className="font-medium">{opp.estimatedScalePotential}</span>
                        </div>
                        <Progress value={opp.estimatedScalePotential} className="h-1.5" data-testid={`progress-scale-${opp.campaignId}`} />
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap" data-testid={`metrics-opp-${opp.campaignId}`}>
                        <span>花費 {formatCurrency(opp.spend)}</span>
                        <span>ROAS {opp.roas.toFixed(2)}</span>
                        <span>CTR {Number(opp.ctr).toFixed(2)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
