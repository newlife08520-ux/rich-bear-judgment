import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Lightbulb,
  ListOrdered,
  Eye,
  Activity,
  Users,
  Clock,
  Percent,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  BarChart3,
  Gauge,
  Star,
  RefreshCw,
  Loader2,
  Globe,
  FileText,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { dateRangeOptions } from "@shared/schema";
import { ScoreBadge, ScorePill, scoreColor, scoreBgColor, OpportunityScoreBadge, OpportunityBreakdownDisplay } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { SeverityBadge, severityStyles } from "@/components/shared/severity-badge";
import { DateRangeSelector } from "@/components/shared/date-range-selector";
import { AccountSelector } from "@/components/shared/account-selector";
import { V2ScoreMini, V2ScoreBar, DiagnosisBadge, ActionBadge, BenchmarkInfo } from "@/components/shared/v2-scoring";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppScope } from "@/hooks/use-app-scope";
import type {
  GA4PageMetrics,
  GA4PageMetricsDetailed,
  GA4FunnelOverview,
  GA4FunnelSegment,
  FunnelDrillDown,
  GA4DropPoint,
  GA4PageRanking,
  GA4AIDirectorSummary,
  GA4PriorityFix,
  HighRiskItem,
  RecommendationLevel,
  RefreshStatus,
  PageGroup,
  TriScore,
  RiskLevel,
  ScoringResult,
  PageRecommendation,
} from "@shared/schema";

const aiLabelColors: Record<string, string> = {
  "最值得放量": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "流量有但接不住": "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "首屏太弱": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  "說服力不足": "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "加購意圖低": "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  "checkout阻力高": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  "可當模板": "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "先修再投": "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  "結帳前掉最兇": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  "不適合導購": "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};


const recommendationPageLabels: Record<string, string> = {
  add_traffic: "加流量",
  fix_first: "先修頁面",
  use_as_template: "可當模板",
  monitor: "持續觀察",
};

const recommendationPageColors: Record<string, string> = {
  add_traffic: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  fix_first: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  use_as_template: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  monitor: "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const pageGroupLabels: Record<PageGroup, string> = {
  products: "商品頁",
  collections: "集合頁",
  pages: "一般頁面",
  blogs: "文章頁",
  cart: "購物車",
  checkout: "結帳",
  homepage: "首頁",
  other: "其他",
};

type AssetView = "official_site" | "single_page" | "full_site";

const assetViewConfig: Record<AssetView, { label: string; icon: typeof Globe; description: string }> = {
  official_site: { label: "官網", icon: Globe, description: "多頁式官方網站分析" },
  single_page: { label: "一頁式", icon: FileText, description: "一頁式銷售頁分析" },
  full_site: { label: "全站", icon: Layers, description: "跨頁總覽與重大異常" },
};

interface AssetPageGroup {
  key: string;
  label: string;
  description: string;
  matchGroups: PageGroup[];
}

const assetViewPageGroups: Record<AssetView, AssetPageGroup[]> = {
  official_site: [
    { key: "guide", label: "導購", description: "引導消費者購買的頁面", matchGroups: ["homepage"] },
    { key: "product", label: "商品頁", description: "商品詳情與介紹", matchGroups: ["products"] },
    { key: "category", label: "分類頁", description: "商品分類與集合", matchGroups: ["collections"] },
    { key: "faq", label: "FAQ", description: "常見問題與說明", matchGroups: ["pages", "blogs"] },
    { key: "brand", label: "品牌頁", description: "品牌形象與故事", matchGroups: ["other"] },
  ],
  single_page: [
    { key: "hero", label: "首屏", description: "首屏吸引力與跳出率", matchGroups: ["homepage"] },
    { key: "trust", label: "信任感", description: "社會證明與信任元素", matchGroups: ["pages", "blogs"] },
    { key: "cta", label: "CTA", description: "行動呼籲按鈕區塊", matchGroups: ["products"] },
    { key: "cart_section", label: "購物車", description: "加購與購物車體驗", matchGroups: ["cart", "collections"] },
    { key: "checkout_section", label: "結帳", description: "結帳流程與轉換", matchGroups: ["checkout"] },
  ],
  full_site: [
    { key: "overview", label: "跨頁總覽", description: "所有頁面的總覽分析", matchGroups: ["homepage", "products", "collections", "pages", "blogs", "cart", "checkout", "other"] },
    { key: "anomaly", label: "重大異常", description: "異常跳出或轉換驟降的頁面", matchGroups: ["homepage", "products", "collections", "pages", "blogs", "cart", "checkout", "other"] },
  ],
};

const riskLevelLabels: Record<RiskLevel, string> = {
  danger: "危險",
  warning: "警告",
  watch: "觀察",
  stable: "穩定",
  potential: "潛力",
};

const riskLevelStyles: Record<RiskLevel, string> = {
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  watch: "bg-yellow-100 text-yellow-700",
  stable: "bg-green-100 text-green-700",
  potential: "bg-blue-100 text-blue-700",
};

type DetailedSortKey = "sessions" | "conversionRate" | "revenue" | "bounceRate" | "pageviews" | "avgEngagementTime";

function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge
      variant="secondary"
      className={`no-default-hover-elevate no-default-active-elevate ${riskLevelStyles[level]}`}
      data-testid={`badge-risk-${level}`}
    >
      {riskLevelLabels[level]}
    </Badge>
  );
}

