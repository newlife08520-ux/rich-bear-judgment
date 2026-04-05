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

export function AlertsTab() {
  const scope = useAppScope();
  const { data: alerts, isLoading } = useQuery<FbAlert[]>({
    queryKey: ["/api/fb-ads/alerts", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/alerts?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/alerts";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="alerts-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) return null;

  const warnings = alerts.filter((a) => a.type === "warning");
  const opportunities = alerts.filter((a) => a.type === "opportunity");

  return (
    <div className="space-y-6" data-testid="section-alerts">
      {warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h4 className="text-sm font-semibold">異常警示</h4>
          </div>
          <div className="space-y-3">
            {warnings.map((alert) => (
              <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-start gap-2 flex-wrap">
                      <SeverityBadge severity={alert.severity} />
                      <p className="text-sm font-semibold" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
                    </div>
                    <OpportunityScoreBadge score={alert.opportunityScore} size="md" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{alert.description}</p>
                  {alert.relatedCreative && (
                    <p className="text-xs text-muted-foreground mt-1">
                      相關素材: {alert.relatedCreative}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold">遺漏機會</h4>
          </div>
          <div className="space-y-3">
            {opportunities.map((alert) => (
              <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-start gap-2 flex-wrap">
                      <SeverityBadge severity={alert.severity} />
                      <p className="text-sm font-semibold" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</p>
                    </div>
                    <OpportunityScoreBadge score={alert.opportunityScore} size="md" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{alert.description}</p>
                  {alert.relatedCreative && (
                    <p className="text-xs text-muted-foreground mt-1">
                      相關素材: {alert.relatedCreative}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
