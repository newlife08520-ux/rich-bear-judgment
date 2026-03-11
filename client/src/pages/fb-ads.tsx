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

const aiLabelColors: Record<string, string> = {
  "主力候選": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "高潛力未放大": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "已疲勞": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "先停再說": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "會騙點不會轉": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "再行銷限定": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "冷流量不適合": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "建議重做前3秒": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "CTA太弱": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "CTA 太弱": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "角度太普通": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const statusLabels: Record<string, string> = {
  active: "投放中",
  paused: "已暫停",
  ended: "已結束",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  paused: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};


function formatCurrency(v: number): string {
  return `NT$ ${v.toLocaleString()}`;
}

function formatKPIValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "decimal":
      return value.toFixed(2);
    case "number":
      return value.toLocaleString();
    default:
      return value.toString();
  }
}

function getAiLabelClass(label: string): string {
  return aiLabelColors[label] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}


type SortField = "spend" | "ctr" | "cpc" | "cpm" | "roas" | "frequency" | "judgmentScore" | "opportunityScore";
type SortDir = "asc" | "desc";

type AccountFilter = "all" | "active" | "favorites";

const metaAccountStatusColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800",
  2: "bg-red-100 text-red-800",
  3: "bg-orange-100 text-orange-800",
  7: "bg-yellow-100 text-yellow-800",
  100: "bg-gray-100 text-gray-700",
};

