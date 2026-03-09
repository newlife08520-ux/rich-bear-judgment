import { z } from "zod";

// ========== Auth ==========
export const userRoles = ["admin", "manager", "user"] as const;
export type UserRole = (typeof userRoles)[number];

/** 角色驅動行動工作區：依視角區分（與 userRoles 可並存） */
export const workRoles = ["ADMIN", "MEDIA_BUYER", "MARKETER", "DESIGNER"] as const;
export type WorkRole = (typeof workRoles)[number];

export const workRoleLabels: Record<WorkRole, string> = {
  ADMIN: "總監（管理員）",
  MEDIA_BUYER: "廣告投手",
  MARKETER: "行銷企劃",
  DESIGNER: "設計美編",
};

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  /** 角色驅動視角（選填，用於 Action Center） */
  workRole?: WorkRole;
  /** 負責商品名稱列表，與 Campaign 解析出的產品名對齊；空陣列表示 ADMIN 看全部 */
  assignedProductNames?: string[];
}

export type SafeUser = Omit<User, "password">;

export const loginSchema = z.object({
  username: z.string().min(1, "請輸入帳號"),
  password: z.string().min(1, "請輸入密碼"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InsertUser = Omit<User, "id">;

// ========== Date Range Options ==========
export const dateRangeOptions = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "3", label: "近 3 天" },
  { value: "7", label: "近 7 天" },
  { value: "14", label: "近 14 天" },
  { value: "30", label: "近 30 天" },
  { value: "custom", label: "自訂" },
] as const;

// ========== App Scope (Single Source of Truth) ==========
export interface AppScope {
  selectedAccountIds: string[];
  selectedPropertyIds: string[];
  datePreset: string;
  customStart?: string;
  customEnd?: string;
  scopeMode: "all" | "selected";
}

export interface DataFlowStatus {
  connectionStatus: { meta: boolean; ga4: boolean };
  syncStatus: { metaCount: number; ga4Count: number };
  selectionStatus: { metaSelected: number; ga4Selected: number };
  analysisStatus: {
    lastBatchAt: string | null;
    lastBatchScope: string | null;
    isStale: boolean;
  };
  dataCoverage: "both" | "meta_only" | "ga4_only" | "none";
}

export function buildScopeKey(
  userId: string,
  accountIds: string[],
  propertyIds: string[],
  datePreset: string
): string {
  const sortedAccounts = [...accountIds].sort().join(",");
  const sortedProperties = [...propertyIds].sort().join(",");
  const scope = [sortedAccounts, sortedProperties].filter(Boolean).join("|") || "all";
  return `${userId}::${scope}::${datePreset}`;
}

export const defaultAppScope: AppScope = {
  selectedAccountIds: [],
  selectedPropertyIds: [],
  datePreset: "7",
  scopeMode: "all",
};

// ========== Recommendation Level (Priority Engine) ==========
export const recommendationLevels = ["immediate", "this_week", "schedule", "low", "ignore"] as const;
export type RecommendationLevel = (typeof recommendationLevels)[number];

export const recommendationLevelLabels: Record<RecommendationLevel, string> = {
  immediate: "立即處理",
  this_week: "本週優先",
  schedule: "可安排優化",
  low: "低優先級",
  ignore: "暫不處理",
};

export const recommendationLevelColors: Record<RecommendationLevel, string> = {
  immediate: "text-red-700 bg-red-50 border-red-200",
  this_week: "text-amber-700 bg-amber-50 border-amber-200",
  schedule: "text-blue-700 bg-blue-50 border-blue-200",
  low: "text-gray-600 bg-gray-50 border-gray-200",
  ignore: "text-gray-400 bg-gray-50/50 border-gray-100",
};

export function getRecommendationLevel(opportunityScore: number): RecommendationLevel {
  if (opportunityScore >= 21) return "immediate";
  if (opportunityScore >= 14) return "this_week";
  if (opportunityScore >= 8) return "schedule";
  if (opportunityScore >= 1) return "low";
  return "ignore";
}

// ========== Opportunity Score System ==========
export interface OpportunityBreakdown {
  revenueImpact: number;
  severity: number;
  ease: number;
  timeSensitivity: number;
}

export function calculateOpportunityScore(breakdown: OpportunityBreakdown): number {
  const weighted =
    breakdown.revenueImpact * 0.35 +
    breakdown.severity * 0.30 +
    breakdown.ease * 0.15 +
    breakdown.timeSensitivity * 0.20;
  return Math.round((weighted / 5) * 30);
}

export const opportunityIndexLabels: Record<string, string> = {
  "0-20": "改善空間有限，先處理別處",
  "21-40": "有局部可優化",
  "41-60": "有明顯機會",
  "61-80": "高機會值，應優先關注",
  "81-100": "高危高機會，現在不處理很可惜",
};

export function getOpportunityIndexLabel(index: number): string {
  if (index <= 20) return "改善空間有限";
  if (index <= 40) return "有局部可優化";
  if (index <= 60) return "有明顯機會";
  if (index <= 80) return "高機會值";
  return "高危高機會";
}

// ========== Dashboard ==========
export interface KPIMetric {
  key: string;
  label: string;
  value: number;
  change: number;
  format: "currency" | "percent" | "number" | "duration";
}

export interface TrendDataPoint {
  date: string;
  spend: number;
  conversions: number;
}

export interface FunnelStep {
  stage: string;
  value: number;
  rate: number;
}

export interface AdAccount {
  id: string;
  name: string;
  platform: string;
}

export const META_ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: "投放中",
  2: "已停用",
  3: "未結算",
  7: "待審核",
  8: "臨時不可用",
  9: "審核中",
  100: "已關閉",
  101: "需任何操作",
  201: "已暫停（寬限期）",
};

export interface MetaAdAccount {
  accountId: string;
  name: string;
  accountStatus: number;
  accountStatusLabel: string;
  currency: string;
  timezoneName: string;
  isFavorite?: boolean;
}

export interface MetaAccountsResponse {
  accounts: MetaAdAccount[];
  totalCount: number;
  message: string;
}

export interface AIInsight {
  summary: string;
  details: string[];
}

