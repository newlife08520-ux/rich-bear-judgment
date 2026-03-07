#!/usr/bin/env node
/**
 * 直接執行 ffprobe 可用性檢查（不經 HTTP），用於本機或部署機上驗證。
 * 用法：node scripts/run-ffprobe-check.mjs
 * 輸出：HTTP status（模擬）、response body、失敗分類（ENOENT/PERM/TIMEOUT/OTHER）。
 */
import { execSync } from "child_process";

function check() {
  try {
    execSync("ffprobe -version", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, message: "ffprobe 可執行" };
  } catch (e) {
    const err = e;
    const msg = err?.message ?? String(e);
    const code = err?.code;
    if (
      code === "ENOENT" ||
      /not found|ENOENT|spawn.*ffprobe/i.test(msg) ||
      /不是內部或外部命令|not recognized|command not found/i.test(msg)
    ) {
      return { ok: false, error: "ffprobe 未安裝或不在 PATH", code: "ENOENT" };
    }
    if (code === "EPERM" || /permission|EPERM|EACCES/i.test(msg)) {
      return { ok: false, error: "權限不足，無法執行 ffprobe", code: "PERM" };
    }
    if (err?.killed === true || code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
      return { ok: false, error: "執行逾時", code: "TIMEOUT" };
    }
    if (/Command failed.*ffprobe|ffprobe.*failed|not found|not recognized/i.test(msg)) {
      return { ok: false, error: "ffprobe 未安裝或不在 PATH", code: "ENOENT" };
    }
    return { ok: false, error: msg || "執行 ffprobe 失敗", code: "OTHER" };
  }
}

const result = check();
const status = result.ok ? 200 : 503;
console.log("HTTP status (若經 GET /api/health/ffprobe 回傳):", status);
console.log("Response body:", JSON.stringify(result, null, 2));
if (!result.ok) {
  console.log("Failure classification:", result.code, "—", result.error);
}
process.exit(result.ok ? 0 : 1);
