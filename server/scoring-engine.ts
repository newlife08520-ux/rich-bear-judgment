import type {
  CampaignMetrics,
  GA4FunnelMetrics,
  GA4PageMetricsDetailed,
  TriScore,
  RiskLevel,
  MultiWindowMetrics,
  WindowSnapshot,
  StopLossResult,
  OpportunityCandidate,
  OpportunityType,
  V2Scores,
  ScoringResult,
  DiagnosisType,
  RecommendedAction,
  BoardEntry,
  BoardSet,
  AccountHealthScore,
  Anomaly,
} from "@shared/schema";
import { DIAGNOSIS_LABELS, ACTION_LABELS, triScoreToV2Scores } from "@shared/schema";

/**
 * @legacy-batch6_8 歷史分數／看板啟發式。新決策面以 workbench／標籤聚合／goal-pacing 為主敘事。
 * 修改時請對照 docs/archive/BATCH6.8-COMPLETION-REPORT.md 與 npm run verify:batch25:legacy-heuristic-reconciliation。
 */

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function safeDiv(a: number, b: number, fallback = 0): number {
  return b !== 0 ? a / b : fallback;
}

interface AccountAvg {
  roas: number;
  ctr: number;
  cpc: number;
  cvr: number;
  frequency: number;
  spend: number;
  dailySpend: number;
  totalSpend: number;
  totalRevenue: number;
  campaignCount: number;
}

export function computeAccountAvg(campaigns: CampaignMetrics[]): AccountAvg {
  if (campaigns.length === 0) {
    return { roas: 0, ctr: 0, cpc: 0, cvr: 0, frequency: 0, spend: 0, dailySpend: 0, totalSpend: 0, totalRevenue: 0, campaignCount: 0 };
  }
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return {
    roas: safeDiv(totalRevenue, totalSpend),
    ctr: safeDiv(totalClicks, totalImpressions) * 100,
    cpc: safeDiv(totalSpend, totalClicks),
    cvr: safeDiv(totalConversions, totalClicks) * 100,
    frequency: campaigns.reduce((s, c) => s + c.frequency, 0) / campaigns.length,
    spend: totalSpend / campaigns.length,
    dailySpend: totalSpend / 7,
    totalSpend,
    totalRevenue,
    campaignCount: campaigns.length,
  };
}

export function calculateCampaignTriScore(
  c: CampaignMetrics,
  avg: AccountAvg,
  roasTarget = 2.0
): TriScore {
  const health = computeHealthScore(c, avg);
  const urgency = computeUrgencyScore(c, avg);
  const scalePotential = computeScalePotentialScore(c, avg, roasTarget);
  return { health, urgency, scalePotential };
}

function computeHealthScore(c: CampaignMetrics, avg: AccountAvg): number {
  let score = 0;

  const roasRatio = avg.roas > 0 ? c.roas / avg.roas : (c.roas > 0 ? 1.5 : 0);
  score += clamp(roasRatio * 50, 0, 20);

  const ctrRatio = avg.ctr > 0 ? c.ctr / avg.ctr : (c.ctr > 0 ? 1.5 : 0);
  score += clamp(ctrRatio * 50 - 35, 0, 15);

  const cvrRatio = avg.cvr > 0 ? (c.conversions > 0 ? safeDiv(c.conversions, c.clicks) * 100 / avg.cvr : 0) : (c.conversions > 0 ? 1 : 0);
  score += clamp(cvrRatio * 50 - 35, 0, 15);

  const cpcRatio = avg.cpc > 0 ? avg.cpc / Math.max(0.01, c.cpc) : 1;
  score += clamp(cpcRatio * 50 - 40, 0, 10);

  const freqHealth = c.frequency < 2 ? 15 : c.frequency < 3 ? 12 : c.frequency < 4 ? 8 : c.frequency < 6 ? 4 : 0;
  score += freqHealth;

  const funnelCompletion = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
  score += clamp(funnelCompletion * 3, 0, 15);

  const sampleBonus = c.impressions >= 10000 ? 10 : c.impressions >= 5000 ? 7 : c.impressions >= 1000 ? 4 : 1;
  score += sampleBonus;

  return clamp(Math.round(score));
}

function computeUrgencyScore(c: CampaignMetrics, avg: AccountAvg): number {
  let score = 0;

  if (c.multiWindow) {
    const mw = c.multiWindow;
    let trendDown = 0;
    const windows: [WindowSnapshot, WindowSnapshot][] = [
      [mw.window1d, mw.prev1d],
      [mw.window3d, mw.prev3d],
      [mw.window7d, mw.prev7d],
      [mw.window14d, mw.prev14d],
    ];
    for (const [curr, prev] of windows) {
      if (prev.roas > 0 && curr.roas < prev.roas) trendDown++;
      if (prev.ctr > 0 && curr.ctr < prev.ctr) trendDown++;
    }
    score += clamp((trendDown / 8) * 100 * 0.6, 0, 30);
  } else {
    const roasChange = pctChange(c.roas, c.roasPrev);
    const ctrChange = pctChange(c.ctr, c.ctrPrev);
    if (roasChange < -20) score += 15;
    if (ctrChange < -20) score += 10;
    if (c.roas < 1 && c.roasPrev > 1) score += 5;
  }

  if (c.roas < 0.5 && c.spend > 200) score += 20;
  else if (c.roas < 1 && c.spend > 100) score += 12;
  else if (c.roas < 1.5) score += 5;

  const burnRisk = avg.totalSpend > 0 ? (c.spend / avg.totalSpend) * (c.roas < 1 ? 2 : 1) : 0;
  score += clamp(burnRisk * 100, 0, 20);

  const improvingRecently = c.roasPrev > 0 && c.roas > c.roasPrev;
  if (!improvingRecently && c.roas < avg.roas) score += 10;
  if (improvingRecently) score -= 5;

  if (c.impressions < 1000 && c.roas < 1) score += 10;
  else if (c.impressions < 500) score += 5;

  return clamp(Math.round(score));
}

