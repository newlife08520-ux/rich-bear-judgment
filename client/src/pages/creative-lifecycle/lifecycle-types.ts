export type LifecycleItem = { id: string; name: string; roas: number; spend: number; reason: string };

export type LifecycleLabel =
  | "Lucky"
  | "Winner"
  | "Underfunded"
  | "FunnelWeak"
  | "Retired"
  | "NEEDS_MORE_DATA"
  | "STABLE";

export type LifecycleCardItem = LifecycleItem & {
  campaignId?: string;
  atc: number;
  purchase: number;
  atc_rate: number;
  purchase_rate: number;
  atcRateBaseline: number;
  purchaseRateBaseline: number;
  confidenceLevel: string;
  label: LifecycleLabel;
  qualityScore: number;
  priority?: number;
  baseline_scope?: string;
  stage?: string;
  scaleReadinessScore?: number;
  suggestedAction?: string;
  suggestedPct?: number | "關閉";
  whyNotMore?: string;
  firstReviewVerdict?: string;
  firstReviewScore?: number | null;
  firstReviewRecommendTest?: boolean | null;
  savedDecision?: string | null;
  battleVerdict?: string;
  forBuyer?: string;
  forDesign?: string;
};

export type InspirationItem = {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  creativeEdge: number;
  winReason: string;
  extendDirection: string;
  designTakeaway: string;
};

export type LifecycleApiData = {
  items: LifecycleCardItem[];
  success: LifecycleItem[];
  underfunded: LifecycleItem[];
  retired: LifecycleItem[];
  inspirationPool: InspirationItem[];
  stages: string[];
  firstDecisionSpendMin?: number;
  firstDecisionSpendMax?: number;
};