function AccountManagerPanel({
  selectedAccountIds,
  onSelectionChange,
}: {
  selectedAccountIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const { data: metaResponse, isLoading, refetch, isFetching } = useQuery<MetaAccountsResponse>({
    queryKey: ["/api/fb-ads/meta-accounts"],
  });

  const favoriteMutation = useMutation({
    mutationFn: async (accountIds: string[]) => {
      await apiRequest("POST", "/api/fb-ads/favorite-accounts", { accountIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/meta-accounts"] });
    },
  });

  const accounts = metaResponse?.accounts || [];

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (accountFilter === "active") {
      result = result.filter((a) => a.accountStatus === 1);
    } else if (accountFilter === "favorites") {
      result = result.filter((a) => a.isFavorite);
    }
    if (accountSearch.trim()) {
      const q = accountSearch.toLowerCase();
      result = result.filter(
        (a) => a.name.toLowerCase().includes(q) || a.accountId.includes(q)
      );
    }
    return result;
  }, [accounts, accountFilter, accountSearch]);

  const toggleSelect = useCallback((accountId: string) => {
    onSelectionChange(
      selectedAccountIds.includes(accountId)
        ? selectedAccountIds.filter((id) => id !== accountId)
        : [...selectedAccountIds, accountId]
    );
  }, [selectedAccountIds, onSelectionChange]);

  const toggleFavorite = useCallback((accountId: string) => {
    const currentFavs = accounts.filter((a) => a.isFavorite).map((a) => a.accountId);
    const newFavs = currentFavs.includes(accountId)
      ? currentFavs.filter((id) => id !== accountId)
      : [...currentFavs, accountId];
    favoriteMutation.mutate(newFavs);
  }, [accounts, favoriteMutation]);

  const selectAll = useCallback(() => {
    onSelectionChange(filteredAccounts.map((a) => a.accountId));
  }, [filteredAccounts, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const selectedNames = accounts
    .filter((a) => selectedAccountIds.includes(a.accountId))
    .map((a) => a.name);

  const activeCount = accounts.filter((a) => a.accountStatus === 1).length;
  const favCount = accounts.filter((a) => a.isFavorite).length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2" data-testid="account-manager-loading">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">載入廣告帳號中...</span>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-2" data-testid="account-manager-empty">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{metaResponse?.message || "無可用廣告帳號"}</span>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2 gap-1" data-testid="button-refresh-accounts">
          <RefreshCw className="w-3.5 h-3.5" />
          重新取得
        </Button>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative" data-testid="account-manager-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-1.5 h-8"
          data-testid="button-toggle-account-panel"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className="text-xs">
            {selectedAccountIds.length > 0
              ? `已選 ${selectedAccountIds.length} 個帳號`
              : "選擇廣告帳號"}
          </span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
            {accounts.length}
          </Badge>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>

        {selectedNames.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedNames.slice(0, 3).map((name) => (
              <Badge key={name} variant="secondary" className="text-[11px] px-2 py-0.5 gap-1" data-testid={`chip-account-${name}`}>
                {name}
                <button
                  type="button"
                  onClick={() => {
                    const acct = accounts.find((a) => a.name === name);
                    if (acct) toggleSelect(acct.accountId);
                  }}
                  className="ml-0.5"
                  data-testid={`button-remove-chip-${name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {selectedNames.length > 3 && (
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                +{selectedNames.length - 3}
              </Badge>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2 gap-1 ml-auto"
          data-testid="button-refresh-accounts"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isExpanded && (
        <Card className="absolute top-full left-0 mt-1 z-50 w-[560px] max-h-[420px] shadow-lg" data-testid="card-account-dropdown">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜尋帳號名稱或 ID..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="pl-7 h-8 text-xs"
                  data-testid="input-account-search"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={accountFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => setAccountFilter("all")}
                  data-testid="button-filter-all"
                >
                  全部 ({accounts.length})
                </Button>
                <Button
                  variant={accountFilter === "active" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => setAccountFilter("active")}
                  data-testid="button-filter-active"
                >
                  投放中 ({activeCount})
                </Button>
                <Button
                  variant={accountFilter === "favorites" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => setAccountFilter("favorites")}
                  data-testid="button-filter-favorites"
                >
                  <Star className="w-3 h-3 mr-0.5" />
                  ({favCount})
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={selectAll} data-testid="button-select-all">
                <Check className="w-3 h-3 mr-0.5" />
                全選
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={clearAll} data-testid="button-clear-all">
                清除
              </Button>
              <span className="text-[11px] text-muted-foreground ml-auto">
                已選 {selectedAccountIds.length} / {filteredAccounts.length}
              </span>
            </div>

            <div className="table-scroll-container max-h-[280px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-8 px-2"></TableHead>
                    <TableHead className="w-8 px-1"></TableHead>
                    <TableHead className="px-2">帳號名稱</TableHead>
                    <TableHead className="px-2 w-[100px]">帳號 ID</TableHead>
                    <TableHead className="px-2 w-[70px]">狀態</TableHead>
                    <TableHead className="px-2 w-[60px]">幣別</TableHead>
                    <TableHead className="px-2 w-[120px]">時區</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        {accountSearch ? "無符合搜尋條件的帳號" : "無帳號資料"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((acct) => (
                      <TableRow
                        key={acct.accountId}
                        className={`cursor-pointer text-[12px] ${selectedAccountIds.includes(acct.accountId) ? "bg-primary/5" : ""}`}
                        onClick={() => toggleSelect(acct.accountId)}
                        data-testid={`row-account-${acct.accountId}`}
                      >
                        <TableCell className="px-2">
                          <Checkbox
                            checked={selectedAccountIds.includes(acct.accountId)}
                            onCheckedChange={() => toggleSelect(acct.accountId)}
                            data-testid={`checkbox-account-${acct.accountId}`}
                          />
                        </TableCell>
                        <TableCell className="px-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(acct.accountId);
                            }}
                            data-testid={`button-star-account-${acct.accountId}`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 transition-colors ${acct.isFavorite ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                            />
                          </button>
                        </TableCell>
                        <TableCell className="px-2 font-medium truncate max-w-[160px]" title={acct.name}>
                          {acct.name}
                        </TableCell>
                        <TableCell className="px-2 text-muted-foreground font-mono text-[11px]">
                          {acct.accountId}
                        </TableCell>
                        <TableCell className="px-2">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${metaAccountStatusColors[acct.accountStatus] || "bg-gray-100 text-gray-700"}`}
                          >
                            {acct.accountStatusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 text-muted-foreground">
                          {acct.currency}
                        </TableCell>
                        <TableCell className="px-2 text-muted-foreground text-[11px] truncate max-w-[120px]" title={acct.timezoneName}>
                          {acct.timezoneName}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


const riskLevelConfig: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  danger: { bg: "bg-red-100", text: "text-red-700", label: "危險" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", label: "警告" },
  watch: { bg: "bg-yellow-100", text: "text-yellow-700", label: "觀察" },
  stable: { bg: "bg-green-100", text: "text-green-700", label: "穩定" },
  potential: { bg: "bg-blue-100", text: "text-blue-700", label: "潛力" },
};

function FbRiskLevelBadge({ level }: { level?: RiskLevel }) {
  if (!level) return null;
  const config = riskLevelConfig[level];
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 border-transparent ${config.bg} ${config.text}`} data-testid={`badge-risk-${level}`}>
      {config.label}
    </Badge>
  );
}

function FbTriScoreMini({ triScore }: { triScore?: TriScore }) {
  if (!triScore) return null;
  const items = [
    { label: "健康", value: triScore.health, color: "bg-emerald-500" },
    { label: "急迫", value: triScore.urgency, color: "bg-amber-500" },
    { label: "潛力", value: triScore.scalePotential, color: "bg-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1.5" data-testid="tri-score-mini">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-0.5" title={`${item.label}: ${item.value}`}>
          <div className="w-1.5 h-4 rounded-sm bg-muted overflow-hidden flex flex-col-reverse">
            <div className={`w-full rounded-sm ${item.color}`} style={{ height: `${item.value}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function OpportunityBoardSection() {
  const { data: oppData, isLoading } = useQuery<{ opportunities: OpportunityCandidate[] }>({
    queryKey: ["/api/fb-ads/opportunities"],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-opportunity-board">
        <CardContent className="p-5">
          <Skeleton className="w-48 h-5 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const opportunities = oppData?.opportunities || [];
  if (opportunities.length === 0) return null;

  const grouped: Record<string, { typeLabel: string; items: OpportunityCandidate[] }> = {};
  for (const opp of opportunities) {
    if (!grouped[opp.type]) {
      grouped[opp.type] = { typeLabel: opp.typeLabel, items: [] };
    }
    grouped[opp.type].items.push(opp);
  }

  const typeIcons: Record<string, typeof Target> = {
    low_spend_high_efficiency: Target,
    stable_scalable: TrendingUp,
    new_potential: Rocket,
    restartable: RefreshCw,
  };

  return (
    <Card data-testid="card-opportunity-board">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold" data-testid="text-opportunity-board-title">機會看板</h3>
          <Badge variant="secondary" className="text-xs ml-auto">{opportunities.length} 個機會</Badge>
        </div>

        {Object.entries(grouped).map(([type, group]) => {
          const Icon = typeIcons[type] || Target;
          return (
            <div key={type} className="mb-5 last:mb-0" data-testid={`section-opp-type-${type}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground">{group.typeLabel}</h4>
                <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((opp) => (
                  <Card key={`${opp.campaignId}-${opp.type}`} data-testid={`card-opp-${opp.campaignId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate max-w-[220px]" data-testid={`text-opp-campaign-${opp.campaignId}`}>{opp.campaignName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{opp.accountName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {opp.scoring ? <DiagnosisBadge diagnosis={opp.scoring.diagnosis} /> : <FbRiskLevelBadge level={opp.riskLevel} />}
                        </div>
                      </div>

                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        {opp.scoring ? (
                          <>
                            <V2ScoreMini scoring={opp.scoring} />
                            <ActionBadge action={opp.scoring.recommendedAction} />
                          </>
                        ) : (
                          <FbTriScoreMini triScore={opp.triScore} />
                        )}
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>放大潛力</span>
                          <span className="font-medium">{opp.estimatedScalePotential}</span>
                        </div>
                        <Progress value={opp.estimatedScalePotential} className="h-1.5" data-testid={`progress-scale-${opp.campaignId}`} />
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap" data-testid={`metrics-opp-${opp.campaignId}`}>
                        <span>花費 {formatCurrency(opp.spend)}</span>
                        <span>ROAS {opp.roas.toFixed(2)}</span>
                        <span>CTR {Number(opp.ctr).toFixed(2)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StopLossSection() {
  const { data: scoredData, isLoading } = useQuery<{ campaigns: CampaignMetrics[] }>({
    queryKey: ["/api/fb-ads/campaigns-scored"],
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

function DirectorSummarySection({ data, isLoading }: { data?: FbAIDirectorSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card data-testid="card-director-summary">
        <CardContent className="p-5">
          <Skeleton className="w-40 h-5 mb-4" />
          <Skeleton className="w-full h-16 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card data-testid="card-director-summary">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="section-title text-muted-foreground">AI 總監怎麼看</h2>
        </div>
        <p className="text-lg font-bold leading-relaxed mb-4" data-testid="text-director-verdict">
          {data.verdict}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-muted/40" data-testid="card-top-action">
            <p className="text-xs font-semibold text-muted-foreground mb-1">最優先行動</p>
            <p className="text-sm leading-relaxed">{data.topAction}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/40" data-testid="card-biggest-waste">
            <p className="text-xs font-semibold text-muted-foreground mb-1">最大浪費</p>
            <p className="text-sm leading-relaxed">{data.biggestWaste}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/40 md:col-span-2" data-testid="card-best-direction">
            <p className="text-xs font-semibold text-muted-foreground mb-1">最佳方向</p>
            <p className="text-sm leading-relaxed">{data.bestDirection}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OperationalSummarySection({ data, isLoading }: { data?: FbAccountOverview; isLoading: boolean }) {
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

function HighRiskAccountsSection() {
  const { data: risks, isLoading } = useQuery<HighRiskItem[]>({
    queryKey: ["/api/fb-ads/high-risk"],
  });

  if (isLoading) {
    return (
      <div data-testid="high-risk-skeleton">
        <Skeleton className="w-40 h-5 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!risks || risks.length === 0) return null;

  return (
    <div data-testid="section-high-risk-accounts">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-red-500" />
        <h3 className="section-title">這些帳號需要多留意</h3>
        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 border-transparent">
          {risks.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {risks.map((item) => (
          <Card key={item.id} data-testid={`card-high-risk-${item.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm" data-testid={`text-risk-name-${item.id}`}>{item.name}</p>
                  <SeverityBadge severity={item.severity} />
                </div>
                <OpportunityScoreBadge score={item.opportunityScore} size="md" />
              </div>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {item.problemTags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`text-risk-verdict-${item.id}`}>
                {item.aiVerdict}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KPISection({ data, isLoading }: { data?: FbAccountOverview; isLoading: boolean }) {
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

function CreativeOpportunityBoard({ creatives, isLoading }: { creatives?: FbAdCreative[]; isLoading: boolean }) {
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
        <TrendingUp className="w-4 h-4 text-blue-500" />
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
                <Badge variant="secondary" className={`${getAiLabelClass(c.aiLabel)} border-transparent`}>
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

function CreativeTable({
  creatives,
  isLoading,
  onViewDetail,
}: {
  creatives?: FbAdCreative[];
  isLoading: boolean;
  onViewDetail: (c: FbAdCreative) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("spend");
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
      const av = a[sortField];
      const bv = b[sortField];
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [creatives, sortField, sortDir]);

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
    <div className="table-scroll-container">
    <Table data-testid="table-creatives">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead className="min-w-[180px]">素材名稱</TableHead>
          <TableHead><SortButton field="roas" label="ROAS" /></TableHead>
          <TableHead><SortButton field="spend" label="花費" /></TableHead>
          <TableHead><SortButton field="ctr" label="CTR" /></TableHead>
          <TableHead><SortButton field="judgmentScore" label="判決" /></TableHead>
          <TableHead>建議等級</TableHead>
          <TableHead>AI 標籤</TableHead>
          <TableHead><SortButton field="frequency" label="頻率" /></TableHead>
          <TableHead><SortButton field="opportunityScore" label="機會" /></TableHead>
          <TableHead>活動 / 廣告組</TableHead>
          <TableHead>狀態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((c) => {
          const isExpanded = expandedRows.has(c.id);
          return (
            <Fragment key={c.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => toggleRow(c.id)}
                data-testid={`row-creative-${c.id}`}
              >
                <TableCell className="w-8">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium min-w-[180px]" data-testid={`text-creative-name-${c.id}`}>
                  <span className="line-clamp-2 text-sm leading-snug">{c.name}</span>
                </TableCell>
                <TableCell className="font-semibold" data-testid={`text-roas-${c.id}`}>{c.roas.toFixed(2)}</TableCell>
                <TableCell data-testid={`text-spend-${c.id}`}>{formatCurrency(c.spend)}</TableCell>
                <TableCell>{Number(c.ctr).toFixed(2)}%</TableCell>
                <TableCell data-testid={`text-judgment-score-${c.id}`}>
                  <ScoreBadge score={c.judgmentScore} label="" />
                </TableCell>
                <TableCell>
                  <RecommendationLevelBadge level={c.recommendationLevel} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`${getAiLabelClass(c.aiLabel)} border-transparent`} data-testid={`badge-label-${c.id}`}>
                    {c.aiLabel}
                  </Badge>
                </TableCell>
                <TableCell>{c.frequency.toFixed(1)}</TableCell>
                <TableCell data-testid={`text-opportunity-score-${c.id}`}>
                  <OpportunityScoreBadge score={c.opportunityScore} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[160px]">
                  <span className="line-clamp-2">{c.campaign} / {c.adSet}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`${statusColors[c.status] || ""} border-transparent`} data-testid={`badge-status-${c.id}`}>
                    {statusLabels[c.status] || c.status}
                  </Badge>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${c.id}-expanded`}>
                  <TableCell colSpan={12} className="bg-muted/30">
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
            <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
              沒有符合條件的素材
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>
  );
}

function BuriedGemsSection({ isLoading }: { isLoading: boolean }) {
  const { data: gems, isLoading: gemsLoading } = useQuery<FbAdCreative[]>({
    queryKey: ["/api/fb-ads/buried-gems"],
  });

  const loading = isLoading || gemsLoading;

  if (loading) {
    return (
      <div className="space-y-3" data-testid="buried-gems-skeleton">
        <Skeleton className="w-32 h-5" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    );
  }

  if (!gems || gems.length === 0) return null;

  return (
    <div data-testid="section-buried-gems">
      <h4 className="section-title mb-3">還沒被看見的好素材</h4>
      <div className="space-y-3">
        {gems.map((g) => (
          <Card key={g.id} data-testid={`card-gem-${g.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <p className="font-medium text-sm">{g.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <RecommendationLevelBadge level={g.recommendationLevel} />
                  <OpportunityScoreBadge score={g.opportunityScore} size="md" />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
                <span>花費: {formatCurrency(g.spend)}</span>
                <span>CTR: {Number(g.ctr).toFixed(2)}%</span>
                <span>ROAS: {g.roas.toFixed(2)}</span>
                <span>判決: {g.judgmentScore}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{g.aiComment}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StopListSection({ isLoading }: { isLoading: boolean }) {
  const { data: stops, isLoading: stopsLoading } = useQuery<FbAdCreative[]>({
    queryKey: ["/api/fb-ads/stop-list"],
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

function CampaignStructureTab() {
  const [structLevel, setStructLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [structFilter, setStructFilter] = useState<StructureFilter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: structures, isLoading } = useQuery<FbCampaignStructure[]>({
    queryKey: ["/api/fb-ads/campaign-structure"],
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

  const baseColSpan = structLevel !== "campaign" ? 15 : 14;

  return (
    <div className="space-y-4" data-testid="section-campaign-structure">
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
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{filterCounts[f]}</Badge>
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
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[180px]">名稱</TableHead>
                <TableHead>ROAS</TableHead>
                <TableHead>花費</TableHead>
                <TableHead>診斷 / 風險</TableHead>
                <TableHead>判決</TableHead>
                <TableHead>建議等級</TableHead>
                <TableHead>AI 標籤</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>頻率</TableHead>
                <TableHead>轉換</TableHead>
                <TableHead>機會</TableHead>
                <TableHead>V2 分數</TableHead>
                {structLevel !== "campaign" && <TableHead>上層</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const isExpanded = expandedRows.has(s.id);
                return (
                  <Fragment key={s.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleRow(s.id)}
                      data-testid={`row-structure-${s.id}`}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium min-w-[180px]">
                        <span className="line-clamp-2 text-sm leading-snug">{s.name}</span>
                      </TableCell>
                      <TableCell className="font-semibold">{s.roas.toFixed(2)}</TableCell>
                      <TableCell>{formatCurrency(s.spend)}</TableCell>
                      <TableCell>
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
                      <TableCell>
                        <ScoreBadge score={s.judgmentScore} label="" />
                      </TableCell>
                      <TableCell>
                        <RecommendationLevelBadge level={s.recommendationLevel} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${getAiLabelClass(s.aiLabel)} border-transparent`}>
                          {s.aiLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>{Number(s.ctr).toFixed(2)}%</TableCell>
                      <TableCell>{s.frequency.toFixed(1)}</TableCell>
                      <TableCell>{s.conversions}</TableCell>
                      <TableCell>
                        <OpportunityScoreBadge score={s.opportunityScore} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {s.scoring ? <V2ScoreMini scoring={s.scoring} /> : <FbTriScoreMini triScore={s.triScore} />}
                        </div>
                      </TableCell>
                      {structLevel !== "campaign" && (
                        <TableCell className="text-muted-foreground text-xs">
                          <span className="line-clamp-2">{getParentName(s.parentId)}</span>
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${s.id}-expanded`}>
                        <TableCell colSpan={baseColSpan} className="bg-muted/30">
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
                  <TableCell colSpan={baseColSpan} className="text-center py-8" data-testid="text-structure-filter-empty">
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
          </Table>
        </div>
      )}
    </div>
  );
}

function BudgetRecommendationsTab() {
  const { data: recs, isLoading } = useQuery<FbBudgetRecommendation[]>({
    queryKey: ["/api/fb-ads/budget-recommendations"],
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
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AlertsTab() {
  const { data: alerts, isLoading } = useQuery<FbAlert[]>({
    queryKey: ["/api/fb-ads/alerts"],
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
            <AlertTriangle className="w-4 h-4 text-red-500" />
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

function CreativeDetailDialog({
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
            <Badge variant="secondary" className={`${getAiLabelClass(creative.aiLabel)} border-transparent`}>
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
                      ? t.value < 0 ? "text-emerald-600" : t.value > 0 ? "text-red-600" : ""
                      : t.value > 0 ? "text-emerald-600" : t.value < 0 ? "text-red-600" : ""
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

export default function FbAdsPage() {
  const scope = useAppScope();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("creatives");
  const [detailCreative, setDetailCreative] = useState<FbAdCreative | null>(null);
  const { toast } = useToast();

  const { data: refreshStatusData } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
    refetchInterval: (query) => {
      const data = query.state.data as RefreshStatus | undefined;
      return data?.isRefreshing ? 2000 : false;
    },
  });

  const syncSelectedToBackend = useMutation({
    mutationFn: async (accountIds: string[]) => {
      const res = await apiRequest("POST", "/api/accounts/sync-selected", { platform: "meta", accountIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/synced"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (scope.selectedAccountIds.length > 0) {
        await syncSelectedToBackend.mutateAsync(scope.selectedAccountIds);
      }
      const body = scope.buildRefreshBody();
      const res = await apiRequest("POST", "/api/refresh", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refresh/status"] });
    },
    onError: (err: any) => {
      toast({ title: "資料更新失敗", description: err.message || "請稍後再試", variant: "destructive" });
    },
  });

  const isRefreshing = refreshMutation.isPending || syncSelectedToBackend.isPending || refreshStatusData?.isRefreshing;

  const wasRefreshingRef = useRef(false);
  useEffect(() => {
    if (wasRefreshingRef.current && !refreshStatusData?.isRefreshing) {
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/creatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/director-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/buried-gems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/stop-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/campaign-structure"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/budget-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/high-risk"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/meta-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fb-ads/campaigns-scored"] });
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "Meta 廣告數據已重新分析" });
      }
    }
    wasRefreshingRef.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing]);

  const { data: directorSummary, isLoading: directorLoading } = useQuery<FbAIDirectorSummary>({
    queryKey: ["/api/fb-ads/director-summary"],
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<FbAccountOverview>({
    queryKey: ["/api/fb-ads/overview"],
  });

  const { data: creatives, isLoading: creativesLoading } = useQuery<FbAdCreative[]>({
    queryKey: ["/api/fb-ads/creatives", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/fb-ads/creatives?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch creatives");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <h1 className="page-title" data-testid="text-page-title">
              FB 帳號分析
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={isRefreshing}
              data-testid="button-refresh-fb"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              {isRefreshing ? (refreshStatusData?.currentStep || "更新中...") : "更新資料"}
            </Button>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋素材..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <AccountManagerPanel
            selectedAccountIds={scope.selectedAccountIds}
            onSelectionChange={scope.setSelectedAccounts}
          />
        </div>
      </header>

      <main className="min-h-full p-4 md:p-6 space-y-6 page-container-fluid">
        <OperationalSummarySection data={overview} isLoading={overviewLoading} />

        {!directorLoading && !directorSummary && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">FB 帳號分析 — 使用步驟</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground mb-4">
                <li>在<strong className="text-foreground">設定中心</strong>綁定 FB Access Token（離開欄位會自動儲存），並點「立即同步帳號」。</li>
                <li>在上方選擇要分析的廣告帳號後，點<strong className="text-foreground">「更新資料」</strong>取得廣告與素材數據。</li>
                <li>若仍無資料，請至設定中心檢查 FB 連線與權限。</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings">前往設定中心</a>
              </Button>
            </CardContent>
          </Card>
        )}
        <DirectorSummarySection data={directorSummary} isLoading={directorLoading} />

        <HighRiskAccountsSection />

        <OpportunityBoardSection />

        <StopLossSection />

        <CreativeOpportunityBoard creatives={creatives} isLoading={creativesLoading} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="creatives" data-testid="tab-creatives">素材排行</TabsTrigger>
            <TabsTrigger value="structure" data-testid="tab-structure">結構分析</TabsTrigger>
            <TabsTrigger value="budget" data-testid="tab-budget">預算建議</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">警示與機會</TabsTrigger>
          </TabsList>

          <TabsContent value="creatives">
            <div className="space-y-6">
              <CreativeTable
                creatives={creatives}
                isLoading={creativesLoading}
                onViewDetail={(c) => setDetailCreative(c)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BuriedGemsSection isLoading={creativesLoading} />
                <StopListSection isLoading={creativesLoading} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="structure">
            <CampaignStructureTab />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetRecommendationsTab />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </main>

      <CreativeDetailDialog
        creative={detailCreative}
        open={detailCreative !== null}
        onClose={() => setDetailCreative(null)}
      />
    </div>
  );
}
