/**
 * Scale Score 1–100 + 預算動作 + A/B/C 趨勢判斷
 */
import type { MultiWindowMetrics, WindowSnapshot } from "@shared/schema";
import type { ProductProfitRule } from "@shared/schema";
import { breakEvenRoas, targetRoas, DEFAULT_PROFIT_RULE } from "@shared/schema";

export type BudgetActionType = "先降" | "小降觀察" | "維持" | "可加碼" | "高潛延伸";

export interface BudgetAction {
  action: BudgetActionType;
  suggestedPct: number | "關閉";
  reason: string;
}

export type TrendABC = "A" | "B" | "C" | null;

export interface ScaleScoreBreakdown {
  profitScore: number;
  trendScore: number;
  funnelScore: number;
  impactScore: number;
  confidenceScore: number;
  total: number;
}

export interface ScaleScoreInput {
  spend: number;
  revenue: number;
  roas: number;
  addToCart?: number;
  conversions: number;
  clicks: number;
  impressions: number;
  multiWindow?: MultiWindowMetrics | null;
  totalAccountSpend?: number;
  totalAccountRevenue?: number;
  rule?: ProductProfitRule | null;
}

function roasGood(w: WindowSnapshot, be: number, target: number): boolean {
  if (w.roas <= 0) return false;
  return w.roas >= target;
}
function roasBad(w: WindowSnapshot, be: number): boolean {
  if (w.roas <= 0) return true;
  return w.roas < be;
}

export function profitScore(roas: number, rule: ProductProfitRule): number {
  const be = breakEvenRoas(rule.costRatio);
  const target = targetRoas(rule.costRatio, rule.targetNetMargin);
  if (roas >= target) return 20;
  if (roas >= be) return 10 + (10 * (roas - be)) / (target - be);
  if (roas > 0) return Math.max(0, (10 * roas) / be);
  return 0;
}

export function trendScore(mw: MultiWindowMetrics | undefined | null, be: number, target: number): number {
  if (!mw) return 10;
  const g1 = roasGood(mw.window1d, be, target);
  const g3 = roasGood(mw.window3d, be, target);
  const g7 = roasGood(mw.window7d, be, target);
  const b1 = roasBad(mw.window1d, be);
  const b3 = roasBad(mw.window3d, be);
  const b7 = roasBad(mw.window7d, be);
  if (g1 && g3 && g7) return 20;
  if (g1 && g3 && !b7) return 16;
  if (g1 && !b3) return 12;
  if (!b1 && g3 && g7) return 14;
  if (b1 && (g3 || g7)) return 8;
  if (g1 && b3 && b7) return 4;
  if (b1 && b3 && b7) return 0;
  return 10;
}

export function funnelScore(addToCart: number, conversions: number, rule: ProductProfitRule): number {
  const atc = addToCart ?? 0;
  const ratio = atc > 0 ? conversions / atc : 0;
  let s = 0;
  if (atc >= rule.minATC) s += 10;
  else if (atc > 0) s += (5 * atc) / rule.minATC;
  if (conversions >= rule.minPurchases) s += 10;
  else if (ratio >= 0.1) s += 8;
  else if (ratio >= 0.05) s += 4;
  return Math.min(20, s);
}

export function impactScore(spend: number, revenue: number, totalSpend: number, totalRevenue: number): number {
  if (totalSpend <= 0 && totalRevenue <= 0) return 10;
  const spendShare = totalSpend > 0 ? spend / totalSpend : 0;
  const revenueShare = totalRevenue > 0 ? revenue / totalRevenue : 0;
  return Math.min(20, revenueShare * 15 + Math.min(5, spendShare * 20));
}

export function confidenceScore(spend: number, clicks: number, addToCart: number, conversions: number, rule: ProductProfitRule): number {
  let s = 0;
  if (spend >= rule.minSpend) s += 5;
  else if (spend > 0) s += (2.5 * spend) / rule.minSpend;
  if (clicks >= rule.minClicks) s += 5;
  else if (clicks > 0) s += (2.5 * clicks) / rule.minClicks;
  if ((addToCart ?? 0) >= rule.minATC) s += 5;
  if (conversions >= rule.minPurchases) s += 5;
  return Math.min(20, s);
}

