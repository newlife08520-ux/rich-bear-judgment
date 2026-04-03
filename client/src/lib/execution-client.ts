/**
 * Execution Layer 前端：dry-run → 核准 → apply（與 server/modules/execution 對應）
 * dry-run 回傳形狀與 server 一致，client 正規化為 plan 形狀，不依賴純型別 cast。
 */
/** 核准對話框用（dry-run 回傳後暫存） */
export type ExecGateState = {
  dryRunId: string;
  summary: string;
  steps: string[];
};

/** @deprecated 使用 ExecGateState */
export type PublishExecGateState = ExecGateState;

/** Server 可能回傳 plan 或 previewSummary/previewSteps，client 正規化後固定形狀 */
type RawExecutionDryRunResponse = {
  dryRunId: string;
  hint?: string;
  plan?: {
    summary?: string;
    steps?: string[];
    meta?: Record<string, unknown>;
  };
  previewSummary?: string;
  previewSteps?: string[];
  previewMeta?: Record<string, unknown>;
};

export type ExecutionDryRunResponse = {
  dryRunId: string;
  hint?: string;
  plan: {
    summary: string;
    steps: string[];
    meta?: Record<string, unknown>;
  };
};

export async function executionDryRun(
  actionType: string,
  payload: unknown
): Promise<ExecutionDryRunResponse> {
  const res = await fetch("/api/execution/dry-run", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionType, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? "dry-run 失敗");
  }
  const raw = data as RawExecutionDryRunResponse;
  return {
    dryRunId: raw.dryRunId ?? "",
    hint: raw.hint,
    plan: raw.plan
      ? {
          summary: typeof raw.plan.summary === "string" ? raw.plan.summary : "",
          steps: Array.isArray(raw.plan.steps) ? raw.plan.steps : [],
          meta: raw.plan.meta,
        }
      : {
          summary: typeof raw.previewSummary === "string" ? raw.previewSummary : "",
          steps: Array.isArray(raw.previewSteps) ? raw.previewSteps : [],
          meta: raw.previewMeta,
        },
  };
}

/** 與 server ExecutionApplyResponse 一致 */
export type ExecutionApplyResponse = {
  ok: boolean;
  alreadyApplied?: boolean;
  actionType: string;
  dryRunId: string;
  resultSummary?: string;
  affectedIds?: string[];
  affectedCount?: number;
  resultMeta?: Record<string, unknown>;
  message?: string;
};

export async function executionApply(dryRunId: string): Promise<ExecutionApplyResponse> {
  const res = await fetch("/api/execution/apply", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRunId, approved: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? "apply 失敗");
  }
  return data as ExecutionApplyResponse;
}

export type ExecutionRollbackNoteResponse = { ok: boolean; message?: string };

/** 為已套用成功之紀錄補寫 rollback／備註（不變更 applied 語意） */
export async function executionAppendRollbackNote(
  dryRunId: string,
  note: string
): Promise<ExecutionRollbackNoteResponse> {
  const res = await fetch("/api/execution/rollback-note", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRunId, note }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: (data as { message?: string }).message ?? "寫入備註失敗" };
  }
  return data as ExecutionRollbackNoteResponse;
}
