/**
 * 階段二安全驗收：跨使用者查 job 必須回 404，不可洩漏狀態／scope／errorStage／errorMessage。
 * 情境：使用者 A 建立 refresh job → 使用者 B 用 A 的 jobId 呼叫 GET /api/refresh/:jobId/status
 * 預期：404，body 僅 { error: "job not found" }，不可 403，不可回任何 job 欄位。
 *
 * 執行（需伺服器）：設兩組帳密後
 *   PHASE2_USER_A_USERNAME=userA PHASE2_USER_A_PASSWORD=passA \
 *   PHASE2_USER_B_USERNAME=userB PHASE2_USER_B_PASSWORD=passB \
 *   npx tsx script/verify-phase2-auth-cross-user.ts
 * BASE_URL 預設 http://localhost:5000
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

async function login(username: string, password: string): Promise<string> {
  const r = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });
  const setCookieHeaders = (r.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [r.headers.get("set-cookie")].filter(Boolean) as string[];
  const allSetCookie = setCookieHeaders.join("; ");
  const m = allSetCookie.match(/connect\.sid=([^;]+)/);
  if (!m) throw new Error("login failed for " + username);
  return `connect.sid=${m[1]}`;
}

async function postRefresh(cookie: string): Promise<{ jobId: string; status: string; scopeKey?: string }> {
  const r = await fetch(`${BASE_URL}/api/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ datePreset: "7", selectedAccountIds: [], selectedPropertyIds: [] }),
  });
  if (!r.ok) throw new Error("POST /api/refresh " + r.status + " " + (await r.text()));
  return r.json();
}

async function getStatus(cookie: string, jobId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(`${BASE_URL}/api/refresh/${encodeURIComponent(jobId)}/status`, { headers: { Cookie: cookie } });
  let body: Record<string, unknown> = {};
  try {
    body = (await r.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: r.status, body };
}

async function run(): Promise<void> {
  const userA = process.env.PHASE2_USER_A_USERNAME;
  const passA = process.env.PHASE2_USER_A_PASSWORD;
  const userB = process.env.PHASE2_USER_B_USERNAME;
  const passB = process.env.PHASE2_USER_B_PASSWORD;
  if (!userA || !passA || !userB || !passB) {
    console.error("請設定兩組帳密：PHASE2_USER_A_USERNAME, PHASE2_USER_A_PASSWORD, PHASE2_USER_B_USERNAME, PHASE2_USER_B_PASSWORD");
    process.exit(1);
  }

  console.log("=== 階段二安全驗收：跨使用者查 job 授權 ===\n");

  const cookieA = await login(userA, passA);
  const postRes = await postRefresh(cookieA);
  const jobIdA = postRes.jobId;
  console.log("1. 使用者 A 建立 refresh job");
  console.log("   POST /api/refresh response:", JSON.stringify(postRes, null, 2));

  const cookieB = await login(userB, passB);
  const { status, body } = await getStatus(cookieB, jobIdA);
  console.log("\n2. 使用者 B 查詢 A 的 jobId:", jobIdA);
  console.log("   GET /api/refresh/:jobId/status response status:", status);
  console.log("   response body:", JSON.stringify(body, null, 2));

  const forbiddenLeaks = ["jobId", "scopeKey", "errorStage", "errorMessage", "status", "resultBatchKey", "progressStep", "progressMessage"];
  const leaked = forbiddenLeaks.filter((k) => body[k] !== undefined);

  if (status !== 404) {
    console.error("\n未通過：預期 404，實際", status);
    process.exit(1);
  }
  if (body.error !== "job not found") {
    console.error("\n未通過：預期 body.error === 'job not found'，實際", JSON.stringify(body.error));
    process.exit(1);
  }
  if (leaked.length > 0) {
    console.error("\n未通過：response 不得含 job 欄位，實際洩漏:", leaked);
    process.exit(1);
  }

  console.log("\n通過：B 查 A 的 job 回 404，body 僅 { error: 'job not found' }，無 job 欄位洩漏。");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