function computeScalePotentialScore(c: CampaignMetrics, avg: AccountAvg, roasTarget: number): number {
  let score = 0;

  const headroom = c.roas - roasTarget;
  if (headroom > 0) {
    score += clamp(headroom * 10, 0, 25);
  }

  if (c.multiWindow) {
    const mw = c.multiWindow;
    const roasValues = [mw.window3d.roas, mw.window7d.roas, mw.window14d.roas].filter(v => v > 0);
    if (roasValues.length >= 2) {
      const roasMean = roasValues.reduce((a, b) => a + b, 0) / roasValues.length;
      const roasVariance = roasValues.reduce((s, v) => s + (v - roasMean) ** 2, 0) / roasValues.length;
      const cv = roasMean > 0 ? Math.sqrt(roasVariance) / roasMean : 1;
      score += clamp((1 - cv) * 25, 0, 20);
    }
  } else {
    if (c.roasPrev > 0 && Math.abs(pctChange(c.roas, c.roasPrev)) < 15 && c.roas > roasTarget) {
      score += 15;
    }
  }

  const freqHeadroom = Math.max(0, 3 - c.frequency);
  score += clamp(freqHeadroom * 5, 0, 15);

  const spendShare = avg.totalSpend > 0 ? c.spend / avg.totalSpend : 0;
  if (spendShare < 0.1 && c.roas > avg.roas) score += 15;
  else if (spendShare < 0.2 && c.roas > avg.roas) score += 8;

  const ctrStrength = avg.ctr > 0 ? c.ctr / avg.ctr : 0;
  score += clamp((ctrStrength - 0.5) * 15, 0, 15);

  score += c.frequency < 1.5 ? 10 : c.frequency < 2.5 ? 6 : 2;

  return clamp(Math.round(score));
}

export function classifyRiskLevel(
  triScore: TriScore,
  c: CampaignMetrics,
  avg: AccountAvg
): RiskLevel {
  if (c.multiWindow) {
    const mw = c.multiWindow;
    const roas7d = mw.window7d.roas;
    const roas14d = mw.window14d.roas;
    const roas7dPrev = mw.prev7d.roas;

    if (roas7d < 1 && roas14d < 1 && roas7dPrev > 0 && roas7d < roas7dPrev && c.spend > 200) {
      return "danger";
    }
    if ((roas7d < 1.5 || roas14d < 1.5) && triScore.urgency >= 50) {
      return "warning";
    }
    if (roas7d > 2 && roas14d > 2 && triScore.scalePotential >= 50) {
      return "potential";
    }
  }

  if (triScore.health < 25 && triScore.urgency >= 60) return "danger";
  if (triScore.health < 40 && triScore.urgency >= 40) return "warning";
  if (triScore.urgency >= 30 || triScore.health < 50) return "watch";
  if (triScore.scalePotential >= 60 && triScore.health >= 60) return "potential";
  return "stable";
}

