import { prisma } from "../../db";

/**
 * 7.3：未再選取之 link **刪除**（非僅 soft），避免 stale row 與現行 campaign 重疊。
 * 仍保留之連結以 linkLifecycleState=active；Stage1 非 primary 同稿改為 superseded。
 */
export async function syncExperimentLinksForDraft(params: {
  userId: string;
  publishDraftId: string;
  versionIds: string[];
  productName?: string | null;
}) {
  const { userId, publishDraftId, versionIds, productName } = params;

  if (versionIds.length === 0) {
    await prisma.creativeExperimentLink.deleteMany({
      where: { userId, publishDraftId },
    });
    return;
  }

  const unique = [...new Set(versionIds.filter(Boolean))];

  await prisma.creativeExperimentLink.deleteMany({
    where: {
      userId,
      publishDraftId,
      assetVersionId: { notIn: unique },
    },
  });

  let ord = 0;
  for (const assetVersionId of unique) {
    const isPrimary = ord === 0;
    ord += 1;

    const existing = await prisma.creativeExperimentLink.findFirst({
      where: { userId, publishDraftId, assetVersionId },
    });
    if (existing) {
      await prisma.creativeExperimentLink.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          removedAt: null,
          isPrimary,
          linkLifecycleState: "active",
          productName: productName != null ? productName : existing.productName,
          attributionMode: isPrimary ? "primary_only" : "shared",
        },
      });
    } else {
      await prisma.creativeExperimentLink.create({
        data: {
          userId,
          assetVersionId,
          publishDraftId,
          productName: productName ?? null,
          isActive: true,
          isPrimary,
          linkLifecycleState: "active",
          attributionMode: isPrimary ? "primary_only" : "shared",
        },
      });
    }
  }
}

/** @deprecated 請改用 syncExperimentLinksForDraft */
export async function upsertLinksForPublishDraft(params: {
  userId: string;
  publishDraftId: string;
  versionIds: string[];
  productName?: string | null;
}) {
  await syncExperimentLinksForDraft(params);
}

export async function updateLinksMetaIdsForPrimaryVersion(params: {
  userId: string;
  publishDraftId: string;
  primaryAssetVersionId: string;
  campaignId: string;
  adSetId: string;
  adId: string;
  creativeId: string;
}) {
  await prisma.creativeExperimentLink.updateMany({
    where: {
      userId: params.userId,
      publishDraftId: params.publishDraftId,
    },
    data: { isPrimary: false },
  });

  await prisma.creativeExperimentLink.updateMany({
    where: {
      userId: params.userId,
      publishDraftId: params.publishDraftId,
      assetVersionId: { not: params.primaryAssetVersionId },
    },
    data: {
      campaignId: null,
      adSetId: null,
      adId: null,
      creativeId: null,
      attributionMode: "shared",
      linkLifecycleState: "superseded",
    },
  });

  await prisma.creativeExperimentLink.updateMany({
    where: {
      userId: params.userId,
      publishDraftId: params.publishDraftId,
      assetVersionId: params.primaryAssetVersionId,
    },
    data: {
      campaignId: params.campaignId,
      adSetId: params.adSetId,
      adId: params.adId,
      creativeId: params.creativeId,
      isPrimary: true,
      isActive: true,
      removedAt: null,
      linkLifecycleState: "active",
      attributionMode: "primary_only",
    },
  });
}
