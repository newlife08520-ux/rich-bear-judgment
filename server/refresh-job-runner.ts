/**
 * 階段二：Refresh Job 執行器。與 request lifecycle 解耦，僅負責載入 job、跑 pipeline、原子寫入與狀態更新。
 *
 * 避免的錯誤實作：
 * - 不用 setTimeout/背景 Promise 包一層了事：job 先持久化再執行，狀態可恢復（見 storage.createRefreshJob + persistRefreshJobs）
 * - job 狀態必寫入 .data/refresh-jobs.json，每次 updateRefreshJob 都 persistRefreshJobs()，重啟後 loadRefreshJobs 載入
 * - 僅在 pipeline 全成功後才 saveBatch，絕不提前把 candidate 寫成 latest
 * - 同 scope 去重在 POST 層由 getRunningJobByScopeKey 擋下，不重複建立
 * - 任一步驟拋錯必進 catch，一律 updateRefreshJob(status: "failed", errorStage, errorMessage)，絕不讓 job 卡在 running
 * - 失敗時寫入 errorStage（meta_fetch/ga4_fetch/aggregation/precompute/persist/unknown），status API 可查
 */
import type { RefreshJobErrorStage } from "@shared/schema";
import { storage } from "./storage";
import { buildRefreshCandidateBatch } from "./refresh-pipeline";
import { persistMetaCampaignSnapshotsFromBatch } from "./modules/sync/persist-meta-campaign-snapshots";

export async function runRefreshJob(jobId: string): Promise<void> {
  const job = storage.getRefreshJob(jobId);
  if (!job) {
    console.warn(`[RefreshJob] job not found: ${jobId}`);
    return;
  }
  if (job.status !== "pending") {
    console.warn(`[RefreshJob] job ${jobId} status=${job.status}, skip run`);
    return;
  }

  const now = new Date().toISOString();
  storage.updateRefreshJob(jobId, { status: "running", startedAt: now });
  console.log(`[RefreshJob] started jobId=${jobId} scopeKey=${job.scopeKey}`);

  try {
    const batch = await buildRefreshCandidateBatch(job, (step, message) => {
      storage.updateRefreshJob(jobId, { progressStep: step, progressMessage: message });
    });

    try {
      storage.saveBatch(job.userId, batch);
      void persistMetaCampaignSnapshotsFromBatch(job.userId, batch).catch((e) =>
        console.warn("[RefreshJob] persistMetaCampaignSnapshotsFromBatch:", e)
      );
    } catch (persistErr: any) {
      const e = new Error(persistErr?.message ?? String(persistErr)) as Error & { stage: RefreshJobErrorStage };
      (e as any).stage = "persist";
      throw e;
    }
    const finishedAt = new Date().toISOString();
    storage.updateRefreshJob(jobId, {
      status: "succeeded",
      finishedAt,
      resultBatchKey: job.scopeKey,
      progressStep: 100,
      progressMessage: "完成",
    });
    storage.setRefreshStatus(job.userId, {
      isRefreshing: false,
      currentStep: "完成",
      progress: 100,
      lastRefreshedAt: finishedAt,
      lastAnalysisAt: finishedAt,
      lastAiSummaryAt: batch.summary?.aiLastGeneratedAt ?? null,
    });
    console.log(`[RefreshJob] succeeded jobId=${jobId} batchId=${batch.batchId}`);
  } catch (err: any) {
    // 任何例外都必須把 job 標成 failed，不可留在 running（狀態會持久化，重啟後也可見）
    const stage: RefreshJobErrorStage = err?.stage ?? "unknown";
    const message = err?.message ?? String(err);
    const finishedAt = new Date().toISOString();
    storage.updateRefreshJob(jobId, {
      status: "failed",
      finishedAt,
      errorStage: stage,
      errorMessage: message,
    });
    storage.setRefreshStatus(job.userId, {
      isRefreshing: false,
      currentStep: "失敗",
      progress: 0,
    });
    console.error(`[RefreshJob] failed jobId=${jobId} stage=${stage} message=${message}`);
  }
}
