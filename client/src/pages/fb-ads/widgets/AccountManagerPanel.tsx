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
import { AccountManagerAccountTable } from "./AccountManagerAccountTable";

export function AccountManagerPanel({
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
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
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

            <AccountManagerAccountTable
              filteredAccounts={filteredAccounts}
              accountSearch={accountSearch}
              selectedAccountIds={selectedAccountIds}
              toggleSelect={toggleSelect}
              toggleFavorite={toggleFavorite}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
