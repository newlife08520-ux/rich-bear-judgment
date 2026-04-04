import { prisma } from "../../db";
import type { PatternTagRow } from "./creative-review-tags";

export async function createCreativeReviewWithTags(params: {
  userId: string;
  assetVersionId: string;
  assetPackageId?: string | null;
  productName?: string | null;
  reviewSource: string;
  workflow: string;
  uiMode: string;
  reviewStatus: string;
  summary?: string | null;
  nextAction?: string | null;
  problemType?: string | null;
  confidence?: string | null;
  score?: number | null;
  reasonsJson?: string | null;
  suggestionsJson?: string | null;
  evidenceJson?: string | null;
  blockingJson?: string | null;
  pendingJson?: string | null;
  rawResultJson?: string | null;
  tags: PatternTagRow[];
}) {
  return prisma.$transaction(async (tx) => {
    const rec = await tx.creativeReviewRecord.create({
      data: {
        userId: params.userId,
        assetVersionId: params.assetVersionId,
        assetPackageId: params.assetPackageId ?? null,
        productName: params.productName ?? null,
        reviewSource: params.reviewSource,
        workflow: params.workflow,
        uiMode: params.uiMode,
        reviewStatus: params.reviewStatus,
        summary: params.summary ?? null,
        nextAction: params.nextAction ?? null,
        problemType: params.problemType ?? null,
        confidence: params.confidence ?? null,
        score: params.score ?? null,
        reasonsJson: params.reasonsJson ?? null,
        suggestionsJson: params.suggestionsJson ?? null,
        evidenceJson: params.evidenceJson ?? null,
        blockingJson: params.blockingJson ?? null,
        pendingJson: params.pendingJson ?? null,
        rawResultJson: params.rawResultJson ?? null,
      },
    });
    if (params.tags.length > 0) {
      await tx.creativePatternTag.createMany({
        data: params.tags.map((t) => ({
          creativeReviewId: rec.id,
          tagType: t.tagType,
          tagValue: t.tagValue,
          weight: t.weight ?? null,
        })),
      });
    }
    return rec;
  });
}

export async function findLatestReviewForVersion(userId: string, assetVersionId: string) {
  return prisma.creativeReviewRecord.findFirst({
    where: { userId, assetVersionId },
    orderBy: { createdAt: "desc" },
  });
}

export async function countCreativeReviewsForVersion(userId: string, assetVersionId: string) {
  return prisma.creativeReviewRecord.count({ where: { userId, assetVersionId } });
}

/** 比最新一筆更舊的審查紀錄（供「歷史審查」展開） */
export async function listOlderReviewsForVersion(
  userId: string,
  assetVersionId: string,
  take = 50
) {
  return prisma.creativeReviewRecord.findMany({
    where: { userId, assetVersionId },
    orderBy: { createdAt: "desc" },
    skip: 1,
    take,
    select: {
      id: true,
      createdAt: true,
      reviewStatus: true,
      summary: true,
      nextAction: true,
      score: true,
      problemType: true,
    },
  });
}

export async function listTagsForReviewIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.creativePatternTag.findMany({
    where: { creativeReviewId: { in: ids } },
  });
}
