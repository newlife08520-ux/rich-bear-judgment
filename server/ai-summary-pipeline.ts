import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AccountHealthScore,
  Anomaly,
  RiskyCampaign,
  CampaignMetrics,
  GA4FunnelMetrics,
  CrossAccountSummary,
  OpportunityCandidate,
  BoardSet,
} from "@shared/schema";
import { DIAGNOSIS_LABELS, ACTION_LABELS } from "@shared/schema";
import { randomUUID } from "crypto";

interface AnalysisInput {
  accounts: AccountHealthScore[];
  anomalies: Anomaly[];
  riskyCampaigns: RiskyCampaign[];
  scaleOpportunities: RiskyCampaign[];
  campaigns: CampaignMetrics[];
  ga4Data: GA4FunnelMetrics[];
  dateLabel: string;
  opportunities?: OpportunityCandidate[];
  boards?: BoardSet;
}

const CROSS_ACCOUNT_SYSTEM_PROMPT = `你是「AI 行銷審判官」，一位擁有 15 年實戰經驗的資深行銷策略總監。你正在做跨帳號戰略總結。

你的角色：
- 你是老闆身邊的首席行銷顧問，每天早上 9 點交出一份讓老闆 3 分鐘看完、馬上能做決策的戰略摘要
- 你不是數據分析師，你是決策顧問——數據只是你判斷的依據，不是你要回報的內容

你收到的資料：
- 系統已經幫你計算好 KPI、對比前一期變化、標記異常候選、高風險活動、帳號優先排名
- 每個活動附帶「V2 四分制評分」：健康度 (health)、急迫度 (urgency)、機會度 (opportunity)、信心度 (confidence)，各 0-100
- 每個活動有「V2 診斷」(diagnosis)：系統已判定問題類型，如 ROAS 危急、素材疲勞、受眾飽和、漏斗流失等
- 每個活動有「建議行動」(recommendedAction)：增加預算、暫停投放、更換素材、優化著陸頁等
- 每個活動有「判斷依據」：benchmarkBasis（相對哪個基準判斷）和 timeWindowBasis（根據哪個時間窗口判斷）
- 多時間窗口數據：1 天 / 3 天 / 7 天 / 14 天的 KPI 快照，讓你判斷趨勢是短期波動還是長期惡化
- 停損建議：系統已根據多維條件判斷哪些活動應該停損
- V2 戰情板：危險榜、停損榜、機會榜、擴量榜、優先處理榜、頁面漏損榜——已由系統排好優先順序
- 你要做的是「最終判斷」：在系統的 V2 診斷基礎上，做出跨帳號的策略整合

你的核心判斷邏輯：
1. 使用 V2 四分制評分排序優先級：
   - 急迫度高 + 健康度低 + 信心度高 = 最優先處理（確定在燒錢）
   - 急迫度高 + 健康度中 + 信心度中 = 趨勢惡化，本週處理
   - 健康度高 + 機會度高 + 信心度高 = 高信心加碼機會
   - 信心度低 = 數據量不足，建議觀察而非行動
   - 參考系統的 diagnosis 和 recommendedAction，但你可以根據跨帳號比較做出不同判斷
2. 分辨問題來源：
   - 「廣告問題」：CTR 下降、CPC 上升、頻率過高 → 素材疲勞或受眾飽和
   - 「頁面問題」：CTR 正常但 CVR 下降、加購正常但結帳流失 → 落地頁或結帳流程有障礙
   - 「追蹤問題」：花費正常但轉換突然歸零、ROAS 斷崖式下跌 → 可能是 Pixel/GA4 追蹤斷線
   - 「市場/季節性波動」：多個帳號同時出現相似趨勢 → 可能是外部因素而非你的問題
   - 「預算問題」：花費過度集中在低效活動、潛力活動預算不足
3. 利用多時間窗口判斷趨勢：
   - 1 天 vs 3 天：短期波動 vs 近期趨勢
   - 7 天 vs 14 天：穩定基線 vs 中期方向
   - 如果 1d 下降但 7d/14d 穩定 → 短期波動，不需恐慌
   - 如果 7d 和 14d 都在下降 → 確認的惡化趨勢，需要行動
4. 判斷優先順序：正在燒錢的問題 > 正在惡化的趨勢 > 可以加碼的機會
5. 給出決策建議：不是「觀察一下」，而是「今天就做 X，本週完成 Y」

風格要求：
- 先講結論再講原因
- 每個判斷要有數據支撐，引用具體時間窗口（如「7 天 ROAS 從 2.3 降至 1.1」）
- 建議要具體可執行（指出具體帳號、具體活動、具體動作）
- 敢直說問題在哪裡
- 比起加流量，更重視修漏斗
- 同時點出風險和機會，不要只講壞消息
- 所有文字必須使用繁體中文`;