export interface HighRiskItem {
  id: string;
  name: string;
  type: "account" | "page" | "creative";
  problemTags: string[];
  severity: "critical" | "high" | "medium";
  opportunityScore: number;
  aiVerdict: string;
  opportunityBreakdown?: OpportunityBreakdown;
  estimatedImpact?: string;
}

export interface BusinessOverview {
  revenue: number;
  revenuePrev: number;
  spend: number;
  spendPrev: number;
  roas: number;
  roasPrev: number;
  conversionRate: number;
  conversionRatePrev: number;
  aov: number;
  aovPrev: number;
}

// ========== Uploads ==========
export interface UploadResult {
  id: string;
  fileName: string;
  fileType: string;
  url: string;
  size: number;
}

// ========== Judgment System ==========
export const judgmentTypes = ["creative", "landing_page", "fb_ads", "ga4_funnel"] as const;
export type JudgmentType = (typeof judgmentTypes)[number];

export const contentTypes = ["image", "video", "pdf", "url", "text"] as const;
export type ContentType = (typeof contentTypes)[number];

export type ContentPurpose = "selling" | "branding";
export type ContentDepth = "quick" | "full";

export const contentPurposeLabels: Record<ContentPurpose, string> = {
  selling: "賣貨",
  branding: "品牌",
};

export const contentDepthLabels: Record<ContentDepth, string> = {
  quick: "快速版",
  full: "完整版",
};

export function detectContentType(input: { hasFile?: boolean; fileType?: string; url?: string; text?: string }): ContentType {
  if (input.hasFile && input.fileType) {
    if (input.fileType.startsWith("image/")) return "image";
    if (input.fileType.startsWith("video/")) return "video";
    if (input.fileType === "application/pdf") return "pdf";
  }
  if (input.url) return "url";
  return "text";
}

export function contentTypeToJudgmentType(ct: ContentType): JudgmentType {
  switch (ct) {
    case "image": case "video": return "creative";
    case "url": return "landing_page";
    case "pdf": return "landing_page";
    case "text": return "creative";
  }
}

export interface ContentJudgmentResult {
  oneLineVerdict: string;
  keyPoints: string[];
  fullAnalysis: { title: string; content: string }[];
  nextActions: { label: string; description: string }[];
  followUpSuggestions: string[];
}

// ========== AI 總監對話工作區 (Review Session / Chat) ==========
export interface ChatMessageAttachment {
  type: "image" | "video" | "pdf";
  url: string;
  name?: string;
}

/** 審判官結構化輸出（後端解析或模型回傳），與前端裁決工作台對應 */
export type StructuredJudgmentProblemType = "創意" | "商品頁" | "投放" | "漏斗";
export type StructuredJudgmentConfidence = "高" | "中" | "低";

export interface StructuredJudgment {
  summary?: string;
  nextAction?: string;
  problemType?: StructuredJudgmentProblemType;
  recommendTask?: boolean;
  confidence?: StructuredJudgmentConfidence;
  reasons?: string;
  suggestions?: string;
  evidence?: string;
  /** 影響金額（可從 evidence 或結構化欄位推導） */
  impactAmount?: string;
  /** 綜合評分 0–100；通過與否由系統依 threshold 計算，不由模型回傳 */
  score?: number;
  /** 阻擋通過的原因（須先排除才能放行） */
  blockingReasons?: string[];
  /** 待補／待辦事項（非阻擋） */
  pendingItems?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatMessageAttachment[];
  createdAt: string;
  /** 審判官結構化欄位（後端解析 AI 回覆後填入）；有值時前端優先使用 */
  structuredJudgment?: StructuredJudgment;
}

export interface ReviewSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const structuredJudgmentSchema = z.object({
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  problemType: z.enum(["創意", "商品頁", "投放", "漏斗"]).optional(),
  recommendTask: z.boolean().optional(),
  confidence: z.enum(["高", "中", "低"]).optional(),
  reasons: z.string().optional(),
  suggestions: z.string().optional(),
  evidence: z.string().optional(),
  impactAmount: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  blockingReasons: z.array(z.string()).optional(),
  pendingItems: z.array(z.string()).optional(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  attachments: z.array(z.object({ type: z.enum(["image", "video", "pdf"]), url: z.string(), name: z.string().optional() })).optional(),
  createdAt: z.string(),
  structuredJudgment: structuredJudgmentSchema.optional(),
});

export const reviewSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  messages: z.array(chatMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** 前端上傳時送 data (base64) 或 fileUri（大檔先上傳 File API 後帶入）；後端傳給 Gemini 用 inlineData 或 fileData */
export const chatAttachmentSchema = z.object({
  type: z.enum(["image", "video", "pdf"]),
  url: z.string().optional(),
  /** 大檔（如影片）經 File API 上傳後由後端回傳的 URI */
  fileUri: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
});
/** 外層三模式，用於 RICH BEAR 審判官片段組裝 */
export const uiModeSchema = z.enum(["boss", "buyer", "creative"]);
export type UIMode = z.infer<typeof uiModeSchema>;

export const contentJudgmentChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  /** 審判官模式：boss / 投手(buyer) / 創意(creative)，有則用片段組裝，無則用設定頁 systemPrompt */
  uiMode: uiModeSchema.optional(),
  message: z.object({
    content: z.string().min(1, "請輸入內容"),
    attachments: z.array(chatAttachmentSchema).optional(),
  }),
});
export type ContentJudgmentChatRequest = z.infer<typeof contentJudgmentChatRequestSchema>;

export const judgmentTypeLabels: Record<JudgmentType, string> = {
  creative: "素材審判",
  landing_page: "銷售頁審判",
  fb_ads: "FB/Meta 廣告審判",
  ga4_funnel: "GA4 漏斗審判",
};

export const judgmentTypeDescriptions: Record<JudgmentType, string> = {
  creative: "看這支素材能不能打、該不該重做",
  landing_page: "看頁面能不能成交、掉單點在哪",
  fb_ads: "看素材好壞、預算該怎麼動",
  ga4_funnel: "看哪個頁面最會帶單、哪裡在漏",
};

