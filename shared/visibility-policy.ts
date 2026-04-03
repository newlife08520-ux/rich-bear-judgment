/**
 * 預設可見性政策（0 spend／診斷／沉睡贏家）— 與 docs/DEFAULT-VISIBILITY-POLICY.md 對齊。
 * 僅含純函式與常數，不觸及 persona／calibration 語意。
 */
import type { CampaignMetrics } from "./schema";

export const VISIBILITY_POLICY_VERSION = "2026-03-25";

/** 已掛可見性政策 UI 的 surfaces（與 client VisibilityPolicyStrip / DormantGemsSurfaceSection 對齊） */
export const VISIBILITY_POLICY_SURFACES = [
  "dashboard",
  "products",
  "fb-ads",
  "creative-intelligence",
] as const;
export type VisibilityPolicySurface = (typeof VISIBILITY_POLICY_SURFACES)[number];

/** 7d／14d 視窗最低花費門檻（與政策文件一致，可日後調參） */
export const DORMANT_TRAILING_SPEND_MIN_7D = 30;
export const DORMANT_TRAILING_SPEND_MIN_14D = 60;
/** 主視窗轉換／點擊過低時降權 revival 分，避免單筆幸運轉換誤導 */
export const DORMANT_NOISE_CONVERSION_MIN = 3;
export const DORMANT_NOISE_CLICK_MIN = 18;

export interface DormantGemCandidate {
  campaignId: string;
  campaignName: string;
  accountId: string;
  productName: string;
  status: string;
  primarySpend: number;
  trailingSpend7d: number;
  trailingSpend14d: number;
  roas7d: number | null;
  opportunityScore: number | null;
  healthScore: number | null;
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  pauseSignals: string[];
  /** Batch 9.4：人類可讀分桶理由（暫停贏家／尾隨花費／非 no_delivery） */
  reasonSummary: string;
  /** Batch 10.4：操作上復活建議（非 persona／校準語意） */
  reviveRecommendation: string;
  whyPausedHint: string;
  whyWorthRevivingHint: string;
  /** Batch 11.0：復活排序分（啟發式整數，供 UI／ribbon 與審查樣本對齊） */
  revivalPriorityScore: number;
  /** 樣本不足降權（commercial noise clamp） */
  lowConfidenceDormant?: boolean;
}

/** 供 UI 與審查樣本：依 tier + pauseSignals + 訊號產生一句話理由 */
export function buildDormantGemReasonSummary(c: {
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  pauseSignals: string[];
  roas7d: number | null;
  opportunityScore: number | null;
  healthScore: number | null;
  trailingSpend7d: number;
  trailingSpend14d: number;
}): string {
  const paused = c.pauseSignals.includes("status_pause_like");
  const trailing = c.pauseSignals.includes("primary_window_zero_trailing_nonzero");
  const strongRoas = c.roas7d != null && c.roas7d >= 1.6;
  const strongScore =
    (c.opportunityScore != null && c.opportunityScore >= 60) ||
    (c.healthScore != null && c.healthScore >= 60);

  if (c.visibilityTier === "paused_winner_bucket" && paused) {
    return "暫停／停止類狀態；尾隨 7d／14d 曾花費且仍具正向訊號（暫停贏家桶）— 復活候選，與「從未投遞」分開。";
  }
  if (c.visibilityTier === "dormant_gem_bucket" && trailing) {
    const tail = strongRoas ? "7d ROAS 達標。" : strongScore ? "機會／健康評分達標。" : "正向訊號達政策門檻。";
    return `主視窗零花費、尾隨視窗仍有花費（沉睡高潛）；${tail} 非 no_delivery／樣本不足診斷列。`;
  }
  if (c.visibilityTier === "dormant_gem_bucket") {
    return "沉睡高潛桶：零花費但歷史或評分符合政策；請與下方診斷陣列對照，勿與未投遞混列。";
  }
  return "可見性政策：復活候選；請對照 DEFAULT-VISIBILITY-POLICY 與診斷分桶。";
}

