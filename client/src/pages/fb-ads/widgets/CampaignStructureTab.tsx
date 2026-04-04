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
import { StatusDot } from "@/components/shared/StatusDot";
import { getActionStatus } from "@/components/shared/status-colors";

type StructureFilter = "all" | "active" | "delivered" | "high_spend" | "high_risk";

const structureFilterLabels: Record<StructureFilter, string> = {
  all: "全部",
  active: "啟用中",
  delivered: "已投放",
  high_spend: "高花費",
  high_risk: "高風險",
};

const structureLevelLabels: Record<string, string> = {
  campaign: "廣告活動",
  adset: "廣告組",
  ad: "廣告",
};

export type CampaignStructureTabMetaGate = {
  onRequestPause?: (campaignId: string) => void;
  onRequestResume?: (campaignId: string) => void;
  execBusy?: boolean;
};

export function CampaignStructureTab({
  onRequestPause,
  onRequestResume,
  execBusy = false,
}: CampaignStructureTabMetaGate = {}) {
  const scope = useAppScope();
  const [structLevel, setStructLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [structFilter, setStructFilter] = useState<StructureFilter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: structures, isLoading } = useQuery<FbCampaignStructure[]>({
    queryKey: ["/api/fb-ads/campaign-structure", scope.scopeKey ?? ""],
    queryFn: async () => {
      const url = scope.scopeKey ? `/api/fb-ads/campaign-structure?scope=${encodeURIComponent(scope.scopeKey)}` : "/api/fb-ads/campaign-structure";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const levelItems = useMemo(() => {
    if (!structures) return [];
    return structures.filter((s) => s.level === structLevel);
  }, [structures, structLevel]);

  const hasLevelData = levelItems.length > 0;

  const filtered = useMemo(() => {
    if (!levelItems.length) return [];
    if (structFilter === "all") return levelItems;
    return levelItems.filter((s) => {
      switch (structFilter) {
        case "active":
          return s.aiLabel !== "先停再說" && s.spend > 0;
        case "delivered":
          return s.spend > 0;
        case "high_spend": {
          if (levelItems.length === 0) return false;
          const spends = levelItems.map((item) => item.spend).sort((a, b) => b - a);
          const threshold = spends[Math.floor(spends.length * 0.25)] || 0;
          return s.spend >= threshold;
        }
        case "high_risk":
          return s.riskLevel === "danger" || s.riskLevel === "warning" || (s.scoring && (["roas_critical", "budget_waste", "creative_fatigue", "cpc_spike"].includes(s.scoring.diagnosis)));
        default:
          return true;
      }
    });
  }, [levelItems, structFilter]);

  const getParentName = (parentId?: string) => {
    if (!parentId || !structures) return "";
    const parent = structures.find((s) => s.id === parentId);
    return parent?.name || "";
  };

  const filterCounts = useMemo(() => {
    if (!levelItems.length) return { all: 0, active: 0, delivered: 0, high_spend: 0, high_risk: 0 };
    const spends = levelItems.map((item) => item.spend).sort((a, b) => b - a);
    const spendThreshold = spends[Math.floor(spends.length * 0.25)] || 0;
    return {
      all: levelItems.length,
      active: levelItems.filter((s) => s.aiLabel !== "先停再說" && s.spend > 0).length,
      delivered: levelItems.filter((s) => s.spend > 0).length,
      high_spend: levelItems.filter((s) => s.spend >= spendThreshold).length,
      high_risk: levelItems.filter((s) => s.riskLevel === "danger" || s.riskLevel === "warning" || (s.scoring && ["roas_critical", "budget_waste", "creative_fatigue", "cpc_spike"].includes(s.scoring.diagnosis))).length,
    };
  }, [levelItems]);

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="structure-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }

  const campaignColSpan = 9;
  const nonCampaignColSpan = 9;

  return (
    <div className="space-y-6" data-testid="section-campaign-structure">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={structLevel} onValueChange={(v) => { setStructLevel(v as "campaign" | "adset" | "ad"); setStructFilter("all"); }}>
          <TabsList data-testid="tabs-structure-level">
            <TabsTrigger value="campaign" data-testid="tab-campaign">Campaign</TabsTrigger>
            <TabsTrigger value="adset" data-testid="tab-adset">Ad Set</TabsTrigger>
            <TabsTrigger value="ad" data-testid="tab-ad">Ad</TabsTrigger>
          </TabsList>
        </Tabs>

        {hasLevelData && (
          <div className="flex items-center gap-1 flex-wrap" data-testid="structure-filters">
            {(Object.keys(structureFilterLabels) as StructureFilter[]).map((f) => (
              <Button
                key={f}
                variant={structFilter === f ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-[11px] px-2 gap-1"
                onClick={() => setStructFilter(f)}
                data-testid={`button-structure-filter-${f}`}
              >
                {structureFilterLabels[f]}
                <Badge variant="secondary" className="text-xs px-1 py-0 ml-0.5">{filterCounts[f]}</Badge>
              </Button>
            ))}
          </div>
        )}
      </div>

      {!hasLevelData ? (
        <Card data-testid="card-structure-no-data">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="w-6 h-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium mb-1" data-testid="text-structure-empty-title">
                  {structLevel === "campaign"
                    ? "尚無廣告活動資料"
                    : `此帳號尚未取得${structureLevelLabels[structLevel]}層級數據`}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md" data-testid="text-structure-empty-desc">
                  {structLevel === "campaign"
                    ? "請先選擇廣告帳號並更新資料，系統將自動拉取廣告活動數據。"
                    : structLevel === "adset"
                      ? "目前僅有廣告活動（Campaign）層級的資料。廣告組（Ad Set）層級需要額外的 API 權限與資料同步，請確認帳號已正確綁定後重新更新資料。"
                      : "目前僅有較上層的資料。廣告（Ad）層級需要額外的 API 權限與資料同步，請確認帳號已正確綁定後重新更新資料。"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table data-testid="table-structure">
            {structLevel === "campaign" ? (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[220px]">活動／指標</TableHead>
                    <TableHead>診斷 / 風險</TableHead>
                    <TableHead>判決</TableHead>
                    <TableHead>建議等級</TableHead>
                    <TableHead>AI 標籤</TableHead>
                    <TableHead>機會</TableHead>
                    <TableHead>V2 分數</TableHead>
                    <TableHead className="min-w-[200px]">建議／操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const isExpanded = expandedRows.has(s.id);
                    const actionHint = (s.scoring?.recommendedAction ?? s.aiLabel ?? "").trim();
                    return (
                      <Fragment key={s.id}>
                        <TableRow
                          className="cursor-pointer border-b border-border/50 hover:bg-muted/30 transition-colors"
                          onClick={() => toggleRow(s.id)}
                          data-testid={`row-structure-${s.id}`}
                        >
                          <TableCell className="w-8 align-top">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="min-w-[220px] max-w-xl align-top">
                            <div className="flex items-start gap-3 px-1 py-0.5 min-w-0">
                              <StatusDot
                                semantic={getActionStatus(s.scoring?.recommendedAction ?? s.aiLabel ?? "")}
                                size="md"
                                className="mt-1.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{s.name}</p>
                                <p
                                  className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                                  title={`花費 ${formatCurrency(s.spend)} · ROAS ${s.roas.toFixed(1)} · CTR ${Number(s.ctr).toFixed(1)}% · Freq ${s.frequency.toFixed(1)}`}
                                >
                                  花費 {formatCurrency(s.spend)} · ROAS {s.roas.toFixed(1)} · CTR {Number(s.ctr).toFixed(1)}% ·
                                  Freq {s.frequency.toFixed(1)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.scoring ? (
                                <>
                                  <DiagnosisBadge diagnosis={s.scoring.diagnosis} />
                                  <ActionBadge action={s.scoring.recommendedAction} />
                                </>
                              ) : (
                                <FbRiskLevelBadge level={s.riskLevel} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <ScoreBadge score={s.judgmentScore} label="" />
                          </TableCell>
                          <TableCell className="align-top">
                            <RecommendationLevelBadge level={s.recommendationLevel} />
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant="secondary" className={`${getAiLabelClass(s.aiLabel)} border-transparent`}>
                              {s.aiLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <OpportunityScoreBadge score={s.opportunityScore} />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1.5">
                              {s.scoring ? <V2ScoreMini scoring={s.scoring} /> : <FbTriScoreMini triScore={s.triScore} />}
                            </div>
                          </TableCell>
                          <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                              {actionHint ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs rounded-lg max-w-[160px] truncate"
                                  title={actionHint}
                                >
                                  {actionHint}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              {onRequestPause ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={execBusy}
                                  onClick={() => onRequestPause(s.id)}
                                  data-testid={`button-pause-campaign-${s.id}`}
                                >
                                  <Pause className="w-3 h-3 mr-0.5" />
                                  暫停
                                </Button>
                              ) : null}
                              {onRequestResume ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={execBusy}
                                  onClick={() => onRequestResume(s.id)}
                                  data-testid={`button-resume-campaign-${s.id}`}
                                >
                                  <Rocket className="w-3 h-3 mr-0.5" />
                                  啟動
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${s.id}-expanded`}>
                            <TableCell colSpan={campaignColSpan} className="bg-muted/30">
                              <div className="p-3" data-testid={`expanded-structure-${s.id}`}>
                                <p className="text-sm leading-relaxed">{s.aiComment}</p>
                                {s.scoring && <BenchmarkInfo scoring={s.scoring} />}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {filtered.length === 0 && hasLevelData && (
                    <TableRow>
                      <TableCell colSpan={campaignColSpan} className="text-center py-8" data-testid="text-structure-filter-empty">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            目前篩選條件下沒有符合的{structureLevelLabels[structLevel]}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStructFilter("all")}
                            data-testid="button-clear-structure-filter"
                          >
                            清除篩選
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[220px]">名稱／指標</TableHead>
                    <TableHead>診斷 / 風險</TableHead>
                    <TableHead>判決</TableHead>
                    <TableHead>建議等級</TableHead>
                    <TableHead>AI 標籤</TableHead>
                    <TableHead>機會</TableHead>
                    <TableHead>V2 分數</TableHead>
                    <TableHead className="min-w-[120px]">上層</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const isExpanded = expandedRows.has(s.id);
                    return (
                      <Fragment key={s.id}>
                        <TableRow
                          className="cursor-pointer border-b border-border/50 hover:bg-muted/30 transition-colors"
                          onClick={() => toggleRow(s.id)}
                          data-testid={`row-structure-${s.id}`}
                        >
                          <TableCell className="w-8 align-top">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="min-w-[220px] max-w-xl align-top">
                            <div className="flex items-start gap-3 px-1 py-0.5 min-w-0">
                              <StatusDot
                                semantic={getActionStatus(s.scoring?.recommendedAction ?? s.aiLabel ?? "")}
                                size="sm"
                                className="mt-1.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium line-clamp-2 leading-snug">{s.name}</p>
                                <p
                                  className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                                  title={`花費 ${formatCurrency(s.spend)} · ROAS ${s.roas.toFixed(1)} · CTR ${Number(s.ctr).toFixed(1)}% · Freq ${s.frequency.toFixed(1)} · 轉換 ${s.conversions}`}
                                >
                                  花費 {formatCurrency(s.spend)} · ROAS {s.roas.toFixed(1)} · CTR {Number(s.ctr).toFixed(1)}% ·
                                  Freq {s.frequency.toFixed(1)} · 轉換 {s.conversions}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.scoring ? (
                                <>
                                  <DiagnosisBadge diagnosis={s.scoring.diagnosis} />
                                  <ActionBadge action={s.scoring.recommendedAction} />
                                </>
                              ) : (
                                <FbRiskLevelBadge level={s.riskLevel} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <ScoreBadge score={s.judgmentScore} label="" />
                          </TableCell>
                          <TableCell className="align-top">
                            <RecommendationLevelBadge level={s.recommendationLevel} />
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className={`${getAiLabelClass(s.aiLabel)} border-transparent text-[11px]`}>
                              {s.aiLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <OpportunityScoreBadge score={s.opportunityScore} />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-1.5">
                              {s.scoring ? <V2ScoreMini scoring={s.scoring} /> : <FbTriScoreMini triScore={s.triScore} />}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-muted-foreground text-xs">
                            <span className="line-clamp-2">{getParentName(s.parentId)}</span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${s.id}-expanded`}>
                            <TableCell colSpan={nonCampaignColSpan} className="bg-muted/30">
                              <div className="p-3" data-testid={`expanded-structure-${s.id}`}>
                                <p className="text-sm leading-relaxed">{s.aiComment}</p>
                                {s.scoring && <BenchmarkInfo scoring={s.scoring} />}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {filtered.length === 0 && hasLevelData && (
                    <TableRow>
                      <TableCell colSpan={nonCampaignColSpan} className="text-center py-8" data-testid="text-structure-filter-empty">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            目前篩選條件下沒有符合的{structureLevelLabels[structLevel]}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStructFilter("all")}
                            data-testid="button-clear-structure-filter"
                          >
                            清除篩選
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </>
            )}
          </Table>
        </div>
      )}
    </div>
  );
}
