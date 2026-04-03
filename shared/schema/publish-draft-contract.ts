/**
 * 投放草稿／範本共用契約（從 schema.ts 拆出，主檔 re-export 保持 import 路徑不變）。
 */

/** 受眾策略 */
export const audienceStrategies = ["broad", "remarketing", "custom"] as const;
export type AudienceStrategy = (typeof audienceStrategies)[number];

export const audienceStrategyLabels: Record<AudienceStrategy, string> = {
  broad: "廣泛",
  remarketing: "再行銷",
  custom: "自訂",
};

/** Placement 策略 */
export const placementStrategies = ["auto", "feeds_only", "reels_stories"] as const;
export type PlacementStrategy = (typeof placementStrategies)[number];

export const placementStrategyLabels: Record<PlacementStrategy, string> = {
  auto: "自動",
  feeds_only: "動態牆",
  reels_stories: "Reels + Stories",
};

/** 投放草稿狀態 */
export const publishStatuses = ["draft", "ready", "published", "failed"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

export const publishStatusLabels: Record<PublishStatus, string> = {
  draft: "草稿",
  ready: "待發佈",
  published: "已發佈",
  failed: "失敗",
};

/** 投放草稿 (PublishDraft) */
export interface PublishDraft {
  id: string;
  userId: string;
  accountId: string;
  pageId?: string;
  igAccountId?: string;
  campaignObjective: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  budgetDaily?: number;
  budgetTotal?: number;
  scheduleStart?: string;
  scheduleEnd?: string;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  /** 選定的素材包 ID，用於帶入主文案/標題/CTA/落地頁（第一版一個 draft 只選一個包） */
  assetPackageId?: string;
  /** 選定的素材版本 ID 列表（可多個，同包底下多版本） */
  selectedVersionIds?: string[];
  /**
   * @deprecated 遷移過渡用。請改用 selectedVersionIds。migration 後由 selectedVersionIds 取代。
   */
  assetIds: string[];
  /** 覆寫：主文案（未設則沿用素材包） */
  primaryCopy?: string;
  /** 覆寫：標題（未設則沿用素材包） */
  headline?: string;
  /** 覆寫：說明/備註（未設則沿用素材包） */
  note?: string;
  /** 覆寫：CTA（未設則沿用素材包） */
  cta?: string;
  /** 覆寫：落地頁網址（未設則沿用素材包） */
  landingPageUrl?: string;
  status: PublishStatus;
  /** 同一批矩陣建稿共用之 UUID，供一鍵撤回/刪除整批草稿 */
  batchId?: string;
  createdAt: string;
  updatedAt: string;
  /** Meta Stage1 execution：最近一次狀態（success / failed 等） */
  lastExecutionStatus?: string | null;
  lastExecutionAt?: string | null;
  /** 人類可讀摘要或 JSON 字串（依實作） */
  lastExecutionSummary?: string | null;
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  metaAdId?: string | null;
  metaCreativeId?: string | null;
}

/** 投放紀錄 (PublishLog，最小可用：id, userId, draftId, status, message, createdAt) */
export interface PublishLog {
  id: string;
  userId: string;
  draftId: string;
  status: string;
  message: string;
  createdAt: string;
  /** 以下選填，方便列表顯示 */
  name?: string;
  accountId?: string;
  campaignObjective?: string;
  audienceStrategy?: string;
  placementStrategy?: string;
}

/** 投放範本：預算、受眾、CTA、網址、命名規則等，建立草稿時可載入 */
export interface PublishTemplate {
  id: string;
  userId: string;
  name: string;
  accountId?: string;
  pageId?: string;
  igAccountId?: string;
  budgetDaily?: number;
  budgetTotal?: number;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  cta?: string;
  landingPageUrl?: string;
  /** 命名範本，支援 {product} {date} {ratio} {seq} {prefix} */
  campaignNameTemplate?: string;
  adSetNameTemplate?: string;
  adNameTemplate?: string;
  createdAt: string;
}
