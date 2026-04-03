/**
 * Phase 3 驗收：有限併發與 retry 輔助存在且行為正確。
 * 執行：npx tsx script/verify-phase3-concurrency.ts
 */
import { mapWithConcurrency } from "../server/lib/concurrency";
import { isRetryableError, withExponentialBackoff } from "../server/lib/retry";

async function main() {
  let ok = true;
  const r1 = await mapWithConcurrency([1, 2, 3], 2, async (x) => x * 10);
  if (JSON.stringify(r1) !== "[10,20,30]") {
    console.error("未通過：mapWithConcurrency 結果應為 [10,20,30]，實際", r1);
    ok = false;
  }
  let concurrent = 0;
  let maxConcurrent = 0;
  await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (x) => {
    concurrent++;
    if (concurrent > maxConcurrent) maxConcurrent = concurrent;
    await new Promise((r) => setTimeout(r, 5));
    concurrent--;
    return x;
  });
  if (maxConcurrent > 2) {
    console.error("未通過：併發數應不超過 2，實際 maxConcurrent=" + maxConcurrent);
    ok = false;
  }
  if (!isRetryableError(new Error("ECONNRESET"))) {
    console.error("未通過：ECONNRESET 應為可重試");
    ok = false;
  }
  if (isRetryableError(new Error("invalid JSON"))) {
    console.error("未通過：invalid JSON 不應為可重試");
    ok = false;
  }
  const v = await withExponentialBackoff(() => Promise.resolve(42), { maxAttempts: 1 });
  if (v !== 42) ok = false;
  if (ok) console.log("通過：concurrency 與 retry helper 存在且基本行為正確。");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
