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

export function KPISection({ data, isLoading }: { data?: FbAccountOverview; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div data-testid="kpi-grid-skeleton">
        <Skeleton className="w-40 h-5 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="w-20 h-3 mb-2" />
                <Skeleton className="w-24 h-6 mb-2" />
                <Skeleton className="w-16 h-4 mb-1" />
                <Skeleton className="w-full h-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div data-testid="kpi-section">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="section-title text-muted-foreground">帳號成效一覽</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <ScoreBadge score={data.judgmentScore} label="判決分數" />
          <OpportunityIndexDisplay index={data.opportunityIndex ?? data.opportunityScore} compact />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="kpi-grid">
        {data.kpiCards.map((kpi) => {
          const isPositive = kpi.change > 0;
          const isNegative = kpi.change < 0;
          const inverseMetrics = new Set(["cpc", "cpm", "frequency", "fatigueCount", "stopCount"]);
          const isGood = inverseMetrics.has(kpi.key) ? isNegative : isPositive;

          return (
            <Card key={kpi.key} data-testid={`kpi-card-${kpi.key}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-xl font-bold tracking-tight mb-1" data-testid={`kpi-value-${kpi.key}`}>
                  {formatKPIValue(kpi.value, kpi.format)}
                </p>
                <div className="flex items-center gap-1 mb-2">
                  {kpi.change !== 0 && (
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-600"}`}>
                      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </span>
                  )}
                  {kpi.change === 0 && (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`kpi-note-${kpi.key}`}>
                  {kpi.aiNote}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

