/**
 * 階段四：Meta API PAC (版位客製化) — asset_feed_spec 對應
 * 將單筆草稿 + 綁定之主素材組版本，轉成符合 Meta Graph API 的結構。
 * 比例對應：4:5、1:1、16:9 → feed；9:16 → story / reels。
 */

import type { AssetAspectRatio } from "./schema";

/** 單筆草稿 + 綁定之主素材組與版本（用於轉成 Meta 結構） */
export interface DraftWithGroupForMeta {
  draft: {
    id: string;
    assetPackageId?: string;
    selectedVersionIds?: string[];
    primaryCopy?: string;
    headline?: string;
    cta?: string;
    landingPageUrl?: string;
    pageId?: string;
    igAccountId?: string;
  };
  /** 該 draft 對應的主素材組內版本，已依比例分好 */
  versionsByRatio: Array<{
    versionId: string;
    aspectRatio: AssetAspectRatio;
    fileUrl: string;
    assetType: "image" | "video";
    thumbnailUrl?: string;
  }>;
}

/** Meta asset_feed_spec 中，單一影像資產（簡化） */
export interface MetaImageAsset {
  hash?: string;
  url?: string;
  adlabels?: Array<{ name: string }>;
}

/** Meta asset_feed_spec 中，單一影片資產（簡化） */
export interface MetaVideoAsset {
  video_id?: string;
  adlabels?: Array<{ name: string }>;
}

/** 我們內部的版位標籤：對應 Meta 的 asset_customization_rules */
export type MetaPlacementLabel = "feed" | "story_reels";

/** 我們內部的 build 結果（可再轉成 Meta 實際 asset_feed_spec JSON） */
export interface MetaAssetFeedSpecBuild {
  /** 依版位分組：4:5、1:1、16:9 → feed；9:16 → story_reels */
  images: {
    feed: MetaImageAsset[];
    story_reels: MetaImageAsset[];
  };
  videos: {
    feed: MetaVideoAsset[];
    story_reels: MetaVideoAsset[];
  };
  bodies: Array<{ text: string }>;
  titles: Array<{ text: string }>;
  link_urls: Array<{ website_url: string; display_url?: string }>;
  call_to_action_types: string[];
  placementLabels: Array<{
    placement: MetaPlacementLabel;
    image_label?: string;
    video_label?: string;
  }>;
}

const FEED_RATIOS: AssetAspectRatio[] = ["4:5", "1:1", "16:9"];
const STORY_REELS_RATIOS: AssetAspectRatio[] = ["9:16"];

function isFeedRatio(r: AssetAspectRatio): boolean {
  return FEED_RATIOS.includes(r);
}

function mapCtaToMeta(cta: string): string {
  const map: Record<string, string> = {
    來去逛逛: "SHOP_NOW",
    了解更多: "LEARN_MORE",
    立即購買: "SHOP_NOW",
    下單: "SHOP_NOW",
  };
  return map[cta] ?? "LEARN_MORE";
}

/**
 * 將單筆 Draft + 其綁定之主素材組版本，轉成符合 Meta asset_feed_spec 的結構（假函數）。
 * 實際呼叫 Meta 時需再：1) 上傳素材取得 hash / video_id；2) 組出完整 asset_feed_spec + asset_customization_rules。
 */
export function buildMetaAssetFeedSpec(input: DraftWithGroupForMeta): MetaAssetFeedSpecBuild {
  const { draft, versionsByRatio } = input;

  const imagesFeed: MetaImageAsset[] = [];
  const imagesStoryReels: MetaImageAsset[] = [];
  const videosFeed: MetaVideoAsset[] = [];
  const videosStoryReels: MetaVideoAsset[] = [];

  for (const v of versionsByRatio) {
    const placement: MetaPlacementLabel = isFeedRatio(v.aspectRatio) ? "feed" : "story_reels";
    const labelName = placement;

    if (v.assetType === "image") {
      const asset: MetaImageAsset = { url: v.fileUrl, adlabels: [{ name: labelName }] };
      if (placement === "feed") imagesFeed.push(asset);
      else imagesStoryReels.push(asset);
    } else {
      const asset: MetaVideoAsset = {
        video_id: "[UPLOAD_VIDEO_ID]",
        adlabels: [{ name: labelName }],
      };
      if (placement === "feed") videosFeed.push(asset);
      else videosStoryReels.push(asset);
    }
  }

  return {
    images: { feed: imagesFeed, story_reels: imagesStoryReels },
    videos: { feed: videosFeed, story_reels: videosStoryReels },
    bodies: draft.primaryCopy ? [{ text: draft.primaryCopy }] : [],
    titles: draft.headline ? [{ text: draft.headline }] : [],
    link_urls: draft.landingPageUrl
      ? [
          {
            website_url: draft.landingPageUrl,
            display_url: draft.landingPageUrl,
          },
        ]
      : [],
    call_to_action_types: draft.cta ? [mapCtaToMeta(draft.cta)] : ["LEARN_MORE"],
    placementLabels: [
      { placement: "feed", image_label: "feed", video_label: "feed" },
      { placement: "story_reels", image_label: "story_reels", video_label: "story_reels" },
    ],
  };
}

// ---------- Mock 資料示範 ----------
export const mockDraftWithGroup: DraftWithGroupForMeta = {
  draft: {
    id: "draft-1",
    assetPackageId: "pkg-1",
    selectedVersionIds: ["v-4-5", "v-9-16"],
    primaryCopy: "主文案",
    headline: "標題",
    cta: "來去逛逛",
    landingPageUrl: "https://example.com",
    pageId: "123",
    igAccountId: "456",
  },
  versionsByRatio: [
    {
      versionId: "v-4-5",
      aspectRatio: "4:5",
      fileUrl: "/api/uploads/1/a.jpg",
      assetType: "image",
    },
    {
      versionId: "v-9-16",
      aspectRatio: "9:16",
      fileUrl: "/api/uploads/1/b.mp4",
      assetType: "video",
    },
  ],
};

export const mockMetaSpec = buildMetaAssetFeedSpec(mockDraftWithGroup);
