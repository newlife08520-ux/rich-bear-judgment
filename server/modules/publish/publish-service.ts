import type { PublishDraft, PublishLog } from "@shared/schema";
import { randomUUID } from "crypto";
import * as assetRepo from "../asset/asset-repository";
import * as assetVersionRepo from "../asset/asset-version-repository";
import * as repo from "./publish-repository";
import { publishDraftCreateSchema, publishDraftUpdateSchema } from "./publish.schema";

/** 與前端一致：合法 CTA，不合法時 fallback 為「來去逛逛」 */
const META_CTA_OPTIONS = [
  "來去逛逛", "了解更多", "立即購買", "註冊", "聯絡我們", "下載", "申請 now", "訂閱", "領取優惠", "立即預約",
];

/** 用於區分 404（找不到/無權限）與 400（驗證錯誤） */
export type DraftResult =
  | { ok: true; data: PublishDraft; warnings?: string[] }
  | { ok: false; message: string; errors?: unknown; notFound?: boolean };

export function listDrafts(userId: string): PublishDraft[] {
  return repo.listDraftsByUserId(userId);
}

export function getDraft(userId: string, id: string): PublishDraft | null {
  return repo.getDraftById(userId, id);
}

/** 檢查 assetIds 皆存在且屬於當前 userId（僅 fallback 用） */
function ensureAssetsExist(userId: string, assetIds: string[]): { ok: false; message: string } | { ok: true } {
  for (const assetId of assetIds) {
    const asset = assetRepo.getById(userId, assetId);
    if (!asset) {
      return { ok: false, message: `素材不存在或無權限：${assetId}` };
    }
  }
  return { ok: true };
}

/** 檢查 selectedVersionIds 皆存在且屬於當前 userId（新邏輯主要驗證） */
function ensureVersionsExist(userId: string, versionIds: string[]): { ok: false; message: string } | { ok: true } {
  for (const versionId of versionIds) {
    const version = assetVersionRepo.getById(userId, versionId);
    if (!version) {
      return { ok: false, message: `素材版本不存在或無權限：${versionId}` };
    }
  }
  return { ok: true };
}

function buildDraftAssetFields(parsed: {
  assetPackageId?: string;
  selectedVersionIds?: string[];
  assetIds?: string[];
}): Pick<PublishDraft, "assetPackageId" | "selectedVersionIds" | "assetIds"> {
  if (parsed.selectedVersionIds && parsed.selectedVersionIds.length >= 1) {
    return {
      assetPackageId: parsed.assetPackageId ?? undefined,
      selectedVersionIds: parsed.selectedVersionIds,
      assetIds: [],
    };
  }
  return {
    assetPackageId: undefined,
    selectedVersionIds: undefined,
    assetIds: parsed.assetIds ?? [],
  };
}

