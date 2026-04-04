/**
 * 階段二 Refresh Job 驗證腳本
 * 驗證：job 持久化、同 scope 去重、重啟時 running → failed (recovery)
 * 執行：npx tsx script/verify-phase2-refresh-job.ts
 */
import * as path from "path";
import * as fs from "fs";
import { storage } from "../server/storage";
import type { RefreshJob } from "../shared/schema";
import { buildScopeKey } from "../shared/schema";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const REFRESH_JOBS_FILE = path.join(DATA_DIR, "refresh-jobs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function main() {
  const out: string[] = [];
  out.push("# 階段二 Refresh Job 驗證結果");
  out.push("");

  ensureDataDir();
  const userId = "phase2-verify-user";
  const scopeKey = buildScopeKey(userId, [], [], "7");
  const jobId = randomUUID();
  const createdAt = new Date().toISOString();

  const job: RefreshJob = {
    jobId,
    userId,
    scopeKey,
    lockKey: scopeKey,
    status: "pending",
    createdAt,
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

  // (1) 建立 job、可查詢、持久化到檔案
  try {
    await storage.createRefreshJob(job);
    const got = storage.getRefreshJob(jobId);
    if (!got) {
      out.push("- **未通過**：createRefreshJob 後 getRefreshJob 取得 null。");
    } else if (got.status !== "pending") {
      out.push("- **未通過**：新建 job 狀態應為 pending，實際 " + got.status);
    } else {
      out.push("- **通過**：建立 refresh job 後可透過 getRefreshJob 取得，status=pending。");
    }
    const raw = fs.existsSync(REFRESH_JOBS_FILE) ? fs.readFileSync(REFRESH_JOBS_FILE, "utf-8") : "{}";
    const parsed = JSON.parse(raw) as Record<string, RefreshJob>;
    if (!parsed[jobId]) {
      out.push("- **未通過**：.data/refresh-jobs.json 中無此 jobId。");
    } else {
      out.push("- **通過**：job 已持久化至 .data/refresh-jobs.json。");
    }
  } catch (e) {
    out.push("- **未通過**：" + (e as Error).message);
  }
  out.push("");

  // (2) 同 scope 去重：getRunningJobByScopeKey 應回傳 pending/running 的 job
  try {
    const running = storage.getRunningJobByScopeKey(scopeKey);
    if (!running || running.jobId !== jobId) {
      out.push("- **未通過**：同 scopeKey 應回傳剛建立的 job，getRunningJobByScopeKey 回傳：" + (running ? running.jobId : "null"));
    } else {
      out.push("- **通過**：同 scope 去重鎖有效，getRunningJobByScopeKey(scopeKey) 回傳該 job。");
    }
    await storage.updateRefreshJob(jobId, { status: "running", startedAt: new Date().toISOString() });
    const stillRunning = storage.getRunningJobByScopeKey(scopeKey);
    if (!stillRunning || stillRunning.status !== "running") {
      out.push("- **未通過**：job 設為 running 後 getRunningJobByScopeKey 應仍回傳該 job。");
    } else {
      out.push("- **通過**：running 狀態下同 scope 仍被鎖定。");
    }
  } catch (e) {
    out.push("- **未通過**：" + (e as Error).message);
  }
  out.push("");

  // (3) 重啟恢復：寫入一個 running job 到檔案，呼叫 loadRefreshJobs，應變為 failed + recovery
  try {
    const recoveryJobId = randomUUID();
    const runningJob: RefreshJob = {
      jobId: recoveryJobId,
      userId: "recovery-test",
      scopeKey: "recovery-test::all::7",
      lockKey: "recovery-test::all::7",
      status: "running",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      errorMessage: null,
      errorStage: null,
      resultBatchKey: null,
      attemptCount: 1,
      triggerSource: "manual_refresh",
      progressStep: 50,
      progressMessage: "test",
      datePreset: "7",
      selectedAccountIds: [],
      selectedPropertyIds: [],
    };
    const currentRaw = fs.existsSync(REFRESH_JOBS_FILE) ? fs.readFileSync(REFRESH_JOBS_FILE, "utf-8") : "{}";
    const current = JSON.parse(currentRaw) as Record<string, RefreshJob>;
    current[recoveryJobId] = runningJob;
    fs.writeFileSync(REFRESH_JOBS_FILE, JSON.stringify(current, null, 2), "utf-8");
    storage.loadRefreshJobs();
    const after = storage.getRefreshJob(recoveryJobId);
    if (!after) {
      out.push("- **未通過**：loadRefreshJobs 後找不到該 job。");
    } else if (after.status !== "failed" || after.errorStage !== "recovery") {
      out.push("- **未通過**：殘留 running job 應被標為 failed + errorStage=recovery，實際 status=" + after.status + " errorStage=" + after.errorStage);
    } else {
      out.push("- **通過**：啟動時 loadRefreshJobs 將殘留 running job 標記為 failed，errorStage=recovery。");
    }
  } catch (e) {
    out.push("- **未通過**：" + (e as Error).message);
  }
  out.push("");

  out.push("---");
  out.push("說明：原子切換與「失敗不污染 latest」需在整合測試或手動呼叫 POST/GET 驗證；本腳本僅驗證 job 儲存、去重鎖、重啟恢復。");
  console.log(out.join("\n"));
}

void main();