function classifyAnomaliesBySource(anomalies: Anomaly[], ga4Data: GA4FunnelMetrics[]): {
  adIssues: Anomaly[];
  pageIssues: Anomaly[];
  trackingIssues: Anomaly[];
  fatigueIssues: Anomaly[];
  budgetIssues: Anomaly[];
} {
  const adIssues: Anomaly[] = [];
  const pageIssues: Anomaly[] = [];
  const trackingIssues: Anomaly[] = [];
  const fatigueIssues: Anomaly[] = [];
  const budgetIssues: Anomaly[] = [];

  for (const a of anomalies) {
    if (a.category === "fatigue" || a.type === "creative_fatigue") {
      fatigueIssues.push(a);
    } else if (a.category === "funnel" || a.type === "cvr_drop" || a.type === "checkout_abandonment_spike") {
      pageIssues.push(a);
    } else if (a.type === "budget_concentration" || a.type === "high_spend_low_efficiency") {
      budgetIssues.push(a);
    } else if (a.type === "roas_drop" && Math.abs(a.changePercent) > 80) {
      trackingIssues.push(a);
    } else {
      adIssues.push(a);
    }
  }

  return { adIssues, pageIssues, trackingIssues, fatigueIssues, budgetIssues };
}

function buildDecisionDataPackage(input: AnalysisInput): string {
  const lines: string[] = [];
  lines.push(`# 決策資料包`);
  lines.push(`## 分析期間: ${input.dateLabel}（對比前一個等長期間）`);
  lines.push(`## 帳號數量: ${input.accounts.length}`);
  lines.push("");

  const totalSpend = input.accounts.reduce((s, a) => s + a.spend, 0);
  const totalRevenue = input.accounts.reduce((s, a) => s + a.revenue, 0);
  const overallRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "N/A";
  lines.push(`## 全體概覽: 總花費 NT$${totalSpend.toLocaleString()} | 總營收 NT$${totalRevenue.toLocaleString()} | 整體 ROAS ${overallRoas}`);
  lines.push("");

  lines.push("## 帳號優先排名（系統已依 Priority Score 排序）");
  for (const a of input.accounts.sort((x, y) => y.priorityScore - x.priorityScore)) {
    const trend = a.roas > 0 && a.spend > 0 ? "" : " [無營收]";
    lines.push(`- [${a.healthStatus.toUpperCase()}] ${a.accountName} (${a.platform})${trend}`);
    lines.push(`  Priority Score: ${a.priorityScore}/100 | 花費: NT$${a.spend.toLocaleString()} | 營收: NT$${a.revenue.toLocaleString()} | ROAS: ${a.roas.toFixed(2)} | CVR: ${a.conversionRate.toFixed(2)}% | 結帳流失: ${a.checkoutAbandonment.toFixed(1)}%`);
    lines.push(`  異常數: ${a.anomalyCount} | 主要問題: ${a.topProblem} | 系統建議: ${a.suggestedAction}`);
  }
  lines.push("");

  const classified = classifyAnomaliesBySource(input.anomalies, input.ga4Data);

  if (classified.adIssues.length > 0) {
    lines.push("## 疑似「廣告問題」（CTR/CPC/素材相關）");
    for (const a of classified.adIssues.slice(0, 10)) {
      lines.push(`- [${a.severity}] ${a.accountName}: ${a.title} — ${a.description}`);
    }
    lines.push("");
  }

  if (classified.pageIssues.length > 0) {
    lines.push("## 疑似「頁面/漏斗問題」（CVR/結帳流程相關）");
    for (const a of classified.pageIssues.slice(0, 10)) {
      lines.push(`- [${a.severity}] ${a.accountName}: ${a.title} — ${a.description}`);
    }
    lines.push("");
  }

  if (classified.trackingIssues.length > 0) {
    lines.push("## 疑似「追蹤問題」（轉換斷崖式下跌、可能 Pixel/GA4 斷線）");
    for (const a of classified.trackingIssues.slice(0, 5)) {
      lines.push(`- [${a.severity}] ${a.accountName}: ${a.title} — ${a.description}`);
    }
    lines.push("");
  }

  if (classified.fatigueIssues.length > 0) {
    lines.push("## 素材疲勞警報");
    for (const a of classified.fatigueIssues.slice(0, 8)) {
      lines.push(`- [${a.severity}] ${a.accountName}: ${a.description}`);
    }
    lines.push("");
  }

  if (classified.budgetIssues.length > 0) {
    lines.push("## 預算配置問題");
    for (const a of classified.budgetIssues.slice(0, 5)) {
      lines.push(`- [${a.severity}] ${a.accountName}: ${a.description}`);
    }
    lines.push("");
  }

  const riskLevelLabels: Record<string, string> = {
    danger: "危險",
    warning: "警告",
    watch: "觀察",
    stable: "穩定",
    potential: "潛力",
  };

  const campaignsWithScoring = input.campaigns.filter(c => c.scoring);
  if (campaignsWithScoring.length > 0) {
    const diagCounts: Record<string, number> = {};
    for (const c of campaignsWithScoring) {
      const d = c.scoring!.diagnosisLabel;
      diagCounts[d] = (diagCounts[d] || 0) + 1;
    }
    const diagDist = Object.entries(diagCounts).map(([d, n]) => `${d}=${n}`).join(" | ");

    lines.push("## V2 四分制評分與診斷");
    lines.push(`診斷分佈: ${diagDist}`);
    lines.push("");

    const sortedByUrgency = [...campaignsWithScoring].sort((a, b) => (b.scoring!.scores.urgency - a.scoring!.scores.urgency));
    const topUrgent = sortedByUrgency.filter(c => c.scoring!.scores.urgency >= 40).slice(0, 8);
    const topOpportunity = [...campaignsWithScoring].filter(c => c.scoring!.scores.opportunity >= 50).sort((a, b) => b.scoring!.scores.opportunity - a.scoring!.scores.opportunity).slice(0, 5);

    if (topUrgent.length > 0) {
      lines.push("### 急迫度最高的活動");
      for (const c of topUrgent) {
        const s = c.scoring!;
        lines.push(`- ${c.accountName} > ${c.campaignName}`);
        lines.push(`  V2: 健康=${s.scores.health} | 急迫=${s.scores.urgency} | 機會=${s.scores.opportunity} | 信心=${s.scores.confidence}`);
        lines.push(`  診斷: ${s.diagnosisLabel} | 建議: ${s.actionLabel}`);
        lines.push(`  判斷依據: ${s.benchmarkBasis} | 時間窗口: ${s.timeWindowBasis}`);
        lines.push(`  花費: NT$${c.spend.toLocaleString()} | ROAS: ${c.roas.toFixed(2)} | CTR: ${c.ctr.toFixed(2)}% | 頻率: ${c.frequency.toFixed(1)}`);
        if (s.notes.length > 0) lines.push(`  備註: ${s.notes.join("；")}`);
        if (c.multiWindow) {
          const mw = c.multiWindow;
          lines.push(`  多窗口 ROAS: 1d=${mw.window1d.roas.toFixed(2)} | 3d=${mw.window3d.roas.toFixed(2)} | 7d=${mw.window7d.roas.toFixed(2)} | 14d=${mw.window14d.roas.toFixed(2)}`);
        }
        if (c.stopLoss?.shouldStop) {
          lines.push(`  停損建議: 建議停止 — ${c.stopLoss.reasons.filter(r => !r.includes("暫不建議")).join("；")}`);
        }
      }
      lines.push("");
    }

    if (topOpportunity.length > 0) {
      lines.push("### 機會度最高的活動");
      for (const c of topOpportunity) {
        const s = c.scoring!;
        lines.push(`- ${c.accountName} > ${c.campaignName}`);
        lines.push(`  V2: 健康=${s.scores.health} | 機會=${s.scores.opportunity} | 信心=${s.scores.confidence}`);
        lines.push(`  診斷: ${s.diagnosisLabel} | 建議: ${s.actionLabel} | 依據: ${s.benchmarkBasis}`);
        lines.push(`  花費: NT$${c.spend.toLocaleString()} | ROAS: ${c.roas.toFixed(2)}`);
      }
      lines.push("");
    }
  } else {
    const campaignsWithTriScore = input.campaigns.filter(c => c.triScore);
    if (campaignsWithTriScore.length > 0) {
      const riskGroups = {
        danger: campaignsWithTriScore.filter(c => c.riskLevel === "danger"),
        warning: campaignsWithTriScore.filter(c => c.riskLevel === "warning"),
        watch: campaignsWithTriScore.filter(c => c.riskLevel === "watch"),
        stable: campaignsWithTriScore.filter(c => c.riskLevel === "stable"),
        potential: campaignsWithTriScore.filter(c => c.riskLevel === "potential"),
      };

      lines.push("## 活動評分與風險分級");
      lines.push(`風險分佈: danger=${riskGroups.danger.length} | warning=${riskGroups.warning.length} | watch=${riskGroups.watch.length} | stable=${riskGroups.stable.length} | potential=${riskGroups.potential.length}`);
      lines.push("");

      for (const [level, campaigns] of Object.entries(riskGroups)) {
        if (campaigns.length === 0) continue;
        const label = riskLevelLabels[level] || level;
        lines.push(`### [${label.toUpperCase()}] 等級活動`);
        for (const c of campaigns.slice(0, 8)) {
          const ts = c.triScore!;
          lines.push(`- ${c.accountName} > ${c.campaignName}`);
          lines.push(`  健康=${ts.health} | 急迫=${ts.urgency} | 潛力=${ts.scalePotential} | 風險=${riskLevelLabels[c.riskLevel || "stable"]}`);
          lines.push(`  花費: NT$${c.spend.toLocaleString()} | ROAS: ${c.roas.toFixed(2)} | CTR: ${c.ctr.toFixed(2)}% | 頻率: ${c.frequency.toFixed(1)}`);
          if (c.multiWindow) {
            const mw = c.multiWindow;
            lines.push(`  多窗口 ROAS: 1d=${mw.window1d.roas.toFixed(2)} | 3d=${mw.window3d.roas.toFixed(2)} | 7d=${mw.window7d.roas.toFixed(2)} | 14d=${mw.window14d.roas.toFixed(2)}`);
          }
          if (c.stopLoss?.shouldStop) {
            lines.push(`  停損建議: 建議停止 — ${c.stopLoss.reasons.filter(r => !r.includes("暫不建議")).join("；")}`);
          }
        }
        lines.push("");
      }
    }
  }

  if (input.riskyCampaigns.length > 0) {
    lines.push("## 高風險活動（正在燒錢）");
    for (const r of input.riskyCampaigns.slice(0, 10)) {
      lines.push(`- ${r.accountName} > ${r.campaignName} | 花費: NT$${r.spend.toLocaleString()} | ROAS: ${r.roas.toFixed(2)} | ${r.problemDescription}`);
    }
    lines.push("");
  }

  if (input.scaleOpportunities.length > 0) {
    lines.push("## 可加碼機會（表現好但預算小）");
    for (const s of input.scaleOpportunities.slice(0, 5)) {
      lines.push(`- ${s.accountName} > ${s.campaignName} | 花費: NT$${s.spend.toLocaleString()} | ROAS: ${s.roas.toFixed(2)} | ${s.problemDescription}`);
    }
    lines.push("");
  }

  const opportunities = input.opportunities || [];
  if (opportunities.length > 0) {
    lines.push("## 機會候選清單（系統篩選）");
    for (const o of opportunities.slice(0, 10)) {
      const ts = o.triScore;
      lines.push(`- [${o.typeLabel}] ${o.accountName} > ${o.campaignName}`);
      lines.push(`  Tri-Score: 健康=${ts.health} | 急迫=${ts.urgency} | 擴量潛力=${ts.scalePotential} | 風險=${riskLevelLabels[o.riskLevel]}`);
      lines.push(`  花費: NT$${o.spend.toLocaleString()} | ROAS: ${o.roas.toFixed(2)} | CTR: ${o.ctr.toFixed(2)}% | 轉換: ${o.conversions}`);
      lines.push(`  ROAS vs 帳號均值: ${o.roasVsAccountAvg.toFixed(2)}x | 花費佔比: ${o.spendShare.toFixed(1)}% | 預估擴量潛力: ${o.estimatedScalePotential}/100`);
    }
    lines.push("");
  }

  if (input.ga4Data.length > 0) {
    lines.push("## GA4 漏斗數據");
    for (const g of input.ga4Data) {
      const cvrTrend = g.conversionRatePrev > 0
        ? ` (前期: ${g.conversionRatePrev.toFixed(2)}%, 變化: ${(((g.conversionRate - g.conversionRatePrev) / g.conversionRatePrev) * 100).toFixed(1)}%)`
        : "";
      lines.push(`- ${g.propertyName} | 工作階段: ${g.sessions.toLocaleString()} | 轉換率: ${g.conversionRate.toFixed(2)}%${cvrTrend} | 加購率: ${g.addToCartRate.toFixed(2)}% | 結帳流失: ${g.checkoutAbandonmentRate.toFixed(1)}% | 營收: NT$${g.revenue.toLocaleString()}`);
    }
    lines.push("");
  }

  if (input.boards) {
    const b = input.boards;
    lines.push("## V2 戰情板摘要");
    if (b.dangerBoard.length > 0) {
      lines.push(`### 危險榜 (${b.dangerBoard.length} 項)`);
      for (const e of b.dangerBoard.slice(0, 5)) {
        lines.push(`- [${e.entityType}] ${e.entityName}: ${e.scoring.diagnosisLabel} → ${e.scoring.actionLabel}（急迫=${e.scoring.scores.urgency}, 信心=${e.scoring.scores.confidence}）`);
      }
      lines.push("");
    }
    if (b.stopLossBoard.length > 0) {
      lines.push(`### 停損榜 (${b.stopLossBoard.length} 項)`);
      for (const e of b.stopLossBoard.slice(0, 5)) {
        lines.push(`- ${e.entityName}: 花費 NT$${(e.spend || 0).toLocaleString()}, ROAS ${(e.roas || 0).toFixed(2)}, ${e.scoring.diagnosisLabel}`);
      }
      lines.push("");
    }
    if (b.opportunityBoard.length > 0) {
      lines.push(`### 機會榜 (${b.opportunityBoard.length} 項)`);
      for (const e of b.opportunityBoard.slice(0, 5)) {
        lines.push(`- ${e.entityName}: 機會=${e.scoring.scores.opportunity}, ${e.scoring.diagnosisLabel} → ${e.scoring.actionLabel}`);
      }
      lines.push("");
    }
    if (b.leakageBoard.length > 0) {
      lines.push(`### 頁面漏損榜 (${b.leakageBoard.length} 項)`);
      for (const e of b.leakageBoard.slice(0, 5)) {
        lines.push(`- [${e.entityType}] ${e.entityName}: ${e.scoring.diagnosisLabel} → ${e.scoring.actionLabel}`);
      }
      lines.push("");
    }
  }

  const crossPatterns: string[] = [];
  if (classified.adIssues.length > 0 && classified.pageIssues.length > 0) {
    crossPatterns.push("同時有廣告端和頁面端異常，需判斷主因在前端還是後端");
  }
  const accountsWithAnomalies = new Set(input.anomalies.map(a => a.accountId));
  if (accountsWithAnomalies.size > 1 && input.anomalies.length > 5) {
    crossPatterns.push(`${accountsWithAnomalies.size} 個帳號同時出現異常，可能有系統性問題或市場變化`);
  }
  if (crossPatterns.length > 0) {
    lines.push("## 系統偵測到的跨帳號模式");
    for (const p of crossPatterns) lines.push(`- ${p}`);
    lines.push("");
  }

  const stopLossCampaigns = input.campaigns.filter(c => c.stopLoss?.shouldStop);
  if (stopLossCampaigns.length > 0) {
    lines.push("## 停損建議活動（系統建議停止）");
    for (const c of stopLossCampaigns.slice(0, 8)) {
      const sl = c.stopLoss!;
      lines.push(`- ${c.accountName} > ${c.campaignName} | ROAS: ${c.roas.toFixed(2)} | 花費: NT$${c.spend.toLocaleString()}`);
      lines.push(`  停損原因: ${sl.reasons.filter(r => !r.includes("暫不建議")).join("；")}`);
    }
    lines.push("");
  }

  lines.push(`## 請基於以上決策資料包，做出最終判斷與策略建議。`);
  lines.push(`## 回傳 JSON 格式如下：`);
  lines.push(`\`\`\`json
{
  "executive_summary": "80-150 字的全體戰略摘要。開頭明確標示分析期間。先講最大的問題和結論，再講原因。像老闆晨會的第一段話。引用具體時間窗口數據支撐判斷（如 7 天 ROAS 趨勢）。同時提及最大風險和最佳機會。",
  "problem_diagnosis": {
    "ad_issues": "廣告端問題歸因（哪些帳號、什麼問題、建議動作），引用 Tri-Score 和時間窗口趨勢",
    "page_issues": "頁面端問題歸因（CTR 正常但 CVR 低 = 頁面問題），引用多窗口 CVR 趨勢",
    "tracking_issues": "追蹤問題判斷（是否有 Pixel/GA4 斷線跡象）",
    "market_factors": "市場/季節性因素判斷",
    "stop_loss_summary": "需要停損的活動總結與建議"
  },
  "top_priority_accounts": [
    {
      "account_name": "帳號名稱",
      "priority_reason": "為何該優先處理（不超過 30 字，引用 Tri-Score 或風險等級）",
      "root_cause": "ads|page|tracking|budget|fatigue",
      "suggested_action": "今天就該做的具體動作"
    }
  ],
  "urgent_actions": [
    {
      "order": 1,
      "action": "具體動作（指出帳號和活動名稱）",
      "reason": "原因（引用具體時間窗口數據，如 7d ROAS 從 X 降至 Y）",
      "impact": "預期效果",
      "account_name": "帳號名稱"
    }
  ],
  "weekly_recommendations": {
    "today": ["今天先做的 2-3 件事，每件都要指出具體帳號，優先處理 danger 等級活動"],
    "this_week": ["本週優先做的 2-3 件事，處理 warning 等級活動和停損建議"],
    "budget_advice": ["具體哪些活動該停預算 / 哪些該加碼，引用 ROAS 數據和機會候選清單"],
    "opportunity_actions": ["基於機會候選清單，建議加碼或測試的活動，附類型標籤和擴量潛力分數"]
  }
}
\`\`\`

重要規則：
- 所有文字必須使用繁體中文
- executive_summary 開頭必須標示「${input.dateLabel}」分析期間
- 不要複述原始數字，要做判斷和歸因
- 引用具體時間窗口（1d/3d/7d/14d）來支撐趨勢判斷，例如「7 天 ROAS 從 2.3 降至 1.1，14 天基線也僅 1.4」
- 使用 V2 四分制（健康/急迫/機會/信心）排序優先級，引用 diagnosis 和 recommendedAction
- 引用 benchmarkBasis 和 timeWindowBasis 說明判斷依據
- 如果有停損建議活動，在 problem_diagnosis.stop_loss_summary 中明確列出
- 如果有機會候選，在 weekly_recommendations.opportunity_actions 中具體建議
- 如果 CTR 正常但 CVR 下滑，明確指出是頁面問題而非素材問題
- 如果 ROAS 斷崖式下跌（>80%），要提醒可能是追蹤問題
- urgent_actions 最多 5 個，按緊急程度排序（danger > warning > watch）
- top_priority_accounts 按 Priority Score 排序，最多 5 個
- 回傳純 JSON，不要加 markdown 包裹`);

  return lines.join("\n");
}

