import type {
  AudienceStrategy,
  PlacementStrategy,
  PublishStatus,
} from "@shared/schema";

export type FormState = {
  accountId: string;
  pageId: string;
  igAccountId: string;
  campaignObjective: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  budgetDaily: string;
  budgetTotal: string;
  scheduleType: "immediate" | "custom";
  scheduleStart: string;
  scheduleEnd: string;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  assetPackageId: string;
  selectedVersionIds: string[];
  primaryCopy: string;
  headline: string;
  note: string;
  cta: string;
  landingPageUrl: string;
  status: PublishStatus;
  objectivePrefix: string;
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  audienceCodesComma: string;
};

export const emptyForm: FormState = {
  accountId: "",
  pageId: "",
  igAccountId: "",
  campaignObjective: "轉換",
  campaignName: "",
  adSetName: "",
  adName: "",
  budgetDaily: "",
  budgetTotal: "",
  scheduleType: "immediate",
  scheduleStart: "",
  scheduleEnd: "",
  audienceStrategy: "broad",
  placementStrategy: "auto",
  assetPackageId: "",
  selectedVersionIds: [],
  primaryCopy: "",
  headline: "",
  note: "",
  cta: "來去逛逛",
  landingPageUrl: "",
  status: "draft",
  objectivePrefix: "轉換次數(原始)",
  productName: "",
  materialStrategy: "",
  headlineSnippet: "",
  audienceCodesComma: "",
};

export type BatchGroupByAsset = {
  groupKey: string;
  label: string;
  versionIds: string[];
  count: number;
  ratios: string[];
  isFallback: boolean;
  versions: import("@shared/schema").AssetVersion[];
};
