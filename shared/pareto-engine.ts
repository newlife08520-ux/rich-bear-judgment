/**
 * 6.7-A：80/20（Pareto）第一版 — 依 profit-like 值排序與累積貢獻曲線。
 * 非完整財務模型；profit 缺省時以 revenue - spend 粗估。
 */

export interface ParetoItem {
  id: string;
  label: string;
  spend: number;
  revenue: number;
  profit?: number;
  score?: number;
}

export interface ParetoResult {
  top20PctIds: string[];
  bottom20PctIds: string[];
  cumulativeCurve: { id: string; label: string; cumulativeShare: number }[];
  hiddenDiamondCandidates: string[];
  dragCandidates: string[];
}

function profitLike(it: ParetoItem): number {
  if (it.profit != null && Number.isFinite(it.profit)) return it.profit;
  if (it.score != null && Number.isFinite(it.score)) return it.score;
  return it.revenue - it.spend;
}

function roasLike(it: ParetoItem): number {
  return it.spend > 0 ? it.revenue / it.spend : 0;
}

function slicePct<T>(arr: T[], pct: number): T[] {
  if (arr.length === 0) return [];
  const n = Math.max(1, Math.ceil(arr.length * pct));
  return arr.slice(0, n);
}

export function computePareto(items: ParetoItem[]): ParetoResult {
  if (items.length === 0) {
    return {
      top20PctIds: [],
      bottom20PctIds: [],
      cumulativeCurve: [],
      hiddenDiamondCandidates: [],
      dragCandidates: [],
    };
  }
  const sorted = [...items].sort((a, b) => profitLike(b) - profitLike(a));
  const totalPos = sorted.reduce((s, it) => s + Math.max(0, profitLike(it)), 0);
  let cum = 0;
  const cumulativeCurve = sorted.map((it) => {
    cum += Math.max(0, profitLike(it));
    return {
      id: it.id,
      label: it.label,
      cumulativeShare: totalPos > 0 ? cum / totalPos : 0,
    };
  });

  const top20 = slicePct(sorted, 0.2);
  const bottomSrc = [...sorted].reverse();
  const bottom20 = slicePct(bottomSrc, 0.2);

  const hiddenDiamondCandidates = sorted
    .filter((it) => it.spend < 200 && profitLike(it) > 0 && it.revenue / Math.max(it.spend, 1) >= 2.2)
    .map((it) => it.id)
    .slice(0, 20);

  const dragCandidates = bottom20
    .filter((it) => profitLike(it) < 0 || roasLike(it) < 0.9)
    .map((it) => it.id);

  return {
    top20PctIds: top20.map((x) => x.id),
    bottom20PctIds: bottom20.map((x) => x.id),
    cumulativeCurve,
    hiddenDiamondCandidates,
    dragCandidates,
  };
}

/** 6.7-packaging：給儀表板／審查者的人類可讀 bucket + 理由（非財務保證） */
export interface ParetoExplainedBucket {
  id: string;
  label: string;
  reason: string;
  sampleConfidence: "high" | "medium" | "low";
}

export interface ParetoWorkbenchPayload {
  topRevenueContributors: ParetoExplainedBucket[];
  topLossDrivers: ParetoExplainedBucket[];
  hiddenDiamonds: ParetoExplainedBucket[];
  moneyPits: ParetoExplainedBucket[];
  /** 第一版由 Creative Intelligence 標籤提供；此處占位避免 UI 分叉 */
  dominantWinningHooks: string[];
  dominantFailurePatterns: string[];
}

function sampleConf(it: ParetoItem): "high" | "medium" | "low" {
  if (it.spend >= 800) return "high";
  if (it.spend >= 200) return "medium";
  return "low";
}

