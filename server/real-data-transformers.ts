import type {
  CampaignMetrics,
  CrossAccountSummary,
  FbAccountOverview,
  FbAdCreative,
  FbAIDirectorSummary,
  FbKPICard,
  FbCampaignStructure,
  FbBudgetRecommendation,
  FbAlert,
  HighRiskItem,
  GA4FunnelMetrics,
  GA4FunnelOverview,
  GA4FunnelSegment,
  GA4DropPoint,
  GA4PageRanking,
  GA4AIDirectorSummary,
  GA4PriorityFix,
  GA4PageMetrics,
  TodayVerdict,
  TodayPriority,
  BusinessOverview,
  AnalysisBatch,
  TriScore,
  RiskLevel,
  OpportunityCandidate,
  GA4PageMetricsDetailed,
  ScoringResult,
  DiagnosisType,
  PageRecommendation,
  AdSetMetrics,
  AdMetrics,
} from "@shared/schema";
import { getPageRecommendation } from "./scoring-engine";
import { getRecommendationLevel, DIAGNOSIS_LABELS, ACTION_LABELS } from "@shared/schema";

function labelCampaign(c: CampaignMetrics): { aiLabel: string; aiComment: string; suggestedAction: string } {
  if (c.scoring) {
    const s = c.scoring;
    const benchNote = s.benchmarkBasis ? `（${s.benchmarkBasis}）` : "";
    return {
      aiLabel: s.diagnosisLabel,
      aiComment: `${s.diagnosisLabel}${benchNote}`,
      suggestedAction: s.actionLabel,
    };
  }

  if (c.frequency > 3.5) {
    return { aiLabel: "已疲勞", aiComment: `Frequency ${c.frequency.toFixed(1)} 過高，受眾已重複看到太多次`, suggestedAction: "降低預算或更換素材" };
  }

  const stopReason = c.stopLoss?.shouldStop
    ? c.stopLoss.reasons.filter(r => !r.includes("暫不建議"))[0] || "立即暫停"
    : undefined;

  switch (c.riskLevel) {
    case "danger":
      return { aiLabel: "先停再說", aiComment: `ROAS ${c.roas.toFixed(2)}，風險等級高危`, suggestedAction: stopReason || "立即暫停並檢視素材和受眾" };
    case "warning":
      return { aiLabel: "需注意", aiComment: `效率偏低，需持續關注`, suggestedAction: "降低預算觀察或優化素材" };
    case "watch":
      return { aiLabel: "待觀察", aiComment: `表現一般，建議持續觀察`, suggestedAction: "進行素材/受眾測試" };
    case "stable":
      return { aiLabel: "穩定投放", aiComment: `ROAS ${c.roas.toFixed(2)} 表現穩定`, suggestedAction: "維持觀察" };
    case "potential":
      return { aiLabel: "高潛力", aiComment: `ROAS ${c.roas.toFixed(2)} 表現優秀，具備擴量潛力`, suggestedAction: "逐步提高預算 20-30%" };
    default:
      if (c.roas < 1.0 && c.spend > 500) {
        return { aiLabel: "先停再說", aiComment: `ROAS 僅 ${c.roas.toFixed(2)}，花費 ${c.spend.toFixed(0)} 卻虧損`, suggestedAction: "立即暫停並檢視素材和受眾" };
      }
      if (c.roas >= 3.0 && c.spend < 200) {
        return { aiLabel: "高潛力未放大", aiComment: `ROAS 達 ${c.roas.toFixed(2)} 但預算偏低`, suggestedAction: "逐步提高預算 20-30%" };
      }
      return { aiLabel: "待優化", aiComment: `效率一般，建議 A/B 測試`, suggestedAction: "進行素材/受眾測試" };
  }
}

function calcChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function generateOperationalHeadline(
  roas: number,
  ctr: number,
  cpa: number,
  cvr: number,
  dangerCount: number,
  scalableCount: number,
  fatigueCount: number,
  totalSpend: number,
  totalRevenue: number,
): string {
  if (dangerCount >= 3) {
    return `有 ${dangerCount} 個活動正在燒錢，先別急著加預算，這幾個地方現在最容易漏錢`;
  }
  if (dangerCount > 0 && scalableCount > 0) {
    return `一邊漏錢一邊有機會——先停掉 ${dangerCount} 個危險活動，再把預算轉給 ${scalableCount} 個潛力活動`;
  }
  if (dangerCount > 0 && fatigueCount > 0) {
    return `${dangerCount} 個活動需要止血，另外 ${fatigueCount} 個素材快打不動了，今天先處理這兩件事`;
  }
  if (dangerCount > 0) {
    return `先別急著加預算，${dangerCount} 個活動正在虧損，處理完再說`;
  }
  if (fatigueCount >= 2) {
    return `有 ${fatigueCount} 個素材已經疲勞，受眾看膩了——是時候換一批新的`;
  }
  if (scalableCount >= 2 && roas >= 2.5) {
    return `ROAS ${roas.toFixed(1)} 表現不錯，${scalableCount} 個活動可以考慮加碼，但要分段拉`;
  }
  if (scalableCount > 0 && roas >= 2) {
    return `整體投報還行，有 ${scalableCount} 個活動值得加預算試試看`;
  }
  if (roas >= 3) {
    return "帳號狀態健康，目前節奏穩定，持續觀察就好";
  }
  if (roas < 1 && totalSpend > 1000) {
    return `花了 NT$${Math.round(totalSpend).toLocaleString()} 但 ROAS 只有 ${roas.toFixed(2)}，得認真檢視一下`;
  }
  if (roas < 1.5) {
    return "整體效率偏低，建議先優化素材和受眾再考慮加量";
  }
  if (cvr < 1 && ctr >= 1) {
    return "點擊率還可以但轉換率偏低，問題可能出在落地頁或產品頁";
  }
  return "帳號運行中，持續關注數據變化";
}

export function buildRealFbOverview(metrics: CampaignMetrics[]): FbAccountOverview {
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
  const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);

  const totalSpendPrev = metrics.reduce((s, m) => s + m.spendPrev, 0);
  const totalRevenuePrev = metrics.reduce((s, m) => s + (m.revenue * (m.roasPrev > 0 ? m.roasPrev / Math.max(m.roas, 0.01) : 0.8)), 0);

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const cvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const avgFrequency = metrics.length > 0 ? metrics.reduce((s, m) => s + m.frequency, 0) / metrics.length : 0;

  const avgCtrPrev = metrics.length > 0 ? metrics.reduce((s, m) => s + m.ctrPrev, 0) / metrics.length : 0;
  const avgCpcPrev = metrics.length > 0 ? metrics.reduce((s, m) => s + m.cpcPrev, 0) / metrics.length : 0;
  const roasPrev = metrics.length > 0 ? metrics.reduce((s, m) => s + m.roasPrev, 0) / metrics.length : 0;

  const stopCount = metrics.filter(m => m.riskLevel === "danger" || m.frequency > 3.5).length;
  const highPotCount = metrics.filter(m => m.riskLevel === "potential").length;
  const fatigueCount = metrics.filter(m => m.frequency > 3.5).length;
  const activeCount = metrics.filter(m => m.status === "ACTIVE").length;

  const campaignTriScores = metrics.filter(m => m.triScore).map(m => m.triScore!);
  const accountTriScore: TriScore | undefined = campaignTriScores.length > 0
    ? {
        health: Math.round(campaignTriScores.reduce((s, t) => s + t.health, 0) / campaignTriScores.length),
        urgency: Math.round(campaignTriScores.reduce((s, t) => s + t.urgency, 0) / campaignTriScores.length),
        scalePotential: Math.round(campaignTriScores.reduce((s, t) => s + t.scalePotential, 0) / campaignTriScores.length),
      }
    : undefined;

  const healthScore = accountTriScore?.health ?? Math.min(100, Math.max(0,
    (roas >= 3 ? 30 : roas >= 2 ? 20 : roas >= 1 ? 10 : 0) +
    (ctr >= 2 ? 20 : ctr >= 1 ? 15 : ctr >= 0.5 ? 10 : 5) +
    (avgFrequency <= 2 ? 20 : avgFrequency <= 3 ? 15 : avgFrequency <= 4 ? 10 : 5) +
    (stopCount === 0 ? 20 : stopCount <= 2 ? 10 : 0) +
    (highPotCount > 0 ? 10 : 0)
  ));

  const opportunityScore = accountTriScore?.scalePotential ?? Math.min(100, highPotCount * 15 + stopCount * 10 + (roas < 2 ? 20 : 0));

  const cpaPrev = totalConversions > 0 && totalSpendPrev > 0
    ? totalSpendPrev / Math.max(1, totalConversions * 0.9)
    : 0;
  const cvrPrev = totalClicks > 0
    ? (totalConversions * 0.9 / Math.max(1, totalClicks * 0.95)) * 100
    : 0;

  const kpiCards: FbKPICard[] = [
    { key: "spend", label: "本期總花費", value: totalSpend, prevValue: totalSpendPrev, change: calcChange(totalSpend, totalSpendPrev), format: "currency", aiNote: totalSpend > totalSpendPrev ? "花費增加中，注意 ROAS 變化" : "花費控制良好" },
    { key: "revenue", label: "本期營收", value: totalRevenue, prevValue: totalRevenuePrev, change: calcChange(totalRevenue, totalRevenuePrev), format: "currency", aiNote: totalRevenue > totalRevenuePrev ? "營收成長中" : "營收下滑，需檢查轉換" },
    { key: "roas", label: "ROAS", value: roas, prevValue: roasPrev, change: calcChange(roas, roasPrev), format: "decimal", aiNote: roas >= 3 ? "ROAS 健康" : roas >= 2 ? "ROAS 尚可" : "ROAS 偏低，需優化" },
    { key: "cpa", label: "CPA", value: cpa, prevValue: cpaPrev, change: calcChange(cpa, cpaPrev), format: "currency", aiNote: cpa > 0 ? (cpa < cpaPrev ? "CPA 下降，轉換效率提升" : "CPA 上升，注意轉換成本") : "尚無轉換數據" },
    { key: "cpc", label: "CPC", value: cpc, prevValue: avgCpcPrev, change: calcChange(cpc, avgCpcPrev), format: "currency", aiNote: cpc < avgCpcPrev ? "CPC 下降是好事" : "CPC 上升，注意效率" },
    { key: "ctr", label: "CTR", value: ctr, prevValue: avgCtrPrev, change: calcChange(ctr, avgCtrPrev), format: "percent", aiNote: ctr >= 2 ? "CTR 表現優良" : ctr >= 1 ? "CTR 尚可" : "CTR 需提升" },
    { key: "cvr", label: "CVR", value: cvr, prevValue: cvrPrev, change: calcChange(cvr, cvrPrev), format: "percent", aiNote: cvr > 0 ? (cvr >= 3 ? "轉換率優秀" : cvr >= 1 ? "轉換率尚可" : "轉換率偏低") : "尚無轉換數據" },
    { key: "dangerCount", label: "危險數量", value: stopCount, prevValue: 0, change: 0, format: "number", aiNote: stopCount > 0 ? `${stopCount} 個活動需要立即關注` : "目前無高危活動" },
    { key: "scalableCount", label: "可擴量數量", value: highPotCount, prevValue: 0, change: 0, format: "number", aiNote: highPotCount > 0 ? `${highPotCount} 個活動有放大空間` : "目前無明顯擴量機會" },
  ];

  const operationalHeadline = generateOperationalHeadline(
    roas, ctr, cpa, cvr, stopCount, highPotCount, fatigueCount, totalSpend, totalRevenue
  );

  return {
    totalSpend,
    totalRevenue,
    roas,
    ctr,
    cpc,
    cpm,
    cpa,
    cvr,
    frequency: avgFrequency,
    creativeCount: metrics.length,
    activeCount,
    stopSuggestionCount: stopCount,
    highPotentialCount: highPotCount,
    fatigueCount,
    kpiCards,
    judgmentScore: healthScore,
    opportunityScore,
    opportunityIndex: Math.round(opportunityScore * 0.68),
    triScore: accountTriScore,
    operationalHeadline,
  };
}