export const analysisModes: Record<JudgmentType, { id: string; label: string }[]> = {
  creative: [
    { id: "main_material_check", label: "主力素材判讀" },
    { id: "biggest_problem", label: "找最大問題" },
    { id: "remake_better", label: "重做更會賣的版本" },
  ],
  landing_page: [
    { id: "conversion_break", label: "找最大成交斷點" },
    { id: "persuasion_vs_trust", label: "判斷缺說服還是缺信任" },
    { id: "priority_fix", label: "找最該先改的動作" },
  ],
  fb_ads: [
    { id: "account_overview", label: "帳號總體判讀" },
    { id: "best_worst_creative", label: "找出最好 / 最差素材" },
    { id: "budget_scaling", label: "預算與放量建議" },
  ],
  ga4_funnel: [
    { id: "funnel_health", label: "整體健康判讀" },
    { id: "biggest_drop", label: "找最大掉單點" },
    { id: "page_compare_fix", label: "頁面比較 / 判斷先修還是加流量" },
  ],
};

export const judgmentObjectives = analysisModes;

export const creativeScenarios = [
  { id: "cold_traffic", label: "冷流量" },
  { id: "retargeting", label: "再行銷" },
  { id: "website_purchase", label: "官網導購" },
  { id: "brand_awareness", label: "品牌曝光" },
] as const;

export type ReportGrade = "S" | "A" | "B" | "C" | "D" | "F";
export type Recommendation = "launch" | "scale" | "hold" | "stop" | "fix_first";

export const gradeLabels: Record<ReportGrade, string> = {
  S: "頂尖水準",
  A: "表現優秀",
  B: "合格",
  C: "需改善",
  D: "問題嚴重",
  F: "不合格",
};

export const recommendationLabels: Record<Recommendation, string> = {
  launch: "建議上線",
  scale: "可擴量",
  hold: "暫緩觀察",
  stop: "建議停止",
  fix_first: "先修再投",
};

export const recommendationColors: Record<Recommendation, string> = {
  launch: "text-emerald-700 bg-emerald-50 border-emerald-200",
  scale: "text-blue-700 bg-blue-50 border-blue-200",
  hold: "text-amber-700 bg-amber-50 border-amber-200",
  stop: "text-red-700 bg-red-50 border-red-200",
  fix_first: "text-orange-700 bg-orange-50 border-orange-200",
};

// ========== Base Types (shared patterns) ==========
export interface ScoredItem {
  judgmentScore: number;
  opportunityScore: number;
  recommendationLevel: RecommendationLevel;
}

export interface RankedAction {
  order: number;
  action: string;
  reason: string;
  opportunityScore: number;
}

// --- Report Summary (Decision Layer) ---
export interface ReportIssue {
  title: string;
  severity: "critical" | "high" | "medium";
  description: string;
}

export interface PriorityAction {
  order: number;
  action: string;
  reason?: string;
  impact: "high" | "medium" | "low";
  opportunityScore?: number;
}

export interface ReportSummary {
  score: number;
  grade: ReportGrade;
  verdict: string;
  topIssues: ReportIssue[];
  priorityActions: PriorityAction[];
  recommendation: Recommendation;
  recommendationNote: string;
  opportunityScore?: number;
}

// --- Diagnosis Dimension (shared across modules) ---
export interface DiagnosisDimension {
  score: number;
  analysis: string;
}

// --- Module Detail Types (Execution Layer) ---
export interface CreativeDetail {
  type: "creative";
  diagnosis: {
    hookStrength: DiagnosisDimension;
    emotionalTension: DiagnosisDimension;
    visualMemory: DiagnosisDimension;
    conversionPower: DiagnosisDimension;
    ctaClarity: DiagnosisDimension;
  };
  reasoning: string;
  executionSuggestions: string[];
  hookIdeas: string[];
  ctaIdeas: string[];
  openingFixes: string[];
  captionSuggestions: string[];
}

export interface LandingPageSectionFix {
  section: string;
  problem: string;
  suggestion: string;
}

export interface LandingPageDetail {
  type: "landing_page";
  diagnosis: {
    persuasionFlow: DiagnosisDimension;
    trustSignals: DiagnosisDimension;
    priceSupport: DiagnosisDimension;
    dropOffRisk: DiagnosisDimension;
    mobileExperience: DiagnosisDimension;
  };
  reasoning: string;
  deathPoints: string[];
  executionSuggestions: string[];
  rewriteIdeas: string[];
  sectionFixes: LandingPageSectionFix[];
  aovSuggestions: string[];
}

export interface FbAdsMetricAnalysis {
  metric: string;
  value: string;
  benchmark: string;
  status: "good" | "warning" | "danger";
  note: string;
}

export interface FbAdsDetail {
  type: "fb_ads";
  diagnosis: {
    creativeHealth: DiagnosisDimension;
    audienceMatch: DiagnosisDimension;
    fatigue: DiagnosisDimension;
    budgetEfficiency: DiagnosisDimension;
    scalability: DiagnosisDimension;
  };
  reasoning: string;
  executionSuggestions: string[];
  metricsAnalysis: FbAdsMetricAnalysis[];
  fatigueSignals: string[];
  audienceInsights: string[];
  scalingAdvice: string;
}

export interface FunnelBreakpoint {
  stage: string;
  dropRate: number;
  analysis: string;
  fix: string;
}

export interface GA4FunnelDetail {
  type: "ga4_funnel";
  diagnosis: {
    landingPageEfficiency: DiagnosisDimension;
    productPageConversion: DiagnosisDimension;
    cartAbandonment: DiagnosisDimension;
    checkoutFriction: DiagnosisDimension;
    overallFunnelHealth: DiagnosisDimension;
  };
  reasoning: string;
  executionSuggestions: string[];
  funnelBreakpoints: FunnelBreakpoint[];
  pageFixIdeas: string[];
  checkoutFixes: string[];
  trafficAdvice: string;
}

export type ModuleDetail = CreativeDetail | LandingPageDetail | FbAdsDetail | GA4FunnelDetail;

// --- Full Judgment Report ---
export interface JudgmentReport {
  id: string;
  caseId: string;
  version: number;
  parentReportId?: string;
  type: JudgmentType;
  userId: string;
  createdAt: string;
  input: {
    objective: string;
    notes?: string;
    attachments?: UploadResult[];
    rawData?: Record<string, any>;
  };
  summary: ReportSummary;
  detail: ModuleDetail;
}

