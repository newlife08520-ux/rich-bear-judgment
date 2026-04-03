import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import * as publishService from "../../publish/publish-service";

const ACTION_TYPE = "publish_draft_create";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const p = payload as Record<string, unknown>;
  if (!p.accountId || !p.pageId) throw new Error("accountId / pageId 必填");
  if (!Array.isArray(p.selectedVersionIds) || p.selectedVersionIds.length === 0) {
    if (!Array.isArray(p.assetIds) || p.assetIds.length === 0) throw new Error("selectedVersionIds 或 assetIds 必填且非空");
  }
  if (p.budgetDaily == null && p.budgetTotal == null) throw new Error("請填寫每日預算或總預算");
}

export const publishDraftCreateHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const name = String(payload.campaignName ?? "").slice(0, 60);
    return {
      summary: `建立投放草稿：${name || "(未命名)"}`,
      steps: [
        "1. 驗證 payload（帳號／粉專／素材／預算）",
        "2. 寫入投放草稿與 log",
        "3. 回傳新草稿 id",
      ],
      meta: { campaignName: String(payload.campaignName).slice(0, 100) },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    const result = await publishService.createDraft(ctx.userId, payload);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return {
      resultSummary: `已建立投放草稿：${result.data.campaignName ?? result.data.id}`,
      affectedIds: [result.data.id],
      affectedCount: 1,
      resultMeta: { draftId: result.data.id, warnings: result.warnings },
    };
  },
};
