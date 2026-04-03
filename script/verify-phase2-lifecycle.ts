/**
 * Phase 2 驗收：Job lifecycle（pending → running → succeeded）。
 * 使用 REFRESH_TEST_MODE=fixture 不打真實 Meta/GA4，完整走 pipeline → precompute → publish。
 * 執行：npx tsx script/verify-phase2-lifecycle.ts 或 npm run verify:phase2:lifecycle
 */
import { storage } from "../server/storage";
import { runRefreshJob } from "../server/refresh-job-runner";
import type { RefreshJob } from "../shared/schema";
import { buildScopeKey } from "../shared/schema";
import { randomUUID } from "crypto";

const TEST_USER = "phase2-lifecycle-test-user";

function main() {
  process.env.REFRESH_TEST_MODE = "fixture";

  const scopeKey = buildScopeKey(TEST_USER, [], [], "7");
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
  storage.createRefreshJob(job);

  const before = storage.getRefreshJob(jobId);
  if (!before || before.status !== "pending") {
    console.error("未通過：建立後 job 應為 pending，實際", before?.status ?? "null");
    process.exit(1);
  }

  runRefreshJob(jobId)
    .then(() => {
      const after = storage.getRefreshJob(jobId);
      if (!after) {
        console.error("未通過：執行後 job 遺失");
        process.exit(1);
      }
      if (after.status !== "succeeded") {
        console.error("未通過：fixture 模式應 succeeded，實際", after.status, after.errorStage, after.errorMessage);
        process.exit(1);
      }
      if (!after.resultBatchKey) {
        console.error("未通過：succeeded 時應有 resultBatchKey");
        process.exit(1);
      }
      console.log("通過：lifecycle pending → running → succeeded，resultBatchKey=" + after.resultBatchKey);
      process.exit(0);
    })
    .catch((e) => {
      console.error("未通過：runRefreshJob 拋錯", e);
      process.exit(1);
    });
}

main();
