/**
 * 階段四：FB 與 GA4 漏斗縫合 (Funnel Stitching)
 * - GA4 假數據 Mock
 * - 依產品名縫合 FB + GA4
 * - 漏斗紅綠燈診斷規則
 */

/** GA4 維度數據（依 utm_campaign = 產品名 彙總） */
export interface GA4Metrics {
  productName: string;
  sessions: number;
  bounceRate: number;
  addToCart: number;
  purchases: number;
}

/** FB 商品級數據（來自 tag-aggregation-engine aggregateByProduct） */
export interface FbProductRow {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** 縫合後單一產品漏斗一列 */
export interface ProductFunnelRow {
  productName: string;
  spend: number;
  clicks: number;
  ctr: number;
  sessions: number;
  bounceRate: number;
  addToCart: number;
  purchases: number;
  addToCartRate: number;
  purchaseRate: number;
}

/** 漏斗診斷警告 */
export interface FunnelWarning {
  productName: string;
  type: "landing_page_break" | "checkout_resistance";
  message: string;
}

/**
 * 為傳入的產品名動態生成逼真假 GA4 數據。
 * 漏斗合理性：sessions >= addToCart >= purchases。
 * 為方便在畫面上驗證 UI，強制讓部分產品觸發診斷警告：
 * - 第 1 個產品：bounceRate = 0.85（搭配 FB ctr 5% 可觸發「落地頁破口」）
 * - 第 2 個產品：addToCart = 50, purchases = 1（觸發「結帳阻力」）；若僅 1 個產品則同產品也套用
 */
export function fetchMockGA4DataByProduct(productNames: string[]): GA4Metrics[] {
  const seed = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h);
  };
  const rows = productNames.map((name, index) => {
    const s = seed(name);
    const sessions = 800 + (s % 3000);
    let bounceRate = 0.5 + (s % 40) / 100;
    let addToCart = Math.floor(sessions * (0.05 + (s % 15) / 100));
    let purchases = Math.floor(addToCart * (0.1 + (s % 40) / 100));

    if (index === 0) bounceRate = 0.85;
    if (index === 1 || (index === 0 && productNames.length === 1)) {
      addToCart = 50;
      purchases = 1;
    }

    return {
      productName: name,
      sessions: index === 1 ? 100 : sessions,
      bounceRate,
      addToCart,
      purchases,
    };
  });
  return rows;
}

/**
 * 利用產品名將 FB 聚合數據與 GA4 數據合併成 ProductFunnelRow。
 */
export function stitchFunnelData(
  fbRows: FbProductRow[],
  ga4Rows: GA4Metrics[]
): ProductFunnelRow[] {
  const ga4ByProduct = new Map(ga4Rows.map((r) => [r.productName, r]));
  return fbRows.map((fb) => {
    const ga4 = ga4ByProduct.get(fb.productName);
    const sessions = ga4?.sessions ?? 0;
    const bounceRate = ga4?.bounceRate ?? 0;
    const addToCart = ga4?.addToCart ?? 0;
    const purchases = ga4?.purchases ?? 0;
    const ctr = fb.impressions > 0 ? (fb.clicks / fb.impressions) * 100 : 0;
    return {
      productName: fb.productName,
      spend: fb.spend,
      clicks: fb.clicks,
      ctr,
      sessions,
      bounceRate,
      addToCart,
      purchases,
      addToCartRate: sessions > 0 ? addToCart / sessions : 0,
      purchaseRate: sessions > 0 ? purchases / sessions : 0,
    };
  });
}

/**
 * 診斷規則引擎：產出漏斗紅綠燈警告。
 * - 騙點擊/落地頁破口：CTR > 2.5% 且 bounceRate > 75%
 * - 結帳阻力：加購率合理但結帳流失率 > 85%（addToCart 多但 purchases 極少）
 */
export function runFunnelDiagnostics(rows: ProductFunnelRow[]): FunnelWarning[] {
  const warnings: FunnelWarning[] = [];
  for (const row of rows) {
    if (row.ctr > 2.5 && row.bounceRate > 0.75) {
      warnings.push({
        productName: row.productName,
        type: "landing_page_break",
        message: `【${row.productName}】素材點擊率佳，但進站後流失嚴重！請立即檢查 Landing Page 第一屏是否與廣告承諾不符，或網頁載入過慢。`,
      });
    }
    const addToCartNum = row.addToCart;
    const purchaseNum = row.purchases;
    if (addToCartNum > 10) {
      const dropRate = 1 - purchaseNum / addToCartNum;
      if (dropRate > 0.85) {
        warnings.push({
          productName: row.productName,
          type: "checkout_resistance",
          message: `【${row.productName}】加入購物車意願高，但結帳失敗流失！請檢查免運門檻、結帳表單是否有 Bug，或缺少促銷誘因。`,
        });
      }
    }
  }
  return warnings;
}
