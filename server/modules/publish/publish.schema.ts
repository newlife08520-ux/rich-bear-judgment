import { z } from "zod";
import {
  audienceStrategies,
  placementStrategies,
  publishStatuses,
} from "@shared/schema";

const positiveNumber = z.number().positive("必須為正數");

const publishDraftBaseSchema = z.object({
  accountId: z.string().min(1, "請選擇廣告帳號"),
  pageId: z.string().optional(),
  igAccountId: z.string().optional(),
  campaignObjective: z.string().min(1, "請填寫 campaign 目標"),
  campaignName: z.string().min(1, "請填寫 campaign 名稱"),
  adSetName: z.string().min(1, "請填寫 ad set 名稱"),
  adName: z.string().min(1, "請填寫 ad 名稱"),
  budgetDaily: positiveNumber.optional(),
  budgetTotal: positiveNumber.optional(),
  scheduleStart: z.string().optional(),
  scheduleEnd: z.string().optional(),
  audienceStrategy: z.enum(audienceStrategies),
  placementStrategy: z.enum(placementStrategies),
  /** 新邏輯：選定的素材包 ID */
  assetPackageId: z.string().optional(),
  /** 新邏輯：選定的素材版本 ID 列表（主要欄位） */
  selectedVersionIds: z.array(z.string()).optional(),
  /** @deprecated 過渡 fallback，請改用 selectedVersionIds + assetPackageId */
  assetIds: z.array(z.string()).optional(),
  /** 覆寫：主文案 / 標題 / 說明 / CTA / 落地頁（選填，未送則沿用素材包） */
  primaryCopy: z.string().optional(),
  headline: z.string().optional(),
  note: z.string().optional(),
  cta: z.string().optional(),
  landingPageUrl: z.string().optional(),
  status: z.enum(publishStatuses).optional().default("draft"),
  /** 同一批矩陣建稿共用之 UUID（選填，批次建立時由前端傳入） */
  batchId: z.string().uuid().optional(),
});

/** 至少選擇一種素材來源：新邏輯(包+版本) 或 舊邏輯(assetIds) */
const atLeastOneAssetSource = (data: {
  assetPackageId?: string;
  selectedVersionIds?: string[];
  assetIds?: string[];
}) =>
  (!!data.assetPackageId && (data.selectedVersionIds?.length ?? 0) >= 1) ||
  (data.assetIds?.length ?? 0) >= 1;

/** 建立投放草稿的 Zod 驗證 */
export const publishDraftCreateSchema = publishDraftBaseSchema
  .refine(
    (data) => data.budgetDaily != null || data.budgetTotal != null,
    { message: "請填寫每日預算或總預算", path: ["budgetDaily"] }
  )
  .refine(atLeastOneAssetSource, {
    message: "請選擇素材包與至少一筆素材版本，或至少一筆素材（過渡）",
    path: ["selectedVersionIds"],
  });

/** 更新時為 partial，且 .partial() 僅 ZodObject 有，故用 base */
export const publishDraftUpdateSchema = publishDraftBaseSchema.partial();

export type PublishDraftCreateInput = z.infer<typeof publishDraftCreateSchema>;
export type PublishDraftUpdateInput = z.infer<typeof publishDraftUpdateSchema>;
