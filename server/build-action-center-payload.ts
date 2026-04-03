/**
 * 行動中心預計算：供 refresh 寫入 batch.precomputedActionCenter；GET 僅讀 + 依 scope 輕量 filter。
 * 與 GET /api/dashboard/action-center 回傳形狀相容。預計算為「無 scope」全量；scoped 時用 filterActionCenterPayloadByScope。
 */
import type { AnalysisBatch, PrecomputedActionCenterPayload } from "@shared/schema";
import type { CampaignMetrics } from "@shared/schema";
import {
  DATA_STATUS_NO_DELIVERY,
  DATA_STATUS_UNDER_SAMPLE,
  DATA_STATUS_DECISION_READY,
  EVIDENCE_ADS_ONLY,
  EVIDENCE_INSUFFICIENT_SAMPLE,
  EVIDENCE_NO_DELIVERY,
  EVIDENCE_RULES_MISSING,
  breakEvenRoas,
  targetRoas,
  type EvidenceLevel,
} from "@shared/schema";
import { getWorkbenchMappingOverrides, resolveProductWithOverrides } from "./workbench-db";
import {
  aggregateByProductWithResolver,
  aggregateByCreativeTagsWithResolver,
  parseCampaignNameToTags,
  getBudgetRecommendation,
  getHistoricalFailureRateByTag,
  type ProductLevelMetrics,
  type CreativeTagLevelMetrics,
} from "@shared/tag-aggregation-engine";
import { getProductProfitRule, getProductProfitRuleExplicit } from "./profit-rules-store";
import { computeScaleReadiness, getBudgetRecommendation as getScaleBudgetRecommendation, getTrendABC, creativeEdge } from "@shared/scale-score-engine";
import { getBatchValidity } from "@shared/batch-validity";
import { stitchFunnelData, runFunnelDiagnostics } from "@shared/funnel-stitching";
import { classifyMaterialTier } from "@shared/material-tier";
import { VISIBILITY_POLICY_VERSION, buildDormantGemCandidates } from "@shared/visibility-policy";

export interface BuildActionCenterOptions {
  scopeAccountIds?: string[];
  scopeProducts?: string[];
  useOverrides?: boolean;
}

function normalizeAccountId(id: string): string {
  return (id || "").replace(/^act_/, "");
}

/**
 * 建立行動中心 payload。refresh 呼叫時傳 { useOverrides: true }（無 scope）；GET fallback 可傳 scope。
 */