export function buildRealFbCreatives(metrics: CampaignMetrics[], search?: string): FbAdCreative[] {
  let filtered = metrics;
  if (search?.trim()) {
    const q = search.toLowerCase();
    filtered = metrics.filter(m => m.campaignName.toLowerCase().includes(q) || m.campaignId.includes(q));
  }

  return filtered.map((m): FbAdCreative => {
    const { aiLabel, aiComment, suggestedAction } = labelCampaign(m);
    const opportunityScore = m.scoring
      ? Math.round(m.scoring.scores.opportunity * 0.3)
      : m.triScore
      ? Math.round(m.triScore.scalePotential * 0.3)
      : Math.min(30, Math.max(0,
          (m.roas >= 3 && m.spend < 200 ? 25 : 0) +
          (m.roas < 1 ? 15 : 0) +
          (m.frequency > 3 ? 10 : 0) +
          (m.ctr < 0.5 ? 8 : 0)
        ));

    return {
      id: m.campaignId,
      name: m.campaignName,
      adName: m.campaignName,
      thumbnail: "",
      campaign: m.accountName,
      adSet: m.accountId,
      spend: m.spend,
      revenue: m.revenue,
      ctr: m.ctr,
      cpc: m.cpc,
      cpm: m.cpm,
      roas: m.roas,
      frequency: m.frequency,
      conversions: m.conversions,
      impressions: m.impressions,
      clicks: m.clicks,
      trend7d: {
        ctr: calcChange(m.ctr, m.ctrPrev),
        roas: calcChange(m.roas, m.roasPrev),
        cpc: calcChange(m.cpc, m.cpcPrev),
      },
      aiLabel,
      aiComment,
      status: m.status === "ACTIVE" ? "active" : m.status === "PAUSED" ? "paused" : "ended",
      judgmentScore: m.scoring?.scores.health ?? m.triScore?.health ?? Math.min(100, Math.max(0, Math.round(
        (m.roas >= 3 ? 40 : m.roas >= 2 ? 30 : m.roas >= 1 ? 20 : 10) +
        (m.ctr >= 2 ? 20 : m.ctr >= 1 ? 15 : 10) +
        (m.frequency <= 2 ? 20 : m.frequency <= 3 ? 15 : 5) +
        (m.conversions > 0 ? 15 : 0)
      ))),
      opportunityScore,
      recommendationLevel: getRecommendationLevel(opportunityScore),
      suggestedAction,
      scoring: m.scoring,
    };
  }).sort((a, b) => b.spend - a.spend);
}

export function buildRealFbDirectorSummary(summary: CrossAccountSummary): FbAIDirectorSummary {
  const topAction = summary.urgentActions?.[0];
  const topRisky = summary.riskyCampaigns?.[0];
  const weeklyRecs = summary.weeklyRecommendations;
  return {
    verdict: summary.executiveSummary || "資料已更新，分析中。",
    topAction: topAction ? topAction.action : "目前無急迫行動建議",
    biggestWaste: topRisky
      ? `${topRisky.campaignName}: ${topRisky.problemDescription}`
      : "目前無明顯浪費",
    bestDirection: weeklyRecs?.today?.[0] || weeklyRecs?.thisWeek?.[0] || "持續觀察數據趨勢",
  };
}

export function buildRealCampaignStructure(
  metrics: CampaignMetrics[],
  adsetMetrics?: AdSetMetrics[],
  adMetrics?: AdMetrics[],
): FbCampaignStructure[] {
  const results: FbCampaignStructure[] = metrics.map((m): FbCampaignStructure => {
    const { aiLabel, aiComment } = labelCampaign(m);
    const opportunityScore = m.scoring
      ? Math.round(m.scoring.scores.opportunity * 0.3)
      : m.triScore
      ? Math.round(m.triScore.scalePotential * 0.3)
      : Math.min(30, Math.max(0,
          (m.roas >= 3 && m.spend < 200 ? 25 : 0) +
          (m.roas < 1 ? 15 : 0) +
          (m.frequency > 3 ? 10 : 0)
        ));

    let stopLossAdvice: string | undefined;
    if (m.stopLoss) {
      stopLossAdvice = m.stopLoss.shouldStop
        ? `建議停損：${m.stopLoss.reasons.filter(r => !r.includes("暫不建議")).join("；")}`
        : m.stopLoss.reasons.length > 0
        ? `暫不停損：${m.stopLoss.reasons.slice(0, 2).join("；")}`
        : undefined;
    }

    return {
      id: m.campaignId,
      name: m.campaignName,
      level: "campaign",
      spend: m.spend,
      ctr: m.ctr,
      cpc: m.cpc,
      cpm: m.cpm,
      roas: m.roas,
      frequency: m.frequency,
      conversions: m.conversions,
      aiLabel,
      aiComment,
      judgmentScore: m.scoring?.scores.health ?? m.triScore?.health ?? Math.round(
        (m.roas >= 3 ? 40 : m.roas >= 2 ? 30 : m.roas >= 1 ? 20 : 10) +
        (m.ctr >= 2 ? 20 : m.ctr >= 1 ? 15 : 10) +
        (m.frequency <= 2 ? 20 : m.frequency <= 3 ? 15 : 5)
      ),
      opportunityScore,
      recommendationLevel: getRecommendationLevel(opportunityScore),
      triScore: m.triScore,
      riskLevel: m.riskLevel,
      stopLossAdvice,
      scoring: m.scoring,
    };
  });

  if (adsetMetrics && adsetMetrics.length > 0) {
    for (const as of adsetMetrics) {
      const score = Math.round(
        (as.roas >= 3 ? 40 : as.roas >= 2 ? 30 : as.roas >= 1 ? 20 : 10) +
        (as.ctr >= 2 ? 20 : as.ctr >= 1 ? 15 : 10) +
        (as.frequency <= 2 ? 20 : as.frequency <= 3 ? 15 : 5)
      );
      const oppScore = Math.min(30, Math.max(0,
        (as.roas >= 3 && as.spend < 200 ? 25 : 0) +
        (as.roas < 1 ? 15 : 0) +
        (as.frequency > 3 ? 10 : 0)
      ));
      const aiLabel = as.roas >= 3 ? "表現優秀" : as.roas >= 1 ? "待優化" : as.roas > 0 ? "效率偏低" : "無轉換";
      results.push({
        id: as.id,
        name: as.name,
        level: "adset",
        parentId: as.campaignId,
        spend: as.spend,
        ctr: as.ctr,
        cpc: as.cpc,
        cpm: as.cpm,
        roas: as.roas,
        frequency: as.frequency,
        conversions: as.conversions,
        aiLabel,
        aiComment: `Ad Set 花費 ${as.spend.toFixed(0)}，ROAS ${as.roas.toFixed(2)}`,
        judgmentScore: score,
        opportunityScore: oppScore,
        recommendationLevel: getRecommendationLevel(oppScore),
      });
    }
  }

  if (adMetrics && adMetrics.length > 0) {
    for (const ad of adMetrics) {
      const score = Math.round(
        (ad.roas >= 3 ? 40 : ad.roas >= 2 ? 30 : ad.roas >= 1 ? 20 : 10) +
        (ad.ctr >= 2 ? 20 : ad.ctr >= 1 ? 15 : 10) +
        (ad.frequency <= 2 ? 20 : ad.frequency <= 3 ? 15 : 5)
      );
      const oppScore = Math.min(30, Math.max(0,
        (ad.roas >= 3 && ad.spend < 200 ? 25 : 0) +
        (ad.roas < 1 ? 15 : 0) +
        (ad.frequency > 3 ? 10 : 0)
      ));
      const aiLabel = ad.roas >= 3 ? "表現優秀" : ad.roas >= 1 ? "待優化" : ad.roas > 0 ? "效率偏低" : "無轉換";
      results.push({
        id: ad.id,
        name: ad.name,
        level: "ad",
        parentId: ad.adsetId || ad.campaignId,
        spend: ad.spend,
        ctr: ad.ctr,
        cpc: ad.cpc,
        cpm: ad.cpm,
        roas: ad.roas,
        frequency: ad.frequency,
        conversions: ad.conversions,
        aiLabel,
        aiComment: `Ad 花費 ${ad.spend.toFixed(0)}，ROAS ${ad.roas.toFixed(2)}`,
        judgmentScore: score,
        opportunityScore: oppScore,
        recommendationLevel: getRecommendationLevel(oppScore),
      });
    }
  }

  return results.sort((a, b) => b.spend - a.spend);
}

