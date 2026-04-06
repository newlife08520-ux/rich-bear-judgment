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
  ImageOff,
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
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DormantGemCandidateItem } from "@/pages/dashboard/dashboard-types";
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
import type { ParetoResult } from "@shared/pareto-engine";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/shared/StatusDot";
import { getActionStatus } from "@/components/shared/status-colors";

function dormantRevivalScore(c: FbAdCreative, candidates: DormantGemCandidateItem[] | undefined): number {
  if (!candidates?.length) return 0;
  const camp = (c.campaign ?? "").trim().toLowerCase();
  let best = 0;
  for (const d of candidates) {
    const cn = (d.campaignName ?? "").trim().toLowerCase();
    if (!cn) continue;
    if (camp === cn || camp.includes(cn) || cn.includes(camp)) {
      best = Math.max(best, d.revivalPriorityScore ?? 1);
    }
  }
  return best;
}

function guessProductForPareto(c: FbAdCreative, productLevelNames: string[]): string | null {
  const parsed = c.parsedProductName?.trim();
  if (parsed) return parsed;
  const blob = `${c.name} ${c.adName} ${c.campaign}`.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const n of productLevelNames) {
    const ln = n.toLowerCase();
    if (ln && blob.includes(ln) && n.length > bestLen) {
      best = n;
      bestLen = n.length;
    }
  }
  return best;
}

function paretoBadgesForCreative(
  c: FbAdCreative,
  pareto: ParetoResult | undefined | null,
  productLevelNames: string[]
): { top20: boolean; hiddenDiamond: boolean; moneyPit: boolean } {
  if (!pareto) return { top20: false, hiddenDiamond: false, moneyPit: false };
  const id = guessProductForPareto(c, productLevelNames);
  if (!id) return { top20: false, hiddenDiamond: false, moneyPit: false };
  return {
    top20: pareto.top20PctIds.includes(id),
    hiddenDiamond: pareto.hiddenDiamondCandidates.includes(id),
    moneyPit: pareto.bottom20PctIds.includes(id) || pareto.dragCandidates.includes(id),
  };
}

