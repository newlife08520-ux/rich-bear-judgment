/**
 * 7.4：依商品彙總 pattern tags（hook／motif 等）之勝負側摘要。
 */
import { prisma } from "../../db";

export async function buildProductPatternPerformanceSummary(userId: string, productName: string) {
  const reviews = await prisma.creativeReviewRecord.findMany({
    where: { userId, productName },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, score: true, reviewStatus: true },
  });
  const ids = reviews.map((r) => r.id);
  if (ids.length === 0) {
    return {
      productName,
      sampleReviews: 0,
      winningHooks: [] as { tag: string; count: number }[],
      losingHooks: [] as { tag: string; count: number }[],
      hiddenDiamondMotifs: [] as { tag: string; count: number }[],
    };
  }
  const tags = await prisma.creativePatternTag.findMany({
    where: { creativeReviewId: { in: ids } },
  });
  const reviewById = new Map(reviews.map((r) => [r.id, r]));
  type Agg = Map<string, number>;
  const winH: Agg = new Map();
  const loseH: Agg = new Map();
  const diamondMotifs: Agg = new Map();

  for (const t of tags) {
    const rev = reviewById.get(t.creativeReviewId);
    if (!rev) continue;
    const sc = rev.score ?? 0;
    const isWin = sc >= 70 && rev.reviewStatus === "completed";
    const isLose = sc > 0 && sc < 45 && rev.reviewStatus === "completed";
    const key = `${t.tagType}:${t.tagValue}`;
    if (t.tagType === "hook") {
      if (isWin) winH.set(key, (winH.get(key) ?? 0) + 1);
      if (isLose) loseH.set(key, (loseH.get(key) ?? 0) + 1);
    }
    if (
      (t.tagType === "visual" || t.tagType === "format" || t.tagType === "pacing") &&
      isWin &&
      sc >= 75
    ) {
      diamondMotifs.set(key, (diamondMotifs.get(key) ?? 0) + 1);
    }
  }

  const sortAgg = (m: Agg) =>
    [...m.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

  return {
    productName,
    sampleReviews: reviews.length,
    winningHooks: sortAgg(winH),
    losingHooks: sortAgg(loseH),
    hiddenDiamondMotifs: sortAgg(diamondMotifs),
  };
}
