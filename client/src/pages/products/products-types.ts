import type { deriveProductRow } from "@/lib/decision-workbench";

export type ProductBattleRow = ReturnType<typeof deriveProductRow> & {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  creativeCount: number;
  winnerCount: number;
  fatigueCount: number;
  data_confidence: "high" | "medium" | "low";
  unmappedSpend: number;
  conflictCount: number;
  overrideHitRate: number;
  hasRule?: boolean;
  costRuleStatus: string;
  creatives: Array<{ productName: string; roas: number; materialStrategy?: string; headlineSnippet?: string; spend?: number }>;
  breakEvenRoas: number | null;
  targetRoas: number | null;
  profitHeadroom: number | null;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  campaignCount?: number;
  evidenceLevel?: string;
  aiSuggestion?: string;
  ruleTags?: string[];
};