export function evaluateStopLoss(
  c: CampaignMetrics,
  avg: AccountAvg,
  allCampaigns: CampaignMetrics[],
  roasTarget = 2.0
): StopLossResult {
  const reasons: string[] = [];

  const w7 = c.multiWindow?.window7d;
  const impressions7d = w7?.impressions ?? c.impressions;
  const spend7d = w7?.spend ?? c.spend;
  const roas7d = w7?.roas ?? c.roas;
  const roas14d = c.multiWindow?.window14d?.roas ?? c.roas;
  const roas3d = c.multiWindow?.window3d?.roas;

  const sampleMet = impressions7d >= 1000;
  if (!sampleMet) reasons.push("樣本不足 (7 天曝光 < 1,000)，數據尚不具統計意義");

  const spendThreshold = Math.max(500, avg.dailySpend * 3);
  const spendMet = spend7d > spendThreshold;
  if (!spendMet) reasons.push(`花費未達門檻 (需 > NT$${Math.round(spendThreshold).toLocaleString()})`);

  const multiWindowMet = roas7d < roasTarget && roas14d < roasTarget;
  if (multiWindowMet) {
    reasons.push(`ROAS 在 7 天 (${roas7d.toFixed(1)}) 和 14 天 (${roas14d.toFixed(1)}) 均低於目標 ${roasTarget}`);
  }

  const vsAccountAvgMet = avg.roas > 0 && roas7d < avg.roas * 0.5;
  if (vsAccountAvgMet) {
    reasons.push(`ROAS ${roas7d.toFixed(1)} 低於帳號平均 ${avg.roas.toFixed(1)} 的 50%`);
  }

  const sameCampaigns = allCampaigns.filter(x => x.accountId === c.accountId && x.spend > 0);
  const sortedByRoas = [...sameCampaigns].sort((a, b) => a.roas - b.roas);
  const percentileIdx = Math.floor(sortedByRoas.length * 0.2);
  const bottomPercentileMet = sameCampaigns.length >= 3 && sortedByRoas.indexOf(c) < percentileIdx;
  if (bottomPercentileMet) {
    reasons.push(`ROAS 在同帳號活動中排名後 20%`);
  }

  let noImprovementMet = true;
  if (roas3d !== undefined && c.multiWindow?.prev3d) {
    if (roas3d > c.multiWindow.prev3d.roas * 1.05) {
      noImprovementMet = false;
    }
  }
  if (!noImprovementMet) {
    reasons.push("近 3 天有改善趨勢，暫不建議停損");
  }

  const shouldStop = sampleMet && spendMet && multiWindowMet && vsAccountAvgMet && bottomPercentileMet && noImprovementMet;

  const timeWindow = c.multiWindow
    ? `觀察窗口：1d/3d/7d/14d，7 天 ROAS ${roas7d.toFixed(2)}，14 天 ROAS ${roas14d.toFixed(2)}`
    : `觀察窗口：近 7 天 vs 前期`;

  const benchmark = avg.roas > 0
    ? `帳號平均 ROAS ${avg.roas.toFixed(2)}，此活動僅 ${roas7d.toFixed(2)}（${Math.round((roas7d / avg.roas) * 100)}%）`
    : undefined;

  let sustainedPattern: string | undefined;
  if (c.multiWindow) {
    const mw = c.multiWindow;
    const allBelow = mw.window3d.roas < roasTarget && mw.window7d.roas < roasTarget && mw.window14d.roas < roasTarget;
    const shortTermOnly = mw.window3d.roas < roasTarget && mw.window7d.roas >= roasTarget;
    if (allBelow) {
      sustainedPattern = `持續性虧損：3 天 (${mw.window3d.roas.toFixed(2)})、7 天 (${mw.window7d.roas.toFixed(2)})、14 天 (${mw.window14d.roas.toFixed(2)}) 均低於目標 ${roasTarget}`;
    } else if (shortTermOnly) {
      sustainedPattern = `短期衰退：近 3 天 ROAS ${mw.window3d.roas.toFixed(2)} 低於目標，但 7 天期 ${mw.window7d.roas.toFixed(2)} 尚可——可能是暫時波動`;
    }
  } else {
    if (c.roas < roasTarget && c.roasPrev >= roasTarget) {
      sustainedPattern = `短期下滑：前期 ROAS ${c.roasPrev.toFixed(2)} 正常，本期降至 ${c.roas.toFixed(2)}——觀察是否為短期波動`;
    } else if (c.roas < roasTarget && c.roasPrev < roasTarget) {
      sustainedPattern = `持續虧損：前期 ${c.roasPrev.toFixed(2)}、本期 ${c.roas.toFixed(2)} 均低於目標 ${roasTarget}`;
    }
  }

  let possiblePageIssue: string | undefined;
  if (c.ctr >= avg.ctr * 0.9 && c.roas < 1) {
    possiblePageIssue = `CTR ${c.ctr.toFixed(2)}% 正常但 ROAS 僅 ${c.roas.toFixed(2)}——問題可能不在廣告素材，而在落地頁或產品頁轉換`;
  } else if (c.clicks > 50 && c.conversions === 0) {
    possiblePageIssue = `${c.clicks} 次點擊但零轉換——強烈建議檢查落地頁體驗和結帳流程`;
  }

  return {
    shouldStop,
    reasons,
    criteria: { sampleMet, spendMet, multiWindowMet, vsAccountAvgMet, bottomPercentileMet, noImprovementMet },
    timeWindow,
    benchmark,
    sustainedPattern,
    possiblePageIssue,
  };
}

const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  low_spend_high_efficiency: "低花費高效率",
  stable_scalable: "穩定可擴量",
  new_potential: "新素材潛力股",
  restartable: "可重啟測試素材",
};

export function classifyOpportunities(
  campaigns: CampaignMetrics[],
  avg: AccountAvg,
  riskyCampaignIds: Set<string>,
  roasTarget = 2.0
): OpportunityCandidate[] {
  const results: OpportunityCandidate[] = [];
  const medianSpend = getMedian(campaigns.filter(c => c.spend > 0).map(c => c.spend));

  for (const c of campaigns) {
    if (c.spend === 0 && c.impressions === 0) continue;
    if (c.roas === 0 && c.impressions === 0) continue;
    if (riskyCampaignIds.has(c.campaignId)) continue;
    if (c.status === "ENDED" || c.status === "ended") continue;
    if (c.scoring && c.scoring.scores.confidence < 20) continue;
    if (c.stopLoss?.shouldStop) continue;
    if (c.spend < 50 && c.impressions < 500) continue;

    const triScore = c.triScore || calculateCampaignTriScore(c, avg, roasTarget);
    const riskLevel = c.riskLevel || classifyRiskLevel(triScore, c, avg);
    if (riskLevel === "danger") continue;

    const stopLoss = c.stopLoss || evaluateStopLoss(c, avg, campaigns, roasTarget);
    if (stopLoss.shouldStop) continue;

    let type: OpportunityType | null = null;

    if (c.spend < medianSpend && c.roas > avg.roas * 1.5 && c.conversions > 0) {
      type = "low_spend_high_efficiency";
    } else if (c.multiWindow) {
      const mw = c.multiWindow;
      const roasValues = [mw.window3d.roas, mw.window7d.roas, mw.window14d.roas];
      const roasMean = roasValues.reduce((a, b) => a + b, 0) / roasValues.length;
      const allStable = roasValues.every(v => v > 0 && Math.abs((v - roasMean) / roasMean) < 0.15);
      if (allStable && c.frequency < 2.5 && c.roas > roasTarget) {
        type = "stable_scalable";
      }
    } else if (c.roas > roasTarget && c.frequency < 2.5 && Math.abs(pctChange(c.roas, c.roasPrev)) < 15 && c.roasPrev > 0) {
      type = "stable_scalable";
    }

    if (!type && c.impressions > 500 && c.conversions > 0 && c.roas > roasTarget && c.spend < medianSpend * 0.5) {
      type = "new_potential";
    }

    if (!type && c.status === "PAUSED" && c.roasPrev > roasTarget && c.frequency < 3) {
      type = "restartable";
    }

    if (!type) continue;

    const spendShare = avg.totalSpend > 0 ? c.spend / avg.totalSpend : 0;
    const roasVsAccountAvg = avg.roas > 0 ? c.roas / avg.roas : 0;
    const ctrVsAccountAvg = avg.ctr > 0 ? c.ctr / avg.ctr : 0;

    let estimatedScalePotential = 0;
    if (c.roas > roasTarget) estimatedScalePotential += 30;
    if (c.frequency < 2) estimatedScalePotential += 25;
    if (spendShare < 0.1) estimatedScalePotential += 20;
    if (ctrVsAccountAvg > 1.2) estimatedScalePotential += 15;
    if (c.conversions > 5) estimatedScalePotential += 10;
    estimatedScalePotential = clamp(estimatedScalePotential);

    results.push({
      accountId: c.accountId,
      accountName: c.accountName,
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      type,
      typeLabel: OPPORTUNITY_TYPE_LABELS[type],
      spendShare: Math.round(spendShare * 10000) / 100,
      roasVsAccountAvg: Math.round(roasVsAccountAvg * 100) / 100,
      ctrVsAccountAvg: Math.round(ctrVsAccountAvg * 100) / 100,
      frequency: c.frequency,
      estimatedScalePotential,
      triScore,
      riskLevel,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      ctr: c.ctr,
      conversions: c.conversions,
      status: c.status,
    });
  }

  return results.sort((a, b) => b.estimatedScalePotential - a.estimatedScalePotential);
}

