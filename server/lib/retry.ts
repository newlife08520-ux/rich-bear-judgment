/**
 * Phase 3：可重試錯誤判斷與指數退避。
 * 僅對 429、5xx、臨時性網路錯誤重試；含 jitter、最大次數、timeout。
 */
export function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string; status?: number }).code ?? (err as { status?: number }).status;
  if (code === 429) return true;
  if (typeof code === "number" && code >= 500 && code < 600) return true;
  if (msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND") || msg.includes("network")) return true;
  if (msg.includes("quota") || msg.includes("rate limit")) return true;
  return false;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  jitter?: number;
  logContext?: RetryLogContext;
}

const defaultOptions = {
  maxAttempts: 3,
  baseMs: 1000,
  maxMs: 30000,
  jitter: 0.2,
} as const;

export const DEFAULT_RETRY_MAX_ATTEMPTS = defaultOptions.maxAttempts;
export const DEFAULT_RETRY_BASE_DELAY_MS = defaultOptions.baseMs;
export const DEFAULT_RETRY_MAX_DELAY_MS = defaultOptions.maxMs;

export interface RetryLogContext {
  provider?: string;
  operation?: string;
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxAttempts, baseMs, maxMs, jitter: jitterRatio, logContext } = { ...defaultOptions, ...opts };
  const provider = logContext?.provider ?? "provider";
  const operation = logContext?.operation ?? "request";
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const willRetry = attempt < maxAttempts - 1 && isRetryableError(e);
      const statusCode = (e as { status?: number; statusCode?: number }).status ?? (e as { statusCode?: number }).statusCode;
      if (attempt > 0 || willRetry) {
        console.warn(`[Retry] provider=${provider} operation=${operation} attempt=${attempt + 1} willRetry=${willRetry} statusCode=${statusCode ?? "n/a"} errorName=${e instanceof Error ? e.name : "unknown"}`);
      }
      if (attempt === maxAttempts - 1 || !isRetryableError(e)) throw e;
      const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt));
      const jitter = delay * (defaultOptions.jitter) * (Math.random() * 2 - 1);
      await new Promise((r) => setTimeout(r, Math.max(0, delay + jitter)));
    }
  }
  throw lastErr;
}