export function buildParetoWorkbenchPayload(items: ParetoItem[], result: ParetoResult): ParetoWorkbenchPayload {
  const byId = new Map(items.map((x) => [x.id, x]));
  const totalPos = items.reduce((s, it) => s + Math.max(0, profitLike(it)), 0);

  const topRevenueContributors = result.top20PctIds.slice(0, 12).map((id) => {
    const it = byId.get(id)!;
    const share = totalPos > 0 ? Math.max(0, profitLike(it)) / totalPos : 0;
    return {
      id,
      label: it.label,
      reason: `佔正貢獻池約 ${(share * 100).toFixed(1)}%（profit-like=${profitLike(it).toFixed(0)}）；樣本信心 ${sampleConf(it)}。`,
      sampleConfidence: sampleConf(it),
    };
  });

  const topLossDrivers = result.bottom20PctIds.slice(0, 12).map((id) => {
    const it = byId.get(id)!;
    const pl = profitLike(it);
    return {
      id,
      label: it.label,
      reason:
        pl < 0
          ? `負 profit-like（${pl.toFixed(0)}），屬尾段壓力候選；需與商品策略交叉確認。`
          : `ROAS 偏弱（約 ${roasLike(it).toFixed(2)}），仍列於尾段觀察名單。`,
      sampleConfidence: sampleConf(it),
    };
  });

  const hiddenDiamonds = result.hiddenDiamondCandidates.map((id) => {
    const it = byId.get(id)!;
    return {
      id,
      label: it.label,
      reason: "花費仍低但 profit-like／ROAS 偏高，可能為 underfunded 好苗子；需補量驗證。",
      sampleConfidence: "low" as const,
    };
  });

  const moneyPits = result.dragCandidates.map((id) => {
    const it = byId.get(id)!;
    return {
      id,
      label: it.label,
      reason: "落在尾段且負貢獻或 ROAS<0.9 的候選；不代表立即關閉，需對照素材與預算。",
      sampleConfidence: sampleConf(it),
    };
  });

  return {
    topRevenueContributors,
    topLossDrivers,
    hiddenDiamonds,
    moneyPits,
    dominantWinningHooks: [],
    dominantFailurePatterns: [],
  };
}

/** 7.2：跨層級 82 法則主引擎 — UI／judgment 以 canonical 為準 */
export type ParetoScopeLevel = "company" | "account" | "product" | "creative_version";

export interface ParetoScopeBlock {
  level: ParetoScopeLevel;
  key: string;
  label: string;
  items: ParetoItem[];
  pareto: ParetoResult;
  workbench: ParetoWorkbenchPayload;
}

export interface ParetoEngineV2Payload {
  generatedAt: string;
  engineVersion: "v2";
  /** 與商品維度 workbench 對齊；legacy heuristic 僅作 historical fallback */
  canonicalWorkbench: ParetoWorkbenchPayload;
  canonicalPareto: ParetoResult;
  scopes: ParetoScopeBlock[];
  dominantWinningHooks: string[];
  dominantFailurePatterns: string[];
  legacyPrecedenceNote: string;
}

export function assembleParetoEngineV2(params: {
  scopes: ParetoScopeBlock[];
  dominantWinningHooks: string[];
  dominantFailurePatterns: string[];
}): ParetoEngineV2Payload {
  const product = params.scopes.find((s) => s.level === "product");
  const fallback = params.scopes[0];
  const pick = product ?? fallback;
  if (!pick) {
    const empty = computePareto([]);
    return {
      generatedAt: new Date().toISOString(),
      engineVersion: "v2",
      canonicalWorkbench: buildParetoWorkbenchPayload([], empty),
      canonicalPareto: empty,
      scopes: [],
      dominantWinningHooks: params.dominantWinningHooks,
      dominantFailurePatterns: params.dominantFailurePatterns,
      legacyPrecedenceNote:
        "本回傳為空集合；有資料時請以 canonicalWorkbench 為主，舊版 heuristics 僅供對照。",
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    engineVersion: "v2",
    canonicalWorkbench: pick.workbench,
    canonicalPareto: pick.pareto,
    scopes: params.scopes,
    dominantWinningHooks: params.dominantWinningHooks,
    dominantFailurePatterns: params.dominantFailurePatterns,
    legacyPrecedenceNote:
      "儀表板／判讀／商品與創意頁應以本 payload 的 canonicalWorkbench 與 scopes 為準；舊有啟發式若衝突，以 v2 引擎為主。",
  };
}
