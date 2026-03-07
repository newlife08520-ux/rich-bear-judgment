import type { AssetVersion } from "@shared/schema";
import { randomUUID } from "crypto";
import { parseVariantCodeFromFilename, variantCodeToGroupDisplayName } from "@shared/parse-asset-name";
import * as pkgRepo from "./asset-package-repository";
import * as groupRepo from "./asset-group-repository";
import * as groupService from "./asset-group-service";
import * as versionRepo from "./asset-version-repository";
import { assetVersionCreateSchema, assetVersionUpdateSchema } from "./asset-version.schema";

export function listByPackage(userId: string, packageId: string): AssetVersion[] {
  const pkg = pkgRepo.getById(userId, packageId);
  if (!pkg) return [];
  return versionRepo.listByPackageId(userId, packageId);
}

export function get(userId: string, versionId: string): AssetVersion | null {
  return versionRepo.getById(userId, versionId);
}

/**
 * 建立版本前必須確認 package 存在且屬於該 userId，權限由 package 所屬決定。
 */
export function create(
  userId: string,
  packageId: string,
  input: unknown
): { ok: true; data: AssetVersion } | { ok: false; message: string; errors?: unknown } {
  const pkg = pkgRepo.getById(userId, packageId);
  if (!pkg) {
    return { ok: false, message: "找不到該素材包或無權限" };
  }
  const withPackageId = { ...(typeof input === "object" && input !== null ? input : {}), packageId };
  const parsed = assetVersionCreateSchema.safeParse(withPackageId);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const now = new Date().toISOString();
  const thumbnailUrl =
    parsed.data.thumbnailUrl ??
    (parsed.data.assetType === "image" && parsed.data.fileUrl ? parsed.data.fileUrl : undefined);

  let groupId = parsed.data.groupId;
  let groupSource = parsed.data.groupSource;
  if (!groupId && parsed.data.fileName) {
    const variantCode = parseVariantCodeFromFilename(parsed.data.fileName);
    if (variantCode) {
      const displayName = variantCodeToGroupDisplayName(variantCode);
      const groups = groupRepo.listByPackageId(userId, packageId);
      const existing = groups.find((g) => g.name === displayName || g.variantCode === variantCode);
      if (existing) {
        groupId = existing.id;
        groupSource = "suggested";
      } else {
        const created = groupService.create(userId, packageId, {
          name: displayName,
          variantCode,
        });
        if (created.ok) {
          groupId = created.data.id;
          groupSource = "suggested";
        }
      }
    }
  }

  const version: AssetVersion = {
    id: randomUUID(),
    packageId,
    assetType: parsed.data.assetType,
    aspectRatio: parsed.data.aspectRatio,
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.fileUrl,
    fileType: parsed.data.fileType,
    storageProvider: parsed.data.storageProvider,
    versionNote: parsed.data.versionNote,
    isPrimary: parsed.data.isPrimary ?? false,
    thumbnailUrl,
    durationSeconds: parsed.data.durationSeconds ?? parsed.data.detectedDurationSeconds,
    fileSizeBytes: parsed.data.fileSizeBytes,
    createdAt: now,
    parsedAssetName: parsed.data.parsedAssetName,
    parsedVariantCode: parsed.data.parsedVariantCode,
    groupId: groupId ?? parsed.data.groupId,
    detectedWidth: parsed.data.detectedWidth,
    detectedHeight: parsed.data.detectedHeight,
    detectedAspectRatio: parsed.data.detectedAspectRatio,
    detectedDurationSeconds: parsed.data.detectedDurationSeconds,
    detectStatus: parsed.data.detectStatus,
    detectSource: parsed.data.detectSource,
    groupSource: groupSource ?? parsed.data.groupSource,
  };
  try {
    const created = versionRepo.create(userId, version);
    if (created.isPrimary) {
      versionRepo.setOthersNonPrimary(userId, packageId, created.id);
    }
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * 更新版本：僅能更新屬於該 userId 的版本（repository 依 userId 隔離）。
 */
export function update(
  userId: string,
  versionId: string,
  input: unknown
): { ok: true; data: AssetVersion } | { ok: false; message: string; errors?: unknown } {
  const existing = versionRepo.getById(userId, versionId);
  if (!existing) {
    return { ok: false, message: "找不到該素材版本或無權限" };
  }
  const parsed = assetVersionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  if (parsed.data.isPrimary === true) {
    versionRepo.setOthersNonPrimary(userId, existing.packageId, versionId);
  }
  // 僅在比例實際變更時允許更新 detectStatus/detectSource；其餘情況一律不寫入，避免誤覆蓋
  const patch = { ...parsed.data };
  const ratioActuallyChanged = patch.aspectRatio !== undefined && patch.aspectRatio !== existing.aspectRatio;
  if (!ratioActuallyChanged) {
    delete patch.detectStatus;
    delete patch.detectSource;
  }
  const updated = versionRepo.update(userId, versionId, patch);
  if (!updated) {
    return { ok: false, message: "更新失敗" };
  }
  return { ok: true, data: updated };
}

/**
 * 刪除版本：僅能刪除屬於該 userId 的版本。
 */
export function remove(userId: string, versionId: string): { ok: true } | { ok: false; message: string } {
  const found = versionRepo.getById(userId, versionId);
  if (!found) {
    return { ok: false, message: "找不到該素材版本或無權限" };
  }
  const deleted = versionRepo.remove(userId, versionId);
  if (!deleted) {
    return { ok: false, message: "刪除失敗" };
  }
  return { ok: true };
}