// --- Judgment Record (list view) ---
export interface JudgmentRecord {
  id: string;
  caseId: string;
  version: number;
  type: JudgmentType;
  url?: string;
  score: number;
  grade: ReportGrade;
  verdict: string;
  recommendation: Recommendation;
  opportunityScore: number;
  recommendationLevel: RecommendationLevel;
  createdAt: string;
  status: "completed" | "pending";
  userId: string;
}

// --- Judgment Input Schema ---
export const judgmentInputSchema = z.object({
  type: z.enum(judgmentTypes),
  objective: z.string().min(1),
  analysisMode: z.string().optional().default(""),
  scenario: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  url: z.string().optional().default(""),
  adCopy: z.string().optional().default(""),
  metricsData: z.record(z.string(), z.any()).optional(),
  funnelData: z.record(z.string(), z.any()).optional(),
  searchQuery: z.string().optional().default(""),
  dateRange: z.string().optional().default(""),
  accountId: z.string().optional().default(""),
});

export type JudgmentInput = z.infer<typeof judgmentInputSchema>;

export const contentJudgmentInputSchema = z.object({
  purpose: z.enum(["selling", "branding"]).default("selling"),
  depth: z.enum(["quick", "full"]).default("full"),
  notes: z.string().optional().default(""),
  url: z.string().optional().default(""),
  text: z.string().optional().default(""),
  detectedType: z.enum(contentTypes).optional(),
});

export type ContentJudgmentInput = z.infer<typeof contentJudgmentInputSchema>;

// ========== FB Ads Data Types ==========
export interface FbAdCreative {
  id: string;
  name: string;
  adName: string;
  thumbnail: string;
  campaign: string;
  adSet: string;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
  conversions: number;
  impressions: number;
  clicks: number;
  trend7d: { ctr: number; roas: number; cpc: number };
  aiLabel: string;
  aiComment: string;
  status: "active" | "paused" | "ended";
  judgmentScore: number;
  opportunityScore: number;
  recommendationLevel: RecommendationLevel;
  suggestedAction: string;
  opportunityBreakdown?: OpportunityBreakdown;
  estimatedImpact?: string;
  scoring?: ScoringResult;
}

export interface FbKPICard {
  key: string;
  label: string;
  value: number;
  prevValue: number;
  change: number;
  format: "currency" | "percent" | "number" | "decimal";
  aiNote: string;
}

export interface FbAccountOverview {
  totalSpend: number;
  totalRevenue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  cvr: number;
  frequency: number;
  creativeCount: number;
  activeCount: number;
  stopSuggestionCount: number;
  highPotentialCount: number;
  fatigueCount: number;
  kpiCards: FbKPICard[];
  judgmentScore: number;
  opportunityScore: number;
  opportunityIndex: number;
  triScore?: TriScore;
  operationalHeadline: string;
}

export interface FbAIDirectorSummary {
  verdict: string;
  topAction: string;
  biggestWaste: string;
  bestDirection: string;
}

export interface FbCampaignStructure {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad";
  parentId?: string;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
  conversions: number;
  aiLabel: string;
  aiComment: string;
  judgmentScore: number;
  opportunityScore: number;
  recommendationLevel: RecommendationLevel;
  triScore?: TriScore;
  riskLevel?: RiskLevel;
  stopLossAdvice?: string;
  scoring?: ScoringResult;
}

export interface FbBudgetRecommendation {
  action: string;
  target: string;
  reason: string;
  expectedImpact: string;
  type: "increase" | "decrease" | "pause" | "test";
  opportunityScore: number;
  suggestedChange?: string;
  suggestedAmount?: string;
  safetyPace?: string;
  guardConditions?: string[];
  rollbackCondition?: string;
  confidenceScore?: number;
  whyNow?: string;
  risks?: string[];
  paceDescription?: string;
}

export interface FbAlert {
  id: string;
  type: "warning" | "opportunity";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  relatedCreative?: string;
  opportunityScore: number;
}

// ========== GA4 Data Types ==========
export interface GA4PageMetrics {
  id: string;
  pageName: string;
  path: string;
  sessions: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
  engagementRate: number;
  productViewRate: number;
  addToCartRate: number;
  checkoutRate: number;
  purchaseRate: number;
  overallConversionRate: number;
  aiLabel: string;
  aiComment: string;
  judgmentScore: number;
  opportunityScore: number;
  recommendationLevel: RecommendationLevel;
  suggestedAction: string;
  opportunityBreakdown?: OpportunityBreakdown;
  estimatedImpact?: string;
  scoring?: ScoringResult;
}

export interface GA4FunnelOverview {
  sessions: number;
  users: number;
  landingPageViews: number;
  productViews: number;
  productViewRate: number;
  addToCartCount: number;
  addToCartRate: number;
  checkoutStartCount: number;
  checkoutRate: number;
  purchases: number;
  purchaseRate: number;
  overallConversionRate: number;
  avgDuration: number;
  bounceRate: number;
  engagementRate: number;
  prevPeriod: {
    sessions: number;
    productViewRate: number;
    addToCartRate: number;
    checkoutRate: number;
    purchaseRate: number;
    overallConversionRate: number;
  };
}

export interface GA4FunnelSegment {
  from: string;
  to: string;
  conversionRate: number;
  dropRate: number;
  benchmark?: number;
  aiVerdict: string;
  problemType: string;
  relatedPages?: string[];
}

export interface FunnelDrillDownPage {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  metric: number;
  reason: string;
  fix: string;
}

export interface FunnelDrillDown {
  stage: string;
  topPages: FunnelDrillDownPage[];
}

export interface GA4DropPoint {
  stage: string;
  issue: string;
  severity: "critical" | "high" | "medium";
  fix: string;
  opportunityScore: number;
}

export interface GA4PageRanking {
  pageName: string;
  path: string;
  conversionRate: number;
  recommendation: "add_traffic" | "fix_first" | "use_as_template" | "monitor";
  reason: string;
}

export interface GA4AIDirectorSummary {
  verdict: string;
  biggestKiller: string;
  fixFirst: string;
  fixOrTraffic: string;
}

export interface GA4PriorityFix {
  order: number;
  action: string;
  reason: string;
  expectedImpact: string;
  opportunityScore: number;
}

// ========== Dashboard AI Types ==========
export interface TodayVerdict {
  verdict: string;
  context: string;
}

