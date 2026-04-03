/**
 * Execution layer：server-owned apply，dry-run 後由 server 執行 handler.apply。
 */
export type ExecutionLogKind = "dry_run" | "apply" | "rollback_note";

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  kind: ExecutionLogKind;
  actionType: string;
  dryRunId: string;
  payload?: unknown;
  planSummary?: string;
  /** dry_run 專用：預覽步驟 */
  planSteps?: string[];
  planMeta?: Record<string, unknown>;
  status: "recorded" | "applied_stub" | "note_only" | "applied";
  message?: string;
  /** apply 專用：執行結果 */
  resultSummary?: string;
  affectedIds?: string[];
  affectedCount?: number;
  resultMeta?: Record<string, unknown>;
  /** apply 成功後由操作員補寫之 rollback／備註（不影響 DB status=applied） */
  rollbackNote?: string;
  errorMessage?: string;
}

export interface DryRunRequestBody {
  actionType: string;
  payload?: unknown;
}

export interface ApplyRequestBody {
  dryRunId: string;
  approved: boolean;
}

/** API 回傳：apply 成功時的結構化結果 */
export interface ExecutionApplyResponse {
  ok: boolean;
  alreadyApplied?: boolean;
  actionType: string;
  dryRunId: string;
  resultSummary?: string;
  affectedIds?: string[];
  affectedCount?: number;
  resultMeta?: Record<string, unknown>;
  message?: string;
}
