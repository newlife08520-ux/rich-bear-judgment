/**
 * 階段二驗收：模擬 refresh 中途失敗，確認 job 標為 failed、errorStage 有值、latest batch 未被污染。
 * 透過 PHASE2_INJECT_FAILURE 讓 pipeline 一開始就拋錯，runner 不應呼叫 saveBatch。
 * 執行：npx tsx script/verify-phase2-failure-no-pollute.ts
 */
import { storage } from "../server/storage";
import { runRefreshJob } from "../server/refresh-job-runner";
import type { RefreshJob } from "../shared/schema";
import { buildScopeKey } from "../shared/schema";
import { randomUUID } from "crypto";

const TEST_USER = "phase2-failure-test-user";

async function main() {
  const out: string[] = [];
  out.push("# 階段二：失敗不污染 latest 驗證");
  out.push("");

  const scopeKey = buildScopeKey(TEST_USER, [], [], "7");
  const beforeBatch = storage.getLatestBatch(TEST_USER);
  const beforeBatchId = beforeBatch?.batchId ?? null;

  const jobId = randomUUID();
  const job: RefreshJob = {
    jobId,
    userId: TEST_USER,
    scopeKey,
    lockKey: scopeKey,
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    errorStage: null,
    resultBatchKey: null,
    attemptCount: 1,
    triggerSource: "manual_refresh",
    progressStep: null,
    progressMessage: null,
    datePreset: "7",
    selectedAccountIds: [],
    selectedPropertyIds: [],
  };
  await storage.createRefreshJob(job);

  process.env.FORCE_REFRESH_FAILURE_STAGE = "meta_fetch";
  runRefreshJob(jobId)
    .then(() => {
      delete process.env.FORCE_REFRESH_FAILURE_STAGE;
      const afterJob = storage.getRefreshJob(jobId);
      const afterBatch = storage.getLatestBatch(TEST_USER);
      const afterBatchId = afterBatch?.batchId ?? null;

      let ok = true;
      if (!afterJob) {
        out.push("- **未通過**：job 遺失");
        ok = false;
      } else if (afterJob.status !== "failed") {
        out.push("- **未通過**：job 應為 failed，實際 " + afterJob.status);
        ok = false;
      } else {
        out.push("- **通過**：job 最終為 failed");
      }
      if (afterJob && !afterJob.errorStage) {
        out.push("- **未通過**：errorStage 應有值，實際 " + String(afterJob.errorStage));
        ok = false;
      } else if (afterJob) {
        out.push("- **通過**：errorStage=" + afterJob.errorStage + ", errorMessage=" + (afterJob.errorMessage || "").slice(0, 50));
      }
      if (beforeBatchId !== afterBatchId) {
        out.push("- **未通過**：latest batch 被污染，before batchId=" + beforeBatchId + ", after batchId=" + afterBatchId);
        ok = false;
      } else {
        out.push("- **通過**：舊 latest batch 仍可讀，batchId 未變（" + (afterBatchId ?? "null") + "）");
      }

      out.push("");
      out.push("---");
      if (ok) {
        out.push("全部通過：失敗時 job 標為 failed、errorStage 有值、latest 未被覆蓋。");
      } else {
        out.push("至少一項未通過。");
      }
      console.log(out.join("\n"));
      process.exit(ok ? 0 : 1);
    })
    .catch((e) => {
      delete process.env.FORCE_REFRESH_FAILURE_STAGE;
      console.error(e);
      out.push("- **未通過**：runRefreshJob 拋錯 " + (e as Error).message);
      console.log(out.join("\n"));
      process.exit(1);
    });
}

void main();
