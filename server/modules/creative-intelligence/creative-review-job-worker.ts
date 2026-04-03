/**
 * 6.5-A：背景消化 CreativeReviewJob（輪詢，單執行緒避免併發打爆 Gemini）。
 */
import { storage } from "../../storage";
import { runCreativeReviewFromAssetVersion } from "./creative-review-runner";
import { prisma } from "../../db";
import { markJobCompleted, markJobFailed } from "./creative-review-job-prisma";

let started = false;

async function tickOnce(): Promise<void> {
  const candidate = await prisma.creativeReviewJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return;
  const claimed = await prisma.creativeReviewJob.updateMany({
    where: { id: candidate.id, status: "pending" },
    data: { status: "running", startedAt: new Date(), attemptCount: { increment: 1 } },
  });
  if (claimed.count === 0) return;
  const job = candidate;
  const settings = storage.getSettings(job.userId);
  const apiKey = settings.aiApiKey?.trim();
  if (!apiKey) {
    await markJobFailed(job.id, "未設定 AI API Key");
    return;
  }
  const result = await runCreativeReviewFromAssetVersion({
    userId: job.userId,
    apiKey,
    assetVersionId: job.assetVersionId,
    reviewSource: job.reviewSource,
  });
  if (!result.ok) {
    await markJobFailed(job.id, result.message);
    return;
  }
  await markJobCompleted(job.id);
}

export function startCreativeReviewJobProcessor(): void {
  if (started) return;
  started = true;
  const intervalMs = 5000;
  setInterval(() => {
    void tickOnce().catch((e) => console.error("[CreativeReviewJob]", e));
  }, intervalMs);
  void tickOnce().catch((e) => console.error("[CreativeReviewJob]", e));
}
