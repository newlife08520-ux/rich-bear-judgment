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

export function OperationalSummarySection({ data, isLoading }: { data?: FbAccountOverview; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-operational-summary">
        <CardContent className="p-5">
          <Skeleton className="w-32 h-5 mb-3" />
          <Skeleton className="w-full h-14 mb-5" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const inverseMetrics = new Set(["cpc", "cpa"]);

  function ChangeIndicator({ metricKey, change }: { metricKey: string; change: number }) {
    if (change === 0) return <span className="text-[11px] text-muted-foreground">vs 前期 --</span>;
    const isPositive = change > 0;
    const isNegative = change < 0;
    const isGood = inverseMetrics.has(metricKey) ? isNegative : isPositive;
    return (
      <span className={`flex items-center gap-0.5 text-[11px] font-medium ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {isPositive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
        vs 前期 {Math.abs(change).toFixed(1)}%
      </span>
    );
  }

  const spendKpi = data.kpiCards.find(k => k.key === "spend");
  const revenueKpi = data.kpiCards.find(k => k.key === "revenue");
  const roasKpi = data.kpiCards.find(k => k.key === "roas");
  const cpaKpi = data.kpiCards.find(k => k.key === "cpa");
  const cpcKpi = data.kpiCards.find(k => k.key === "cpc");
  const ctrKpi = data.kpiCards.find(k => k.key === "ctr");
  const cvrKpi = data.kpiCards.find(k => k.key === "cvr");

  const primaryMetrics = [
    { key: "spend", label: "本期總花費", value: formatCurrency(data.totalSpend), kpi: spendKpi },
    { key: "revenue", label: "本期營收", value: formatCurrency(data.totalRevenue), kpi: revenueKpi },
    { key: "roas", label: "ROAS", value: data.roas.toFixed(2), kpi: roasKpi },
    { key: "cpa", label: "CPA", value: data.cpa > 0 ? formatCurrency(data.cpa) : "--", kpi: cpaKpi },
  ];

  const secondaryMetrics = [
    { key: "cpc", label: "CPC", value: formatCurrency(data.cpc), kpi: cpcKpi },
    { key: "ctr", label: "CTR", value: `${data.ctr.toFixed(2)}%`, kpi: ctrKpi },
    { key: "cvr", label: "CVR", value: data.cvr > 0 ? `${data.cvr.toFixed(2)}%` : "--", kpi: cvrKpi },
  ];

  return (
    <Card data-testid="card-operational-summary">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="section-title text-muted-foreground" data-testid="text-summary-title">整體操盤狀況</h2>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <ScoreBadge score={data.judgmentScore} label="判決分數" />
            <OpportunityIndexDisplay index={data.opportunityIndex ?? data.opportunityScore} compact />
          </div>
        </div>

        <p className="text-lg font-bold leading-relaxed mb-5 text-foreground" data-testid="text-operational-headline">
          {data.operationalHeadline}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="grid-primary-metrics">
          {primaryMetrics.map((m) => (
            <div
              key={m.key}
              className="p-3 rounded-md bg-muted/40"
              data-testid={`summary-metric-${m.key}`}
            >
              <p className="text-[11px] text-muted-foreground mb-1">{m.label}</p>
              <p className="text-xl font-bold tracking-tight mb-1" data-testid={`summary-value-${m.key}`}>
                {m.value}
              </p>
              <ChangeIndicator metricKey={m.key} change={m.kpi?.change ?? 0} />
              {m.kpi && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">{m.kpi.aiNote}</p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3" data-testid="grid-secondary-metrics">
          {secondaryMetrics.map((m) => (
            <div
              key={m.key}
              className="p-3 rounded-md bg-muted/40 text-center"
              data-testid={`summary-metric-${m.key}`}
            >
              <p className="text-[11px] text-muted-foreground mb-1">{m.label}</p>
              <p className="text-lg font-bold tracking-tight" data-testid={`summary-value-${m.key}`}>
                {m.value}
              </p>
              <ChangeIndicator metricKey={m.key} change={m.kpi?.change ?? 0} />
            </div>
          ))}

          <div
            className={`p-3 rounded-md text-center ${data.stopSuggestionCount > 0 ? "bg-red-50 dark:bg-red-950/40" : "bg-muted/40"}`}
            data-testid="summary-metric-dangerCount"
          >
            <p className="text-[11px] text-muted-foreground mb-1">危險數量</p>
            <p className={`text-lg font-bold tracking-tight ${data.stopSuggestionCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`} data-testid="summary-value-dangerCount">
              {data.stopSuggestionCount}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
              {data.stopSuggestionCount > 0 ? `${data.stopSuggestionCount} 個活動需要立即關注` : "目前無高危活動"}
            </p>
          </div>

          <div
            className={`p-3 rounded-md text-center ${data.highPotentialCount > 0 ? "bg-blue-50 dark:bg-blue-950/40" : "bg-muted/40"}`}
            data-testid="summary-metric-scalableCount"
          >
            <p className="text-[11px] text-muted-foreground mb-1">可擴量數量</p>
            <p className={`text-lg font-bold tracking-tight ${data.highPotentialCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`} data-testid="summary-value-scalableCount">
              {data.highPotentialCount}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
              {data.highPotentialCount > 0 ? `${data.highPotentialCount} 個活動有放大空間` : "目前無明顯擴量機會"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