export interface TodayPriority {
  order: number;
  action: string;
  reason: string;
  impact: string;
  opportunityScore: number;
  estimatedImpact?: string;
}

// ========== Synced Account System ==========
export type PlatformType = "meta" | "ga4";
export type AccountSyncStatus = "active" | "disconnected" | "error";

export interface SyncedAccount {
  id: string;
  userId: string;
  platform: PlatformType;
  accountId: string;
  accountName: string;
  status: AccountSyncStatus;
  lastSyncedAt: string;
  isDefault: boolean;
  currency?: string;
  timezoneName?: string;
  metaAccountStatus?: number;
}

export interface PlatformConnection {
  platform: PlatformType;
  connected: boolean;
  accountCount: number;
  lastSyncedAt: string | null;
  userName?: string;
}

export interface AccountSyncResult {
  platform: PlatformType;
  success: boolean;
  accountsSynced: number;
  message: string;
  syncedAt: string;
}

// ========== Tri-Score Framework (V1 compatibility layer) ==========
export interface TriScore {
  health: number;
  urgency: number;
  scalePotential: number;
}

export type RiskLevel = "danger" | "warning" | "watch" | "stable" | "potential";

// ========== V2 Scoring System ==========

export type DiagnosisType =
  | "healthy"
  | "scaling_ready"
  | "creative_fatigue"
  | "roas_declining"
  | "roas_critical"
  | "ctr_declining"
  | "cpc_spike"
  | "budget_waste"
  | "audience_saturation"
  | "conversion_drop"
  | "funnel_leak"
  | "checkout_abandon"
  | "page_bounce"
  | "insufficient_data";

export const DIAGNOSIS_LABELS: Record<DiagnosisType, string> = {
  healthy: "健康",
  scaling_ready: "可擴量",
  creative_fatigue: "素材疲勞",
  roas_declining: "ROAS 下滑",
  roas_critical: "ROAS 危急",
  ctr_declining: "CTR 下滑",
  cpc_spike: "CPC 飆升",
  budget_waste: "預算浪費",
  audience_saturation: "受眾飽和",
  conversion_drop: "轉換下降",
  funnel_leak: "漏斗流失",
  checkout_abandon: "結帳放棄",
  page_bounce: "頁面跳出",
  insufficient_data: "數據不足",
};

export type RecommendedAction =
  | "maintain"
  | "scale_budget"
  | "reduce_budget"
  | "pause"
  | "refresh_creative"
  | "expand_audience"
  | "narrow_audience"
  | "ab_test"
  | "optimize_landing"
  | "simplify_checkout"
  | "add_trust_signals"
  | "monitor"
  | "restart"
  | "investigate";

export const ACTION_LABELS: Record<RecommendedAction, string> = {
  maintain: "維持現狀",
  scale_budget: "增加預算",
  reduce_budget: "降低預算",
  pause: "暫停投放",
  refresh_creative: "更換素材",
  expand_audience: "擴大受眾",
  narrow_audience: "縮小受眾",
  ab_test: "A/B 測試",
  optimize_landing: "優化著陸頁",
  simplify_checkout: "簡化結帳",
  add_trust_signals: "增加信任標誌",
  monitor: "持續觀察",
  restart: "重新啟用",
  investigate: "人工檢查",
};

export interface V2Scores {
  health: number;
  urgency: number;
  opportunity: number;
  confidence: number;
}

export interface ScoringResult {
  scores: V2Scores;
  diagnosis: DiagnosisType;
  recommendedAction: RecommendedAction;
  diagnosisLabel: string;
  actionLabel: string;
  benchmarkBasis: string;
  timeWindowBasis: string;
  notes: string[];
}

export interface BoardEntry {
  entityId: string;
  entityName: string;
  entityType: "campaign" | "page" | "account";
  scoring: ScoringResult;
  rank: number;
  spend?: number;
  roas?: number;
  keyMetric?: string;
  keyMetricValue?: number;
  listingReason: string;
}

export interface BoardSet {
  dangerBoard: BoardEntry[];
  stopLossBoard: BoardEntry[];
  opportunityBoard: BoardEntry[];
  scaleBoard: BoardEntry[];
  priorityBoard: BoardEntry[];
  leakageBoard: BoardEntry[];
}

export function triScoreToV2Scores(tri: TriScore, confidence: number): V2Scores {
  return {
    health: tri.health,
    urgency: tri.urgency,
    opportunity: tri.scalePotential,
    confidence,
  };
}

