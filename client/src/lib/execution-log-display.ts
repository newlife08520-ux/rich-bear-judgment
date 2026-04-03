/**
 * 執行紀錄顯示用（對話框與 /execution-history 共用，避免重複字串邏輯）
 */
export function formatRollbackSnapshot(meta: Record<string, unknown> | undefined): string | null {
  const snap = meta?.rollbackSnapshot;
  if (!snap || typeof snap !== "object") return null;
  const o = snap as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.targetId === "string" && o.targetId) parts.push(`目標：${o.targetId}`);
  if (o.previousStatus != null) parts.push(`先前狀態：${String(o.previousStatus)}`);
  if (o.previousBudget != null) parts.push(`先前預算：${String(o.previousBudget)}`);
  if (o.requestedNext != null) parts.push(`請求變更：${String(o.requestedNext)}`);
  if (typeof o.draftId === "string" && o.draftId) parts.push(`草稿：${o.draftId}`);
  if (typeof o.phase === "string" && o.phase) parts.push(`階段：${o.phase}`);
  if (typeof o.validatedAt === "string" && o.validatedAt) parts.push(`驗證時間：${o.validatedAt}`);
  if (typeof o.actionTimestamp === "string" && o.actionTimestamp) parts.push(`動作時間：${o.actionTimestamp}`);
  return parts.length ? parts.join("；") : JSON.stringify(snap);
}

/** 單行目標提示：受影響 ID 或 rollback 快照中的目標／草稿 */
export function summarizeExecutionTarget(meta: Record<string, unknown> | undefined, affectedIds?: string[]): string {
  if (affectedIds?.length) {
    const shown = affectedIds.slice(0, 4).join(", ");
    return affectedIds.length > 4 ? `${shown} …` : shown;
  }
  const snap = meta?.rollbackSnapshot;
  if (snap && typeof snap === "object") {
    const o = snap as Record<string, unknown>;
    if (typeof o.targetId === "string" && o.targetId) return o.targetId;
    if (typeof o.draftId === "string" && o.draftId) return `草稿 ${o.draftId}`;
  }
  return "—";
}
