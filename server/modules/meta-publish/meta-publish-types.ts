/** Stage1 建立結果（寫入 DB / resultMeta） */
export type MetaPublishStage1Result = {
  metaCampaignId: string;
  metaAdSetId: string;
  metaCreativeId: string;
  metaAdId: string;
  rollbackSnapshot: {
    draftId: string;
    phase: "stage1_link_ad_paused";
    createdAt: string;
    graphIds: { campaignId: string; adSetId: string; creativeId: string; adId: string };
  };
  warnings?: string[];
  /** Stage1 實際用於上傳圖的素材版本（多選時僅第一筆） */
  primaryAssetVersionId?: string;
};
