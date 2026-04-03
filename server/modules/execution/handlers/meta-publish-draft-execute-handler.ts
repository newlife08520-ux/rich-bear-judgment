/**
 * Publish 草稿 → Meta：Stage1（人工核准 + EXECUTION_ALLOW_META_WRITES + META_PUBLISH_STAGE1_ENABLED）
 * 建立 PAUSED Campaign / AdSet / Creative / Ad（單圖連結廣告）；失敗時 best-effort 刪除 Campaign。
 */
import type { IExecutionHandler, ExecutionContext, PreviewResult, ApplyResult } from "../execution-handler-types";
import { storage } from "../../../storage";
import * as publishService from "../../publish/publish-service";
import {
  allowMetaWrites,
  META_WRITES_DISABLED_MESSAGE,
} from "../../meta-execution/meta-execution-guard";
import { assertMetaPublishStage1Allowed } from "../../meta-publish/meta-publish-guard";
import { executeMetaPublishStage1 } from "../../meta-publish/meta-publish-stage1-execute";

const ACTION_TYPE = "meta_publish_draft_execute";

function validate(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload 必須為物件");
  }
  const draftId = String((payload as { draftId?: unknown }).draftId ?? "").trim();
  if (!draftId) throw new Error("draftId 必填");
}

function assertDraftComplete(d: {
  accountId: string;
  pageId?: string;
  campaignName: string;
  budgetDaily?: number;
  budgetTotal?: number;
  selectedVersionIds?: string[];
  assetIds: string[];
}): void {
  if (!String(d.accountId ?? "").trim()) throw new Error("草稿缺少廣告帳號");
  if (!String(d.pageId ?? "").trim()) throw new Error("草稿缺少粉絲專頁");
  if (!String(d.campaignName ?? "").trim()) throw new Error("草稿缺少 Campaign 名稱");
  const hasVersions = Array.isArray(d.selectedVersionIds) && d.selectedVersionIds.length > 0;
  const hasAssets = Array.isArray(d.assetIds) && d.assetIds.length > 0;
  if (!hasVersions && !hasAssets) throw new Error("草稿需至少一筆素材版本或 assetIds");
  if (d.budgetDaily == null && d.budgetTotal == null) throw new Error("草稿需填寫每日或總預算");
}

export const metaPublishDraftExecuteHandler: IExecutionHandler = {
  actionType: ACTION_TYPE,
  validate,
  buildPreview(payload: Record<string, unknown>, _ctx: ExecutionContext): PreviewResult {
    const id = String(payload.draftId ?? "").slice(0, 24);
    return {
      summary: `將以 Stage1 建立 Meta PAUSED 連結廣告（Campaign/AdSet/Creative/Ad）：${id}…`,
      steps: [
        "1. 自 DB 讀取草稿並檢查 Stage1 限制（自動版位、廣泛受眾、每日預算、落地頁）",
        "2. 確認 EXECUTION_ALLOW_META_WRITES、META_PUBLISH_STAGE1_ENABLED、Access Token（及選用之帳號 allowlist）",
        "3. apply：上傳單圖、建立 Graph 實體（全 PAUSED），並將 external id 寫回 PublishDraft",
      ],
      meta: { draftId: String(payload.draftId ?? "") },
    };
  },
  async apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult> {
    if (!allowMetaWrites()) {
      throw new Error(META_WRITES_DISABLED_MESSAGE);
    }
    const draftId = String(payload.draftId ?? "").trim();
    const draft = await publishService.getDraft(ctx.userId, draftId);
    if (!draft) {
      throw new Error("找不到草稿或無權限");
    }
    assertMetaPublishStage1Allowed(draft.accountId);
    assertDraftComplete(draft);

    const token = storage.getSettings(ctx.userId).fbAccessToken?.trim();
    if (!token) {
      throw new Error("未設定 Meta 存取權杖");
    }

    try {
      const stage1 = await executeMetaPublishStage1({ userId: ctx.userId, token, draft });
      const saved = await publishService.saveMetaPublishStage1Success(ctx.userId, draft.id, stage1);
      if (!saved) {
        throw new Error("寫回草稿失敗（請重試或檢查 DB）");
      }
      const warnText =
        stage1.warnings?.length ? `（注意：${stage1.warnings.join("；")}）` : "";
      return {
        resultSummary: `Meta Publish Stage1 完成：已建立 PAUSED 實體並寫回草稿。Campaign=${stage1.metaCampaignId}${warnText}`,
        affectedIds: [draft.id, stage1.metaCampaignId],
        affectedCount: 2,
        resultMeta: {
          draftId: draft.id,
          campaignName: draft.campaignName,
          accountId: draft.accountId,
          metaCampaignId: stage1.metaCampaignId,
          metaAdSetId: stage1.metaAdSetId,
          metaCreativeId: stage1.metaCreativeId,
          metaAdId: stage1.metaAdId,
          rollbackSnapshot: stage1.rollbackSnapshot,
          warnings: stage1.warnings,
          entityKeys: [
            `campaign:${stage1.metaCampaignId}`,
            ...(stage1.metaAdSetId ? [`adset:${stage1.metaAdSetId}`] : []),
          ],
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await publishService.saveMetaPublishStage1Failure(ctx.userId, draft.id, msg);
      throw e;
    }
  },
};
