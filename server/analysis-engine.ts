import type {
  CampaignMetrics,
  GA4FunnelMetrics,
  Anomaly,
  AccountHealthScore,
  RiskyCampaign,
  AnomalyType,
  AnomalyCategory,
} from "@shared/schema";
import { randomUUID } from "crypto";

const THRESHOLDS = {
  ROAS_DROP_PERCENT: -20,
  CPC_SPIKE_PERCENT: 30,
  CTR_DROP_PERCENT: -20,
  CVR_DROP_PERCENT: -15,
  CHECKOUT_ABANDON_SPIKE_PERCENT: 15,
  HIGH_SPEND_LOW_ROAS: 1.0,
  FATIGUE_FREQUENCY: 4.0,
  BUDGET_CONCENTRATION_PERCENT: 50,
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function anomalySeverity(changePercent: number, thresholdPercent: number): "critical" | "high" | "medium" {
  const ratio = Math.abs(changePercent / thresholdPercent);
  if (ratio >= 2) return "critical";
  if (ratio >= 1.3) return "high";
  return "medium";
}

export function detectCampaignAnomalies(
  campaigns: CampaignMetrics[],
  accountName: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

  for (const c of campaigns) {
    if (c.spend === 0 && c.spendPrev === 0) continue;

    const roasChange = pctChange(c.roas, c.roasPrev);
    if (c.roasPrev > 0 && roasChange <= THRESHOLDS.ROAS_DROP_PERCENT) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "roas_drop",
        category: "ads",
        severity: anomalySeverity(roasChange, THRESHOLDS.ROAS_DROP_PERCENT),
        title: `ROAS 大幅下滑`,
        description: `${c.campaignName} 的 ROAS 從 ${c.roasPrev.toFixed(1)} 降至 ${c.roas.toFixed(1)} (${roasChange.toFixed(0)}%)`,
        currentValue: c.roas,
        previousValue: c.roasPrev,
        changePercent: roasChange,
        relatedCampaign: c.campaignName,
        suggestedAction: c.roas < 1 ? "建議立即暫停此活動，停止浪費預算" : "建議降低預算觀察，檢查受眾與素材",
      });
    }

    const cpcChange = pctChange(c.cpc, c.cpcPrev);
    if (c.cpcPrev > 0 && cpcChange >= THRESHOLDS.CPC_SPIKE_PERCENT) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "cpc_spike",
        category: "ads",
        severity: anomalySeverity(cpcChange, THRESHOLDS.CPC_SPIKE_PERCENT),
        title: `CPC 飆升`,
        description: `${c.campaignName} 的 CPC 從 ${c.cpcPrev.toFixed(1)} 升至 ${c.cpc.toFixed(1)} (${cpcChange.toFixed(0)}%)`,
        currentValue: c.cpc,
        previousValue: c.cpcPrev,
        changePercent: cpcChange,
        relatedCampaign: c.campaignName,
        suggestedAction: "檢查素材疲勞度與受眾重疊，考慮更新素材或調整受眾",
      });
    }

    const ctrChange = pctChange(c.ctr, c.ctrPrev);
    if (c.ctrPrev > 0 && ctrChange <= THRESHOLDS.CTR_DROP_PERCENT) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "ctr_drop",
        category: "ads",
        severity: anomalySeverity(ctrChange, THRESHOLDS.CTR_DROP_PERCENT),
        title: `CTR 顯著下降`,
        description: `${c.campaignName} 的 CTR 從 ${c.ctrPrev.toFixed(2)}% 降至 ${c.ctr.toFixed(2)}% (${ctrChange.toFixed(0)}%)`,
        currentValue: c.ctr,
        previousValue: c.ctrPrev,
        changePercent: ctrChange,
        relatedCampaign: c.campaignName,
        suggestedAction: "素材可能已疲勞，建議更換新素材或嘗試新角度",
      });
    }

    if (c.spend > 0 && c.roas < THRESHOLDS.HIGH_SPEND_LOW_ROAS && totalSpend > 0 && (c.spend / totalSpend) > 0.15) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "high_spend_low_efficiency",
        category: "ads",
        severity: c.roas < 0.5 ? "critical" : "high",
        title: `高花費低效率活動`,
        description: `${c.campaignName} 花費 NT$${c.spend.toLocaleString()} (占總花費 ${((c.spend/totalSpend)*100).toFixed(0)}%)，但 ROAS 僅 ${c.roas.toFixed(1)}`,
        currentValue: c.roas,
        previousValue: c.roasPrev,
        changePercent: pctChange(c.roas, c.roasPrev),
        relatedCampaign: c.campaignName,
        suggestedAction: "建議立即降低預算或暫停，將預算轉移至高效活動",
      });
    }

    if (c.frequency >= THRESHOLDS.FATIGUE_FREQUENCY) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "creative_fatigue",
        category: "fatigue",
        severity: c.frequency >= 6 ? "critical" : "high",
        title: `素材疑似疲勞`,
        description: `${c.campaignName} 頻率達 ${c.frequency.toFixed(1)}，受眾可能已過度曝光`,
        currentValue: c.frequency,
        previousValue: 0,
        changePercent: 0,
        relatedCampaign: c.campaignName,
        suggestedAction: "建議立即更換素材，或擴大受眾以降低頻率",
      });
    }

    if (totalSpend > 0 && (c.spend / totalSpend) >= (THRESHOLDS.BUDGET_CONCENTRATION_PERCENT / 100) && c.roas < 2) {
      anomalies.push({
        id: `anomaly-${randomUUID().slice(0, 8)}`,
        accountId: c.accountId,
        accountName,
        type: "budget_concentration",
        category: "ads",
        severity: "high",
        title: `預算過度集中`,
        description: `${c.campaignName} 佔帳號總花費 ${((c.spend/totalSpend)*100).toFixed(0)}%，但效率不佳 (ROAS ${c.roas.toFixed(1)})`,
        currentValue: (c.spend / totalSpend) * 100,
        previousValue: 0,
        changePercent: 0,
        relatedCampaign: c.campaignName,
        suggestedAction: "建議分散預算至其他活動，降低單一活動風險",
      });
    }
  }

  return anomalies;
}

