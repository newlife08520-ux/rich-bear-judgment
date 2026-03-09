/**
 * 高手操作模擬引擎：獲利能力 × 趨勢感 × 漏斗穩定度 × 影響力 × 信心
 * Scale Readiness Score 1–100 + 預算建議（BaseChange × Confidence × Impact × Trend）
 */
import type { MultiWindowMetrics } from "@shared/schema";
import type { ProductProfitRule } from "@shared/schema";
import { breakEvenRoas, targetRoas, DEFAULT_PROFIT_RULE } from "@shared/schema";

export type BudgetActionType = "先降" | "小降觀察" | "維持" | "可加碼" | "高潛延伸";

export interface BudgetRecommendation {
  action: BudgetActionType;
  suggestedPct: number | "關閉";
  reason: string;
  whyNotMore: string;
}

export type TrendABC = "A" | "B" | "C" | null;

export interface TrendSignals {
  r1: number;
  r3: number;
  r7: number;
  trendCore: number;
  momentum: number;
  abc: TrendABC;
}

export interface ScaleReadinessBreakdown {
  profitReadiness: number;
  trendReadiness: number;
  funnelReadiness: number;
  impactScore: number;
  confidenceScore: number;
  scaleReadinessScore: number;
  profitHeadroom: number;
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

const W_PROFIT = 0.3;
const W_TREND = 0.25;
const W_FUNNEL = 0.2;
const W_IMPACT = 0.15;
const W_CONFIDENCE = 0.1;

/** ProfitHeadroom = (CurrentRoas - BE) / (Target - BE); <0 未保本, 0~1 過保本未達目標, >1 超目標 */
export function profitHeadroom(roas: number, costRatio: number, targetMargin: number): number {
  const be = breakEvenRoas(costRatio);
  const target = targetRoas(costRatio, targetMargin);
  if (target <= be || !Number.isFinite(target)) return roas >= target ? 1 : roas >= be ? 0.5 : 0;
  if (roas <= be) return (roas / be) - 1;
  return (roas - be) / (target - be);
}

/** 獲利準備 0–100：由 ProfitHeadroom 映射 */
export function profitReadiness(roas: number, rule: ProductProfitRule): number {
  const h = profitHeadroom(roas, rule.costRatio, rule.targetNetMargin);
  if (h >= 1) return 100;
  if (h >= 0) return 50 + Math.min(50, h * 50);
  return Math.max(0, 50 + h * 50);
}

/** R1/R3/R7 = Roas1d|3d|7d / BreakEvenRoas; TrendCore = 0.5*R1 + 0.3*R3 + 0.2*R7; Momentum = 0.45*(R1-R3) + 0.55*(R3-R7) */
export function trendSignals(mw: MultiWindowMetrics | undefined | null, be: number): TrendSignals {
  if (!mw || be <= 0) return { r1: 0, r3: 0, r7: 0, trendCore: 0, momentum: 0, abc: null };
  const r1v = mw.window1d.roas > 0 ? mw.window1d.roas / be : 0;
  const r3v = mw.window3d.roas > 0 ? mw.window3d.roas / be : 0;
  const r7v = mw.window7d.roas > 0 ? mw.window7d.roas / be : 0;
  const trendCore = 0.5 * r1v + 0.3 * r3v + 0.2 * r7v;
  const momentum = 0.45 * (r1v - r3v) + 0.55 * (r3v - r7v);
  let abc: TrendABC = null;
  if (r1v >= 1 && (r3v < 1 || r7v < 1)) abc = "A";
  else if (r1v < 1 && (r3v >= 1 || r7v >= 1)) abc = "B";
  else if (r1v >= 1 && r3v >= 1 && r7v >= 0.8) abc = "C";
  return { r1: r1v, r3: r3v, r7: r7v, trendCore, momentum, abc };
}

/** 趨勢準備 0–100：由 TrendCore 與 Momentum 綜合 */
export function trendReadiness(mw: MultiWindowMetrics | undefined | null, be: number): number {
  const t = trendSignals(mw, be);
  const coreScore = Math.min(100, t.trendCore * 50);
  const momScore = t.momentum > 0 ? 50 + Math.min(50, t.momentum * 25) : 50 + Math.max(-50, t.momentum * 25);
  return Math.max(0, Math.min(100, 0.6 * coreScore + 0.4 * momScore));
}

/** CartToBuyRatio = ATC / max(Purchase, 1). RatioScore: <=2.5 高分, 2.5~4 健康, 4~6 偏弱, >6 低分. IntentStrength = min(1, ATC/minATC). FunnelScore = 0.6*RatioScore + 0.4*IntentStrength */
function ratioToScore(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio <= 2.5) return 100;
  if (ratio <= 4) return 70;
  if (ratio <= 6) return 40;
  return 10;
}

