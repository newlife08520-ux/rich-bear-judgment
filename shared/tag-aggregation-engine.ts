/**
 * 階段二：商品與標籤的數據聚合引擎（示範／可接 API）
 * 從 Campaign/Ad 名稱依 SOP Regex 萃取出產品名、素材策略、文案簡稱，並做跨帳號商品級／標籤級聚合。
 */

/** 解析來源：regex = 高精度 SOP 命中；fallback = 分隔符搶救；回傳 null 時為 unmapped */
export type ParseSource = "regex" | "fallback";

export interface ParsedCampaignTags {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  audienceCode: string;
  raw: string;
  /** 高精度 regex 命中 vs 低可信 fallback，供觀測與除錯 */
  parseSource?: ParseSource;
  /** 僅在 parseSource === "fallback" 時可設，記錄原因分類 */
  fallbackReason?: string;
}

/** Campaign/Ad Set 命名： [目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼] */
const CAMPAIGN_NAME_REGEX = /^(.+?)(\d{4})-([^-]+)-([^-]+)\+([^-]+)-(.+)$/;

const CACHE_MAX_SIZE = 10000;
/** In-memory cache：normalized key → ParsedCampaignTags | null；有大小上限避免無限制成長 */
const campaignParseCache = new Map<string, ParsedCampaignTags | null>();

function normalizeCacheKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/\u00A0/g, " ");
}

/** 清除 campaign 解析快取。建議在 refresh 開始時呼叫，避免長期累積；測試時亦可呼叫 */
export function clearCampaignParseCache(): void {
  campaignParseCache.clear();
}

/** 目前 cache 大小（觀測用） */
export function getCampaignParseCacheSize(): number {
  return campaignParseCache.size;
}

function evictCacheIfNeeded(): void {
  if (campaignParseCache.size <= CACHE_MAX_SIZE) return;
  const keysToDelete = Array.from(campaignParseCache.keys()).slice(0, Math.floor(CACHE_MAX_SIZE / 2));
  keysToDelete.forEach((k) => campaignParseCache.delete(k));
}

/** 輕量 fallback：Regex 失敗時用分隔符搶救 productName；不覆蓋高精度 regex 結果 */
function fallbackParseCampaignName(name: string): ParsedCampaignTags | null {
  const normalized = normalizeCacheKey(name);
  const parts = normalized.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const productName = parts[1]!.slice(0, 100);
  if (!productName) return null;
  return {
    productName,
    materialStrategy: parts[2] ?? "未知",
    headlineSnippet: "未知",
    audienceCode: parts[parts.length - 1] ?? "未知",
    raw: name,
    parseSource: "fallback",
    fallbackReason: "split_by_dash",
  };
}

export function parseCampaignNameToTags(campaignName: string): ParsedCampaignTags | null {
  if (!campaignName || typeof campaignName !== "string") return null;
  const key = normalizeCacheKey(campaignName);
  const cached = campaignParseCache.get(key);
  if (cached !== undefined) return cached;

  const m = key.match(CAMPAIGN_NAME_REGEX);
  if (m) {
    const result: ParsedCampaignTags = {
      productName: m[3]!.trim(),
      materialStrategy: m[4]!.trim(),
      headlineSnippet: m[5]!.trim(),
      audienceCode: m[6]!.trim(),
      raw: campaignName,
      parseSource: "regex",
    };
    evictCacheIfNeeded();
    campaignParseCache.set(key, result);
    return result;
  }

  const fallback = fallbackParseCampaignName(campaignName);
  evictCacheIfNeeded();
  campaignParseCache.set(key, fallback);
  return fallback;
}

export interface ParsedAdTags {
  groupDisplayName: string;
  headlineSnippet: string;
  isMixedRatio: boolean;
  raw: string;
}

const AD_NAME_REGEX_MIXED = /^\(原\)混(.+?)\+(.+)$/;
const AD_NAME_REGEX_SINGLE = /^(.+?)\+(.+)$/;

