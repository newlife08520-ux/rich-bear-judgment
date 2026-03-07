import { z } from "zod";
import { assetTypes, assetAspectRatios } from "@shared/schema";

const storageProviderSchema = z.enum(["local", "nas"]);

/** 建立素材版本的 Zod 驗證 */
export const assetVersionCreateSchema = z.object({
  packageId: z.string().min(1, "請指定素材包"),
  assetType: z.enum(assetTypes),
  aspectRatio: z.enum(assetAspectRatios),
  fileName: z.string().min(1, "請填寫檔名"),
  fileUrl: z.string().min(1, "請填寫檔案 URL"),
  fileType: z.string().min(1, "請填寫檔案類型"),
  storageProvider: storageProviderSchema.optional(),
  versionNote: z.string().optional(),
  isPrimary: z.boolean().default(false),
  thumbnailUrl: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  fileSizeBytes: z.number().int().min(0).optional(),
  parsedAssetName: z.string().optional(),
  parsedVariantCode: z.string().optional(),
  groupId: z.string().optional(),
  detectedWidth: z.number().int().min(0).optional(),
  detectedHeight: z.number().int().min(0).optional(),
  detectedAspectRatio: z.enum(assetAspectRatios).optional(),
  detectedDurationSeconds: z.number().int().min(0).optional(),
  detectStatus: z.enum(["success", "fallback", "failed", "manual_confirmed"]).optional(),
  detectSource: z.enum(["metadata", "filename", "manual"]).optional(),
  groupSource: z.enum(["suggested", "manual"]).optional(),
});

export const assetVersionUpdateSchema = assetVersionCreateSchema
  .omit({ packageId: true })
  .partial();

export type AssetVersionCreateInput = z.infer<typeof assetVersionCreateSchema>;
export type AssetVersionUpdateInput = z.infer<typeof assetVersionUpdateSchema>;
