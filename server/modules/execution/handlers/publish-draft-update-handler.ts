import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import * as publishService from "../../publish/publish-service";

const ACTION_TYPE = "publish_draft_update";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.draftId !== "string" || !p.draftId.trim()) throw new Error("draftId 必填");
}

export const publishDraftUpdateHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const draftId = String(payload.draftId).slice(0, 12);
    return {
      summary: `更新投放草稿：${draftId}…`,
      steps: [
        "1. 驗證 draftId 與更新欄位",
        "2. 更新草稿與 log",
        "3. 回傳更新後草稿",
      ],
      meta: { draftId: String(payload.draftId) },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    const draftId = String(payload.draftId).trim();
    const { draftId: _id, ...updateBody } = payload;
    const result = await publishService.updateDraft(ctx.userId, draftId, updateBody);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return {
      resultSummary: `已更新投放草稿：${result.data.campaignName ?? draftId}`,
      affectedIds: [draftId],
      affectedCount: 1,
      resultMeta: { draftId },
    };
  },
};
