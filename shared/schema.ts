import { z } from "zod";

export {
  BATCH_COMPUTATION_VERSION,
  BATCH_VALIDITY_VALID,
  BATCH_VALIDITY_LEGACY,
  BATCH_VALIDITY_INSUFFICIENT,
  type BatchValidity,
} from "./schema/batch-version-constants";

export { TRUTH_PACK_DOC_VERSION } from "./schema/truth-pack-constants";

export {
  userRoles,
  workRoles,
  workRoleLabels,
  loginSchema,
  type UserRole,
  type WorkRole,
  type User,
  type SafeUser,
  type LoginInput,
  type InsertUser,
} from "./schema/auth-basics";

export { dateRangeOptions } from "./schema/date-range-options";

export * from "./schema/publish-draft-contract";

import type { RecommendationLevel } from "./schema/recommendation-level";

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
  datePreset: string,
  customStart?: string,
  customEnd?: string
): string {
  const sortedAccounts = [...accountIds].sort().join(",");
  const sortedProperties = [...propertyIds].sort().join(",");
  const scope = [sortedAccounts, sortedProperties].filter(Boolean).join("|") || "all";
  const datePart =
    datePreset === "custom" && customStart && customEnd
      ? `custom:${customStart}~${customEnd}`
      : datePreset;
  return `${userId}::${scope}::${datePart}`;
}

export const defaultAppScope: AppScope = {
  selectedAccountIds: [],
  selectedPropertyIds: [],
  datePreset: "7",
  scopeMode: "all",
};

export {
  recommendationLevels,
  type RecommendationLevel,
  recommendationLevelLabels,
  recommendationLevelColors,
  getRecommendationLevel,
} from "./schema/recommendation-level";

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
/** 外層三模式，用於審判官頁面片段組裝 */
export const uiModeSchema = z.enum(["boss", "buyer", "creative"]);
export type UIMode = z.infer<typeof uiModeSchema>;

/** 工作流：陪跑收斂 / 創作 / 審判 / 策略 / 任務；影響 system overlay、輸出格式、行為規則（定版 5 個） */
export const workflowSchema = z.enum(["clarify", "create", "audit", "strategy", "task"]);
export type Workflow = z.infer<typeof workflowSchema>;

export const workflowLabels: Record<Workflow, string> = {
  clarify: "陪跑收斂",
  create: "幫我做",
  audit: "幫我審",
  strategy: "看策略",
  task: "轉任務",
};

export const contentJudgmentChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  /** 審判官模式：boss / 投手(buyer) / 創意(creative)，有則用片段組裝，無則用設定頁 systemPrompt */
  uiMode: uiModeSchema.optional(),
  /** 工作流偏向：有則依此選 overlay 與輸出格式；無則由後端依訊息意圖推斷 */
  workflow: workflowSchema.optional(),
  /** 規則引擎建議動作（可選）；當前端在「有系統建議」的情境下送 audit 時帶入，供後端對齊 AI 輸出，避免矛盾。信任邊界：後端僅在能從 server-side 取得時才用於 alignment，見 contextCampaignId。 */
  systemAction: z.string().optional(),
  /** 規則引擎建議幅度（可選），如 15、"關閉" */
  systemPct: z.union([z.number(), z.string()]).optional(),
  /** 可選。當帶入且後端可由 batch.precomputedActionCenter 依此 campaignId 取得系統判定時，以該筆 suggestedAction/suggestedPct 作為 alignment 依據（不信任 body 的 systemAction/systemPct）。 */
  contextCampaignId: z.string().optional(),
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
  /** 由活動／廣告名稱括號等規則擷取，供 UI 與 Pareto 對齊；非權威歸因 */
  parsedProductName?: string | null;
  parseSource?: "campaign_brackets" | "none";
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
  /** 用於「套用預算」時傳給 execution layer */
  campaignId?: string;
  /** 建議每日預算（數字），供套用預算按鈕使用 */
  suggestedBudgetDaily?: number;
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
  /** 6.3：目標成果／節奏（資料來源可為 Meta 匯入或手動；缺則為 undefined，不得亂猜） */
  biddingType?: string | null;
  targetOutcomeValue?: number | null;
  todayAdjustCount?: number | null;
  observationWindowUntil?: string | null;
  lastAdjustType?: string | null;
  lastAdjustAt?: string | null;
  /** 0~1 預算吃滿度 */
  spendFullness?: number | null;
  /** Commercial：AdSet daily_budget（Graph 最小幣別單位，如分）供 out-of-band 比對 */
  dailyBudgetMinor?: number | null;
  /** Campaign effective_status（Graph） */
  metaEffectiveStatus?: string | null;
  /** Campaign updated_time（Graph ISO） */
  metaUpdatedAt?: string | null;
  /** 第一個 AdSet effective_status（學習期／投放狀態 heuristics） */
  metaAdSetEffectiveStatus?: string | null;
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
  /** 跨帳摘要來源：AI 生成或規則式填字（無 API key / 失敗時為 deterministic） */
  summarySource?: "ai" | "deterministic";
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

/** 階段二：Refresh Job 持久化；失敗時 errorStage 分類 */
export type RefreshJobErrorStage =
  | "meta_fetch"
  | "ga4_fetch"
  | "aggregation"
  | "precompute"
  | "persist"
  | "publish"
  | "recovery"
  | "unknown";

export type RefreshJobStatus = "pending" | "running" | "succeeded" | "failed";

