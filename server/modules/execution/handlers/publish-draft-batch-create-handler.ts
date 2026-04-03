import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import * as publishService from "../../publish/publish-service";

const ACTION_TYPE = "publish_draft_batch_create";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.batchId !== "string" || !p.batchId.trim()) throw new Error("batchId 必填");
  if (!Array.isArray(p.drafts) || p.drafts.length === 0) throw new Error("drafts 必填且為非空陣列");
}

export const publishDraftBatchCreateHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const drafts = payload.drafts as unknown[];
    return {
      summary: `批次建立 ${drafts.length} 筆投放草稿（batchId: ${String(payload.batchId).slice(0, 8)}…）`,
      steps: [
        "1. 驗證 batchId 與 drafts 陣列",
        "2. 逐筆建立草稿與 log",
        "3. 回傳 batchId 與新草稿 id 列表",
      ],
      meta: { batchId: String(payload.batchId), count: drafts.length },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    const batchId = String(payload.batchId).trim();
    const drafts = payload.drafts as unknown[];
    const result = await publishService.createDraftBatch(ctx.userId, { batchId, drafts });
    if (!result.ok) {
      throw new Error(result.message);
    }
    const ids = result.data.drafts.map((d) => d.id);
    return {
      resultSummary: `已建立 ${ids.length} 筆投放草稿`,
      affectedIds: ids,
      affectedCount: ids.length,
      resultMeta: { batchId, draftIds: ids, warnings: result.warnings },
    };
  },
};
