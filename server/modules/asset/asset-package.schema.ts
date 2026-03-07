import { z } from "zod";
import { assetAdObjectives, assetStatuses } from "@shared/schema";

/** 建立素材包的 Zod 驗證（Phase B：僅名稱必填，產品名稱可後補，廣告目的/狀態預設） */
export const assetPackageCreateSchema = z.object({
  name: z.string().min(1, "請填寫素材包名稱"),
  brandProductName: z.string().default(""),
  adObjective: z.enum(assetAdObjectives).default("sales"),
  primaryCopy: z.string().default(""),
  headline: z.string().default(""),
  cta: z.string().default(""),
  landingPageUrl: z
    .string()
    .default("")
    .refine((v) => v === "" || z.string().url().safeParse(v).success, {
      message: "請填寫有效的落地頁 URL",
    }),
  status: z.enum(assetStatuses).default("draft"),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const assetPackageUpdateSchema = assetPackageCreateSchema.partial();

export type AssetPackageCreateInput = z.infer<typeof assetPackageCreateSchema>;
export type AssetPackageUpdateInput = z.infer<typeof assetPackageUpdateSchema>;