export function parseAdNameToTags(adName: string): ParsedAdTags | null {
  if (!adName || typeof adName !== "string") return null;
  const mixed = adName.trim().match(AD_NAME_REGEX_MIXED);
  if (mixed)
    return {
      groupDisplayName: mixed[1]!.trim(),
      headlineSnippet: mixed[2]!.trim(),
      isMixedRatio: true,
      raw: adName,
    };
  const single = adName.trim().match(AD_NAME_REGEX_SINGLE);
  if (single)
    return {
      groupDisplayName: single[1]!.trim(),
      headlineSnippet: single[2]!.trim(),
      isMixedRatio: false,
      raw: adName,
    };
  return null;
}

/** 單筆 Campaign 維度輸入（與現有 CampaignMetrics 對齊） */
export interface CampaignMetricRow {
  campaignId: string;
  campaignName: string;
  accountId: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
}

export interface ProductLevelMetrics {
  productName: string;
  accountIds: string[];
  campaignIds: string[];
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
  campaignCount: number;
}

export function aggregateByProduct(
  campaignMetrics: CampaignMetricRow[],
  scopeProducts?: string[]
): ProductLevelMetrics[] {
  const byProduct = new Map<string, ProductLevelMetrics>();

  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && !scopeProducts.includes(tags.productName)) continue;

    const key = tags.productName;
    const existing = byProduct.get(key);
    if (!existing) {
      byProduct.set(key, {
        productName: key,
        accountIds: [row.accountId],
        campaignIds: [row.campaignId],
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        frequency: row.frequency,
        campaignCount: 1,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.conversions += row.conversions;
      if (!existing.accountIds.includes(row.accountId)) existing.accountIds.push(row.accountId);
      existing.campaignIds.push(row.campaignId);
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.frequency = existing.impressions > 0 ? existing.impressions / Math.max(1, existing.clicks) : existing.frequency;
    }
  }

  return Array.from(byProduct.values());
}

/** 單筆 row 解析出 productName（可來自 override 或 parse） */
export type ProductResolver = (row: CampaignMetricRow) => string | null;