export function funnelReadiness(addToCart: number, conversions: number, rule: ProductProfitRule): number {
  const atc = addToCart ?? 0;
  const purchases = Math.max(1, conversions);
  const cartToBuyRatio = atc / purchases;
  const ratioScore = ratioToScore(cartToBuyRatio);
  const intentStrength = rule.minATC > 0 ? Math.min(1, atc / rule.minATC) : (atc > 0 ? 1 : 0);
  const raw = 0.6 * ratioScore + 0.4 * intentStrength * 100;
  return Math.max(0, Math.min(100, raw));
}

/** ImpactScore = 0.6 * SpendShare + 0.4 * RevenueShare，縮放到 0–100 */
export function impactReadiness(spend: number, revenue: number, totalSpend: number, totalRevenue: number): number {
  if (totalSpend <= 0 && totalRevenue <= 0) return 50;
  const spendShare = totalSpend > 0 ? spend / totalSpend : 0;
  const revenueShare = totalRevenue > 0 ? revenue / totalRevenue : 0;
  const raw = 0.6 * spendShare + 0.4 * revenueShare;
  return Math.min(100, raw * 100 * 2);
}

/** 信心 0–100：來自樣本門檻達成度 */
export function confidenceReadiness(spend: number, clicks: number, addToCart: number, conversions: number, rule: ProductProfitRule): number {
  let s = 0;
  const n = 4;
  if (rule.minSpend > 0) s += Math.min(1, spend / rule.minSpend);
  else s += spend > 0 ? 1 : 0;
  if (rule.minClicks > 0) s += Math.min(1, clicks / rule.minClicks);
  else s += clicks > 0 ? 1 : 0;
  if (rule.minATC > 0) s += Math.min(1, (addToCart ?? 0) / rule.minATC);
  else s += (addToCart ?? 0) > 0 ? 1 : 0;
  if (rule.minPurchases > 0) s += Math.min(1, conversions / rule.minPurchases);
  else s += conversions > 0 ? 1 : 0;
  return (s / n) * 100;
}

export function computeScaleReadiness(input: ScaleScoreInput): { score: number; breakdown: ScaleReadinessBreakdown; trendSignals: TrendSignals } {
  const rule = input.rule ?? DEFAULT_PROFIT_RULE;
  const be = breakEvenRoas(rule.costRatio);
  const target = targetRoas(rule.costRatio, rule.targetNetMargin);

  const profitR = profitReadiness(input.roas, rule);
  const trendR = trendReadiness(input.multiWindow ?? null, be);
  const funnelR = funnelReadiness(input.addToCart ?? 0, input.conversions, rule);
  const impactR = impactReadiness(
    input.spend,
    input.revenue,
    input.totalAccountSpend ?? input.spend,
    input.totalAccountRevenue ?? input.revenue
  );
  const confR = confidenceReadiness(input.spend, input.clicks, input.addToCart ?? 0, input.conversions, rule);

  const score =
    W_PROFIT * profitR +
    W_TREND * trendR +
    W_FUNNEL * funnelR +
    W_IMPACT * impactR +
    W_CONFIDENCE * confR;
  const headroom = profitHeadroom(input.roas, rule.costRatio, rule.targetNetMargin);
  const trend = trendSignals(input.multiWindow ?? null, be);

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    breakdown: {
      profitReadiness: Math.round(profitR),
      trendReadiness: Math.round(trendR),
      funnelReadiness: Math.round(funnelR),
      impactScore: Math.round(impactR),
      confidenceScore: Math.round(confR),
      scaleReadinessScore: Math.min(100, Math.max(0, Math.round(score))),
      profitHeadroom: Math.round(headroom * 100) / 100,
    },
    trendSignals: trend,
  };
}