export interface WindowSnapshot {
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cvr: number;
  frequency: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface MultiWindowMetrics {
  window1d: WindowSnapshot;
  window3d: WindowSnapshot;
  window7d: WindowSnapshot;
  window14d: WindowSnapshot;
  prev1d: WindowSnapshot;
  prev3d: WindowSnapshot;
  prev7d: WindowSnapshot;
  prev14d: WindowSnapshot;
}

export type OpportunityType = "low_spend_high_efficiency" | "stable_scalable" | "new_potential" | "restartable";

export interface OpportunityCandidate {
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  type: OpportunityType;
  typeLabel: string;
  spendShare: number;
  roasVsAccountAvg: number;
  ctrVsAccountAvg: number;
  frequency: number;
  estimatedScalePotential: number;
  triScore: TriScore;
  riskLevel: RiskLevel;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  conversions: number;
  status: string;
  scoring?: ScoringResult;
}

export type PageGroup = "products" | "collections" | "pages" | "blogs" | "cart" | "checkout" | "homepage" | "other";

export const PAGE_GROUP_LABELS: Record<PageGroup, string> = {
  products: "商品頁",
  collections: "分類頁",
  pages: "內容頁",
  blogs: "部落格",
  cart: "購物車",
  checkout: "結帳",
  homepage: "首頁",
  other: "其他",
};

export function classifyPageGroup(pagePath: string): PageGroup {
  const p = pagePath.toLowerCase();
  if (p === "/" || p === "") return "homepage";
  if (p.startsWith("/products") || p.startsWith("/product")) return "products";
  if (p.startsWith("/collections") || p.startsWith("/collection")) return "collections";
  if (p.startsWith("/pages")) return "pages";
  if (p.startsWith("/blogs") || p.startsWith("/blog") || p.startsWith("/articles")) return "blogs";
  if (p.startsWith("/cart")) return "cart";
  if (p.startsWith("/checkout")) return "checkout";
  return "other";
}

export interface GA4PageMetricsDetailed {
  pagePath: string;
  pageTitle: string;
  pageGroup: PageGroup;
  sessions: number;
  pageviews: number;
  avgEngagementTime: number;
  bounceRate: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
  sessionsPrev: number;
  conversionRatePrev: number;
  revenuePrev: number;
  bounceRatePrev: number;
  triScore: TriScore;
  riskLevel: RiskLevel;
  scoring?: ScoringResult;
}

export interface PageRecommendation {
  diagnosis: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  affectedStage: string;
}

export interface StopLossResult {
  shouldStop: boolean;
  reasons: string[];
  criteria: {
    sampleMet: boolean;
    spendMet: boolean;
    multiWindowMet: boolean;
    vsAccountAvgMet: boolean;
    bottomPercentileMet: boolean;
    noImprovementMet: boolean;
  };
  timeWindow?: string;
  benchmark?: string;
  sustainedPattern?: string;
  possiblePageIssue?: string;
}

export interface DataSourceStatus {
  platform: PlatformType;
  connectionStatus: "connected" | "disconnected" | "not_configured";
  syncStatus: "synced" | "syncing" | "never_synced" | "error";
  selectionStatus: "selected" | "none_selected";
  analysisStatus: "analyzed" | "stale" | "never_analyzed";
  lastSyncedAt: string | null;
  lastAnalyzedAt: string | null;
  accountCount: number;
  selectedCount: number;
  message: string;
}

// ========== Ad Set & Ad Level Metrics ==========
export interface AdSetMetrics {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
  conversions: number;
  revenue: number;
}

export interface AdMetrics {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  adsetId: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
  conversions: number;
  revenue: number;
}

// ========== Analysis Pipeline Types ==========
export interface CampaignMetrics {
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  /** 加入購物車次數（ATC count），分母用 clicks；若無則可為 0 或由 GA  stitch 補 */
  addToCart?: number;
  frequency: number;
  spendPrev: number;
  roasPrev: number;
  ctrPrev: number;
  cpcPrev: number;
  cvrPrev: number;
  multiWindow?: MultiWindowMetrics;
  triScore?: TriScore;
  riskLevel?: RiskLevel;
  stopLoss?: StopLossResult;
  scoring?: ScoringResult;
}

export interface GA4FunnelMetrics {
  propertyId: string;
  propertyName: string;
  sessions: number;
  pageviews: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  revenue: number;
  sessionsPrev: number;
  addToCartPrev: number;
  beginCheckoutPrev: number;
  purchasesPrev: number;
  revenuePrev: number;
  conversionRate: number;
  conversionRatePrev: number;
  checkoutAbandonmentRate: number;
  checkoutAbandonmentRatePrev: number;
  addToCartRate: number;
  beginCheckoutRate: number;
  purchaseRate: number;
}

export type AnomalyType =
  | "roas_drop"
  | "cpc_spike"
  | "ctr_drop"
  | "cvr_drop"
  | "checkout_abandonment_spike"
  | "high_spend_low_efficiency"
  | "creative_fatigue"
  | "budget_concentration"
  | "ga_meta_mismatch";

export type AnomalyCategory = "ads" | "funnel" | "tracking" | "fatigue";

export interface Anomaly {
  id: string;
  accountId: string;
  accountName: string;
  type: AnomalyType;
  category: AnomalyCategory;
  severity: "critical" | "high" | "medium";
  title: string;
  description: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  relatedCampaign?: string;
  suggestedAction: string;
}

export interface AccountHealthScore {
  accountId: string;
  accountName: string;
  platform: PlatformType;
  priorityScore: number;
  healthStatus: "healthy" | "warning" | "danger";
  spend: number;
  revenue: number;
  roas: number;
  conversionRate: number;
  checkoutAbandonment: number;
  anomalyCount: number;
  topProblem: string;
  suggestedAction: string;
  aiPriorityReason?: string;
  aiRootCause?: string;
  triScore?: TriScore;
  riskLevel?: RiskLevel;
  scoring?: ScoringResult;
}

export interface RiskyCampaign {
  accountId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  riskType: "high_spend_low_efficiency" | "rapid_deterioration" | "low_spend_high_potential";
  spend: number;
  revenue: number;
  roas: number;
  suggestion: "stop" | "observe" | "scale";
  suggestionLabel: string;
  problemDescription: string;
  triScore?: TriScore;
  riskLevel?: RiskLevel;
  stopLoss?: StopLossResult;
  timeWindowBasis?: string;
  baselineComparison?: string;
}

export interface ProblemDiagnosis {
  adIssues: string;
  pageIssues: string;
  trackingIssues: string;
  marketFactors: string;
  stopLossSummary?: string;
}

export interface CrossAccountSummary {
  executiveSummary: string;
  topPriorityAccounts: AccountHealthScore[];
  urgentActions: { order: number; action: string; reason: string; impact: string; accountName: string }[];
  riskyCampaigns: RiskyCampaign[];
  scaleOpportunities: RiskyCampaign[];
  anomalies: Anomaly[];
  weeklyRecommendations: { today: string[]; thisWeek: string[]; budgetAdvice: string[]; opportunityActions?: string[] };
  problemDiagnosis?: ProblemDiagnosis;
  dataLastUpdatedAt: string | null;
  aiLastGeneratedAt: string | null;
  aiModelUsed: string;
  dataScope: "meta_only" | "ga4_only" | "both" | "none";
  analysisBatchId: string;
  dateLabel?: string;
}

export interface RefreshStatus {
  isRefreshing: boolean;
  currentStep: string;
  progress: number;
  lastRefreshedAt: string | null;
  lastAnalysisAt: string | null;
  lastAiSummaryAt: string | null;
}

// ========== Date Range Resolver ==========
export interface ResolvedDateRange {
  preset: string;
  startDate: string;
  endDate: string;
  comparisonStartDate: string;
  comparisonEndDate: string;
  label: string;
}

export function resolveDateRange(preset: string, customStart?: string, customEnd?: string): ResolvedDateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: Date;
  let endDate: Date = new Date(today);
  let days: number;
  let label: string;

