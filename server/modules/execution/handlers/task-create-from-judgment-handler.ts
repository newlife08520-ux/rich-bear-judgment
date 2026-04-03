import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import { createWorkbenchTask } from "../../../workbench-db";

const ACTION_TYPE = "task_create_from_judgment";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title.trim()) throw new Error("title 必填");
  if (typeof p.action !== "string" || !p.action.trim()) throw new Error("action 必填");
  if (typeof p.reason !== "string" || !p.reason.trim()) throw new Error("reason 必填");
}

export const taskCreateFromJudgmentHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const title = String(payload.title ?? "").slice(0, 80);
    return {
      summary: `從審判官建立任務：${title}`,
      steps: [
        "1. 驗證 payload（title / action / reason）",
        "2. 寫入 workbench_task 與 audit",
        "3. 回傳新任務 id",
      ],
      meta: { title: String(payload.title).slice(0, 100) },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    const task = await createWorkbenchTask({
      productName: typeof payload.productName === "string" ? payload.productName : undefined,
      creativeId: typeof payload.creativeId === "string" ? payload.creativeId : undefined,
      draftId: payload.draftId != null ? String(payload.draftId) : undefined,
      reviewSessionId: payload.reviewSessionId != null ? String(payload.reviewSessionId) : undefined,
      title: String(payload.title).trim(),
      action: String(payload.action).trim(),
      reason: String(payload.reason).trim(),
      assigneeId: payload.assigneeId != null ? (payload.assigneeId as string | null) : null,
      status: "unassigned",
      createdBy: ctx.userId,
      notes: typeof payload.notes === "string" ? payload.notes : "",
      taskSource: "judgment",
      priority: typeof payload.priority === "string" ? payload.priority : undefined,
      dueDate: typeof payload.dueDate === "string" ? payload.dueDate : undefined,
      impactAmount: payload.impactAmount != null ? String(payload.impactAmount) : undefined,
      taskType: typeof payload.taskType === "string" ? payload.taskType : undefined,
    });
    return {
      resultSummary: `已建立任務：${task.title}`,
      affectedIds: [task.id],
      affectedCount: 1,
      resultMeta: { taskId: task.id },
    };
  },
};
