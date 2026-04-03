/**
 * 成績單預計算：供 refresh 寫入 batch.precomputedScorecard，GET 僅讀 + 依 groupBy 回傳。
 * 與 GET /api/dashboard/scorecard 回傳形狀相容。
 */
import type { AnalysisBatch, PrecomputedScorecardPayload } from "@shared/schema";
import type { CampaignMetrics } from "@shared/schema";
import { getWorkbenchMappingOverrides, resolveProductWithOverrides, getPublishedThresholdConfig, getWorkbenchOwners } from "./workbench-db";
import { parseCampaignNameToTags } from "@shared/tag-aggregation-engine";
import { toRoiRows, computeBaselineFromRows, getBaselineFor, computeRoiFunnel, DEFAULT_ROI_FUNNEL_THRESHOLDS, type RoiFunnelThresholds } from "@shared/roi-funnel-engine";

export async function buildScorecardPayload(batch: AnalysisBatch): Promise<PrecomputedScorecardPayload> {
  if (!batch.campaignMetrics?.length) {
    return {
      product: { items: [], groupBy: "product" },
      person: { groupBy: "person", itemsByBuyer: [], itemsByCreative: [] },
    };
  }

  const overrides = await getWorkbenchMappingOverrides();
  const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
    resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);

  const campaigns = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    accountId: c.accountId,
    spend: c.spend,
    revenue: c.revenue,
    roas: c.roas,
    clicks: c.clicks,
    addToCart: c.addToCart,
    conversions: c.conversions,
  }));
  const pairs = toRoiRows(campaigns, resolveProduct);
  const rows = pairs.map((p) => p.row);
  const productFilter = (row: { campaignId: string }) => pairs.find((x) => x.row.campaignId === row.campaignId)?.productName ?? null;
  const { baselines, scopeByProduct } = computeBaselineFromRows(rows, productFilter);
  const baselineResult = { baselines, scopeByProduct };
  const rawConfig = await getPublishedThresholdConfig();
  const thresholds: RoiFunnelThresholds = { ...DEFAULT_ROI_FUNNEL_THRESHOLDS, ...(rawConfig as Record<string, number>) };

  const byProduct = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
  for (const { row, productName } of pairs) {
    if (!productName) continue;
    const { baseline } = getBaselineFor(productName, row.accountId, baselineResult);
    const result = computeRoiFunnel(row, baseline, thresholds);
    const cur = byProduct.get(productName) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
    cur.launched += 1;
    if (result.label === "Winner") cur.success += 1;
    else if (result.label === "Underfunded") cur.underfunded += 1;
    else if (result.label === "Lucky" || result.label === "FunnelWeak" || result.label === "Retired") {
      cur.retired += 1;
      const reason = result.label;
      cur.retirementReasons[reason] = (cur.retirementReasons[reason] || 0) + 1;
    }
    if (result.label === "Lucky") cur.lucky += 1;
    if (result.evidence.funnelPass) cur.funnelPass += 1;
    cur.sumQualityScore += result.qualityScore;
    byProduct.set(productName, cur);
  }

  const owners = await getWorkbenchOwners();
  const itemShape = (name: string, stat: { launched: number; success: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }) => {
    const total = stat.launched;
    return {
      name,
      launchedCount: total,
      successCount: stat.success,
      successRate: total > 0 ? Math.round((stat.success / total) * 100) / 100 : 0,
      avgDaysToTarget: "-",
      retirementReasons: Object.entries(stat.retirementReasons).map(([reason, count]) => ({ reason, count })),
      luckyRate: total > 0 ? Math.round((stat.lucky / total) * 100) / 100 : 0,
      funnelPassRate: total > 0 ? Math.round((stat.funnelPass / total) * 100) / 100 : 0,
      avgQualityScore: total > 0 ? Math.round((stat.sumQualityScore / total) * 10) / 10 : 0,
    };
  };

  const productItems = Array.from(byProduct.entries()).map(([productName, stat]) => itemShape(productName, stat)).sort((a, b) => b.launchedCount - a.launchedCount);

  const byBuyer = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
  const byCreative = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
  for (const [productName, stat] of Array.from(byProduct.entries())) {
    const o = owners[productName];
    const buyerId = o?.productOwnerId?.trim() || "未指派";
    const creativeId = (o?.creativeOwnerId?.trim() || o?.mediaOwnerId?.trim()) || "未指派";
    const merge = (
      cur: { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> },
      s: typeof stat
    ) => {
      cur.launched += s.launched;
      cur.success += s.success;
      cur.underfunded += s.underfunded;
      cur.retired += s.retired;
      cur.lucky += s.lucky;
      cur.funnelPass += s.funnelPass;
      cur.sumQualityScore += s.sumQualityScore;
      for (const [r, c] of Object.entries(s.retirementReasons)) cur.retirementReasons[r] = (cur.retirementReasons[r] || 0) + (c as number);
    };
    const bCur = byBuyer.get(buyerId) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
    merge(bCur, stat);
    byBuyer.set(buyerId, bCur);
    const cCur = byCreative.get(creativeId) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
    merge(cCur, stat);
    byCreative.set(creativeId, cCur);
  }
  const itemsByBuyer = Array.from(byBuyer.entries()).map(([name, stat]) => itemShape(name, stat)).sort((a, b) => b.launchedCount - a.launchedCount);
  const itemsByCreative = Array.from(byCreative.entries()).map(([name, stat]) => itemShape(name, stat)).sort((a, b) => b.launchedCount - a.launchedCount);

  return {
    product: { items: productItems, groupBy: "product" },
    person: { groupBy: "person", itemsByBuyer, itemsByCreative },
  };
}