export function createDraft(userId: string, input: unknown): DraftResult {
  const parsed = publishDraftCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const assetFields = buildDraftAssetFields(parsed.data);
  let versionIdsForValidation: string[] = [];
  if (assetFields.selectedVersionIds && assetFields.selectedVersionIds.length >= 1) {
    const versionsCheck = ensureVersionsExist(userId, assetFields.selectedVersionIds);
    if (!versionsCheck.ok) {
      return { ok: false, message: versionsCheck.message, notFound: true };
    }
    versionIdsForValidation = assetFields.selectedVersionIds;
    const versions = versionIdsForValidation.map((id) => assetVersionRepo.getById(userId, id)).filter(Boolean);
    const missingRatio = versions.some((v) => !v!.aspectRatio);
    if (missingRatio) {
      return { ok: false, message: "所選素材版本須皆有比例（aspectRatio）" };
    }
  } else {
    const assetsCheck = ensureAssetsExist(userId, assetFields.assetIds ?? []);
    if (!assetsCheck.ok) {
      return { ok: false, message: assetsCheck.message, notFound: true };
    }
  }

  let ctaValue = (parsed.data.cta ?? "").trim() || "來去逛逛";
  if (!ctaValue || !META_CTA_OPTIONS.includes(ctaValue)) {
    ctaValue = "來去逛逛";
  }

  const now = new Date().toISOString();
  const draft: PublishDraft = {
    id: randomUUID(),
    userId,
    batchId: parsed.data.batchId,
    accountId: parsed.data.accountId,
    pageId: parsed.data.pageId,
    igAccountId: parsed.data.igAccountId,
    campaignObjective: parsed.data.campaignObjective,
    campaignName: parsed.data.campaignName,
    adSetName: parsed.data.adSetName,
    adName: parsed.data.adName,
    budgetDaily: parsed.data.budgetDaily,
    budgetTotal: parsed.data.budgetTotal,
    scheduleStart: parsed.data.scheduleStart,
    scheduleEnd: parsed.data.scheduleEnd,
    audienceStrategy: parsed.data.audienceStrategy,
    placementStrategy: parsed.data.placementStrategy,
    ...assetFields,
    primaryCopy: parsed.data.primaryCopy,
    headline: parsed.data.headline,
    note: parsed.data.note,
    cta: ctaValue,
    landingPageUrl: parsed.data.landingPageUrl,
    status: parsed.data.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  };
  try {
    const created = repo.createDraft(userId, draft);
    const log: PublishLog = {
      id: randomUUID(),
      userId,
      draftId: created.id,
      status: created.status,
      message: "建立草稿",
      createdAt: now,
    };
    repo.appendLog(userId, log);

    // 建立草稿的 warnings 僅由此處產出，前端 toast 只顯示此陣列，不另算
    const warnings: string[] = [];
    if (versionIdsForValidation.length >= 1) {
      const versions = versionIdsForValidation
        .map((id) => assetVersionRepo.getById(userId, id))
        .filter((v): v is NonNullable<typeof v> => !!v);
      const ratios = Array.from(new Set(versions.map((v) => v.aspectRatio)));
      if (ratios.length <= 1) {
        warnings.push("僅單一尺寸，建議補齊多比例");
      }
    }

    return { ok: true, data: created, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function updateDraft(userId: string, id: string, input: unknown): DraftResult {
  const parsed = publishDraftUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "驗證失敗",
      errors: parsed.error.flatten(),
    };
  }
  const existing = repo.getDraftById(userId, id);
  if (!existing) {
    return { ok: false, message: "找不到該投放草稿", notFound: true };
  }
  const merged = {
    assetPackageId: parsed.data.assetPackageId ?? existing.assetPackageId,
    selectedVersionIds: parsed.data.selectedVersionIds ?? existing.selectedVersionIds,
    assetIds: parsed.data.assetIds ?? existing.assetIds,
  };
  const hasNewPath = merged.selectedVersionIds && merged.selectedVersionIds.length >= 1;
  const hasFallbackPath = merged.assetIds && merged.assetIds.length >= 1;
  if (!hasNewPath && !hasFallbackPath) {
    return { ok: false, message: "請至少選擇一筆素材版本或一筆素材（過渡）" };
  }
  let assetFields: Pick<PublishDraft, "assetPackageId" | "selectedVersionIds" | "assetIds">;
  if (hasNewPath) {
    const versionsCheck = ensureVersionsExist(userId, merged.selectedVersionIds!);
    if (!versionsCheck.ok) {
      return { ok: false, message: versionsCheck.message, notFound: true };
    }
    assetFields = {
      assetPackageId: merged.assetPackageId,
      selectedVersionIds: merged.selectedVersionIds,
      assetIds: [],
    };
  } else {
    const assetsCheck = ensureAssetsExist(userId, merged.assetIds!);
    if (!assetsCheck.ok) {
      return { ok: false, message: assetsCheck.message, notFound: true };
    }
    assetFields = {
      assetPackageId: undefined,
      selectedVersionIds: undefined,
      assetIds: merged.assetIds!,
    };
  }
  if (parsed.data.budgetDaily != null || parsed.data.budgetTotal != null) {
    const nextDaily = parsed.data.budgetDaily ?? existing.budgetDaily;
    const nextTotal = parsed.data.budgetTotal ?? existing.budgetTotal;
    if (nextDaily == null && nextTotal == null) {
      return { ok: false, message: "請填寫每日預算或總預算" };
    }
  }
  const now = new Date().toISOString();
  const patch = {
    ...parsed.data,
    ...assetFields,
    updatedAt: now,
  };
  const updated = repo.updateDraft(userId, id, patch);
  if (!updated) {
    return { ok: false, message: "更新失敗" };
  }
  const log: PublishLog = {
    id: randomUUID(),
    userId,
    draftId: id,
    status: updated.status,
    message: "更新草稿",
    createdAt: now,
  };
  repo.appendLog(userId, log);
  return { ok: true, data: updated };
}

export function listLogs(userId: string): PublishLog[] {
  return repo.listLogsByUserId(userId);
}

/** 批次建立草稿：共用同一 batchId，供一鍵撤回整批使用 */
export function createDraftBatch(
  userId: string,
  input: { batchId: string; drafts: unknown[] }
): { ok: true; data: { batchId: string; drafts: PublishDraft[] }; warnings?: string[] } | { ok: false; message: string; errors?: unknown; notFound?: boolean } {
  const { batchId, drafts } = input;
  if (!batchId || !Array.isArray(drafts) || drafts.length === 0) {
    return { ok: false, message: "請提供 batchId 與至少一筆草稿" };
  }
  const created: PublishDraft[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const draftInput = { ...(drafts[i] as object), batchId };
    const result = createDraft(userId, draftInput);
    if (!result.ok) {
      return {
        ok: false,
        message: `第 ${i + 1} 筆草稿失敗：${result.message}`,
        errors: result.errors,
        notFound: result.notFound,
      };
    }
    created.push(result.data);
    if (result.warnings?.length) warnings.push(...result.warnings);
  }
  return {
    ok: true,
    data: { batchId, drafts: created },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
