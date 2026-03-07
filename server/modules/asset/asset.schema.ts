import { z } from "zod";
import {
  assetAdObjectives,
  assetTypes,
  assetAspectRatios,
  assetStatuses,
} from "@shared/schema";

/** 建立/更新素材的 Zod 驗證 */
export const assetCreateSchema = z.object({
  name: z.string().min(1, "請填寫素材名稱"),
  brandProductName: z.string().min(1, "請填寫品牌/產品名稱"),
  adObjective: z.enum(assetAdObjectives),
  primaryCopy: z.string(),
  headline: z.string(),
  cta: z.string(),
  landingPageUrl: z
    .string()
    .default("")
    .refine((v) => v === "" || z.string().url().safeParse(v).success, {
      message: "請填寫有效的落地頁 URL",
    }),
  assetType: z.enum(assetTypes),
  aspectRatio: z.enum(assetAspectRatios),
  fileName: z.string().optional(),
  fileUrl: z.string().optional(),
  fileType: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(assetStatuses),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