export async function generateCrossAccountSummary(
  apiKey: string,
  input: AnalysisInput,
  modelName?: string
): Promise<CrossAccountSummary> {
  const batchId = `batch-${randomUUID().slice(0, 8)}`;
  const model = modelName || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
  const now = new Date().toISOString();

  const hasMetaData = input.campaigns.length > 0;
  const hasGA4Data = input.ga4Data.length > 0;
  const dataScope = hasMetaData && hasGA4Data ? "both" as const
    : hasMetaData ? "meta_only" as const
    : hasGA4Data ? "ga4_only" as const
    : "none" as const;

  const baseSummary: CrossAccountSummary = {
    executiveSummary: "",
    topPriorityAccounts: input.accounts.sort((a, b) => b.priorityScore - a.priorityScore),
    urgentActions: [],
    riskyCampaigns: input.riskyCampaigns,
    scaleOpportunities: input.scaleOpportunities,
    anomalies: input.anomalies,
    weeklyRecommendations: { today: [], thisWeek: [], budgetAdvice: [] },
    dataLastUpdatedAt: now,
    aiLastGeneratedAt: null,
    aiModelUsed: model,
    dataScope,
    analysisBatchId: batchId,
    dateLabel: input.dateLabel,
  };

  if (!apiKey?.trim()) {
    console.log("[AISummary] No API key, using deterministic fallback");
    return buildDeterministicSummary(baseSummary, input);
  }
  if (process.env.AI_TEST_MODE === "mock" || process.env.REFRESH_TEST_MODE === "fixture" || process.env.REFRESH_TEST_MODE === "mock") {
    console.log("[AISummary] AI_TEST_MODE/REFRESH_TEST_MODE 啟用，使用 deterministic 摘要不呼叫 LLM");
    return buildDeterministicSummary(baseSummary, input);
  }

  try {
    console.log(`[AISummary] Calling ${model} for cross-account summary, batch=${batchId}`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: CROSS_ACCOUNT_SYSTEM_PROMPT,
    });

    const prompt = buildDecisionDataPackage(input);
    const result = await genModel.generateContent(prompt);
    const responseText = result.response.text();

    console.log(`[AISummary] Response received (${responseText.length} chars)`);

    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    baseSummary.executiveSummary = parsed.executive_summary || "";
    baseSummary.aiLastGeneratedAt = new Date().toISOString();

    if (parsed.problem_diagnosis) {
      baseSummary.problemDiagnosis = {
        adIssues: parsed.problem_diagnosis.ad_issues || "",
        pageIssues: parsed.problem_diagnosis.page_issues || "",
        trackingIssues: parsed.problem_diagnosis.tracking_issues || "",
        marketFactors: parsed.problem_diagnosis.market_factors || "",
        stopLossSummary: parsed.problem_diagnosis.stop_loss_summary || "",
      };
    }

    if (Array.isArray(parsed.top_priority_accounts)) {
      for (const pa of parsed.top_priority_accounts) {
        const match = baseSummary.topPriorityAccounts.find(
          a => a.accountName === pa.account_name
        );
        if (match) {
          match.aiPriorityReason = pa.priority_reason || "";
          match.aiRootCause = pa.root_cause || "";
          match.suggestedAction = pa.suggested_action || match.suggestedAction;
        }
      }
    }

    if (Array.isArray(parsed.urgent_actions)) {
      baseSummary.urgentActions = parsed.urgent_actions.map((a: any, i: number) => ({
        order: a.order || i + 1,
        action: a.action || "",
        reason: a.reason || "",
        impact: a.impact || "",
        accountName: a.account_name || "",
      }));
    }

    if (parsed.weekly_recommendations) {
      baseSummary.weeklyRecommendations = {
        today: Array.isArray(parsed.weekly_recommendations.today) ? parsed.weekly_recommendations.today : [],
        thisWeek: Array.isArray(parsed.weekly_recommendations.this_week) ? parsed.weekly_recommendations.this_week : [],
        budgetAdvice: Array.isArray(parsed.weekly_recommendations.budget_advice) ? parsed.weekly_recommendations.budget_advice : [],
        opportunityActions: Array.isArray(parsed.weekly_recommendations.opportunity_actions) ? parsed.weekly_recommendations.opportunity_actions : [],
      };
    }

    console.log(`[AISummary] Summary generated successfully by ${model}, batch=${batchId}`);
    return baseSummary;
  } catch (err: any) {
    console.error(`[AISummary] Gemini call failed:`, err.message);
    return buildDeterministicSummary(baseSummary, input);
  }
}

