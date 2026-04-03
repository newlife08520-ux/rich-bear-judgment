import type { CreativeReviewJob } from "@prisma/client";
import { prisma } from "../../db";
import * as assetVersionRepo from "../asset/asset-version-repository";

export function inferMediaKindForVersion(userId: string, assetVersionId: string): string {
  const v = assetVersionRepo.getById(userId, assetVersionId);
  const mime = (v?.fileType ?? "image/jpeg").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/pdf") || mime.endsWith("/pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

/** 7.4：對外狀態與欄位命名（內部仍用 pending/running/completed/failed） */
export function mapJobStatusToQueueLabel(status: string): "queued" | "processing" | "succeeded" | "failed" {
  if (status === "pending") return "queued";
  if (status === "running") return "processing";
  if (status === "completed") return "succeeded";
  return "failed";
}

export function serializeCreativeReviewJob(job: CreativeReviewJob) {
  return {
    id: job.id,
    userId: job.userId,
    assetVersionId: job.assetVersionId,
    reviewSource: job.reviewSource,
    status: job.status,
    queueStatus: mapJobStatusToQueueLabel(job.status),
    mediaKind: job.mediaKind ?? inferMediaKindForVersion(job.userId, job.assetVersionId),
    retryCount: job.attemptCount,
    lastError: job.errorMessage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    maxAttempts: job.maxAttempts,
    requestedBy: job.requestedBy,
    mode: job.mode,
  };
}

export async function findActiveCreativeReviewJob(userId: string, assetVersionId: string) {
  return prisma.creativeReviewJob.findFirst({
    where: { userId, assetVersionId, status: { in: ["pending", "running"] } },
    orderBy: { createdAt: "desc" },
  });
}

function mapJobMode(reviewSource: string): string {
  if (reviewSource === "auto_on_upload") return "auto_on_upload";
  if (reviewSource === "batch_queue" || reviewSource.startsWith("batch")) return "bulk_enqueue";
  if (reviewSource === "package_batch_enqueue") return "package_batch_enqueue";
  return "manual";
}

export async function createCreativeReviewJob(params: {
  userId: string;
  assetVersionId: string;
  reviewSource: string;
}) {
  const mediaKind = inferMediaKindForVersion(params.userId, params.assetVersionId);
  return prisma.creativeReviewJob.create({
    data: {
      userId: params.userId,
      assetVersionId: params.assetVersionId,
      reviewSource: params.reviewSource,
      status: "pending",
      requestedBy: params.userId,
      mode: mapJobMode(params.reviewSource),
      mediaKind,
    },
  });
}

export async function getCreativeReviewQueueStats(userId: string) {
  const [pending, running, failed, completed] = await Promise.all([
    prisma.creativeReviewJob.count({ where: { userId, status: "pending" } }),
    prisma.creativeReviewJob.count({ where: { userId, status: "running" } }),
    prisma.creativeReviewJob.count({ where: { userId, status: "failed" } }),
    prisma.creativeReviewJob.count({ where: { userId, status: "completed" } }),
  ]);
  return {
    queued: pending,
    processing: running,
    failed,
    succeeded: completed,
    pending,
    running,
    completed,
  };
}

export async function getCreativeReviewJob(userId: string, jobId: string) {
  return prisma.creativeReviewJob.findFirst({
    where: { id: jobId, userId },
  });
}

export async function findNextPendingCreativeReviewJob() {
  return prisma.creativeReviewJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
}

export async function markJobRunning(jobId: string) {
  return prisma.creativeReviewJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });
}

export async function markJobCompleted(jobId: string) {
  return prisma.creativeReviewJob.update({
    where: { id: jobId },
    data: { status: "completed", finishedAt: new Date(), errorMessage: null },
  });
}

export async function markJobFailed(jobId: string, message: string) {
  return prisma.creativeReviewJob.update({
    where: { id: jobId },
    data: { status: "failed", finishedAt: new Date(), errorMessage: message.slice(0, 2000) },
  });
}