export function buildRealBudgetRecommendations(metrics: CampaignMetrics[]): FbBudgetRecommendation[] {
  const recs: FbBudgetRecommendation[] = [];

  const scalable = metrics
    .filter(m => m.scoring?.recommendedAction === "scale_budget" || m.riskLevel === "potential" || (m.roas >= 3.0 && m.spend < 300))
    .sort((a, b) => (b.scoring?.scores.opportunity ?? b.triScore?.scalePotential ?? 0) - (a.scoring?.scores.opportunity ?? a.triScore?.scalePotential ?? 0));
  for (const m of scalable.slice(0, 3)) {
    const oppScore = m.scoring?.scores.opportunity ?? m.triScore?.scalePotential ?? 0;
    const conf = m.scoring?.scores.confidence ?? 50;
    const basis = m.scoring?.benchmarkBasis ? `（${m.scoring.benchmarkBasis}）` : "";
    const pctStep = conf >= 70 ? "+20%" : conf >= 40 ? "+15%" : "+10%";
    const pctNum = pctStep === "+20%" ? 20 : pctStep === "+15%" ? 15 : 10;
    const amtStep = Math.round(m.spend * (pctNum / 100));
    const roasThreshold = Math.max(1.5, m.roas * 0.7);

    let whyNow = "";
    if (m.frequency < 2 && m.roas >= 3) {
      whyNow = `頻率僅 ${m.frequency.toFixed(1)}、ROAS 高達 ${m.roas.toFixed(2)}，受眾遠未飽和，現在加量效率最高`;
    } else if (m.multiWindow) {
      const mw = m.multiWindow;
      const stable = Math.abs(mw.window7d.roas - mw.window14d.roas) < mw.window7d.roas * 0.15;
      if (stable) {
        whyNow = `7 天 (${mw.window7d.roas.toFixed(2)}) 與 14 天 (${mw.window14d.roas.toFixed(2)}) ROAS 穩定，趨勢可靠，現在放量風險最低`;
      } else {
        whyNow = `ROAS ${m.roas.toFixed(2)} 表現佳但波動稍大，建議小幅加量觀察`;
      }
    } else {
      whyNow = `ROAS ${m.roas.toFixed(2)} 表現優於帳號均值，預算佔比偏低，有放大空間`;
    }

    const risks: string[] = [];
    if (m.frequency >= 2) risks.push(`頻率已達 ${m.frequency.toFixed(1)}，加量後可能加速疲勞`);
    if (conf < 50) risks.push(`信心分數僅 ${conf}，數據樣本偏少，判斷可能不穩定`);
    if (m.ctr < 1) risks.push(`CTR ${m.ctr.toFixed(2)}% 偏低，加量後 CPC 可能上升`);
    if (m.spend > 500) risks.push("目前花費已偏高，加量幅度需謹慎");
    if (risks.length === 0) risks.push("整體風險低，可按建議執行");

    const paceDescription = conf >= 70
      ? `建議先加 ${pctNum}%（+NT$${amtStep.toLocaleString()}/日），觀察 2 天；若 ROAS 維持 > ${roasThreshold.toFixed(1)} 再加第二段`
      : `建議先加 ${pctNum}%（+NT$${amtStep.toLocaleString()}/日），分 3 天慢慢拉；每天檢查 ROAS 是否維持 > ${roasThreshold.toFixed(1)}`;

    recs.push({
      action: m.scoring?.actionLabel || "增加預算",
      target: m.campaignName,
      reason: `ROAS ${m.roas.toFixed(2)} 表現優秀但預算僅 ${m.spend.toFixed(0)}，機會分數 ${oppScore}${basis}`,
      expectedImpact: `預估每日可多帶 NT$${Math.round(m.spend * (m.roas - 1) * 0.3).toLocaleString()} 營收`,
      type: "increase",
      opportunityScore: Math.round(oppScore * 0.3),
      suggestedChange: pctStep,
      suggestedAmount: `+NT$${amtStep.toLocaleString()}/日`,
      safetyPace: "每 48 小時最多再加一次",
      guardConditions: [
        `ROAS 維持 >= ${roasThreshold.toFixed(1)}`,
        `CTR 維持 >= ${Math.max(0.5, m.ctr * 0.8).toFixed(2)}%`,
        `頻率維持 <= ${Math.min(4, m.frequency + 1).toFixed(1)}`,
      ],
      rollbackCondition: `若 ROAS 連續 2 天低於 ${Math.max(1, m.roas * 0.6).toFixed(1)}，退回 NT$${Math.round(m.spend).toLocaleString()}/日`,
      confidenceScore: conf,
      whyNow,
      risks,
      paceDescription,
    });
  }

  const shouldStop = metrics
    .filter(m => m.scoring?.recommendedAction === "pause" || m.riskLevel === "danger" || (m.roas < 1.0 && m.spend > 300))
    .sort((a, b) => (b.scoring?.scores.urgency ?? b.triScore?.urgency ?? 0) - (a.scoring?.scores.urgency ?? a.triScore?.urgency ?? 0));
  for (const m of shouldStop.slice(0, 3)) {
    const stopNote = m.stopLoss?.shouldStop ? "，已觸發停損條件" : "";
    const healthScore = m.scoring?.scores.health ?? m.triScore?.health ?? 0;
    const conf = m.scoring?.scores.confidence ?? 50;
    const basis = m.scoring?.benchmarkBasis ? `（${m.scoring.benchmarkBasis}）` : "";

    let whyNow = "";
    if (m.stopLoss?.shouldStop) {
      whyNow = "已觸發多項停損條件，每多投一天就是多虧一天";
    } else if (m.roas < 0.5 && m.spend > 500) {
      whyNow = `ROAS 僅 ${m.roas.toFixed(2)} 且花費已達 ${Math.round(m.spend)}，繼續投放等於直接燒錢`;
    } else if (m.frequency > 4) {
      whyNow = `頻率 ${m.frequency.toFixed(1)} 已嚴重飽和，受眾不可能再轉換`;
    } else {
      whyNow = `持續虧損中，越晚止血越難回本`;
    }

    const risks: string[] = [];
    if (m.stopLoss?.possiblePageIssue) risks.push(m.stopLoss.possiblePageIssue);
    if (m.roas > 0 && m.roas < 1) risks.push(`仍有 ROAS ${m.roas.toFixed(2)} 微薄回收，暫停後需確認無替代流量`);
    if (m.conversions > 0) risks.push(`暫停後可能影響每日 ${m.conversions} 筆轉換，需評估替代方案`);
    if (risks.length === 0) risks.push("暫停風險低，建議立即執行");

    recs.push({
      action: m.scoring?.actionLabel || "暫停投放",
      target: m.campaignName,
      reason: `ROAS 僅 ${m.roas.toFixed(2)}，花費 ${m.spend.toFixed(0)} 持續虧損，健康分數僅 ${healthScore}${stopNote}${basis}`,
      expectedImpact: `每日可省 NT$${Math.round(m.spend).toLocaleString()} 預算`,
      type: "pause",
      opportunityScore: Math.round((m.scoring?.scores.urgency ?? m.triScore?.urgency ?? 0) * 0.3),
      suggestedChange: "暫停",
      suggestedAmount: `省 NT$${Math.round(m.spend).toLocaleString()}/日`,
      safetyPace: "立即暫停，觀察 48 小時後評估是否重啟",
      guardConditions: [
        `重啟前需 ROAS >= ${Math.max(1.5, m.roas * 2).toFixed(1)}（新素材測試）`,
        `重啟預算從原本的 50% 開始`,
      ],
      rollbackCondition: "若暫停後整體帳號 ROAS 下降，評估是否為該活動貢獻",
      confidenceScore: conf,
      whyNow,
      risks,
      paceDescription: m.stopLoss?.shouldStop ? "立即暫停，不需分段" : "先暫停 48 小時觀察整體帳號表現，再決定是否徹底關閉",
    });
  }

  const fatigued = metrics
    .filter(m => m.scoring?.diagnosis === "creative_fatigue" || m.frequency > 3.5)
    .sort((a, b) => (b.scoring?.scores.urgency ?? b.triScore?.urgency ?? 0) - (a.scoring?.scores.urgency ?? a.triScore?.urgency ?? 0));
  for (const m of fatigued.slice(0, 2)) {
    const urgency = m.scoring?.scores.urgency ?? m.triScore?.urgency ?? 0;
    const conf = m.scoring?.scores.confidence ?? 50;
    const reduceAmt = Math.round(m.spend * 0.3);

    const whyNow = m.frequency >= 4
      ? `頻率已達 ${m.frequency.toFixed(1)}，受眾已看過太多次，再投下去只會拉高 CPC 並降低 CTR`
      : `頻率 ${m.frequency.toFixed(1)} 接近疲勞門檻，再不降量效率會快速惡化`;

    const risks: string[] = [];
    if (m.roas >= 2) risks.push(`ROAS 仍有 ${m.roas.toFixed(2)}，降量後需同步準備新素材以維持產出`);
    if (m.conversions > 3) risks.push(`目前每日仍帶 ${m.conversions} 筆轉換，降量會直接影響轉換數`);
    if (risks.length === 0) risks.push("降量風險低，素材效率已明顯下滑");

    recs.push({
      action: m.scoring?.actionLabel || "降低預算",
      target: m.campaignName,
      reason: `${m.scoring?.diagnosisLabel || "素材疲勞"}，頻次 ${m.frequency.toFixed(1)}，緊急程度 ${urgency}`,
      expectedImpact: "降低頻次至 3 以下，提升廣告效率",
      type: "decrease",
      opportunityScore: Math.round(urgency * 0.2),
      suggestedChange: "-30%",
      suggestedAmount: `-NT$${reduceAmt.toLocaleString()}/日`,
      safetyPace: "每 72 小時觀察一次頻次變化",
      guardConditions: [
        `頻率降至 <= 3.0`,
        `CTR 回升至 >= ${Math.max(0.5, m.ctr * 1.1).toFixed(2)}%`,
      ],
      rollbackCondition: `若頻率未改善且 ROAS 持續低於 ${Math.max(1, m.roas).toFixed(1)}，考慮暫停並更換素材`,
      confidenceScore: conf,
      whyNow,
      risks,
      paceDescription: `先降 30%（-NT$${reduceAmt.toLocaleString()}/日），72 小時後看頻率是否降到 3 以下；若沒改善就再降或直接暫停換素材`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      action: "維持觀察",
      target: "所有活動",
      reason: "目前各活動預算配置合理",
      expectedImpact: "持續追蹤 ROAS 和頻次變化",
      type: "test",
      opportunityScore: 5,
    });
  }

  return recs.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export function buildRealAlerts(metrics: CampaignMetrics[]): FbAlert[] {
  const alerts: FbAlert[] = [];
  let idx = 0;

  for (const m of metrics) {
    const diagLabel = m.scoring?.diagnosisLabel || "";
    const actionLabel = m.scoring?.actionLabel || "";
    const basisNote = m.scoring?.benchmarkBasis ? `（${m.scoring.benchmarkBasis}）` : "";
    const urgency = m.scoring?.scores.urgency ?? m.triScore?.urgency ?? 0;

    if (m.scoring?.diagnosis === "roas_critical" || m.scoring?.diagnosis === "budget_waste" || m.riskLevel === "danger") {
      alerts.push({
        id: `alert-${idx++}`,
        type: "warning",
        title: `${m.campaignName} ${diagLabel || "高危警報"}`,
        description: `${diagLabel}，ROAS ${m.roas.toFixed(2)}，花費 ${m.spend.toFixed(0)}，建議${actionLabel || "立即暫停"}${basisNote}${m.stopLoss?.shouldStop ? "，已觸發停損條件" : ""}`,
        severity: "critical",
        relatedCreative: m.campaignName,
        opportunityScore: Math.round(urgency * 0.3),
      });
    } else if (m.scoring?.diagnosis === "roas_declining" || m.riskLevel === "warning" || (m.roas < 1.0 && m.spend > 300)) {
      alerts.push({
        id: `alert-${idx++}`,
        type: "warning",
        title: `${m.campaignName} ${diagLabel || "ROAS 低於 1"}`,
        description: `${diagLabel}，ROAS ${m.roas.toFixed(2)}，已花費 ${m.spend.toFixed(0)}，建議${actionLabel || "暫停"}${basisNote}`,
        severity: m.roas < 0.5 ? "critical" : "high",
        relatedCreative: m.campaignName,
        opportunityScore: Math.round(urgency * 0.25),
      });
    }
    if (m.scoring?.diagnosis === "creative_fatigue" || m.scoring?.diagnosis === "audience_saturation" || m.frequency > 4.0) {
      alerts.push({
        id: `alert-${idx++}`,
        type: "warning",
        title: `${m.campaignName} ${diagLabel || "素材疲勞"}`,
        description: `${diagLabel}，頻次 ${m.frequency.toFixed(1)}，建議${actionLabel || "更換素材"}${basisNote}`,
        severity: m.frequency > 5 ? "critical" : "high",
        relatedCreative: m.campaignName,
        opportunityScore: Math.round(urgency * 0.2),
      });
    }
    if (m.scoring?.diagnosis === "ctr_declining" || (m.ctrPrev > 0 && m.ctr < m.ctrPrev * 0.5)) {
      alerts.push({
        id: `alert-${idx++}`,
        type: "warning",
        title: `${m.campaignName} ${diagLabel || "CTR 大幅下滑"}`,
        description: `CTR 從 ${m.ctrPrev.toFixed(2)}% 降至 ${m.ctr.toFixed(2)}%，建議${actionLabel || "檢視素材"}${basisNote}`,
        severity: "high",
        relatedCreative: m.campaignName,
        opportunityScore: Math.round(urgency * 0.15),
      });
    }
    if (m.scoring?.recommendedAction === "scale_budget" || m.riskLevel === "potential" || (m.roas >= 3.0 && m.spend < 200)) {
      const oppScore = m.scoring?.scores.opportunity ?? m.triScore?.scalePotential ?? 0;
      alerts.push({
        id: `alert-${idx++}`,
        type: "opportunity",
        title: `${m.campaignName} ${diagLabel || "可放大"}`,
        description: `ROAS ${m.roas.toFixed(2)} 表現優秀但預算偏低，機會分數 ${oppScore}${basisNote}`,
        severity: "medium",
        relatedCreative: m.campaignName,
        opportunityScore: Math.round(oppScore * 0.3),
      });
    }
  }

  return alerts.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10);
}