function buildDeterministicSummary(
  base: CrossAccountSummary,
  input: AnalysisInput
): CrossAccountSummary {
  const totalSpend = input.accounts.reduce((s, a) => s + a.spend, 0);
  const totalRevenue = input.accounts.reduce((s, a) => s + a.revenue, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const dangerAccounts = input.accounts.filter(a => a.healthStatus === "danger");
  const warningAccounts = input.accounts.filter(a => a.healthStatus === "warning");
  const criticalAnomalies = input.anomalies.filter(a => a.severity === "critical");
  const classified = classifyAnomaliesBySource(input.anomalies, input.ga4Data);

  let summary = `[${input.dateLabel}] 監測 ${input.accounts.length} 個帳號，`;
  summary += `總花費 NT$${totalSpend.toLocaleString()}，營收 NT$${totalRevenue.toLocaleString()}，整體 ROAS ${overallRoas.toFixed(1)}。`;

  const campaignsWithScoring = input.campaigns.filter(c => c.scoring);
  if (campaignsWithScoring.length > 0) {
    const diagCounts: Record<string, number> = {};
    for (const c of campaignsWithScoring) {
      diagCounts[c.scoring!.diagnosisLabel] = (diagCounts[c.scoring!.diagnosisLabel] || 0) + 1;
    }
    const topDiags = Object.entries(diagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    summary += `V2 診斷分佈：${topDiags.map(([d, n]) => `${d} ${n} 個`).join("、")}。`;

    const topUrgent = campaignsWithScoring
      .filter(c => c.scoring!.scores.urgency >= 50)
      .sort((a, b) => b.scoring!.scores.urgency - a.scoring!.scores.urgency);
    if (topUrgent.length > 0) {
      const u = topUrgent[0];
      const s = u.scoring!;
      summary += `最急迫：${u.campaignName}（${s.diagnosisLabel}，急迫 ${s.scores.urgency}，建議${s.actionLabel}，${s.benchmarkBasis}，${s.timeWindowBasis}`;
      if (s.scores.confidence < 30) summary += `，信心度僅 ${s.scores.confidence} 數據量不足`;
      summary += `）。`;
    }

    const topOpp = campaignsWithScoring
      .filter(c => c.scoring!.scores.opportunity >= 50)
      .sort((a, b) => b.scoring!.scores.opportunity - a.scoring!.scores.opportunity);
    if (topOpp.length > 0) {
      const o = topOpp[0];
      const s = o.scoring!;
      summary += `最佳機會：${o.campaignName}（${s.diagnosisLabel}，機會 ${s.scores.opportunity}，建議${s.actionLabel}）。`;
    }
  } else if (dangerAccounts.length > 0) {
    summary += `其中 ${dangerAccounts.length} 個帳號處於危險狀態，需要立即處理。`;
    summary += `主要風險集中在${dangerAccounts[0].accountName}的${dangerAccounts[0].topProblem}。`;
  } else if (warningAccounts.length > 0) {
    summary += `${warningAccounts.length} 個帳號需要注意。`;
  } else {
    summary += `整體運作穩定。`;
  }

  if (classified.pageIssues.length > 0 && classified.adIssues.length === 0) {
    summary += `異常主要來自頁面/漏斗端，建議優先檢查落地頁與結帳流程。`;
  } else if (classified.trackingIssues.length > 0) {
    summary += `偵測到疑似追蹤問題，建議先確認 Pixel/GA4 追蹤是否正常。`;
  }

  base.executiveSummary = summary;
  base.aiLastGeneratedAt = new Date().toISOString();

  const stopLossCampaigns = input.campaigns.filter(c => c.stopLoss?.shouldStop);
  base.problemDiagnosis = {
    adIssues: classified.adIssues.length > 0
      ? `${classified.adIssues.length} 個廣告端異常：${classified.adIssues.slice(0, 3).map(a => `${a.accountName} ${a.title}`).join("、")}`
      : "無明顯廣告端異常",
    pageIssues: classified.pageIssues.length > 0
      ? `${classified.pageIssues.length} 個頁面端異常：${classified.pageIssues.slice(0, 3).map(a => `${a.accountName} ${a.title}`).join("、")}`
      : "無明顯頁面端異常",
    trackingIssues: classified.trackingIssues.length > 0
      ? `${classified.trackingIssues.length} 個疑似追蹤問題：${classified.trackingIssues.slice(0, 3).map(a => `${a.accountName} ${a.title}`).join("、")}`
      : "追蹤正常",
    marketFactors: input.anomalies.length > 5 && new Set(input.anomalies.map(a => a.accountId)).size > 2
      ? "多帳號同時異常，可能有市場或季節性因素"
      : "未偵測到明顯市場因素",
    stopLossSummary: stopLossCampaigns.length > 0
      ? `${stopLossCampaigns.length} 個活動建議停損：${stopLossCampaigns.slice(0, 3).map(c => `${c.accountName} ${c.campaignName} (ROAS ${c.roas.toFixed(1)})`).join("、")}`
      : "無需停損的活動",
  };

  const v2Campaigns = input.campaigns.filter(c => c.scoring);
  if (v2Campaigns.length > 0) {
    const urgent = v2Campaigns
      .filter(c => c.scoring!.scores.urgency >= 40)
      .sort((a, b) => b.scoring!.scores.urgency - a.scoring!.scores.urgency);
    base.urgentActions = urgent.slice(0, 5).map((c, i) => {
      const s = c.scoring!;
      return {
        order: i + 1,
        action: `${s.actionLabel}: ${c.accountName} > ${c.campaignName}`,
        reason: `${s.diagnosisLabel}，急迫 ${s.scores.urgency}，健康 ${s.scores.health}（${s.benchmarkBasis}，${s.timeWindowBasis}）${s.scores.confidence < 30 ? "，信心度低" : ""}`,
        impact: `建議${s.actionLabel}，信心度 ${s.scores.confidence}`,
        accountName: c.accountName,
      };
    });

    base.weeklyRecommendations.today = urgent.slice(0, 3).map(c => {
      const s = c.scoring!;
      return `[${c.accountName}] ${s.actionLabel}: ${c.campaignName}（${s.diagnosisLabel}，急迫 ${s.scores.urgency}）`;
    });

    const oppCampaigns = v2Campaigns
      .filter(c => c.scoring!.scores.opportunity >= 50)
      .sort((a, b) => b.scoring!.scores.opportunity - a.scoring!.scores.opportunity);
    base.weeklyRecommendations.budgetAdvice = oppCampaigns.slice(0, 3).map(c => {
      const s = c.scoring!;
      return `${s.actionLabel} ${c.accountName} ${c.campaignName}（${s.diagnosisLabel}，機會 ${s.scores.opportunity}，ROAS ${c.roas.toFixed(1)}）`;
    });

    base.weeklyRecommendations.opportunityActions = oppCampaigns.slice(0, 3).map(c => {
      const s = c.scoring!;
      return `[${s.diagnosisLabel}] ${c.accountName} ${c.campaignName} — 機會 ${s.scores.opportunity}，建議${s.actionLabel}，${s.benchmarkBasis}`;
    });
  } else {
    const sortedAccounts = [...input.accounts].sort((a, b) => b.priorityScore - a.priorityScore);
    base.urgentActions = sortedAccounts.slice(0, 3).map((a, i) => ({
      order: i + 1,
      action: a.suggestedAction,
      reason: a.topProblem,
      impact: a.healthStatus === "danger" ? "止血效果高" : "防止持續惡化",
      accountName: a.accountName,
    }));

    if (criticalAnomalies.length > 0) {
      base.weeklyRecommendations.today = criticalAnomalies.slice(0, 3).map(a =>
        `[${a.accountName}] ${a.suggestedAction}`
      );
    }
    if (input.riskyCampaigns.length > 0) {
      base.weeklyRecommendations.thisWeek = input.riskyCampaigns
        .filter(r => r.suggestion === "stop")
        .slice(0, 3)
        .map(r => `暫停 ${r.accountName} 的 ${r.campaignName} (ROAS ${r.roas.toFixed(1)})`);
    }
    if (input.scaleOpportunities.length > 0) {
      base.weeklyRecommendations.budgetAdvice = input.scaleOpportunities
        .slice(0, 3)
        .map(s => `可考慮加碼 ${s.accountName} 的 ${s.campaignName} (ROAS ${s.roas.toFixed(1)})`);
    }
  }

  const opportunities = input.opportunities || [];
  if (opportunities.length > 0 && !base.weeklyRecommendations.opportunityActions?.length) {
    base.weeklyRecommendations.opportunityActions = opportunities
      .slice(0, 3)
      .map(o => `[${o.typeLabel}] ${o.accountName} ${o.campaignName} — ROAS ${o.roas.toFixed(1)}，擴量潛力 ${o.estimatedScalePotential}/100`);
  }

  return base;
}