export function calculateAccountTriScore(
  campaigns: CampaignMetrics[],
  anomalies: { severity: "critical" | "high" | "medium" }[],
  avg: AccountAvg,
  ga4Data?: GA4FunnelMetrics | null
): TriScore {
  if (campaigns.length === 0) return { health: 50, urgency: 0, scalePotential: 30 };

  const campaignScores = campaigns.map(c => c.triScore || calculateCampaignTriScore(c, avg));
  const avgHealth = campaignScores.reduce((s, t) => s + t.health, 0) / campaignScores.length;
  const avgUrgency = campaignScores.reduce((s, t) => s + t.urgency, 0) / campaignScores.length;
  const avgScale = campaignScores.reduce((s, t) => s + t.scalePotential, 0) / campaignScores.length;

  let healthBonus = 0;
  let urgencyBonus = 0;
  if (ga4Data) {
    if (ga4Data.conversionRate > 3) healthBonus += 10;
    if (ga4Data.checkoutAbandonmentRate > 70) {
      urgencyBonus += 15;
      healthBonus -= 10;
    }
  }

  const severityMap = { critical: 15, high: 8, medium: 3 };
  const anomalyUrgency = anomalies.reduce((s, a) => s + severityMap[a.severity], 0);

  return {
    health: clamp(Math.round(avgHealth + healthBonus)),
    urgency: clamp(Math.round(avgUrgency + urgencyBonus + Math.min(30, anomalyUrgency))),
    scalePotential: clamp(Math.round(avgScale)),
  };
}

export function calculatePageTriScore(
  page: Omit<GA4PageMetricsDetailed, "triScore" | "riskLevel">,
  siteAvg: { conversionRate: number; bounceRate: number; avgEngagementTime: number }
): TriScore {
  let health = 50;
  let urgency = 0;
  let scalePotential = 30;

  if (siteAvg.conversionRate > 0) {
    const crRatio = page.conversionRate / siteAvg.conversionRate;
    health += clamp(crRatio * 20 - 10, -20, 25);
  }
  if (siteAvg.bounceRate > 0 && page.bounceRate > 0) {
    const brRatio = siteAvg.bounceRate / page.bounceRate;
    health += clamp(brRatio * 15 - 10, -15, 15);
  }
  if (siteAvg.avgEngagementTime > 0 && page.avgEngagementTime > 0) {
    const etRatio = page.avgEngagementTime / siteAvg.avgEngagementTime;
    health += clamp(etRatio * 10 - 5, -10, 10);
  }

  if (page.conversionRatePrev > 0) {
    const crDrop = pctChange(page.conversionRate, page.conversionRatePrev);
    if (crDrop < -20) urgency += 25;
    else if (crDrop < -10) urgency += 12;
  }
  if (page.sessionsPrev > 0) {
    const sessDrop = pctChange(page.sessions, page.sessionsPrev);
    if (sessDrop < -30) urgency += 20;
    else if (sessDrop < -15) urgency += 10;
  }
  if (page.bounceRate > 80) urgency += 15;
  const revenueImpact = page.revenue > 0 && page.revenuePrev > 0 ? pctChange(page.revenue, page.revenuePrev) : 0;
  if (revenueImpact < -30) urgency += 15;

  if (page.conversionRate > siteAvg.conversionRate * 1.5 && page.sessions < 100) {
    scalePotential += 30;
  }
  if (page.conversionRate > siteAvg.conversionRate && page.bounceRate < siteAvg.bounceRate) {
    scalePotential += 20;
  }
  if (page.sessions > 500 && page.conversionRate > siteAvg.conversionRate * 0.8) {
    scalePotential += 10;
  }

  return {
    health: clamp(Math.round(health)),
    urgency: clamp(Math.round(urgency)),
    scalePotential: clamp(Math.round(scalePotential)),
  };
}