/** Batch 10.4：復活價值排序（數值啟發式，可調參） */
/** UI／ribbon：P 分（revivalPriorityScore）高→低，同分 campaignId 穩定序 */
export function sortDormantGemCandidatesForDisplay<
  T extends { revivalPriorityScore?: number | null; campaignId: string },
>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const sa = a.revivalPriorityScore ?? -1;
    const sb = b.revivalPriorityScore ?? -1;
    if (sb !== sa) return sb - sa;
    return (a.campaignId ?? "").localeCompare(b.campaignId ?? "");
  });
}

/** 與 buildDormantGemCandidates 伺服端排序一致（浮點復活值 + campaignId 穩定序） */
export function sortDormantGemCandidatesByRevivalValue<
  T extends {
    visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
    campaignId: string;
    trailingSpend7d?: number;
    trailingSpend14d?: number;
    roas7d: number | null;
    opportunityScore?: number | null;
    healthScore?: number | null;
  },
>(list: readonly T[]): T[] {
  const row = (x: T) =>
    computeDormantGemRevivalValue({
      visibilityTier: x.visibilityTier,
      trailingSpend7d: x.trailingSpend7d ?? 0,
      trailingSpend14d: x.trailingSpend14d ?? 0,
      roas7d: x.roas7d,
      opportunityScore: x.opportunityScore ?? null,
      healthScore: x.healthScore ?? null,
    });
  return [...list].sort((a, b) => {
    const da = row(a);
    const db = row(b);
    if (db !== da) return db - da;
    return a.campaignId.localeCompare(b.campaignId);
  });
}

export function computeDormantGemRevivalValue(c: {
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  trailingSpend7d: number;
  trailingSpend14d: number;
  roas7d: number | null;
  opportunityScore: number | null;
  healthScore: number | null;
}): number {
  let v = c.trailingSpend7d * 1.0 + c.trailingSpend14d * 0.35;
  if (c.visibilityTier === "paused_winner_bucket") v += 40;
  if (c.roas7d != null) v += Math.min(c.roas7d * 15, 80);
  if (c.opportunityScore != null) v += Math.min(c.opportunityScore * 0.4, 35);
  if (c.healthScore != null) v += Math.min(c.healthScore * 0.25, 25);
  return v;
}

export function buildDormantGemReviveRecommendation(c: {
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  roas7d: number | null;
}): string {
  if (c.visibilityTier === "paused_winner_bucket") {
    return "復活建議：確認暫停原因與素材／庫存就緒後，依尾隨 ROAS 與門檻小幅重啟或分時段測試。";
  }
  const roasOk = c.roas7d != null && c.roas7d >= 1.6;
  return roasOk
    ? "復活建議：7d ROAS 仍達標—優先檢查預算、排程與受眾是否被限縮，再分階段加回投放。"
    : "復活建議：先對照機會／健康分與尾隨花費，排除誤判為 no_delivery 後再小額試投。";
}

export function buildDormantGemWhyPausedHint(c: {
  visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket";
  pauseSignals: string[];
  status: string;
}): string {
  if (c.pauseSignals.includes("status_pause_like")) {
    return "為何像暫停：狀態欄為暫停／停止類（paused_winner 桶）；與「從未投遞」診斷分開。";
  }
  if (c.pauseSignals.includes("primary_window_zero_trailing_nonzero")) {
    return "為何主視窗零花費：主視窗與尾隨視窗不一致—常見於預算或排程縮減，需與系統延遲區分。";
  }
  return `為何列入候選：狀態「${c.status || "—"}」；詳見 reasonSummary 與政策門檻。`;
}

