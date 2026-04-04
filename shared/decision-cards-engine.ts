/**
 * P1 決策卡引擎：由規則產出 8 張卡內容（結論 / 觸發規則 / 證據指標 / 建議動作 / 影響金額 / 置信度）
 * 供 GET /api/workbench/decision-cards 使用，Judgment 頁不再使用 placeholder。
 */
import type { ProductLevelMetrics } from "./tag-aggregation-engine";

const DEFAULT_THRESHOLDS = {
  spendThresholdStop: 1500,
  roasTargetMin: 1.0,
  roasScaleMin: 2.5,
  ctrHigh: 2.5,
  frequencyFatigue: 8,
  minSpendForRules: 300,
};

const ROAS_TARGET_MIN = DEFAULT_THRESHOLDS.roasTargetMin;

/** P2 可版本化門檻（published 才影響決策卡） */
export type ThresholdConfig = typeof DEFAULT_THRESHOLDS & { productOverrides?: Record<string, Partial<typeof DEFAULT_THRESHOLDS>> };

export interface DecisionCardBlock {
  key: string;
  label: string;
  conclusion: string;
  triggerRule: string;
  evidenceMetrics: string;
  suggestedAction: string;
  impactAmount: string;
  confidence: "high" | "medium" | "low" | "data_insufficient";
  /** 可複製的純文字（執行清單用） */
  copyableText?: string;
}

import type { MaterialTier } from "./material-tier";

export type { MaterialTier };

export interface CreativeLeaderboardRow {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  impressions?: number;
  clicks?: number;
  frequency?: number;
  campaignCount?: number;
  /** 素材分級：Unproven 不列入黑榜；Loser 才可列黑榜 */
  materialTier?: MaterialTier;
}

export interface DecisionCardsInput {
  productLevel: ProductLevelMetrics[];
  creativeLeaderboard: CreativeLeaderboardRow[];
  funnelWarnings: Array<{ message?: string; productName?: string }>;
  urgentStop: Array<{ campaignName: string; spend: number; message?: string }>;
  failureRatesByTag: Record<string, number>;
  /** 例如「近 7 天」，會附在證據指標後方便使用者理解時間窗 */
  analysisWindowLabel?: string;
}

interface DerivedProduct {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
  clicks: number;
  productStatus: "scale" | "watch" | "danger" | "stop";
  ruleTags: string[];
  aiSuggestion: string;
}

function getThresholdsForProduct(config: ThresholdConfig | null, productName: string) {
  const base = config ?? DEFAULT_THRESHOLDS;
  const overrides = config?.productOverrides?.[productName];
  return { ...base, ...overrides } as typeof DEFAULT_THRESHOLDS;
}

function deriveProduct(p: ProductLevelMetrics, config: ThresholdConfig | null): DerivedProduct {
  const t = getThresholdsForProduct(config, p.productName);
  const impressions = p.impressions ?? 0;
  const clicks = p.clicks ?? 0;
  const conversions = p.conversions ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const cpc = clicks > 0 ? p.spend / clicks : 0;
  const cpa = conversions > 0 ? p.spend / conversions : 0;
  const ruleTags: string[] = [];
  let productStatus: DerivedProduct["productStatus"] = "watch";

  if (p.spend >= t.spendThresholdStop && p.roas < t.roasTargetMin) {
    ruleTags.push("停損候選");
    productStatus = "stop";
  } else if (p.roas >= t.roasScaleMin && p.spend > 1000) {
    ruleTags.push("建議加碼");
    productStatus = "scale";
  } else if (p.spend >= t.minSpendForRules && p.roas < t.roasTargetMin) {
    ruleTags.push("危險");
    productStatus = "danger";
  }
  if (ctr >= t.ctrHigh && cvr < 2 && clicks > 50) ruleTags.push("疑頁面/疑受眾");
  if (ctr < 1 && cpc > 5 && p.spend > 500) ruleTags.push("素材問題優先");

  let aiSuggestion = "";
  if (productStatus === "stop") aiSuggestion = "建議立即停損或關閉";
  else if (productStatus === "scale") aiSuggestion = "受眾未飽和，建議加碼";
  else if (productStatus === "danger") aiSuggestion = "ROAS 偏低，建議觀察或縮預算";
  else aiSuggestion = "持續觀察";

  return {
    productName: p.productName,
    spend: p.spend,
    revenue: p.revenue,
    roas: p.roas,
    ctr,
    cvr,
    cpc,
    cpa,
    clicks,
    productStatus,
    ruleTags,
    aiSuggestion,
  };
}

