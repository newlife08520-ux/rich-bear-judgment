import { randomUUID } from "crypto";
import type {
  DryRunRequestBody,
  ApplyRequestBody,
  ExecutionApplyResponse,
} from "./execution-types";
import {
  recordDryRun,
  findDryRunByDryRunId,
  hasApplyForDryRunId,
  recordApply,
  recordApplyFailure,
  appendRollbackNoteToRun,
} from "./execution-repository";
import type { IExecutionHandler } from "./execution-handler-types";
import { getHandler } from "./execution-handler-registry";
import { appendAdjustLedgerAfterApply } from "./execution-adjust-ledger";

export type DryRunApiResponse = {
  dryRunId: string;
  actionType: string;
  plan: { summary: string; steps: string[]; meta?: Record<string, unknown> };
  previewSummary: string;
  previewSteps: string[];
  previewMeta?: Record<string, unknown>;
  hint: string;
};

export async function runDryRun(
  userId: string,
  body: DryRunRequestBody
): Promise<DryRunApiResponse> {
  const actionType =
    typeof body.actionType === "string" && body.actionType.trim()
      ? body.actionType.trim()
      : "";
  const handler = getHandler(actionType);
  if (!handler) {
    throw new Error(`不支援的 actionType: ${actionType}`);
  }
  const h: IExecutionHandler = handler;
  const payload = body.payload ?? {};
  h.validate(payload);
  const preview = h.buildPreview(payload, { userId });
  const dryRunId = randomUUID();
  await recordDryRun(dryRunId, userId, actionType, body.payload, {
    summary: preview.summary,
    steps: preview.steps,
    meta: preview.meta,
  });
  return {
    dryRunId,
    actionType,
    plan: {
      summary: preview.summary,
      steps: preview.steps,
      meta: preview.meta,
    },
    previewSummary: preview.summary,
    previewSteps: preview.steps,
    previewMeta: preview.meta,
    hint: "半自動：請人工核准後再 apply；同一 dryRunId 僅能 apply 一次（冪等）。",
  };
}

export async function runApply(
  userId: string,
  body: ApplyRequestBody
): Promise<ExecutionApplyResponse> {
  if (!body.approved) {
    return { ok: false, actionType: "unknown", dryRunId: "", message: "需 approved: true 才會執行 apply" };
  }
  const dryRunId = typeof body.dryRunId === "string" ? body.dryRunId.trim() : "";
  if (!dryRunId) {
    return { ok: false, actionType: "unknown", dryRunId: "", message: "缺少 dryRunId" };
  }
  const dryRunEntry = await findDryRunByDryRunId(dryRunId, userId);
  if (!dryRunEntry) {
    return { ok: false, actionType: "unknown", dryRunId, message: "找不到對應之 dry-run（請先 dry-run 且同一使用者）" };
  }
  if (await hasApplyForDryRunId(dryRunId, userId)) {
    return {
      ok: true,
      alreadyApplied: true,
      actionType: dryRunEntry.actionType,
      dryRunId,
      message: "此 dryRunId 已 apply 過（冪等）",
    };
  }
  const handler = getHandler(dryRunEntry.actionType);
  if (!handler) {
    return { ok: false, actionType: dryRunEntry.actionType, dryRunId, message: "不支援的 actionType" };
  }
  const payload = (dryRunEntry.payload ?? {}) as Record<string, unknown>;
  try {
    const result = await handler.apply(payload, { userId });
    await recordApply(dryRunId, userId, {
      resultSummary: result.resultSummary,
      affectedIds: result.affectedIds,
      affectedCount: result.affectedCount,
      resultMeta: result.resultMeta,
    });
    void appendAdjustLedgerAfterApply({
      userId,
      actionType: dryRunEntry.actionType,
      payload,
      resultMeta: result.resultMeta as Record<string, unknown> | undefined,
    }).catch((e) => console.warn("[execution] adjust-ledger", e));
    return {
      ok: true,
      actionType: dryRunEntry.actionType,
      dryRunId,
      resultSummary: result.resultSummary,
      affectedIds: result.affectedIds,
      affectedCount: result.affectedCount,
      resultMeta: result.resultMeta,
      message: result.resultSummary,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    await recordApplyFailure(dryRunId, userId, errorMessage);
    return {
      ok: false,
      actionType: dryRunEntry.actionType,
      dryRunId,
      message: errorMessage,
    };
  }
}

export async function appendRollbackNote(
  userId: string,
  dryRunId: string,
  note: string
): Promise<{ ok: boolean; message: string }> {
  const id = dryRunId.trim();
  if (!id) return { ok: false, message: "缺少 dryRunId" };
  const ok = await appendRollbackNoteToRun(id, userId, note);
  if (!ok) {
    return {
      ok: false,
      message: "找不到紀錄，或該筆尚未套用成功（僅能對已套用成功之紀錄補寫 rollback 備註）",
    };
  }
  return { ok: true, message: "已寫入 rollback／備註" };
}