export function buildRealHighRiskItems(metrics: CampaignMetrics[]): HighRiskItem[] {
  const items: HighRiskItem[] = [];

  const riskOrder: Record<RiskLevel, number> = { danger: 0, warning: 1, watch: 2, stable: 3, potential: 4 };

  const withRisk = metrics.filter(m =>
    m.scoring && (m.scoring.scores.urgency >= 50 || m.scoring.diagnosis === "roas_critical" || m.scoring.diagnosis === "budget_waste")
    || m.riskLevel === "danger" || m.riskLevel === "warning"
  );
  const fallback = withRisk.length > 0
    ? []
    : metrics.filter(m => m.roas < 1.5 && m.spend > 200);
  const risky = withRisk.length > 0
    ? withRisk.sort((a, b) => (b.scoring?.scores.urgency ?? 0) - (a.scoring?.scores.urgency ?? 0) || riskOrder[a.riskLevel || "stable"] - riskOrder[b.riskLevel || "stable"])
    : fallback;

  for (const m of risky.slice(0, 5)) {
    const tags: string[] = [];
    if (m.scoring?.diagnosisLabel) tags.push(m.scoring.diagnosisLabel);
    if (!m.scoring) {
      if (m.riskLevel === "danger") tags.push("高危活動");
      if (m.riskLevel === "warning") tags.push("警告狀態");
    }
    if (m.roas < 1) tags.push("ROAS 低於 1");
    if (m.frequency > 3) tags.push("頻次過高");
    if (m.stopLoss?.shouldStop) tags.push("觸發停損條件");

    const severity: "critical" | "high" | "medium" =
      m.scoring?.scores.urgency && m.scoring.scores.urgency >= 70 ? "critical"
      : m.riskLevel === "danger" ? "critical"
      : m.riskLevel === "warning" ? "high"
      : m.roas < 0.5 ? "critical"
      : m.roas < 1 ? "high"
      : "medium";

    const v2Info = m.scoring
      ? `（${m.scoring.diagnosisLabel}，建議${m.scoring.actionLabel}，${m.scoring.benchmarkBasis}，${m.scoring.timeWindowBasis}）`
      : m.triScore
      ? `（健康 ${m.triScore.health}、緊急 ${m.triScore.urgency}、潛力 ${m.triScore.scalePotential}）`
      : "";

    items.push({
      id: m.campaignId,
      name: m.campaignName,
      type: "creative",
      problemTags: tags.length > 0 ? tags : ["效率待觀察"],
      severity,
      opportunityScore: Math.round((m.scoring?.scores.urgency ?? m.triScore?.urgency ?? 0) * 0.3) || Math.round(m.spend * (1 - Math.min(m.roas, 2) / 2) * 0.1),
      aiVerdict: `花費 ${m.spend.toFixed(0)} 但 ROAS 僅 ${m.roas.toFixed(2)}，${m.frequency > 3 ? "且已疲勞，" : ""}建議${m.scoring?.actionLabel || (m.roas < 1 ? "暫停" : "優化")}${v2Info}`,
    });
  }

  return items;
}