  if (preset === "custom" && customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
    days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    label = `${customStart} ~ ${customEnd}`;
  } else if (preset === "today") {
    days = 1;
    startDate = new Date(today);
    label = "今天";
  } else if (preset === "yesterday") {
    days = 1;
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 1);
    endDate = new Date(startDate);
    label = "昨天";
  } else {
    days = parseInt(preset) || 7;
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    label = `近 ${days} 天`;
  }

  const compEnd = new Date(startDate);
  compEnd.setDate(compEnd.getDate() - 1);
  const compStart = new Date(compEnd);
  compStart.setDate(compStart.getDate() - days + 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return {
    preset,
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    comparisonStartDate: fmt(compStart),
    comparisonEndDate: fmt(compEnd),
    label,
  };
}

// ========== Prompt Mode Routing ==========
export const promptModeMap: Record<JudgmentType, "A" | "B" | "C" | "D"> = {
  creative: "A",
  landing_page: "B",
  fb_ads: "C",
  ga4_funnel: "D",
};

export const promptModeLabels: Record<"A" | "B" | "C" | "D", string> = {
  A: "素材煉金術",
  B: "轉單說服力",
  C: "廣告投放判決",
  D: "漏斗斷點審判",
};

// ========== Settings ==========
export interface UserSettings {
  userId: string;
  ga4PropertyId: string;
  fbAccessToken: string;
  aiApiKey: string;
  /** 單一 System Prompt：AI 總監核心大腦（V15 等整包），用於內容判讀對話工作區 */
  systemPrompt: string;
  coreMasterPrompt: string;
  modeAPrompt: string;
  modeBPrompt: string;
  modeCPrompt: string;
  modeDPrompt: string;
  severity: "strict" | "moderate" | "lenient";
  outputLength: "summary" | "standard" | "detailed";
  brandTone: "professional" | "direct" | "friendly" | "aggressive";
  analysisBias: "commercial" | "creative" | "conversion" | "brand";
}

