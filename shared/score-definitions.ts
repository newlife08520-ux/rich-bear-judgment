/**
 * 分數系統可解釋：每個分數的定義、計算來源、門檻、顏色規則、對應動作
 */

export interface ScoreDefinition {
  key: string;
  name: string;
  definition: string;
  calculationSource: string;
  thresholds: string;
  colorRule: string;
  suggestedAction: string;
}

export const SCORE_DEFINITIONS: ScoreDefinition[] = [
  {
    key: "health",
    name: "健康度",
    definition: "綜合 ROAS、CTR、CVR、CPC、頻率與漏斗完成度，反映該實體（活動/頁面/帳號）整體表現是否健康。",
    calculationSource: "scoring-engine: computeHealthScore（ROAS 比、CTR 比、CVR 比、CPC 比、頻率區間、樣本加成）",
    thresholds: "0–100；<40 不健康，40–60 觀察，≥60 健康",
    colorRule: "紅 <40、黃 40–59、綠 ≥60",
    suggestedAction: "健康度低：檢查素材/受眾/落地頁；健康度高：可考慮擴量。",
  },
  {
    key: "urgency",
    name: "急迫度",
    definition: "反映需立即處理的程度（ROAS 下滑、高花費低效、惡化趨勢、預算集中風險）。",
    calculationSource: "scoring-engine: computeUrgencyScore（多窗口趨勢、ROAS/CTR 變化、花費與 ROAS 組合、信心不足加成）",
    thresholds: "0–100；≥60 高急迫，40–59 中，<40 低",
    colorRule: "紅 ≥60、黃 40–59、綠 <40",
    suggestedAction: "高急迫：優先停損或降預算；中：觀察並排程優化。",
  },
  {
    key: "opportunity",
    name: "機會分",
    definition: "擴量潛力：ROAS 高於目標、頻率與花費尚有空間、表現穩定可擴。",
    calculationSource: "scoring-engine: computeScalePotentialScore（ROAS 高於目標、多窗口穩定性、頻率空間、花費占比與 CTR）",
    thresholds: "0–100；≥50 有機會，<50 暫不建議擴量",
    colorRule: "綠 ≥50、灰 <50",
    suggestedAction: "機會分高：可逐步提高預算 20–30%；低：先優化再擴。",
  },
  {
    key: "confidence",
    name: "信心度",
    definition: "數據是否足以支撐判斷（樣本量、曝光/點擊數）。",
    calculationSource: "scoring-engine: 依曝光/點擊門檻與樣本區間換算",
    thresholds: "0–100；<30 僅供參考，≥30 可參考，≥60 可信",
    colorRule: "灰 <30、黃 30–59、綠 ≥60",
    suggestedAction: "信心度低：勿單依此分做停損；補足數據後再判。",
  },
  {
    key: "priority",
    name: "優先級",
    definition: "綜合急迫、健康與信心，用於「今天先做哪幾件」的排序。",
    calculationSource: "scoring-engine: priorityBoard 排序式 urgency×0.4 + (100-health)×0.3 + confidence×0.3",
    thresholds: "分數越高越優先處理",
    colorRule: "依 urgency/health 組合顯示紅/黃/綠",
    suggestedAction: "優先處理高分項：停損或觀察；低分項可排後。",
  },
];
