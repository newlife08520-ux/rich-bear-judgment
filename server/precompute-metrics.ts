/**
 * 預計算路徑觀測：counter + 結構化 log，供量化 fallback 使用率。
 * 不依賴 log 字串搜尋，可透過 getPrecomputeStats() 或 GET /api/debug/precompute-stats 取得。
 */
let actionCenterFallbackCount = 0;
let scorecardFallbackCount = 0;

export function incrementActionCenterFallback(): void {
  actionCenterFallbackCount += 1;
  try {
    console.warn(JSON.stringify({ event: "precompute_path", api: "action_center", path: "fallback", count: actionCenterFallbackCount }));
  } catch {
    // ignore
  }
}

export function incrementScorecardFallback(): void {
  scorecardFallbackCount += 1;
  try {
    console.warn(JSON.stringify({ event: "precompute_path", api: "scorecard", path: "fallback", count: scorecardFallbackCount }));
  } catch {
    // ignore
  }
}

export function getPrecomputeStats(): { actionCenterFallback: number; scorecardFallback: number } {
  return { actionCenterFallback: actionCenterFallbackCount, scorecardFallback: scorecardFallbackCount };
}
