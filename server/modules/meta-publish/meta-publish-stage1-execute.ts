/**
 * Stage1：單圖連結廣告、全 PAUSED；失敗時嘗試刪除已建立之 Campaign。
 */
import type { PublishDraft } from "@shared/schema";
import * as assetRepo from "../asset/asset-repository";
import * as assetVersionRepo from "../asset/asset-version-repository";
import type { MetaPublishStage1Result } from "./meta-publish-types";
import {
  createAdPaused,
  createAdSetPaused,
  createCampaignPaused,
  createLinkCreative,
  graphDelete,
  mapCtaTypeZhToMeta,
  mapObjectiveBundle,
  readImageBytesForMeta,
  toDailyBudgetMinorUnits,
  uploadAdImage,
} from "./meta-publish-graph-client";

function assertStage1DraftShape(d: PublishDraft): void {
  if (d.placementStrategy !== "auto") {
    throw new Error("Stage1 僅支援 Placement「自動」；請改為自動版位後再執行");
  }
  if (d.audienceStrategy !== "broad") {
    throw new Error("Stage1 僅支援受眾「廣泛」；自訂／再行銷等將於後續批次開放");
  }
  if (d.budgetDaily == null) {
    throw new Error("Stage1 需填寫「每日預算」（不支援僅總預算）");
  }
  const landing = String(d.landingPageUrl ?? "").trim();
  if (!landing) {
    throw new Error("請填寫落地頁網址（連結廣告必填）");
  }
}

function pickPrimaryImageFileUrl(
  userId: string,
  d: PublishDraft
): { fileUrl: string; primaryAssetVersionId?: string; warning?: string } {
  const vids = d.selectedVersionIds?.filter(Boolean) ?? [];
  if (vids.length >= 1) {
    const first = assetVersionRepo.getById(userId, vids[0]!);
    if (!first?.fileUrl) {
      throw new Error("所選素材版本缺少檔案 URL");
    }
    const w = vids.length > 1 ? "已選多個版本，Stage1 僅使用第一個版本的圖片" : undefined;
    return { fileUrl: first.fileUrl, primaryAssetVersionId: first.id, warning: w };
  }
  const aids = d.assetIds ?? [];
  if (aids.length >= 1) {
    const asset = assetRepo.getById(userId, aids[0]!);
    if (!asset?.fileUrl) {
      throw new Error("所選素材缺少檔案 URL（請改用素材包＋版本）");
    }
    const w = aids.length > 1 ? "已選多個素材，Stage1 僅使用第一筆的圖片" : undefined;
    return { fileUrl: asset.fileUrl, warning: w };
  }
  throw new Error("草稿缺少素材圖片來源");
}

export async function executeMetaPublishStage1(params: {
  userId: string;
  token: string;
  draft: PublishDraft;
}): Promise<MetaPublishStage1Result> {
  const { userId, token, draft: d } = params;
  assertStage1DraftShape(d);
  if (d.lastExecutionStatus === "success" && String(d.metaCampaignId ?? "").trim()) {
    throw new Error("此草稿已成功建立過 Meta 實體；請複製新草稿後再執行（避免重複建立）");
  }

  const { objective, optimizationGoal } = mapObjectiveBundle(d.campaignObjective);
  const { fileUrl, warning, primaryAssetVersionId } = pickPrimaryImageFileUrl(userId, d);
  const { bytes, filename } = await readImageBytesForMeta(userId, fileUrl);

  const ctaZh = String(d.cta ?? "了解更多").trim() || "了解更多";
  const ctaType = mapCtaTypeZhToMeta(ctaZh);
  const dailyMinor = toDailyBudgetMinorUnits(d.budgetDaily!);
  const pageId = String(d.pageId ?? "").trim();
  if (!pageId) throw new Error("缺少粉絲專頁 page_id");

  let campaignId: string | null = null;
  try {
    campaignId = await createCampaignPaused({
      adAccountId: d.accountId,
      token,
      name: d.campaignName,
      objective,
    });
    const adsetId = await createAdSetPaused({
      adAccountId: d.accountId,
      token,
      campaignId,
      name: d.adSetName,
      dailyBudgetMinor: dailyMinor,
      optimizationGoal,
    });
    const imageHash = await uploadAdImage(d.accountId, token, bytes, filename);
    const creativeId = await createLinkCreative({
      adAccountId: d.accountId,
      token,
      name: `${d.adName}-creative`,
      pageId,
      imageHash,
      link: String(d.landingPageUrl!).trim(),
      message: String(d.primaryCopy ?? "").trim(),
      headline: String(d.headline ?? "").trim(),
      ctaType,
    });
    const adId = await createAdPaused({
      adAccountId: d.accountId,
      token,
      name: d.adName,
      adsetId,
      creativeId,
    });

    const now = new Date().toISOString();
    return {
      metaCampaignId: campaignId,
      metaAdSetId: adsetId,
      metaCreativeId: creativeId,
      metaAdId: adId,
      rollbackSnapshot: {
        draftId: d.id,
        phase: "stage1_link_ad_paused",
        createdAt: now,
        graphIds: { campaignId, adSetId: adsetId, creativeId, adId },
      },
      warnings: warning ? [warning] : undefined,
      primaryAssetVersionId,
    };
  } catch (e) {
    if (campaignId) {
      try {
        await graphDelete(campaignId, token);
      } catch {
        /* best-effort rollback */
      }
    }
    throw e;
  }
}
