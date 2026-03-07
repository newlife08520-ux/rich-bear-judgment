/**
 * ROI-first + Funnel Health + Confidence（避免運氣單）判斷邏輯
 * 事件：ATC count、Purchase count（conversions），分母：clicks
 */
export const WILSON_Z = 1.645;

/** Wilson score interval 下界：p 為比例 (0~1)，n 為樣本數 */
export function wilsonLowerBound(p: number, n: number, z: number = WILSON_Z): number {
  if (n <= 0) return 0;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const spread = (z / denom) * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, Math.min(1, center - spread));
}

export type LifecycleLabel = "Lucky" | "Winner" | "Underfunded" | "FunnelWeak" | "Retired" | "NEEDS_MORE_DATA" | "STABLE";

/** 單一 account 花費占比超過此值時改用 product+account baseline */
export const DOMINANT_ACCOUNT_SPEND_RATIO = 0.7;

export interface FunnelBaseline {
  atcRateBaseline: number;   // 0~1 或 0~100 依約定；此處用 0~1
  purchaseRateBaseline: number;
}

export interface RoiFunnelThresholds {
  minClicks: number;
  minATC: number;
  minPurchases: number;
  minSpend: number;
  roasTargetMin: number;
  /** atc_lb >= baseline * (1 - funnelAtcTolerance) 視為漏斗健康 */
  funnelAtcTolerance: number;
  /** purchase_lb >= baseline * (1 - funnelPurchaseTolerance) */
  funnelPurchaseTolerance: number;
  /** spend 低於此且有出單，候選 Lucky */
  luckySpendThreshold: number;
  /** 至少幾次購買才不因「運氣單」判 Lucky（可設 2） */
  luckyMinPurchasesToExclude: number;
}

export const DEFAULT_ROI_FUNNEL_THRESHOLDS: RoiFunnelThresholds = {
  minClicks: 50,
  minATC: 3,
  minPurchases: 2,
  minSpend: 300,
  roasTargetMin: 1.0,
  funnelAtcTolerance: 0.2,
  funnelPurchaseTolerance: 0.2,
  luckySpendThreshold: 500,
  luckyMinPurchasesToExclude: 2,
};

export type BaselineScope = "product" | "product+account";

export interface RoiFunnelEvidence {
  atc_rate: number;
  purchase_rate: number;
  atc_lb: number;
  purchase_lb: number;
  atcRateBaseline: number;
  purchaseRateBaseline: number;
  gateClicks: boolean;
  gateATC: boolean;
  gatePurchases: boolean;
  gateSpend: boolean;
  funnelPass: boolean;
  roas: number;
  spend: number;
  baseline_scope?: BaselineScope;
}

export interface RoiFunnelResult {
  label: LifecycleLabel;
  qualityScore: number;
  confidenceLevel: "high" | "medium" | "low";
  evidence: RoiFunnelEvidence;
}

export interface CampaignRowForRoi {
  campaignId: string;
  campaignName: string;
  accountId: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks: number;
  addToCart: number;
  purchases: number;
}

function toRow(c: {
  campaignId: string;
  campaignName: string;
  accountId: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks: number;
  addToCart?: number;
  conversions: number;
}): CampaignRowForRoi {
  return {
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    accountId: c.accountId,
    spend: c.spend,
    revenue: c.revenue,
    roas: c.roas,
    clicks: c.clicks,
    addToCart: c.addToCart ?? 0,
    purchases: c.conversions,
  };
}

