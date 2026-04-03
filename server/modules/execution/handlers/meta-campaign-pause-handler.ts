import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import { allowMetaWrites, META_WRITES_DISABLED_MESSAGE } from "../../meta-execution/meta-execution-guard";
import { validateCampaignId } from "../../meta-execution/meta-execution-schemas";
import { pauseCampaign } from "../../meta-execution/meta-execution-client";
import { storage } from "../../../storage";

const ACTION_TYPE = "meta_campaign_pause";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  validateCampaignId(payload);
}

export const metaCampaignPauseHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const id = String(payload.campaignId).slice(0, 20);
    return {
      summary: `暫停 Meta 廣告活動：${id}…`,
      steps: [
        "1. 驗證 campaignId",
        "2. 呼叫 Meta Graph API 將 status 設為 PAUSED",
        "3. 回傳結果與 rollback 快照",
      ],
      meta: { campaignId: String(payload.campaignId) },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    if (!allowMetaWrites()) {
      throw new Error(META_WRITES_DISABLED_MESSAGE);
    }
    const token = storage.getSettings(ctx.userId).fbAccessToken?.trim();
    if (!token) {
      throw new Error("未設定 Meta 存取權杖");
    }
    const campaignId = String(payload.campaignId).trim();
    const result = await pauseCampaign(token, campaignId);
    if (!result.success) {
      throw new Error(result.message ?? "pause 失敗");
    }
    return {
      resultSummary: result.message ?? "已暫停",
      affectedIds: [campaignId],
      affectedCount: 1,
      resultMeta: {
        rollbackSnapshot: result.rollbackSnapshot,
        campaignId,
        campaignName: typeof payload.campaignName === "string" ? payload.campaignName : undefined,
        entityKeys: [`campaign:${campaignId}`],
      },
    };
  },
};
