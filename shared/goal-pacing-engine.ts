/**
 * 6.3-B：目標成果／預算吃滿度／節奏 — 非單一 ROAS 閾值粗暴規則。
 * 缺欄位時降級為 low confidence，不得假裝已精準判斷。
 */

export type PacingLabel =
  | "UNDERSPENT_GOOD"
  | "UNDERSPENT_BAD"
  | "FULLY_SPENT_DEGRADING"
  | "HOLD_STABLE"
  | "LUCKY_NOISE"
  | "DO_NOT_TOUCH";

export type RecommendedPacingAction =
  | "raise_goal"
  | "lower_goal"
  | "keep_goal"
  | "increase_budget"
  | "decrease_budget"
  | "hold";

export interface GoalPacingEvaluation {
  pacingLabel: PacingLabel;
  recommendedAction: RecommendedPacingAction;
  confidence: "high" | "medium" | "low";
  why: string[];
  whyNotMore?: string;
  /** 給 UI：今日已調次數、觀察窗 */
  todayAdjustCount: number;
  observationWindowUntil: string | null;
  copyHints: string[];
  /** 7.5：上游缺欄位理由（不捏造） */
  ingestionGaps?: string[];
  /** 7.5：營運向狀態（映射自 pacingLabel，非第二套分數） */
  operatorPacingState?: string;
  /** 8.0：副敘事（鬆綁／Hold／縮量／吃不滿），不取代主 why[] */
  operatorExplainability?: {
    whyHold?: string;
    whyLoosen?: string;
    whyShrink?: string;
    whyUnderDelivery?: string;
  };
}

export interface GoalPacingOptions {
  luckyNoiseMaxSpend?: number;
  luckyNoiseMinRoas?: number;
  luckyNoiseMaxConversions?: number;
}

export interface GoalPacingInput {
  spend: number;
  revenue: number;
  roas: number;
  roasPrev?: number;
  /** 0~1：預算吃滿度；無資料則 undefined */
  spendFullness?: number | null;
  biddingType?: string | null;
  targetOutcomeValue?: number | null;
  todayAdjustCount?: number | null;
  observationWindowUntil?: string | null;
  lastAdjustType?: string | null;
  /** 樣本不足時為 true */
  lowSample?: boolean;
  /** Lucky 判斷輔助：轉換次數粗估 */
  conversionsHint?: number;
  /** Meta 學習期／調整期：禁止過早判暫停或縮量 */
  learningPhaseProtected?: boolean;
}

