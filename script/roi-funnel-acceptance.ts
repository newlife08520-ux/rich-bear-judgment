/**
 * ROI-funnel 驗收：4 主 case + 精修（NEEDS_MORE_DATA / STABLE / baseline_scope）
 * 執行：npx tsx script/roi-funnel-acceptance.ts
 */
import {
  computeRoiFunnel,
  computeBaselineFromRows,
  getBaselineFor,
  DEFAULT_ROI_FUNNEL_THRESHOLDS,
  DOMINANT_ACCOUNT_SPEND_RATIO,
} from "../shared/roi-funnel-engine";

const baseline = { atcRateBaseline: 0.08, purchaseRateBaseline: 0.03 };
const thresholds = DEFAULT_ROI_FUNNEL_THRESHOLDS;

const cases = [
  {
    name: "Lucky",
    row: {
      campaignId: "lc1",
      campaignName: "Lucky campaign",
      accountId: "act_1",
      spend: 200,
      revenue: 800,
      roas: 4,
      clicks: 30,
      addToCart: 2,
      purchases: 1,
    },
    expectLabel: "Lucky" as const,
    description: "低預算、少 clicks、僅 1 次購買 → 辨識為運氣單，不得判 Winner",
  },
  {
    name: "Underfunded",
    row: {
      campaignId: "uf1",
      campaignName: "Underfunded campaign",
      accountId: "act_1",
      spend: 250,
      revenue: 750,
      roas: 3,
      clicks: 80,
      addToCart: 10,
      purchases: 4,
    },
    expectLabel: "Underfunded" as const,
    description: "漏斗率高於 baseline、ROAS 達標，但 spend/clicks 未達門檻 → 可加碼",
  },
  {
    name: "Winner",
    row: {
      campaignId: "w1",
      campaignName: "Winner campaign",
      accountId: "act_1",
      spend: 600,
      revenue: 1800,
      roas: 3,
      clicks: 120,
      addToCart: 15,
      purchases: 6,
    },
    expectLabel: "Winner" as const,
    description: "ROAS 達標 + 漏斗健康（LB ≥ baseline）+ 資料量 gate 通過",
  },
  {
    name: "FunnelWeak",
    row: {
      campaignId: "fw1",
      campaignName: "FunnelWeak campaign",
      accountId: "act_1",
      spend: 800,
      revenue: 400,
      roas: 0.5,
      clicks: 100,
      addToCart: 1,
      purchases: 0,
    },
    expectLabel: "FunnelWeak" as const,
    description: "atc_lb / purchase_lb 低於 baseline → 漏斗不健康",
  },
  {
    name: "NEEDS_MORE_DATA",
    row: {
      campaignId: "nd1",
      campaignName: "Low data",
      accountId: "act_1",
      spend: 100,
      revenue: 0,
      roas: 0,
      clicks: 10,
      addToCart: 0,
      purchases: 0,
    },
    expectLabel: "NEEDS_MORE_DATA" as const,
    description: "資料量不足（clicks/spend 未達門檻）→ 需補足再判",
  },
  {
    name: "STABLE",
    row: {
      campaignId: "st1",
      campaignName: "Stable",
      accountId: "act_1",
      spend: 400,
      revenue: 200,
      roas: 0.5,
      clicks: 60,
      addToCart: 12,
      purchases: 4,
    },
    expectLabel: "STABLE" as const,
    description: "漏斗健康（atc/purchase rate 達 baseline）但 ROI 未達標 → STABLE",
  },
];

let passed = 0;
let failed = 0;
console.log("=== ROI-funnel 驗收（含精修 NEEDS_MORE_DATA / STABLE）===\n");

for (const c of cases) {
  const result = computeRoiFunnel(c.row, baseline, thresholds);
  const ok = result.label === c.expectLabel;
  if (ok) passed++;
  else failed++;
  console.log(`[${ok ? "通過" : "失敗"}] ${c.name}`);
  console.log(`  說明: ${c.description}`);
  console.log(`  預期 label: ${c.expectLabel}，實際: ${result.label} (qualityScore=${result.qualityScore}, confidence=${result.confidenceLevel})`);
  if (!ok) console.log(`  evidence: funnelPass=${result.evidence.funnelPass}, gateClicks=${result.evidence.gateClicks}, gateSpend=${result.evidence.gateSpend}`);
  console.log("");
}

// 精修：baseline_scope — 單一 account 花費 > 70% 時使用 product+account baseline
console.log("=== 精修：baseline_scope（product+account 當單一 account > 70%）===\n");
const rowsForScope = [
  { campaignId: "a", campaignName: "A", accountId: "act_1", spend: 800, revenue: 0, roas: 0, clicks: 100, addToCart: 5, purchases: 2 },
  { campaignId: "b", campaignName: "B", accountId: "act_1", spend: 150, revenue: 0, roas: 0, clicks: 20, addToCart: 1, purchases: 0 },
];
const productFilter = (r: { campaignId: string }) => "P1";
const { baselines, scopeByProduct } = computeBaselineFromRows(rowsForScope, productFilter);
const scopeInfo = scopeByProduct.get("P1");
const dominantOk = scopeInfo?.scope === "product+account" && scopeInfo?.dominantAccountId === "act_1";
const ratioOk = 800 / (800 + 150) > DOMINANT_ACCOUNT_SPEND_RATIO;
const baselineScopePass = dominantOk && ratioOk;
if (baselineScopePass) passed++;
else failed++;
console.log(`[${baselineScopePass ? "通過" : "失敗"}] baseline_scope：P1 由 act_1 佔比 ${(800 / 950 * 100).toFixed(0)}% > 70% → scope=product+account`);
const { scope } = getBaselineFor("P1", "act_1", { baselines, scopeByProduct });
console.log(`  getBaselineFor(P1, act_1) → scope=${scope}\n`);

console.log(`--- 總計: ${passed} 通過, ${failed} 失敗 ---`);
process.exit(failed > 0 ? 1 : 0);