export function computeRoiFunnel(
  row: CampaignRowForRoi,
  baseline: FunnelBaseline,
  thresholds: RoiFunnelThresholds,
  options?: { baselineScope?: BaselineScope }
): RoiFunnelResult {
  const clicks = Math.max(0, row.clicks);
  const atc = Math.max(0, row.addToCart);
  const purchases = Math.max(0, row.purchases);

  const atc_rate = clicks > 0 ? atc / clicks : 0;
  const purchase_rate = clicks > 0 ? purchases / clicks : 0;
  const atc_lb = wilsonLowerBound(atc_rate, clicks);
  const purchase_lb = wilsonLowerBound(purchase_rate, clicks);

  const gateClicks = clicks >= thresholds.minClicks;
  const gateATC = atc >= thresholds.minATC;
  const gatePurchases = purchases >= thresholds.minPurchases;
  const gateSpend = row.spend >= thresholds.minSpend;

  const atcBaseline = baseline.atcRateBaseline;
  const purchaseBaseline = baseline.purchaseRateBaseline;
  const atcOk = atcBaseline <= 0 ? true : atc_lb >= atcBaseline * (1 - thresholds.funnelAtcTolerance);
  const purchaseOk = purchaseBaseline <= 0 ? true : purchase_lb >= purchaseBaseline * (1 - thresholds.funnelPurchaseTolerance);
  const funnelPass = atcOk && purchaseOk;

  const roasOk = row.roas >= thresholds.roasTargetMin;

  const evidence: RoiFunnelEvidence = {
    atc_rate,
    purchase_rate,
    atc_lb,
    purchase_lb,
    atcRateBaseline: atcBaseline,
    purchaseRateBaseline: purchaseBaseline,
    gateClicks,
    gateATC,
    gatePurchases,
    gateSpend,
    funnelPass,
    roas: row.roas,
    spend: row.spend,
    baseline_scope: options?.baselineScope,
  };

  // 1) Lucky：低預算運氣出單（不得判 Winner、不得直接加碼）
  const lowSpendWithPurchase = row.spend < thresholds.luckySpendThreshold && purchases > 0;
  const singlePurchaseLucky = purchases < thresholds.luckyMinPurchasesToExclude && purchases > 0 && row.spend < thresholds.luckySpendThreshold;
  if (singlePurchaseLucky || (lowSpendWithPurchase && !gatePurchases)) {
    const qualityScore = Math.min(100, Math.round(30 + (row.roas * 10) + (funnelPass ? 15 : 0)));
    const confidenceLevel = gateClicks ? "medium" : "low";
    return { label: "Lucky", qualityScore, confidenceLevel, evidence };
  }

  // 2) Winner：ROAS 達標 + 漏斗健康 + 資料量 gate
  const dataGate = gateClicks && gateSpend && (thresholds.minATC <= 0 || gateATC) && (thresholds.minPurchases <= 0 || gatePurchases);
  if (roasOk && funnelPass && dataGate) {
    const qualityScore = Math.min(100, Math.round(50 + (row.roas - thresholds.roasTargetMin) * 15 + (atc_lb + purchase_lb) * 20));
    const confidenceLevel = gatePurchases && gateATC ? "high" : gateClicks ? "medium" : "low";
    return { label: "Winner", qualityScore: Math.max(qualityScore, 60), confidenceLevel, evidence };
  }

  // 3) Underfunded：高意圖（漏斗率高於 baseline）但 spend/clicks 不足 → 可加碼
  const highIntent = (atcBaseline <= 0 || atc_rate >= atcBaseline) && (purchaseBaseline <= 0 || purchase_rate >= purchaseBaseline);
  const underfunded = highIntent && roasOk && (!gateSpend || !gateClicks) && !singlePurchaseLucky;
  if (underfunded) {
    const qualityScore = Math.min(100, Math.round(45 + (row.roas * 10) + (funnelPass ? 20 : 0)));
    return { label: "Underfunded", qualityScore, confidenceLevel: gateClicks ? "medium" : "low", evidence };
  }

  // 4) FunnelWeak：漏斗不健康（LB 低於 baseline）
  if (!funnelPass && (gateClicks || row.spend >= thresholds.minSpend)) {
    const qualityScore = Math.min(100, Math.round(25 + (atc_lb + purchase_lb) * 30));
    return { label: "FunnelWeak", qualityScore, confidenceLevel: gateClicks ? "medium" : "low", evidence };
  }

  // STABLE：漏斗健康但 ROI 未達標（先於 Retired，避免誤判為淘汰）
  if (funnelPass && !roasOk) {
    const qualityScore = Math.min(100, Math.round(30 + row.roas * 15 + 10));
    return { label: "STABLE", qualityScore, confidenceLevel: gateClicks ? "medium" : "low", evidence };
  }

  // Retired：ROI 差且花費達門檻
  if (row.roas < thresholds.roasTargetMin && row.spend >= thresholds.minSpend) {
    return { label: "Retired", qualityScore: Math.round(20 + row.roas * 10), confidenceLevel: gateClicks ? "medium" : "low", evidence };
  }

  // NEEDS_MORE_DATA：資料量不足再判
  if (!dataGate && (clicks < thresholds.minClicks || row.spend < thresholds.minSpend)) {
    return { label: "NEEDS_MORE_DATA", qualityScore: Math.round(20 + Math.min(clicks / 10, 5) * 2), confidenceLevel: "low", evidence };
  }
  // 其餘 → STABLE
  return { label: "STABLE", qualityScore: Math.round(30 + row.roas * 15), confidenceLevel: gateClicks ? "medium" : "low", evidence };
}

export interface BaselineScopeInfo {
  scope: BaselineScope;
  dominantAccountId?: string;
}