function inObservationWindow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function evaluateGoalAndPacing(input: GoalPacingInput, options?: GoalPacingOptions): GoalPacingEvaluation {
  const luckyNoiseMaxSpend = options?.luckyNoiseMaxSpend ?? 150;
  const luckyNoiseMinRoas = options?.luckyNoiseMinRoas ?? 2.8;
  const luckyNoiseMaxConversions = options?.luckyNoiseMaxConversions ?? 3;
  const why: string[] = [];
  const copyHints: string[] = [];
  const todayAdjustCount = input.todayAdjustCount ?? 0;
  const observationWindowUntil = input.observationWindowUntil ?? null;

  if (input.learningPhaseProtected) {
    why.push(
      "Meta 投放仍處學習／調整期（learning-phase-protected）：不應在此階段高信心建議暫停或大幅縮量。"
    );
    copyHints.push("learning-phase-protected：優先觀察與小幅調整，避免過早判死。");
    return {
      pacingLabel: "HOLD_STABLE",
      recommendedAction: "hold",
      confidence: "high",
      why,
      whyNotMore: "學習期內系統刻意降級為 Hold，待投放狀態穩定後再評估。",
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if (inObservationWindow(observationWindowUntil)) {
    why.push(`觀察窗尚未結束（至 ${observationWindowUntil}）`);
    copyHints.push("觀察窗內：不建議高信心連續調整。");
    return {
      pacingLabel: "DO_NOT_TOUCH",
      recommendedAction: "hold",
      confidence: "high",
      why,
      whyNotMore: "先等觀察窗結束再評估下一步。",
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if (todayAdjustCount >= 2) {
    why.push("今日已調整 2 次以上");
    copyHints.push("今日已動兩次：先觀察，不建議再動。");
    return {
      pacingLabel: "DO_NOT_TOUCH",
      recommendedAction: "hold",
      confidence: "high",
      why,
      whyNotMore: "節制原則：避免把好廣告調死。",
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  const hasGoalFields = Boolean(input.biddingType && input.biddingType !== "standard_budget");
  const fullness = input.spendFullness;
  const roas = input.roas;
  const roasPrev = input.roasPrev ?? roas;
  const degrading = roasPrev > 0 && roas < roasPrev * 0.85 && input.spend > 200;
  const underspent =
    fullness != null && fullness < 0.75 && input.spend > 0;
  const lucky =
    input.spend < luckyNoiseMaxSpend &&
    roas >= luckyNoiseMinRoas &&
    (input.conversionsHint ?? 0) < luckyNoiseMaxConversions;

  if (input.lowSample) {
    why.push("樣本不足／資料不完整，僅供低信心參考");
    copyHints.push("資料不足時請勿過度解讀 ROAS。");
    return {
      pacingLabel: "HOLD_STABLE",
      recommendedAction: "hold",
      confidence: "low",
      why,
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if (lucky) {
    why.push(
      "低樣本幸運噪音：花費低且轉換極少，ROAS 可能不穩定。建議觀察至少 5 筆轉換再做結論。"
    );
    why.push("花費低且 ROAS 偏高，可能是運氣樣本（Lucky）");
    copyHints.push("Lucky：先補量驗證，不直接當 Winner 放大。");
    return {
      pacingLabel: "LUCKY_NOISE",
      recommendedAction: "increase_budget",
      confidence: "low",
      why,
      whyNotMore: "補量時小幅加，並保留觀察窗。",
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if (underspent && roas >= 2) {
    why.push("預算吃不滿且成效尚可（UNDERSPENT_GOOD）");
    if (hasGoalFields) {
      copyHints.push("目標成果型：優先檢視「調高目標成果」是否比直接加預算合適。");
      return {
        pacingLabel: "UNDERSPENT_GOOD",
        recommendedAction: "raise_goal",
        confidence: fullness != null ? "medium" : "low",
        why,
        whyNotMore: "不必先假設只要加預算。",
        todayAdjustCount,
        observationWindowUntil,
        copyHints,
      };
    }
    copyHints.push("吃不滿但好：可先檢視目標／出價空間，再考慮加預算。");
    return {
      pacingLabel: "UNDERSPENT_GOOD",
      recommendedAction: "increase_budget",
      confidence: fullness != null ? "medium" : "low",
      why,
      whyNotMore: "若無目標成果欄位，仍以小幅加預算為次要選項。",
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if (underspent && roas < 1.2) {
    why.push("吃不滿且成效偏弱（UNDERSPENT_BAD）");
    copyHints.push("先釐清素材／受眾，不建議為吃滿而硬加預算。");
    return {
      pacingLabel: "UNDERSPENT_BAD",
      recommendedAction: "hold",
      confidence: "medium",
      why,
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  if ((fullness == null || fullness >= 0.85) && degrading) {
    why.push("花費已起量但 ROAS 明顯走弱（FULLY_SPENT_DEGRADING）");
    if (hasGoalFields) {
      copyHints.push("目標成果型：可優先評估「調低目標成果」或收緊，不必先大砍預算。");
      return {
        pacingLabel: "FULLY_SPENT_DEGRADING",
        recommendedAction: "lower_goal",
        confidence: "medium",
        why,
        todayAdjustCount,
        observationWindowUntil,
        copyHints,
      };
    }
    return {
      pacingLabel: "FULLY_SPENT_DEGRADING",
      recommendedAction: "decrease_budget",
      confidence: "medium",
      why,
      todayAdjustCount,
      observationWindowUntil,
      copyHints,
    };
  }

  why.push("落在穩定觀察區間（HOLD_STABLE）");
  copyHints.push("沒有強烈訊號時維持與小幅實驗優於頻繁大動。");
  return {
    pacingLabel: "HOLD_STABLE",
    recommendedAction: "keep_goal",
    confidence: "medium",
    why,
    todayAdjustCount,
    observationWindowUntil,
    copyHints,
  };
}

/** 6.6-C：給 UI 顯示「建議依據／缺欄位」— 不捏造高信心 */
export function describeGoalPacingMetaSignals(input: GoalPacingInput): {
  evidenceBasis: string[];
  missingSignals: string[];
} {
  const evidenceBasis: string[] = [];
  const missingSignals: string[] = [];
  if (input.spendFullness != null) {
    evidenceBasis.push("吃滿度：以 Meta adset 日預算 × 日期區間天數對照區間花費（粗估）");
  } else {
    missingSignals.push("吃滿度：Graph 未回傳 adset daily_budget 或無法計算");
  }
  if (input.biddingType) {
    evidenceBasis.push(`出價策略：Meta adset bid_strategy=${input.biddingType}`);
  } else {
    missingSignals.push("出價策略：未回傳 bid_strategy");
  }
  if (input.targetOutcomeValue != null) {
    evidenceBasis.push(`目標成果數值：${input.targetOutcomeValue}`);
  } else {
    missingSignals.push("目標成果數值：目前管線未寫入（非猜測）");
  }
  if (input.todayAdjustCount && input.todayAdjustCount > 0) {
    evidenceBasis.push(`今日已調整 ${input.todayAdjustCount} 次`);
  }
  if (input.observationWindowUntil) {
    evidenceBasis.push(`觀察窗至 ${input.observationWindowUntil}`);
  }
  return { evidenceBasis, missingSignals };
}

/** 6.6-packaging：營運向副標（whyHold / whyShrink / whyUnderDelivery）— 不取代主 why 陣列 */
export function operatorSecondaryNarratives(ev: GoalPacingEvaluation): {
  whyHold?: string;
  whyShrink?: string;
  whyUnderDelivery?: string;
  /** 7.5：何時該鬆綁目標成果（營運敘事） */
  whyLoosenTarget?: string;
} {
  const out: {
    whyHold?: string;
    whyShrink?: string;
    whyUnderDelivery?: string;
    whyLoosenTarget?: string;
  } = {};
  if (ev.pacingLabel === "DO_NOT_TOUCH") {
    out.whyHold = "節奏上先 Hold：今日已多次調整或仍在觀察窗，避免過度反應。";
  }
  if (ev.pacingLabel === "HOLD_STABLE" && ev.confidence === "low") {
    out.whyHold = "訊號不足時的 Hold：不代表安全無事，而是避免在資料薄時硬調。";
  }
  if (ev.recommendedAction === "decrease_budget" || ev.recommendedAction === "lower_goal") {
    out.whyShrink =
      ev.whyNotMore ??
      "縮量或調低目標是用來控制惡化與波動，需搭配素材／受眾診斷，不是單一 ROAS 懲罰。";
  }
  if (ev.pacingLabel === "UNDERSPENT_GOOD" || ev.pacingLabel === "UNDERSPENT_BAD") {
    out.whyUnderDelivery =
      "吃不滿可能來自目標成果過緊、素材學習期或預算節奏；需對照吃滿度與 bid 策略，不宜直接等同「好或壞」。";
  }
  if (ev.pacingLabel === "FULLY_SPENT_DEGRADING") {
    out.whyUnderDelivery = "已吃滿但成效走弱：屬 delivery 與成效同時惡化情境，優先釐清是否學習期結束或競價環境改變。";
  }
  /** 7.1：總監級敘事 — 與 pacingLabel 對齊，不取代主引擎 why 陣列 */
  if (ev.pacingLabel === "DO_NOT_TOUCH") {
    out.whyHold =
      (out.whyHold ?? "") +
      " 為何不該再動：連續微調會讓演算法無法完成穩定學習，好素材也可能被「調死」。";
  }
  if (ev.pacingLabel === "UNDERSPENT_GOOD") {
    out.whyUnderDelivery =
      (out.whyUnderDelivery ?? "") +
      " 為何可能該補量／鬆綁目標：吃不滿但 ROAS 尚可，常是目標成果過緊或預算節奏過保守，優先檢視 bid／目標再談加預算。";
  }
  if (ev.pacingLabel === "UNDERSPENT_BAD") {
    out.whyUnderDelivery =
      (out.whyUnderDelivery ?? "") +
      " 為何暫不放大：吃不滿且成效偏弱，先排除素材與受眾問題，避免為吃滿而硬加預算。";
  }
  if (ev.pacingLabel === "FULLY_SPENT_DEGRADING") {
    out.whyShrink =
      (out.whyShrink ?? "") +
      " 為何該放寬或收緊目標成果：已吃滿代表 delivery 不是主因，調整目標或結構常比單純砍預算更對症。";
  }
  if (ev.pacingLabel === "LUCKY_NOISE") {
    out.whyHold = "為何該暫不放大：樣本薄、ROAS 波動大，先小幅補量與觀察窗，不把噪音當確定贏家。";
  }
  if (ev.pacingLabel === "UNDERSPENT_GOOD" && ev.recommendedAction === "raise_goal") {
    out.whyLoosenTarget =
      "為何可能該鬆綁目標成果：吃不滿且 ROAS 尚可時，目標成果過緊常比單純加預算更卡 delivery；先檢視 bid／目標再談加預算。";
  }
  if (ev.pacingLabel === "FULLY_SPENT_DEGRADING") {
    out.whyLoosenTarget =
      "為何不放鬆目標就別硬砍：已吃滿代表 delivery 達標，若只砍預算可能錯殺仍在學習的素材；優先評估目標成果與受眾結構。";
  }
  return out;
}
