import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import { allowMetaWrites, META_WRITES_DISABLED_MESSAGE } from "../../meta-execution/meta-execution-guard";
import { validateCampaignBudget } from "../../meta-execution/meta-execution-schemas";
import { updateCampaignBudget } from "../../meta-execution/meta-execution-client";
import { storage } from "../../../storage";

const ACTION_TYPE = "meta_campaign_update_budget";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  validateCampaignBudget(payload);
}

export const metaCampaignUpdateBudgetHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const id = String(payload.campaignId).slice(0, 20);
    const daily = payload.budgetDaily != null ? Number(payload.budgetDaily) : undefined;
    const total = payload.budgetTotal != null ? Number(payload.budgetTotal) : undefined;
    const desc = daily != null ? `每日 ${daily}` : total != null ? `總預算 ${total}` : "預算";
    return {
      summary: `更新 Meta 廣告活動預算：${id}…（${desc}）`,
      steps: [
        "1. 驗證 campaignId 與 budgetDaily/budgetTotal",
        "2. 呼叫 Meta Graph API 更新 daily_budget 或 lifetime_budget",
        "3. 回傳結果與 rollback 快照",
      ],
      meta: { campaignId: String(payload.campaignId), budgetDaily: daily, budgetTotal: total },
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
    const budgetDaily = payload.budgetDaily != null ? Number(payload.budgetDaily) : undefined;
    const budgetTotal = payload.budgetTotal != null ? Number(payload.budgetTotal) : undefined;
    const result = await updateCampaignBudget(token, campaignId, budgetDaily, budgetTotal);
    if (!result.success) {
      throw new Error(result.message ?? "更新預算失敗");
    }
    return {
      resultSummary: result.message ?? "已更新預算",
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