function formatCurrency(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`;
}

function evidenceWindowSuffix(label?: string): string {
  const t = label?.trim();
  return t ? `（${t}）` : "";
}

/** 產出 8 張決策卡，無 placeholder；P2 可傳入 published threshold config */
export function buildDecisionCards(input: DecisionCardsInput, thresholdConfig?: ThresholdConfig | null): DecisionCardBlock[] {
  const { productLevel, creativeLeaderboard, funnelWarnings, urgentStop, failureRatesByTag } = input;
  const win = evidenceWindowSuffix(input.analysisWindowLabel);
  const products = productLevel.map((p) => deriveProduct(p, thresholdConfig ?? null));
  const totalSpend = products.reduce((s, p) => s + p.spend, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const stopCount = products.filter((p) => p.productStatus === "stop").length;
  const dangerCount = products.filter((p) => p.productStatus === "danger").length;
  const scaleCount = products.filter((p) => p.productStatus === "scale").length;

  const immediateItems: Array<{ title: string; rule: string; evidence: string; action: string; impact: string }> = [];
  products
    .filter((p) => p.productStatus === "stop")
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3)
    .forEach((p) => {
      immediateItems.push({
        title: `【停損】${p.productName}`,
        rule: "花費達門檻且 ROAS 低於目標",
        evidence: `花費 ${formatCurrency(p.spend)}${win}、ROAS ${p.roas.toFixed(2)}${win}`,
        action: `立即停損或關閉，建議幅度 100%`,
        impact: `可節省約 ${formatCurrency(p.spend)}`,
      });
    });
  urgentStop.slice(0, 2).forEach((u) => {
    immediateItems.push({
      title: `【高花費無轉換】${u.campaignName}`,
      rule: "花費 ≥ 500 且轉換數 0",
      evidence: `花費 ${formatCurrency(u.spend)}${win}`,
      action: "止血或暫停",
      impact: `可節省約 ${formatCurrency(u.spend)}`,
    });
  });
  products
    .filter((p) => p.productStatus === "danger" && !immediateItems.some((i) => i.title.includes(p.productName)))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 2)
    .forEach((p) => {
      immediateItems.push({
        title: `【危險】${p.productName}`,
        rule: "ROAS 低於目標、花費已達門檻",
        evidence: `花費 ${formatCurrency(p.spend)}、ROAS ${p.roas.toFixed(2)}`,
        action: "觀察或縮預算，建議幅度 -20%～-30%",
        impact: `潛在節省約 ${formatCurrency(p.spend * 0.25)}`,
      });
    });
  const immediateList = immediateItems.slice(0, 5);

  const productVerdicts = products
    .filter((p) => p.productStatus !== "watch")
    .sort((a, b) => b.spend - a.spend)
    .map(
      (p) =>
        `• ${p.productName}：${p.productStatus === "stop" ? "停損" : p.productStatus === "danger" ? "危險" : "加碼"} — ${p.aiSuggestion}（花費 ${formatCurrency(p.spend)}${win}、ROAS ${p.roas.toFixed(2)}${win}）`
    );

  const fatigueCreatives = creativeLeaderboard.filter((c) => {
    const fr = failureRatesByTag[c.materialStrategy] ?? 0;
    return fr >= 0.6;
  });
  const lowRoasCreatives = creativeLeaderboard.filter((c) => c.spend >= 200 && c.roas < (thresholdConfig?.roasTargetMin ?? DEFAULT_THRESHOLDS.roasTargetMin));
  const creativeVerdicts = [
    ...fatigueCreatives.slice(0, 5).map((c) => `• ${c.productName} / ${c.materialStrategy}：疲勞或歷史陣亡率高，建議關閉或重製`),
    ...lowRoasCreatives.slice(0, 5).map((c) => `• ${c.productName} / ${c.materialStrategy}：ROAS ${c.roas.toFixed(2)}${win}，花費 ${formatCurrency(c.spend)}${win}，建議關閉`),
  ].slice(0, 8);

  const budgetScale = products.filter((p) => p.productStatus === "scale").sort((a, b) => b.roas - a.roas);
  const budgetStop = products.filter((p) => p.productStatus === "stop" || p.productStatus === "danger");
  const budgetLines = [
    ...budgetScale.map((p) => `• ${p.productName}：建議加碼約 20%，目前花費 ${formatCurrency(p.spend)}`),
    ...budgetStop.map((p) => `• ${p.productName}：建議縮減或停損，目前花費 ${formatCurrency(p.spend)}`),
  ];

  const uncertain: string[] = [];
  if (productLevel.length === 0) uncertain.push("目前無商品維度資料，請確認廣告命名與資料已同步");
  products.filter((p) => p.ctr === 0 && p.clicks === 0).forEach((p) => uncertain.push(`${p.productName}：點擊/曝光不足，指標為推估`));
  if (funnelWarnings.length > 0) uncertain.push(`漏斗警報 ${funnelWarnings.length} 則，需人工判讀`);

  const checklistLines: string[] = [];
  immediateList.forEach((i, idx) => {
    checklistLines.push(`${idx + 1}. ${i.title}`);
    checklistLines.push(`   規則：${i.rule}`);
    checklistLines.push(`   證據：${i.evidence}`);
    checklistLines.push(`   動作：${i.action}`);
    checklistLines.push(`   影響：${i.impact}`);
  });
  productVerdicts.forEach((v) => checklistLines.push(v));
  creativeVerdicts.forEach((v) => checklistLines.push(v));
  budgetLines.slice(0, 5).forEach((b) => checklistLines.push(b));
  const checklistText = checklistLines.join("\n");

  const confidenceSummary = productLevel.length > 0 && totalSpend > 0 ? "high" : productLevel.length > 0 ? "medium" : "data_insufficient";

  const cards: DecisionCardBlock[] = [
    {
      key: "summary",
      label: "今日總結",
      conclusion: `今日共 ${products.length} 個商品、總花費 ${formatCurrency(totalSpend)}、營收 ${formatCurrency(totalRevenue)}、平均 ROAS ${avgRoas.toFixed(2)}。停損候選 ${stopCount} 個、危險 ${dangerCount} 個、建議加碼 ${scaleCount} 個。`,
      triggerRule: "依當日 action-center 彙總與規則引擎分類",
      evidenceMetrics: `總花費 ${formatCurrency(totalSpend)}、總營收 ${formatCurrency(totalRevenue)}、平均 ROAS ${avgRoas.toFixed(2)}、商品數 ${products.length}`,
      suggestedAction: "優先處理停損與加碼商品，再處理素材疲勞與漏斗警報",
      impactAmount: stopCount + dangerCount > 0 ? `停損/縮減可影響約 ${formatCurrency(products.filter((p) => p.productStatus === "stop" || p.productStatus === "danger").reduce((s, p) => s + p.spend, 0))}` : "無",
      confidence: confidenceSummary,
    },
    {
      key: "actions",
      label: "立即處理 3–5 件事",
      conclusion: immediateList.length > 0 ? `共 ${immediateList.length} 項：${immediateList.map((i) => i.title).join("；")}` : "今日無符合「立即處理」門檻的項目。",
      triggerRule: immediateList.length > 0 ? "停損候選（花費≥1500 且 ROAS<1）、高花費無轉換、危險候選" : "無觸發",
      evidenceMetrics: immediateList.map((i) => i.evidence).join("；") || "—",
      suggestedAction: immediateList.map((i) => `${i.title} → ${i.action}`).join("；") || "持續觀察即可",
      impactAmount: immediateList.map((i) => i.impact).join("；") || "—",
      confidence: immediateList.length > 0 ? "high" : "medium",
      copyableText: immediateList.map((i, idx) => `${idx + 1}. ${i.title} | ${i.action} | ${i.impact}`).join("\n"),
    },
    {
      key: "product",
      label: "商品判決",
      conclusion: productVerdicts.length > 0 ? productVerdicts.join("\n") : "無需判決商品（皆為觀察）。",
      triggerRule: "花費達門檻 + ROAS 低於目標 → 停損/危險；ROAS≥2.5 且花費>1000 → 加碼",
      evidenceMetrics:
        products.map((p) => `${p.productName}: 花費 ${formatCurrency(p.spend)}${win} ROAS ${p.roas.toFixed(2)}${win}`).join("；") || "—",
      suggestedAction: productVerdicts.length > 0 ? "依上列判決執行停損/縮預算/加碼，幅度見立即處理與預算建議" : "持續觀察",
      impactAmount: totalSpend > 0 ? `總盤約 ${formatCurrency(totalSpend)}，依判決執行可顯著影響` : "—",
      confidence: confidenceSummary,
    },
    {
      key: "creative",
      label: "素材判決",
      conclusion: creativeVerdicts.length > 0 ? creativeVerdicts.join("\n") : "無明顯疲勞或低效素材需立即處理。",
      triggerRule: "疲勞：歷史陣亡率≥60%；低效：花費≥200 且 ROAS<1",
      evidenceMetrics:
        creativeLeaderboard.length > 0 ? `共 ${creativeLeaderboard.length} 支素材${win}；疲勞/低效見上列` : "無素材維度資料",
      suggestedAction: creativeVerdicts.length > 0 ? "關閉或重製標示素材，補新素材替換" : "持續觀察",
      impactAmount: fatigueCreatives.length + lowRoasCreatives.length > 0 ? "依關閉數量可節省燒損並釋出預算" : "—",
      confidence: creativeLeaderboard.length > 0 ? "medium" : "data_insufficient",
    },
    {
      key: "budget",
      label: "預算建議",
      conclusion: budgetLines.length > 0 ? budgetLines.join("\n") : "目前無明顯加碼/縮減建議。",
      triggerRule: "加碼：ROAS≥2.5 且花費>1000；縮減/停損：見商品判決",
      evidenceMetrics: `總花費 ${formatCurrency(totalSpend)}；加碼候選 ${budgetScale.length}、縮減/停損 ${budgetStop.length}`,
      suggestedAction: budgetLines.length > 0 ? "加碼約 +20%、停損/危險縮減 -20%～-100%" : "維持現狀",
      impactAmount: totalSpend > 0 ? formatCurrency(totalSpend) : "—",
      confidence: confidenceSummary,
    },
    {
      key: "owner",
      label: "owner 建議",
      conclusion: "請至「商品中心」為高花費商品與素材指派商品 owner、投手 owner、素材 owner；未指派任務請在「行動紀錄」分配。",
      triggerRule: "依花費與狀態優先指派",
      evidenceMetrics: `商品數 ${products.length}、高花費（>1000）${products.filter((p) => p.spend > 1000).length} 個${win}`,
      suggestedAction: "在商品中心設定三種 owner，並在行動紀錄指派待辦",
      impactAmount: "—",
      confidence: "medium",
    },
    {
      key: "uncertain",
      label: "不確定因素 / 資料不足",
      conclusion: uncertain.length > 0 ? uncertain.join("\n") : "目前無標示為資料不足的項目。",
      triggerRule: "無商品資料、點擊/曝光不足、或漏斗警報需人工判讀",
      evidenceMetrics: uncertain.length > 0 ? uncertain.join("；") : "—",
      suggestedAction: uncertain.length > 0 ? "補齊資料或人工確認後再執行決策" : "—",
      impactAmount: "—",
      confidence: uncertain.length > 0 ? "data_insufficient" : "high",
    },
    {
      key: "checklist",
      label: "可複製執行清單",
      conclusion: checklistText || "今日無執行項目。",
      triggerRule: "由上列各卡彙總為可執行條目",
      evidenceMetrics: "—",
      suggestedAction: "複製下方內容貼至待辦或群組執行",
      impactAmount: "—",
      confidence: confidenceSummary,
      copyableText: checklistText || "今日無執行項目。",
    },
  ];
  return cards;
}