export function buildDormantGemWhyWorthRevivingHint(c: {
  roas7d: number | null;
  opportunityScore: number | null;
  healthScore: number | null;
  trailingSpend7d: number;
  trailingSpend14d: number;
}): string {
  const parts: string[] = [];
  if (c.trailingSpend7d >= DORMANT_TRAILING_SPEND_MIN_7D || c.trailingSpend14d >= DORMANT_TRAILING_SPEND_MIN_14D) {
    parts.push(`尾隨 7d／14d 花費達政策門檻（${c.trailingSpend7d.toFixed(0)}／${c.trailingSpend14d.toFixed(0)}）`);
  }
  if (c.roas7d != null && c.roas7d >= 1.6) parts.push(`7d ROAS ${c.roas7d.toFixed(2)} 達標`);
  if (c.opportunityScore != null && c.opportunityScore >= 60) parts.push(`機會分 ${c.opportunityScore}`);
  if (c.healthScore != null && c.healthScore >= 60) parts.push(`健康分 ${c.healthScore}`);
  if (parts.length === 0) return "為何值得救：政策判定具正向訊號且非診斷雜訊列。";
  return `為何值得救：${parts.join("；")}。`;
}

const PAUSE_LIKE = /\bPAUSED\b|paused|暫停|停止|ARCHIVED|暫停投放/i;

export function buildDormantGemCandidates(
  campaigns: CampaignMetrics[],
  resolveProduct: (c: CampaignMetrics) => string
): DormantGemCandidate[] {
  const out: DormantGemCandidate[] = [];
  for (const c of campaigns) {
    if (c.spend > 0) continue;
    const mw = c.multiWindow;
    const t7 = mw?.window7d?.spend ?? 0;
    const t14 = mw?.window14d?.spend ?? 0;
    if (t7 < DORMANT_TRAILING_SPEND_MIN_7D && t14 < DORMANT_TRAILING_SPEND_MIN_14D) continue;

    const roas7 = mw?.window7d?.roas ?? null;
    const opp = c.scoring?.scores?.opportunity ?? null;
    const health = c.scoring?.scores?.health ?? null;
    const strong =
      (roas7 != null && roas7 >= 1.6) ||
      (opp != null && opp >= 60) ||
      (health != null && health >= 60);
    if (!strong) continue;

    const pauseSignals: string[] = [];
    if (PAUSE_LIKE.test(c.status ?? "")) pauseSignals.push("status_pause_like");
    if (t7 > 0 && c.spend === 0) pauseSignals.push("primary_window_zero_trailing_nonzero");

    const visibilityTier: "paused_winner_bucket" | "dormant_gem_bucket" = pauseSignals.includes(
      "status_pause_like"
    )
      ? "paused_winner_bucket"
      : "dormant_gem_bucket";

    const row = {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      productName: resolveProduct(c) || "未分類",
      status: c.status ?? "",
      primarySpend: c.spend,
      trailingSpend7d: t7,
      trailingSpend14d: t14,
      roas7d: roas7,
      opportunityScore: opp,
      healthScore: health,
      visibilityTier,
      pauseSignals,
    };
    const reasonSummary = buildDormantGemReasonSummary(row);
    const reviveRecommendation = buildDormantGemReviveRecommendation(row);
    const whyPausedHint = buildDormantGemWhyPausedHint({
      visibilityTier: row.visibilityTier,
      pauseSignals: row.pauseSignals,
      status: row.status,
    });
    const whyWorthRevivingHint = buildDormantGemWhyWorthRevivingHint(row);
    const lowConfidenceDormant =
      c.conversions < DORMANT_NOISE_CONVERSION_MIN && c.clicks < DORMANT_NOISE_CLICK_MIN;
    const rawRevival = computeDormantGemRevivalValue(row);
    const revivalPriorityScore = Math.round(rawRevival * (lowConfidenceDormant ? 0.35 : 1));
    out.push({
      ...row,
      reasonSummary,
      reviveRecommendation,
      whyPausedHint,
      whyWorthRevivingHint,
      revivalPriorityScore,
      lowConfidenceDormant,
    });
  }
  return out
    .sort((a, b) => {
      const da = a.revivalPriorityScore;
      const db = b.revivalPriorityScore;
      if (db !== da) return db - da;
      return a.campaignId.localeCompare(b.campaignId);
    })
    .slice(0, 40);
}
