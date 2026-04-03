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

export function StopLossSection() {
  const scope = useAppScope();
  const { data: scoredData, isLoading } = useQuery<{ campaigns: CampaignMetrics[] }>({
    queryKey: ["/api/fb-ads/campaigns-scored", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/campaigns-scored?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/campaigns-scored";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-stop-loss">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 mb-2" />)}
        </CardContent>
      </Card>
    );
  }

  const stopCampaigns = (scoredData?.campaigns || []).filter(c => c.stopLoss?.shouldStop);
  if (stopCampaigns.length === 0) return null;

  return (
    <Card data-testid="card-stop-loss">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center shrink-0">
            <StopCircle className="w-4 h-4 text-red-600" />
          </div>
          <h3 className="section-title" data-testid="text-stop-loss-title">該停下來的活動</h3>
          <Badge variant="secondary" className="bg-red-100 text-red-700 border-transparent text-xs ml-auto">{stopCampaigns.length}</Badge>
        </div>
        <div className="space-y-3">
          {stopCampaigns.map((c, idx) => (
            <div key={`${c.campaignId}-${idx}`} className="p-3 rounded-md bg-red-50/50" data-testid={`card-stop-loss-${idx}`}>
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold" data-testid={`text-stop-campaign-${idx}`}>{c.campaignName}</p>
                  <p className="text-[11px] text-muted-foreground">{c.accountName}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {c.scoring ? (
                    <>
                      <DiagnosisBadge diagnosis={c.scoring.diagnosis} />
                      <V2ScoreMini scoring={c.scoring} />
                      <ActionBadge action={c.scoring.recommendedAction} />
                    </>
                  ) : (
                    <>
                      <FbRiskLevelBadge level={c.riskLevel} />
                      <FbTriScoreMini triScore={c.triScore} />
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
                <span>花費 {formatCurrency(c.spend)}</span>
                <span>ROAS {c.roas.toFixed(2)}</span>
                <span>CTR {Number(c.ctr).toFixed(2)}%</span>
              </div>
              {c.stopLoss?.reasons && c.stopLoss.reasons.length > 0 && (
                <div className="space-y-1" data-testid={`stop-reasons-${idx}`}>
                  {c.stopLoss.reasons.map((reason, ri) => (
                    <div key={ri} className="flex items-start gap-1.5 text-xs text-red-700">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}
              {(c.stopLoss?.timeWindow || c.stopLoss?.benchmark || c.stopLoss?.sustainedPattern || c.stopLoss?.possiblePageIssue) && (
                <div className="mt-2 pt-2 border-t border-red-200/50 space-y-1.5" data-testid={`stop-details-${idx}`}>
                  {c.stopLoss?.timeWindow && (
                    <p className="text-[11px] text-muted-foreground">{c.stopLoss.timeWindow}</p>
                  )}
                  {c.stopLoss?.benchmark && (
                    <p className="text-[11px] text-muted-foreground">{c.stopLoss.benchmark}</p>
                  )}
                  {c.stopLoss?.sustainedPattern && (
                    <div className="flex items-start gap-1.5 text-[11px]">
                      <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                      <span className="text-foreground/80">{c.stopLoss.sustainedPattern}</span>
                    </div>
                  )}
                  {c.stopLoss?.possiblePageIssue && (
                    <div className="flex items-start gap-1.5 text-[11px]">
                      <Globe className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
                      <span className="text-blue-700 dark:text-blue-400">{c.stopLoss.possiblePageIssue}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
