/**
 * Phase 3：有限併發，避免 Promise.all(fetches) 爆量。
 * 併發數由呼叫端或 config 傳入，不硬寫在函式內。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array(items.length) as R[];
  let index = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = index++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

/** 預設 refresh 外部 API 併發上限（Meta/GA4 帳號數可能很多時使用） */
export const DEFAULT_REFRESH_FETCH_CONCURRENCY = 5;