export function classifyPageRiskLevel(triScore: TriScore): RiskLevel {
  if (triScore.health < 25 && triScore.urgency >= 50) return "danger";
  if (triScore.health < 40 && triScore.urgency >= 30) return "warning";
  if (triScore.urgency >= 20 || triScore.health < 50) return "watch";
  if (triScore.scalePotential >= 60 && triScore.health >= 60) return "potential";
  return "stable";
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ========== V2 Scoring System ==========

export function computeConfidenceScore(c: CampaignMetrics): number {
  let score = 0;

  if (c.impressions >= 10000) score += 30;
  else if (c.impressions >= 5000) score += 22;
  else if (c.impressions >= 1000) score += 14;
  else if (c.impressions >= 500) score += 8;
  else score += 3;

  if (c.conversions >= 30) score += 25;
  else if (c.conversions >= 10) score += 18;
  else if (c.conversions >= 3) score += 10;
  else if (c.conversions >= 1) score += 5;

  if (c.multiWindow) {
    const windows = [c.multiWindow.window3d, c.multiWindow.window7d, c.multiWindow.window14d];
    const validWindows = windows.filter(w => w.impressions > 0).length;
    score += validWindows * 8;

    const roasValues = windows.filter(w => w.roas > 0).map(w => w.roas);
    if (roasValues.length >= 2) {
      const mean = roasValues.reduce((a, b) => a + b, 0) / roasValues.length;
      const variance = roasValues.reduce((s, v) => s + (v - mean) ** 2, 0) / roasValues.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      score += clamp(Math.round((1 - cv) * 15), 0, 15);
    }
  } else {
    if (c.roasPrev > 0) score += 6;
    if (c.ctrPrev > 0) score += 3;
  }

  const daysCoverage = c.multiWindow ? 4 : (c.roasPrev > 0 ? 2 : 1);
  score += clamp(daysCoverage * 2, 0, 8);

  return clamp(Math.round(score));
}

export function computePageConfidenceScore(
  page: Omit<GA4PageMetricsDetailed, "triScore" | "riskLevel" | "scoring">
): number {
  let score = 0;

  if (page.sessions >= 1000) score += 30;
  else if (page.sessions >= 500) score += 22;
  else if (page.sessions >= 100) score += 14;
  else if (page.sessions >= 30) score += 8;
  else score += 3;

  if (page.purchases >= 20) score += 25;
  else if (page.purchases >= 5) score += 18;
  else if (page.purchases >= 1) score += 10;

  if (page.pageviews >= 500) score += 15;
  else if (page.pageviews >= 100) score += 10;
  else score += 4;

  if (page.sessionsPrev > 0) score += 10;
  if (page.conversionRatePrev > 0) score += 10;
  if (page.revenuePrev > 0) score += 5;
  if (page.bounceRatePrev > 0) score += 5;

  return clamp(Math.round(score));
}

export function determineDiagnosis(
  c: CampaignMetrics,
  avg: AccountAvg,
  triScore: TriScore
): DiagnosisType {
  if (c.impressions < 500 || c.clicks < 10) return "insufficient_data";

  if (c.roas < 0.5 && c.spend > 200) return "roas_critical";

  if (c.multiWindow) {
    const mw = c.multiWindow;
    if (mw.window7d.roas < mw.prev7d.roas * 0.7 && mw.window7d.roas < 1.5) return "roas_declining";
    if (mw.window7d.ctr < mw.prev7d.ctr * 0.7 && mw.window7d.ctr < avg.ctr * 0.8) return "ctr_declining";
    if (mw.window7d.cpc > mw.prev7d.cpc * 1.4 && mw.window7d.cpc > avg.cpc * 1.3) return "cpc_spike";
  } else {
    if (c.roasPrev > 0 && c.roas < c.roasPrev * 0.7 && c.roas < 1.5) return "roas_declining";
    if (c.ctrPrev > 0 && c.ctr < c.ctrPrev * 0.7 && c.ctr < avg.ctr * 0.8) return "ctr_declining";
    if (c.cpcPrev > 0 && c.cpc > c.cpcPrev * 1.4 && c.cpc > avg.cpc * 1.3) return "cpc_spike";
  }

  if (c.frequency >= 4) return "audience_saturation";
  if (c.frequency >= 3 && c.ctr < avg.ctr * 0.8) return "creative_fatigue";

  if (c.roas < 1 && c.spend > avg.spend * 1.5) return "budget_waste";

  if (c.conversions > 0 && c.cvrPrev > 0) {
    const cvr = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
    if (cvr < c.cvrPrev * 0.6) return "conversion_drop";
  }

  if (triScore.scalePotential >= 60 && triScore.health >= 60 && c.roas > avg.roas * 1.3) return "scaling_ready";

  if (triScore.health >= 50 && triScore.urgency < 30) return "healthy";

  return "healthy";
}

export function determinePageDiagnosis(
  page: Omit<GA4PageMetricsDetailed, "triScore" | "riskLevel" | "scoring">,
  siteAvg: { conversionRate: number; bounceRate: number; avgEngagementTime: number },
  triScore: TriScore
): DiagnosisType {
  if (page.sessions < 10) return "insufficient_data";

  if (page.bounceRate > 85 && page.sessions > 30) return "page_bounce";

  if (page.beginCheckout > 0 && page.purchases > 0) {
    const checkoutAbandon = page.beginCheckout > 0 ? (1 - page.purchases / page.beginCheckout) * 100 : 0;
    if (checkoutAbandon > 70) return "checkout_abandon";
  }

  if (page.conversionRatePrev > 0 && page.conversionRate < page.conversionRatePrev * 0.6) return "conversion_drop";

  if (page.sessions > 100 && page.addToCart === 0 && page.conversionRate < 0.5) return "funnel_leak";

  if (triScore.health >= 60 && triScore.urgency < 20 && page.conversionRate > siteAvg.conversionRate) return "scaling_ready";

  if (triScore.health >= 50 && triScore.urgency < 30) return "healthy";

  return "healthy";
}

export function determineRecommendedAction(
  diagnosis: DiagnosisType,
  triScore: TriScore,
  riskLevel: RiskLevel,
  stopLoss?: StopLossResult
): RecommendedAction {
  if (stopLoss?.shouldStop) return "pause";

  switch (diagnosis) {
    case "roas_critical": return "pause";
    case "budget_waste": return "reduce_budget";
    case "roas_declining": return triScore.health < 30 ? "reduce_budget" : "monitor";
    case "creative_fatigue": return "refresh_creative";
    case "audience_saturation": return "expand_audience";
    case "ctr_declining": return "refresh_creative";
    case "cpc_spike": return "narrow_audience";
    case "conversion_drop": return "investigate";
    case "funnel_leak": return "optimize_landing";
    case "checkout_abandon": return "simplify_checkout";
    case "page_bounce": return triScore.urgency >= 40 ? "optimize_landing" : "add_trust_signals";
    case "scaling_ready": return riskLevel === "potential" ? "scale_budget" : "ab_test";
    case "healthy": return triScore.scalePotential >= 60 ? "scale_budget" : "maintain";
    case "insufficient_data": return "monitor";
    default: return "investigate";
  }
}

export function buildCampaignScoringResult(
  c: CampaignMetrics,
  avg: AccountAvg,
  triScore: TriScore,
  riskLevel: RiskLevel,
  stopLoss?: StopLossResult
): ScoringResult {
  const confidence = computeConfidenceScore(c);
  const diagnosis = determineDiagnosis(c, avg, triScore);
  const recommendedAction = determineRecommendedAction(diagnosis, triScore, riskLevel, stopLoss);

  const notes: string[] = [];
  if (confidence < 30) notes.push("數據量偏低，評分信心不足");
  if (stopLoss?.shouldStop) notes.push("觸發停損條件");
  if (c.frequency >= 3) notes.push(`頻率 ${c.frequency.toFixed(1)} 偏高`);
  if (c.roas < 1) notes.push(`ROAS ${c.roas.toFixed(1)} 低於盈虧平衡`);

  const timeWindowBasis = c.multiWindow ? "1d/3d/7d/14d 多窗口" : "7 天 vs 前期";
  const benchmarkBasis = `帳號平均 ROAS=${avg.roas.toFixed(1)}, CTR=${avg.ctr.toFixed(2)}%`;

  return {
    scores: triScoreToV2Scores(triScore, confidence),
    diagnosis,
    recommendedAction,
    diagnosisLabel: DIAGNOSIS_LABELS[diagnosis],
    actionLabel: ACTION_LABELS[recommendedAction],
    benchmarkBasis,
    timeWindowBasis,
    notes,
  };
}

export function buildPageScoringResult(
  page: Omit<GA4PageMetricsDetailed, "triScore" | "riskLevel" | "scoring">,
  siteAvg: { conversionRate: number; bounceRate: number; avgEngagementTime: number },
  triScore: TriScore,
  riskLevel: RiskLevel
): ScoringResult {
  const confidence = computePageConfidenceScore(page);
  const diagnosis = determinePageDiagnosis(page, siteAvg, triScore);
  const recommendedAction = determineRecommendedAction(diagnosis, triScore, riskLevel);

  const notes: string[] = [];
  if (confidence < 30) notes.push("頁面流量偏低，評分信心不足");
  if (page.bounceRate > 80) notes.push(`跳出率 ${page.bounceRate.toFixed(0)}% 偏高`);
  if (page.conversionRate < 0.5) notes.push("轉換率極低");

  return {
    scores: triScoreToV2Scores(triScore, confidence),
    diagnosis,
    recommendedAction,
    diagnosisLabel: DIAGNOSIS_LABELS[diagnosis],
    actionLabel: ACTION_LABELS[recommendedAction],
    benchmarkBasis: `站均 CR=${siteAvg.conversionRate.toFixed(2)}%, BR=${siteAvg.bounceRate.toFixed(0)}%`,
    timeWindowBasis: "當期 vs 前期",
    notes,
  };
}

export function buildAccountScoringResult(
  acctTriScore: TriScore,
  riskLevel: RiskLevel,
  campaigns: CampaignMetrics[],
  anomalies: { severity: "critical" | "high" | "medium" }[],
  avg: AccountAvg
): ScoringResult {
  let confidence = 0;
  if (campaigns.length >= 10) confidence += 30;
  else if (campaigns.length >= 5) confidence += 20;
  else if (campaigns.length >= 1) confidence += 10;

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  if (totalImpressions >= 100000) confidence += 30;
  else if (totalImpressions >= 10000) confidence += 20;
  else if (totalImpressions >= 1000) confidence += 10;
  else confidence += 3;

  const withMultiWindow = campaigns.filter(c => c.multiWindow).length;
  confidence += clamp(Math.round((withMultiWindow / Math.max(1, campaigns.length)) * 25), 0, 25);

  confidence += campaigns.length > 0 ? 15 : 0;
  confidence = clamp(Math.round(confidence));

  let diagnosis: DiagnosisType = "healthy";
  if (campaigns.length === 0) {
    diagnosis = "insufficient_data";
  } else if (acctTriScore.health < 30 && acctTriScore.urgency >= 50) {
    diagnosis = avg.roas < 1 ? "roas_critical" : "budget_waste";
  } else if (acctTriScore.health < 50) {
    const critCount = anomalies.filter(a => a.severity === "critical").length;
    diagnosis = critCount >= 2 ? "roas_declining" : "conversion_drop";
  } else if (acctTriScore.scalePotential >= 60 && acctTriScore.health >= 60) {
    diagnosis = "scaling_ready";
  }

  const recommendedAction = determineRecommendedAction(diagnosis, acctTriScore, riskLevel);

  const notes: string[] = [];
  if (confidence < 30) notes.push("帳號整體數據量偏低");
  const critAnomalies = anomalies.filter(a => a.severity === "critical").length;
  if (critAnomalies > 0) notes.push(`${critAnomalies} 個嚴重異常`);

  return {
    scores: triScoreToV2Scores(acctTriScore, confidence),
    diagnosis,
    recommendedAction,
    diagnosisLabel: DIAGNOSIS_LABELS[diagnosis],
    actionLabel: ACTION_LABELS[recommendedAction],
    benchmarkBasis: `${campaigns.length} 活動, 帳號均 ROAS=${avg.roas.toFixed(1)}`,
    timeWindowBasis: "帳號整體",
    notes,
  };
}

// ========== Page Recommendation Engine ==========

export interface PageRecommendationResult {
  diagnosis: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  affectedStage: string;
}

export function getPageRecommendation(page: GA4PageMetricsDetailed): PageRecommendationResult | null {
  const addToCartRate = page.sessions > 0 ? (page.addToCart / page.sessions) * 100 : 0;
  const results: PageRecommendationResult[] = [];

  const br = page.bounceRate > 1 ? page.bounceRate : page.bounceRate * 100;
  if (page.sessions > 100 && br > 60 && page.conversionRate < 0.5) {
    results.push({
      diagnosis: '內容與廣告不一致',
      action: '比對廣告素材與到達頁內容，確保訊息一致；調整首屏標題與主視覺，讓使用者立刻看到與廣告相符的資訊',
      priority: 'high',
      confidence: Math.min(95, 60 + Math.min(page.sessions / 10, 35)),
      affectedStage: '流量進站',
    });
  }

  if (br > 70) {
    results.push({
      diagnosis: '跳出過高',
      action: '優化首屏內容與載入速度；加強 CTA 能見度與價值主張；確認行動裝置體驗',
      priority: br > 85 ? 'high' : 'medium',
      confidence: Math.min(95, 50 + Math.min(page.sessions / 5, 45)),
      affectedStage: '到達頁體驗',
    });
  }

  if (page.sessions > 50 && page.conversionRate < 1) {
    results.push({
      diagnosis: 'CTA不夠明確',
      action: '強化行動呼籲按鈕的文案與視覺對比；在頁面多處放置 CTA；測試不同 CTA 文案與顏色',
      priority: page.conversionRate < 0.3 ? 'high' : 'medium',
      confidence: Math.min(90, 45 + Math.min(page.sessions / 8, 45)),
      affectedStage: '轉換引導',
    });
  }

  if (page.pageGroup === 'products' && addToCartRate < 5) {
    results.push({
      diagnosis: '商品頁資訊不足',
      action: '補充商品詳細描述、規格、使用情境照片；加入顧客評價與社會證明；提供尺寸指南或比較表',
      priority: addToCartRate < 2 ? 'high' : 'medium',
      confidence: Math.min(90, 40 + Math.min(page.sessions / 6, 50)),
      affectedStage: '商品瀏覽→加入購物車',
    });
  }

  if (page.pageGroup === 'checkout' && page.conversionRate < 30) {
    results.push({
      diagnosis: '信任訊號不足',
      action: '加入安全支付標誌、退換貨政策、客服聯繫方式；顯示已購買人數或即時庫存；提供多種付款方式',
      priority: page.conversionRate < 15 ? 'high' : 'medium',
      confidence: Math.min(90, 40 + Math.min(page.sessions / 4, 50)),
      affectedStage: '結帳完成',
    });
  }

  if ((page.pageGroup === 'checkout' || page.pageGroup === 'cart') && br > 50) {
    results.push({
      diagnosis: '結帳摩擦',
      action: '簡化結帳流程步驟；提供訪客結帳選項；優化表單欄位數量與自動填寫；顯示進度指示器',
      priority: br > 70 ? 'high' : 'medium',
      confidence: Math.min(90, 45 + Math.min(page.sessions / 5, 45)),
      affectedStage: '購物車→結帳',
    });
  }

  if (results.length === 0) return null;

  results.sort((a, b) => {
    const pMap = { high: 0, medium: 1, low: 2 };
    if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority];
    return b.confidence - a.confidence;
  });

  return results[0];
}