export function buildRealGA4FunnelOverview(metrics: GA4FunnelMetrics[]): GA4FunnelOverview {
  const totalSessions = metrics.reduce((s, m) => s + m.sessions, 0);
  const totalPageviews = metrics.reduce((s, m) => s + m.pageviews, 0);
  const totalAddToCart = metrics.reduce((s, m) => s + m.addToCart, 0);
  const totalCheckout = metrics.reduce((s, m) => s + m.beginCheckout, 0);
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);

  const totalSessionsPrev = metrics.reduce((s, m) => s + m.sessionsPrev, 0);
  const totalAddToCartPrev = metrics.reduce((s, m) => s + m.addToCartPrev, 0);
  const totalCheckoutPrev = metrics.reduce((s, m) => s + m.beginCheckoutPrev, 0);
  const totalPurchasesPrev = metrics.reduce((s, m) => s + m.purchasesPrev, 0);

  const productViewRate = totalSessions > 0 ? (totalPageviews / totalSessions) * 100 : 0;
  const addToCartRate = totalSessions > 0 ? (totalAddToCart / totalSessions) * 100 : 0;
  const checkoutRate = totalSessions > 0 ? (totalCheckout / totalSessions) * 100 : 0;
  const purchaseRate = totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0;
  const overallConversionRate = totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0;

  const totalPageviewsPrev = metrics.reduce((s, m) => s + (m.sessionsPrev > 0 ? Math.round(m.pageviews * (m.sessionsPrev / Math.max(m.sessions, 1))) : 0), 0);
  const prevProductViewRate = totalSessionsPrev > 0 ? (totalPageviewsPrev / totalSessionsPrev) * 100 : 0;
  const prevAddToCartRate = totalSessionsPrev > 0 ? (totalAddToCartPrev / totalSessionsPrev) * 100 : 0;
  const prevCheckoutRate = totalSessionsPrev > 0 ? (totalCheckoutPrev / totalSessionsPrev) * 100 : 0;
  const prevPurchaseRate = totalSessionsPrev > 0 ? (totalPurchasesPrev / totalSessionsPrev) * 100 : 0;
  const prevOverallConversionRate = totalSessionsPrev > 0 ? (totalPurchasesPrev / totalSessionsPrev) * 100 : 0;

  return {
    sessions: totalSessions,
    users: Math.round(totalSessions * 0.85),
    landingPageViews: totalPageviews,
    productViews: Math.round(totalPageviews * 0.6),
    productViewRate,
    addToCartCount: totalAddToCart,
    addToCartRate,
    checkoutStartCount: totalCheckout,
    checkoutRate,
    purchases: totalPurchases,
    purchaseRate,
    overallConversionRate,
    avgDuration: 120,
    bounceRate: totalSessions > 0 ? Math.max(0, Math.min(100, 100 - Math.min(100, productViewRate))) : 0,
    engagementRate: totalSessions > 0 ? Math.min(100, Math.min(100, productViewRate) + 10) : 0,
    prevPeriod: {
      sessions: totalSessionsPrev,
      productViewRate: prevProductViewRate,
      addToCartRate: prevAddToCartRate,
      checkoutRate: prevCheckoutRate,
      purchaseRate: prevPurchaseRate,
      overallConversionRate: prevOverallConversionRate,
    },
  };
}

export function buildRealGA4FunnelSegments(metrics: GA4FunnelMetrics[]): GA4FunnelSegment[] {
  const totalSessions = metrics.reduce((s, m) => s + m.sessions, 0);
  const totalPageviews = metrics.reduce((s, m) => s + m.pageviews, 0);
  const totalAddToCart = metrics.reduce((s, m) => s + m.addToCart, 0);
  const totalCheckout = metrics.reduce((s, m) => s + m.beginCheckout, 0);
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);

  const segments: GA4FunnelSegment[] = [];

  function clampRate(v: number): number { return Math.max(0, Math.min(100, v)); }
  function safeDropRate(convRate: number): number { return Math.max(0, 100 - Math.min(100, convRate)); }

  const rawSessionToPageRate = totalSessions > 0 ? (totalPageviews / totalSessions) * 100 : 0;
  const sessionToPageRate = clampRate(rawSessionToPageRate);
  const sessionToPageAnomaly = rawSessionToPageRate > 100 ? "頁面瀏覽數 > 工作階段數，一人多頁屬正常；此率為瀏覽深度指標" : "";
  segments.push({
    from: "工作階段",
    to: "頁面瀏覽",
    conversionRate: sessionToPageRate,
    dropRate: safeDropRate(rawSessionToPageRate),
    benchmark: 70,
    aiVerdict: sessionToPageAnomaly || (sessionToPageRate < 50 ? "著陸頁留不住人，跳出率過高" : "著陸頁表現尚可"),
    problemType: sessionToPageRate < 50 ? "著陸頁問題" : "正常",
  });

  const pageToCartRate = clampRate(totalPageviews > 0 ? (totalAddToCart / totalPageviews) * 100 : 0);
  segments.push({
    from: "頁面瀏覽",
    to: "加入購物車",
    conversionRate: pageToCartRate,
    dropRate: safeDropRate(pageToCartRate),
    benchmark: 10,
    aiVerdict: pageToCartRate < 5 ? "商品頁說服力不足，加入購物車率過低" : "商品頁表現合理",
    problemType: pageToCartRate < 5 ? "商品頁問題" : "正常",
  });

  const cartToCheckoutRate = clampRate(totalAddToCart > 0 ? (totalCheckout / totalAddToCart) * 100 : 0);
  segments.push({
    from: "加入購物車",
    to: "開始結帳",
    conversionRate: cartToCheckoutRate,
    dropRate: safeDropRate(cartToCheckoutRate),
    benchmark: 50,
    aiVerdict: cartToCheckoutRate < 30 ? "購物車到結帳流失嚴重" : "購物車到結帳比例合理",
    problemType: cartToCheckoutRate < 30 ? "購物車放棄問題" : "正常",
  });

  const checkoutToPurchaseRate = clampRate(totalCheckout > 0 ? (totalPurchases / totalCheckout) * 100 : 0);
  segments.push({
    from: "開始結帳",
    to: "完成購買",
    conversionRate: checkoutToPurchaseRate,
    dropRate: safeDropRate(checkoutToPurchaseRate),
    benchmark: 60,
    aiVerdict: checkoutToPurchaseRate < 40 ? "結帳完成率過低，結帳流程有嚴重摩擦" : "結帳完成率尚可",
    problemType: checkoutToPurchaseRate < 40 ? "結帳流程問題" : "正常",
  });

  return segments;
}

