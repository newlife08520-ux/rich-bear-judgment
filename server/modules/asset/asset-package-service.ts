import type { AssetPackage } from "@shared/schema";
import { randomUUID } from "crypto";
import * as repo from "./asset-package-repository";
import * as versionRepo from "./asset-version-repository";
import * as groupRepo from "./asset-group-repository";
import {
  assetPackageCreateSchema,
  assetPackageUpdateSchema,
  type AssetPackageCreateInput,
  type AssetPackageUpdateInput,
} from "./asset-package.schema";

export function list(userId: string): AssetPackage[] {
  return repo.listByUserId(userId);
}

export function get(userId: string, id: string): AssetPackage | null {
  return repo.getById(userId, id);
}

export function create(
  userId: string,
  input: unknown
): { ok: true; data: AssetPackage } | { ok: false; message: string; errors?: unknown } {
  const parsed = assetPackageCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const now = new Date().toISOString();
  const brandProductName = (parsed.data.brandProductName ?? "").trim() || parsed.data.name;
  const pkg: AssetPackage = {
    id: randomUUID(),
    userId,
    ...parsed.data,
    brandProductName,
    landingPageUrl: parsed.data.landingPageUrl ?? "",
    createdAt: now,
    updatedAt: now,
  };
  try {
    const created = repo.create(userId, pkg);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function update(
  userId: string,
  id: string,
  input: unknown
): { ok: true; data: AssetPackage } | { ok: false; message: string; errors?: unknown } {
  const parsed = assetPackageUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const existing = repo.getById(userId, id);
  if (!existing) {
    return { ok: false, message: "找不到該素材包" };
  }
  const now = new Date().toISOString();
  const updated = repo.update(userId, id, { ...parsed.data, updatedAt: now });
  if (!updated) {
    return { ok: false, message: "更新失敗" };
  }
  return { ok: true, data: updated };
}

export function remove(userId: string, id: string): { ok: true } | { ok: false; message: string } {
  const found = repo.getById(userId, id);
  if (!found) {
    return { ok: false, message: "找不到該素材包" };
  }
  const versions = versionRepo.listByPackageId(userId, id);
  for (const v of versions) {
    versionRepo.remove(userId, v.id);
  }
  groupRepo.removeByPackageId(userId, id);
  const deleted = repo.remove(userId, id);
  if (!deleted) {
    return { ok: false, message: "刪除失敗" };
  }
  return { ok: true };
}
