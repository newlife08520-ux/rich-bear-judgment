import type { AssetGroup } from "@shared/schema";
import { randomUUID } from "crypto";
import * as pkgRepo from "./asset-package-repository";
import * as groupRepo from "./asset-group-repository";
import * as versionRepo from "./asset-version-repository";

export function listByPackage(userId: string, packageId: string): AssetGroup[] {
  const pkg = pkgRepo.getById(userId, packageId);
  if (!pkg) return [];
  return groupRepo.listByPackageId(userId, packageId);
}

export function get(userId: string, groupId: string): AssetGroup | null {
  return groupRepo.getById(userId, groupId);
}

export function create(
  userId: string,
  packageId: string,
  input: { name: string; variantCode?: string; displayOrder?: number }
): { ok: true; data: AssetGroup } | { ok: false; message: string } {
  const pkg = pkgRepo.getById(userId, packageId);
  if (!pkg) {
    return { ok: false, message: "找不到該素材包或無權限" };
  }
  const name = (input.name ?? "").trim();
  if (!name) {
    return { ok: false, message: "請填寫主素材組名稱" };
  }
  const now = new Date().toISOString();
  const group: AssetGroup = {
    id: randomUUID(),
    packageId,
    name,
    variantCode: input.variantCode?.trim() || undefined,
    displayOrder: input.displayOrder,
    createdAt: now,
  };
  try {
    const created = groupRepo.create(userId, group);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function update(
  userId: string,
  groupId: string,
  input: { name?: string; variantCode?: string; displayOrder?: number }
): { ok: true; data: AssetGroup } | { ok: false; message: string } {
  const existing = groupRepo.getById(userId, groupId);
  if (!existing) {
    return { ok: false, message: "找不到該主素材組" };
  }
  const patch: Partial<Omit<AssetGroup, "id" | "packageId" | "createdAt">> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.variantCode !== undefined) patch.variantCode = input.variantCode.trim() || undefined;
  if (input.displayOrder !== undefined) patch.displayOrder = input.displayOrder;
  const updated = groupRepo.update(userId, groupId, patch);
  if (!updated) return { ok: false, message: "更新失敗" };
  return { ok: true, data: updated };
}

/** 刪除主素材組：規則 A — 若底下仍有版本則阻擋，須先將版本改為未分組或移到其他組 */
export function remove(userId: string, groupId: string): { ok: true } | { ok: false; message: string } {
  const existing = groupRepo.getById(userId, groupId);
  if (!existing) {
    return { ok: false, message: "找不到該主素材組" };
  }
  const versionsInPackage = versionRepo.listByPackageId(userId, existing.packageId);
  const stillAttached = versionsInPackage.filter((v) => v.groupId === groupId);
  if (stillAttached.length > 0) {
    return {
      ok: false,
      message: "此主素材組底下仍有版本，請先將版本改為未分組或移到其他組後再刪除",
    };
  }
  const deleted = groupRepo.remove(userId, groupId);
  if (!deleted) return { ok: false, message: "刪除失敗" };
  return { ok: true };
}