export function buildRealGA4DropPoints(metrics: GA4FunnelMetrics[]): GA4DropPoint[] {
  const totalSessions = metrics.reduce((s, m) => s + m.sessions, 0);
  const totalPageviews = metrics.reduce((s, m) => s + m.pageviews, 0);
  const totalAddToCart = metrics.reduce((s, m) => s + m.addToCart, 0);
  const totalCheckout = metrics.reduce((s, m) => s + m.beginCheckout, 0);
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);

  const drops: GA4DropPoint[] = [];

  const rawBounce = totalSessions > 0 ? ((totalSessions - totalPageviews) / totalSessions) * 100 : 0;
  const bounceRate = Math.max(0, rawBounce);
  if (bounceRate > 40) {
    drops.push({
      stage: "著陸頁",
      issue: `跳出率 ${bounceRate.toFixed(1)}%，超過 40% 門檻`,
      severity: bounceRate > 60 ? "critical" : "high",
      fix: "優化首屏價值主張和頁面載入速度",
      opportunityScore: Math.round(bounceRate * 0.4),
    });
  }

  const cartAbandonRate = totalAddToCart > 0 ? ((totalAddToCart - totalCheckout) / totalAddToCart) * 100 : 0;
  if (cartAbandonRate > 50) {
    drops.push({
      stage: "購物車",
      issue: `購物車放棄率 ${cartAbandonRate.toFixed(1)}%`,
      severity: cartAbandonRate > 70 ? "critical" : "high",
      fix: "顯示免運門檻、加入信任徽章、簡化結帳流程",
      opportunityScore: Math.round(cartAbandonRate * 0.35),
    });
  }

  const checkoutDropRate = totalCheckout > 0 ? ((totalCheckout - totalPurchases) / totalCheckout) * 100 : 0;
  if (checkoutDropRate > 30) {
    drops.push({
      stage: "結帳",
      issue: `結帳流失率 ${checkoutDropRate.toFixed(1)}%`,
      severity: checkoutDropRate > 50 ? "critical" : checkoutDropRate > 40 ? "high" : "medium",
      fix: "精簡表單欄位、加入一鍵結帳、提前顯示運費",
      opportunityScore: Math.round(checkoutDropRate * 0.3),
    });
  }

  const addToCartRate = totalPageviews > 0 ? (totalAddToCart / totalPageviews) * 100 : 0;
  if (addToCartRate < 5) {
    drops.push({
      stage: "商品頁",
      issue: `加入購物車率僅 ${addToCartRate.toFixed(1)}%`,
      severity: addToCartRate < 2 ? "critical" : "medium",
      fix: "加入商品評價、庫存提示、限時優惠標籤",
      opportunityScore: Math.round((5 - addToCartRate) * 5),
    });
  }

  return drops.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export function buildRealGA4PageRanking(metrics: GA4FunnelMetrics[]): GA4PageRanking[] {
  return metrics.map((m): GA4PageRanking => {
    const cr = m.conversionRate;
    let recommendation: GA4PageRanking["recommendation"];
    let reason: string;

    if (cr >= 5) {
      recommendation = "use_as_template";
      reason = `轉換率 ${cr.toFixed(1)}% 表現優異，可作為其他頁面模板`;
    } else if (cr >= 3) {
      recommendation = "add_traffic";
      reason = `轉換率 ${cr.toFixed(1)}% 良好，增加流量可放大效果`;
    } else if (cr >= 1) {
      recommendation = "monitor";
      reason = `轉換率 ${cr.toFixed(1)}%，持續觀察趨勢`;
    } else {
      recommendation = "fix_first";
      reason = `轉換率僅 ${cr.toFixed(1)}%，需先優化頁面再引流`;
    }

    return {
      pageName: m.propertyName,
      path: `/property/${m.propertyId}`,
      conversionRate: cr,
      recommendation,
      reason,
    };
  });
}

export function buildRealGA4DirectorSummary(metrics: GA4FunnelMetrics[], summary?: CrossAccountSummary | null): GA4AIDirectorSummary {
  const totalSessions = metrics.reduce((s, m) => s + m.sessions, 0);
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);
  const totalAddToCart = metrics.reduce((s, m) => s + m.addToCart, 0);
  const totalCheckout = metrics.reduce((s, m) => s + m.beginCheckout, 0);

  const overallCR = totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0;
  const checkoutAbandon = totalAddToCart > 0 ? ((totalAddToCart - totalCheckout) / totalAddToCart) * 100 : 0;

  const biggestKiller = checkoutAbandon > 60
    ? `結帳流程放棄率 ${checkoutAbandon.toFixed(0)}%，是最大轉換殺手`
    : totalAddToCart === 0
    ? "加入購物車數為零，商品頁缺乏購買動機"
    : "各漏斗階段表現尚可，持續監控";

  const fixFirst = checkoutAbandon > 60
    ? "先簡化結帳流程並透明化運費資訊"
    : overallCR < 2
    ? "提升商品頁說服力和加入購物車率"
    : "維持現有流程，微調細節";

  const fixOrTraffic = overallCR < 2
    ? "先修：目前轉換率不足以支撐加流量"
    : "可適度加流量，但持續監控轉換率";

  const verdict = summary?.executiveSummary
    || `整體轉換率 ${overallCR.toFixed(1)}%，${overallCR >= 3 ? "表現良好" : overallCR >= 1 ? "有改善空間" : "需要立即處理"}。`;

  return { verdict, biggestKiller, fixFirst, fixOrTraffic };
}

export function buildRealGA4PriorityFixes(metrics: GA4FunnelMetrics[]): GA4PriorityFix[] {
  const fixes: GA4PriorityFix[] = [];
  let order = 1;

  const totalAddToCart = metrics.reduce((s, m) => s + m.addToCart, 0);
  const totalCheckout = metrics.reduce((s, m) => s + m.beginCheckout, 0);
  const totalPurchases = metrics.reduce((s, m) => s + m.purchases, 0);
  const totalSessions = metrics.reduce((s, m) => s + m.sessions, 0);
  const totalPageviews = metrics.reduce((s, m) => s + m.pageviews, 0);

  const checkoutAbandon = totalAddToCart > 0 ? ((totalAddToCart - totalCheckout) / totalAddToCart) * 100 : 0;
  if (checkoutAbandon > 50) {
    fixes.push({
      order: order++,
      action: "簡化結帳流程並顯示運費",
      reason: `購物車放棄率 ${checkoutAbandon.toFixed(0)}%，超過 50% 門檻`,
      expectedImpact: `預估降低放棄率 15-20%，增加 ${Math.round(totalAddToCart * 0.15)} 筆結帳`,
      opportunityScore: Math.round(checkoutAbandon * 0.4),
    });
  }

  const checkoutDropRate = totalCheckout > 0 ? ((totalCheckout - totalPurchases) / totalCheckout) * 100 : 0;
  if (checkoutDropRate > 30) {
    fixes.push({
      order: order++,
      action: "加入一鍵結帳和信任徽章",
      reason: `結帳到購買流失 ${checkoutDropRate.toFixed(0)}%`,
      expectedImpact: `預估提升完成率 10-15%`,
      opportunityScore: Math.round(checkoutDropRate * 0.3),
    });
  }

  const addToCartRate = totalPageviews > 0 ? (totalAddToCart / totalPageviews) * 100 : 0;
  if (addToCartRate < 8) {
    fixes.push({
      order: order++,
      action: "優化商品頁加入購物車引導",
      reason: `加入購物車率僅 ${addToCartRate.toFixed(1)}%`,
      expectedImpact: "預估提升加入購物車率 20-30%",
      opportunityScore: Math.round((8 - addToCartRate) * 3),
    });
  }

  const bounceRate = totalSessions > 0 ? ((totalSessions - totalPageviews) / totalSessions) * 100 : 0;
  if (bounceRate > 40) {
    fixes.push({
      order: order++,
      action: "優化著陸頁首屏和載入速度",
      reason: `跳出率 ${bounceRate.toFixed(0)}%，過多訪客未進入商品瀏覽`,
      expectedImpact: `預估降低跳出率 10-15%`,
      opportunityScore: Math.round(bounceRate * 0.25),
    });
  }

  if (fixes.length === 0) {
    fixes.push({
      order: 1,
      action: "持續監控各漏斗階段數據",
      reason: "目前各階段指標在合理範圍",
      expectedImpact: "維持穩定表現",
      opportunityScore: 5,
    });
  }

  return fixes.sort((a, b) => b.opportunityScore - a.opportunityScore).map((f, i) => ({ ...f, order: i + 1 }));
}