export interface RefreshJob {
  jobId: string;
  userId: string;
  scopeKey: string;
  lockKey: string;
  status: RefreshJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  errorStage: RefreshJobErrorStage | null;
  resultBatchKey: string | null;
  attemptCount: number;
  triggerSource: string;
  progressStep: number | null;
  progressMessage: string | null;
  /** 執行時所需參數，建立 job 時寫入 */
  datePreset: string;
  customStart?: string;
  customEnd?: string;
  selectedAccountIds: string[];
  selectedPropertyIds: string[];
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
/** 連線驗證狀態：idle=尚未驗證 / success=驗證成功 / error=驗證失敗 */
export type ConnectionVerificationStatus = "idle" | "success" | "error";

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
  // --- 驗證狀態持久化（測試連線後寫入；欄位值變更時應失效）---
  fbStatus: ConnectionVerificationStatus;
  gaStatus: ConnectionVerificationStatus;
  aiStatus: ConnectionVerificationStatus;
  fbVerifiedAt: string | null;
  gaVerifiedAt: string | null;
  aiVerifiedAt: string | null;
  fbLastError: string | null;
  gaLastError: string | null;
  aiLastError: string | null;
  /** 驗證成功時用的 value fingerprint，用於偵測欄位變更後失效 */
  fbValidatedValueHash: string | null;
  gaValidatedValueHash: string | null;
  aiValidatedValueHash: string | null;
}

export const settingsSchema = z.object({
  ga4PropertyId: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  fbAccessToken: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  aiApiKey: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  systemPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  coreMasterPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  modeAPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  modeBPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  modeCPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  modeDPrompt: z.union([z.string(), z.null()]).optional().default("").transform((v) => (v == null ? "" : String(v))),
  severity: z.enum(["strict", "moderate", "lenient"]).optional().nullable().transform((v) => (v ?? "moderate")),
  outputLength: z.enum(["summary", "standard", "detailed"]).optional().nullable().transform((v) => (v ?? "standard")),
  brandTone: z.enum(["professional", "direct", "friendly", "aggressive"]).optional().nullable().transform((v) => (v ?? "professional")),
  analysisBias: z.enum(["commercial", "creative", "conversion", "brand"]).optional().nullable().transform((v) => (v ?? "conversion")),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

// ========== Analysis Batch ==========
// BATCH_COMPUTATION_VERSION：見檔首 re-export（./schema/batch-version-constants）

/** 行動中心預計算 payload 與 GET /api/dashboard/action-center 回傳形狀一致（可為 unknown 以容納既有複雜型別） */
export type PrecomputedActionCenterPayload = Record<string, unknown>;

/** 成績單預計算：product 與 person 兩種 groupBy 結果 */
export interface PrecomputedScorecardPayload {
  product?: { items: unknown[]; groupBy: "product" };
  person?: { groupBy: "person"; itemsByBuyer: unknown[]; itemsByCreative: unknown[] };
}

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
  /** 預計算行動中心 payload；GET 可優先使用，缺則 fallback 即時算（僅供舊 batch 過渡） */
  precomputedActionCenter?: PrecomputedActionCenterPayload | null;
  /** 預計算成績單 payload；GET 可優先使用，缺則 fallback 即時算（僅供舊 batch 過渡） */
  precomputedScorecard?: PrecomputedScorecardPayload | null;
  /** 預計算完成時間 ISO；僅在 precomputedActionCenter 與 precomputedScorecard 皆成功寫入後才設定 */
  precomputeCompletedAt?: string | null;
  /** 預計算版本，與 BATCH_COMPUTATION_VERSION 對齊；僅在預計算成功後才設定 */
  computationVersion?: string | null;
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

// ========== 資料狀態（決策潔淨：no_delivery / under_sample / decision_ready）==========
/** 花費 0 或曝光 0 ＝ 未投遞，不得進核心決策榜單 */
export const DATA_STATUS_NO_DELIVERY = "no_delivery";
/** 有花費但未達最小樣本門檻 ＝ 樣本不足，不得進黑榜/先救 */
export const DATA_STATUS_UNDER_SAMPLE = "under_sample";
/** 已達可判讀門檻 */
export const DATA_STATUS_DECISION_READY = "decision_ready";
export type DataStatus = typeof DATA_STATUS_NO_DELIVERY | typeof DATA_STATUS_UNDER_SAMPLE | typeof DATA_STATUS_DECISION_READY;

// ========== 證據層級（§35 API contract、§41 總監語言）==========
/** 僅廣告層數據，不得確診站內漏斗 */
export const EVIDENCE_ADS_ONLY = "ads_only";
/** 已有 GA／漏斗證據 */
export const EVIDENCE_GA_VERIFIED = "ga_verified";
/** 成本規則未補齊，不得高信心判賺錢／可放大 */
export const EVIDENCE_RULES_MISSING = "rules_missing";
/** 樣本不足，不建議重判 */
export const EVIDENCE_INSUFFICIENT_SAMPLE = "insufficient_sample";
/** 未投遞／花費 0，不進核心判斷 */
export const EVIDENCE_NO_DELIVERY = "no_delivery";
export type EvidenceLevel =
  | typeof EVIDENCE_ADS_ONLY
  | typeof EVIDENCE_GA_VERIFIED
  | typeof EVIDENCE_RULES_MISSING
  | typeof EVIDENCE_INSUFFICIENT_SAMPLE
  | typeof EVIDENCE_NO_DELIVERY;

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  [EVIDENCE_ADS_ONLY]: "廣告層推測",
  [EVIDENCE_GA_VERIFIED]: "已有 GA 證據",
  [EVIDENCE_RULES_MISSING]: "規則缺失",
  [EVIDENCE_INSUFFICIENT_SAMPLE]: "樣本不足",
  [EVIDENCE_NO_DELIVERY]: "尚未投遞",
};

// ========== Latest valid batch（§36、Phase 2A Guardrail 6）==========
// BATCH_VALIDITY_* / BatchValidity：見 ./schema/batch-version-constants
