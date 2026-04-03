/**
 * 比對「上次 ingest 快照」與 Graph 即時 Campaign／AdSet 欄位，偵測原生後台 out-of-band 變更。
 */
import { prisma } from "../../db";
import { storage } from "../../storage";

export type OutOfBandHint = {
  campaignId: string;
  message: string;
  reasons: string[];
};

async function fetchLiveCampaignFingerprint(
  token: string,
  campaignId: string
): Promise<{
  dailyBudgetMinor: number | null;
  effectiveStatus: string | null;
} | null> {
  const enc = encodeURIComponent(token);
  const campUrl = `https://graph.facebook.com/v19.0/${campaignId}?fields=id,effective_status&access_token=${enc}`;
  const campRes = await fetch(campUrl);
  const campJson = await campRes.json().catch(() => ({}));
  if (!campRes.ok || campJson.error) return null;
  const effectiveStatus =
    typeof campJson.effective_status === "string" ? campJson.effective_status.trim() : null;

  const adsetsUrl = `https://graph.facebook.com/v19.0/${campaignId}/adsets?fields=daily_budget,effective_status&limit=1&access_token=${enc}`;
  const asRes = await fetch(adsetsUrl);
  const asJson = await asRes.json().catch(() => ({}));
  let dailyBudgetMinor: number | null = null;
  const row = asJson.data?.[0];
  if (row && row.daily_budget != null && String(row.daily_budget).trim() !== "") {
    const n = parseFloat(String(row.daily_budget));
    if (Number.isFinite(n)) dailyBudgetMinor = Math.round(n);
  }

  return { dailyBudgetMinor, effectiveStatus };
}

export async function computeOutOfBandHints(userId: string): Promise<{
  hints: OutOfBandHint[];
  tokenMissing: boolean;
  graphError?: string;
}> {
  const token = storage.getSettings(userId).fbAccessToken?.trim();
  if (!token) {
    return { hints: [], tokenMissing: true };
  }

  const snaps = await prisma.metaCampaignBudgetSnapshot.findMany({
    where: { userId },
    orderBy: { ingestedAt: "desc" },
    take: 20,
  });
  if (snaps.length === 0) {
    return { hints: [], tokenMissing: false };
  }

  const hints: OutOfBandHint[] = [];
  let graphError: string | undefined;
  for (const s of snaps) {
    const live = await fetchLiveCampaignFingerprint(token, s.campaignId);
    if (!live) {
      graphError = graphError ?? "部分活動無法讀取 Graph（權杖、權限或 id）；已略過該筆";
      continue;
    }
    const reasons: string[] = [];
    if (
      s.dailyBudgetMinor != null &&
      live.dailyBudgetMinor != null &&
      s.dailyBudgetMinor !== live.dailyBudgetMinor
    ) {
      reasons.push(
        `每日預算（最小單位）與上次同步不同：系統曾記錄 ${s.dailyBudgetMinor}，即時為 ${live.dailyBudgetMinor}`
      );
    }
    if (
      s.effectiveStatus &&
      live.effectiveStatus &&
      s.effectiveStatus !== live.effectiveStatus
    ) {
      reasons.push(`有效狀態變更：${s.effectiveStatus} → ${live.effectiveStatus}`);
    }
    if (reasons.length > 0) {
      hints.push({
        campaignId: s.campaignId,
        message: "此活動在 Meta 原生後台可能已被外部修改；建議重新整理資料並檢視節奏／建議是否仍適用。",
        reasons,
      });
    }
  }

  return { hints, tokenMissing: false, ...(graphError ? { graphError } : {}) };
}