export function buildFunnelDrillDown(pages: import("@shared/schema").GA4PageMetricsDetailed[]): import("@shared/schema").FunnelDrillDown[] {
  const sorted = [...pages].sort((a, b) => b.sessions - a.sessions);
  const top = sorted.filter(m => m.sessions >= 5).slice(0, 50);

  const stages: import("@shared/schema").FunnelDrillDown[] = [];

  const highBounce = top.filter(m => m.bounceRate > 40).sort((a, b) => b.bounceRate - a.bounceRate).slice(0, 5);
  if (highBounce.length > 0) {
    stages.push({
      stage: "工作階段 → 頁面瀏覽",
      topPages: highBounce.map(m => ({
        pagePath: m.pagePath,
        pageTitle: m.pageTitle,
        sessions: m.sessions,
        metric: Math.round(m.bounceRate),
        reason: `跳出率 ${m.bounceRate.toFixed(0)}%，訪客未深入瀏覽`,
        fix: "優化首屏內容和價值主張",
      })),
    });
  }

  const lowAddToCart = top.filter(m => {
    const atcRate = m.pageviews > 0 ? (m.addToCart / m.pageviews) * 100 : 0;
    return atcRate < 5 && m.sessions >= 10;
  }).sort((a, b) => {
    const rateA = a.pageviews > 0 ? (a.addToCart / a.pageviews) * 100 : 0;
    const rateB = b.pageviews > 0 ? (b.addToCart / b.pageviews) * 100 : 0;
    return rateA - rateB;
  }).slice(0, 5);
  if (lowAddToCart.length > 0) {
    stages.push({
      stage: "頁面瀏覽 → 加入購物車",
      topPages: lowAddToCart.map(m => {
        const atcRate = m.pageviews > 0 ? (m.addToCart / m.pageviews) * 100 : 0;
        return {
          pagePath: m.pagePath,
          pageTitle: m.pageTitle,
          sessions: m.sessions,
          metric: Number(atcRate.toFixed(1)),
          reason: `加入購物車率僅 ${atcRate.toFixed(1)}%`,
          fix: "強化商品圖片、評價、CTA 按鈕",
        };
      }),
    });
  }

  const highCartAbandon = top.filter(m => {
    const abandonRate = m.addToCart > 0 ? ((m.addToCart - m.beginCheckout) / m.addToCart) * 100 : 0;
    return abandonRate > 50 && m.addToCart > 0;
  }).sort((a, b) => {
    const rateA = a.addToCart > 0 ? ((a.addToCart - a.beginCheckout) / a.addToCart) * 100 : 0;
    const rateB = b.addToCart > 0 ? ((b.addToCart - b.beginCheckout) / b.addToCart) * 100 : 0;
    return rateB - rateA;
  }).slice(0, 5);
  if (highCartAbandon.length > 0) {
    stages.push({
      stage: "加入購物車 → 開始結帳",
      topPages: highCartAbandon.map(m => {
        const abandonRate = m.addToCart > 0 ? ((m.addToCart - m.beginCheckout) / m.addToCart) * 100 : 0;
        return {
          pagePath: m.pagePath,
          pageTitle: m.pageTitle,
          sessions: m.sessions,
          metric: Math.round(abandonRate),
          reason: `購物車放棄率 ${abandonRate.toFixed(0)}%`,
          fix: "簡化結帳流程、顯示運費和預估到貨時間",
        };
      }),
    });
  }

  const lowCheckoutComplete = top.filter(m => m.beginCheckout > 0 && m.purchases === 0).sort((a, b) => b.beginCheckout - a.beginCheckout).slice(0, 5);
  if (lowCheckoutComplete.length > 0) {
    stages.push({
      stage: "開始結帳 → 完成購買",
      topPages: lowCheckoutComplete.map(m => ({
        pagePath: m.pagePath,
        pageTitle: m.pageTitle,
        sessions: m.sessions,
        metric: 0,
        reason: `有 ${m.beginCheckout} 次結帳但 0 次購買`,
        fix: "檢查支付方式、加入信任徽章和保證退貨政策",
      })),
    });
  }

  return stages;
}

export function buildRealGA4HighRiskItems(metrics: GA4FunnelMetrics[]): HighRiskItem[] {
  const items: HighRiskItem[] = [];

  for (const m of metrics) {
    const tags: string[] = [];
    if (m.checkoutAbandonmentRate > 70) tags.push("結帳放棄率過高");
    if (m.conversionRate < 1) tags.push("轉換率極低");
    if (m.addToCartRate < 3) tags.push("加入購物車率低");
    if (m.conversionRate < m.conversionRatePrev * 0.7 && m.conversionRatePrev > 0) tags.push("轉換率大幅下滑");

    if (tags.length > 0) {
      items.push({
        id: m.propertyId,
        name: m.propertyName,
        type: "page",
        problemTags: tags,
        severity: tags.some(t => t.includes("過高") || t.includes("極低")) ? "critical" : "high",
        opportunityScore: Math.round(
          (m.checkoutAbandonmentRate > 70 ? 15 : 0) +
          (m.conversionRate < 1 ? 10 : 0) +
          (m.addToCartRate < 3 ? 8 : 0)
        ),
        aiVerdict: `${m.propertyName}: ${tags.join("、")}`,
      });
    }
  }

  return items;
}

export function buildRealGA4Pages(metrics: GA4FunnelMetrics[], search?: string): GA4PageMetrics[] {
  let filtered = metrics;
  if (search?.trim()) {
    const q = search.toLowerCase();
    filtered = metrics.filter(m => m.propertyName.toLowerCase().includes(q) || m.propertyId.includes(q));
  }

  return filtered.map((m): GA4PageMetrics => {
    const cr = m.conversionRate;
    let aiLabel: string;
    let aiComment: string;
    let suggestedAction: string;

    if (m.checkoutAbandonmentRate > 70) {
      aiLabel = "結帳流失嚴重";
      aiComment = `結帳放棄率 ${m.checkoutAbandonmentRate.toFixed(0)}%，需立即處理`;
      suggestedAction = "簡化結帳流程並透明化運費";
    } else if (cr < 1) {
      aiLabel = "轉換率極低";
      aiComment = `轉換率僅 ${cr.toFixed(1)}%，頁面說服力不足`;
      suggestedAction = "優化商品頁和加入購物車引導";
    } else if (cr >= 5) {
      aiLabel = "高效頁面";
      aiComment = `轉換率 ${cr.toFixed(1)}% 表現優異`;
      suggestedAction = "作為模板推廣到其他頁面";
    } else if (cr < m.conversionRatePrev * 0.7 && m.conversionRatePrev > 0) {
      aiLabel = "轉換下滑";
      aiComment = `轉換率從 ${m.conversionRatePrev.toFixed(1)}% 降至 ${cr.toFixed(1)}%`;
      suggestedAction = "檢查頁面異動或流量品質";
    } else {
      aiLabel = "表現穩定";
      aiComment = `轉換率 ${cr.toFixed(1)}%，持續觀察`;
      suggestedAction = "維持觀察";
    }

    const opportunityScore = Math.min(30, Math.max(0,
      (m.checkoutAbandonmentRate > 70 ? 15 : 0) +
      (cr < 1 ? 10 : 0) +
      (m.addToCartRate < 3 ? 8 : 0)
    ));

    return {
      id: m.propertyId,
      pageName: m.propertyName,
      path: `/property/${m.propertyId}`,
      sessions: m.sessions,
      users: Math.round(m.sessions * 0.85),
      avgDuration: 120,
      bounceRate: m.sessions > 0 ? Math.max(0, ((m.sessions - m.pageviews) / m.sessions) * 100) : 0,
      engagementRate: m.sessions > 0 ? Math.min(100, (m.pageviews / m.sessions) * 100) : 0,
      productViewRate: m.sessions > 0 ? (m.pageviews / m.sessions) * 100 : 0,
      addToCartRate: m.addToCartRate,
      checkoutRate: m.beginCheckoutRate,
      purchaseRate: m.purchaseRate,
      overallConversionRate: cr,
      aiLabel,
      aiComment,
      judgmentScore: Math.min(100, Math.max(0, Math.round(
        (cr >= 5 ? 40 : cr >= 3 ? 30 : cr >= 1 ? 20 : 10) +
        (m.checkoutAbandonmentRate < 50 ? 20 : m.checkoutAbandonmentRate < 70 ? 10 : 0) +
        (m.addToCartRate >= 5 ? 20 : m.addToCartRate >= 3 ? 15 : 10) +
        (m.sessions > 100 ? 15 : m.sessions > 50 ? 10 : 5)
      ))),
      opportunityScore,
      recommendationLevel: getRecommendationLevel(opportunityScore),
      suggestedAction,
    };
  });
}

export function buildRealOpportunities(batch: AnalysisBatch): OpportunityCandidate[] {
  if (!batch.opportunities || batch.opportunities.length === 0) {
    return [];
  }
  return batch.opportunities.map(opp => ({
    ...opp,
    typeLabel: opp.typeLabel || "未分類",
  }));
}

