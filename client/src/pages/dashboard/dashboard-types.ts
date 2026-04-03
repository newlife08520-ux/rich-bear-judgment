/**
 * 首頁決策中心：Action Center API 與衍生資料型別。
 * 與 server 回傳形狀相容，僅供 client 使用。
 */

export interface FunnelWarningItem {
  productName: string;
  type: "landing_page_break" | "checkout_resistance";
  message: string;
}

export interface BudgetActionRow {
  campaignId: string;
  campaignName: string;
  accountId: string;
  productName: string;
  spend: number;
  revenue?: number;
  roas: number;
  impactAmount: number;
  sampleStatus: string;
  dataStatus?: "no_delivery" | "under_sample" | "decision_ready";
  evidenceLevel?: string;
  scaleReadinessScore?: number;
  profitHeadroom?: number;
  breakEvenRoas?: number | null;
  targetRoas?: number | null;
  roas1d?: number | null;
  roas3d?: number | null;
  roas7d?: number | null;
  addToCart?: number;
  conversions?: number;
  trendABC: string | null;
  suggestedAction: string;
  suggestedPct: number | "關閉";
  reason: string;
  whyNotMore?: string;
  hasRule?: boolean;
  costRuleStatus?: string;
}

export interface ActionCenterSourceMeta {
  batchId: string | null;
  generatedAt: string | null;
  dateRange: string | null;
  scopeKey: string | null;
  campaignCountUsed: number;
  excludedNoDelivery: number;
  excludedUnderSample: number;
  unmappedCount: number;
}

export interface ProductLevelItem {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  campaignCount?: number;
  hasRule?: boolean;
  costRuleStatus?: string;
  evidenceLevel?: string;
  breakEvenRoas?: number | null;
  targetRoas?: number | null;
}

export interface CreativeLeaderboardItem {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
  thumbnailUrl?: string;
  budgetSuggestion?: string;
  scaleReadinessScore?: number;
  creativeEdge?: number;
  suggestedAction?: string;
  suggestedPct?: number | "關閉";
  budgetReason?: string;
  whyNotMore?: string;
}

export interface TodayActionRow {
  type: "放大" | "止血" | "不要誤殺" | "值得延伸" | "規則缺失待補";
  objectType: "商品" | "素材" | "活動";
  productName: string;
  campaignName?: string;
  campaignId?: string;
  accountId?: string;
  spend: number;
  revenue: number;
  roas: number;
  breakEvenRoas?: number | null;
  targetRoas?: number | null;
  roas1d?: number | null;
  roas3d?: number | null;
  roas7d?: number | null;
  suggestedAction: string;
  suggestedPct: number | "關閉";
  evidenceLevel?: string;
  reason: string;
  whyNotMore?: string | null;
  directorVerdict: string;
}

export interface DormantGemCandidateItem {
  campaignId: string;
  campaignName: string;
  accountId: string;
  productName: string;
  status: string;
  primarySpend: number;
  trailingSpend7d: number;
  trailingSpend14d: number;
  roas7d: number | null;
  opportunityScore?: number | null;
  healthScore?: number | null;
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  pauseSignals: string[];
  reasonSummary?: string;
  reviveRecommendation?: string;
  whyPausedHint?: string;
  whyWorthRevivingHint?: string;
  revivalPriorityScore?: number;
}

export interface ActionCenterData {
  visibilityPolicyVersion?: string;
  dormantGemCandidates?: DormantGemCandidateItem[];
  batchValidity?: "valid" | "legacy" | "insufficient";
  batchValidityReason?: string;
  sourceMeta?: ActionCenterSourceMeta;
  productLevel: ProductLevelItem[];
  productLevelMain?: ProductLevelItem[];
  productLevelNoDelivery?: ProductLevelItem[];
  productLevelUnmapped?: ProductLevelItem[];
  unmappedCount?: number;
  creativeLeaderboard: CreativeLeaderboardItem[];
  hiddenGems: Array<{ productName: string; spend: number; revenue: number; roas: number; message: string }>;
  urgentStop: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; message: string }>;
  riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }>;
  funnelWarnings?: FunnelWarningItem[];
  failureRatesByTag?: Record<string, number>;
  budgetActionTable?: BudgetActionRow[];
  budgetActionNoDelivery?: BudgetActionRow[];
  budgetActionUnderSample?: BudgetActionRow[];
  creativeLeaderboardUnderSample?: Array<{ productName: string; materialStrategy: string; headlineSnippet: string; spend: number; revenue: number; roas: number; evidenceLevel?: string }>;
  tableRescue?: BudgetActionRow[];
  tableScaleUp?: BudgetActionRow[];
  tableNoMisjudge?: BudgetActionRow[];
  tableExtend?: Array<{ productName: string; materialStrategy: string; headlineSnippet: string; spend: number; revenue: number; roas: number; conversions: number; creativeEdge?: number; scaleReadinessScore?: number; [k: string]: unknown }>;
  todayActions?: TodayActionRow[];
  tierMainAccount?: Array<{ productName: string; spend: number; revenue: number; roas: number }>;
  tierHighPotentialCreatives?: Array<{ productName: string; materialStrategy: string; headlineSnippet: string; spend: number; revenue: number; roas: number }>;
  tierNoise?: Array<{ campaignId: string; campaignName: string; productName: string; spend: number; reason: string }>;
  funnelEvidence?: boolean;
}