export function CreativeTable({
  creatives,
  isLoading,
  onViewDetail,
  dormantGemCandidates,
  pareto,
  productLevelNames = [],
}: {
  creatives?: FbAdCreative[];
  isLoading: boolean;
  onViewDetail: (c: FbAdCreative) => void;
  /** Batch 12.4：與 action-center 同批沉睡候選，供主表排序／標記 */
  dormantGemCandidates?: DormantGemCandidateItem[];
  pareto?: ParetoResult | null;
  productLevelNames?: string[];
}) {
  const dormant = dormantGemCandidates ?? [];
  const [sortField, setSortField] = useState<SortField>("dormant_revival");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = useMemo(() => {
    if (!creatives) return [];
    return [...creatives].sort((a, b) => {
      if (sortField === "dormant_revival") {
        const da = dormantRevivalScore(a, dormant);
        const db = dormantRevivalScore(b, dormant);
        if (da !== db) return sortDir === "desc" ? db - da : da - db;
        return sortDir === "desc" ? b.spend - a.spend : a.spend - b.spend;
      }
      const av = a[sortField];
      const bv = b[sortField];
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [creatives, sortField, sortDir, dormant]);

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="creative-table-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 cursor-pointer"
      data-testid={`sort-${field}`}
    >
      {label}
      {sortField === field ? (
        sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  return (
    <div data-testid="fbads-creative-table-dormant-v6">
    <div className="table-scroll-container" data-testid="fbads-creative-table-dormant-v4">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-xs text-muted-foreground" data-testid="creative-table-sort-toolbar">
      <span className="font-medium text-foreground">排序：</span>
      <SortButton field="dormant_revival" label="沉睡" />
      <SortButton field="roas" label="ROAS" />
      <SortButton field="spend" label="花費" />
      <SortButton field="ctr" label="CTR" />
      <SortButton field="frequency" label="頻率" />
      <SortButton field="judgmentScore" label="判決" />
      <SortButton field="opportunityScore" label="機會" />
    </div>
    <Table data-testid="table-creatives">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead className="min-w-[200px]">素材／指標</TableHead>
          <TableHead>
            <SortButton field="dormant_revival" label="沉睡" />
          </TableHead>
          <TableHead><SortButton field="judgmentScore" label="判決" /></TableHead>
          <TableHead>建議等級</TableHead>
          <TableHead>AI 標籤</TableHead>
          <TableHead><SortButton field="opportunityScore" label="機會" /></TableHead>
          <TableHead>活動 / 廣告組</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead className="w-[140px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((c) => {
          const isExpanded = expandedRows.has(c.id);
          const dScore = dormantRevivalScore(c, dormant);
          const pb = paretoBadgesForCreative(c, pareto ?? null, productLevelNames);
          return (
            <Fragment key={c.id}>
              <TableRow
                className="cursor-pointer border-b border-border/50 hover:bg-muted/30 transition-colors"
                onClick={() => toggleRow(c.id)}
                data-testid={`row-creative-${c.id}`}
              >
                <TableCell className="w-8 align-top">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium min-w-[200px] align-top" data-testid={`text-creative-name-${c.id}`}>
                  <div className="flex items-start gap-3 min-w-0 px-1 py-0.5">
                    {!c.thumbnail?.trim() ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="shrink-0 pt-1 text-muted-foreground cursor-help" tabIndex={0}>
                            <ImageOff className="w-4 h-4" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs">
                          無縮圖
                          {c.parsedProductName ? ` · 名稱解析：${c.parsedProductName}` : ""}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    <StatusDot semantic={getActionStatus(c.suggestedAction || c.aiLabel || "")} size="md" className="mt-1.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="line-clamp-2 text-sm font-medium leading-snug block">{c.name}</span>
                      <p
                        className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
                        title={`花費 ${formatCurrency(c.spend)} · ROAS ${c.roas.toFixed(2)} · CTR ${Number(c.ctr).toFixed(2)}% · Freq ${c.frequency.toFixed(1)}`}
                        data-testid={`text-creative-metrics-${c.id}`}
                      >
                        花費 {formatCurrency(c.spend)} · ROAS {c.roas.toFixed(2)} · CTR {Number(c.ctr).toFixed(2)}% · Freq{" "}
                        {c.frequency.toFixed(1)}
                      </p>
                      {pb.top20 || pb.hiddenDiamond || pb.moneyPit ? (
                        <div className="flex flex-wrap gap-1" data-testid={`pareto-badges-${c.id}`}>
                          {pb.top20 ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] h-5 border-[var(--status-profit-light)] text-[var(--status-profit)]"
                            >
                              Top20
                            </Badge>
                          ) : null}
                          {pb.hiddenDiamond ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] h-5 border-[var(--status-dormant-light)] text-[var(--status-dormant)]"
                            >
                              Hidden
                            </Badge>
                          ) : null}
                          {pb.moneyPit ? (
                            <Badge variant="outline" className="text-[11px] h-5 border-[var(--status-loss-light)] text-[var(--status-loss)]">
                              Pit
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs align-top">
                  {dScore > 0 ? (
                    <div className="space-y-1" data-testid={`dormant-revival-cell-${c.id}`}>
                      <Badge variant="outline" className="text-xs border-indigo-400 text-indigo-800 dark:text-indigo-200">
                        沉睡 {dScore}
                      </Badge>
                      <div>
                        <Button variant="ghost" className="h-auto p-0 text-xs text-primary underline-offset-2 hover:underline" asChild data-testid={`dormant-revival-action-${c.id}`}>
                          <Link href="/tasks">復活任務</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="align-top" data-testid={`text-judgment-score-${c.id}`}>
                  <ScoreBadge score={c.judgmentScore} label="" />
                </TableCell>
                <TableCell className="align-top">
                  <RecommendationLevelBadge level={c.recommendationLevel} />
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className={getAiLabelClass(c.aiLabel)} data-testid={`badge-label-${c.id}`}>
                    {c.aiLabel}
                  </Badge>
                </TableCell>
                <TableCell className="align-top" data-testid={`text-opportunity-score-${c.id}`}>
                  <OpportunityScoreBadge score={c.opportunityScore} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[160px] align-top">
                  <span className="line-clamp-2">{c.campaign} / {c.adSet}</span>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className={statusColors[c.status] || ""} data-testid={`badge-status-${c.id}`}>
                    {statusLabels[c.status] || c.status}
                  </Badge>
                </TableCell>
                <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {c.suggestedAction?.trim() ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs rounded-lg w-full truncate"
                        title={c.suggestedAction}
                        onClick={() => onViewDetail(c)}
                        data-testid={`button-suggested-action-${c.id}`}
                      >
                        {c.suggestedAction}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-lg w-full"
                      onClick={() => onViewDetail(c)}
                      data-testid={`button-row-detail-${c.id}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      詳情
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${c.id}-expanded`}>
                  <TableCell colSpan={10} className="bg-muted/30">
                    <div className="p-3 space-y-2" data-testid={`expanded-creative-${c.id}`}>
                      <p className="text-sm leading-relaxed">{c.aiComment}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          建議動作: <span className="font-medium text-foreground">{c.suggestedAction}</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetail(c);
                        }}
                        data-testid={`button-detail-${c.id}`}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        查看詳情
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
              沒有符合條件的素材
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>
    </div>
  );
}