export function buildTodayVerdict(batch: AnalysisBatch): TodayVerdict {
  const summary = batch.summary;
  const boards = batch.boards;
  const metrics = batch.campaignMetrics;
  const ga4 = batch.ga4Metrics;

  let boardContext = "";
  if (boards) {
    const parts: string[] = [];
    if (boards.dangerBoard.length > 0) parts.push(`${boards.dangerBoard.length} 項危險`);
    if (boards.stopLossBoard.length > 0) parts.push(`${boards.stopLossBoard.length} 項停損`);
    if (boards.opportunityBoard.length > 0) parts.push(`${boards.opportunityBoard.length} 項機會`);
    if (boards.leakageBoard.length > 0) parts.push(`${boards.leakageBoard.length} 項漏損`);
    if (parts.length > 0) boardContext = `V2 戰情板：${parts.join("、")}。`;
  }

  if (summary?.executiveSummary) {
    return {
      verdict: summary.executiveSummary,
      context: `基於 ${batch.dateRange.startDate} 至 ${batch.dateRange.endDate} 的數據分析。${boardContext}`,
    };
  }

  if (metrics.length === 0 && ga4.length === 0) {
    return {
      verdict: "尚無分析數據，請先同步帳號並更新資料。",
      context: "",
    };
  }

  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const scoredCampaigns = metrics.filter(c => c.scoring);
  let diagSummary = "";
  let v2VerdictParts: string[] = [];

  if (scoredCampaigns.length > 0) {
    const diagCounts: Record<string, number> = {};
    for (const c of scoredCampaigns) {
      const d = c.scoring!.diagnosisLabel;
      diagCounts[d] = (diagCounts[d] || 0) + 1;
    }
    const topDiags = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    diagSummary = `主要診斷：${topDiags.map(([d, n]) => `${d} ${n} 個`).join("、")}。`;

    const topUrgent = scoredCampaigns
      .filter(c => c.scoring!.scores.urgency >= 50)
      .sort((a, b) => b.scoring!.scores.urgency - a.scoring!.scores.urgency);
    if (topUrgent.length > 0) {
      const top = topUrgent[0].scoring!;
      v2VerdictParts.push(`最急迫：${topUrgent[0].campaignName}（${top.diagnosisLabel}，急迫 ${top.scores.urgency}，建議${top.actionLabel}，${top.benchmarkBasis}）`);
      if (top.scores.confidence < 30) v2VerdictParts.push(`注意：該活動信心度僅 ${top.scores.confidence}，數據量不足`);
    }

    const topOpp = scoredCampaigns
      .filter(c => c.scoring!.scores.opportunity >= 50)
      .sort((a, b) => b.scoring!.scores.opportunity - a.scoring!.scores.opportunity);
    if (topOpp.length > 0) {
      const top = topOpp[0].scoring!;
      v2VerdictParts.push(`最佳機會：${topOpp[0].campaignName}（${top.diagnosisLabel}，機會 ${top.scores.opportunity}，${top.timeWindowBasis}）`);
    }
  }

  const v2Extra = v2VerdictParts.length > 0 ? `${v2VerdictParts.join("。")}。` : "";

  const scoredSorted = scoredCampaigns.sort((a, b) => (b.scoring?.scores.opportunity ?? 0) - (a.scoring?.scores.opportunity ?? 0));
  const topScale = scoredSorted.find(c => c.scoring?.recommendedAction === "scale_budget" || (c.scoring?.scores.opportunity ?? 0) >= 60);
  const topDanger = scoredCampaigns.filter(c => (c.scoring?.scores.urgency ?? 0) >= 50).sort((a, b) => (b.scoring?.scores.urgency ?? 0) - (a.scoring?.scores.urgency ?? 0))[0];
  const topStable = scoredCampaigns.find(c => c.scoring?.diagnosis === "healthy");

  let headline: string;
  if (roas >= 3) {
    headline = `整體 ROAS ${roas.toFixed(1)}，表現健康`;
  } else if (roas >= 1.5) {
    headline = `整體 ROAS ${roas.toFixed(1)}，有優化空間`;
  } else {
    headline = `整體 ROAS ${roas.toFixed(1)}，效率偏低，需要調整`;
  }

  const todayAction = topDanger
    ? `今天先做：${topDanger.scoring!.actionLabel} ${topDanger.campaignName}（${topDanger.scoring!.diagnosisLabel}，急迫 ${topDanger.scoring!.scores.urgency}）`
    : roas < 1.5
    ? "今天先做：檢視花費最高但 ROAS 最低的活動，評估是否暫停"
    : "今天先做：持續監控各活動數據變化";

  const weekScale = topScale
    ? `本週加碼：${topScale.campaignName}（ROAS ${topScale.roas.toFixed(1)}，機會 ${topScale.scoring!.scores.opportunity}）`
    : "本週加碼：暫無明確加碼標的，建議穩定觀察";

  const dontTouch = topStable
    ? `先不要動：${topStable.campaignName} 表現穩定，不建議調整`
    : "先不要動：目前無特別穩定的活動";

  const verdictLines = [headline, todayAction, weekScale, dontTouch];
  if (diagSummary) verdictLines.splice(1, 0, diagSummary.replace(/。$/, ""));

  return {
    verdict: verdictLines.join("。") + "。",
    context: `分析期間：${batch.dateRange.startDate} 至 ${batch.dateRange.endDate}，涵蓋 ${metrics.length} 個廣告活動和 ${ga4.length} 個 GA4 資源。${boardContext}`,
  };
}

export function buildTodayPriorities(batch: AnalysisBatch): TodayPriority[] {
  const priorities: TodayPriority[] = [];
  let order = 1;

  if (batch.summary?.urgentActions) {
    for (const action of batch.summary.urgentActions.slice(0, 3)) {
      priorities.push({
        order: order++,
        action: action.action,
        reason: action.reason,
        impact: action.impact || "",
        opportunityScore: 25 - (order - 2) * 5,
      });
    }
  }

  if (priorities.length === 0) {
    const dangerCampaigns = batch.campaignMetrics
      .filter(c => c.scoring?.scores.urgency && c.scoring.scores.urgency >= 50 || c.riskLevel === "danger" || c.stopLoss?.shouldStop)
      .sort((a, b) => (b.scoring?.scores.urgency ?? b.triScore?.urgency ?? 0) - (a.scoring?.scores.urgency ?? a.triScore?.urgency ?? 0));

    for (const c of dangerCampaigns.slice(0, 2)) {
      const s = c.scoring;
      const basisInfo = s ? `（${s.benchmarkBasis}，${s.timeWindowBasis}）` : "";
      priorities.push({
        order: order++,
        action: `${s?.actionLabel || "處理高風險活動"}: ${c.campaignName}`,
        reason: s ? `${s.diagnosisLabel}，ROAS ${c.roas.toFixed(1)}${basisInfo}` : (c.stopLoss?.reasons[0] || `ROAS ${c.roas.toFixed(1)}，風險等級高危`),
        impact: s ? `健康 ${s.scores.health}、急迫 ${s.scores.urgency}、信心 ${s.scores.confidence}` : `健康分數 ${c.triScore?.health ?? "N/A"}，緊急程度 ${c.triScore?.urgency ?? "N/A"}`,
        opportunityScore: Math.round((s?.scores.urgency ?? c.triScore?.urgency ?? 0) * 0.3),
      });
    }

    const scaleCampaigns = batch.campaignMetrics
      .filter(c => c.scoring?.recommendedAction === "scale_budget" || c.riskLevel === "potential")
      .sort((a, b) => (b.scoring?.scores.opportunity ?? b.triScore?.scalePotential ?? 0) - (a.scoring?.scores.opportunity ?? a.triScore?.scalePotential ?? 0));

    for (const c of scaleCampaigns.slice(0, 1)) {
      const s = c.scoring;
      const basisInfo = s ? `（${s.benchmarkBasis}）` : "";
      priorities.push({
        order: order++,
        action: `${s?.actionLabel || "放大高潛力活動"}: ${c.campaignName}`,
        reason: s ? `${s.diagnosisLabel}，ROAS ${c.roas.toFixed(1)}，機會分數 ${s.scores.opportunity}${basisInfo}` : `ROAS ${c.roas.toFixed(1)}，擴量潛力分數 ${c.triScore?.scalePotential ?? "N/A"}`,
        impact: `建議逐步提高預算 20-30%`,
        opportunityScore: Math.round((s?.scores.opportunity ?? c.triScore?.scalePotential ?? 0) * 0.3),
      });
    }
  }

  if (priorities.length === 0) {
    priorities.push({
      order: 1,
      action: "同步帳號並更新資料以獲取分析建議",
      reason: "目前無足夠數據產生行動建議",
      impact: "建立數據基準線",
      opportunityScore: 0,
    });
  }

  return priorities;
}

export function buildPageRecommendations(
  pages: GA4PageMetricsDetailed[]
): Map<string, PageRecommendation> {
  const recommendations = new Map<string, PageRecommendation>();
  const topPages = [...pages]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 50);

  for (const page of topPages) {
    const rec = getPageRecommendation(page);
    if (rec) {
      recommendations.set(page.pagePath, rec);
    }
  }

  return recommendations;
}

export function buildPageRecommendationsArray(
  pages: GA4PageMetricsDetailed[]
): { pagePath: string; recommendation: PageRecommendation }[] {
  const recMap = buildPageRecommendations(pages);
  const results: { pagePath: string; recommendation: PageRecommendation }[] = [];
  recMap.forEach((recommendation, pagePath) => {
    results.push({ pagePath, recommendation });
  });
  return results;
}

export function buildBusinessOverview(batch: AnalysisBatch): BusinessOverview {
  const metrics = batch.campaignMetrics;
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);

  const totalSpendPrev = metrics.reduce((s, m) => s + m.spendPrev, 0);
  const totalRevenuePrev = metrics.reduce((s, m) => s + (m.revenue * (m.roasPrev > 0 ? m.roasPrev / Math.max(m.roas, 0.01) : 0.8)), 0);

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const roasPrev = totalSpendPrev > 0 ? totalRevenuePrev / totalSpendPrev : 0;
  const cr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const crPrev = cr * 0.95;
  const aov = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  const aovPrev = aov * 0.97;

  return {
    revenue: totalRevenue,
    revenuePrev: totalRevenuePrev,
    spend: totalSpend,
    spendPrev: totalSpendPrev,
    roas,
    roasPrev,
    conversionRate: cr,
    conversionRatePrev: crPrev,
    aov,
    aovPrev,
  };
}
