#!/usr/bin/env node
/**
 * 正式環境 ffprobe 驗證：呼叫 GET /api/health/ffprobe，輸出 HTTP status、body、失敗分類。
 * 用法：node scripts/verify-ffprobe.mjs [BASE_URL]
 * 例：node scripts/verify-ffprobe.mjs
 *     node scripts/verify-ffprobe.mjs https://your-production.example.com
 */
const BASE_URL = process.env.BASE_URL || process.argv[2] || "http://127.0.0.1:5000";
const url = `${BASE_URL.replace(/\/$/, "")}/api/health/ffprobe`;

async function main() {
  console.log("Target:", url);
  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    console.log("HTTP status: (fetch failed)");
    console.log("Error:", e.message);
    console.log("Response body: N/A");
    console.log("Failure classification: OTHER (network/connection)");
    process.exit(1);
  }
  const status = res.status;
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  console.log("HTTP status:", status);
  console.log("Response body:", typeof body === "object" ? JSON.stringify(body, null, 2) : body);
  if (body && typeof body === "object") {
    if (body.ok === true) {
      console.log("Result: ffprobe 可執行");
    } else {
      const code = body.code || "OTHER";
      console.log("Failure classification:", code, "—", body.error || "");
    }
  }
  process.exit(body?.ok ? 0 : 1);
}
main();
