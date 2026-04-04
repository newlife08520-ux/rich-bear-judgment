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

export type StitchConfidence = "full" | "fb_only" | "ga4_only" | "no_match";

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
  stitchConfidence: StitchConfidence;
  stitchNote?: string;
}

function ga4HasSignal(ga4: GA4Metrics | undefined): boolean {
  if (!ga4) return false;
  return (
    ga4.sessions > 0 ||
    ga4.addToCart > 0 ||
    ga4.purchases > 0 ||
    ga4.bounceRate > 0
  );
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
  const fbNames = new Set(fbRows.map((r) => r.productName));
  const out: ProductFunnelRow[] = [];

  for (const fb of fbRows) {
    const ga4 = ga4ByProduct.get(fb.productName);
    const hasGa4 = ga4HasSignal(ga4);
    const sessions = ga4?.sessions ?? 0;
    const bounceRate = ga4?.bounceRate ?? 0;
    const addToCart = ga4?.addToCart ?? 0;
    const purchases = ga4?.purchases ?? 0;
    const ctr = fb.impressions > 0 ? (fb.clicks / fb.impressions) * 100 : 0;

    let stitchConfidence: StitchConfidence;
    let stitchNote: string | undefined;
    if (hasGa4) {
      stitchConfidence = "full";
    } else if (ga4) {
      stitchConfidence = "fb_only";
      stitchNote = "GA4 有列名但無有效工作階段／事件（請確認 UTM／命名）";
    } else {
      stitchConfidence = "fb_only";
      stitchNote = "GA4 未匹配此商品（請確認 utm_campaign 與商品名一致）";
    }

    out.push({
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
      stitchConfidence,
      stitchNote,
    });
  }

  for (const ga4 of ga4Rows) {
    if (fbNames.has(ga4.productName)) continue;
    if (!ga4HasSignal(ga4)) continue;
    out.push({
      productName: ga4.productName,
      spend: 0,
      clicks: 0,
      ctr: 0,
      sessions: ga4.sessions,
      bounceRate: ga4.bounceRate,
      addToCart: ga4.addToCart,
      purchases: ga4.purchases,
      addToCartRate: ga4.sessions > 0 ? ga4.addToCart / ga4.sessions : 0,
      purchaseRate: ga4.sessions > 0 ? ga4.purchases / ga4.sessions : 0,
      stitchConfidence: "ga4_only",
      stitchNote: "FB 商品聚合無此名稱（請確認廣告命名／商品解析）",
    });
  }

  return out;
}

/**
 * 診斷規則引擎：產出漏斗紅綠燈警告。
 * - 騙點擊/落地頁破口：CTR > 2.5% 且 bounceRate > 75%
 * - 結帳阻力：加購率合理但結帳流失率 > 85%（addToCart 多但 purchases 極少）
 * @param funnelEvidence 若為 false，僅輸出廣告層推測語氣，不作「已確診」結論
 */
export function runFunnelDiagnostics(
  rows: ProductFunnelRow[],
  options?: { funnelEvidence?: boolean }
): FunnelWarning[] {
  const funnelEvidence = options?.funnelEvidence ?? false;
  const warnings: FunnelWarning[] = [];
  for (const row of rows) {
    if (row.ctr > 2.5 && row.bounceRate > 0.75) {
      warnings.push({
        productName: row.productName,
        type: "landing_page_break",
        message: funnelEvidence
          ? `【${row.productName}】素材點擊率佳，但進站後流失嚴重！請立即檢查 Landing Page 第一屏是否與廣告承諾不符，或網頁載入過慢。`
          : `【${row.productName}】廣告層推測：點擊率與跳出率組合可能表示落地頁有破口，建議人工確認後再下定論。目前無漏斗資料，不作漏斗定罪。`,
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
          message: funnelEvidence
            ? `【${row.productName}】加入購物車意願高，但結帳失敗流失！請檢查免運門檻、結帳表單是否有 Bug，或缺少促銷誘因。`
            : `【${row.productName}】廣告層推測：加購與結帳比例偏懸殊，可能需檢查結帳流程。目前無漏斗資料，不作結帳定罪。`,
        });
      }
    }
  }
  return warnings;
}