export async function buildActionCenterPayload(
  batch: AnalysisBatch,
  options: BuildActionCenterOptions
): Promise<PrecomputedActionCenterPayload> {
  const scopeAccountIds = options.scopeAccountIds;
  const scopeProducts = options.scopeProducts;
  const useOverrides = options.useOverrides !== false;

  const accountIdSet =
    scopeAccountIds && scopeAccountIds.length > 0
      ? new Set(scopeAccountIds.map(normalizeAccountId))
      : null;

  let rows = batch.campaignMetrics.map((c: CampaignMetrics) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    accountId: c.accountId,
    spend: c.spend,
    revenue: c.revenue,
    roas: c.roas,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
    frequency: c.frequency,
  }));

  if (accountIdSet && accountIdSet.size > 0) {
    rows = rows.filter((r: { accountId: string }) => accountIdSet.has(normalizeAccountId(r.accountId)));
  }

  const overrides = useOverrides ? await getWorkbenchMappingOverrides() : new Map<string, string>();
  const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
    resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? "未分類");

  const productLevel: ProductLevelMetrics[] = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
  const creativeRaw: CreativeTagLevelMetrics[] = aggregateByCreativeTagsWithResolver(rows, resolveProduct, scopeProducts);
  const totalRevenue = productLevel.reduce((s, p) => s + p.revenue, 0);
  const seedHash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h);
  };
  const totalAccountSpend = (batch.campaignMetrics as CampaignMetrics[]).reduce((s, c) => s + c.spend, 0);
  const totalAccountRevenue = (batch.campaignMetrics as CampaignMetrics[]).reduce((s, c) => s + c.revenue, 0);
  const campaignList =
    accountIdSet
      ? (batch.campaignMetrics as CampaignMetrics[]).filter((c) => accountIdSet.has(normalizeAccountId(c.accountId)))
      : (batch.campaignMetrics as CampaignMetrics[]);

  const getDataStatus = (
    spend: number,
    impressions: number,
    confidenceScore: number
  ): "no_delivery" | "under_sample" | "decision_ready" => {
    if (spend === 0 || (impressions ?? 0) === 0) return DATA_STATUS_NO_DELIVERY as "no_delivery";
    if (confidenceScore < 40) return DATA_STATUS_UNDER_SAMPLE as "under_sample";
    return DATA_STATUS_DECISION_READY as "decision_ready";
  };

  const budgetActionTable = campaignList.map((c) => {
    const productName = resolveProduct(c) ?? "未分類";
    const rule = getProductProfitRule(productName);
    const explicitRule = getProductProfitRuleExplicit(productName);
    const hasRule = explicitRule != null;
    const input = {
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      addToCart: c.addToCart ?? 0,
      conversions: c.conversions,
      clicks: c.clicks,
      impressions: c.impressions,
      multiWindow: c.multiWindow ?? undefined,
      totalAccountSpend,
      totalAccountRevenue,
      rule,
    };
    const { score, breakdown, trendSignals } = computeScaleReadiness(input);
    const rec = getScaleBudgetRecommendation(input);
    const trendABC = getTrendABC(c.multiWindow ?? undefined, breakEvenRoas(rule.costRatio));
    const confidenceScore = breakdown.confidenceScore;
    const sampleStatusLabel = confidenceScore >= 70 ? "足" : confidenceScore >= 40 ? "勉強" : "不足";
    const dataStatus = getDataStatus(c.spend, c.impressions ?? 0, confidenceScore);
    const beRoas = breakEvenRoas(rule.costRatio);
    const tgtRoas = targetRoas(rule.costRatio, rule.targetNetMargin);
    const mw = c.multiWindow;
    const scaleAction = rec.action;
    const suggestedAction =
      !hasRule && (scaleAction === "可加碼" || scaleAction === "高潛延伸") ? "待補規則" : scaleAction;
    const reason =
      !hasRule && (scaleAction === "可加碼" || scaleAction === "高潛延伸")
        ? "成本規則未補齊，暫不建議高信心判賺錢／可放大"
        : rec.reason;
    let evidenceLevel: EvidenceLevel;
    if (dataStatus === "no_delivery") evidenceLevel = EVIDENCE_NO_DELIVERY;
    else if (dataStatus === "under_sample") evidenceLevel = EVIDENCE_INSUFFICIENT_SAMPLE;
    else if (!hasRule) evidenceLevel = EVIDENCE_RULES_MISSING;
    else evidenceLevel = EVIDENCE_ADS_ONLY;
    return {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      productName,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      addToCart: c.addToCart ?? 0,
      conversions: c.conversions,
      impactAmount: c.revenue - c.spend,
      sampleStatus: sampleStatusLabel,
      dataStatus,
      evidenceLevel,
      scaleReadinessScore: score,
      profitHeadroom: breakdown.profitHeadroom,
      breakEvenRoas: beRoas < 1e6 ? beRoas : null,
      targetRoas: tgtRoas < 1e6 ? tgtRoas : null,
      roas1d: mw?.window1d?.roas ?? null,
      roas3d: mw?.window3d?.roas ?? null,
      roas7d: mw?.window7d?.roas ?? null,
      trendABC,
      trendCore: trendSignals.trendCore,
      momentum: trendSignals.momentum,
      suggestedAction,
      suggestedPct: rec.suggestedPct,
      reason,
      whyNotMore: rec.whyNotMore,
      hasRule,
      costRuleStatus: hasRule ? "已設定" : "待補成本規則",
    };
  });

  const productAvgRoasByProduct = new Map<string, number>();
  for (const p of productLevel) {
    productAvgRoasByProduct.set(p.productName, p.spend > 0 ? p.revenue / p.spend : 0);
  }
  const creativeRawDecisionReady = creativeRaw.filter((c) => c.spend > 0);
  const creativeLeaderboardRaw = creativeRawDecisionReady.map((c) => {
    const seed = seedHash(`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}`);
    const thumbnailUrl = `https://picsum.photos/seed/${seed}/120/90`;
    const budgetSuggestion = getBudgetRecommendation(c.spend, c.roas) ?? undefined;
    const materialTier = classifyMaterialTier(
      c.spend,
      c.impressions ?? 0,
      c.clicks ?? 0,
      c.conversions,
      c.roas,
      c.revenue,
      totalRevenue
    );
    const rule = getProductProfitRule(c.productName);
    const input = {
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      addToCart: 0,
      conversions: c.conversions,
      clicks: c.clicks ?? 0,
      impressions: c.impressions ?? 0,
      totalAccountSpend,
      totalAccountRevenue,
      rule,
    };
    const { score, breakdown } = computeScaleReadiness(input);
    const rec = getScaleBudgetRecommendation(input);
    const productAvgRoas = productAvgRoasByProduct.get(c.productName) ?? 0;
    const edge = creativeEdge(c.roas, productAvgRoas);
    const evidenceLevel: EvidenceLevel =
      breakdown.confidenceScore < 40 ? EVIDENCE_INSUFFICIENT_SAMPLE : EVIDENCE_ADS_ONLY;
    return {
      ...c,
      thumbnailUrl,
      budgetSuggestion,
      materialTier,
      impressions: c.impressions ?? 0,
      clicks: c.clicks ?? 0,
      scaleReadinessScore: score,
      funnelReadiness: breakdown.funnelReadiness,
      suggestedAction: rec.action,
      suggestedPct: rec.suggestedPct,
      budgetReason: rec.reason,
      whyNotMore: rec.whyNotMore,
      productAverageRoas: productAvgRoas,
      creativeEdge: edge,
      evidenceLevel,
      confidenceScore: breakdown.confidenceScore,
    };
  });
  const creativeLeaderboard = [...creativeLeaderboardRaw]
    .filter((c) => (c as { evidenceLevel: EvidenceLevel }).evidenceLevel !== EVIDENCE_INSUFFICIENT_SAMPLE)
    .sort((a, b) => (a.productName === "未分類" ? 1 : b.productName === "未分類" ? -1 : 0));
  const creativeLeaderboardUnderSample = creativeLeaderboardRaw.filter(
    (c) => (c as { evidenceLevel: EvidenceLevel }).evidenceLevel === EVIDENCE_INSUFFICIENT_SAMPLE
  );
  const failureRatesByTag = getHistoricalFailureRateByTag(rows);

  const totalSpend = productLevel.reduce((s, p) => s + p.spend, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const sortedBySpend = [...productLevel].sort((a, b) => a.spend - b.spend);
  const medianSpend = sortedBySpend.length > 0 ? sortedBySpend[Math.floor(sortedBySpend.length / 2)]!.spend : 0;

  const hiddenGems = productLevel
    .filter((p) => p.spend > 0 && p.roas >= avgRoas && avgRoas > 0 && p.spend <= medianSpend * 1.5)
    .map((p) => ({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      message: `ROAS ${p.roas.toFixed(2)} 高於平均，預算相對低估，建議擴量`,
    }));

  const urgentStop = rows
    .filter((r: { spend: number; conversions: number }) => r.spend >= 500 && r.conversions === 0)
    .map((r: { campaignId: string; campaignName: string; accountId: string; spend: number }) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      accountId: r.accountId,
      spend: r.spend,
      message: "高花費無轉換，建議止血",
    }));

  let riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }> = [];
  if (batch.riskyCampaigns?.length) {
    const filteredIds = new Set(rows.map((r: { campaignId: string }) => r.campaignId));
    riskyCampaigns = batch.riskyCampaigns
      .filter((r) => r.spend > 0 && filteredIds.has(r.campaignId))
      .map((r) => ({
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        accountId: r.accountId,
        spend: r.spend,
        revenue: r.revenue,
        suggestion: r.suggestion === "stop" ? "建議關閉" : r.suggestion === "observe" ? "觀察" : "可擴量",
      }));
  }

  const productNames = productLevel.map((p) => p.productName);
  const ga4Rows: Array<{ productName: string; sessions: number; bounceRate: number; addToCart: number; purchases: number }> = [];
  const fbRows = productLevel.map((p) => ({
    productName: p.productName,
    spend: p.spend,
    revenue: p.revenue,
    roas: p.roas,
    impressions: p.impressions,
    clicks: p.clicks,
    conversions: p.conversions,
  }));
  if (fbRows.length > 0) {
    fbRows[0]!.impressions = 10000;
    fbRows[0]!.clicks = 500;
  }
  const funnelRows = stitchFunnelData(fbRows, ga4Rows);
  const funnelEvidence = false;
  const funnelWarnings = runFunnelDiagnostics(funnelRows, { funnelEvidence });

  const tierMain = productLevel
    .filter((p) => {
      const revShare = totalRevenue > 0 ? p.revenue / totalRevenue : 0;
      return revShare >= 0.15 && p.roas >= 1;
    })
    .sort((a, b) => b.revenue - a.revenue);

  const budgetActionDecisionReady = budgetActionTable.filter(
    (r) => (r as { spend: number }).spend > 0 && (r as { dataStatus: string }).dataStatus === DATA_STATUS_DECISION_READY
  );
  const budgetActionUnderSample = budgetActionTable.filter(
    (r) => (r as { dataStatus: string }).dataStatus === DATA_STATUS_UNDER_SAMPLE
  );
  const budgetActionNoDelivery = budgetActionTable.filter(
    (r) => (r as { dataStatus: string }).dataStatus === DATA_STATUS_NO_DELIVERY
  );
  const excludeUnmapped = (r: { productName?: string }) => (r.productName ?? "") !== "未分類";
  const tableRescue = budgetActionDecisionReady
    .filter((r) => (r.suggestedAction === "先降" || r.suggestedPct === "關閉") && excludeUnmapped(r))
    .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }))
    .sort((a, b) => b.spend - a.spend);
  const tableScaleUp = budgetActionDecisionReady
    .filter(
      (r) =>
        excludeUnmapped(r) &&
        (r.suggestedAction === "可加碼" || r.suggestedAction === "高潛延伸") &&
        (r as { hasRule: boolean }).hasRule === true
    )
    .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }));
  const tableNoMisjudge = budgetActionDecisionReady
    .filter((r) => r.suggestedAction === "維持" && excludeUnmapped(r))
    .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }));
  const creativeWithEdge = creativeLeaderboard as Array<{
    productName: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    scaleReadinessScore?: number;
    funnelReadiness?: number;
    creativeEdge?: number;
    [k: string]: unknown;
  }>;
  const spendThreshold = totalAccountSpend * 0.2;
  const tableExtend = creativeWithEdge
    .filter((c) => {
      if (c.productName === "未分類") return false;
      const edge = c.creativeEdge ?? 0;
      const funnelOk = (c.funnelReadiness ?? 0) >= 50 || c.conversions > 0;
      const sampleOk = c.conversions > 0 && c.spend >= 10;
      const lowSpend = c.spend <= spendThreshold || c.spend < 500;
      return edge >= 1.2 && funnelOk && sampleOk && lowSpend;
    })
    .sort((a, b) => (b.creativeEdge ?? 0) - (a.creativeEdge ?? 0));

  const tierNoise = tableRescue.map((r) => ({
    campaignId: r.campaignId,
    campaignName: r.campaignName,
    productName: r.productName,
    spend: r.spend,
    reason: r.reason,
  }));
  const tierHighPotential = tableExtend.slice(0, 10).map((c) => ({ ...c, revenue: c.revenue }));

  const buildDirectorVerdict = (
    typeLabel: string,
    reason: string,
    action: string,
    pct: number | "關閉",
    whyNotMore?: string | null
  ): string => {
    const actionStr = pct === "關閉" ? "關閉" : `${action} ${pct}%`;
    const parts = [`${typeLabel}：${reason}。建議 ${actionStr}`];
    if (whyNotMore && String(whyNotMore).trim()) parts.push(String(whyNotMore).trim());
    return parts.join("。");
  };
  const todayRescue = tableRescue.slice(0, 2).map((r) => ({
    type: "止血" as const,
    objectType: "活動" as const,
    productName: r.productName,
    campaignName: r.campaignName,
    campaignId: r.campaignId,
    accountId: r.accountId,
    spend: r.spend,
    revenue: r.revenue ?? 0,
    roas: r.roas,
    breakEvenRoas: r.breakEvenRoas ?? null,
    targetRoas: r.targetRoas ?? null,
    roas1d: r.roas1d ?? null,
    roas3d: r.roas3d ?? null,
    roas7d: r.roas7d ?? null,
    suggestedAction: r.suggestedAction,
    suggestedPct: r.suggestedPct,
    evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
    reason: r.reason,
    whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
    directorVerdict: buildDirectorVerdict("止血", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
  }));
  const todayScaleUp = tableScaleUp.slice(0, 2).map((r) => ({
    type: "放大" as const,
    objectType: "活動" as const,
    productName: r.productName,
    campaignName: r.campaignName,
    campaignId: r.campaignId,
    accountId: r.accountId,
    spend: r.spend,
    revenue: r.revenue ?? 0,
    roas: r.roas,
    breakEvenRoas: r.breakEvenRoas ?? null,
    targetRoas: r.targetRoas ?? null,
    roas1d: r.roas1d ?? null,
    roas3d: r.roas3d ?? null,
    roas7d: r.roas7d ?? null,
    suggestedAction: r.suggestedAction,
    suggestedPct: r.suggestedPct,
    evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
    reason: r.reason,
    whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
    directorVerdict: buildDirectorVerdict("放大", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
  }));
  const todayNoMisjudge = tableNoMisjudge.slice(0, 1).map((r) => ({
    type: "不要誤殺" as const,
    objectType: "活動" as const,
    productName: r.productName,
    campaignName: r.campaignName,
    campaignId: r.campaignId,
    accountId: r.accountId,
    spend: r.spend,
    revenue: r.revenue ?? 0,
    roas: r.roas,
    breakEvenRoas: r.breakEvenRoas ?? null,
    targetRoas: r.targetRoas ?? null,
    roas1d: r.roas1d ?? null,
    roas3d: r.roas3d ?? null,
    roas7d: r.roas7d ?? null,
    suggestedAction: r.suggestedAction,
    suggestedPct: r.suggestedPct,
    evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
    reason: r.reason,
    whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
    directorVerdict: buildDirectorVerdict("不要誤殺", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
  }));
  const todayExtend = tableExtend.slice(0, 2).map((c) => {
    const r = c as typeof c & { budgetReason?: string; whyNotMore?: string };
    return {
      type: "值得延伸" as const,
      objectType: "素材" as const,
      productName: r.productName,
      campaignName: undefined,
      campaignId: undefined,
      accountId: undefined,
      spend: r.spend,
      revenue: r.revenue ?? 0,
      roas: r.roas,
      breakEvenRoas: null,
      targetRoas: null,
      roas1d: null,
      roas3d: null,
      roas7d: null,
      suggestedAction: typeof r.suggestedAction === "string" ? r.suggestedAction : "維持",
      suggestedPct: (r.suggestedPct as number | "關閉") ?? 0,
      evidenceLevel: (r.evidenceLevel as EvidenceLevel) ?? EVIDENCE_ADS_ONLY,
      reason: r.budgetReason ?? "Creative Edge 高、花費未飽和，可延伸",
      whyNotMore: r.whyNotMore ?? null,
      directorVerdict: `值得延伸：${r.budgetReason ?? "Creative Edge 高、花費未飽和"}。${r.whyNotMore ?? "先小步延伸，再觀察轉換。"}`,
    };
  });
  const todayActions = [...todayRescue, ...todayScaleUp, ...todayNoMisjudge, ...todayExtend].slice(0, 5);

  const productLevelWithRule = productLevel.map((p) => {
    const hasRule = getProductProfitRuleExplicit(p.productName) != null;
    const rule = getProductProfitRule(p.productName);
    const beRoas = breakEvenRoas(rule.costRatio);
    const tgtRoas = targetRoas(rule.costRatio, rule.targetNetMargin);
    const profitHeadroom =
      hasRule && typeof tgtRoas === "number" && tgtRoas < 1e6 && tgtRoas > 0 ? p.roas / tgtRoas - 1 : null;
    let evidenceLevel: EvidenceLevel;
    if (p.productName === "未分類") evidenceLevel = EVIDENCE_RULES_MISSING;
    else if (p.spend === 0) evidenceLevel = EVIDENCE_NO_DELIVERY;
    else if (!hasRule) evidenceLevel = EVIDENCE_RULES_MISSING;
    else evidenceLevel = EVIDENCE_ADS_ONLY;
    return {
      ...p,
      hasRule,
      costRuleStatus: hasRule ? "已設定" : "待補成本規則",
      evidenceLevel,
      breakEvenRoas: beRoas < 1e6 ? beRoas : null,
      targetRoas: tgtRoas < 1e6 ? tgtRoas : null,
      profitHeadroom,
    };
  });
  const productLevelMain = productLevelWithRule.filter(
    (p) => p.spend > 0 && p.productName !== "未分類" && p.roas > 0 && p.hasRule === true
  );
  const productLevelNoDelivery = productLevelWithRule.filter((p) => p.spend === 0);
  const productLevelUnmapped = productLevelWithRule.filter((p) => p.productName === "未分類");

  const batchValidityResult = getBatchValidity(batch);
  const resolveProductForCampaign = (c: CampaignMetrics) =>
    resolveProduct({ campaignId: c.campaignId, campaignName: c.campaignName }) ?? "未分類";
  const dormantGemCandidates = buildDormantGemCandidates(campaignList, resolveProductForCampaign);
  const scopeKey = [scopeAccountIds?.join(",") ?? "", scopeProducts?.join(",") ?? ""].filter(Boolean).join("|") || undefined;
  const dr = batch.dateRange as { preset?: string; label?: string } | undefined;
  const sourceMeta = {
    batchId: batch.batchId,
    generatedAt: batch.generatedAt,
    dateRange: dr?.preset ?? dr?.label ?? "",
    scopeKey: scopeKey ?? null,
    campaignCountUsed: rows.length,
    excludedNoDelivery: budgetActionNoDelivery.length,
    excludedUnderSample: budgetActionUnderSample.length,
    unmappedCount: productLevelUnmapped.length,
  };

  return {
    visibilityPolicyVersion: VISIBILITY_POLICY_VERSION,
    dormantGemCandidates,
    batchValidity: batchValidityResult.validity,
    batchValidityReason: batchValidityResult.reason,
    sourceMeta,
    productLevel: productLevelWithRule,
    productLevelMain,
    productLevelNoDelivery,
    productLevelUnmapped,
    unmappedCount: productLevelUnmapped.length,
    creativeLeaderboard,
    creativeLeaderboardUnderSample,
    hiddenGems,
    urgentStop,
    riskyCampaigns,
    funnelWarnings,
    failureRatesByTag,
    budgetActionTable,
    budgetActionNoDelivery,
    budgetActionUnderSample,
    tableRescue,
    tableScaleUp,
    tableNoMisjudge,
    tableExtend,
    todayActions,
    tierMainAccount: tierMain,
    tierHighPotentialCreatives: tierHighPotential,
    tierNoise: tierNoise.slice(0, 20),
    funnelEvidence,
  };
}

/**
 * 對預計算 payload 做輕量 scope filter；僅陣列篩選與 sourceMeta 重算，不重跑聚合與 Scale 引擎。
 * 用於 GET 帶 scopeAccountIds / scopeProducts 時，避免重型重算。
 */
export function filterActionCenterPayloadByScope(
  payload: PrecomputedActionCenterPayload,
  scopeAccountIds?: string[],
  scopeProducts?: string[]
): PrecomputedActionCenterPayload {
  if ((!scopeAccountIds || scopeAccountIds.length === 0) && (!scopeProducts || scopeProducts.length === 0)) {
    return payload;
  }
  const accountIdSet =
    scopeAccountIds?.length
      ? new Set(scopeAccountIds.map(normalizeAccountId))
      : null;
  const productSet = scopeProducts?.length ? new Set(scopeProducts) : null;

  type HasAccountId = { accountId?: string };
  type HasProductName = { productName?: string };
  const keepByAccount = (r: HasAccountId) =>
    !accountIdSet || !r.accountId || accountIdSet.has(normalizeAccountId(r.accountId));
  const keepByProduct = (r: HasProductName) =>
    !productSet || !r.productName || productSet.has(r.productName);
  const keep = (r: HasAccountId & HasProductName) => keepByAccount(r) && keepByProduct(r);

  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  const productLevel = arr(payload.productLevel).filter((r) => keepByProduct(r as HasProductName));
  const productLevelMain = arr(payload.productLevelMain).filter((r) => keepByProduct(r as HasProductName));
  const productLevelNoDelivery = arr(payload.productLevelNoDelivery).filter((r) => keepByProduct(r as HasProductName));
  const productLevelUnmapped = arr(payload.productLevelUnmapped).filter((r) => keepByProduct(r as HasProductName));
  const budgetActionTable = arr(payload.budgetActionTable).filter((r) => keep(r as HasAccountId & HasProductName));
  const budgetActionNoDelivery = arr(payload.budgetActionNoDelivery).filter((r) => keep(r as HasAccountId & HasProductName));
  const budgetActionUnderSample = arr(payload.budgetActionUnderSample).filter((r) => keep(r as HasAccountId & HasProductName));
  const tableRescue = arr(payload.tableRescue).filter((r) => keep(r as HasAccountId & HasProductName));
  const tableScaleUp = arr(payload.tableScaleUp).filter((r) => keep(r as HasAccountId & HasProductName));
  const tableNoMisjudge = arr(payload.tableNoMisjudge).filter((r) => keep(r as HasAccountId & HasProductName));
  const tableExtend = arr(payload.tableExtend).filter((r) => keepByProduct(r as HasProductName));
  const creativeLeaderboard = arr(payload.creativeLeaderboard).filter((r) => keepByProduct(r as HasProductName));
  const creativeLeaderboardUnderSample = arr(payload.creativeLeaderboardUnderSample).filter((r) => keepByProduct(r as HasProductName));
  const urgentStop = arr(payload.urgentStop).filter((r) => keepByAccount(r as HasAccountId));
  const riskyCampaigns = arr(payload.riskyCampaigns).filter((r) => keepByAccount(r as HasAccountId));
  const hiddenGems = arr(payload.hiddenGems).filter((r) => keepByProduct(r as HasProductName));
  const tierMainAccount = arr(payload.tierMainAccount).filter((r) => keepByProduct(r as HasProductName));
  const tierHighPotentialCreatives = arr(payload.tierHighPotentialCreatives).filter((r) => keepByProduct(r as HasProductName));
  const tierNoise = arr(payload.tierNoise).filter((r) => keep(r as HasAccountId & HasProductName));
  const todayActions = arr(payload.todayActions).filter((r) => keep(r as HasAccountId & HasProductName)).slice(0, 5);
  const dormantGemCandidates = arr(payload.dormantGemCandidates).filter((r) => keep(r as HasAccountId & HasProductName));

  const sourceMeta = {
    ...(payload.sourceMeta as Record<string, unknown>),
    campaignCountUsed: budgetActionTable.length + budgetActionNoDelivery.length + budgetActionUnderSample.length,
    excludedNoDelivery: budgetActionNoDelivery.length,
    excludedUnderSample: budgetActionUnderSample.length,
    unmappedCount: productLevelUnmapped.length,
  };

  return {
    ...payload,
    dormantGemCandidates,
    productLevel,
    productLevelMain,
    productLevelNoDelivery,
    productLevelUnmapped,
    unmappedCount: productLevelUnmapped.length,
    budgetActionTable,
    budgetActionNoDelivery,
    budgetActionUnderSample,
    tableRescue,
    tableScaleUp,
    tableNoMisjudge,
    tableExtend,
    creativeLeaderboard,
    creativeLeaderboardUnderSample,
    urgentStop,
    riskyCampaigns,
    hiddenGems,
    tierMainAccount,
    tierHighPotentialCreatives,
    tierNoise: tierNoise.slice(0, 20),
    todayActions,
    sourceMeta,
  };
}