export function computeScaleScore(input: ScaleScoreInput): { score: number; breakdown: ScaleScoreBreakdown } {
  const rule = input.rule ?? DEFAULT_PROFIT_RULE;
  const be = breakEvenRoas(rule.costRatio);
  const target = targetRoas(rule.costRatio, rule.targetNetMargin);
  const profit = profitScore(input.roas, rule);
  const trend = trendScore(input.multiWindow ?? null, be, target);
  const funnel = funnelScore(input.addToCart ?? 0, input.conversions, rule);
  const impact = impactScore(input.spend, input.revenue, input.totalAccountSpend ?? input.spend, input.totalAccountRevenue ?? input.revenue);
  const confidence = confidenceScore(input.spend, input.clicks, input.addToCart ?? 0, input.conversions, rule);
  const total = Math.min(100, Math.max(0, Math.round(profit + trend + funnel + impact + confidence)));
  return {
    score: total,
    breakdown: { profitScore: Math.round(profit), trendScore: Math.round(trend), funnelScore: Math.round(funnel), impactScore: Math.round(impact), confidenceScore: Math.round(confidence), total },
  };
}

export function getTrendABC(mw: MultiWindowMetrics | undefined | null, be: number, target: number): TrendABC {
  if (!mw) return null;
  const g1 = roasGood(mw.window1d, be, target);
  const g3 = roasGood(mw.window3d, be, target);
  const g7 = roasGood(mw.window7d, be, target);
  const b1 = roasBad(mw.window1d, be);
  const b3 = roasBad(mw.window3d, be);
  const b7 = roasBad(mw.window7d, be);
  if (g1 && (b3 || b7)) return "A";
  if (b1 && (g3 || g7)) return "B";
  if (g1 && g3 && !b7) return "C";
  return null;
}

export function getBudgetAction(input: ScaleScoreInput): BudgetAction {
  const rule = input.rule ?? DEFAULT_PROFIT_RULE;
  const be = breakEvenRoas(rule.costRatio);
  const target = targetRoas(rule.costRatio, rule.targetNetMargin);
  const { breakdown } = computeScaleScore(input);
  const abc = getTrendABC(input.multiWindow ?? null, be, target);

  if (input.roas < be && input.spend >= rule.minSpend) {
    if (input.spend > 500) return { action: "先降", suggestedPct: "關閉", reason: `ROAS ${input.roas.toFixed(2)} 低於保本 ${be.toFixed(2)}` };
    return { action: "小降觀察", suggestedPct: -30, reason: "ROAS 低於保本，建議降 30%" };
  }
  if (abc === "A") return { action: "小降觀察", suggestedPct: -15, reason: "1d 好 3d/7d 差，假強型" };
  if (abc === "B") return { action: "維持", suggestedPct: 0, reason: "1d 差 3d/7d 好，延遲型好貨" };
  if (abc === "C" && input.roas >= target && breakdown.funnelScore >= 10) {
    const share = input.totalAccountSpend ? input.spend / input.totalAccountSpend : 0;
    if (share < 0.15) return { action: "高潛延伸", suggestedPct: 20, reason: "可拉升型，花費佔比低" };
    return { action: "可加碼", suggestedPct: 15, reason: "可拉升型" };
  }
  if (input.roas >= target && breakdown.confidenceScore >= 12) return { action: "可加碼", suggestedPct: 10, reason: "ROAS 達目標、樣本足" };
  if (input.roas >= be && input.roas < target) return { action: "維持", suggestedPct: 0, reason: "介於保本與目標間" };
  if (breakdown.confidenceScore < 8) return { action: "維持", suggestedPct: 0, reason: "樣本不足" };
  return { action: "小降觀察", suggestedPct: -10, reason: "綜合一般，小降觀察" };
}