export function detectGA4Anomalies(
  ga4: GA4FunnelMetrics,
  accountName: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const accountId = ga4.propertyId;

  const cvrChange = pctChange(ga4.conversionRate, ga4.conversionRatePrev);
  if (ga4.conversionRatePrev > 0 && cvrChange <= THRESHOLDS.CVR_DROP_PERCENT) {
    anomalies.push({
      id: `anomaly-${randomUUID().slice(0, 8)}`,
      accountId,
      accountName,
      type: "cvr_drop",
      category: "funnel",
      severity: anomalySeverity(cvrChange, THRESHOLDS.CVR_DROP_PERCENT),
      title: `轉換率顯著下滑`,
      description: `轉換率從 ${ga4.conversionRatePrev.toFixed(2)}% 降至 ${ga4.conversionRate.toFixed(2)}% (${cvrChange.toFixed(0)}%)`,
      currentValue: ga4.conversionRate,
      previousValue: ga4.conversionRatePrev,
      changePercent: cvrChange,
      suggestedAction: "檢查頁面體驗與結帳流程，可能有技術問題或 UX 障礙",
    });
  }

  const abandonChange = pctChange(ga4.checkoutAbandonmentRate, ga4.checkoutAbandonmentRatePrev);
  if (ga4.checkoutAbandonmentRatePrev > 0 && abandonChange >= THRESHOLDS.CHECKOUT_ABANDON_SPIKE_PERCENT) {
    anomalies.push({
      id: `anomaly-${randomUUID().slice(0, 8)}`,
      accountId,
      accountName,
      type: "checkout_abandonment_spike",
      category: "funnel",
      severity: anomalySeverity(abandonChange, THRESHOLDS.CHECKOUT_ABANDON_SPIKE_PERCENT),
      title: `結帳流失率惡化`,
      description: `結帳放棄率從 ${ga4.checkoutAbandonmentRatePrev.toFixed(1)}% 升至 ${ga4.checkoutAbandonmentRate.toFixed(1)}% (${abandonChange.toFixed(0)}%)`,
      currentValue: ga4.checkoutAbandonmentRate,
      previousValue: ga4.checkoutAbandonmentRatePrev,
      changePercent: abandonChange,
      suggestedAction: "立即檢查結帳頁面，可能有技術障礙、運費問題或信任不足",
    });
  }

  return anomalies;
}

