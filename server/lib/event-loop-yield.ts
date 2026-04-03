/**
 * Phase 3：讓出 event loop，避免大型迴圈阻塞。
 * 在長迴圈中每 N 次迭代呼叫一次，讓 I/O 與其他 task 有機會執行。
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

/** 是否應在本次迭代讓步（每 every 筆讓一次）。 */
export function shouldYield(index: number, every: number): boolean {
  return every > 0 && index > 0 && index % every === 0;
}
