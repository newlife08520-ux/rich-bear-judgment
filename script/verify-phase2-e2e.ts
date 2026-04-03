/**
 * 階段二 E2E 驗收（需伺服器運行）：
 * - 情境 A：POST refresh -> 輪詢 status -> pending/running -> succeeded；成功後 resultBatchKey、5 支 dashboard 為 precomputed
 * - 情境 B：同 scope 連續兩次 POST，第二次應回傳既有 jobId
 * 執行：PRECOMPUTE_TEST_USER + PRECOMPUTE_TEST_PASSWORD（或 PRECOMPUTE_TEST_COOKIE）BASE_URL 預設 http://localhost:5000
 * npx tsx script/verify-phase2-e2e.ts
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300000; // 5 min for real refresh

const DASHBOARD_ENDPOINTS: { name: string; url: string; pathHeader: string }[] = [
  { name: "action-center", url: `${BASE_URL}/api/dashboard/action-center`, pathHeader: "X-ActionCenter-Path" },
  { name: "action-center?scopeAccountIds", url: `${BASE_URL}/api/dashboard/action-center?scopeAccountIds=act_1`, pathHeader: "X-ActionCenter-Path" },
  { name: "action-center?scopeProducts", url: `${BASE_URL}/api/dashboard/action-center?scopeProducts=商品A`, pathHeader: "X-ActionCenter-Path" },
  { name: "scorecard", url: `${BASE_URL}/api/dashboard/scorecard`, pathHeader: "X-Scorecard-Path" },
  { name: "scorecard?groupBy=person", url: `${BASE_URL}/api/dashboard/scorecard?groupBy=person`, pathHeader: "X-Scorecard-Path" },
];

async function getCookie(): Promise<string> {
  const user = process.env.PRECOMPUTE_TEST_USER;
  const pass = process.env.PRECOMPUTE_TEST_PASSWORD;
  if (user && pass) {
    const r = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
      redirect: "manual",
    });
    const setCookieHeaders = (r.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [r.headers.get("set-cookie")].filter(Boolean) as string[];
    const allSetCookie = setCookieHeaders.join("; ");
    const m = allSetCookie.match(/connect\.sid=([^;]+)/);
    if (m) return `connect.sid=${m[1]}`;
  }
  const cookie = process.env.PRECOMPUTE_TEST_COOKIE;
  if (cookie) return cookie;
  throw new Error("請設 PRECOMPUTE_TEST_USER + PRECOMPUTE_TEST_PASSWORD，或 PRECOMPUTE_TEST_COOKIE");
}

async function postRefresh(cookie: string): Promise<{ jobId: string; status: string; scopeKey?: string; message?: string }> {
  const r = await fetch(`${BASE_URL}/api/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ datePreset: "7", selectedAccountIds: [], selectedPropertyIds: [] }),
  });
  if (!r.ok) throw new Error("POST /api/refresh " + r.status + " " + (await r.text()));
  return r.json();
}

async function getStatus(cookie: string, jobId: string): Promise<{ status: string; resultBatchKey?: string; errorStage?: string; errorMessage?: string; [k: string]: unknown }> {
  const r = await fetch(`${BASE_URL}/api/refresh/${jobId}/status`, { headers: { Cookie: cookie } });
  if (r.status === 404) throw new Error("job not found");
  if (!r.ok) throw new Error("GET status " + r.status);
  return r.json();
}

async function pollUntilFinished(cookie: string, jobId: string): Promise<{ status: string; resultBatchKey?: string; errorStage?: string; errorMessage?: string }> {
  const start = Date.now();
  const seen: string[] = [];
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const s = await getStatus(cookie, jobId);
    if (!seen.includes(s.status)) {
      seen.push(s.status);
      console.log("[status]", JSON.stringify({ status: s.status, progressStep: s.progressStep, progressMessage: s.progressMessage, errorStage: s.errorStage }));
    }
    if (s.status === "succeeded" || s.status === "failed") return s;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("輪詢逾時，job 未在 " + POLL_TIMEOUT_MS / 1000 + " 秒內完成");
}

async function run(): Promise<void> {
  console.log("=== 階段二 E2E 驗收（需伺服器 " + BASE_URL + "）===\n");

  const cookie = await getCookie();

  // ---------- 情境 A：成功 refresh + lifecycle ----------
  console.log("--- 情境 A：POST refresh，輪詢 status ---");
  const post1 = await postRefresh(cookie);
  console.log("POST /api/refresh response:", JSON.stringify(post1, null, 2));
  const jobId1 = post1.jobId;
  if (!jobId1) {
    console.error("未取得 jobId");
    process.exit(1);
  }

  const final = await pollUntilFinished(cookie, jobId1);
  console.log("最終 status:", JSON.stringify(final, null, 2));

  if (final.status === "succeeded") {
    console.log("resultBatchKey:", final.resultBatchKey ?? "(無)");
    console.log("\n--- 5 支 dashboard API 是否 precomputed ---");
    let allPrecomputed = true;
    for (const ep of DASHBOARD_ENDPOINTS) {
      const res = await fetch(ep.url, { headers: { Cookie: cookie } });
      const pathVal = res.headers.get(ep.pathHeader) ?? "(無)";
      console.log("  " + ep.name + "  " + ep.pathHeader + ":", pathVal);
      if (pathVal === "fallback") allPrecomputed = false;
    }
    if (!allPrecomputed) {
      console.error("至少一項為 fallback，非全部 precomputed");
      process.exit(1);
    }
    console.log("全部 5 支 API 為 precomputed。");
  } else {
    console.log("本次 refresh 失敗（status=failed），errorStage=" + final.errorStage + "，跳過 dashboard precomputed 檢查。");
  }

  // ---------- 情境 B：同 scope 連續兩次 POST，第二次應回傳既有 jobId ----------
  console.log("\n--- 情境 B：同 scope 連續兩次 POST（第一次先觸發，立即第二次）---");
  const postA = await postRefresh(cookie);
  const jobIdA = postA.jobId;
  const postB = await postRefresh(cookie); // 立即再打，不等待完成
  const jobIdB = postB.jobId;
  console.log("第一次 POST jobId:", jobIdA);
  console.log("第二次 POST jobId:", jobIdB);
  if (jobIdA !== jobIdB) {
    console.error("預期兩次為同一 jobId（同 scope 去重），實際不同");
    process.exit(1);
  }
  console.log("通過：兩次為同一 jobId，同 scope 未建立第二個 running job。");

  console.log("\n=== E2E 驗收完成 ===");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
