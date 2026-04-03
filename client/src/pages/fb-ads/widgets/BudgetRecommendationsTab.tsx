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
import type { MetaBudgetPayload } from "../useMetaExecutionGate";

export type BudgetRecommendationsTabMetaGate = {
  onRequestBudgetUpdate?: (payload: MetaBudgetPayload) => void;
  execBusy?: boolean;
};

export function BudgetRecommendationsTab({
  onRequestBudgetUpdate,
  execBusy = false,
}: BudgetRecommendationsTabMetaGate = {}) {
  const scope = useAppScope();
  const { data: recs, isLoading } = useQuery<FbBudgetRecommendation[]>({
    queryKey: ["/api/fb-ads/budget-recommendations", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/budget-recommendations?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/budget-recommendations";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="budget-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    );
  }

  if (!recs || recs.length === 0) return null;

  const typeConfig: Record<string, { icon: typeof ArrowUp; colorClass: string; bgClass: string }> = {
    increase: { icon: ArrowUp, colorClass: "text-emerald-600", bgClass: "bg-emerald-50 dark:bg-emerald-950" },
    decrease: { icon: ArrowDown, colorClass: "text-amber-600", bgClass: "bg-amber-50 dark:bg-amber-950" },
    pause: { icon: Pause, colorClass: "text-red-600", bgClass: "bg-red-50 dark:bg-red-950" },
    test: { icon: FlaskConical, colorClass: "text-blue-600", bgClass: "bg-blue-50 dark:bg-blue-950" },
  };

  return (
    <div className="space-y-3" data-testid="section-budget-recs">
      {recs.map((rec, i) => {
        const config = typeConfig[rec.type] || typeConfig.test;
        const Icon = config.icon;
        return (
          <Card key={i} data-testid={`card-budget-rec-${i}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-md ${config.bgClass} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${config.colorClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold" data-testid={`text-budget-action-${i}`}>{rec.action}</p>
                    <OpportunityScoreBadge score={rec.opportunityScore} size="md" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    對象: {rec.target}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-1">
                    {rec.reason}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400" data-testid={`text-budget-impact-${i}`}>
                    預期效果: {rec.expectedImpact}
                  </p>
                  {rec.paceDescription && (
                    <div className="mt-2 p-2.5 rounded-md bg-muted/30" data-testid={`text-budget-pace-${i}`}>
                      <p className="text-xs font-medium leading-relaxed">{rec.paceDescription}</p>
                    </div>
                  )}
                  {(rec.suggestedChange || rec.suggestedAmount || rec.whyNow) && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        {rec.suggestedChange && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.bgClass} ${config.colorClass}`} data-testid={`text-budget-change-${i}`}>
                            {rec.suggestedChange}
                          </span>
                        )}
                        {rec.suggestedAmount && (
                          <span className="text-xs text-foreground/80" data-testid={`text-budget-amount-${i}`}>{rec.suggestedAmount}</span>
                        )}
                        {rec.confidenceScore != null && (
                          <span className="text-xs text-muted-foreground">信心 {rec.confidenceScore}</span>
                        )}
                      </div>
                      {rec.whyNow && (
                        <div className="flex items-start gap-1.5 text-xs" data-testid={`text-budget-whynow-${i}`}>
                          <Lightbulb className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                          <span className="text-foreground/80">{rec.whyNow}</span>
                        </div>
                      )}
                      {rec.risks && rec.risks.length > 0 && (
                        <div className="space-y-0.5" data-testid={`section-budget-risks-${i}`}>
                          <span className="text-xs font-medium text-muted-foreground">風險提醒:</span>
                          {rec.risks.map((r, ri) => (
                            <div key={ri} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {rec.safetyPace && (
                        <p className="text-xs text-muted-foreground">節奏: {rec.safetyPace}</p>
                      )}
                      {rec.guardConditions && rec.guardConditions.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span>護欄: </span>
                          {rec.guardConditions.map((g, gi) => (
                            <span key={gi}>{gi > 0 ? "、" : ""}{g}</span>
                          ))}
                        </div>
                      )}
                      {rec.rollbackCondition && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">退回條件: {rec.rollbackCondition}</p>
                      )}
                    </div>
                  )}
                  {onRequestBudgetUpdate && rec.campaignId && rec.suggestedBudgetDaily != null && (rec.type === "increase" || rec.type === "decrease") && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={execBusy}
                        onClick={() => onRequestBudgetUpdate({
                          campaignId: rec.campaignId!,
                          budgetDaily: rec.suggestedBudgetDaily,
                        })}
                        data-testid={`button-apply-budget-${i}`}
                      >
                        {execBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        套用預算
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
