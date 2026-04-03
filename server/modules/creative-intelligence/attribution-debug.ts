/**
 * 7.3：歸因診斷（除錯／營運用，不寫入核心分數）。
 */
import { prisma } from "../../db";

export async function buildAttributionDebugForVersion(userId: string, assetVersionId: string) {
  const links = await prisma.creativeExperimentLink.findMany({
    where: { userId, assetVersionId },
    orderBy: { linkedAt: "desc" },
  });
  const snaps = await prisma.creativeOutcomeSnapshot.findMany({
    where: { userId, assetVersionId },
    orderBy: { snapshotDate: "desc" },
    take: 15,
  });
  const campaignIds = [...new Set(links.map((l) => l.campaignId).filter(Boolean) as string[])];
  const overlap: { campaignId: string; totalLinks: number; activeLinks: number }[] = [];
  for (const cid of campaignIds) {
    const all = await prisma.creativeExperimentLink.findMany({ where: { userId, campaignId: cid } });
    overlap.push({
      campaignId: cid,
      totalLinks: all.length,
      activeLinks: all.filter((x) => x.isActive && x.linkLifecycleState === "active").length,
    });
  }
  return {
    assetVersionId,
    links,
    recentSnapshots: snaps,
    campaignOverlap: overlap,
  };
}

export async function buildAttributionDebugForCampaign(userId: string, externalCampaignId: string) {
  const links = await prisma.creativeExperimentLink.findMany({
    where: { userId, campaignId: externalCampaignId },
    orderBy: { linkedAt: "desc" },
  });
  const act = links.filter((l) => l.isActive && l.linkLifecycleState === "active");
  const prim = act.filter((l) => l.isPrimary);
  const ambiguous = act.length > 1 || prim.length !== 1;
  return {
    externalCampaignId,
    ambiguousHint: ambiguous,
    links,
  };
}