function TriScoreDisplay({ triScore }: { triScore: TriScore }) {
  const items = [
    { label: "健康", value: triScore.health },
    { label: "急迫", value: triScore.urgency },
    { label: "潛力", value: triScore.scalePotential },
  ];
  return (
    <div className="flex items-center gap-2" data-testid="display-tri-score">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-0.5">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
              <circle
                cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                strokeDasharray={`${(item.value / 100) * 94.2} 94.2`}
                strokeLinecap="round"
                className={item.value >= 70 ? "text-emerald-500" : item.value >= 40 ? "text-amber-500" : "text-red-500"}
                stroke="currentColor"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{item.value}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const priorityLabels: Record<string, string> = {
  high: "高優先",
  medium: "中優先",
  low: "低優先",
};

function PageRecommendationCard({ recommendation }: { recommendation: PageRecommendation }) {
  const borderColor = recommendation.priority === "high"
    ? "border-red-200 dark:border-red-800"
    : recommendation.priority === "medium"
    ? "border-amber-200 dark:border-amber-800"
    : "border-green-200 dark:border-green-800";

  return (
    <div className="p-3" data-testid="card-page-recommendation">
      <Card className={`${borderColor}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${
              recommendation.priority === "high" ? "text-red-500" :
              recommendation.priority === "medium" ? "text-amber-500" : "text-green-500"
            }`} />
            <span className="text-sm font-semibold">{recommendation.diagnosis}</span>
            <Badge
              variant="secondary"
              className={`no-default-hover-elevate no-default-active-elevate ${priorityColors[recommendation.priority]}`}
              data-testid="badge-priority"
            >
              {priorityLabels[recommendation.priority]}
            </Badge>
            <Badge
              variant="secondary"
              className="no-default-hover-elevate no-default-active-elevate text-xs"
              data-testid="badge-affected-stage"
            >
              {recommendation.affectedStage}
            </Badge>
            <span className="text-xs text-muted-foreground">
              信心度 {recommendation.confidence}%
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed" data-testid="text-recommendation-action">
              {recommendation.action}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type SortKey = "sessions" | "avgDuration" | "bounceRate" | "addToCartRate" | "purchaseRate" | "overallConversionRate" | "judgmentScore" | "opportunityScore";
type SortDir = "asc" | "desc";

function formatPercent(v: number): string {
  return `${v.toFixed(2)}%`;
}

function formatNumber(v: number): string {
  return v.toLocaleString();
}


function ChangeIndicator({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return null;
  const change = current - previous;
  const isGood = inverse ? change < 0 : change > 0;
  const absChange = Math.abs(change);
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-600"}`}>
      {isGood ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {absChange.toFixed(1)}
    </span>
  );
}


function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}


function HighRiskSection({ items, isLoading }: { items?: HighRiskItem[]; isLoading: boolean }) {
  const ga4Items = items?.filter((i) => i.type === "page") || [];

  if (isLoading) {
    return (
      <Card data-testid="card-high-risk">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ga4Items.length === 0) return null;

  return (
    <Card data-testid="card-high-risk">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="section-title">這些頁面需要特別關注</h3>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
            {ga4Items.length}
          </Badge>
        </div>
        <div className="space-y-3">
          {ga4Items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-md bg-muted/30 space-y-2"
              data-testid={`high-risk-item-${item.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{item.name}</span>
                  <SeverityBadge severity={item.severity} />
                </div>
                <OpportunityScoreBadge score={item.opportunityScore} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.problemTags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="no-default-hover-elevate no-default-active-elevate text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.aiVerdict}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GA4AnalysisPage() {
  const scope = useAppScope();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("funnel");
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<GA4PageMetrics | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [detailedSortKey, setDetailedSortKey] = useState<DetailedSortKey>("sessions");
  const [detailedSortDir, setDetailedSortDir] = useState<SortDir>("desc");
  const [pageGroupFilter, setPageGroupFilter] = useState<string>("all");
  const [compareSelectedPaths, setCompareSelectedPaths] = useState<Set<string>>(new Set());
  const [assetView, setAssetView] = useState<AssetView>("official_site");
  const [selectedPageGroupKey, setSelectedPageGroupKey] = useState<string | null>(null);
  const [drillDownPage, setDrillDownPage] = useState<GA4PageMetricsDetailed | null>(null);
  const { toast } = useToast();

  const { data: refreshStatusData } = useQuery<RefreshStatus>({
    queryKey: ["/api/refresh/status"],
    refetchInterval: (query) => {
      const data = query.state.data as RefreshStatus | undefined;
      return data?.isRefreshing ? 2000 : false;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
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

  const isRefreshing = refreshMutation.isPending || refreshStatusData?.isRefreshing;

  const wasRefreshingRef = useRef(false);
  useEffect(() => {
    if (wasRefreshingRef.current && !refreshStatusData?.isRefreshing) {
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/director-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-segments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/funnel-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/drop-points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/page-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/priority-fixes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ga4/pages-detailed"] });
      if (refreshStatusData?.currentStep === "完成") {
        toast({ title: "資料更新完成", description: "GA4 數據已重新分析" });
      }
    }
    wasRefreshingRef.current = !!refreshStatusData?.isRefreshing;
  }, [refreshStatusData?.isRefreshing]);

  const { data: directorSummary, isLoading: directorLoading } = useQuery<GA4AIDirectorSummary>({
    queryKey: ["/api/ga4/director-summary"],
  });

  const { data: funnelOverview, isLoading: funnelLoading } = useQuery<GA4FunnelOverview>({
    queryKey: ["/api/ga4/funnel-overview"],
  });

  const { data: pages, isLoading: pagesLoading } = useQuery<GA4PageMetrics[]>({
    queryKey: ["/api/ga4/pages", search],
    queryFn: async () => {
      const url = search ? `/api/ga4/pages?search=${encodeURIComponent(search)}` : "/api/ga4/pages";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: funnelSegments, isLoading: segmentsLoading } = useQuery<GA4FunnelSegment[]>({
    queryKey: ["/api/ga4/funnel-segments"],
  });

  const { data: funnelDrillDown } = useQuery<FunnelDrillDown[]>({
    queryKey: ["/api/ga4/funnel-drilldown"],
  });

  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const toggleSegment = (idx: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const { data: priorityFixes, isLoading: fixesLoading } = useQuery<GA4PriorityFix[]>({
    queryKey: ["/api/ga4/priority-fixes"],
  });

  const { data: dropPoints, isLoading: dropsLoading } = useQuery<GA4DropPoint[]>({
    queryKey: ["/api/ga4/drop-points"],
  });

  const { data: pageRanking } = useQuery<GA4PageRanking[]>({
    queryKey: ["/api/ga4/page-ranking"],
  });

  const { data: highRiskItems, isLoading: highRiskLoading } = useQuery<HighRiskItem[]>({
    queryKey: ["/api/dashboard/high-risk"],
  });

  const { data: pagesDetailedData, isLoading: pagesDetailedLoading } = useQuery<{ pages: GA4PageMetricsDetailed[]; pageGroups: { group: string; count: number; totalSessions: number; totalRevenue: number; avgConversionRate: number; avgBounceRate: number }[]; pageRecommendations: { pagePath: string; recommendation: PageRecommendation }[] }>({
    queryKey: ["/api/ga4/pages-detailed"],
  });

  const sortedPages = useMemo(() => {
    if (!pages) return [];
    const sorted = [...pages].sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [pages, sortKey, sortDir]);

  const pageRecommendationMap = useMemo(() => {
    const map = new Map<string, PageRecommendation>();
    if (pagesDetailedData?.pageRecommendations) {
      for (const { pagePath, recommendation } of pagesDetailedData.pageRecommendations) {
        map.set(pagePath, recommendation);
      }
    }
    return map;
  }, [pagesDetailedData?.pageRecommendations]);

  const [expandedDetailedRows, setExpandedDetailedRows] = useState<Set<string>>(new Set());

  const toggleDetailedRow = (path: string) => {
    setExpandedDetailedRows((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filteredDetailedPages = useMemo(() => {
    if (!pagesDetailedData?.pages) return [];
    let result = pagesDetailedData.pages;
    if (pageGroupFilter !== "all") {
      result = result.filter((p) => p.pageGroup === pageGroupFilter);
    }
    const sorted = [...result].sort((a, b) => {
      const aVal = a[detailedSortKey] as number;
      const bVal = b[detailedSortKey] as number;
      return detailedSortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [pagesDetailedData?.pages, pageGroupFilter, detailedSortKey, detailedSortDir]);

  const currentAssetGroups = assetViewPageGroups[assetView];

  const assetGroupPageCounts = useMemo(() => {
    if (!pagesDetailedData?.pages) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const group of currentAssetGroups) {
      const count = pagesDetailedData.pages.filter((p) =>
        group.matchGroups.includes(p.pageGroup)
      ).length;
      counts.set(group.key, count);
    }
    return counts;
  }, [pagesDetailedData?.pages, currentAssetGroups]);

  const assetGroupFilteredPages = useMemo(() => {
    if (!pagesDetailedData?.pages || !selectedPageGroupKey) return [];
    const group = currentAssetGroups.find((g) => g.key === selectedPageGroupKey);
    if (!group) return [];
    let result = pagesDetailedData.pages.filter((p) =>
      group.matchGroups.includes(p.pageGroup)
    );
    if (assetView === "full_site" && selectedPageGroupKey === "anomaly") {
      result = result.filter(
        (p) => p.bounceRate > 70 || p.riskLevel === "danger" || p.riskLevel === "warning" ||
          (p.conversionRatePrev > 0 && p.conversionRate < p.conversionRatePrev * 0.6)
      );
    }
    return [...result].sort((a, b) => b.sessions - a.sessions);
  }, [pagesDetailedData?.pages, selectedPageGroupKey, currentAssetGroups, assetView]);

  const handleAssetViewChange = (view: AssetView) => {
    setAssetView(view);
    setSelectedPageGroupKey(null);
    setDrillDownPage(null);
  };

  const toggleDetailedSort = (key: DetailedSortKey) => {
    if (detailedSortKey === key) {
      setDetailedSortDir(detailedSortDir === "desc" ? "asc" : "desc");
    } else {
      setDetailedSortKey(key);
      setDetailedSortDir("desc");
    }
  };

  const toggleComparePath = (path: string) => {
    setCompareSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else if (next.size < 4) {
        next.add(path);
      }
      return next;
    });
  };

  const comparePageData = useMemo(() => {
    if (!pagesDetailedData?.pages) return [];
    return pagesDetailedData.pages.filter((p) => compareSelectedPaths.has(p.pagePath));
  }, [pagesDetailedData?.pages, compareSelectedPaths]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
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

  const togglePageSelection = (id: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedPageData = useMemo(() => {
    if (!pages) return [];
    return pages.filter((p) => selectedPages.has(p.id));
  }, [pages, selectedPages]);

  const comparisonMetrics: { key: keyof GA4PageMetrics; label: string; format: (v: number) => string; inverse?: boolean }[] = [
    { key: "sessions", label: "工作階段", format: formatNumber },
    { key: "avgDuration", label: "平均停留 (秒)", format: (v) => `${v}` },
    { key: "bounceRate", label: "跳出率", format: formatPercent, inverse: true },
    { key: "engagementRate", label: "參與率", format: formatPercent },
    { key: "productViewRate", label: "商品瀏覽率", format: formatPercent },
    { key: "addToCartRate", label: "加購率", format: formatPercent },
    { key: "checkoutRate", label: "結帳率", format: formatPercent },
    { key: "purchaseRate", label: "購買率", format: formatPercent },
    { key: "overallConversionRate", label: "整體導購率", format: formatPercent },
    { key: "judgmentScore", label: "判決分數", format: (v) => `${v}` },
    { key: "opportunityScore", label: "機會分數", format: (v) => `${v}` },
  ];

  const DetailedSortableHead = ({ label, sortKeyName }: { label: string; sortKeyName: DetailedSortKey }) => (
    <TableHead>
      <button
        className="flex items-center gap-1 cursor-pointer text-xs"
        onClick={() => toggleDetailedSort(sortKeyName)}
        data-testid={`button-sort-detailed-${sortKeyName}`}
      >
        {label}
        {detailedSortKey === sortKeyName ? (
          detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const SortableHead = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead>
      <button
        className="flex items-center gap-1 cursor-pointer text-xs"
        onClick={() => toggleSort(sortKeyName)}
        data-testid={`button-sort-${sortKeyName}`}
      >
        {label}
        {sortKey === sortKeyName ? (
          sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const rankingForPage = (path: string) => pageRanking?.find((r) => r.path === path);

  if (directorLoading && funnelLoading && pagesLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <h1 className="page-title" data-testid="text-page-title">
            GA4 頁面分析
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AccountSelector
            platform="ga4"
            value={scope.selectedPropertyIds[0] || ""}
            onChange={(id: string) => scope.setSelectedProperties(id && id !== "all" ? [id] : [])}
            placeholder="選擇 GA4 資產"
            showAllOption
            allOptionLabel="全部資產"
            data-testid="select-property"
          />

          <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={isRefreshing}
            data-testid="button-refresh-ga4"
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
              placeholder="搜尋頁面..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search"
            />
          </div>
        </div>
      </header>

      <div className="min-h-full p-4 md:p-6 space-y-4 page-container-fluid">
        {!directorLoading && !directorSummary && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">GA4 頁面分析 — 使用步驟</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground mb-4">
                <li>在<strong className="text-foreground">設定中心</strong>串接 GA4 Property（離開欄位會自動儲存）。</li>
                <li>在上方選擇 GA4 資產後，點<strong className="text-foreground">「更新資料」</strong>取得最新漏斗與頁面數據。</li>
                <li>若仍無資料，請至<strong className="text-foreground">設定中心</strong>檢查 GA4 連線與權限。</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings">前往設定中心</a>
              </Button>
            </CardContent>
          </Card>
        )}
        {directorLoading ? (
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-20 mb-3" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </CardContent>
          </Card>
        ) : directorSummary ? (
          <Card className="border-emerald-200 dark:border-emerald-800" data-testid="card-director-summary">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="section-title text-muted-foreground" data-testid="text-director-title">漏斗整體判斷</h3>
              </div>
              <p className="text-base font-bold leading-relaxed mb-4" data-testid="text-director-verdict">
                {directorSummary.verdict}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">最大殺手</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-biggest-killer">{directorSummary.biggestKiller}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">最該先修</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-fix-first">{directorSummary.fixFirst}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/40">
                  <p className="text-xs text-muted-foreground mb-1">該修頁面還是加流量</p>
                  <p className="text-sm font-medium leading-relaxed" data-testid="text-fix-or-traffic">{directorSummary.fixOrTraffic}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <HighRiskSection items={highRiskItems} isLoading={highRiskLoading} />

        {funnelLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
              ))}
            </div>
            <Skeleton className="h-24" />
          </div>
        ) : funnelOverview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="grid-kpis">
              {[
                { label: "工作階段", value: formatNumber(funnelOverview.sessions), change: funnelOverview.sessions - funnelOverview.prevPeriod.sessions, prev: funnelOverview.prevPeriod.sessions, icon: Users },
                { label: "使用者", value: formatNumber(funnelOverview.users), change: 0, prev: 0, icon: Users },
                { label: "商品瀏覽率", value: formatPercent(funnelOverview.productViewRate), change: funnelOverview.productViewRate - funnelOverview.prevPeriod.productViewRate, prev: funnelOverview.prevPeriod.productViewRate, icon: Eye },
                { label: "加購率", value: formatPercent(funnelOverview.addToCartRate), change: funnelOverview.addToCartRate - funnelOverview.prevPeriod.addToCartRate, prev: funnelOverview.prevPeriod.addToCartRate, icon: ShoppingCart },
                { label: "結帳率", value: formatPercent(funnelOverview.checkoutRate), change: funnelOverview.checkoutRate - funnelOverview.prevPeriod.checkoutRate, prev: funnelOverview.prevPeriod.checkoutRate, icon: CreditCard },
                { label: "購買率", value: formatPercent(funnelOverview.purchaseRate), change: funnelOverview.purchaseRate - funnelOverview.prevPeriod.purchaseRate, prev: funnelOverview.prevPeriod.purchaseRate, icon: TrendingUp },
                { label: "整體導購率", value: formatPercent(funnelOverview.overallConversionRate), change: funnelOverview.overallConversionRate - funnelOverview.prevPeriod.overallConversionRate, prev: funnelOverview.prevPeriod.overallConversionRate, icon: BarChart3 },
                { label: "平均停留", value: `${funnelOverview.avgDuration} 秒`, change: 0, prev: 0, icon: Clock },
                { label: "跳出率", value: formatPercent(funnelOverview.bounceRate), change: 0, prev: 0, icon: Percent, inverse: true },
                { label: "參與率", value: formatPercent(funnelOverview.engagementRate), change: 0, prev: 0, icon: Activity },
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <Card key={idx} data-testid={`kpi-card-${idx}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {kpi.prev !== 0 && (
                          <ChangeIndicator current={kpi.change + kpi.prev} previous={kpi.prev} inverse={kpi.inverse} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                      <p className="text-lg font-bold" data-testid={`kpi-value-${idx}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card data-testid="card-funnel-visual">
              <CardContent className="p-5">
                <h3 className="section-title mb-4">各階段轉換表現</h3>
                <div className="flex items-end gap-2">
                  {[
                    { label: "著陸頁瀏覽", count: funnelOverview.landingPageViews, rate: 100 },
                    { label: "商品瀏覽", count: funnelOverview.productViews, rate: Math.min(100, funnelOverview.productViewRate) },
                    { label: "加入購物車", count: funnelOverview.addToCartCount, rate: Math.min(100, funnelOverview.addToCartRate) },
                    { label: "開始結帳", count: funnelOverview.checkoutStartCount, rate: Math.min(100, funnelOverview.checkoutRate) },
                    { label: "完成購買", count: funnelOverview.purchases, rate: Math.min(100, funnelOverview.purchaseRate) },
                  ].map((stage, idx, arr) => {
                    const maxCount = arr[0].count || 1;
                    const heightPercent = Math.max((stage.count / maxCount) * 100, 15);
                    const funnelColors = [
                      "bg-emerald-500",
                      "bg-emerald-400",
                      "bg-emerald-300",
                      "bg-amber-400",
                      "bg-red-400",
                    ];
                    const rawDrop = idx > 0 && arr[idx - 1].count > 0 ? ((arr[idx - 1].count - stage.count) / arr[idx - 1].count) * 100 : 0;
                    const dropRate = idx > 0 ? Math.max(0, rawDrop).toFixed(2) : null;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1" data-testid={`funnel-stage-${idx}`}>
                        <span className="text-xs font-medium">{formatNumber(stage.count)}</span>
                        <span className="text-xs text-muted-foreground">{stage.rate.toFixed(2)}%</span>
                        <div
                          className={`w-full ${funnelColors[idx]} rounded-md transition-all`}
                          style={{ height: `${heightPercent}px`, minHeight: "12px" }}
                        />
                        <span className="text-xs text-muted-foreground text-center mt-1">{stage.label}</span>
                        {dropRate && (
                          <span className="text-xs text-red-500">
                            -{dropRate}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

        <Card data-testid="card-asset-switcher">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h3 className="section-title">依不同維度檢視</h3>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="pills-asset-view">
              {(Object.entries(assetViewConfig) as [AssetView, typeof assetViewConfig[AssetView]][]).map(([key, config]) => {
                const Icon = config.icon;
                const isActive = assetView === key;
                return (
                  <Button
                    key={key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAssetViewChange(key)}
                    data-testid={`button-asset-${key}`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {config.label}
                  </Button>
                );
              })}
              <span className="text-xs text-muted-foreground ml-2">
                {assetViewConfig[assetView].description}
              </span>
            </div>

            {drillDownPage ? (
              <div className="space-y-4" data-testid="drilldown-single-page">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrillDownPage(null)}
                    data-testid="button-back-to-list"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回列表
                  </Button>
                  {selectedPageGroupKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDrillDownPage(null); setSelectedPageGroupKey(null); }}
                      data-testid="button-back-to-groups"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      返回分組
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold" data-testid="text-drilldown-title">{drillDownPage.pageTitle || drillDownPage.pagePath}</h4>
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                      {pageGroupLabels[drillDownPage.pageGroup]}
                    </Badge>
                    {drillDownPage.scoring ? <DiagnosisBadge diagnosis={drillDownPage.scoring.diagnosis} /> : <RiskLevelBadge level={drillDownPage.riskLevel} />}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-drilldown-path">{drillDownPage.pagePath}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "工作階段", value: formatNumber(drillDownPage.sessions), prev: drillDownPage.sessionsPrev },
                      { label: "瀏覽量", value: formatNumber(drillDownPage.pageviews) },
                      { label: "轉換率", value: formatPercent(drillDownPage.conversionRate), prev: drillDownPage.conversionRatePrev },
                      { label: "營收", value: `$${drillDownPage.revenue.toLocaleString()}`, prev: drillDownPage.revenuePrev },
                      { label: "跳出率", value: formatPercent(drillDownPage.bounceRate), prev: drillDownPage.bounceRatePrev, inverse: true },
                      { label: "平均互動時間", value: `${drillDownPage.avgEngagementTime.toFixed(1)} 秒` },
                      { label: "加入購物車", value: formatNumber(drillDownPage.addToCart) },
                      { label: "購買次數", value: formatNumber(drillDownPage.purchases) },
                    ].map((m, idx) => (
                      <div key={idx} className="p-3 rounded-md bg-muted/40" data-testid={`drilldown-metric-${idx}`}>
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold">{m.value}</p>
                          {m.prev !== undefined && m.prev > 0 && (
                            <ChangeIndicator current={parseFloat(m.value.replace(/[^0-9.-]/g, "")) || 0} previous={m.prev} inverse={m.inverse} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {drillDownPage.scoring && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">V2 評分</h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DiagnosisBadge diagnosis={drillDownPage.scoring.diagnosis} />
                        <ActionBadge action={drillDownPage.scoring.recommendedAction} />
                      </div>
                      <V2ScoreBar scoring={drillDownPage.scoring} />
                      <BenchmarkInfo scoring={drillDownPage.scoring} />
                    </div>
                  )}

                  {!drillDownPage.scoring && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">三維評分</h4>
                      <TriScoreDisplay triScore={drillDownPage.triScore} />
                    </div>
                  )}

                  {(() => {
                    const rec = pageRecommendationMap.get(drillDownPage.pagePath);
                    if (!rec) return null;
                    return <PageRecommendationCard recommendation={rec} />;
                  })()}
                </div>
              </div>
            ) : selectedPageGroupKey ? (
              <div className="space-y-3" data-testid="drilldown-page-list">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPageGroupKey(null)}
                    data-testid="button-back-to-groups-from-list"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回分組
                  </Button>
                  <h4 className="text-sm font-semibold" data-testid="text-group-title">
                    {currentAssetGroups.find((g) => g.key === selectedPageGroupKey)?.label}
                  </h4>
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                    {assetGroupFilteredPages.length} 個頁面
                  </Badge>
                </div>

                {pagesDetailedLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : assetGroupFilteredPages.length > 0 ? (
                  <div className="space-y-2">
                    {assetGroupFilteredPages.map((page, idx) => {
                      const rec = pageRecommendationMap.get(page.pagePath);
                      return (
                        <div
                          key={page.pagePath}
                          className="p-4 rounded-md bg-muted/30 cursor-pointer hover-elevate"
                          onClick={() => setDrillDownPage(page)}
                          data-testid={`card-group-page-${idx}`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold" data-testid={`text-group-page-title-${idx}`}>
                                  {page.pageTitle || page.pagePath}
                                </span>
                                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                                  {pageGroupLabels[page.pageGroup]}
                                </Badge>
                                {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate" data-testid={`text-group-page-path-${idx}`}>{page.pagePath}</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 flex-wrap">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">工作階段</p>
                                <p className="text-sm font-semibold">{formatNumber(page.sessions)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">轉換率</p>
                                <p className="text-sm font-semibold">{formatPercent(page.conversionRate)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">跳出率</p>
                                <p className="text-sm font-semibold">{formatPercent(page.bounceRate)}</p>
                              </div>
                              {rec && (
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">建議</p>
                                  <Badge
                                    variant="secondary"
                                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${priorityColors[rec.priority]}`}
                                  >
                                    {rec.diagnosis}
                                  </Badge>
                                </div>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-group-empty">
                    此分組目前沒有頁面資料
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="grid-page-groups">
                {currentAssetGroups.map((group) => {
                  const count = assetGroupPageCounts.get(group.key) || 0;
                  return (
                    <div
                      key={group.key}
                      className="p-4 rounded-md bg-muted/30 cursor-pointer hover-elevate"
                      onClick={() => setSelectedPageGroupKey(group.key)}
                      data-testid={`card-page-group-${group.key}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold mb-1">{group.label}</h4>
                          <p className="text-xs text-muted-foreground">{group.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                            {count}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="funnel" data-testid="tab-funnel">漏斗分析</TabsTrigger>
            <TabsTrigger value="ranking" data-testid="tab-ranking">頁面排行</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">頁面比較</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel">
            {segmentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><Skeleton className="h-28" /></CardContent></Card>
                ))}
              </div>
            ) : funnelSegments && funnelSegments.length > 0 ? (
              <div className="space-y-3" data-testid="funnel-segments">
                {funnelSegments.map((seg, idx) => (
                  <div key={idx} className="relative" data-testid={`card-segment-${idx}`}>
                    {idx > 0 && (
                      <div className="flex justify-center -mt-1 mb-1">
                        <ArrowDown className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{seg.from}</span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{seg.to}</span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`no-default-hover-elevate no-default-active-elevate ${severityStyles["medium"]}`}
                            data-testid={`badge-problem-${idx}`}
                          >
                            {seg.problemType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 mb-3 flex-wrap">
                          <div>
                            <p className="text-xs text-muted-foreground">轉換率</p>
                            <p className="text-2xl font-bold text-emerald-600" data-testid={`text-conversion-${idx}`}>
                              {formatPercent(seg.conversionRate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">流失率</p>
                            <p className="text-2xl font-bold text-red-500" data-testid={`text-drop-${idx}`}>
                              {formatPercent(seg.dropRate)}
                            </p>
                          </div>
                          {seg.benchmark && (
                            <div>
                              <p className="text-xs text-muted-foreground">業界均值</p>
                              <p className="text-lg font-semibold text-muted-foreground" data-testid={`text-benchmark-${idx}`}>
                                {formatPercent(seg.benchmark)}
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed mb-3" data-testid={`text-verdict-${idx}`}>{seg.aiVerdict}</p>

                        {seg.relatedPages && seg.relatedPages.length > 0 && (
                          <div className="p-3 rounded-md bg-muted/30 mb-3" data-testid={`related-pages-${idx}`}>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">相關頁面</p>
                            <div className="space-y-1.5">
                              {seg.relatedPages.map((rp, rpIdx) => (
                                <div key={rpIdx} className="flex items-center gap-2">
                                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs leading-relaxed">{rp}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const stageKey = `${seg.from} → ${seg.to}`;
                          const drillData = funnelDrillDown?.find(d => d.stage === stageKey);
                          if (!drillData || drillData.topPages.length === 0) return null;
                          const isOpen = expandedSegments.has(idx);
                          return (
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2 text-muted-foreground"
                                onClick={() => toggleSegment(idx)}
                                data-testid={`btn-drilldown-${idx}`}
                              >
                                {isOpen ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
                                影響最大的 {drillData.topPages.length} 個頁面
                              </Button>
                              {isOpen && (
                                <div className="mt-2 space-y-2" data-testid={`drilldown-${idx}`}>
                                  {drillData.topPages.map((pg, pgIdx) => (
                                    <div key={pgIdx} className="p-3 rounded-md bg-muted/30 border border-border/30" data-testid={`drilldown-page-${idx}-${pgIdx}`}>
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="text-xs font-medium line-clamp-1">{pg.pageTitle || pg.pagePath}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{pg.sessions} 工作階段</span>
                                      </div>
                                      <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">{pg.reason}</p>
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400">建議: {pg.fix}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-sm text-muted-foreground" data-testid="text-funnel-empty">尚無漏斗分析資料，請先更新資料</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ranking">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={pageGroupFilter} onValueChange={setPageGroupFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-page-group-filter">
                    <SelectValue placeholder="篩選頁面類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部類型</SelectItem>
                    {(Object.entries(pageGroupLabels) as [PageGroup, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground" data-testid="text-ranking-count">
                  共 {filteredDetailedPages.length} 個頁面
                </span>
              </div>

              {pagesDetailedLoading ? (
                <Card><CardContent className="p-4"><Skeleton className="h-64" /></CardContent></Card>
              ) : filteredDetailedPages.length > 0 ? (
                <Card data-testid="card-detailed-ranking">
                  <CardContent className="p-0">
                    <div className="table-scroll-container">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">頁面路徑</TableHead>
                            <TableHead className="text-xs">頁面標題</TableHead>
                            <TableHead className="text-xs">類型</TableHead>
                            <DetailedSortableHead label="工作階段" sortKeyName="sessions" />
                            <DetailedSortableHead label="轉換率" sortKeyName="conversionRate" />
                            <DetailedSortableHead label="營收" sortKeyName="revenue" />
                            <DetailedSortableHead label="跳出率" sortKeyName="bounceRate" />
                            <TableHead className="text-xs">診斷 / 風險</TableHead>
                            <TableHead className="text-xs">V2 評分 / 三維</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDetailedPages.map((page, idx) => {
                            const rec = pageRecommendationMap.get(page.pagePath);
                            const isExpanded = expandedDetailedRows.has(page.pagePath);
                            return (
                              <Fragment key={page.pagePath}>
                                <TableRow
                                  className="cursor-pointer"
                                  onClick={() => toggleDetailedRow(page.pagePath)}
                                  data-testid={`row-detailed-${idx}`}
                                >
                                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" data-testid={`text-pagepath-${idx}`}>
                                    <div className="flex items-center gap-1">
                                      {rec && (
                                        isExpanded
                                          ? <ChevronDown className="w-3 h-3 shrink-0" />
                                          : <ChevronRight className="w-3 h-3 shrink-0" />
                                      )}
                                      {page.pagePath}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm font-medium max-w-[180px] truncate" data-testid={`text-pagetitle-${idx}`}>
                                    {page.pageTitle}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-group-${idx}`}>
                                      {pageGroupLabels[page.pageGroup]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm" data-testid={`text-sessions-${idx}`}>
                                    <div className="flex items-center gap-1">
                                      {formatNumber(page.sessions)}
                                      {page.sessionsPrev > 0 && (
                                        <ChangeIndicator current={page.sessions} previous={page.sessionsPrev} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold" data-testid={`text-cvr-${idx}`}>
                                    <div className="flex items-center gap-1">
                                      {formatPercent(page.conversionRate)}
                                      {page.conversionRatePrev > 0 && (
                                        <ChangeIndicator current={page.conversionRate} previous={page.conversionRatePrev} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm" data-testid={`text-revenue-${idx}`}>
                                    <div className="flex items-center gap-1">
                                      ${page.revenue.toLocaleString()}
                                      {page.revenuePrev > 0 && (
                                        <ChangeIndicator current={page.revenue} previous={page.revenuePrev} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm" data-testid={`text-bounce-${idx}`}>
                                    <div className="flex items-center gap-1">
                                      {formatPercent(page.bounceRate)}
                                      {page.bounceRatePrev > 0 && (
                                        <ChangeIndicator current={page.bounceRate} previous={page.bounceRatePrev} inverse />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                                  </TableCell>
                                  <TableCell>
                                    {page.scoring ? <V2ScoreMini scoring={page.scoring} /> : <TriScoreDisplay triScore={page.triScore} />}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && rec && (
                                  <TableRow data-testid={`row-detailed-rec-${idx}`}>
                                    <TableCell colSpan={9} className="p-0">
                                      <PageRecommendationCard recommendation={rec} />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8">
                    <p className="text-center text-sm text-muted-foreground" data-testid="text-ranking-empty">尚無頁面排行資料，請先更新資料</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="compare">
            <Card data-testid="card-page-comparator-detailed">
              <CardContent className="p-5">
                <h3 className="section-title mb-1">頁面比較分析</h3>
                <p className="text-xs text-muted-foreground mb-4">選擇 2-4 個頁面進行深度比較</p>

                {pagesDetailedData?.pages && pagesDetailedData.pages.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                      {pagesDetailedData.pages.map((page, idx) => {
                        const isSelected = compareSelectedPaths.has(page.pagePath);
                        return (
                          <label
                            key={page.pagePath}
                            className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                              isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "bg-muted/20"
                            }`}
                            data-testid={`checkbox-compare-${idx}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleComparePath(page.pagePath)}
                              disabled={!isSelected && compareSelectedPaths.size >= 4}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{page.pageTitle || page.pagePath}</span>
                                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                                  {pageGroupLabels[page.pageGroup]}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{page.pagePath}</span>
                            </div>
                            {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                          </label>
                        );
                      })}
                    </div>

                    {comparePageData.length >= 2 ? (
                      <div className="space-y-4">
                        <div className="table-scroll-container rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold bg-muted/30">指標</TableHead>
                                {comparePageData.map((p) => (
                                  <TableHead key={p.pagePath} className="text-xs bg-muted/30">
                                    <div className="space-y-1">
                                      <span className="font-semibold">{p.pageTitle || p.pagePath}</span>
                                      <div className="flex items-center gap-1.5">
                                        {p.scoring ? <DiagnosisBadge diagnosis={p.scoring.diagnosis} /> : <RiskLevelBadge level={p.riskLevel} />}
                                      </div>
                                    </div>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {([
                                { key: "sessions" as const, label: "工作階段", format: formatNumber },
                                { key: "pageviews" as const, label: "瀏覽量", format: formatNumber },
                                { key: "avgEngagementTime" as const, label: "平均互動時間 (秒)", format: (v: number) => `${v.toFixed(1)}` },
                                { key: "bounceRate" as const, label: "跳出率", format: formatPercent, inverse: true },
                                { key: "addToCart" as const, label: "加入購物車", format: formatNumber },
                                { key: "beginCheckout" as const, label: "開始結帳", format: formatNumber },
                                { key: "purchases" as const, label: "購買次數", format: formatNumber },
                                { key: "revenue" as const, label: "營收", format: (v: number) => `$${v.toLocaleString()}` },
                                { key: "conversionRate" as const, label: "轉換率", format: formatPercent },
                              ] as { key: keyof GA4PageMetricsDetailed; label: string; format: (v: number) => string; inverse?: boolean }[]).map((metric) => {
                                const values = comparePageData.map((p) => p[metric.key] as number);
                                const isInverse = metric.inverse === true;
                                const bestVal = isInverse ? Math.min(...values) : Math.max(...values);
                                const worstVal = isInverse ? Math.max(...values) : Math.min(...values);
                                return (
                                  <TableRow key={metric.key as string} data-testid={`row-compare-detailed-${metric.key as string}`}>
                                    <TableCell className="text-sm font-medium text-muted-foreground">{metric.label}</TableCell>
                                    {comparePageData.map((p) => {
                                      const val = p[metric.key] as number;
                                      let cellClass = "";
                                      if (values.length > 1 && val === bestVal) cellClass = "bg-emerald-50/50 dark:bg-emerald-950/30";
                                      if (values.length > 1 && val === worstVal) cellClass = "bg-red-50/50 dark:bg-red-950/30";
                                      const isBest = values.length > 1 && val === bestVal;
                                      const isWorst = values.length > 1 && val === worstVal;
                                      return (
                                        <TableCell
                                          key={p.pagePath}
                                          className={`text-sm ${cellClass}`}
                                          data-testid={`cell-compare-detailed-${metric.key as string}-${p.pagePath}`}
                                        >
                                          <div className="flex items-center gap-1">
                                            <span className={isBest ? "font-bold text-emerald-600 dark:text-emerald-400" : isWorst ? "font-bold text-red-600 dark:text-red-400" : ""}>
                                              {metric.format(val)}
                                            </span>
                                            {isBest && <Star className="w-3 h-3 text-emerald-500" />}
                                          </div>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                );
                              })}
                              <TableRow data-testid="row-compare-detailed-triscore">
                                <TableCell className="text-sm font-medium text-muted-foreground">三維評分</TableCell>
                                {comparePageData.map((p) => (
                                  <TableCell key={p.pagePath}>
                                    {p.scoring ? <V2ScoreMini scoring={p.scoring} /> : <TriScoreDisplay triScore={p.triScore} />}
                                  </TableCell>
                                ))}
                              </TableRow>
                              <TableRow data-testid="row-compare-detailed-risk">
                                <TableCell className="text-sm font-medium text-muted-foreground">風險等級</TableCell>
                                {comparePageData.map((p) => (
                                  <TableCell key={p.pagePath}>
                                    {p.scoring ? <DiagnosisBadge diagnosis={p.scoring.diagnosis} /> : <RiskLevelBadge level={p.riskLevel} />}
                                  </TableCell>
                                ))}
                              </TableRow>
                              {comparePageData.some((p) => p.scoring) && (
                                <TableRow data-testid="row-compare-detailed-v2-detail">
                                  <TableCell className="text-sm font-medium text-muted-foreground">V2 詳細</TableCell>
                                  {comparePageData.map((p) => (
                                    <TableCell key={p.pagePath}>
                                      {p.scoring && (
                                        <div className="space-y-1.5">
                                          <V2ScoreBar scoring={p.scoring} />
                                          <ActionBadge action={p.scoring.recommendedAction} />
                                          <BenchmarkInfo scoring={p.scoring} />
                                        </div>
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-compare-detailed-empty">
                        請至少選擇 2 個頁面進行比較（最多 4 個）
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-8 text-muted-foreground text-sm" data-testid="text-compare-no-data">
                    尚無頁面資料，請先更新資料
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-page-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap" data-testid="text-detail-title">
              {selectedDetail?.pageName}
              {selectedDetail && (
                <Badge
                  variant="secondary"
                  className={`no-default-hover-elevate no-default-active-elevate ${aiLabelColors[selectedDetail.aiLabel] || ""}`}
                >
                  {selectedDetail.aiLabel}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.path}</DialogDescription>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <ScorePill score={selectedDetail.judgmentScore} label="判決分數" />
                <OpportunityScoreBadge score={selectedDetail.opportunityScore} size="md" />
                <RecommendationLevelBadge level={selectedDetail.recommendationLevel} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "工作階段", value: formatNumber(selectedDetail.sessions) },
                  { label: "使用者", value: formatNumber(selectedDetail.users) },
                  { label: "平均停留", value: `${selectedDetail.avgDuration} 秒` },
                  { label: "跳出率", value: formatPercent(selectedDetail.bounceRate) },
                  { label: "商品瀏覽率", value: formatPercent(selectedDetail.productViewRate) },
                  { label: "加購率", value: formatPercent(selectedDetail.addToCartRate) },
                  { label: "結帳率", value: formatPercent(selectedDetail.checkoutRate) },
                  { label: "購買率", value: formatPercent(selectedDetail.purchaseRate) },
                  { label: "參與率", value: formatPercent(selectedDetail.engagementRate) },
                  { label: "整體導購率", value: formatPercent(selectedDetail.overallConversionRate) },
                ].map((m, idx) => (
                  <div key={idx} className="p-3 rounded-md bg-muted/40" data-testid={`detail-metric-${idx}`}>
                    <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">AI 評估</h4>
                <p className="text-sm leading-relaxed" data-testid="text-detail-ai-comment">{selectedDetail.aiComment}</p>
              </div>

              {selectedDetail.scoring && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">V2 評分</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <DiagnosisBadge diagnosis={selectedDetail.scoring.diagnosis} />
                    <ActionBadge action={selectedDetail.scoring.recommendedAction} />
                  </div>
                  <V2ScoreBar scoring={selectedDetail.scoring} />
                  <BenchmarkInfo scoring={selectedDetail.scoring} />
                </div>
              )}

              {selectedDetail.opportunityBreakdown && <OpportunityBreakdownDisplay breakdown={selectedDetail.opportunityBreakdown} />}

              {selectedDetail.suggestedAction && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/30">
                  <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">建議動作</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed" data-testid="text-detail-suggested-action">{selectedDetail.suggestedAction}</p>
                  </div>
                </div>
              )}

              {selectedDetail.estimatedImpact && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50/50 dark:bg-blue-950/30">
                  <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed" data-testid="text-detail-estimated-impact">{selectedDetail.estimatedImpact}</p>
                </div>
              )}

              {(() => {
                const ranking = rankingForPage(selectedDetail.path);
                if (!ranking) return null;
                return (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">頁面排名建議</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className={`no-default-hover-elevate no-default-active-elevate ${recommendationPageColors[ranking.recommendation] || ""}`}
                        data-testid="badge-detail-recommendation"
                      >
                        {recommendationPageLabels[ranking.recommendation] || ranking.recommendation}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-detail-ranking-reason">{ranking.reason}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
