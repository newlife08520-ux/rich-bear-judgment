/**
 * 實際 headers 驗證：refresh／backfill 後打 5 支 API，印出實際 response headers。
 * 驗收通過時輸出：「全部 5 支 API 的 path 實測均為 precomputed，無 fallback，亦無 empty。」
 * 若任一 path 為 fallback 則 exit 1。需登入：PRECOMPUTE_TEST_USER/PASSWORD 或 PRECOMPUTE_TEST_COOKIE。
 * 執行：npx tsx script/verify-precompute-headers.ts；BASE_URL 預設 http://localhost:5000
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const ENDPOINTS: { name: string; url: string; pathHeader: string; scopedHeader?: string }[] = [
  { name: "action-center", url: `${BASE_URL}/api/dashboard/action-center`, pathHeader: "X-ActionCenter-Path", scopedHeader: "X-ActionCenter-Scoped" },
  { name: "action-center?scopeAccountIds", url: `${BASE_URL}/api/dashboard/action-center?scopeAccountIds=act_1`, pathHeader: "X-ActionCenter-Path", scopedHeader: "X-ActionCenter-Scoped" },
  { name: "action-center?scopeProducts", url: `${BASE_URL}/api/dashboard/action-center?scopeProducts=商品A`, pathHeader: "X-ActionCenter-Path", scopedHeader: "X-ActionCenter-Scoped" },
  { name: "scorecard", url: `${BASE_URL}/api/dashboard/scorecard`, pathHeader: "X-Scorecard-Path" },
  { name: "scorecard?groupBy=person", url: `${BASE_URL}/api/dashboard/scorecard?groupBy=person`, pathHeader: "X-Scorecard-Path" },
];

async function getCookie(): Promise<string | undefined> {
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
  return undefined;
}

async function run(): Promise<void> {
  console.log("=== 實際 headers 驗證（預期 path 為 precomputed 或 empty，不得為 fallback）===\n");

  const cookie = await getCookie();
  if (!cookie) {
    console.error("未提供登入資訊。請設 PRECOMPUTE_TEST_USER + PRECOMPUTE_TEST_PASSWORD，或 PRECOMPUTE_TEST_COOKIE（connect.sid=...）");
    process.exit(1);
  }

  let hasFallback = false;
  for (const ep of ENDPOINTS) {
    const res = await fetch(ep.url, { headers: { Cookie: cookie } });
    const pathVal = res.headers.get(ep.pathHeader) ?? "(無)";
    const scopedVal = ep.scopedHeader ? res.headers.get(ep.scopedHeader) ?? "(無)" : "";
    console.log(`${ep.name}`);
    console.log(`  ${ep.pathHeader}: ${pathVal}${ep.scopedHeader ? `  ${ep.scopedHeader}: ${scopedVal}` : ""}`);
    if (pathVal === "fallback") {
      console.log(`  >>> 預期為 precomputed 或 empty，實際為 fallback，驗收失敗`);
      hasFallback = true;
    }
  }

  if (hasFallback) {
    console.error("\n至少一項 API 回傳 path=fallback。請先執行 refresh 產生具 precomputed 的 batch 後再驗證。");
    process.exit(1);
  }
  console.log("\n全部 5 支 API 的 path 實測均為 precomputed，無 fallback，亦無 empty。");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