/** 從多筆 campaign 彙總 baseline；當單一 account 花費占比 > 70% 時該 product 使用 product+account baseline */
export function computeBaselineFromRows(
  rows: CampaignRowForRoi[],
  productFilter?: (row: CampaignRowForRoi) => string | null
): { baselines: Map<string, FunnelBaseline>; scopeByProduct: Map<string, BaselineScopeInfo> } {
  const byProduct = new Map<string, CampaignRowForRoi[]>();
  for (const r of rows) {
    const key = productFilter ? (productFilter(r) ?? "__site__") : "__site__";
    const list = byProduct.get(key) || [];
    list.push(r);
    byProduct.set(key, list);
  }

  const siteRows = byProduct.get("__site__") || [];
  const allRows = productFilter ? rows : siteRows;
  const siteAtc = allRows.reduce((s, r) => s + r.addToCart, 0);
  const sitePurchases = allRows.reduce((s, r) => s + r.purchases, 0);
  const siteClicks = allRows.reduce((s, r) => s + r.clicks, 0);
  const siteBaseline: FunnelBaseline = {
    atcRateBaseline: siteClicks > 0 ? siteAtc / siteClicks : 0,
    purchaseRateBaseline: siteClicks > 0 ? sitePurchases / siteClicks : 0,
  };

  const baselines = new Map<string, FunnelBaseline>();
  baselines.set("__site__", siteBaseline);
  const scopeByProduct = new Map<string, BaselineScopeInfo>();

  for (const [product, list] of byProduct) {
    if (product === "__site__") continue;
    const totalSpend = list.reduce((s, r) => s + r.spend, 0);
    const byAccount = new Map<string, number>();
    for (const r of list) {
      byAccount.set(r.accountId, (byAccount.get(r.accountId) ?? 0) + r.spend);
    }
    let dominantAccountId: string | undefined;
    if (totalSpend > 0) {
      let maxSpend = 0;
      for (const [accId, sp] of byAccount) {
        if (sp > maxSpend) {
          maxSpend = sp;
          dominantAccountId = accId;
        }
      }
      if (dominantAccountId != null && maxSpend / totalSpend <= DOMINANT_ACCOUNT_SPEND_RATIO) dominantAccountId = undefined;
    }
    const scope: BaselineScope = dominantAccountId != null ? "product+account" : "product";
    scopeByProduct.set(product, { scope, dominantAccountId });

    const atc = list.reduce((s, r) => s + r.addToCart, 0);
    const purchases = list.reduce((s, r) => s + r.purchases, 0);
    const clicks = list.reduce((s, r) => s + r.clicks, 0);
    const baseline: FunnelBaseline = clicks > 0
      ? { atcRateBaseline: atc / clicks, purchaseRateBaseline: purchases / clicks }
      : siteBaseline;
    baselines.set(product, baseline);

    if (dominantAccountId != null) {
      const accRows = list.filter((r) => r.accountId === dominantAccountId);
      const aAtc = accRows.reduce((s, r) => s + r.addToCart, 0);
      const aPurchases = accRows.reduce((s, r) => s + r.purchases, 0);
      const aClicks = accRows.reduce((s, r) => s + r.clicks, 0);
      const accBaseline: FunnelBaseline = aClicks > 0
        ? { atcRateBaseline: aAtc / aClicks, purchaseRateBaseline: aPurchases / aClicks }
        : baseline;
      baselines.set(`${product}|${dominantAccountId}`, accBaseline);
    }
  }
  return { baselines, scopeByProduct };
}

/** 依 product + 是否為 dominant account 取得 baseline 與 scope */
export function getBaselineFor(
  productName: string | null,
  accountId: string,
  result: { baselines: Map<string, FunnelBaseline>; scopeByProduct: Map<string, BaselineScopeInfo> }
): { baseline: FunnelBaseline; scope: BaselineScope } {
  const site = result.baselines.get("__site__")!;
  if (!productName) return { baseline: site, scope: "product" };
  const scopeInfo = result.scopeByProduct.get(productName);
  if (scopeInfo?.scope === "product+account" && scopeInfo.dominantAccountId === accountId) {
    const key = `${productName}|${accountId}`;
    const bl = result.baselines.get(key) ?? result.baselines.get(productName) ?? site;
    return { baseline: bl, scope: "product+account" };
  }
  const bl = result.baselines.get(productName) ?? site;
  return { baseline: bl, scope: scopeInfo?.scope ?? "product" };
}

/** 將 CampaignMetrics 轉成 CampaignRowForRoi 並帶 productName（resolveProduct 回傳） */
export function toRoiRows(
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    accountId: string;
    spend: number;
    revenue: number;
    roas: number;
    clicks: number;
    addToCart?: number;
    conversions: number;
  }>,
  resolveProduct: (row: { campaignId: string; campaignName: string }) => string | null
): { row: CampaignRowForRoi; productName: string | null }[] {
  return campaigns.map((c) => ({
    row: toRow(c),
    productName: resolveProduct({ campaignId: c.campaignId, campaignName: c.campaignName }),
  }));
}

export function getSuggestedAction(label: LifecycleLabel, evidence: RoiFunnelEvidence, thresholds: RoiFunnelThresholds): string {
  switch (label) {
    case "Lucky":
      return `補量到門檻再判：至少 ${thresholds.minClicks} clicks、${thresholds.minPurchases} 次購買、spend ≥ ${thresholds.minSpend}，勿直接加碼`;
    case "Underfunded":
      return "漏斗健康且 ROAS 達標，建議加碼（提高預算 20–30%）";
    case "Winner":
      return "可持續加碼或維持";
    case "FunnelWeak":
      return "優化落地頁/受眾，提升 ATC 與購買率後再考慮加碼";
    case "Retired":
      return "建議縮預算或暫停";
    case "NEEDS_MORE_DATA":
      return `補足資料量再判：至少 ${thresholds.minClicks} clicks、spend ≥ ${thresholds.minSpend}`;
    case "STABLE":
      return "持續觀察（漏斗健康可維持；ROI 未達可優化）";
    default:
      return "持續觀察";
  }
}