export function identifyRiskyCampaigns(campaigns: CampaignMetrics[]): RiskyCampaign[] {
  const risky: RiskyCampaign[] = [];

  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend);

  for (const c of sorted) {
    if (c.spend <= 0) continue;

    if (c.roas < 1.0 && c.spend > 500) {
      risky.push({
        accountId: c.accountId,
        accountName: c.accountName,
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        riskType: "high_spend_low_efficiency",
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        suggestion: "stop",
        suggestionLabel: "建議停損",
        problemDescription: `花費 NT$${c.spend.toLocaleString()} 但 ROAS 僅 ${c.roas.toFixed(1)}，虧損嚴重`,
      });
    }

    const roasChange = pctChange(c.roas, c.roasPrev);
    if (c.roasPrev > 0 && roasChange < -30 && c.spend > 300) {
      risky.push({
        accountId: c.accountId,
        accountName: c.accountName,
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        riskType: "rapid_deterioration",
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        suggestion: "observe",
        suggestionLabel: "建議觀察",
        problemDescription: `ROAS 從 ${c.roasPrev.toFixed(1)} 急降至 ${c.roas.toFixed(1)}，惡化幅度 ${roasChange.toFixed(0)}%`,
      });
    }

    if (c.spend < 500 && c.roas > 3.0 && c.conversions > 0) {
      risky.push({
        accountId: c.accountId,
        accountName: c.accountName,
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        riskType: "low_spend_high_potential",
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        suggestion: "scale",
        suggestionLabel: "建議加碼",
        problemDescription: `花費僅 NT$${c.spend.toLocaleString()} 但 ROAS 達 ${c.roas.toFixed(1)}，具備擴量潛力`,
      });
    }
  }

  return risky;
}

// Priority Score: higher = more urgent to fix
// Weights: budget 25%, impact 25%, anomaly severity 25%, deterioration 15%, recoverability 10%
export function calculateAccountPriorityScore(
  campaigns: CampaignMetrics[],
  anomalies: Anomaly[],
  allCampaigns: CampaignMetrics[]
): number {
  if (campaigns.length === 0) return 0;

  const accountSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalSpend = allCampaigns.reduce((s, c) => s + c.spend, 0);
  const budgetWeight = totalSpend > 0 ? Math.min(1, accountSpend / totalSpend) * 100 : 50;

  const accountRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalRevenue = allCampaigns.reduce((s, c) => s + c.revenue, 0);
  const impactWeight = totalRevenue > 0 ? Math.min(1, accountRevenue / totalRevenue) * 100 : 50;

  const severityMap = { critical: 100, high: 70, medium: 40 };
  const anomalyWeight = anomalies.length === 0 ? 0
    : Math.min(100, anomalies.reduce((s, a) => s + severityMap[a.severity], 0) / anomalies.length);

  const deteriorationValues = campaigns
    .filter(c => c.roasPrev > 0)
    .map(c => pctChange(c.roas, c.roasPrev));
  const avgDeterioration = deteriorationValues.length > 0
    ? Math.abs(Math.min(0, ...deteriorationValues))
    : 0;
  const deteriorationWeight = Math.min(100, avgDeterioration * 2);

  const avgRoas = accountSpend > 0 ? accountRevenue / accountSpend : 0;
  const recoverabilityWeight = avgRoas > 0.5 && avgRoas < 3 ? 80 : avgRoas >= 3 ? 40 : 60;

  const score = (
    budgetWeight * 0.25 +
    impactWeight * 0.25 +
    anomalyWeight * 0.25 +
    deteriorationWeight * 0.15 +
    recoverabilityWeight * 0.10
  );

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateAccountHealth(
  accountId: string,
  accountName: string,
  platform: "meta" | "ga4",
  campaigns: CampaignMetrics[],
  anomalies: Anomaly[],
  allCampaigns: CampaignMetrics[],
  ga4Data?: GA4FunnelMetrics | null
): AccountHealthScore {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roas = spend > 0 ? revenue / spend : 0;

  const conversionRate = ga4Data?.conversionRate ?? (campaigns.length > 0
    ? (campaigns.reduce((s, c) => s + c.conversions, 0) / Math.max(1, campaigns.reduce((s, c) => s + c.clicks, 0))) * 100
    : 0);

  const checkoutAbandonment = ga4Data?.checkoutAbandonmentRate ?? 0;
  const priorityScore = calculateAccountPriorityScore(campaigns, anomalies, allCampaigns);
  const accountAnomalies = anomalies.filter(a => a.accountId === accountId);

  let healthStatus: "healthy" | "warning" | "danger" = "healthy";
  if (priorityScore >= 60 || accountAnomalies.some(a => a.severity === "critical")) {
    healthStatus = "danger";
  } else if (priorityScore >= 30 || accountAnomalies.length > 2) {
    healthStatus = "warning";
  }

  const topAnomaly = accountAnomalies.sort((a, b) => {
    const sev = { critical: 3, high: 2, medium: 1 };
    return sev[b.severity] - sev[a.severity];
  })[0];

  return {
    accountId,
    accountName,
    platform,
    priorityScore,
    healthStatus,
    spend,
    revenue,
    roas,
    conversionRate,
    checkoutAbandonment,
    anomalyCount: accountAnomalies.length,
    topProblem: topAnomaly?.title || "無異常",
    suggestedAction: topAnomaly?.suggestedAction || "持續監控",
  };
}
