/**
 * 7.2：Pareto / 82 法則 v2 — 單一建構入口供 /api/pareto 與前端共用。
 */
import type { CampaignMetrics } from "@shared/schema";
import {
  assembleParetoEngineV2,
  buildParetoWorkbenchPayload,
  computePareto,
  type ParetoEngineV2Payload,
  type ParetoItem,
  type ParetoScopeBlock,
} from "@shared/pareto-engine";
import type { CampaignMetricRow } from "@shared/tag-aggregation-engine";
import {
  aggregateByProductWithResolver,
  parseCampaignNameToTags,
} from "@shared/tag-aggregation-engine";
import { prisma } from "../../db";
import { storage } from "../../storage";
import { getWorkbenchMappingOverrides, resolveProductWithOverrides } from "../../workbench-db";
import { buildCreativePatternsPayload } from "../creative-intelligence/creative-intelligence-patterns";

function toMetricRows(cm: CampaignMetrics[]): CampaignMetricRow[] {
  return cm.map((c) => ({
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
}

export async function buildParetoEngineV2ForUser(params: {
  userId: string;
  scopeKey?: string;
  scopeProducts?: string[];
}): Promise<ParetoEngineV2Payload> {
  const batch = storage.getLatestBatch(params.userId, params.scopeKey);
  const cm = batch?.campaignMetrics ?? [];
  const rows = toMetricRows(cm);
  const overrides = await getWorkbenchMappingOverrides();
  const resolveProduct = (row: CampaignMetricRow) =>
    resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);

  const scopes: ParetoScopeBlock[] = [];

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const companyItems: ParetoItem[] = [
    { id: "company", label: "Company（全帳戶聚合）", spend: totalSpend, revenue: totalRev },
  ];
  const coP = computePareto(companyItems);
  scopes.push({
    level: "company",
    key: "company",
    label: "Company",
    items: companyItems,
    pareto: coP,
    workbench: buildParetoWorkbenchPayload(companyItems, coP),
  });

  const byAcc = new Map<string, { spend: number; revenue: number; label: string }>();
  for (const c of cm) {
    const aid = c.accountId || "unknown";
    const cur = byAcc.get(aid) ?? { spend: 0, revenue: 0, label: c.accountName || aid };
    cur.spend += c.spend;
    cur.revenue += c.revenue;
    byAcc.set(aid, cur);
  }
  const accountItems: ParetoItem[] = [...byAcc.entries()].map(([id, v]) => ({
    id,
    label: v.label,
    spend: v.spend,
    revenue: v.revenue,
  }));
  const accP = computePareto(accountItems);
  scopes.push({
    level: "account",
    key: "accounts",
    label: "Accounts",
    items: accountItems,
    pareto: accP,
    workbench: buildParetoWorkbenchPayload(accountItems, accP),
  });

  const productLevel = aggregateByProductWithResolver(rows, resolveProduct, params.scopeProducts);
  const productItems = productLevel.map((p) => ({
    id: p.productName,
    label: p.productName,
    spend: p.spend,
    revenue: p.revenue,
    score: p.roas,
  }));
  const prodP = computePareto(productItems);
  scopes.push({
    level: "product",
    key: "products",
    label: "Products",
    items: productItems,
    pareto: prodP,
    workbench: buildParetoWorkbenchPayload(productItems, prodP),
  });

  const snaps = await prisma.creativeOutcomeSnapshot.findMany({
    where: { userId: params.userId },
    orderBy: { snapshotDate: "desc" },
    take: 500,
  });
  const seen = new Set<string>();
  const versionItems: ParetoItem[] = [];
  for (const s of snaps) {
    if (seen.has(s.assetVersionId)) continue;
    seen.add(s.assetVersionId);
    if (s.ambiguousAttribution) continue;
    versionItems.push({
      id: s.assetVersionId,
      label: s.productName ? `${s.productName} · ${s.assetVersionId.slice(0, 8)}…` : s.assetVersionId,
      spend: s.spend,
      revenue: s.revenue,
      score: s.roas,
    });
  }
  const verP = computePareto(versionItems);
  scopes.push({
    level: "creative_version",
    key: "creative_versions",
    label: "Creative versions",
    items: versionItems,
    pareto: verP,
    workbench: buildParetoWorkbenchPayload(versionItems, verP),
  });

  const patterns = await buildCreativePatternsPayload(params.userId);
  const winHooks = (patterns.hookTopWinners as { tag: string }[]).slice(0, 10).map((x) => x.tag);
  const loseHooks = (patterns.hookTopLosers as { tag: string }[]).slice(0, 10).map((x) => x.tag);

  const engine = assembleParetoEngineV2({
    scopes,
    dominantWinningHooks: winHooks,
    dominantFailurePatterns: loseHooks,
  });
  return {
    ...engine,
    canonicalWorkbench: {
      ...engine.canonicalWorkbench,
      dominantWinningHooks: winHooks,
      dominantFailurePatterns: loseHooks,
    },
  };
}
