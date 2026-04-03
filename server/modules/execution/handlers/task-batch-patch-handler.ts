import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import { batchUpdateWorkbenchTasks } from "../../../workbench-db";

const ACTION_TYPE = "task_batch_patch";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.ids) || p.ids.length === 0) throw new Error("ids 必填且為非空陣列");
  const ids = p.ids as unknown[];
  if (!ids.every((id) => typeof id === "string")) throw new Error("ids 元素須為字串");
}

export const taskBatchPatchHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const ids = payload.ids as string[];
    const status = payload.status != null ? String(payload.status) : undefined;
    const assigneeId = payload.assigneeId !== undefined ? payload.assigneeId : undefined;
    return {
      summary: `批次更新 ${ids.length} 筆任務${status ? `，狀態→${status}` : ""}${assigneeId !== undefined ? "，指派變更" : ""}`,
      steps: [
        "1. 驗證 ids 陣列",
        "2. 逐筆更新 status / assigneeId",
        "3. 回傳 successCount / failCount / errors",
      ],
      meta: { count: ids.length, status, hasAssigneeChange: assigneeId !== undefined },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    const ids = payload.ids as string[];
    const result = await batchUpdateWorkbenchTasks(
      ids,
      {
        ...(payload.status !== undefined && { status: payload.status as string }),
        ...(payload.assigneeId !== undefined && { assigneeId: payload.assigneeId as string | null }),
      },
      ctx.userId
    );
    const affectedIds = result.successCount > 0 ? ids.slice(0, 50) : [];
    return {
      resultSummary: `成功 ${result.successCount} 筆，失敗 ${result.failCount} 筆`,
      affectedIds: affectedIds.length ? affectedIds : undefined,
      affectedCount: result.successCount,
      resultMeta: {
        successCount: result.successCount,
        failCount: result.failCount,
        errors: result.errors.slice(0, 10),
      },
    };
  },
};