/** 預算建議：BaseChange × ConfidenceFactor × ImpactFactor × TrendFactor；並輸出為什麼不是更大或更小 */
export function getBudgetRecommendation(input: ScaleScoreInput): BudgetRecommendation {
  const rule = input.rule ?? DEFAULT_PROFIT_RULE;
  const be = breakEvenRoas(rule.costRatio);
  const target = targetRoas(rule.costRatio, rule.targetNetMargin);
  const { breakdown, trendSignals } = computeScaleReadiness(input);
  const headroom = profitHeadroom(input.roas, rule.costRatio, rule.targetNetMargin);

  let baseChange: number | "關閉" = 0;
  let action: BudgetActionType = "維持";
  let reason = "";
  let whyNotMore = "";

  if (headroom < 0 && input.spend >= rule.minSpend) {
    if (input.spend > 500) {
      baseChange = "關閉";
      action = "先降";
      reason = `ProfitHeadroom ${headroom.toFixed(2)}，未保本，高花費虧損`;
      whyNotMore = "已達先降上限，建議關閉止血";
    } else {
      baseChange = -30;
      action = "小降觀察";
      reason = `未保本，小降觀察`;
      whyNotMore = "樣本或花費未達極高，先降 30% 不直接關閉";
    }
  } else if (trendSignals.abc === "A") {
    baseChange = -15;
    action = "小降觀察";
    reason = "1d 強但 3d/7d 弱，假強型，Momentum 轉弱";
    whyNotMore = "避免誤判為可加碼，先小降觀察";
  } else if (trendSignals.abc === "B") {
    baseChange = 0;
    action = "維持";
    reason = "1d 弱但 3d/7d 強，延遲型好貨";
    whyNotMore = "暫不加碼，等 1d 跟上再考慮";
  } else if (trendSignals.abc === "C" && headroom >= 1 && breakdown.funnelReadiness >= 60) {
    const share = input.totalAccountSpend ? input.spend / input.totalAccountSpend : 0;
    if (share < 0.15) {
      baseChange = 20;
      action = "高潛延伸";
      reason = "可拉升型，花費佔比低，TrendCore 與漏斗佳";
      whyNotMore = "高潛但先 +20%，避免一次拉太高";
    } else {
      baseChange = 15;
      action = "可加碼";
      reason = "可拉升型，趨勢與漏斗達標";
      whyNotMore = "已達目標區間，+15% 為穩健加碼";
    }
  } else if (headroom >= 1 && breakdown.confidenceScore >= 70) {
    baseChange = 10;
    action = "可加碼";
    reason = "超目標、信心足";
    whyNotMore = "樣本足夠才給加碼，幅度 10% 保守";
  } else if (headroom >= 0 && headroom < 1) {
    baseChange = 0;
    action = "維持";
    reason = "過保本未達目標，維持觀察";
    whyNotMore = "未達目標 ROAS 不建議加碼";
  } else if (breakdown.confidenceScore < 40) {
    baseChange = 0;
    action = "維持";
    reason = "樣本不足，不調整";
    whyNotMore = "信心低不給幅度，避免誤判";
  } else {
    baseChange = -10;
    action = "小降觀察";
    reason = "綜合未達加碼條件，小降觀察";
    whyNotMore = "趨勢或漏斗一般，先小降 10%";
  }

  const confidenceFactor = breakdown.confidenceScore >= 70 ? 1.0 : breakdown.confidenceScore >= 40 ? 0.7 : 0.4;
  const spendShare = (input.totalAccountSpend ?? input.spend) > 0 ? input.spend / (input.totalAccountSpend ?? input.spend) : 0;
  const impactFactor = spendShare >= 0.2 ? 1.2 : spendShare >= 0.05 ? 1.0 : 0.8;
  const trendFactor = trendSignals.momentum > 0.1 ? 1.2 : trendSignals.momentum > -0.1 ? 1.0 : trendSignals.abc === "A" ? 0.5 : 0.8;

  const numericBase = baseChange === "關閉" ? -100 : baseChange;
  const adjusted = baseChange === "關閉" ? "關閉" : Math.round(numericBase * confidenceFactor * impactFactor * trendFactor);
  const suggestedPct = baseChange === "關閉" ? "關閉" : (adjusted as number);

  return {
    action,
    suggestedPct,
    reason,
    whyNotMore,
  };
}

/** 相容舊 API：BudgetAction 形狀 */
export function getBudgetAction(input: ScaleScoreInput): { action: BudgetActionType; suggestedPct: number | "關閉"; reason: string } {
  const r = getBudgetRecommendation(input);
  return { action: r.action, suggestedPct: r.suggestedPct, reason: r.reason };
}

export function getTrendABC(mw: MultiWindowMetrics | undefined | null, be: number): TrendABC {
  return trendSignals(mw, be).abc;
}

/** 創意邊緣：CreativeEdge = CreativeRoas / ProductAverageRoas。高潛延伸池：CreativeEdge 高、FunnelScore 好、樣本非 0、花費仍低 */
export function creativeEdge(creativeRoas: number, productAverageRoas: number): number {
  if (productAverageRoas <= 0) return creativeRoas > 0 ? 2 : 0;
  return creativeRoas / productAverageRoas;
}
