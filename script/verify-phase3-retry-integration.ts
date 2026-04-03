/**
 * Phase 3 驗收：Retry 整合 — 使用 mock provider 驗證 429/500 會重試、400 不重試。
 * 不依賴真實 Meta/GA4 token。
 */
import { withExponentialBackoff, isRetryableError } from "../server/lib/retry";

async function main() {
  let attemptCount = 0;

  // 1. 429 後成功：第一次 429，第二次成功
  attemptCount = 0;
  const r429 = await withExponentialBackoff(
    () => {
      attemptCount++;
      if (attemptCount === 1) {
        const e = new Error("rate limit") as Error & { status?: number };
        e.status = 429;
        throw e;
      }
      return Promise.resolve("ok");
    },
    { maxAttempts: 3, baseMs: 10, maxMs: 50, logContext: { provider: "mock", operation: "fetch" } }
  );
  if (r429 !== "ok" || attemptCount !== 2) {
    console.error("未通過：429 後應重試一次並成功，attemptCount=" + attemptCount);
    process.exit(1);
  }

  // 2. 500 後成功
  attemptCount = 0;
  const r500 = await withExponentialBackoff(
    () => {
      attemptCount++;
      if (attemptCount === 1) {
        const e = new Error("server error") as Error & { status?: number };
        e.status = 500;
        throw e;
      }
      return Promise.resolve("ok");
    },
    { maxAttempts: 3, baseMs: 10, maxMs: 50 }
  );
  if (r500 !== "ok" || attemptCount !== 2) {
    console.error("未通過：500 後應重試一次並成功，attemptCount=" + attemptCount);
    process.exit(1);
  }

  // 3. 400 不重試：第一次 400，應直接失敗、只呼叫一次
  attemptCount = 0;
  let caught400 = false;
  try {
    await withExponentialBackoff(
      () => {
        attemptCount++;
        const e = new Error("bad request") as Error & { status?: number };
        e.status = 400;
        throw e;
      },
      { maxAttempts: 3, baseMs: 10, maxMs: 50 }
    );
  } catch (e: any) {
    caught400 = true;
    if (e?.status !== 400) {
      console.error("未通過：400 應拋出且 status=400");
      process.exit(1);
    }
  }
  if (!caught400 || attemptCount !== 1) {
    console.error("未通過：400 不可重試，應只呼叫 1 次，attemptCount=" + attemptCount);
    process.exit(1);
  }

  // 4. isRetryableError 行為
  if (!isRetryableError(Object.assign(new Error("x"), { status: 429 }))) {
    console.error("未通過：429 應為可重試");
    process.exit(1);
  }
  if (isRetryableError(Object.assign(new Error("x"), { status: 400 }))) {
    console.error("未通過：400 不應為可重試");
    process.exit(1);
  }

  console.log("通過：Retry 整合（429/500 重試、400 不重試）驗證完成。");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
