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

export function StopListSection({ isLoading }: { isLoading: boolean }) {
  const scope = useAppScope();
  const { data: stops, isLoading: stopsLoading } = useQuery<FbAdCreative[]>({
    queryKey: ["/api/fb-ads/stop-list", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/stop-list?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/stop-list";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const loading = isLoading || stopsLoading;

  if (loading) {
    return (
      <div className="space-y-3" data-testid="stop-list-skeleton">
        <Skeleton className="w-32 h-5" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    );
  }

  if (!stops || stops.length === 0) return null;

  return (
    <div data-testid="section-stop-list">
      <h4 className="section-title mb-3">建議停止的素材</h4>
      <div className="space-y-3">
        {stops.map((s) => (
          <Card key={s.id} data-testid={`card-stop-${s.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <p className="font-medium text-sm">{s.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <RecommendationLevelBadge level={s.recommendationLevel} />
                  <ScoreBadge score={s.judgmentScore} label="判決" />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
                <span>花費: {formatCurrency(s.spend)}</span>
                <span>ROAS: {s.roas.toFixed(2)}</span>
                <span>頻率: {s.frequency.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.aiComment}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