// ========== Board Engine ==========

export function buildBoardSet(
  campaigns: CampaignMetrics[],
  pages: GA4PageMetricsDetailed[],
  accounts: AccountHealthScore[]
): BoardSet {
  const dangerBoard: BoardEntry[] = [];
  const stopLossBoard: BoardEntry[] = [];
  const opportunityBoard: BoardEntry[] = [];
  const scaleBoard: BoardEntry[] = [];
  const priorityBoard: BoardEntry[] = [];
  const leakageBoard: BoardEntry[] = [];

  function buildListingReason(s: ScoringResult, boardType: string, extra?: string): string {
    const parts: string[] = [];
    parts.push(`${s.diagnosisLabel}，建議${s.actionLabel}`);
    const scoreParts: string[] = [];
    if (boardType === "danger" || boardType === "stopLoss" || boardType === "priority") {
      scoreParts.push(`急迫 ${s.scores.urgency}`);
      scoreParts.push(`健康 ${s.scores.health}`);
    }
    if (boardType === "opportunity" || boardType === "scale") {
      scoreParts.push(`機會 ${s.scores.opportunity}`);
      scoreParts.push(`健康 ${s.scores.health}`);
    }
    if (boardType === "leakage") {
      scoreParts.push(`急迫 ${s.scores.urgency}`);
      scoreParts.push(`機會 ${s.scores.opportunity}`);
    }
    scoreParts.push(`信心 ${s.scores.confidence}`);
    parts.push(scoreParts.join("/"));
    if (s.benchmarkBasis) parts.push(s.benchmarkBasis);
    if (s.timeWindowBasis) parts.push(s.timeWindowBasis);
    if (extra) parts.push(extra);
    if (s.scores.confidence < 30) parts.push("(數據量不足，僅供參考)");
    return parts.join("；");
  }

  for (const c of campaigns) {
    if (!c.scoring) continue;
    const baseEntry = {
      entityId: c.campaignId,
      entityName: c.campaignName,
      entityType: "campaign" as const,
      scoring: c.scoring,
      spend: c.spend,
      roas: c.roas,
      keyMetric: "ROAS",
      keyMetricValue: c.roas,
    };

    const isDangerDiagnosis = c.scoring.diagnosis !== "healthy" && c.scoring.diagnosis !== "scaling_ready";
    if (isDangerDiagnosis && (c.riskLevel === "danger" || (c.scoring.scores.urgency >= 60 && c.scoring.scores.health < 50))) {
      dangerBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(c.scoring, "danger", `ROAS ${c.roas.toFixed(2)}`) });
    }

    if (c.stopLoss?.shouldStop) {
      const slReason = c.stopLoss.reasons.filter(r => !r.includes("暫不建議")).slice(0, 2).join("；");
      stopLossBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(c.scoring, "stopLoss", slReason || `ROAS ${c.roas.toFixed(2)}`) });
    }

    if (c.scoring.diagnosis === "scaling_ready" || c.scoring.recommendedAction === "scale_budget") {
      scaleBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(c.scoring, "scale", `ROAS ${c.roas.toFixed(2)}`) });
    }

    if (c.scoring.scores.opportunity >= 50 && c.scoring.scores.health >= 50 && c.scoring.diagnosis !== "roas_critical" && c.scoring.diagnosis !== "budget_waste") {
      opportunityBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(c.scoring, "opportunity", `ROAS ${c.roas.toFixed(2)}`) });
    }

    if (c.scoring.scores.urgency >= 40 && c.scoring.scores.confidence >= 30) {
      priorityBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(c.scoring, "priority", `ROAS ${c.roas.toFixed(2)}`) });
    }
  }

  for (const p of pages) {
    if (!p.scoring) continue;
    const baseEntry = {
      entityId: p.pagePath,
      entityName: p.pageTitle || p.pagePath,
      entityType: "page" as const,
      scoring: p.scoring,
      keyMetric: "CR",
      keyMetricValue: p.conversionRate,
    };

    if (p.scoring.diagnosis === "page_bounce" || p.scoring.diagnosis === "funnel_leak" || p.scoring.diagnosis === "checkout_abandon") {
      leakageBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(p.scoring, "leakage", `CR ${p.conversionRate.toFixed(2)}%`) });
    }

    const isPageDanger = p.scoring.diagnosis !== "healthy" && p.scoring.diagnosis !== "scaling_ready";
    if (isPageDanger && (p.riskLevel === "danger" || (p.scoring.scores.urgency >= 60 && p.scoring.scores.health < 50))) {
      dangerBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(p.scoring, "danger", `CR ${p.conversionRate.toFixed(2)}%`) });
    }

    if (p.scoring.scores.urgency >= 40 && p.scoring.scores.confidence >= 30) {
      priorityBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(p.scoring, "priority", `CR ${p.conversionRate.toFixed(2)}%`) });
    }

    if (p.scoring.diagnosis === "scaling_ready") {
      scaleBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(p.scoring, "scale", `CR ${p.conversionRate.toFixed(2)}%`) });
    }
  }

  for (const a of accounts) {
    if (!a.scoring) continue;
    const baseEntry = {
      entityId: a.accountId,
      entityName: a.accountName,
      entityType: "account" as const,
      scoring: a.scoring,
      spend: a.spend,
      roas: a.roas,
      keyMetric: "ROAS",
      keyMetricValue: a.roas,
    };

    if (a.scoring.scores.urgency >= 60) {
      dangerBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(a.scoring, "danger", `ROAS ${a.roas.toFixed(2)}`) });
    }

    if (a.scoring.scores.urgency >= 40) {
      priorityBoard.push({ ...baseEntry, rank: 0, listingReason: buildListingReason(a.scoring, "priority", `ROAS ${a.roas.toFixed(2)}`) });
    }
  }

  const sortByUrgencyDesc = (a: BoardEntry, b: BoardEntry) => b.scoring.scores.urgency - a.scoring.scores.urgency;
  const sortByOpportunityDesc = (a: BoardEntry, b: BoardEntry) => b.scoring.scores.opportunity - a.scoring.scores.opportunity;

  dangerBoard.sort(sortByUrgencyDesc);
  stopLossBoard.sort((a, b) => (b.spend || 0) - (a.spend || 0));
  opportunityBoard.sort(sortByOpportunityDesc);
  scaleBoard.sort(sortByOpportunityDesc);
  leakageBoard.sort(sortByUrgencyDesc);

  priorityBoard.sort((a, b) => {
    const aScore = a.scoring.scores.urgency * 0.4 + (100 - a.scoring.scores.health) * 0.3 + a.scoring.scores.confidence * 0.3;
    const bScore = b.scoring.scores.urgency * 0.4 + (100 - b.scoring.scores.health) * 0.3 + b.scoring.scores.confidence * 0.3;
    return bScore - aScore;
  });

  const assignRanks = (board: BoardEntry[]) => board.forEach((e, i) => e.rank = i + 1);
  assignRanks(dangerBoard);
  assignRanks(stopLossBoard);
  assignRanks(opportunityBoard);
  assignRanks(scaleBoard);
  assignRanks(priorityBoard);
  assignRanks(leakageBoard);

  return {
    dangerBoard: dangerBoard.slice(0, 20),
    stopLossBoard: stopLossBoard.slice(0, 20),
    opportunityBoard: opportunityBoard.slice(0, 20),
    scaleBoard: scaleBoard.slice(0, 20),
    priorityBoard: priorityBoard.slice(0, 20),
    leakageBoard: leakageBoard.slice(0, 20),
  };
}