/** 依 resolver 彙總商品維度（P2 override 優先於 parse） */
export function aggregateByProductWithResolver(
  campaignMetrics: CampaignMetricRow[],
  resolveProduct: ProductResolver,
  scopeProducts?: string[]
): ProductLevelMetrics[] {
  const byProduct = new Map<string, ProductLevelMetrics>();

  for (const row of campaignMetrics) {
    const productName = resolveProduct(row);
    if (!productName) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && productName !== "未分類" && !scopeProducts.includes(productName)) continue;

    const key = productName;
    const tags = parseCampaignNameToTags(row.campaignName);
    const existing = byProduct.get(key);
    if (!existing) {
      byProduct.set(key, {
        productName: key,
        accountIds: [row.accountId],
        campaignIds: [row.campaignId],
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        frequency: row.frequency,
        campaignCount: 1,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.conversions += row.conversions;
      if (!existing.accountIds.includes(row.accountId)) existing.accountIds.push(row.accountId);
      existing.campaignIds.push(row.campaignId);
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.frequency = existing.impressions > 0 ? existing.impressions / Math.max(1, existing.clicks) : existing.frequency;
    }
  }

  return Array.from(byProduct.values());
}

/** 依 resolver 彙總素材維度（productName 來自 resolver；materialStrategy/headlineSnippet 仍來自 parse） */
export function aggregateByCreativeTagsWithResolver(
  campaignMetrics: CampaignMetricRow[],
  resolveProduct: ProductResolver,
  scopeProducts?: string[]
): CreativeTagLevelMetrics[] {
  const byTag = new Map<string, CreativeTagLevelMetrics>();

  for (const row of campaignMetrics) {
    const productName = resolveProduct(row);
    if (!productName) continue;
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && !scopeProducts.includes(productName)) continue;

    const key = `${productName}\t${tags.materialStrategy}\t${tags.headlineSnippet}`;
    const cpa = row.conversions > 0 ? row.spend / row.conversions : 0;
    const existing = byTag.get(key);
    if (!existing) {
      byTag.set(key, {
        productName,
        materialStrategy: tags.materialStrategy,
        headlineSnippet: tags.headlineSnippet,
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        conversions: row.conversions,
        cpa,
        campaignCount: 1,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.conversions += row.conversions;
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.cpa = existing.conversions > 0 ? existing.spend / existing.conversions : 0;
      existing.impressions += row.impressions ?? 0;
      existing.clicks += row.clicks ?? 0;
    }
  }

  return Array.from(byTag.values());
}

/** 歷史素材陣亡率（依 resolver 取得 productName，materialStrategy 仍來自 parse） */
export function getHistoricalFailureRateByTagWithResolver(
  campaignMetrics: CampaignMetricRow[],
  resolveProduct: ProductResolver
): Record<string, number> {
  const byTag = new Map<string, { failSpend: number; totalSpend: number }>();
  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    const key = tags.materialStrategy;
    const entry = byTag.get(key) ?? { failSpend: 0, totalSpend: 0 };
    entry.totalSpend += row.spend;
    if (row.roas < 1.0) entry.failSpend += row.spend;
    byTag.set(key, entry);
  }
  const out: Record<string, number> = {};
  for (const [tag, v] of byTag) {
    if (v.totalSpend > 0) out[tag] = v.failSpend / v.totalSpend;
  }
  return out;
}

export interface CreativeTagLevelMetrics {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
  campaignCount: number;
  impressions: number;
  clicks: number;
}

export function aggregateByCreativeTags(
  campaignMetrics: CampaignMetricRow[],
  scopeProducts?: string[]
): CreativeTagLevelMetrics[] {
  const byTag = new Map<string, CreativeTagLevelMetrics>();

  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    if (scopeProducts != null && scopeProducts.length > 0 && !scopeProducts.includes(tags.productName)) continue;

    const key = `${tags.productName}\t${tags.materialStrategy}\t${tags.headlineSnippet}`;
    const cpa = row.conversions > 0 ? row.spend / row.conversions : 0;
    const existing = byTag.get(key);
    if (!existing) {
      byTag.set(key, {
        productName: tags.productName,
        materialStrategy: tags.materialStrategy,
        headlineSnippet: tags.headlineSnippet,
        spend: row.spend,
        revenue: row.revenue,
        roas: row.roas,
        conversions: row.conversions,
        cpa,
        campaignCount: 1,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
      });
    } else {
      existing.spend += row.spend;
      existing.revenue += row.revenue;
      existing.conversions += row.conversions;
      existing.campaignCount += 1;
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
      existing.cpa = existing.conversions > 0 ? existing.spend / existing.conversions : 0;
      existing.impressions += row.impressions ?? 0;
      existing.clicks += row.clicks ?? 0;
    }
  }

  return Array.from(byTag.values());
}

/** 預算加減碼精算（投手 MEDIA_BUYER/AD 用） */
export function getBudgetRecommendation(spend: number, roas: number): string | null {
  if (roas > 2.5 && spend > 1000)
    return "🚀 建議擴量：受眾未飽和，建議今日預算增加 20%";
  if (spend > 1500 && roas < 1.0)
    return "✂️ 達停損紅線：已空燒預算，建議立即關閉";
  return null;
}

/** 歷史素材陣亡率：依 materialStrategy 統計 ROAS < 1.0 的花費占比 (0~1) */
export function getHistoricalFailureRateByTag(
  campaignMetrics: CampaignMetricRow[]
): Record<string, number> {
  const byTag = new Map<string, { failSpend: number; totalSpend: number }>();
  for (const row of campaignMetrics) {
    const tags = parseCampaignNameToTags(row.campaignName);
    if (!tags) continue;
    const key = tags.materialStrategy;
    const entry = byTag.get(key) ?? { failSpend: 0, totalSpend: 0 };
    entry.totalSpend += row.spend;
    if (row.roas < 1.0) entry.failSpend += row.spend;
    byTag.set(key, entry);
  }
  const out: Record<string, number> = {};
  for (const [tag, v] of byTag) {
    if (v.totalSpend > 0) out[tag] = v.failSpend / v.totalSpend;
  }
  return out;
}
