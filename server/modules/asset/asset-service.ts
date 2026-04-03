import type { Asset } from "@shared/schema";
import { randomUUID } from "crypto";
import * as repo from "./asset-repository";
import { assetCreateSchema, assetUpdateSchema, type AssetCreateInput, type AssetUpdateInput } from "./asset.schema";

export function list(userId: string): Asset[] {
  return repo.listByUserId(userId);
}

export function get(userId: string, id: string): Asset | null {
  return repo.getById(userId, id);
}

export function create(userId: string, input: unknown): { ok: true; data: Asset } | { ok: false; message: string; errors?: unknown } {
  const parsed = assetCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const now = new Date().toISOString();
  const asset: Asset = {
    id: randomUUID(),
    userId,
    ...parsed.data,
    landingPageUrl: parsed.data.landingPageUrl ?? "",
    createdAt: now,
    updatedAt: now,
  };
  try {
    const created = repo.create(userId, asset);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function update(userId: string, id: string, input: unknown): { ok: true; data: Asset } | { ok: false; message: string; errors?: unknown } {
  const parsed = assetUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const existing = repo.getById(userId, id);
  if (!existing) {
    return { ok: false, message: "找不到該素材" };
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
    return { ok: false, message: "找不到該素材" };
  }
  const deleted = repo.remove(userId, id);
  if (!deleted) {
    return { ok: false, message: "刪除失敗" };
  }
  return { ok: true };
}
