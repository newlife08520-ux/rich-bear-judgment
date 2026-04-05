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

export function CreativeOpportunityBoard({ creatives, isLoading }: { creatives?: FbAdCreative[]; isLoading: boolean }) {
  const topOpportunities = useMemo(() => {
    if (!creatives) return [];
    return [...creatives]
      .filter((c) => {
        if (c.opportunityScore <= 0) return false;
        if (c.status === "ended") return false;
        if (c.scoring && c.scoring.scores.confidence < 20) return false;
        if (c.scoring?.recommendedAction === "pause") return false;
        if (c.aiLabel === "先停再說") return false;
        if (c.spend < 50 && c.impressions < 500) return false;
        return true;
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 6);
  }, [creatives]);

  if (isLoading) {
    return (
      <div data-testid="opportunity-board-skeleton">
        <Skeleton className="w-40 h-5 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (topOpportunities.length === 0) return null;

  return (
    <div data-testid="section-opportunity-board">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <h3 className="section-title">值得加碼的素材</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {topOpportunities.map((c) => (
          <Card key={c.id} data-testid={`card-opportunity-${c.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <p className="font-medium text-sm truncate max-w-[180px]" data-testid={`text-opp-name-${c.id}`}>{c.name}</p>
                <OpportunityScoreBadge score={c.opportunityScore} size="md" />
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className={getAiLabelClass(c.aiLabel)}>
                  {c.aiLabel}
                </Badge>
                <RecommendationLevelBadge level={c.recommendationLevel} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
                <span>ROAS {c.roas.toFixed(2)}</span>
                <span>CTR {Number(c.ctr).toFixed(2)}%</span>
                <span>花費 {formatCurrency(c.spend)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{c.suggestedAction}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
