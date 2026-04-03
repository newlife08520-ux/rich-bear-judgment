import type { AnalysisBatch } from "@shared/schema";
import { prisma } from "../../db";

/**
 * 每次 refresh 成功寫入 batch 後呼叫：保存「系統最後一次從 Meta 拉到的」預算／狀態指紋，供 out-of-band 比對。
 */
export async function persistMetaCampaignSnapshotsFromBatch(
  userId: string,
  batch: AnalysisBatch
): Promise<void> {
  const rows = batch.campaignMetrics ?? [];
  if (rows.length === 0) return;
  const now = new Date();
  for (const c of rows) {
    const dailyBudgetMinor =
      typeof c.dailyBudgetMinor === "number" && Number.isFinite(c.dailyBudgetMinor)
        ? Math.round(c.dailyBudgetMinor)
        : null;
    const effectiveStatus =
      typeof c.metaEffectiveStatus === "string" && c.metaEffectiveStatus.trim()
        ? c.metaEffectiveStatus.trim()
        : null;
    const metaUpdatedAt =
      typeof c.metaUpdatedAt === "string" && c.metaUpdatedAt.trim() ? c.metaUpdatedAt.trim() : null;
    await prisma.metaCampaignBudgetSnapshot.upsert({
      where: {
        userId_campaignId: { userId, campaignId: c.campaignId },
      },
      create: {
        userId,
        campaignId: c.campaignId,
        dailyBudgetMinor,
        effectiveStatus,
        metaUpdatedAt,
        ingestedAt: now,
      },
      update: {
        dailyBudgetMinor,
        effectiveStatus,
        metaUpdatedAt,
        ingestedAt: now,
      },
    });
  }
}
