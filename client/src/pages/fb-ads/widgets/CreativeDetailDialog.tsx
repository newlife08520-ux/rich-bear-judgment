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

export function CreativeDetailDialog({
  creative,
  open,
  onClose,
}: {
  creative: FbAdCreative | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!creative) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-creative-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap" data-testid="text-dialog-title">
            {creative.name}
            <Badge variant="outline" className={getAiLabelClass(creative.aiLabel)}>
              {creative.aiLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>素材詳細分析</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 flex-wrap" data-testid="section-primary-metric">
            <div>
              <p className="text-xs text-muted-foreground">ROAS</p>
              <p className="text-3xl font-bold">{creative.roas.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ScoreBadge score={creative.judgmentScore} label="判決" />
              <OpportunityScoreBadge score={creative.opportunityScore} size="md" />
              <RecommendationLevelBadge level={creative.recommendationLevel} />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">關鍵指標</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "花費", value: formatCurrency(creative.spend) },
                { label: "CTR", value: `${Number(creative.ctr).toFixed(2)}%` },
                { label: "CPC", value: `NT$ ${creative.cpc.toFixed(1)}` },
                { label: "CPM", value: `NT$ ${Math.round(creative.cpm).toLocaleString()}` },
                { label: "ROAS", value: creative.roas.toFixed(2) },
                { label: "頻率", value: creative.frequency.toFixed(1) },
                { label: "轉換", value: creative.conversions.toLocaleString() },
                { label: "曝光", value: creative.impressions.toLocaleString() },
              ].map((m) => (
                <div key={m.label} className="p-2 rounded-md bg-muted/30" data-testid={`metric-${m.label}`}>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-semibold">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="section-ai-evaluation">
            <h4 className="text-sm font-semibold mb-2">AI 評估</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{creative.aiComment}</p>
          </div>

          {creative.opportunityBreakdown && <OpportunityBreakdownDisplay breakdown={creative.opportunityBreakdown} />}

          <div data-testid="section-trend">
            <h4 className="text-sm font-semibold mb-2">7 日趨勢</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "CTR", value: creative.trend7d.ctr },
                { label: "ROAS", value: creative.trend7d.roas },
                { label: "CPC", value: creative.trend7d.cpc },
              ].map((t) => (
                <div key={t.label} className="p-2 rounded-md bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{t.label}</p>
                  <span className={`flex items-center justify-center gap-0.5 text-sm font-semibold ${
                    t.label === "CPC"
                      ? t.value < 0 ? "text-emerald-600" : t.value > 0 ? "text-rose-600" : ""
                      : t.value > 0 ? "text-emerald-600" : t.value < 0 ? "text-rose-600" : ""
                  }`}>
                    {t.value > 0 ? <ArrowUp className="w-3 h-3" /> : t.value < 0 ? <ArrowDown className="w-3 h-3" /> : null}
                    {t.value !== 0 ? Math.abs(t.value).toFixed(1) : "--"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-md bg-muted/40" data-testid="section-suggested-action">
            <h4 className="text-sm font-semibold mb-1">建議動作</h4>
            <p className="text-sm text-muted-foreground">
              {creative.suggestedAction}
            </p>
            {creative.estimatedImpact && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">預期效益: {creative.estimatedImpact}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