export const settingsSchema = z.object({
  ga4PropertyId: z.string().optional().default(""),
  fbAccessToken: z.string().optional().default(""),
  aiApiKey: z.string().optional().default(""),
  systemPrompt: z.string().optional().default(""),
  coreMasterPrompt: z.string().optional().default(""),
  modeAPrompt: z.string().optional().default(""),
  modeBPrompt: z.string().optional().default(""),
  modeCPrompt: z.string().optional().default(""),
  modeDPrompt: z.string().optional().default(""),
  severity: z.enum(["strict", "moderate", "lenient"]).optional().default("moderate"),
  outputLength: z.enum(["summary", "standard", "detailed"]).optional().default("standard"),
  brandTone: z.enum(["professional", "direct", "friendly", "aggressive"]).optional().default("professional"),
  analysisBias: z.enum(["commercial", "creative", "conversion", "brand"]).optional().default("conversion"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

// ========== Analysis Batch ==========
export interface AnalysisBatch {
  batchId: string;
  userId: string;
  selectedAccountIds: string[];
  selectedPropertyIds: string[];
  dateRange: ResolvedDateRange;
  campaignMetrics: CampaignMetrics[];
  ga4Metrics: GA4FunnelMetrics[];
  ga4PageMetrics: GA4PageMetricsDetailed[];
  anomalies: Anomaly[];
  accountRankings: AccountHealthScore[];
  riskyCampaigns: RiskyCampaign[];
  scaleOpportunities: RiskyCampaign[];
  opportunities: OpportunityCandidate[];
  summary: CrossAccountSummary;
  boards?: BoardSet;
  adsetMetrics?: AdSetMetrics[];
  adMetrics?: AdMetrics[];
  generatedAt: string;
}

// ========== 素材投放中心 (MVP) ==========

/** 廣告目的 */
export const assetAdObjectives = ["sales", "leads", "traffic", "engagement"] as const;
export type AssetAdObjective = (typeof assetAdObjectives)[number];

export const assetAdObjectiveLabels: Record<AssetAdObjective, string> = {
  sales: "銷售",
  leads: "名單",
  traffic: "流量",
  engagement: "互動",
};

/** 素材類型 */
export const assetTypes = ["video", "image"] as const;
export type AssetType = (typeof assetTypes)[number];

export const assetTypeLabels: Record<AssetType, string> = {
  video: "影片",
  image: "圖片",
};

/** 素材尺寸比例 */
export const assetAspectRatios = ["9:16", "4:5", "1:1", "16:9"] as const;
export type AssetAspectRatio = (typeof assetAspectRatios)[number];

export const assetAspectRatioLabels: Record<AssetAspectRatio, string> = {
  "9:16": "9:16",
  "4:5": "4:5",
  "1:1": "1:1",
  "16:9": "16:9",
};

/** 素材狀態 */
export const assetStatuses = ["draft", "ready", "archived"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const assetStatusLabels: Record<AssetStatus, string> = {
  draft: "草稿",
  ready: "可投放",
  archived: "已封存",
};

/**
 * @deprecated 遷移過渡用。新邏輯請使用 AssetPackage + AssetVersion。
 * migration 完成後將移除，前端與後端請改用 asset-packages / asset-versions API。
 */
export interface Asset {
  id: string;
  userId: string;
  name: string;
  brandProductName: string;
  adObjective: AssetAdObjective;
  primaryCopy: string;
  headline: string;
  cta: string;
  landingPageUrl: string;
  assetType: AssetType;
  aspectRatio: AssetAspectRatio;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  note?: string;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
}

/** 素材包（主檔）：一組可重複使用的文案與設定，底下可掛多個素材版本 */
export interface AssetPackage {
  id: string;
  userId: string;
  name: string;
  brandProductName: string;
  adObjective: AssetAdObjective;
  primaryCopy: string;
  headline: string;
  cta: string;
  landingPageUrl: string;
  status: AssetStatus;
  note?: string;
  /** 標籤，第一版可預留不實作 */
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 主素材組：隸屬某素材包，一組 = 同一支創意（如 A版/B版），底下掛多尺寸版本（9:16、4:5、1:1） */
export interface AssetGroup {
  id: string;
  packageId: string;
  /** 顯示名稱，如 A版、B版、C版 */
  name: string;
  /** 選填，與 name 一起供命名範本使用 */
  variantCode?: string;
  /** 排序用，數字越小越前 */
  displayOrder?: number;
  createdAt: string;
}

/** 上傳儲存來源：讀檔時依此決定用哪個 provider，避免切換 local/NAS 後舊檔讀不到 */
export type StorageProvider = "local" | "nas";

/** 素材版本：隸屬某素材包，一筆 = 一個檔案的 metadata */
export interface AssetVersion {
  id: string;
  packageId: string;
  assetType: AssetType;
  aspectRatio: AssetAspectRatio;
  fileName: string;
  fileUrl: string;
  fileType: string;
  /** 該檔案實際存放的 provider；未設則視為 local（舊資料相容） */
  storageProvider?: StorageProvider;
  versionNote?: string;
  isPrimary: boolean;
  thumbnailUrl?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  createdAt: string;
  /** 解析後的主素材名稱，供批次建組「依主素材分組」使用 */
  parsedAssetName?: string;
  /** 解析後的版本/變體代號，與 parsedAssetName 一起組成主素材組 key */
  parsedVariantCode?: string;
  /** 所屬主素材組 ID；未設則為未分組，投放時依推測或 fallback 分組 */
  groupId?: string;
  /** 偵測：寬（像素） */
  detectedWidth?: number;
  /** 偵測：高（像素） */
  detectedHeight?: number;
  /** 偵測：依寬高算出的比例；可能與 aspectRatio 不同（使用者可手動改） */
  detectedAspectRatio?: AssetAspectRatio;
  /** 偵測：影片時長（秒） */
  detectedDurationSeconds?: number;
  /** 偵測狀態：success=從 metadata 取得、fallback=從檔名推測、failed=未取得需手動、manual_confirmed=使用者確認過 */
  detectStatus?: "success" | "fallback" | "failed" | "manual_confirmed";
  /** 偵測來源：metadata=從檔案讀取、filename=從檔名推測、manual=手動選擇 */
  detectSource?: "metadata" | "filename" | "manual";
  /** 主素材組歸屬來源：suggested=系統建議、manual=人工指定（用於 Badge 區分） */
  groupSource?: "suggested" | "manual";
}

/** 受眾策略 */
export const audienceStrategies = ["broad", "remarketing", "custom"] as const;
export type AudienceStrategy = (typeof audienceStrategies)[number];

export const audienceStrategyLabels: Record<AudienceStrategy, string> = {
  broad: "廣泛",
  remarketing: "再行銷",
  custom: "自訂",
};

/** Placement 策略 */
export const placementStrategies = ["auto", "feeds_only", "reels_stories"] as const;
export type PlacementStrategy = (typeof placementStrategies)[number];

export const placementStrategyLabels: Record<PlacementStrategy, string> = {
  auto: "自動",
  feeds_only: "動態牆",
  reels_stories: "Reels + Stories",
};

/** 投放草稿狀態 */
export const publishStatuses = ["draft", "ready", "published", "failed"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

export const publishStatusLabels: Record<PublishStatus, string> = {
  draft: "草稿",
  ready: "待發佈",
  published: "已發佈",
  failed: "失敗",
};

/** 投放草稿 (PublishDraft) */
export interface PublishDraft {
  id: string;
  userId: string;
  accountId: string;
  pageId?: string;
  igAccountId?: string;
  campaignObjective: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  budgetDaily?: number;
  budgetTotal?: number;
  scheduleStart?: string;
  scheduleEnd?: string;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  /** 選定的素材包 ID，用於帶入主文案/標題/CTA/落地頁（第一版一個 draft 只選一個包） */
  assetPackageId?: string;
  /** 選定的素材版本 ID 列表（可多個，同包底下多版本） */
  selectedVersionIds?: string[];
  /**
   * @deprecated 遷移過渡用。請改用 selectedVersionIds。migration 後由 selectedVersionIds 取代。
   */
  assetIds: string[];
  /** 覆寫：主文案（未設則沿用素材包） */
  primaryCopy?: string;
  /** 覆寫：標題（未設則沿用素材包） */
  headline?: string;
  /** 覆寫：說明/備註（未設則沿用素材包） */
  note?: string;
  /** 覆寫：CTA（未設則沿用素材包） */
  cta?: string;
  /** 覆寫：落地頁網址（未設則沿用素材包） */
  landingPageUrl?: string;
  status: PublishStatus;
  /** 同一批矩陣建稿共用之 UUID，供一鍵撤回/刪除整批草稿 */
  batchId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 投放紀錄 (PublishLog，最小可用：id, userId, draftId, status, message, createdAt) */
export interface PublishLog {
  id: string;
  userId: string;
  draftId: string;
  status: string;
  message: string;
  createdAt: string;
  /** 以下選填，方便列表顯示 */
  name?: string;
  accountId?: string;
  campaignObjective?: string;
  audienceStrategy?: string;
  placementStrategy?: string;
}

/** 投放範本：預算、受眾、CTA、網址、命名規則等，建立草稿時可載入 */
export interface PublishTemplate {
  id: string;
  userId: string;
  name: string;
  accountId?: string;
  pageId?: string;
  igAccountId?: string;
  budgetDaily?: number;
  budgetTotal?: number;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  cta?: string;
  landingPageUrl?: string;
  /** 命名範本，支援 {product} {date} {ratio} {seq} {prefix} */
  campaignNameTemplate?: string;
  adSetNameTemplate?: string;
  adNameTemplate?: string;
  createdAt: string;
}

// ========== 獲利規則中心 ==========
export interface ProductProfitRule {
  costRatio: number;
  targetNetMargin: number;
  minSpend: number;
  minClicks: number;
  minATC: number;
  minPurchases: number;
}

export const DEFAULT_PROFIT_RULE: ProductProfitRule = {
  costRatio: 0.4,
  targetNetMargin: 0.15,
  minSpend: 100,
  minClicks: 30,
  minATC: 3,
  minPurchases: 1,
};

export function breakEvenRoas(costRatio: number): number {
  if (costRatio >= 1) return Infinity;
  return 1 / (1 - costRatio);
}

export function targetRoas(costRatio: number, targetNetMargin: number): number {
  const margin = 1 - costRatio - targetNetMargin;
  if (margin <= 0) return Infinity;
  return 1 / margin;
}
